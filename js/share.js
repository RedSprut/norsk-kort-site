/* ============ 📤 Share decks with another person — one deck, several or all, with everything inside ============
 * The file «….norskkort» contains the decks with covers, card pictures, forms, examples, synonyms, descriptions
 * and the source history. Your study progress is NOT included unless you want it; API keys never are.
 * On iPhone / Mac / Android the system share sheet opens (AirDrop, Telegram, WhatsApp, mail…);
 * otherwise the file is downloaded. The receiver opens it in the app -> sees the decks -> «Добавить».
 * (With cloud sync it will also be possible to share by a link / QR code.)
 */
(function () {
  const FORMAT = 'norsk-kort-share';
  const MAGIC = 'NKSHARE1';

  async function gzip(text) {
    if (!window.CompressionStream) return new Blob([MAGIC + '\n' + text], { type: 'application/json' });
    const s = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Blob([MAGIC + 'GZ\n', await new Response(s).blob()], { type: 'application/octet-stream' });
  }
  async function unpack(file) {
    const head = await file.slice(0, 11).text();
    if (head.startsWith(MAGIC + 'GZ')) {
      const body = file.slice((MAGIC + 'GZ\n').length);
      return JSON.parse(await new Response(body.stream().pipeThrough(new DecompressionStream('gzip'))).text());
    }
    const t = await file.text();
    return JSON.parse(t.startsWith(MAGIC) ? t.slice(t.indexOf('\n') + 1) : t);
  }
  const size = b => b > 1e6 ? (b / 1e6).toFixed(1) + ' МБ' : Math.max(1, Math.round(b / 1e3)) + ' КБ';
  const fileName = decks => (decks.length === 1 ? decks[0].name : `Norsk Kort — ${decks.length} колод`).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) + '.norskkort';

  const Share = {
    async isShareFile(file) {
      if (/\.norskkort$/i.test(file.name)) return true;
      try { return (await file.slice(0, 8).text()) === MAGIC; } catch (e) { return false; }
    },

    /** choose decks -> options -> file -> share sheet */
    open(preselect) {
      const all = Store.decks();
      if (!all.length) { UI.toast('Пока нет колод', 'warn'); return; }
      // 🔒 personal course decks (cards from the owner's textbooks) are never packed — shown, but locked
      const mine = d => !!(Store.isPersonalDeck && Store.isPersonalDeck(d));
      const decks = all.filter(d => !mine(d)), locked = all.filter(mine);
      const pre = preselect ? [].concat(preselect) : [];
      if (!decks.length) { UI.toast(`🔒 ${Store.PERSONAL_NOTE}.`, '', 6000); return; }
      if (pre.length && pre.some(id => mine(Store.deck(id)))) UI.toast(`🔒 ${Store.PERSONAL_NOTE}.`, '', 6000);
      const sel = new Set(pre.filter(id => !mine(Store.deck(id))));
      const m = UI.modal({
        title: `${ShareApp.SHARE_SVG(22)} Поделиться колодами`, cls: 'wide',
        body: `<div class="lib-intro">${ShareApp.SHARE_SVG(20)} <span>Выберите колоды — получится один файл со всем содержимым: обложки, картинки, формы слов, примеры, синонимы, описания и источники. Отправьте его через AirDrop, Telegram, WhatsApp или почту — получатель откроет его в Norsk Kort и нажмёт «Добавить». <b>Ключи (API) никогда не передаются.</b></span></div>
          <div class="row" style="gap:6px"><button class="btn sm" data-all>☑ Выбрать все</button><button class="btn sm ghost" data-none>Снять выбор</button><span class="grow"></span><span class="small muted" data-sum></span></div>
          <div class="share-grid">${decks.map(d => `<label class="share-deck ${sel.has(d.id) ? 'on' : ''}">
            <input type="checkbox" data-d="${d.id}" ${sel.has(d.id) ? 'checked' : ''}>
            <span class="share-cover" ${d.cover ? `style="background-image:url('${U.esc(d.cover)}')"` : ''}>${d.cover ? '' : '🗂'}</span>
            <span class="grow"><b>${U.esc(d.name)}</b><small>${U.cards(Store.cards(d.id).length)}</small></span></label>`).join('')}
            ${locked.map(d => `<div class="share-deck share-locked" aria-disabled="true" title="${U.esc(Store.PERSONAL_NOTE)}">
            <span class="share-cover" ${d.cover ? `style="background-image:url('${U.esc(d.cover)}')"` : ''}>${d.cover ? '' : '🔒'}</span>
            <span class="grow"><b>${U.esc(d.name)}</b><small>🔒 только для вас</small></span></div>`).join('')}</div>
          ${locked.length ? `<div class="small muted share-locked-note">🔒 ${U.esc(Store.PERSONAL_NOTE)}.</div>` : ''}
          <div class="row" style="gap:16px;flex-wrap:wrap;margin-top:8px">
            ${UI.switchHtml('sh-img', true, '🖼 С картинками и обложками')}
            ${UI.switchHtml('sh-prog', false, '📈 С моим прогрессом (обычно не нужно — человек учит с нуля)')}</div>
          <div class="small muted" style="margin-top:6px">Карточки передаются <b>один в один</b>: значки источников и переводчиков (Google, DeepL, Ordbøkene, Telegram, нейросети…) с историей «кто что перевёл и откуда», отметки проверки нейросетью и предупреждения «машинный перевод — перепроверьте». Получатель увидит всё так же, как вы, и сможет проверить и поправить.</div>`,
        foot: `<button class="btn ghost" data-cancel>Отмена</button><button class="btn primary" data-go>${ShareApp.SHARE_SVG(18)} Поделиться</button>`,
      });
      const sum = () => {
        const ids = m.$$('[data-d]').filter(x => x.checked).map(x => x.dataset.d);
        m.$$('.share-deck').forEach(l => { const x = l.querySelector('input'); if (x) l.classList.toggle('on', x.checked); }); // 🔒 locked tiles have no checkbox
        const n = ids.reduce((a, id) => a + Store.cards(id).length, 0);
        m.$('[data-sum]').textContent = ids.length ? `${ids.length} ${U.plural(ids.length, ['колода', 'колоды', 'колод'])} · ${U.cards(n)}` : 'ничего не выбрано';
      };
      m.el.addEventListener('change', sum);
      m.$('[data-all]').onclick = () => { m.$$('[data-d]').forEach(x => { x.checked = true; }); sum(); };
      m.$('[data-none]').onclick = () => { m.$$('[data-d]').forEach(x => { x.checked = false; }); sum(); };
      m.$('[data-cancel]').onclick = () => m.close();
      sum();
      m.$('[data-go]').onclick = async () => {
        const ids = m.$$('[data-d]').filter(x => x.checked).map(x => x.dataset.d);
        if (!ids.length) { UI.toast('Выберите хотя бы одну колоду', 'warn'); return; }
        // decks made from your own textbook carry its sentences — the book's text belongs to its publisher
        const fromBook = ids.map(id => Store.deck(id)).filter(d => d && (d.textbook || Store.cards(d.id).some(c => (c.tags || []).includes('textbook'))));
        if (fromBook.length && !(await UI.confirm(`📘 ${fromBook.map(d => `«${U.esc(d.name)}»`).join(', ')} — карточки из вашего учебника: в них предложения из книги, а её текст защищён авторским правом издательства.<br><br>Себе на другое устройство — можно. Другому человеку — если у него тоже есть эта книга. Выкладывать публично (группы, каналы, сайты) — нельзя.`, { ok: 'Понятно, отправить', title: 'Колода из учебника' }))) return;
        const on = k => m.$(`[data-key="${k}"]`).checked;
        const b = m.$('[data-go]'); b.disabled = true; b.innerHTML = '<span class="spinner sm"></span> упаковываю…';
        try {
          const file = await this.pack(ids, { images: on('sh-img'), progress: on('sh-prog') });
          m.close();
          await this.send(file);
        } catch (e) { UI.toast('Не получилось: ' + e.message, 'bad', 6000); b.disabled = false; b.innerHTML = `${ShareApp.SHARE_SVG(18)} Поделиться`; }
      };
    },

    async pack(ids, o) {
      // 🔒 never a personal course deck / card, whoever asks
      const mine = d => !!(Store.isPersonalDeck && Store.isPersonalDeck(d));
      const decks = ids.map(id => Store.deck(id)).filter(d => d && !mine(d));
      if (!decks.length) throw new Error(Store.PERSONAL_NOTE || 'нет колод');
      const data = {
        app: FORMAT, version: 1, created: new Date().toISOString(), from: Store.settings.userName || '',
        decks: decks.map(d => ({ id: d.id, name: d.name, description: d.description || '', cover: o.images ? d.cover || '' : '', coverCredit: d.coverCredit || '' })),
        // cards go 1:1 — history of every source & translator (the icons on the card), AI checks, machine-translation
        // warnings (mtWarn), forms, examples, synonyms, descriptions. Only your study progress is optional.
        cards: decks.flatMap(d => Store.cards(d.id).filter(c => !(Store.isPersonalCard && Store.isPersonalCard(c))).map(c => {
          const x = JSON.parse(JSON.stringify(c));
          if (!o.images) { x.image = ''; x.imageAuto = false; }
          if (!o.progress) x.srs = {};
          return x;
        })),
      };
      const blob = await gzip(JSON.stringify(data));
      return new File([blob], fileName(decks), { type: 'application/octet-stream' });
    },
    async send(file) {
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: file.name.replace(/\.norskkort$/, ''), text: 'Колоды Norsk Kort — откройте файл в приложении Norsk Kort (📥 Импорт)' });
          return;
        }
      } catch (e) { if (e && e.name === 'AbortError') return; /* fall back to download */ }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      UI.toast(`Файл «${file.name}» (${size(file.size)}) сохранён — отправьте его, кому хотите`, 'good', 6000);
    },

    /** receiver: preview -> add (new ids, so nothing of yours is overwritten) */
    async importFile(file) {
      let data;
      try { data = await unpack(file); } catch (e) { UI.toast('Файл повреждён или это не колода Norsk Kort', 'bad', 6000); return; }
      if (!data || data.app !== FORMAT) { UI.toast('Это не колода Norsk Kort', 'bad'); return; }
      return new Promise(resolve => {
        let adding = false;
        const m = UI.modal({
          title: '📥 Вам прислали колоды', cls: 'wide', onClose: resolve,
          beforeClose: UI.guard(() => adding ? null : { title: 'Закрыть без добавления?', line: 'Присланные колоды не добавлены — файл придётся открыть снова.',
            actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }] }),
          body: `<div class="small muted">${data.from ? `От: <b>${U.esc(data.from)}</b> · ` : ''}${new Date(data.created).toLocaleDateString('ru-RU')} · ${size(file.size)}</div>
            <div class="share-grid">${data.decks.map(d => { const n = data.cards.filter(c => c.deckId === d.id).length, cv = Store.Safe.image(d.cover); return `<label class="share-deck on"><input type="checkbox" data-d="${U.esc(d.id)}" checked>
              <span class="share-cover" ${cv ? `style="background-image:url('${U.esc(cv)}')"` : ''}>${cv ? '' : '🗂'}</span>
              <span class="grow"><b>${U.esc(d.name)}</b><small>${U.cards(n)}${d.description ? ' · ' + U.esc(d.description.slice(0, 80)) : ''}</small></span></label>`; }).join('')}</div>
            <div class="small muted">Колоды добавятся рядом с вашими — ничего из ваших не заменится. Если колода с таким названием уже есть, новая получит пометку «(получено)». Карточки приходят один в один: со значками источников и переводчиков, историей правок и предупреждениями о машинном переводе — что проверить, видно сразу.</div>
            ${(() => { const n = data.cards.filter(c => c.mtWarn).length; return n ? `<div class="mt-warn">⚠️ <span>В ${U.cards(n)} перевод сделан машинным переводчиком и ещё не проверен — такие карточки отмечены предупреждением, перепроверьте их.</span></div>` : ''; })()}`,
          foot: '<button class="btn ghost" data-cancel>Отмена</button><button class="btn primary" data-go>➕ Добавить</button>',
        });
        m.$('[data-cancel]').onclick = () => m.tryClose();
        m.$('[data-go]').onclick = async () => {
          adding = true;
          const ids = new Set(m.$$('[data-d]').filter(x => x.checked).map(x => x.dataset.d));
          const names = new Set(Store.decks().map(d => d.name));
          let decksN = 0, cardsN = 0;
          const made = [];
          try {
          data.decks.filter(d => ids.has(d.id)).forEach(d => {
            const nd = Store.addDeck(names.has(d.name) ? `${d.name} (получено)` : d.name, d.description || '');
            made.push(nd.id);
            Store.updateDeck(nd.id, { cover: d.cover || '', coverCredit: d.coverCredit || '', coverTried: true });
            decksN++;
            data.cards.filter(c => c.deckId === d.id).forEach(c => {
              const copy = Object.assign({}, c);
              delete copy.id; delete copy.keepId;
              copy.history = (copy.history || []).concat([Prov.entry('import', 'create', null, `получено${data.from ? ' от ' + data.from : ''} · файл «${file.name}»`)]);
              Store.addCard(nd.id, copy); cardsN++;
            });
          });
          } catch (e) {
            // nothing half-done: remove what was added and say what happened
            made.forEach(id => { Store.state.decks = Store.state.decks.filter(x => x.id !== id); Store.state.cards = Store.state.cards.filter(c => c.deckId !== id); });
            Store.save();
            UI.toast('Не удалось добавить колоды: ' + e.message, 'bad', 7000);
            m.close();
            return;
          }
          await Store.saveNow();
          m.close();
          UI.toast(`Добавлено: ${decksN} ${U.plural(decksN, ['колода', 'колоды', 'колод'])}, ${U.cards(cardsN)} ✓`, 'good', 5000);
          App.go('home');
        };
      });
    },
  };

  window.Share = Share;
})();
