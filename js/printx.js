/* ============ 🖨 «Печать и файлы» — printable sheets and files (js/printx.js + css/printx.css, loaded on first use) ============
 * One window with a live preview (UI.modal; on a phone it is a bottom sheet with «Настройки | Просмотр»):
 *   🖨 Печать — a print-ready page (A4, @page CSS) mounted into this document and printed with window.print();
 *              the browser's own dialog saves it as PDF («Сохранить как PDF»), on a phone — print / share.
 *   📄 Файл   — Excel .xlsx (SheetJS, one sheet per deck), Word .docx (real OOXML made with JSZip, headings and
 *              paragraphs, no tables), CSV (UTF-8 with BOM for Excel), plain TXT, Anki and JSON (js/exporters.js).
 * Decks: «Таблица» (№ · Norsk · Перевод · Формы · Пример, the header row repeated on every page, rows never split),
 *        «Карточки для вырезания» (front / back sheets one after another, the back mirrored in every row so that
 *        double-sided printing with a flip on the long edge puts each translation behind its word; 8 or 10 per A4),
 *        «Проверь себя» (Norwegian | translation, a dashed fold line in the middle of the sheet),
 *        «С картинками» (4 big cards per sheet).
 * Texts / books: only Norwegian, word glosses, sentence by sentence, two columns; a page range; the note
 *        «Только для личного использования — не раздавайте распечатки» for private / protected sources.
 * Also: phrases of the day, a dialogue, an exam-prep section, «Мой прогресс» with statistics.
 * Fonts: the app's own Nunito (+ Lora for long texts) from fonts/ — æ ø å and Cyrillic (incl. і ї є ґ) everywhere.
 * 🔒 Files never carry the cards of personal textbook decks (Store.shareableCards, as js/exporters.js does);
 *    a printout keeps them for the owner, with the personal-use note on every page.
 *
 * API (window.PrintX; every call opens the window and returns its modal, or null when there is nothing to print):
 *   PrintX.deck(deckId | [deckIds] | null(all), { cardIds?, layout?, filter? })
 *   PrintX.cards(cards, { title, layout? })                       any list of cards (a search result, a lesson…)
 *   PrintX.text({ title, blocks: [{ no, ru?, uk?, page?, words?: [{ w, ru, uk }] }], mode?, author?, source?,
 *                 personal?|protected? })                         mode: 'no' | 'words' | 'sentences' | 'parallel'
 *   PrintX.phrases(list)        phrases of the day (data/phrase-of-day*.json objects: no, ru, uk, words, grammar_ru, dialog…)
 *   PrintX.dialogue(d)          a dialogue (data/dialogues-public.json: title, titleNo, speakers, lines)
 *   PrintX.examprep(section)    a section of «Подготовка к экзамену»: a topic, task, grammar note, complaint…
 *   PrintX.progress()           «Мой прогресс» + statistics
 *   PrintX.files.{xlsx, docx, csv, txt}(…) and PrintX.build.* — the same without the window (tests, other modules).
 */
(function () {
  'use strict';
  if (window.PrintX) return;

  /* ---------------- small helpers ---------------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plain = s => String(s == null ? '' : s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/(^|[\s(«"])_(.+?)_(?=[\s.,;:!?)»"]|$)/g, '$1$2').trim();
  const md = s => esc(String(s == null ? '' : s).trim()).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(«"])_(.+?)_(?=[\s.,;:!?)»"]|$)/g, '$1<i>$2</i>').replace(/\r?\n/g, '<br>');
  const pl = (n, f) => (window.U && U.plural ? U.plural(n, f) : f[n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2]);
  const nCards = n => `${n} ${pl(n, ['карточка', 'карточки', 'карточек'])}`;
  const toast = (m, k, ms) => { try { if (window.UI && UI.toast) UI.toast(m, k || '', ms); } catch (e) { /* no UI */ } };
  const nice = (e, ctx) => { try { if (window.U && U.niceErr) return U.niceErr(e, ctx); } catch (x) { /* fall through */ } return `${ctx}: что-то пошло не так — попробуйте ещё раз`; };
  const today = () => new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const fileBase = s => (window.U && U.safeFileName ? U.safeFileName(s) : String(s || 'norsk-kort').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80));
  const cssStr = s => '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ').slice(0, 120) + '"';
  const store = () => window.Store;
  const isPhone = () => { try { return matchMedia('(max-width: 720px)').matches; } catch (e) { return false; } };
  const touch = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
  /** a seeded shuffle: the preview and the printout show the same order */
  function shuffle(arr, seed) {
    const a = arr.slice(); let t = seed >>> 0 || 1;
    const rnd = () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const BASE = (() => { try { return new URL('.', document.baseURI).href; } catch (e) { return ''; } })();
  const abs = p => BASE + p;

  /* ---------------- the CSS of the printed page (shared by the preview and the printout) ---------------- */
  const SUBSET_LAT = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
  const SUBSET_CYR = 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';
  const face = (fam, file, style, weight, range) => `@font-face{font-family:'${fam}';font-style:${style};font-weight:${weight};font-display:block;src:url(${abs('fonts/' + file)}) format('woff2');unicode-range:${range}}`;
  const FONT_CSS = [
    face('PX Nunito', 'nunito/nunito-normal-latin.woff2', 'normal', '200 1000', SUBSET_LAT),
    face('PX Nunito', 'nunito/nunito-normal-cyrillic.woff2', 'normal', '200 1000', SUBSET_CYR),
    face('PX Lora', 'lora/lora-normal-latin.woff2', 'normal', '400 700', SUBSET_LAT),
    face('PX Lora', 'lora/lora-normal-cyrillic.woff2', 'normal', '400 700', SUBSET_CYR),
    face('PX Lora', 'lora/lora-italic-latin.woff2', 'italic', '400 700', SUBSET_LAT),
    face('PX Lora', 'lora/lora-italic-cyrillic.woff2', 'italic', '400 700', SUBSET_CYR),
  ].join('\n');
  const SANS = "'PX Nunito','Nunito','Segoe UI',Arial,sans-serif";
  const SERIF = "'PX Lora','Lora',Georgia,'Times New Roman',serif";
  const DOC_CSS = `
.px-doc{--fs:1;font-family:${SANS};color:#16182a;background:#fff;font-size:calc(10.5pt*var(--fs));line-height:1.36;-webkit-print-color-adjust:exact;print-color-adjust:exact;text-align:left}
.px-doc *{box-sizing:border-box}
.px-doc img{max-width:100%}
.px-doc .px-serif{font-family:${SERIF}}
.px-head{display:flex;justify-content:space-between;align-items:flex-end;gap:6mm;border-bottom:1.4pt solid #23264a;padding-bottom:2mm;margin:0 0 4mm}
.px-head h1{font-size:calc(16pt*var(--fs));line-height:1.15;margin:0;font-weight:800}
.px-head .px-sub{font-size:9pt;color:#4a4f70;margin-top:1mm}
.px-head .px-meta{font-size:8.5pt;color:#4a4f70;text-align:right;white-space:nowrap}
.px-note{font-size:8.5pt;color:#6b4300;border:.6pt solid #e2b453;background:#fff7e3;padding:1.4mm 3mm;border-radius:1.6mm;margin:0 0 3.5mm;break-inside:avoid}
.px-hint{font-size:8.5pt;color:#4a4f70;margin:0 0 3mm}
.px-doc h2{font-size:calc(13pt*var(--fs));margin:5mm 0 2.5mm;font-weight:800;break-after:avoid;page-break-after:avoid}
.px-doc h3{font-size:calc(11.5pt*var(--fs));margin:4mm 0 1.5mm;font-weight:800;break-after:avoid;page-break-after:avoid}
.px-doc p{margin:0 0 2.2mm}
.px-sec + .px-sec{margin-top:6mm}
.px-sec.px-newpage + .px-sec{break-before:page;page-break-before:always;margin-top:0}
.px-tr{color:#1f4fa8}
.px-uk::before{content:"укр. ";font-size:.78em;color:#8a90b0;font-weight:600}
.px-small{font-size:.86em;color:#4a4f70}
.px-desc{font-size:.84em;color:#4a4f70;margin-top:.8mm}
.px-ipa{font-size:.86em;color:#6a6f90}
.px-wc{font-size:.78em;color:#8a90b0;font-style:italic}
/* — table — */
table.px-t{width:100%;border-collapse:collapse;table-layout:fixed}
.px-t thead{display:table-header-group}
.px-t tfoot{display:table-footer-group}
.px-t th{font-size:8pt;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#3a3f60;text-align:left;border-bottom:1pt solid #23264a;padding:1.6mm 2mm;background:#eef0f7}
.px-t td{border-bottom:.5pt solid #c8cbd9;padding:1.7mm 2mm;vertical-align:top;overflow-wrap:anywhere}
.px-t tr{break-inside:avoid;page-break-inside:avoid}
.px-t .px-num{color:#8a90b0;font-size:8pt;text-align:right;padding-left:1mm;padding-right:2mm;white-space:nowrap}
.px-t .px-no{font-weight:800;font-size:1.06em}
.px-t .px-thumb{float:right;width:13mm;height:13mm;object-fit:cover;border-radius:1.2mm;margin:0 0 1mm 2mm}
.px-f{font-size:.86em;line-height:1.3;margin-bottom:.5mm}
.px-fl{color:#6a6f90;font-size:.9em}
.px-fl b{color:#3a3f60;font-weight:700}
.px-f .px-fno{font-weight:700}
.px-ex{font-size:.9em;margin-bottom:1mm}
.px-ex .px-exno{font-style:italic}
.px-ex .px-tr{font-size:.95em}
.px-t tbody tr:nth-child(even) td{background:#fafbfe}
/* — sheets with a fixed grid (cut-out cards, picture cards) — */
.px-sheet{position:relative;width:210mm;height:296.4mm;padding:10mm 10mm 11mm;overflow:hidden;break-after:page;page-break-after:always;background:#fff}
.px-sheet.px-land{width:297mm;height:209.4mm}
.px-sheet:last-child{break-after:auto;page-break-after:auto}
.px-grid{display:grid;width:100%;height:100%;grid-template-columns:repeat(var(--cols),minmax(0,1fr));grid-template-rows:repeat(var(--rows),minmax(0,1fr))}
.px-cut .px-grid{border-top:.6pt dashed #8a8fa8;border-left:.6pt dashed #8a8fa8}
.px-cell{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:4mm 5mm;overflow:hidden;min-width:0;min-height:0}
.px-cut .px-cell{border-right:.6pt dashed #8a8fa8;border-bottom:.6pt dashed #8a8fa8}
.px-cell .px-idx{position:absolute;top:1.6mm;left:2.2mm;font-size:6.5pt;color:#a0a5c0}
.px-cell .px-deck{position:absolute;bottom:1.4mm;left:0;right:0;font-size:6pt;color:#b0b4cc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 3mm}
.px-cell .px-img{flex:0 1 auto;max-height:46%;max-width:92%;object-fit:contain;margin-bottom:2mm;border-radius:1.5mm}
.px-cell .px-word{font-weight:800;line-height:1.12;overflow-wrap:anywhere}
.px-cell .px-word.L1{font-size:calc(24pt*var(--fs)*var(--k))}
.px-cell .px-word.L2{font-size:calc(19pt*var(--fs)*var(--k))}
.px-cell .px-word.L3{font-size:calc(15pt*var(--fs)*var(--k))}
.px-cell .px-word.L4{font-size:calc(12.5pt*var(--fs)*var(--k))}
.px-cell .px-word.L5{font-size:calc(10.5pt*var(--fs)*var(--k))}
.px-cell .px-trs{font-weight:700;color:#1f4fa8;line-height:1.18;overflow-wrap:anywhere}
.px-cell .px-trs.L1{font-size:calc(18pt*var(--fs)*var(--k))}
.px-cell .px-trs.L2{font-size:calc(15pt*var(--fs)*var(--k))}
.px-cell .px-trs.L3{font-size:calc(12.5pt*var(--fs)*var(--k))}
.px-cell .px-trs.L4{font-size:calc(11pt*var(--fs)*var(--k))}
.px-cell .px-trs.L5{font-size:calc(9.5pt*var(--fs)*var(--k))}
.px-cell .px-back-x{margin-top:1.6mm;font-size:calc(7.6pt*var(--fs));line-height:1.25;color:#3a3f60;max-width:100%}
.px-cell .px-back-x .px-f{font-size:1em;margin:0}
.px-cell .px-back-x .px-ex{font-size:1em;margin:.8mm 0 0}
.px-sheet-foot{position:absolute;left:10mm;right:10mm;bottom:3.6mm;display:flex;justify-content:space-between;font-size:7pt;color:#8a8fa8}
.px-scissors{position:absolute;top:5.2mm;left:6mm;font-size:9pt;color:#8a8fa8}
.px-empty{color:#d0d3e2}
.px-side-tag,.px-more{display:none}
/* — big picture cards — */
.px-pics .px-grid{gap:6mm}
.px-pics .px-cell{border:.8pt solid #c8cbd9;border-radius:4mm;padding:5mm;justify-content:flex-start}
.px-pics .px-picbox{flex:1 1 auto;width:100%;min-height:0;display:flex;align-items:center;justify-content:center;margin-bottom:3mm}
.px-pics .px-picbox img{max-width:100%;max-height:100%;object-fit:contain;border-radius:2.5mm}
.px-pics .px-letter{font-size:64pt;font-weight:900;color:#d8dbea}
.px-pics .px-word{font-size:calc(22pt*var(--fs))}
.px-pics .px-trs{font-size:calc(14pt*var(--fs));margin-top:1mm}
/* — fold sheet — */
table.px-fold{width:100%;border-collapse:collapse;table-layout:fixed}
.px-fold thead{display:table-header-group}
.px-fold th{font-size:8pt;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#3a3f60;text-align:left;padding:1.4mm 3mm;border-bottom:1pt solid #23264a}
.px-fold td{padding:2.4mm 3mm;border-bottom:.5pt solid #d4d7e4;vertical-align:top;font-size:calc(11.5pt*var(--fs));overflow-wrap:anywhere}
.px-fold tr{break-inside:avoid;page-break-inside:avoid}
.px-fold td.px-r,.px-fold th.px-r{border-left:1.1pt dashed #6a6f90;padding-left:5mm}
.px-fold .px-n{display:inline-block;min-width:7mm;color:#a0a5c0;font-size:8pt}
.px-fold .px-no{font-weight:800}
.px-foldmark{text-align:center;font-size:8pt;color:#6a6f90;margin:-1mm 0 2mm}
/* — texts — */
.px-text{font-family:${SERIF};font-size:calc(11.5pt*var(--fs));line-height:1.55}
.px-text p{margin:0 0 3mm;orphans:2;widows:2}
.px-text .px-pg{font-family:${SANS};font-size:7.5pt;color:#a0a5c0;margin:3mm 0 1mm}
.px-w{white-space:normal}
.px-g{font-family:${SANS};font-size:.66em;color:#1f4fa8;margin-left:.6mm;font-style:normal}
.px-s{margin:0 0 2.6mm;break-inside:avoid;page-break-inside:avoid}
.px-s .px-tr{font-family:${SANS};font-size:.84em;margin-top:.4mm}
table.px-par{width:100%;border-collapse:collapse;table-layout:fixed}
.px-par thead{display:table-header-group}
.px-par th{font-family:${SANS};font-size:8pt;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#3a3f60;text-align:left;padding:1.4mm 3mm;border-bottom:1pt solid #23264a}
.px-par td{vertical-align:top;padding:2mm 3mm;border-bottom:.5pt solid #e0e2ec}
.px-par td + td{border-left:.6pt solid #c8cbd9;font-family:${SANS};font-size:.86em;color:#1f4fa8}
.px-par tr.px-keep{break-inside:avoid;page-break-inside:avoid}
.px-par tr.px-pgrow td{border:0;padding:2mm 3mm 0;break-after:avoid;page-break-after:avoid}
.px-par tr.px-pgrow .px-pg{margin:0}
/* — phrases, dialogues, exam prep, progress — */
.px-block{break-inside:avoid;page-break-inside:avoid;margin:0 0 5mm;padding-bottom:3mm;border-bottom:.6pt solid #d4d7e4}
.px-big{font-size:calc(15pt*var(--fs));font-weight:800;line-height:1.2}
.px-lvl{display:inline-block;font-size:7.5pt;font-weight:800;color:#fff;background:#5b55d6;border-radius:1.2mm;padding:.3mm 1.6mm;margin-left:2mm;vertical-align:middle}
.px-words{display:grid;grid-template-columns:auto 1fr;gap:.6mm 4mm;font-size:.9em;margin:2mm 0}
.px-words .px-wn{font-weight:700}
.px-line{display:grid;grid-template-columns:24mm 1fr;gap:3mm;margin:0 0 1.8mm;break-inside:avoid;page-break-inside:avoid}
.px-line .px-who{font-weight:800;color:#3a3f60;font-size:.9em;overflow-wrap:anywhere}
.px-line.px-two{grid-template-columns:24mm 1fr 1fr}
.px-blank{display:block;border-bottom:.7pt solid #8a8fa8;height:6mm}
.px-blank + .px-blank{margin-top:1mm}
.px-list{margin:0 0 2mm;padding-left:5mm}
.px-list li{margin:0 0 1mm;break-inside:avoid}
.px-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin:0 0 4mm}
.px-kpi{border:.7pt solid #c8cbd9;border-radius:2.5mm;padding:2.5mm 3mm;break-inside:avoid}
.px-kpi b{display:block;font-size:17pt;line-height:1.1}
.px-kpi span{font-size:8pt;color:#4a4f70}
.px-bar{height:2.2mm;background:#e6e8f2;border-radius:1mm;overflow:hidden;margin-top:.8mm}
.px-bar i{display:block;height:100%;background:#22a35a}
.px-chart{margin:1mm 0 4mm}
`;
  /** extra look of the preview (screen): paper on a grey desk */
  const PREVIEW_CSS = `
html,body{margin:0;background:#dfe2ec}
body{padding:10px 0 24px}
.px-doc.px-preview{background:transparent}
.px-preview .px-sheet{margin:0 auto 14px;box-shadow:0 4px 18px rgba(20,24,60,.22)}
.px-preview .px-flow{width:210mm;min-height:120mm;margin:0 auto 14px;padding:14mm 12mm 16mm;background:#fff;box-shadow:0 4px 18px rgba(20,24,60,.22)}
.px-preview.px-landscape .px-flow{width:297mm}
.px-preview .px-more{display:block;width:210mm;margin:0 auto;text-align:center;font:600 12pt ${SANS};color:#4a4f70;padding:4mm}
.px-preview.px-landscape .px-more{width:297mm}
.px-preview .px-side-tag{display:block;width:210mm;margin:0 auto 4px;font:700 9pt ${SANS};color:#4a4f70}
`;
  /** in this document: on screen the printout is hidden, in print only the printout is shown */
  const MOUNT_CSS = `
@media screen{#px-print{display:none!important}}
@media print{
 html,body{background:#fff!important;color:#16182a!important;height:auto!important;min-height:0!important;overflow:visible!important;margin:0!important;padding:0!important;zoom:1!important}
 body>*:not(#px-print){display:none!important}
 #px-print{display:block!important;position:static!important}
 .px-side-tag,.px-more{display:none!important}
}`;
  const PAGE_FONT = `font-family:${SANS};font-size:7.5pt;color:#7a7f9c`;
  /** @page for flowing documents: a running title, the date, «стр. 2 из 5» and the personal-use note on every page */
  function flowPage(o) {
    const size = o.landscape ? 'A4 landscape' : 'A4 portrait';
    return `@page{size:${size};margin:14mm 12mm 15mm 12mm;
 @top-left{content:${cssStr(o.title)};${PAGE_FONT}}
 @top-right{content:${cssStr(o.date || today())};${PAGE_FONT}}
 @bottom-center{content:"стр. " counter(page) " из " counter(pages);${PAGE_FONT}}
 ${o.personal ? `@bottom-left{content:${cssStr(PERSONAL_PRINT)};${PAGE_FONT};color:#9a6a00}` : ''}
 @bottom-right{content:"Norsk Kort";${PAGE_FONT}}
}`;
  }
  const sheetPage = landscape => `@page{size:${landscape ? 'A4 landscape' : 'A4 portrait'};margin:0}`;
  const PERSONAL_PRINT = 'Только для личного использования — не раздавайте распечатки';

  /* ---------------- cards: the fields as text ---------------- */
  const LANGS = { ru: 'Перевод', uk: 'Переклад (укр.)', both: 'Перевод' };
  function trList(ru, uk, lang) {
    ru = plain(ru); uk = plain(uk);
    if (lang === 'uk') return uk ? [{ t: uk, k: 'uk1' }] : ru ? [{ t: ru, k: 'ru' }] : [];
    if (lang === 'both') return [ru && { t: ru, k: 'ru' }, uk && uk !== ru && { t: uk, k: 'uk' }].filter(Boolean);
    return ru ? [{ t: ru, k: 'ru' }] : [];
  }
  const trText = (ru, uk, lang) => trList(ru, uk, lang).map(x => x.t).join(' / ');
  const trHtml = (ru, uk, lang, cls = '') => trList(ru, uk, lang).map(x => `<div class="px-tr ${x.k === 'uk' ? 'px-uk' : ''} ${cls}">${esc(x.t).replace(/\n/g, '<br>')}</div>`).join('');
  function formLabel(f, lang) {
    try {
      if (window.AI && AI.formInfo) {
        const i = AI.formInfo(f, lang === 'uk' ? 'uk' : 'ru');
        if (i) return { no: i.no, name: i.name + (i.note ? ` (${i.note})` : '') };
      }
    } catch (e) { /* the label as it is */ }
    return { no: '', name: plain(f.label || '') };
  }
  const Card = {
    no: c => plain(c.no),
    forms: (c, lang) => (Array.isArray(c.forms) ? c.forms : []).filter(f => f && f.no).map(f => ({ label: formLabel(f, lang), no: plain(f.no), tr: trText(f.ru, f.uk, lang) })),
    examples: (c, lang, all) => {
      const out = [];
      if (c.example) out.push({ no: plain(c.example), tr: trText(c.exampleRu, c.exampleUk, lang) });
      (Array.isArray(c.examples) ? c.examples : []).forEach(e => { if (e && e.no && (all || !out.length)) out.push({ no: plain(e.no), tr: trText(e.ru, e.uk, lang), label: plain(e.label) }); });
      return out;
    },
    ipa: c => plain(c.ipa || c.transcription || c.pron || ''),
    image: c => { const u = String(c.image || ''); return /^(https:\/\/|data:image\/|blob:)/i.test(u) ? u : ''; },
    status: c => { try { return store() ? store().status(c) : 'new'; } catch (e) { return 'new'; } },
  };
  const formLine = (f, html) => {
    const lab = f.label.no ? `${f.label.no} · ${f.label.name}` : f.label.name;
    if (!html) return `${lab ? lab + ': ' : ''}${f.no}${f.tr ? ' — ' + f.tr : ''}`;
    return `<div class="px-f">${lab ? `<span class="px-fl">${f.label.no ? `<b lang="nb">${esc(f.label.no)}</b> · ${esc(f.label.name)}` : esc(f.label.name)}</span> ` : ''}<span class="px-fno" lang="nb">${esc(f.no)}</span>${f.tr ? ` <span class="px-tr">— ${esc(f.tr)}</span>` : ''}</div>`;
  };
  const exHtml = e => `<div class="px-ex"><div class="px-exno" lang="nb">${esc(e.no)}</div>${e.tr ? `<div class="px-tr">${esc(e.tr)}</div>` : ''}</div>`;
  const lenCls = s => { const n = [...String(s || '')].length; return n <= 9 ? 'L1' : n <= 16 ? 'L2' : n <= 28 ? 'L3' : n <= 50 ? 'L4' : 'L5'; };
  const imgTag = (src, cls) => src ? `<img class="${cls}" src="${esc(src)}" alt="" loading="eager" decoding="sync" onerror="this.remove()">` : '';
  const STATUS = { new: 'новая', learning: 'изучаю', debt: 'долг', learned: 'выучено' };

  /* ---------------- decks: which cards, in which order ---------------- */
  function deckGroups(st) {
    const S = store(); if (!S) return [];
    let groups;
    if (st.cards) groups = [{ name: st.title || 'Карточки', cards: st.cards.slice() }];
    else {
      const ids = st.deckIds && st.deckIds.length ? st.deckIds : S.decks().map(d => d.id);
      groups = ids.map(id => S.deck(id)).filter(Boolean).map(d => ({ id: d.id, name: d.name, cards: S.cards(d.id) }));
    }
    const sel = st.filter === 'selected' && st.cardIds && st.cardIds.length ? new Set(st.cardIds) : null;
    const now = Date.now();
    groups.forEach(g => {
      let list = g.cards.filter(c => c && (c.no || c.ru));
      if (sel) list = list.filter(c => sel.has(c.id));
      else if (st.filter === 'due') list = list.filter(c => { try { return S.isDue(c, null, now); } catch (e) { return false; } });
      else if (st.filter === 'leech') list = list.filter(c => (c.tags || []).includes('leech'));
      else if (st.filter && st.filter !== 'all' && st.filter !== 'selected') list = list.filter(c => Card.status(c) === st.filter);
      const key = c => plain(c.no).toLowerCase().replace(/^(en|ei|et|å)\s+/, '');
      if (st.sort === 'no') list.sort((a, b) => key(a).localeCompare(key(b), 'nb'));
      else if (st.sort === 'tr') list.sort((a, b) => plain(st.lang === 'uk' ? (a.uk || a.ru) : a.ru).localeCompare(plain(st.lang === 'uk' ? (b.uk || b.ru) : b.ru), 'ru'));
      else if (st.sort === 'status') { const o = { debt: 0, learning: 1, new: 2, learned: 3 }; list.sort((a, b) => (o[Card.status(a)] ?? 9) - (o[Card.status(b)] ?? 9)); }
      else if (st.sort === 'random') list = shuffle(list, st.seed + (g.id ? g.id.length : 0));
      g.cards = list;
    });
    return groups.filter(g => g.cards.length);
  }
  const countOf = groups => groups.reduce((n, g) => n + g.cards.length, 0);
  const hasPersonal = groups => { const S = store(); return !!(S && S.isPersonalCard && groups.some(g => g.cards.some(c => S.isPersonalCard(c)))); };
  const deckTitle = (st, groups) => st.title || (groups.length === 1 ? groups[0].name : groups.length ? 'Norsk Kort — ' + groups.length + ' ' + pl(groups.length, ['колода', 'колоды', 'колод']) : 'Norsk Kort');

  function headHtml(title, sub, meta, note) {
    return `<header class="px-head"><div><h1>${esc(title)}</h1>${sub ? `<div class="px-sub">${sub}</div>` : ''}</div><div class="px-meta">${meta || esc(today())}</div></header>${note ? `<div class="px-note">🔒 ${esc(note)}</div>` : ''}`;
  }

  /* ---------------- decks: the four printed layouts ---------------- */
  function deckDoc(st, o = {}) {
    const groups = deckGroups(st);
    const total = countOf(groups);
    const title = deckTitle(st, groups);
    const personal = hasPersonal(groups);
    const inc = Object.assign({}, st.inc || {});
    const lang = st.lang || 'ru';
    // the table: no empty «Формы» / «Пример» column when no card has them
    if ((st.layout || 'table') === 'table') {
      const any = f => groups.some(g => g.cards.some(f));
      if (inc.forms && !any(c => Card.forms(c, lang).length)) inc.forms = false;
      if (inc.examples && !any(c => Card.examples(c, lang, false).length)) inc.examples = false;
    }
    let limit = o.limit || Infinity, shown = 0;
    const cut = gs => { const out = []; for (const g of gs) { if (shown >= limit) break; const c = g.cards.slice(0, limit - shown); shown += c.length; out.push(Object.assign({}, g, { cards: c })); } return out; };
    const sub = `${nCards(total)}${groups.length > 1 ? ' · ' + groups.length + ' ' + pl(groups.length, ['колода', 'колоды', 'колод']) : ''}`;
    const fs = { s: 0.88, m: 1, l: 1.14, xl: 1.3 }[st.size || 'm'] || 1;
    const base = { title, total, personal, fs, count: total };
    if (!total) return Object.assign(base, { html: '', pageCss: '' });
    const layout = st.layout || 'table';
    if (layout === 'table') {
      const gs = cut(groups);
      const cols = ['<col style="width:10mm">', '<col>', '<col>'];
      if (inc.forms) cols.push('<col style="width:30%">');
      if (inc.examples) cols.push('<col style="width:28%">');
      let n = 0;
      const rows = g => g.cards.map(c => {
        n++;
        const ipa = inc.ipa && Card.ipa(c), img = inc.pics && Card.image(c);
        const forms = inc.forms ? Card.forms(c, lang) : [], exs = inc.examples ? Card.examples(c, lang, false) : [];
        return `<tr><td class="px-num">${n}</td>
<td>${img ? imgTag(img, 'px-thumb') : ''}<div class="px-no" lang="nb">${esc(Card.no(c))}</div>${ipa ? `<div class="px-ipa">[${esc(ipa)}]</div>` : ''}${c.wordClass ? `<div class="px-wc">${esc(plain(c.wordClass))}</div>` : ''}</td>
<td>${inc.tr !== false ? trHtml(c.ru, c.uk, lang) : ''}${inc.desc && c.description ? `<div class="px-desc">${md(c.description)}</div>` : ''}</td>
${inc.forms ? `<td>${forms.map(f => formLine(f, true)).join('')}</td>` : ''}${inc.examples ? `<td>${exs.slice(0, 2).map(exHtml).join('')}</td>` : ''}</tr>`;
      }).join('');
      const thead = `<thead><tr><th class="px-num">№</th><th>Norsk</th><th>${inc.tr !== false ? LANGS[lang] : 'Пояснение'}</th>${inc.forms ? '<th>Формы</th>' : ''}${inc.examples ? '<th>Пример</th>' : ''}</tr></thead>`;
      const body = gs.map(g => `<section class="px-sec">${groups.length > 1 ? `<h2>${esc(g.name)} <span class="px-small">· ${nCards(g.cards.length)}</span></h2>` : ''}<table class="px-t"><colgroup>${cols.join('')}</colgroup>${thead}<tbody>${rows(g)}</tbody></table></section>`).join('');
      return Object.assign(base, { flow: true, landscape: !!st.landscape, pageCss: flowPage({ title, landscape: st.landscape, personal }),
        html: `<div class="px-flow">${headHtml(title, sub, '', personal ? PERSONAL_PRINT : '')}${body}</div>`, shown });
    }
    if (layout === 'fold') {
      const gs = cut(groups);
      const left = st.foldSide === 'tr' ? 'tr' : 'no';
      let n = 0;
      const cellNo = c => `<span class="px-no" lang="nb">${esc(Card.no(c))}</span>${inc.ipa && Card.ipa(c) ? ` <span class="px-ipa">[${esc(Card.ipa(c))}]</span>` : ''}`;
      const cellTr = c => trList(c.ru, c.uk, lang).map(x => `<span class="${x.k === 'uk' ? 'px-uk' : ''}">${esc(x.t)}</span>`).join('<br>');
      const rows = g => g.cards.map(c => { n++; const a = left === 'no' ? cellNo(c) : cellTr(c), b = left === 'no' ? cellTr(c) : cellNo(c); return `<tr><td><span class="px-n">${n}</span>${a}</td><td class="px-r">${b}</td></tr>`; }).join('');
      const th = left === 'no' ? ['Norsk', LANGS[lang]] : [LANGS[lang], 'Norsk'];
      const body = gs.map(g => `<section class="px-sec">${groups.length > 1 ? `<h2>${esc(g.name)}</h2>` : ''}<table class="px-fold"><colgroup><col style="width:50%"><col style="width:50%"></colgroup><thead><tr><th>${th[0]}</th><th class="px-r">${th[1]}</th></tr></thead><tbody>${rows(g)}</tbody></table></section>`).join('');
      return Object.assign(base, { flow: true, landscape: !!st.landscape, pageCss: flowPage({ title, landscape: st.landscape, personal }),
        html: `<div class="px-flow">${headHtml(title + ' — проверь себя', sub, '', personal ? PERSONAL_PRINT : '')}<p class="px-hint">Согните лист по пунктиру: смотрите на одну половину и вспоминайте другую, потом разверните и проверьте себя.</p><div class="px-foldmark">✂ · · · линия сгиба · · · ✂</div>${body}</div>`, shown });
    }
    // fixed grids: all decks' cards in one run
    const all = [];
    groups.forEach(g => g.cards.forEach(c => all.push({ c, deck: g.name })));
    if (layout === 'pics') {
      const land = !!st.landscape, per = 4, cols = 2, rows = 2;
      const sheets = Math.ceil(all.length / per);
      const maxSheets = o.limit ? Math.max(1, Math.ceil(o.limit / per)) : sheets;
      let html = '';
      for (let s = 0; s < Math.min(sheets, maxSheets); s++) {
        const part = all.slice(s * per, s * per + per);
        const cells = part.map(({ c }) => {
          const img = Card.image(c), no = Card.no(c), letter = esc((no.replace(/^(en|ei|et|å)\s+/i, '')[0] || '·').toUpperCase());
          return `<div class="px-cell"><div class="px-picbox">${img ? `<img src="${esc(img)}" alt="" loading="eager" onerror="this.nextElementSibling.hidden=false;this.remove()"><span class="px-letter" hidden>${letter}</span>` : `<span class="px-letter">${letter}</span>`}</div>
<div class="px-word" lang="nb">${esc(no)}</div>${inc.ipa && Card.ipa(c) ? `<div class="px-ipa">[${esc(Card.ipa(c))}]</div>` : ''}${inc.tr !== false ? `<div class="px-trs">${esc(trText(c.ru, c.uk, lang))}</div>` : ''}</div>`;
        }).join('') + '<div class="px-cell px-empty-cell"></div>'.repeat(per - part.length);
        html += `<section class="px-sheet px-pics ${land ? 'px-land' : ''}"><div class="px-grid" style="--cols:${cols};--rows:${rows}">${cells}</div><div class="px-sheet-foot"><span>${esc(title)}</span><span>${personal ? esc(PERSONAL_PRINT) + ' · ' : ''}лист ${s + 1} из ${sheets}</span></div></section>`;
      }
      return Object.assign(base, { sheets, landscape: land, pageCss: sheetPage(land), html, more: sheets > maxSheets ? sheets - maxSheets : 0 });
    }
    // ✂ cut-out cards: a front sheet and its back, the back mirrored in every row (a flip on the long edge)
    const per = st.perPage === 10 ? 10 : 8, cols = 2, rows = per / cols;
    const k = per === 10 ? 0.88 : 1;
    const sheets = Math.ceil(all.length / per);
    const maxSheets = o.limit ? Math.max(1, Math.ceil(o.limit / per)) : sheets;
    const manual = st.duplex === 'manual';
    const part = o.part || 'all';
    const fronts = [], backs = [];
    const HINT_FRONT = manual ? 'Сначала все лицевые, потом обороты — переверните пачку по длинной стороне' : 'Двусторонняя печать · переворот по длинной стороне';
    for (let s = 0; s < Math.min(sheets, maxSheets); s++) {
      const cells = all.slice(s * per, s * per + per);
      const front = [], back = [];
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const i = r * cols + col, x = cells[i];
          front.push(x ? frontCell(x, s * per + i + 1) : '<div class="px-cell"></div>');
        }
        // the back of this row: the same cards from right to left (flip on the long edge)
        for (let col = cols - 1; col >= 0; col--) {
          const i = r * cols + col, x = cells[i];
          back.push(x ? backCell(x, s * per + i + 1) : '<div class="px-cell"></div>');
        }
      }
      const foot = (side, hint) => `<div class="px-sheet-foot"><span>${side} · лист ${s + 1} из ${sheets}${hint ? ' · ' + hint : ''}</span><span>${personal ? esc(PERSONAL_PRINT) : esc(title)}</span></div>`;
      fronts.push(`<span class="px-side-tag">Лист ${s + 1} — лицевая сторона</span><section class="px-sheet px-cut" data-side="front" data-sheet="${s + 1}"><span class="px-scissors">✂</span><div class="px-grid" style="--cols:${cols};--rows:${rows};--k:${k}">${front.join('')}</div>${foot('Лицевая сторона', s === 0 ? HINT_FRONT : '')}</section>`);
      backs.push(`<span class="px-side-tag">Лист ${s + 1} — оборот (ряды зеркально)</span><section class="px-sheet px-cut" data-side="back" data-sheet="${s + 1}"><div class="px-grid" style="--cols:${cols};--rows:${rows};--k:${k}">${back.join('')}</div>${foot('Оборот', '')}</section>`);
    }
    if (manual && st.backOrder === 'reverse') backs.reverse();
    let pages;
    if (part === 'front') pages = fronts;
    else if (part === 'back') pages = backs;
    else if (manual) pages = fronts.concat(backs);
    else { pages = []; fronts.forEach((f, i) => pages.push(f, backs[i])); }
    const html = pages.join('');
    const mult = part === 'all' ? 2 : 1;
    function frontCell({ c, deck }, n) {
      const img = inc.pics && Card.image(c), no = Card.no(c), ipa = inc.ipa && Card.ipa(c);
      return `<div class="px-cell" data-n="${n}"><span class="px-idx">${n}</span>${img ? imgTag(img, 'px-img') : ''}<div class="px-word ${lenCls(no)}" lang="nb">${esc(no)}</div>${ipa ? `<div class="px-ipa">[${esc(ipa)}]</div>` : ''}${groups.length > 1 ? `<span class="px-deck">${esc(deck)}</span>` : ''}</div>`;
    }
    function backCell({ c }, n) {
      const t = inc.tr !== false ? trList(c.ru, c.uk, lang) : [];
      const tt = t.map(x => x.t).join(' / ');
      const forms = inc.forms ? Card.forms(c, lang).slice(0, per === 10 ? 3 : 4) : [];
      const ex = inc.examples ? Card.examples(c, lang, false).slice(0, 1) : [];
      const desc = inc.desc && c.description ? plain(c.description).split('\n')[0].slice(0, 110) : '';
      const extra = forms.map(f => `<div class="px-f"><span class="px-fno" lang="nb">${esc(f.no)}</span>${f.label.no ? ` <span class="px-fl">${esc(f.label.no)}</span>` : ''}</div>`).join('') + ex.map(exHtml).join('') + (desc ? `<div class="px-desc">${esc(desc)}</div>` : '');
      return `<div class="px-cell" data-n="${n}"><span class="px-idx">${n}</span><div class="px-trs ${lenCls(tt)}">${t.map(x => `<span class="${x.k === 'uk' ? 'px-uk' : ''}">${esc(x.t)}</span>`).join('<br>')}</div>${extra ? `<div class="px-back-x">${extra}</div>` : ''}</div>`;
    }
    return Object.assign(base, { sheets: sheets * mult, cardSheets: sheets, landscape: false, pageCss: sheetPage(false), html, more: sheets > maxSheets ? (sheets - maxSheets) * mult : 0 });
  }

  /* ---------------- Word .docx (real OOXML, no tables) ---------------- */
  const XML_BAD = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;
  const xesc = s => String(s == null ? '' : s).replace(XML_BAD, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  /** paragraph = { style: 'Title'|'Heading1'|'Heading2'|'Normal'|'Forms'|'Example'|'Note'|'Translation', runs: [{ t, b, i, color, lang }], keep } */
  const P = (style, runs, keep) => ({ style, runs: (Array.isArray(runs) ? runs : [runs]).filter(r => r && (typeof r === 'string' ? r : r.t)).map(r => (typeof r === 'string' ? { t: r } : r)), keep });
  function runXml(r) {
    const pr = [r.b ? '<w:b/><w:bCs/>' : '', r.i ? '<w:i/><w:iCs/>' : '', r.color ? `<w:color w:val="${r.color}"/>` : '', r.sz ? `<w:sz w:val="${r.sz}"/><w:szCs w:val="${r.sz}"/>` : '', r.lang ? `<w:lang w:val="${r.lang}"/>` : ''].join('');
    return String(r.t).split('\n').map((line, i) => `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${xesc(line)}</w:t></w:r>`).join('');
  }
  const paraXml = p => `<w:p><w:pPr><w:pStyle w:val="${p.style || 'Normal'}"/>${p.keep ? '<w:keepNext/><w:keepLines/>' : ''}</w:pPr>${p.runs.map(runXml).join('')}</w:p>`;
  function docxParts(title, paras, o = {}) {
    const land = !!o.landscape;
    const sect = `<w:sectPr><w:pgSz w:w="${land ? 16838 : 11906}" w:h="${land ? 11906 : 16838}"${land ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="1134" w:right="1077" w:bottom="1134" w:left="1077" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>`;
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const font = '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/>';
    const st = (id, name, ppr, rpr, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"${id === 'Normal' ? ' w:default="1"' : ''}><w:name w:val="${name}"/>${id !== 'Normal' ? '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/>' : ''}${extra}<w:qFormat/><w:pPr>${ppr}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr>${font}<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="ru-RU" w:eastAsia="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
${st('Normal', 'Normal', '', '')}
${st('Title', 'Title', '<w:spacing w:after="120"/>', '<w:b/><w:bCs/><w:color w:val="23264A"/><w:sz w:val="40"/><w:szCs w:val="40"/>')}
${st('Subtitle', 'Subtitle', '<w:spacing w:after="240"/>', '<w:color w:val="4A4F70"/><w:sz w:val="20"/><w:szCs w:val="20"/>')}
${st('Heading1', 'heading 1', '<w:keepNext/><w:spacing w:before="360" w:after="120"/><w:outlineLvl w:val="0"/>', '<w:b/><w:bCs/><w:color w:val="23264A"/><w:sz w:val="32"/><w:szCs w:val="32"/>')}
${st('Heading2', 'heading 2', '<w:keepNext/><w:keepLines/><w:spacing w:before="240" w:after="40"/><w:outlineLvl w:val="1"/>', '<w:b/><w:bCs/><w:color w:val="16182A"/><w:sz w:val="26"/><w:szCs w:val="26"/>')}
${st('Forms', 'Forms', '<w:spacing w:after="40"/><w:ind w:left="284"/>', '<w:color w:val="3A3F60"/><w:sz w:val="20"/><w:szCs w:val="20"/>')}
${st('Example', 'Example', '<w:spacing w:after="40"/><w:ind w:left="284"/>', '<w:sz w:val="21"/><w:szCs w:val="21"/>')}
${st('Translation', 'Translation', '<w:spacing w:after="120"/>', '<w:color w:val="1F4FA8"/>')}
${st('Note', 'Note', '<w:spacing w:after="160"/><w:pBdr><w:left w:val="single" w:sz="12" w:space="6" w:color="E2B453"/></w:pBdr>', '<w:color w:val="6B4300"/><w:sz w:val="19"/><w:szCs w:val="19"/>')}
</w:styles>`;
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}><w:body>${paras.map(paraXml).join('')}${sect}</w:body></w:document>`;
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    return {
      '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
      '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
      'word/_rels/document.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/></Relationships>`,
      'word/document.xml': doc,
      'word/styles.xml': styles,
      'word/settings.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings ${NS}><w:defaultTabStop w:val="708"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`,
      'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xesc(title)}</dc:title><dc:creator>Norsk Kort</dc:creator><dc:language>ru-RU</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`,
      'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Norsk Kort</Application></Properties>`,
    };
  }
  async function docxBlob(title, paras, o) {
    const JSZip = await lib('jszip');
    const zip = new JSZip();
    const parts = docxParts(title, paras, o);
    // [Content_Types].xml first — some readers look for it at the start of the archive
    Object.keys(parts).forEach(k => zip.file(k, parts[k]));
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }
  /** the same paragraphs as plain text */
  function parasText(paras) {
    const out = [];
    paras.forEach(p => {
      const t = p.runs.map(r => r.t).join('');
      if (p.style === 'Title') out.push(t, '='.repeat(Math.min(60, [...t].length)));
      else if (p.style === 'Heading1') out.push('', t.toUpperCase(), '-'.repeat(Math.min(60, [...t].length)));
      else if (p.style === 'Heading2') out.push('', t);
      else if (p.style === 'Forms' || p.style === 'Example') out.push('   ' + t.replace(/\n/g, '\n   '));
      else out.push(t);
    });
    return out.join('\r\n').replace(/(\r\n){3,}/g, '\r\n\r\n').trim() + '\r\n';
  }

  /* ---------------- deck files ---------------- */
  /** the columns of Excel / CSV (a column only when that content is chosen) */
  function deckColumns(st, groups) {
    const inc = st.inc || {}, lang = st.lang || 'ru';
    const any = f => groups.some(g => g.cards.some(f));
    const cols = [['№', (c, i) => i + 1], ['Norsk', c => Card.no(c)]];
    if (inc.ipa && any(c => Card.ipa(c))) cols.push(['Транскрипция', c => Card.ipa(c)]);
    if (inc.tr !== false) {
      if (lang !== 'uk') cols.push(['Перевод', c => plain(c.ru)]);
      if (lang !== 'ru') cols.push(['Переклад (укр.)', c => plain(c.uk)]);
    }
    cols.push(['Часть речи', c => plain(c.wordClass)]);
    if (inc.forms) cols.push(['Формы', c => Card.forms(c, lang).map(f => formLine(f, false)).join('\n')]);
    if (inc.examples) {
      cols.push(['Пример', c => plain(c.example)], ['Перевод примера', c => trText(c.exampleRu, c.exampleUk, lang)]);
      if (any(c => (c.examples || []).length)) cols.push(['Ещё примеры', c => (c.examples || []).filter(e => e && e.no).map(e => `${plain(e.no)}${e.ru || e.uk ? ' — ' + trText(e.ru, e.uk, lang) : ''}`).join('\n')]);
    }
    if (inc.desc) cols.push(['Описание', c => plain(c.description)]);
    if (any(c => (c.synonyms || []).length)) cols.push(['Синонимы', c => (c.synonyms || []).map(s => `${plain(s.no)}${s.ru ? ' (' + plain(s.ru) + ')' : ''}`).join('\n')]);
    cols.push(['Теги', c => (c.tags || []).join(' ')], ['Статус', c => STATUS[Card.status(c)] || '']);
    if (inc.pics) cols.push(['Картинка (ссылка)', c => (/^https:/.test(Card.image(c)) ? Card.image(c) : '')]);
    return cols;
  }
  /** files leave the device: without the cards of personal textbook decks */
  function shareGroups(groups) {
    const S = store(); let skipped = 0;
    if (!S || !S.shareableCards) return { groups, skipped };
    const out = groups.map(g => { const r = S.shareableCards(g.cards); skipped += r.skipped; return Object.assign({}, g, { cards: r.cards }); }).filter(g => g.cards.length);
    return { groups: out, skipped };
  }
  function deckParas(st, groups) {
    const inc = st.inc || {}, lang = st.lang || 'ru', title = deckTitle(st, groups);
    const paras = [P('Title', title), P('Subtitle', `${nCards(countOf(groups))} · ${today()} · Norsk Kort`)];
    groups.forEach(g => {
      if (groups.length > 1) paras.push(P('Heading1', g.name));
      g.cards.forEach(c => {
        const t = inc.tr !== false ? trText(c.ru, c.uk, lang) : '';
        const ipa = inc.ipa && Card.ipa(c);
        const block = [P('Heading2', [{ t: Card.no(c), b: true, lang: 'nb-NO' }, ipa && { t: ` [${ipa}]`, b: false, color: '6A6F90' }, t && { t: ' — ' + t, b: false, color: '1F4FA8' }])];
        if (c.wordClass) block.push(P('Forms', { t: plain(c.wordClass), i: true, color: '8A90B0' }));
        if (inc.forms) {
          const fs = Card.forms(c, lang);
          if (fs.length) block.push(P('Forms', [{ t: 'Формы: ', b: true }].concat(fs.flatMap((f, i) => [i ? { t: '; ' } : null, f.label.no || f.label.name ? { t: (f.label.no ? f.label.no + ' · ' + f.label.name : f.label.name) + ': ', color: '6A6F90' } : null, { t: f.no, b: true, lang: 'nb-NO' }, f.tr ? { t: ' — ' + f.tr } : null]).filter(Boolean))));
        }
        if (inc.examples) Card.examples(c, lang, true).slice(0, 4).forEach(e => block.push(P('Example', [{ t: e.no, i: true, lang: 'nb-NO' }, e.tr && { t: ' — ' + e.tr, color: '1F4FA8' }])));
        if (inc.desc && c.description) block.push(P('Normal', { t: plain(c.description), color: '4A4F70', sz: 20 }));
        // a card stays on one page: every paragraph but the last keeps with the next
        block.forEach((p, i) => { p.keep = i < block.length - 1; });
        paras.push(...block);
      });
    });
    return paras;
  }
  async function xlsxBlob(st, groups) {
    const XLSX = await lib('xlsx');
    const wb = XLSX.utils.book_new();
    const used = new Set();
    const sheetName = n => { let s = String(n || 'Карточки').replace(/[[\]:*?/\\]/g, ' ').replace(/^'+|'+$/g, '').trim().slice(0, 31) || 'Карточки'; let k = 2, b = s; while (used.has(s.toLowerCase())) { const suf = ` (${k++})`; s = b.slice(0, 31 - suf.length) + suf; } used.add(s.toLowerCase()); return s; };
    groups.forEach(g => {
      const cols = deckColumns(st, [g]);
      const aoa = [cols.map(c => c[0])].concat(g.cards.map((c, i) => cols.map(([, f]) => { const v = f(c, i); return typeof v === 'number' ? v : String(v == null ? '' : v).slice(0, 32000); })));
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      const W = { '№': 5, Norsk: 26, 'Транскрипция': 16, 'Перевод': 30, 'Переклад (укр.)': 30, 'Часть речи': 12, 'Формы': 44, 'Пример': 40, 'Перевод примера': 40, 'Ещё примеры': 44, 'Описание': 50, 'Синонимы': 28, 'Теги': 16, 'Статус': 10, 'Картинка (ссылка)': 30 };
      ws['!cols'] = cols.map(c => ({ wch: W[c[0]] || 18 }));
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: cols.length - 1 } }) };
      XLSX.utils.book_append_sheet(wb, ws, sheetName(g.name));
    });
    wb.Props = { Title: deckTitle(st, groups), Author: 'Norsk Kort' };
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function csvText(st, groups) {
    const cols = deckColumns(st, groups);
    const multi = groups.length > 1;
    const cell = s => { s = String(s == null ? '' : s); return /[";\n\r,]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [(multi ? ['Колода'] : []).concat(cols.map(c => c[0]))];
    let n = 0;
    groups.forEach(g => g.cards.forEach(c => { const i = n++; rows.push((multi ? [g.name] : []).concat(cols.map(([, f]) => f(c, i)))); }));
    return '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }
  const deckTxt = (st, groups) => parasText(deckParas(st, groups));

  /* ---------------- texts / books ---------------- */
  const WORD_RX = /(\p{L}[\p{L}\p{M}'’-]*)/u;
  function glossFinder(blocks, lang) {
    const map = new Map();
    const S = store();
    try {
      (S ? S.cards() : []).forEach(c => {
        const t = plain(lang === 'uk' ? (c.uk || c.ru) : c.ru).split(/[;\n]/)[0].trim();
        if (!t) return;
        const key = plain(c.no).toLowerCase().replace(/^(en|ei|et|å)\s+/, '');
        if (key && !key.includes(' ') && !map.has(key)) map.set(key, t);
        (c.forms || []).forEach(f => { const k = plain(f.no).toLowerCase().replace(/^(en|ei|et|å|har|hadde|jeg)\s+/, ''); if (k && !k.includes(' ') && !map.has(k)) map.set(k, t); });
      });
    } catch (e) { /* no cards */ }
    blocks.forEach(b => (b.words || []).forEach(w => { const k = String(w.w || '').toLowerCase(); const t = lang === 'uk' ? (w.uk || w.ru) : w.ru; if (k && t) map.set(k, plain(t)); }));
    return word => {
      const k = word.toLowerCase();
      if (map.has(k)) return map.get(k);
      try { if (lang !== 'uk' && window.NoGloss) { const g = NoGloss.get(k); if (g) return g; } } catch (e) { /* none */ }
      try {
        if (window.Lexicon && Lexicon.peek) { const c = Lexicon.peek(k); const l = c && c[0] && c[0].lemma.toLowerCase(); if (l && map.has(l)) return map.get(l); }
      } catch (e) { /* not loaded */ }
      return '';
    };
  }
  const sentences = s => (String(s || '').replace(/\s+/g, ' ').trim().match(/[^.!?…]+(?:[.!?…]+["»”)]*|$)\s*/g) || []).map(x => x.trim()).filter(Boolean);
  function textBlocks(st) {
    const all = (st.blocks || []).map((b, i) => Object.assign({ idx: i + 1 }, typeof b === 'string' ? { no: b } : b)).filter(b => b.no || b.ru);
    const byPage = all.some(b => b.page != null);
    const from = +st.from || 0, to = +st.to || 0;
    return all.filter(b => { const k = byPage ? +b.page : b.idx; return (!from || k >= from) && (!to || k <= to); });
  }
  function textDoc(st, o = {}) {
    let blocks = textBlocks(st);
    const total = blocks.length;
    if (o.limit) blocks = blocks.slice(0, o.limit);
    const lang = st.lang || 'ru', mode = st.mode || 'no', personal = !!st.personal;
    const fs = { s: 0.88, m: 1, l: 1.14, xl: 1.3 }[st.size || 'm'] || 1;
    const title = st.title || 'Текст';
    const sub = [st.author, st.source].filter(Boolean).map(esc).join(' · ');
    const MODE = { no: 'только норвежский текст', words: 'перевод после каждого слова', sentences: 'перевод после каждого предложения', parallel: 'норвежский и перевод рядом' };
    let body = '';
    let lastPage = null;
    const pageTag = b => { if (b.page == null || b.page === lastPage) return ''; lastPage = b.page; return `<div class="px-pg">стр. ${esc(b.page)}</div>`; };
    if (mode === 'parallel') {
      body = `<table class="px-par"><colgroup><col style="width:55%"><col style="width:45%"></colgroup><thead><tr><th>Norsk</th><th>${LANGS[lang]}</th></tr></thead><tbody>${blocks.map(b => { const pg = pageTag(b); return `${pg ? `<tr class="px-pgrow"><td colspan="2">${pg}</td></tr>` : ''}<tr class="${String(b.no || '').length < 900 ? 'px-keep' : ''}"><td lang="nb">${md(b.no)}</td><td>${trHtml(b.ru, b.uk, lang)}</td></tr>`; }).join('')}</tbody></table>`;
    } else if (mode === 'sentences') {
      body = blocks.map(b => {
        const a = sentences(b.no), t = sentences(lang === 'uk' ? (b.uk || b.ru) : b.ru);
        const tb = lang === 'both' ? sentences(b.uk) : [];
        if (a.length && a.length === t.length) return pageTag(b) + a.map((s, i) => `<div class="px-s"><div lang="nb">${esc(s)}</div>${lang === 'both' && tb.length === a.length ? trHtml(t[i], tb[i], 'both') : `<div class="px-tr">${esc(t[i])}</div>`}</div>`).join('') + '<div style="height:2mm"></div>';
        return pageTag(b) + `<div class="px-s"><div lang="nb">${md(b.no)}</div>${trHtml(b.ru, b.uk, lang)}</div>`;
      }).join('');
    } else if (mode === 'words') {
      const gloss = glossFinder(blocks, lang === 'uk' ? 'uk' : 'ru');
      body = blocks.map(b => pageTag(b) + `<p lang="nb">${String(b.no || '').split(WORD_RX).map((part, i) => { if (i % 2 === 0) return esc(part); const g = gloss(part); return g ? `<span class="px-w">${esc(part)}<span class="px-g">(${esc(g)})</span></span>` : esc(part); }).join('')}</p>`).join('');
    } else {
      body = blocks.map(b => pageTag(b) + `<p lang="nb">${md(b.no)}</p>`).join('');
    }
    const head = headHtml(title, [sub, MODE[mode]].filter(Boolean).join(' · '), '', personal ? PERSONAL_PRINT : '');
    return { title, total, count: total, fs, personal, flow: true, landscape: !!st.landscape, shown: blocks.length,
      pageCss: flowPage({ title, landscape: st.landscape, personal }), html: `<div class="px-flow">${head}<div class="px-text">${body}</div></div>` };
  }
  function textParas(st) {
    const blocks = textBlocks(st), lang = st.lang || 'ru', mode = st.mode || 'no';
    const paras = [P('Title', st.title || 'Текст')];
    const sub = [st.author, st.source, today()].filter(Boolean).join(' · ');
    paras.push(P('Subtitle', sub));
    if (st.personal) paras.push(P('Note', PERSONAL_PRINT));
    const gloss = mode === 'words' ? glossFinder(blocks, lang === 'uk' ? 'uk' : 'ru') : null;
    let lastPage = null;
    blocks.forEach(b => {
      if (b.page != null && b.page !== lastPage) { lastPage = b.page; paras.push(P('Forms', { t: `— стр. ${b.page} —`, color: '8A90B0' })); }
      if (mode === 'no') return paras.push(P('Normal', { t: plain(b.no), lang: 'nb-NO' }));
      if (mode === 'words') return paras.push(P('Normal', String(b.no || '').split(WORD_RX).map((part, i) => { if (i % 2 === 0) return { t: part, lang: 'nb-NO' }; const g = gloss(part); return [{ t: part, lang: 'nb-NO' }, g && { t: ` (${g})`, color: '1F4FA8', sz: 17 }]; }).flat().filter(r => r && r.t)));
      if (mode === 'sentences') {
        const a = sentences(b.no), t = sentences(lang === 'uk' ? (b.uk || b.ru) : b.ru);
        if (a.length && a.length === t.length) { a.forEach((s, i) => { paras.push(P('Normal', { t: s, lang: 'nb-NO' }, true), P('Translation', { t: t[i] })); }); return; }
      }
      paras.push(P('Normal', { t: plain(b.no), lang: 'nb-NO' }, true), P('Translation', { t: trText(b.ru, b.uk, lang) }));
    });
    return paras;
  }

  /* ---------------- phrases of the day ---------------- */
  function phrasesParts(st, o = {}) {
    let list = (st.list || []).filter(p => p && p.no);
    const total = list.length;
    if (o.limit) list = list.slice(0, o.limit);
    const lang = st.lang || 'ru', inc = st.inc || {};
    const T = (x, k = '') => trText(x[k + 'ru'] || x[(k ? k + '_' : '') + 'ru'], x[k + 'uk'] || x[(k ? k + '_' : '') + 'uk'], lang);
    const html = list.map((p, i) => {
      const words = inc.words && (p.words || []).length ? `<div class="px-words">${p.words.map(w => `<span class="px-wn" lang="nb">${esc(w.base && w.base !== w.w ? `${w.w} (${w.base})` : w.w)}</span><span>${esc(trText(w.ru, w.uk, lang))}${w.note ? ` <span class="px-small">— ${esc(w.note)}</span>` : ''}</span>`).join('')}</div>` : '';
      const gr = inc.grammar && (lang === 'uk' ? (p.grammar_uk || p.grammar_ru) : p.grammar_ru);
      const pat = inc.pattern && p.pattern ? `<p class="px-small"><b>Образец:</b> <span lang="nb">${esc(p.pattern)}</span>${p.model ? ` — например: <i lang="nb">${esc(p.model)}</i> (${esc(trText(p.model_ru, p.model_uk, lang))})` : ''}</p>` : '';
      const dlg = inc.dialog && (p.dialog || []).length ? `<h3>Диалог</h3>${p.dialog.map(l => `<div class="px-line"><span class="px-who">${esc(l.who)}</span><div><div lang="nb">${esc(l.no)}</div>${trHtml(l.ru, l.uk, lang, 'px-small')}</div></div>`).join('')}` : '';
      return `<article class="px-block"><div class="px-big" lang="nb">${esc(p.no)}${p.level ? `<span class="px-lvl">${esc(p.level)}</span>` : ''}</div>${trHtml(p.ru, p.uk, lang)}${p.date ? `<div class="px-small">${esc(p.date)}</div>` : ''}${words}${gr ? `<p class="px-desc">${md(gr)}</p>` : ''}${pat}${dlg}</article>`;
    }).join('');
    const paras = [P('Title', st.title || 'Фразы дня'), P('Subtitle', `${total} ${pl(total, ['фраза', 'фразы', 'фраз'])} · ${today()}`)];
    (st.list || []).filter(p => p && p.no).forEach(p => {
      paras.push(P('Heading2', [{ t: p.no, lang: 'nb-NO' }, p.level && { t: `  ${p.level}`, color: '5B55D6', sz: 18 }]), P('Translation', T(p)));
      if (inc.words) (p.words || []).forEach(w => paras.push(P('Forms', [{ t: w.w, b: true, lang: 'nb-NO' }, w.base && w.base !== w.w && { t: ` (${w.base})`, lang: 'nb-NO' }, { t: ' — ' + trText(w.ru, w.uk, lang) }, w.note && { t: ' · ' + w.note, color: '6A6F90' }])));
      const gr = inc.grammar && (lang === 'uk' ? (p.grammar_uk || p.grammar_ru) : p.grammar_ru);
      if (gr) paras.push(P('Normal', { t: plain(gr), color: '4A4F70', sz: 20 }));
      if (inc.pattern && p.pattern) paras.push(P('Example', [{ t: 'Образец: ', b: true }, { t: p.pattern, lang: 'nb-NO' }, p.model && { t: ` — ${p.model}`, i: true, lang: 'nb-NO' }]));
      if (inc.dialog) (p.dialog || []).forEach(l => paras.push(P('Example', [{ t: l.who + ': ', b: true }, { t: l.no, lang: 'nb-NO' }, { t: '  — ' + trText(l.ru, l.uk, lang), color: '1F4FA8' }])));
    });
    return { total, shown: list.length, html, paras };
  }

  /* ---------------- a dialogue ---------------- */
  function dialogueParts(st, o = {}) {
    const d = st.d || {}, lang = st.lang || 'ru';
    let lines = (d.lines || []).filter(l => l && l.no);
    const total = lines.length;
    if (o.limit) lines = lines.slice(0, o.limit);
    const sp = {}; (d.speakers || []).forEach(s => { sp[s.id] = s; });
    const who = l => (sp[l.who] && sp[l.who].name) || l.who || '';
    const hide = st.hide || '';
    const showTr = st.trMode !== 'none';
    const two = st.trMode === 'side';
    const title = (lang === 'uk' && d.titleUk) || d.title || d.titleNo || 'Диалог';
    const roles = (d.speakers || []).map(s => `<li><b>${esc(s.name)}</b> — ${esc(trText(s.ru, s.uk, lang))}</li>`).join('');
    const html = `${d.titleNo ? `<p class="px-big" lang="nb">${esc(d.titleNo)}${d.level ? `<span class="px-lvl">${esc(d.level)}</span>` : ''}</p>` : ''}${d.note ? `<p class="px-desc">${esc(lang === 'uk' && d.noteUk ? d.noteUk : d.note)}</p>` : ''}${roles ? `<ul class="px-list">${roles}</ul>` : ''}
${hide ? `<p class="px-hint">Реплики «${esc(who({ who: hide }))}» скрыты — впишите их сами, потом сверьтесь с приложением.</p>` : ''}
${lines.map(l => {
      const hidden = hide && l.who === hide;
      const no = hidden ? '<span class="px-blank"></span><span class="px-blank"></span>' : `<div lang="nb">${esc(l.no)}</div>`;
      const tr = showTr ? trHtml(l.ru, l.uk, lang, two ? '' : 'px-small') : '';
      return two ? `<div class="px-line px-two"><span class="px-who">${esc(who(l))}</span><div>${no}</div><div>${tr}</div></div>` : `<div class="px-line"><span class="px-who">${esc(who(l))}</span><div>${no}${tr}</div></div>`;
    }).join('')}`;
    const paras = [P('Title', title), P('Subtitle', [d.titleNo, d.level, today()].filter(Boolean).join(' · '))];
    if (d.note) paras.push(P('Normal', { t: lang === 'uk' && d.noteUk ? d.noteUk : d.note, color: '4A4F70' }));
    (d.speakers || []).forEach(s => paras.push(P('Forms', [{ t: s.name, b: true }, { t: ' — ' + trText(s.ru, s.uk, lang) }])));
    (d.lines || []).filter(l => l && l.no).forEach(l => {
      const hidden = hide && l.who === hide;
      paras.push(P('Normal', [{ t: who(l) + ': ', b: true }, { t: hidden ? '_______________________________________' : l.no, lang: 'nb-NO' }], showTr));
      if (showTr) paras.push(P('Translation', { t: trText(l.ru, l.uk, lang) }));
    });
    return { total, shown: lines.length, html, paras, title };
  }

  /* ---------------- an exam-prep section (topic, task, grammar note, complaint letter…) ---------------- */
  function examParts(st, o = {}) {
    const s = st.section || {}, lang = st.lang || 'ru', inc = st.inc || {};
    const L = (x, k) => (lang === 'uk' ? (x[k + 'Uk'] || x[k + '_uk'] || x[k === 'ru' ? 'uk' : k] || x[k]) : x[k]);
    const title = [s.icon, (lang === 'uk' ? s.uk : s.ru) || s.title || s.no].filter(Boolean).join(' ');
    const html = [], paras = [P('Title', title.replace(/^\p{Extended_Pictographic}\s*/u, '')), P('Subtitle', [s.no && s.no !== title ? s.no : '', s.levels || s.lvl || s.level, today()].filter(Boolean).join(' · '))];
    const text = s.what || s.text || s.note || s.about;
    if (s.no && (s.ru || s.title)) html.push(`<p class="px-big" lang="nb">${esc(s.no)}</p>`);
    if (s.levels || s.time || s.lvl) html.push(`<p class="px-small">${[s.levels || s.lvl, s.time].filter(Boolean).map(esc).join(' · ')}</p>`);
    if (text) { html.push(`<p>${md(L(s, s.what ? 'what' : s.text ? 'text' : s.note ? 'note' : 'about') || text)}</p>`); paras.push(P('Normal', plain(text))); }
    if ((s.steps || []).length) {
      html.push(`<h2>Как построить ответ</h2><ol class="px-list">${s.steps.map(x => `<li><b>${esc(L(x, 'ru') || x.ru || '')}</b>${x.hint ? ` <span class="px-small">— ${esc(x.hint)}</span>` : ''}${(x.starters || []).length ? `<div lang="nb" class="px-small">${x.starters.map(esc).join(' · ')}</div>` : ''}</li>`).join('')}</ol>`);
      paras.push(P('Heading1', 'Как построить ответ'));
      s.steps.forEach((x, i) => { paras.push(P('Normal', [{ t: `${i + 1}. ${x.ru || ''}`, b: true }, x.hint && { t: ' — ' + x.hint }])); if ((x.starters || []).length) paras.push(P('Example', { t: x.starters.join(' · '), lang: 'nb-NO', i: true })); });
    }
    if (inc.words !== false && (s.words || []).length) {
      html.push(`<h2>Слова</h2><div class="px-words">${s.words.map(w => `<span class="px-wn" lang="nb">${esc(w.no)}</span><span>${esc(trText(w.ru, w.uk, lang))}</span>`).join('')}</div>`);
      paras.push(P('Heading1', 'Слова'));
      s.words.forEach(w => paras.push(P('Forms', [{ t: w.no, b: true, lang: 'nb-NO' }, { t: ' — ' + trText(w.ru, w.uk, lang) }])));
    }
    if (inc.questions !== false && (s.questions || []).length) {
      html.push(`<h2>Вопросы</h2><ol class="px-list">${s.questions.map(q => `<li><span lang="nb">${esc(q.no)}</span>${q.ru || q.uk ? ` <span class="px-tr px-small">— ${esc(trText(q.ru, q.uk, lang))}</span>` : ''}${inc.lines ? '<span class="px-blank"></span><span class="px-blank"></span>' : ''}</li>`).join('')}</ol>`);
      paras.push(P('Heading1', 'Вопросы'));
      s.questions.forEach((q, i) => { paras.push(P('Normal', [{ t: `${i + 1}. ${q.no}`, lang: 'nb-NO' }, (q.ru || q.uk) && { t: ' — ' + trText(q.ru, q.uk, lang), color: '1F4FA8' }])); if (inc.lines) paras.push(P('Normal', '______________________________________________________________')); });
    }
    const exs = s.ex || s.examples || [];
    if (exs.length) {
      html.push(`<h2>Примеры</h2>${exs.map(e => exHtml({ no: plain(e.no), tr: trText(e.ru, e.uk, lang) })).join('')}`);
      paras.push(P('Heading1', 'Примеры'));
      exs.forEach(e => paras.push(P('Example', [{ t: plain(e.no), i: true, lang: 'nb-NO' }, { t: ' — ' + trText(e.ru, e.uk, lang), color: '1F4FA8' }])));
    }
    const models = s.models || s.samples || s.answers;
    if (inc.models !== false && models) {
      const list = Array.isArray(models) ? models.map((m, i) => [m.level || m.lvl || `Образец ${i + 1}`, m]) : Object.entries(models);
      html.push(`<h2>Образцы ответов</h2>${list.map(([k, m]) => { const no = typeof m === 'string' ? m : m.no || m.text || ''; const tr = typeof m === 'string' ? '' : trText(m.ru, m.uk, lang); return `<div class="px-s"><h3>${esc(String(k).toUpperCase())}</h3><div lang="nb" class="px-serif">${md(no)}</div>${tr ? `<div class="px-tr px-small">${md(tr)}</div>` : ''}</div>`; }).join('')}`);
      paras.push(P('Heading1', 'Образцы ответов'));
      list.forEach(([k, m]) => { const no = typeof m === 'string' ? m : m.no || m.text || ''; paras.push(P('Heading2', String(k).toUpperCase()), P('Normal', { t: plain(no), lang: 'nb-NO' })); const tr = typeof m === 'string' ? '' : trText(m.ru, m.uk, lang); if (tr) paras.push(P('Translation', plain(tr))); });
    }
    // a complaint letter: the situation in Norwegian
    ['happened', 'problem', 'want'].forEach(k => { if (s[k]) { html.push(`<p lang="nb">${esc(s[k])}</p>`); paras.push(P('Normal', { t: s[k], lang: 'nb-NO' })); } });
    if (inc.lines) { html.push(`<h2>Мой ответ</h2>${'<span class="px-blank"></span>'.repeat(14)}`); paras.push(P('Heading1', 'Мой ответ')); for (let i = 0; i < 10; i++) paras.push(P('Normal', '______________________________________________________________')); }
    return { title: title.replace(/^\p{Extended_Pictographic}\s*/u, '') || 'Подготовка к экзамену', html: html.join('\n'), paras, total: 1, shown: 1 };
  }

  /* ---------------- «Мой прогресс» + statistics ---------------- */
  function gatherProgress() {
    const S = store(), safe = (f, d) => { try { const v = f(); return v == null ? d : v; } catch (e) { return d; } };
    const cards = S ? S.cards() : [];
    const counts = { new: 0, learning: 0, debt: 0, learned: 0 };
    cards.forEach(c => { counts[Card.status(c)] = (counts[Card.status(c)] || 0) + 1; });
    const log = safe(() => S.state.log, []);
    const day0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
    const days = [];
    for (let i = 29; i >= 0; i--) days.push({ t: day0 - i * 864e5, n: 0 });
    let week = 0, month = 0;
    for (let i = log.length - 1; i >= 0; i--) {
      const l = log[i]; if (!l || l.ts < day0 - 29 * 864e5) break;
      const k = Math.floor((l.ts - (day0 - 29 * 864e5)) / 864e5); if (days[k]) days[k].n++;
      month++; if (l.ts >= day0 - 6 * 864e5) week++;
    }
    const decks = S ? S.decks().map(d => { const s = safe(() => S.deckStats(d.id), null); return s && s.total ? { name: d.name, s } : null; }).filter(Boolean) : [];
    const path = safe(() => (window.MyPath && MyPath.collect ? MyPath.collect() : []), []);
    return {
      total: cards.length, counts, week, month, days, decks, path,
      knowledge: safe(() => (window.Progress && Progress.knowledgeNow ? Progress.knowledgeNow() : null), null),
      streak: safe(() => (window.XP && XP.streak ? XP.streak() : S.streakDays()), 0),
      xp: safe(() => (window.XP ? { total: XP.total(), week: XP.week() } : null), null),
      level: safe(() => (window.Levels && Levels.currentLevel ? Levels.currentLevel() : ''), ''),
      minutes: safe(() => (window.Resume && Resume.minutes ? Resume.minutes(7) : null), null),
      name: safe(() => S.settings.userName, ''),
    };
  }
  function progressParts(st) {
    const g = gatherProgress(), inc = st.inc || {};
    const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
    const kpi = [
      [g.total, pl(g.total, ['карточка', 'карточки', 'карточек']) + ' всего'],
      [g.counts.learned, 'выучено · ' + pct(g.counts.learned, g.total) + ' %'],
      [g.streak, pl(g.streak, ['день', 'дня', 'дней']) + ' подряд'],
      [g.week, pl(g.week, ['ответ', 'ответа', 'ответов']) + ' за 7 дней'],
    ];
    if (g.knowledge != null) kpi.push([g.knowledge + ' %', 'знание сейчас (насколько прочно помнится)']);
    if (g.level) kpi.push([g.level, 'текущий уровень']);
    if (g.xp) kpi.push([g.xp.total, `XP · за неделю ${g.xp.week}`]);
    if (g.minutes && (g.minutes.listen || g.minutes.read)) kpi.push([Math.round((g.minutes.listen || 0) + (g.minutes.read || 0)), 'минут слушали и читали за неделю']);
    const max = Math.max(1, ...g.days.map(d => d.n));
    const W = 180, H = 34, bw = W / g.days.length;
    const chart = `<svg class="px-chart" viewBox="0 0 ${W} ${H + 6}" width="100%" height="34mm" preserveAspectRatio="none" role="img" aria-label="Ответы за 30 дней">${g.days.map((d, i) => { const h = d.n ? Math.max(1, d.n / max * H) : 0; return `<rect x="${(i * bw + bw * 0.15).toFixed(2)}" y="${(H - h).toFixed(2)}" width="${(bw * 0.7).toFixed(2)}" height="${h.toFixed(2)}" rx="0.6" fill="${new Date(d.t).getDay() % 6 ? '#5b55d6' : '#8f8be6'}"/>`; }).join('')}<line x1="0" y1="${H}" x2="${W}" y2="${H}" stroke="#c8cbd9" stroke-width=".4"/><text x="0" y="${H + 5}" font-size="3.6" fill="#7a7f9c">${new Date(g.days[0].t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</text><text x="${W}" y="${H + 5}" font-size="3.6" fill="#7a7f9c" text-anchor="end">сегодня · больше всего ${max}</text></svg>`;
    const decks = inc.decks !== false && g.decks.length ? `<h2>Колоды</h2><table class="px-t"><colgroup><col><col style="width:13%"><col style="width:13%"><col style="width:13%"><col style="width:13%"><col style="width:18%"></colgroup><thead><tr><th>Колода</th><th>Всего</th><th>Выучено</th><th>Изучаю</th><th>Долг</th><th>Готово</th></tr></thead><tbody>${g.decks.map(d => `<tr><td>${esc(d.name)}</td><td>${d.s.total}</td><td>${d.s.learned}</td><td>${d.s.learning}</td><td>${d.s.debt}</td><td>${d.s.learnedPct} %<div class="px-bar"><i style="width:${d.s.learnedPct}%"></i></div></td></tr>`).join('')}</tbody></table>` : '';
    const path = inc.path !== false && g.path.length ? `<h2>Начатое: видео, книги, курсы</h2><table class="px-t"><colgroup><col><col style="width:38%"><col style="width:16%"></colgroup><thead><tr><th>Что</th><th>Где остановились</th><th>Пройдено</th></tr></thead><tbody>${g.path.slice(0, 80).map(x => { const p = x.pct > 1 ? x.pct : Math.round((x.pct || 0) * 100); return `<tr><td>${esc(x.title || '')}</td><td class="px-small">${esc(x.line || '')}</td><td>${x.done ? 'закончено' : p + ' %'}<div class="px-bar"><i style="width:${Math.min(100, p)}%"></i></div></td></tr>`; }).join('')}</tbody></table>` : '';
    const html = `<div class="px-kpis">${kpi.map(([v, t]) => `<div class="px-kpi"><b>${esc(v)}</b><span>${esc(t)}</span></div>`).join('')}</div>
<div class="px-kpis">${[['new', 'новые'], ['learning', 'изучаю'], ['debt', 'долг'], ['learned', 'выучено']].map(([k, t]) => `<div class="px-kpi"><b>${g.counts[k] || 0}</b><span>${t}</span><div class="px-bar"><i style="width:${pct(g.counts[k] || 0, g.total)}%;background:${{ new: '#a78bfa', learning: '#38bdf8', debt: '#f43f5e', learned: '#22a35a' }[k]}"></i></div></div>`).join('')}</div>
${inc.chart !== false ? `<h2>Ответы за 30 дней · всего ${g.month}</h2>${chart}` : ''}${decks}${path}`;
    const paras = [P('Title', 'Мой прогресс'), P('Subtitle', [g.name, today()].filter(Boolean).join(' · '))];
    kpi.forEach(([v, t]) => paras.push(P('Normal', [{ t: String(v), b: true }, { t: ' — ' + t }])));
    paras.push(P('Normal', `Новые ${g.counts.new} · изучаю ${g.counts.learning} · долг ${g.counts.debt} · выучено ${g.counts.learned}`));
    if (inc.decks !== false && g.decks.length) { paras.push(P('Heading1', 'Колоды')); g.decks.forEach(d => paras.push(P('Normal', [{ t: d.name, b: true }, { t: ` — всего ${d.s.total}, выучено ${d.s.learned} (${d.s.learnedPct} %), изучаю ${d.s.learning}, долг ${d.s.debt}` }]))); }
    if (inc.path !== false && g.path.length) { paras.push(P('Heading1', 'Начатое')); g.path.slice(0, 80).forEach(x => paras.push(P('Normal', [{ t: x.title || '', b: true }, x.line && { t: ' — ' + x.line }]))); }
    return { title: 'Мой прогресс', html, paras, total: 1, shown: 1, sub: [g.name, nCards(g.total)].filter(Boolean).join(' · ') };
  }

  /** phrases / dialogue / exam / progress → a printable flowing document */
  function simpleDoc(st, parts) {
    const fs = { s: 0.88, m: 1, l: 1.14, xl: 1.3 }[st.size || 'm'] || 1;
    const title = parts.title || st.title || 'Norsk Kort';
    return { title, total: parts.total, count: parts.total, shown: parts.shown, fs, flow: true, landscape: !!st.landscape, personal: !!st.personal,
      pageCss: flowPage({ title, landscape: st.landscape, personal: st.personal }),
      html: `<div class="px-flow">${headHtml(title, parts.sub || '', '', st.personal ? PERSONAL_PRINT : '')}${parts.html}</div>` };
  }

  /* ---------------- libraries, saving ---------------- */
  async function lib(name) {
    try {
      if (name === 'xlsx') { if (window.XLSX && XLSX.utils) return XLSX; if (window.U && U.lib) return await U.lib.xlsx(); }
      if (name === 'jszip') { if (window.JSZip) return JSZip; if (window.U && U.lib) return await U.lib.jszip(); }
    } catch (e) { console.warn('printx lib', e); }
    const err = new Error(navigator.onLine === false ? 'Нужен интернет, чтобы сделать такой файл в первый раз — подключитесь и попробуйте снова' : 'Не получилось подготовить файл — проверьте интернет и попробуйте ещё раз');
    err.friendly = true; throw err;
  }
  /** a phone: the share sheet (save to Files, send to a messenger…); a computer: an ordinary download */
  async function saveFile(name, blob) {
    let file = null;
    try { file = new File([blob], name, { type: blob.type || 'application/octet-stream' }); } catch (e) { file = null; }
    const canShare = file && isPhone() && touch() && navigator.share && navigator.canShare && (() => { try { return navigator.canShare({ files: [file] }); } catch (e) { return false; } })();
    if (canShare) {
      try { await navigator.share({ files: [file], title: name }); return 'shared'; } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
        // the tap was too long ago (the file took a while): one more tap opens the share sheet
        if (window.UI && UI.modal) return new Promise(res => {
          const m = UI.modal({ title: '📄 Файл готов', cls: 'narrow px-ready', body: `<p>«${esc(name)}» готов.</p>`,
            foot: '<button class="btn ghost" data-a="dl">Скачать</button><button class="btn primary" data-a="share">📤 Сохранить или отправить</button>' });
          m.el.addEventListener('click', async ev => {
            const a = ev.target.closest('[data-a]'); if (!a) return;
            if (a.dataset.a === 'share') { try { await navigator.share({ files: [file], title: name }); } catch (x) { if (!x || x.name !== 'AbortError') download(name, blob); } }
            else download(name, blob);
            m.close(); res('shared');
          });
        });
      }
    }
    download(name, blob);
    return 'downloaded';
  }
  function download(name, blob) {
    if (window.U && U.download) return U.download(name, blob);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  /* ---------------- printing in this document ---------------- */
  let mounted = null;
  function unmount() {
    if (!mounted) return;
    mounted.root.remove(); mounted.style.remove(); mounted = null;
  }
  /** put the printout into this document (hidden on screen); → the root element */
  function mount(doc) {
    unmount();
    const style = document.createElement('style'); style.id = 'px-print-style';
    style.textContent = FONT_CSS + DOC_CSS + MOUNT_CSS + (doc.pageCss || '');
    const root = document.createElement('div'); root.id = 'px-print';
    root.className = 'px-doc' + (doc.landscape ? ' px-landscape' : '');
    root.style.setProperty('--fs', doc.fs || 1);
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = doc.html;
    document.head.appendChild(style); document.body.appendChild(root);
    mounted = { root, style };
    return root;
  }
  /** fonts and pictures are there before the printer looks (at most a few seconds) */
  async function ready(root, ms = 6000) {
    const wait = p => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
    try { if (document.fonts && document.fonts.load) await wait(Promise.all([`400 12px 'PX Nunito'`, `800 12px 'PX Nunito'`, `400 12px 'PX Lora'`, `italic 400 12px 'PX Lora'`].map(f => document.fonts.load(f, 'Aæøå Жжї')))); } catch (e) { /* the system font then */ }
    const imgs = [...root.querySelectorAll('img')];
    await wait(Promise.all(imgs.map(im => (im.complete ? null : new Promise(r => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); })))));
  }
  async function printDoc(doc) {
    const root = mount(doc);
    await ready(root);
    const done = () => { window.removeEventListener('afterprint', done); setTimeout(unmount, 1500); };
    window.addEventListener('afterprint', done);
    try { window.print(); } catch (e) { toast('Браузер не открыл окно печати — попробуйте ещё раз или через меню браузера «Печать»', 'warn', 6000); }
  }
  /** the whole printout as a standalone HTML page (preview iframe; also handy for tests) */
  function standalone(doc, preview) {
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(doc.title || 'Norsk Kort')}</title><style>${FONT_CSS}${DOC_CSS}${preview ? PREVIEW_CSS : 'html,body{margin:0;padding:0;background:#fff}'}${doc.pageCss || ''}</style></head><body><div class="px-doc ${preview ? 'px-preview' : ''} ${doc.landscape ? 'px-landscape' : ''}" style="--fs:${doc.fs || 1}">${doc.html}${preview && doc.more ? `<div class="px-more">… и ещё ${doc.more} ${pl(doc.more, ['лист', 'листа', 'листов'])} — они будут в печати</div>` : preview && doc.shown < doc.total ? `<div class="px-more">… в просмотре — первые ${doc.shown} из ${doc.total}; в печати будет всё</div>` : ''}</div></body></html>`;
  }

  /* ---------------- the window ---------------- */
  let cssLoaded = false;
  function loadCss() {
    if (cssLoaded || document.querySelector('link[data-printx-css]')) { cssLoaded = true; return; }
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/printx.css?v=231'; l.dataset.printxCss = '1';
    document.head.appendChild(l); cssLoaded = true;
  }
  const SIZE_OPTS = [{ v: 's', t: 'Мельче' }, { v: 'm', t: 'Обычный' }, { v: 'l', t: 'Крупнее' }, { v: 'xl', t: 'Крупный' }];
  const LANG_OPTS = [{ v: 'ru', t: 'Русский' }, { v: 'uk', t: 'Українська' }, { v: 'both', t: 'Оба' }];
  const ORIENT = { key: 'landscape', label: 'Лист A4', type: 'seg', options: [{ v: false, t: '▯ Книжный' }, { v: true, t: '▭ Альбомный' }] };
  const SIZE = { key: 'size', label: 'Размер шрифта', type: 'seg', options: SIZE_OPTS };

  /**
   * spec = { title, icon, state, controls: [{ key, label, type: 'seg'|'checks'|'select'|'range', options, when?, tab?, hint? }],
   *          doc(state, { limit }) → printable doc, files?: [{ id, ico, name, desc, run(state) }], summary?(state) → html }
   */
  function openDialog(spec) {
    if (!window.UI || !UI.modal) return null;
    loadCss();
    const st = spec.state;
    let tab = 'print', pane = 'set', timer = 0, frameReady = false, lastDoc = null;
    const hasFiles = (spec.files || []).length > 0;
    const m = UI.modal({
      title: `${spec.icon || '🖨'} ${esc(spec.title)}`, cls: 'wide px-dlg',
      body: `${hasFiles ? `<div class="px-tabs" role="tablist"><button type="button" role="tab" data-tab="print" aria-selected="true">🖨 Печать и PDF</button><button type="button" role="tab" data-tab="files" aria-selected="false">📄 Файл</button></div>` : ''}
<div class="px-panes" role="group" aria-label="Что показать"><button type="button" data-pane="set" aria-pressed="true">⚙️ Настройки</button><button type="button" data-pane="view" aria-pressed="false">👁 Как выйдет</button></div>
<div class="px-wrap"><div class="px-side" data-side></div><div class="px-view" data-view><div class="px-paper-tag" data-tag></div><iframe class="px-frame" title="Как будет выглядеть на бумаге" tabindex="-1"></iframe><div class="px-wait" data-wait><span class="spinner sm"></span> Готовлю…</div></div></div>`,
      foot: `<span class="px-foot-hint" data-fhint></span><button class="btn ghost" data-act="close">Закрыть</button><button class="btn primary px-print-btn" data-act="print">🖨 Печать или PDF</button>`,
      onClose: () => { clearTimeout(timer); ro && ro.disconnect(); },
    });
    const side = m.$('[data-side]'), frame = m.$('.px-frame'), view = m.$('[data-view]');
    const shown = c => (!c.when || c.when(st)) && (!c.tab || c.tab === 'both' || c.tab === tab);
    function controlHtml(c) {
      const hint = typeof c.hint === 'function' ? c.hint(st) : c.hint;
      const head = `<div class="px-lbl">${esc(c.label)}</div>`;
      if (c.type === 'seg' || c.type === 'cards') {
        const opts = (typeof c.options === 'function' ? c.options(st) : c.options).filter(o => !o.when || o.when(st));
        return `<div class="px-ctl" data-ctl="${c.key}">${head}<div class="px-seg ${c.type === 'cards' ? 'px-seg-cards' : ''}" role="radiogroup" aria-label="${esc(c.label)}">${opts.map(o => `<button type="button" role="radio" data-k="${c.key}" data-v="${esc(JSON.stringify(o.v))}" aria-checked="${st[c.key] === o.v}" ${o.disabled && o.disabled(st) ? 'disabled' : ''} title="${esc(o.d || o.t)}">${o.ico ? `<span class="px-ico" aria-hidden="true">${o.ico}</span>` : ''}<span class="px-t">${esc(o.t)}</span>${o.d && c.type === 'cards' ? `<small>${esc(o.d)}</small>` : ''}</button>`).join('')}</div>${hint ? `<div class="px-hintline">${hint}</div>` : ''}</div>`;
      }
      if (c.type === 'checks') {
        const opts = (typeof c.options === 'function' ? c.options(st) : c.options).filter(o => !o.when || o.when(st));
        const box = st[c.key] || (st[c.key] = {});
        return `<div class="px-ctl" data-ctl="${c.key}">${head}<div class="px-chks">${opts.map(o => `<label class="px-chk ${o.disabled && o.disabled(st) ? 'is-off' : ''}"><input type="checkbox" data-ck="${c.key}" data-v="${o.v}" ${box[o.v] ? 'checked' : ''} ${o.disabled && o.disabled(st) ? 'disabled' : ''}><span>${o.ico ? o.ico + ' ' : ''}${esc(o.t)}</span></label>`).join('')}</div>${hint ? `<div class="px-hintline">${hint}</div>` : ''}</div>`;
      }
      if (c.type === 'select') {
        const opts = typeof c.options === 'function' ? c.options(st) : c.options;
        return `<div class="px-ctl" data-ctl="${c.key}">${head}<select class="input px-select" data-sel="${c.key}">${opts.map(o => `<option value="${esc(JSON.stringify(o.v))}" ${JSON.stringify(st[c.key]) === JSON.stringify(o.v) ? 'selected' : ''}>${esc(o.t)}</option>`).join('')}</select>${hint ? `<div class="px-hintline">${hint}</div>` : ''}</div>`;
      }
      if (c.type === 'range') {
        return `<div class="px-ctl" data-ctl="${c.key}">${head}<div class="px-range"><label>с <input class="input" type="number" inputmode="numeric" min="${c.min || 1}" max="${c.max || ''}" data-num="from" value="${st.from || ''}" placeholder="${c.min || 1}"></label><label>по <input class="input" type="number" inputmode="numeric" min="${c.min || 1}" max="${c.max || ''}" data-num="to" value="${st.to || ''}" placeholder="${c.max || ''}"></label><button type="button" class="btn ghost px-allbtn" data-act="range-all">Всё</button></div>${hint ? `<div class="px-hintline">${hint}</div>` : ''}</div>`;
      }
      if (c.type === 'html') return `<div class="px-ctl">${typeof c.html === 'function' ? c.html(st) : c.html}</div>`;
      return '';
    }
    function renderSide() {
      const y = side.scrollTop;
      const ctl = spec.controls.filter(shown).map(controlHtml).join('');
      const files = tab === 'files' ? `<div class="px-ctl"><div class="px-lbl">Сохранить как</div><div class="px-files">${spec.files.map(f => `<button type="button" class="px-file" data-file="${f.id}"><span class="px-fico" aria-hidden="true">${f.ico}</span><span class="px-ft"><b>${esc(f.name)}</b><small>${esc(f.desc)}</small></span></button>`).join('')}</div>${isPhone() && touch() ? '<div class="px-hintline">Файл откроется в меню «Поделиться»: сохраните его в «Файлы» или отправьте в мессенджер.</div>' : ''}</div>` : '';
      side.innerHTML = (spec.summary ? `<div class="px-summary">${spec.summary(st, tab)}</div>` : '') + ctl + files;
      side.scrollTop = y;
      m.el.classList.toggle('px-files-tab', tab === 'files');
      const fh = m.$('[data-fhint]');
      if (fh) fh.textContent = tab === 'files' ? '' : isPhone() ? 'Откроется окно печати — там же «Сохранить PDF» или «Поделиться»' : 'В окне печати можно выбрать «Сохранить как PDF»';
    }
    function schedule() { clearTimeout(timer); m.$('[data-wait]').hidden = false; timer = setTimeout(renderPreview, 160); }
    function renderPreview() {
      if (tab === 'files') return;
      let doc;
      try { doc = spec.doc(st, { limit: spec.previewLimit || 40 }); } catch (e) { console.warn('printx preview', e); doc = null; }
      lastDoc = doc;
      const btn = m.$('[data-act="print"]');
      const empty = !doc || !doc.html;
      btn.disabled = empty;
      const tag = m.$('[data-tag]');
      tag.textContent = empty ? '' : doc.sheets ? `${doc.landscape ? 'A4 альбомный' : 'A4 книжный'} · ${doc.sheets} ${pl(doc.sheets, ['страница', 'страницы', 'страниц'])}` : `${doc.landscape ? 'A4 альбомный' : 'A4 книжный'}${doc.total > 1 ? ' · ' + (spec.unit ? spec.unit(doc.total) : doc.total) : ''}`;
      frameReady = false;
      frame.onload = () => { frameReady = true; fit(); m.$('[data-wait]').hidden = true; };
      frame.srcdoc = empty ? `<!doctype html><html lang="ru"><body style="font:15px system-ui,sans-serif;color:#555;display:flex;align-items:center;justify-content:center;height:90vh;margin:0;text-align:center;padding:20px">${esc(spec.emptyText || 'Нечего печатать — измените выбор слева')}</body></html>` : standalone(doc, true);
    }
    function fit() {
      if (!frameReady || !lastDoc) return;
      try {
        const d = frame.contentDocument; if (!d || !d.documentElement) return;
        const pageW = (lastDoc.landscape ? 297 : 210) * 96 / 25.4;
        const z = Math.max(0.2, Math.min(1, (frame.clientWidth - 18) / pageW));
        d.documentElement.style.zoom = String(z);
      } catch (e) { /* cross-origin never happens here */ }
    }
    const ro = window.ResizeObserver ? new ResizeObserver(() => fit()) : null;
    ro && ro.observe(view);
    const setPane = p => { pane = p; m.el.dataset.pane = p; m.$$('button[data-pane]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pane === p))); if (p === 'view') setTimeout(fit, 30); };
    setPane('set');
    const change = () => { renderSide(); schedule(); };
    m.el.addEventListener('click', async e => {
      const t = e.target;
      const tb = t.closest('[data-tab]');
      if (tb) { tab = tb.dataset.tab; m.$$('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b === tb))); if (tab === 'files') setPane('set'); renderSide(); if (tab === 'print') schedule(); return; }
      const pb = t.closest('button[data-pane]'); if (pb) return setPane(pb.dataset.pane);
      const sb = t.closest('[data-k][data-v]');
      if (sb && !sb.disabled) { let v; try { v = JSON.parse(sb.dataset.v); } catch (x) { v = sb.dataset.v; } st[sb.dataset.k] = v; const c = spec.controls.find(x => x.key === sb.dataset.k); if (c && c.onChange) c.onChange(st, v); return change(); }
      const fb = t.closest('[data-file]');
      if (fb) {
        const f = spec.files.find(x => x.id === fb.dataset.file); if (!f || fb.classList.contains('is-busy')) return;
        if (spec.guard && !(await spec.guard(st))) return;
        fb.classList.add('is-busy'); const old = fb.querySelector('.px-fico').innerHTML; fb.querySelector('.px-fico').innerHTML = '<span class="spinner sm"></span>';
        try { const r = await f.run(st); if (r && r.msg) toast(r.msg, r.kind || 'good', r.ms || 3600); } catch (err) { console.warn('printx file', err); toast(err && err.friendly ? err.message : nice(err, 'Файл'), 'warn', 6000); }
        finally { fb.classList.remove('is-busy'); fb.querySelector('.px-fico').innerHTML = old; }
        return;
      }
      const a = t.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'close') m.close();
      if (a.dataset.act === 'range-all') { st.from = ''; st.to = ''; change(); }
      if (a.dataset.act === 'reshuffle') { st.seed = (st.seed * 7 + 13) % 1e9; change(); }
      if (a.dataset.act === 'print' || a.dataset.act === 'print-front' || a.dataset.act === 'print-back') {
        if (a.disabled) return;
        const part = a.dataset.act === 'print-front' ? 'front' : a.dataset.act === 'print-back' ? 'back' : 'all';
        let doc;
        try { doc = spec.doc(st, { part }); } catch (err) { console.warn('printx', err); toast(nice(err, 'Печать'), 'warn', 5000); return; }
        if (!doc || !doc.html) { toast(spec.emptyText || 'Нечего печатать — измените выбор', 'warn'); return; }
        if (spec.guard && !(await spec.guard(st))) return;
        a.disabled = true; const label = a.innerHTML; a.innerHTML = '<span class="spinner sm"></span> Готовлю страницы…';
        try { await printDoc(doc); } catch (err) { console.warn('printx print', err); toast(nice(err, 'Печать'), 'warn', 5000); }
        finally { a.disabled = false; a.innerHTML = label; }
      }
    });
    m.el.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.ck) { (st[t.dataset.ck] = st[t.dataset.ck] || {})[t.dataset.v] = t.checked; return change(); }
      if (t.dataset.sel) { try { st[t.dataset.sel] = JSON.parse(t.value); } catch (x) { st[t.dataset.sel] = t.value; } return change(); }
      if (t.dataset.num) { const v = parseInt(t.value, 10); st[t.dataset.num] = v > 0 ? v : ''; schedule(); }
    });
    renderSide(); renderPreview();
    PrintX._last = m;
    return m;
  }

  /* ---------------- the public calls ---------------- */
  const statusCount = (cards, k) => cards.filter(c => (k === 'leech' ? (c.tags || []).includes('leech') : Card.status(c) === k)).length;
  function deckSpec(st) {
    const S = store();
    const pool = () => (st.cards ? st.cards : (st.deckIds && st.deckIds.length ? st.deckIds : S.decks().map(d => d.id)).flatMap(id => S.cards(id)));
    const anyIpa = pool().some(c => Card.ipa(c)), anyImg = pool().some(c => Card.image(c));
    const anyUk = pool().some(c => c.uk);
    const filterOpts = () => {
      const all = pool();
      const o = [{ v: 'all', t: `Все · ${all.length}` }];
      if (st.cardIds && st.cardIds.length) o.push({ v: 'selected', t: `Выбранные · ${st.cardIds.length}` });
      [['new', 'Новые'], ['learning', 'Изучаю'], ['debt', 'Долговые'], ['learned', 'Выученные'], ['leech', 'Трудные']].forEach(([k, t]) => { const n = statusCount(all, k); if (n) o.push({ v: k, t: `${t} · ${n}` }); });
      return o;
    };
    const LAYOUTS = [
      { v: 'table', ico: '📋', t: 'Таблица', d: '№ · слово · перевод · формы · пример' },
      { v: 'cut', ico: '✂️', t: 'Карточки для вырезания', d: 'с двух сторон: слово и перевод' },
      { v: 'fold', ico: '📄', t: 'Проверь себя', d: 'сложите лист пополам и проверяйте' },
      { v: 'pics', ico: '🖼', t: 'С картинками', d: 'крупно, 4 на листе' },
    ];
    const controls = [
      { key: 'layout', label: 'Как напечатать', type: 'cards', options: LAYOUTS, tab: 'print' },
      { key: 'perPage', label: 'Карточек на листе', type: 'seg', tab: 'print', when: s => s.layout === 'cut', options: [{ v: 8, t: '8 — крупнее' }, { v: 10, t: '10 — экономнее' }] },
      { key: 'duplex', label: 'Принтер', type: 'seg', tab: 'print', when: s => s.layout === 'cut', options: [{ v: 'auto', t: 'Печатает с двух сторон' }, { v: 'manual', t: 'Только с одной стороны' }],
        hint: s => (s.duplex === 'manual'
          ? 'Сначала напечатайте лицевые стороны. Положите пачку обратно в лоток чистой стороной для печати, перевернув по длинной стороне, и напечатайте обороты.'
            + '<div class="px-steps"><button type="button" class="btn px-step" data-act="print-front">1️⃣ Лицевые стороны</button><button type="button" class="btn px-step" data-act="print-back">2️⃣ Обороты</button></div>'
          : 'В окне печати включите «Двусторонняя печать» и <b>переворот по длинной стороне</b>.') },
      { key: 'backOrder', label: 'Обороты', type: 'seg', tab: 'print', when: s => s.layout === 'cut' && s.duplex === 'manual', options: [{ v: 'same', t: 'По порядку' }, { v: 'reverse', t: 'С последнего листа' }],
        hint: 'Если оборот первого листа попал на последний — выберите «С последнего листа».' },
      { key: 'foldSide', label: 'Слева на листе', type: 'seg', tab: 'print', when: s => s.layout === 'fold', options: [{ v: 'no', t: 'Норвежский' }, { v: 'tr', t: 'Перевод' }] },
      { key: 'inc', label: 'Что показать', type: 'checks', tab: 'both', options: () => [
        { v: 'tr', t: 'Перевод' },
        { v: 'forms', t: 'Формы слова', when: () => st.layout !== 'fold' && st.layout !== 'pics' || tabIsFiles() },
        { v: 'examples', t: 'Примеры', when: () => st.layout !== 'fold' && st.layout !== 'pics' || tabIsFiles() },
        { v: 'desc', t: 'Подробнее (описание)', when: () => st.layout !== 'fold' && st.layout !== 'pics' || tabIsFiles() },
        { v: 'pics', t: 'Картинки', when: () => anyImg && st.layout !== 'fold' && (st.layout !== 'pics' || tabIsFiles()) },
        { v: 'ipa', t: 'Транскрипция', when: () => anyIpa },
      ] },
      { key: 'lang', label: 'Перевод', type: 'seg', tab: 'both', when: () => anyUk || st.lang !== 'ru', options: LANG_OPTS },
      { key: 'filter', label: 'Какие карточки', type: 'select', tab: 'both', options: filterOpts },
      { key: 'sort', label: 'Порядок', type: 'select', tab: 'both', options: [{ v: 'deck', t: 'Как в колоде' }, { v: 'no', t: 'По алфавиту (норвежский)' }, { v: 'tr', t: 'По алфавиту (перевод)' }, { v: 'status', t: 'Сначала трудные' }, { v: 'random', t: 'Вперемешку' }],
        hint: s => (s.sort === 'random' ? '<button type="button" class="btn ghost sm px-mini" data-act="reshuffle">🔀 Перемешать ещё раз</button>' : '') },
      Object.assign({}, SIZE, { tab: 'print' }),
      Object.assign({}, ORIENT, { tab: 'print', when: s => s.layout !== 'cut', hint: s => (s.layout === 'table' && s.inc.forms && s.inc.examples && !s.landscape ? 'С формами и примерами удобнее альбомный лист' : '') }),
    ];
    let tabFiles = false;
    const tabIsFiles = () => tabFiles;
    const withFiles = (fn, fmt) => async s => {
      const groups0 = deckGroups(s);
      if (!countOf(groups0)) return { msg: 'Нет карточек — измените выбор', kind: 'warn' };
      const { groups, skipped } = shareGroups(groups0);
      const note = skipped ? ` · 🔒 ${S.PERSONAL_NOTE || 'личные колоды из учебника остались только у вас'}` : '';
      if (!countOf(groups)) return { msg: `🔒 ${S.PERSONAL_NOTE || 'Личные колоды из учебника не попадают в файлы'}`, kind: '', ms: 6000 };
      const r = await fn(s, groups);
      return { msg: `${fmt}: ${nCards(countOf(groups))}${note}${r === 'cancelled' ? ' — не сохранено' : ''}`, kind: r === 'cancelled' ? '' : 'good', ms: skipped ? 7000 : 3600 };
    };
    const name = (s, groups, ext) => `${fileBase(deckTitle(s, groups))}.${ext}`;
    const files = [
      { id: 'xlsx', ico: window.NavIcons ? NavIcons.statsIco() : '📊', name: 'Excel (.xlsx)', desc: 'таблица; несколько колод — по листу на каждую', run: withFiles(async (s, g) => saveFile(name(s, g, 'xlsx'), await xlsxBlob(s, g)), 'Excel') },
      { id: 'docx', ico: '📝', name: 'Word (.docx)', desc: 'заголовки и абзацы: слово — перевод, формы, пример', run: withFiles(async (s, g) => saveFile(name(s, g, 'docx'), await docxBlob(deckTitle(s, g), deckParas(s, g))), 'Word') },
      { id: 'csv', ico: '🧾', name: 'CSV', desc: 'для Excel, Google Таблиц, Numbers', run: withFiles(async (s, g) => saveFile(name(s, g, 'csv'), new Blob([csvText(s, g)], { type: 'text/csv;charset=utf-8' })), 'CSV') },
      { id: 'txt', ico: '📃', name: 'Текст (.txt)', desc: 'просто текст: слово — перевод, формы, примеры', run: withFiles(async (s, g) => saveFile(name(s, g, 'txt'), new Blob([deckTxt(s, g)], { type: 'text/plain;charset=utf-8' })), 'Текст') },
      ...(window.Exporter ? [
        { id: 'apkg', ico: '🗂', name: 'Anki (.apkg)', desc: 'колода для Anki с картинками', run: withFiles(async (s, g) => { await Exporter.run('apkg', deckTitle(s, g), g.flatMap(x => x.cards)); }, 'Anki') },
        { id: 'json', ico: '💾', name: 'Копия колоды (JSON)', desc: 'со всем прогрессом — вернуть в Norsk Kort', run: withFiles(async (s, g) => { await Exporter.run('json', deckTitle(s, g), g.flatMap(x => x.cards)); }, 'Копия') },
      ] : []),
    ];
    const spec = {
      title: 'Печать и файлы', icon: '🖨', state: st, controls, files, previewLimit: 40, unit: n => nCards(n),
      emptyText: 'Нет карточек для печати — выберите другие карточки или колоду',
      doc: (s, o) => deckDoc(s, o),
      summary: (s, tab) => {
        tabFiles = tab === 'files';
        const groups = deckGroups(s), n = countOf(groups);
        return `<b>${esc(deckTitle(s, groups))}</b> · ${n ? nCards(n) : 'нет карточек'}${tab === 'files' && hasPersonal(groups) ? `<div class="px-hintline">🔒 ${esc(S.PERSONAL_NOTE || 'Личные колоды из учебника не попадают в файлы')}</div>` : ''}`;
      },
    };
    return spec;
  }
  function deckState(o) {
    const S = store();
    let sel = o.cardIds && o.cardIds.length ? o.cardIds : null;
    try { if (!sel && window.Views && Views.sel && Views.sel.size && window.App && App.view && App.view.name === 'deck') sel = [...Views.sel]; } catch (e) { /* no selection */ }
    const lang = (S && S.settings && S.settings.transLang === 'uk') ? 'uk' : 'ru';
    return Object.assign({ layout: 'table', perPage: 8, duplex: 'auto', backOrder: 'same', foldSide: 'no', inc: { tr: true, forms: true, examples: true, desc: false, pics: false, ipa: true }, lang, filter: sel ? 'selected' : 'all', sort: 'deck', size: 'm', landscape: false, seed: (Date.now() % 1e9) || 7, cardIds: sel }, o);
  }

  /* ---------------- 🔒 protected sources: «только для себя» once per book ---------------- */
  const OK_KEY = 'nk-printx-personal-ok';
  /** a textbook from private/, a paid course, a Telegram channel that forbids forwarding, a book marked protected */
  function isProtected(t, src) {
    t = t || {}; src = src || {};
    return !!(t.protected || src.protected || src.private || src.paid || src.noforwards || src.noForwards
      || /(^|\/)private\//.test(String(src.url || src.path || t.url || '')));
  }
  const guardId = (t, src) => String(src.id || src.key || src.url || src.path || t.id || t.title || 'text').slice(0, 200);
  function okList() { try { const a = JSON.parse(localStorage.getItem(OK_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  const isConfirmed = id => okList().includes(String(id));
  function rememberOk(id) { try { const a = okList().filter(x => x !== String(id)); a.push(String(id)); localStorage.setItem(OK_KEY, JSON.stringify(a.slice(-300))); } catch (e) { /* private mode: asked again next time */ } }
  const GUARD_TEXT = {
    book: 'Эта книга защищена авторским правом. Подтвердите, что печатаете её только для личного использования и не будете раздавать копии.',
    course: 'Этот курс защищён авторским правом. Подтвердите, что печатаете его только для личного использования и не будете раздавать копии.',
    channel: 'Материалы этого канала защищены авторским правом. Подтвердите, что печатаете их только для личного использования и не будете раздавать копии.',
  };
  /** → true when the owner confirmed (now or before, for this book) */
  function confirmPersonal(id, kind) {
    if (isConfirmed(id)) return Promise.resolve(true);
    if (!window.UI || !UI.modal) return Promise.resolve(true);
    loadCss();
    const text = GUARD_TEXT[kind === 'channel' || kind === 'telegram' ? 'channel' : kind === 'course' ? 'course' : 'book'];
    return new Promise(res => {
      let done = false;
      const m = UI.modal({ title: '🔒 Только для себя', cls: 'narrow px-guard',
        body: `<p>${esc(text)}</p>`,
        foot: '<button type="button" class="btn ghost" data-g="no">Отмена</button><button type="button" class="btn primary" data-g="yes">☑ Подтверждаю, для себя</button>',
        onClose: () => { if (!done) { done = true; res(false); } } });
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-g]'); if (!b) return;
        const yes = b.dataset.g === 'yes';
        if (yes) rememberOk(id);
        done = true; res(yes); m.close();
      });
    });
  }

  const PrintX = {
    /** a deck, several decks ([ids]) or all (null) */
    deck(deckId, o = {}) {
      const S = store(); if (!S) return null;
      const ids = deckId == null ? null : Array.isArray(deckId) ? deckId : [deckId];
      const st = deckState(Object.assign({}, o, { deckIds: ids }));
      if (o.filter) st.filter = o.filter;
      if (!countOf(deckGroups(Object.assign({}, st, { filter: st.filter === 'selected' ? 'selected' : 'all' })))) { toast('В колоде пока нет карточек — печатать нечего', 'warn'); return null; }
      return openDialog(deckSpec(st));
    },
    /** any list of cards */
    cards(cards, o = {}) {
      if (!cards || !cards.length) { toast('Нет карточек для печати', 'warn'); return null; }
      return openDialog(deckSpec(deckState(Object.assign({}, o, { cards, title: o.title || 'Карточки' }))));
    },
    /** a text or a book: { title, blocks: [{ no, ru?, uk?, page?, words? }], mode?, author?, source?, personal?|protected? } */
    text(t = {}) {
      const blocks = (t.blocks || []).filter(b => b && (typeof b === 'string' ? b.trim() : b.no));
      if (!blocks.length) { toast('Нет текста для печати', 'warn'); return null; }
      const S = store();
      // source: a name, or { id, name|title, kind, protected|private|paid|noforwards }
      const src = t.source && typeof t.source === 'object' ? t.source : { name: t.source || '' };
      const prot = isProtected(t, src);
      const bookId = guardId(t, src);
      const hasTr = blocks.some(b => b.ru || b.uk), hasUk = blocks.some(b => b.uk);
      const byPage = blocks.some(b => b.page != null);
      const nums = byPage ? blocks.map(b => +b.page).filter(n => n > 0) : [1, blocks.length];
      const MODE_ALIAS = { only: 'no', norsk: 'no', word: 'words', sentence: 'sentences', parallell: 'parallel', columns: 'parallel' };
      const mode0 = MODE_ALIAS[t.mode] || t.mode;
      const st = { title: t.title || 'Текст', author: t.author || '', source: String(src.name || src.title || '').slice(0, 120), blocks,
        mode: ['no', 'words', 'sentences', 'parallel'].includes(mode0) && (hasTr || mode0 === 'no' || mode0 === 'words') ? mode0 : hasTr ? 'parallel' : 'no',
        lang: (S && S.settings && S.settings.transLang === 'uk' && hasUk) ? 'uk' : 'ru',
        size: 'm', landscape: false, from: t.from || '', to: t.to || '', personal: prot || !!t.personal };
      const MODES = [
        { v: 'no', ico: '🇳🇴', t: 'Только норвежский', d: 'чистый текст для чтения' },
        { v: 'words', ico: '🔤', t: 'По словам', d: 'перевод мелко после слов' },
        { v: 'sentences', ico: '💬', t: 'По предложениям', d: 'фраза — и сразу перевод', when: () => hasTr },
        { v: 'parallel', ico: '📖', t: 'Параллельно', d: 'две колонки рядом', when: () => hasTr },
      ];
      const spec = {
        title: 'Печать текста', icon: '🖨', state: st, previewLimit: 30, unit: n => `${n} ${pl(n, ['абзац', 'абзаца', 'абзацев'])}`,
        emptyText: 'В этом диапазоне нет текста — измените страницы',
        controls: [
          { key: 'mode', label: 'Как напечатать', type: 'cards', options: MODES, tab: 'both' },
          { key: 'lang', label: 'Перевод', type: 'seg', options: LANG_OPTS, tab: 'both', when: s => hasUk && s.mode !== 'no' },
          { key: 'range', label: byPage ? 'Страницы книги' : 'Абзацы', type: 'range', tab: 'both', min: Math.min(...nums), max: Math.max(...nums), when: () => blocks.length > 3, hint: byPage ? `в книге — с ${Math.min(...nums)} по ${Math.max(...nums)}` : `всего ${blocks.length}` },
          Object.assign({}, SIZE, { tab: 'print' }), Object.assign({}, ORIENT, { tab: 'print' }),
        ],
        summary: s => `<b>${esc(s.title)}</b>${s.author ? ' · ' + esc(s.author) : ''}${s.personal ? `<div class="px-note-ui">🔒 ${PERSONAL_PRINT} — так и будет написано на каждой странице.</div>` : ''}`,
        doc: (s, o) => textDoc(s, o),
        guard: prot ? () => confirmPersonal(bookId, src.kind) : null,
        files: [
          { id: 'docx', ico: '📝', name: 'Word (.docx)', desc: 'в выбранном виде, без таблиц', run: async s => { if (!textBlocks(s).length) return { msg: 'В этом диапазоне нет текста', kind: 'warn' }; await saveFile(`${fileBase(s.title)}.docx`, await docxBlob(s.title, textParas(s))); return { msg: 'Готово: Word' }; } },
          { id: 'txt', ico: '📃', name: 'Текст (.txt)', desc: 'просто текст', run: async s => { if (!textBlocks(s).length) return { msg: 'В этом диапазоне нет текста', kind: 'warn' }; await saveFile(`${fileBase(s.title)}.txt`, new Blob([parasText(textParas(s))], { type: 'text/plain;charset=utf-8' })); return { msg: 'Готово: текст' }; } },
        ],
      };
      return openDialog(spec);
    },
    /** phrases of the day */
    phrases(list, o = {}) {
      list = (Array.isArray(list) ? list : [list]).filter(p => p && p.no);
      if (!list.length) { toast('Нет фраз для печати', 'warn'); return null; }
      const S = store();
      const st = { title: o.title || (list.length === 1 ? 'Фраза дня' : 'Фразы дня'), list, lang: (S && S.settings && S.settings.transLang === 'uk') ? 'uk' : 'ru', inc: { words: true, grammar: true, pattern: true, dialog: true }, size: 'm', landscape: false };
      return openDialog(simpleSpec(st, {
        title: 'Печать фраз', unit: n => `${n} ${pl(n, ['фраза', 'фразы', 'фраз'])}`,
        controls: [
          { key: 'inc', label: 'Что показать', type: 'checks', tab: 'both', options: [{ v: 'words', t: 'Разбор по словам' }, { v: 'grammar', t: 'Объяснение' }, { v: 'pattern', t: 'Образец для своей фразы' }, { v: 'dialog', t: 'Диалог' }] },
        ],
        parts: (s, l) => phrasesParts(s, l),
      }));
    },
    /** a dialogue */
    dialogue(d, o = {}) {
      if (!d || !(d.lines || []).length) { toast('Нет диалога для печати', 'warn'); return null; }
      const S = store();
      const st = { d, lang: (S && S.settings && S.settings.transLang === 'uk') ? 'uk' : 'ru', trMode: 'under', hide: '', size: 'm', landscape: false, personal: !!(o.personal || d.personal || d.private) };
      return openDialog(simpleSpec(st, {
        title: 'Печать диалога', unit: n => `${n} ${pl(n, ['реплика', 'реплики', 'реплик'])}`,
        controls: [
          { key: 'trMode', label: 'Перевод', type: 'seg', tab: 'both', options: [{ v: 'under', t: 'Под репликой' }, { v: 'side', t: 'Рядом' }, { v: 'none', t: 'Без перевода' }] },
          { key: 'hide', label: 'Для тренировки', type: 'seg', tab: 'both', options: [{ v: '', t: 'Все реплики' }].concat((d.speakers || []).map(s => ({ v: s.id, t: `Скрыть «${s.name}»` }))), hint: s => (s.hide ? 'Вместо реплик — линии: впишите их сами' : '') },
        ],
        parts: (s, l) => dialogueParts(s, l),
      }));
    },
    /** an exam-prep section */
    examprep(section, o = {}) {
      if (!section) { toast('Нечего печатать', 'warn'); return null; }
      const S = store();
      const st = { section, lang: (S && S.settings && S.settings.transLang === 'uk') ? 'uk' : 'ru', inc: { words: true, questions: true, models: true, lines: false }, size: 'm', landscape: false };
      return openDialog(simpleSpec(st, {
        title: 'Печать: подготовка к экзамену',
        controls: [{ key: 'inc', label: 'Что показать', type: 'checks', tab: 'both', options: [
          { v: 'words', t: 'Слова', when: () => (section.words || []).length }, { v: 'questions', t: 'Вопросы', when: () => (section.questions || []).length },
          { v: 'models', t: 'Образцы ответов', when: () => !!(section.models || section.samples || section.answers) }, { v: 'lines', t: 'Линии для своего ответа' }] }],
        parts: (s, l) => examParts(s, l),
      }));
    },
    /** «Мой прогресс» + statistics */
    progress() {
      const st = { inc: { chart: true, decks: true, path: true }, size: 'm', landscape: false };
      return openDialog(simpleSpec(st, {
        title: 'Печать: мой прогресс', icon: '📈',
        controls: [{ key: 'inc', label: 'Что показать', type: 'checks', tab: 'both', options: [{ v: 'chart', t: 'Ответы за 30 дней' }, { v: 'decks', t: 'Колоды' }, { v: 'path', t: 'Начатое: видео, книги, курсы' }] }],
        parts: s => progressParts(s), langless: true,
      }));
    },
    /* — the same without the window — */
    build: { deck: deckDoc, text: textDoc, standalone, deckGroups, phrases: (st, o) => simpleDoc(st, phrasesParts(st, o)), dialogue: (st, o) => simpleDoc(st, dialogueParts(st, o)), examprep: (st, o) => simpleDoc(st, examParts(st, o)), progress: st => simpleDoc(st, progressParts(st)) },
    files: {
      xlsx: (st, groups) => xlsxBlob(st, groups || deckGroups(st)),
      docx: (st, groups) => { groups = groups || deckGroups(st); return docxBlob(deckTitle(st, groups), deckParas(st, groups)); },
      csv: (st, groups) => csvText(st, groups || deckGroups(st)),
      txt: (st, groups) => deckTxt(st, groups || deckGroups(st)),
      textDocx: st => docxBlob(st.title || 'Текст', textParas(st)), textTxt: st => parasText(textParas(st)),
      docxFromParas: docxBlob, P,
    },
    mount, unmount, ready, print: printDoc, deckState,
    /** 🔒 ask once per book: → Promise<true|false>; isProtected({ protected? }, source) */
    confirmPersonal, isProtected,
    CSS: { FONT_CSS, DOC_CSS, MOUNT_CSS },
  };
  /** phrases / dialogue / exam / progress: print + Word + text */
  function simpleSpec(st, o) {
    const hasUk = JSON.stringify(st).includes('"uk"');
    const doc = (s, l) => simpleDoc(s, Object.assign({ title: s.title }, o.parts(s, l)));
    return {
      title: o.title, icon: o.icon || '🖨', state: st, previewLimit: 30, unit: o.unit,
      controls: [].concat(o.controls || [], o.langless || !hasUk ? [] : [{ key: 'lang', label: 'Перевод', type: 'seg', tab: 'both', options: LANG_OPTS }], [Object.assign({}, SIZE, { tab: 'print' }), Object.assign({}, ORIENT, { tab: 'print' })]),
      summary: s => (s.personal ? `<div class="px-note-ui">🔒 ${PERSONAL_PRINT}</div>` : ''),
      doc,
      files: [
        { id: 'docx', ico: '📝', name: 'Word (.docx)', desc: 'заголовки и абзацы', run: async s => { const p = o.parts(s, {}); await saveFile(`${fileBase(p.title || s.title || o.title)}.docx`, await docxBlob(p.title || s.title || o.title, p.paras)); return { msg: 'Готово: Word' }; } },
        { id: 'txt', ico: '📃', name: 'Текст (.txt)', desc: 'просто текст', run: async s => { const p = o.parts(s, {}); await saveFile(`${fileBase(p.title || s.title || o.title)}.txt`, new Blob([parasText(p.paras)], { type: 'text/plain;charset=utf-8' })); return { msg: 'Готово: текст' }; } },
      ],
    };
  }

  window.PrintX = PrintX;
})();
