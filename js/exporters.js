/* ============ Exporters ============ */
(function () {
  const FORMATS = [
    { id: 'csv-app', name: 'CSV (как в приложении)', ext: 'csv', desc: 'лицевая,обратная — тот же формат, что вы импортируете' },
    { id: 'json', name: 'JSON', ext: 'json', desc: 'полная копия с прогрессом и картинками' },
    { id: 'apkg', name: 'Anki .apkg', ext: 'apkg', desc: 'колода Anki (обе стороны + картинки)' },
    { id: 'xlsx', name: 'Excel .xlsx', ext: 'xlsx', desc: 'таблица со всеми полями' },
    { id: 'csv', name: 'CSV (все поля)', ext: 'csv', desc: 'с заголовками, для Excel/Google' },
    { id: 'tsv', name: 'TSV', ext: 'tsv', desc: 'разделитель — табуляция' },
    { id: 'quizlet', name: 'Quizlet / TXT', ext: 'txt', desc: 'слово⇥перевод, по строке' },
    { id: 'anki-txt', name: 'Anki TXT', ext: 'txt', desc: 'текст для импорта в Anki' },
    { id: 'ods', name: 'OpenDocument .ods', ext: 'ods', desc: 'LibreOffice / Numbers' },
    { id: 'xls', name: 'Excel 97 .xls', ext: 'xls', desc: 'старый формат Excel' },
    { id: 'md', name: 'Markdown', ext: 'md', desc: 'таблица для заметок' },
    { id: 'html', name: 'HTML', ext: 'html', desc: 'красивая страница с картинками' },
    { id: 'pdf', name: 'PDF / печать', ext: 'pdf', desc: 'карточки для печати' },
    { id: 'xml', name: 'XML', ext: 'xml', desc: 'структурированные данные' },
    { id: 'yaml', name: 'YAML', ext: 'yaml', desc: 'читаемый текст' },
  ];
  const COLS = [['no', 'Norsk'], ['ru', 'Русский'], ['description', 'Описание'], ['example', 'Пример'], ['exampleRu', 'Перевод примера'],
    ['wordClass', 'Часть речи'], ['forms', 'Формы слова'], ['synonyms', 'Синонимы'], ['examples', 'Примеры по формам'], ['tags', 'Теги'], ['image', 'Картинка']];

  const val = (c, k) => {
    if (k === 'tags') return (c.tags || []).join(' ');
    if (k === 'forms') return Prov.listText(c.forms);
    if (k === 'examples') return Prov.listText(c.examples, true);
    if (k === 'synonyms') return (c.synonyms || []).map(s => `${s.no}${s.ru ? ' (' + s.ru + ')' : ''}${s.note ? ' — ' + s.note : ''}`).join('\n');
    if (k === 'image') return c.image && !c.image.startsWith('data:') ? c.image : '';
    return c[k] || '';
  };
  const csvCell = (s, d) => {
    s = String(s == null ? '' : s);
    return /["\n\r]/.test(s) || s.includes(d) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const toCSV = (rows, d, eol = '\r\n') => rows.map(r => r.map(c => csvCell(c, d)).join(d)).join(eol);
  const table = cards => [COLS.map(c => c[1])].concat(cards.map(c => COLS.map(([k]) => val(c, k))));
  const formsText = c => (c.forms || []).length ? '📚 Формы:\n' + Prov.listText(c.forms) : '';
  const examplesText = c => (c.examples || []).length ? '💬 Примеры:\n' + Prov.listText(c.examples, true) : '';
  const synText = c => (c.synonyms || []).length ? '🔁 Синонимы:\n' + c.synonyms.map(s => `${s.no}${s.ru ? ' (' + s.ru + ')' : ''}${s.note ? ' — ' + s.note : ''}`).join('\n') : '';
  const backSide = c => [c.ru, c.description, formsText(c), synText(c), examplesText(c)].filter(Boolean).join('\n\n');
  const fullDescription = c => [c.description, formsText(c), examplesText(c)].filter(Boolean).join('\n\n');
  const xmlEsc = s => U.esc(s);
  const mdCell = s => String(s || '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');

  function mdInline(s) {
    return U.esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\W)_(.+?)_(?=\W|$)/g, '$1<i>$2</i>').replace(/\n/g, '<br>');
  }
  function htmlPage(title, cards, print) {
    const items = cards.map(c => `
      <div class="c">
        ${c.image ? `<img src="${U.esc(c.image)}" alt="">` : ''}
        <div class="no">${mdInline(c.no)}</div>
        <div class="ru">${mdInline(c.ru)}</div>
        ${c.description ? `<div class="d">${mdInline(c.description)}</div>` : ''}
        ${c.example ? `<div class="e">${mdInline(c.example)}${c.exampleRu ? `<br><span>${mdInline(c.exampleRu)}</span>` : ''}</div>` : ''}
      </div>`).join('');
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${U.esc(title)}</title>
<style>body{font-family:Arial,sans-serif;margin:24px;color:#1b1b2f;background:#f6f7fb}h1{font-size:22px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.c{background:#fff;border:1px solid #dde;border-radius:14px;padding:14px;break-inside:avoid;page-break-inside:avoid}
.c img{width:100%;max-height:150px;object-fit:cover;border-radius:10px}.no{font-size:20px;font-weight:bold;margin-top:6px;white-space:pre-wrap}
.ru{font-size:16px;color:#2b4bd8;margin-top:4px;white-space:pre-wrap}.d{font-size:12.5px;color:#555;margin-top:6px;white-space:pre-wrap}
.e{font-size:13px;font-style:italic;margin-top:6px}.e span{font-style:normal;color:#666}
@media print{body{background:#fff;margin:0}.c{border-color:#bbb}}</style></head>
<body><h1>${U.esc(title)} — ${U.cards(cards.length)}</h1><div class="g">${items}</div>
${print ? '<script>window.onload=()=>setTimeout(()=>window.print(),600)<\/script>' : ''}</body></html>`;
  }

  const Exporter = {
    FORMATS,
    async run(fmtId, title, cards, opts = {}) {
      // 🔒 cards from the owner's textbooks never go into a file meant for other apps / people
      if (window.Store && Store.shareableCards) cards = Store.shareableCards(cards).cards;
      if (!cards.length) return;
      const base = U.safeFileName(title);
      const f = FORMATS.find(x => x.id === fmtId);
      const name = `${base}.${f.ext}`;
      switch (fmtId) {
        case 'csv-app':
          return U.download(name, toCSV(cards.map(c => [c.no, backSide(c)]), ','), 'text/csv;charset=utf-8');
        case 'csv':
          return U.download(name, '﻿' + toCSV(table(cards), ','), 'text/csv;charset=utf-8');
        case 'tsv':
          return U.download(name, toCSV(table(cards), '\t'), 'text/tab-separated-values;charset=utf-8');
        case 'quizlet':
          return U.download(name, cards.map(c => `${c.no.replace(/\s*\n\s*/g, ' ')}\t${backSide(c).replace(/\s*\n\s*/g, ' / ')}`).join('\n'), 'text/plain;charset=utf-8');
        case 'anki-txt': {
          const h = s => U.esc(s || '').replace(/\r?\n/g, '<br>');
          const head = '#separator:tab\n#html:true\n#columns:Norsk\tRussisk\tBeskrivelse\tEksempel\tEksempelRu\tTags\n#tags column:6\n';
          return U.download(name, head + cards.map(c => [h(c.no), h(c.ru), h(c.description), h(c.example), h(c.exampleRu), (c.tags || []).join(' ')].join('\t')).join('\n'), 'text/plain;charset=utf-8');
        }
        case 'json': {
          const deckIds = [...new Set(cards.map(c => c.deckId))];
          const data = { app: 'norsk-kort', version: 2, exported: new Date().toISOString(), decks: deckIds.map(id => Store.deck(id)).filter(Boolean), cards };
          return U.download(name, JSON.stringify(data, null, 1), 'application/json');
        }
        case 'xlsx': case 'ods': case 'xls': {
          const XLSX = await U.lib.xlsx();
          const ws = XLSX.utils.aoa_to_sheet(table(cards).map(r => r.map(c => String(c).slice(0, 32000))));
          ws['!cols'] = [{ wch: 28 }, { wch: 32 }, { wch: 50 }, { wch: 40 }, { wch: 40 }, { wch: 12 }, { wch: 16 }, { wch: 30 }];
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Карточки'.slice(0, 31));
          return XLSX.writeFile(wb, name, { bookType: fmtId === 'xls' ? 'biff8' : fmtId, compression: true });
        }
        case 'md': {
          const rows = [['Norsk', 'Русский', 'Описание', 'Пример'], ['---', '---', '---', '---']]
            .concat(cards.map(c => [mdCell(c.no), mdCell(c.ru), mdCell(c.description), mdCell([c.example, c.exampleRu].filter(Boolean).join(' — '))]));
          return U.download(name, `# ${title}\n\n` + rows.map(r => '| ' + r.join(' | ') + ' |').join('\n') + '\n', 'text/markdown;charset=utf-8');
        }
        case 'html':
          return U.download(name, htmlPage(title, cards, false), 'text/html;charset=utf-8');
        case 'pdf': {
          const w = window.open('', '_blank');
          if (!w) { UI.toast('Разрешите всплывающие окна для печати/PDF', 'warn'); return; }
          w.document.open(); w.document.write(htmlPage(title, cards, true)); w.document.close();
          return;
        }
        case 'xml': {
          const fields = ['no', 'ru', 'en', 'description', 'example', 'exampleRu', 'wordClass', 'image'];
          const body = cards.map(c => '  <card>\n' + fields.filter(k => c[k] && !(k === 'image' && c[k].startsWith('data:')))
            .map(k => `    <${k}>${xmlEsc(c[k])}</${k}>`).join('\n') + ((c.tags || []).length ? `\n    <tags>${xmlEsc(c.tags.join(' '))}</tags>` : '') + '\n  </card>').join('\n');
          return U.download(name, `<?xml version="1.0" encoding="UTF-8"?>\n<deck name="${xmlEsc(title)}">\n${body}\n</deck>\n`, 'application/xml');
        }
        case 'yaml': {
          const q = s => JSON.stringify(String(s || ''));
          const body = cards.map(c => `- no: ${q(c.no)}\n  ru: ${q(c.ru)}` + ['description', 'example', 'exampleRu', 'wordClass'].filter(k => c[k]).map(k => `\n  ${k}: ${q(c[k])}`).join('') +
            ((c.tags || []).length ? `\n  tags: ${q(c.tags.join(' '))}` : '')).join('\n');
          return U.download(name, `# ${title}\n${body}\n`, 'text/yaml;charset=utf-8');
        }
        case 'apkg': {
          const blob = await Anki.exportPackage(title, cards, { bothDirections: true, onProgress: opts.onProgress });
          return U.download(name, blob);
        }
      }
    },
    /** a full copy for THIS device (personal course decks included, marked) — the owner keeps the file */
    backup() {
      const b = Store.exportBackup();
      U.download(`norsk-kort-backup-${U.dayKey()}.json`, JSON.stringify(b), 'application/json');
      if (b.personal && window.UI) UI.toast('🔒 В копии есть ваши личные колоды из учебника — храните файл у себя и не отправляйте его другим', '', 7000);
    },
  };

  window.Exporter = Exporter;
})();
