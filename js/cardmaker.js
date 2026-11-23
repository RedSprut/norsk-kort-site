/* ============ ➕ «Создать карточку» — one window for every learning tool ============
 * Exercises, YouTube, news, subtitles, selected text… all call CardMaker.open(spec).
 * The window lists what can become a card (the whole sentence, the word, the other words of the exercise…) with
 * checkboxes — one, several or «☑ Выбрать всё». Then:
 *   ⚡ automatically — the deck of that source, the translation (machine/AI if the source had none), the example and
 *      where it came from are filled in by themselves; the picture is made in the background (if turned on);
 *   ✍️ by hand — the card editor opens prefilled (one after another when several are ticked): own name / translation,
 *      picture, translators and neural networks.
 * A sentence translated by a person «по смыслу» (an idiom) also gets the literal machine translation as a variant:
 * the user picks «по смыслу», «дословно» or both.
 * Every card keeps its provenance: where it came from and who translated what (✓ source · ⚠️ machine · 🤖 AI · ✍️ you).
 *
 * spec = {
 *   key: 'cloze',                         // remembers the deck the user picked for this tool
 *   deck: '✍️ Предложения из упражнений', deckDesc: '…',   // default deck (created on first save)
 *   source: { by: 'import' | 'tr:tatoeba', label: '…', url, name: 'Tatoeba' },
 *   options: [{ id, kind: 'sent'|'word', group, label, no, ru, by: [translator ids], byNote, example, exampleRu, exBy,
 *               wordClass, description, tags, checked }],
 *   pick: 'sent',                         // ticked first (when no option has checked)
 *   groups: { other: 'Другие слова из упражнения…' },
 *   manual: true,                         // skip the window: open the editor at once (first option)
 *   onDone(cards),
 * }
 * option.by: [] with a ru = the translation came with the source (written by a person); ['google'] = machine…
 */
(function () {
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const esc = s => U.esc(s == null ? '' : String(s));
  const MACHINE = ['google', 'mozhi', 'mymemory', 'microsoft', 'deepl'];
  const first = s => String(s || '').split('\n')[0];

  /** who translated: ✓ source · ⚠️ machine · 🤖 AI · ✍️ you · none */
  function whoHtml(ru, by, me, srcName) {
    if (!String(ru || '').trim()) return '<span class="tg-who none">нет перевода</span>';
    if (me) return '<span class="tg-who me" title="Вы вписали или поправили сами">✍️ вы</span>';
    if (by && by.length) {
      const ai = by.includes('ai');
      const machine = by.some(b => MACHINE.includes(b));
      if (ai || machine) return `<span class="tg-who ${ai ? 'ai' : 'mt'}" title="${ai ? 'Перевела нейросеть — по смыслу, но тоже может ошибаться' : 'Машинный перевод — неточный, перепроверьте'}">${ai ? BOT() : '⚠️'} ${esc(Translators.provNames(by))}${ai ? '' : ' · неточно'}</span>`;
      return `<span class="tg-who src">✓ ${esc(Translators.provNames(by))}</span>`;
    }
    return `<span class="tg-who src" title="Перевод был в самом источнике — его написал человек">✓ ${esc(srcName || 'из источника')}</span>`;
  }
  const isMachine = by => (by || []).some(b => MACHINE.includes(b)) && !(by || []).includes('ai');

  /** missing translations (word / sentence + example); a person's translation of a sentence also gets the literal one */
  async function fill(o) {
    const jobs = [];
    if (!String(o.ru || '').trim() && o.no) {
      jobs.push((async () => {
        const w = first(o.no).trim();
        const bare = w.replace(/^(en|ei|et|å)\s+/i, '');
        const tr = !/\s/.test(bare) && window.NoGloss ? NoGloss.get(bare) : '';
        if (tr) { o.ru = tr; o.by = []; o.byNote = 'словарик'; return; }
        try {
          const r = await Translators.translateMany([w], 'no', 'ru');
          const got = String(r.out[0] || '').trim();
          o.ru = (window.Study && Study.cleanGloss && !/\s/.test(w) ? Study.cleanGloss(w, got) : '') || got;
          o.by = r.by || []; if (!o.ru) o.err = r.error || 'переводчики не ответили';
        } catch (e) { o.err = U.niceErr(e); }
      })());
    } else if (o.kind === 'sent' && String(o.ru || '').trim() && !(o.by || []).length && !o.alt && !o.me) {
      // «по смыслу» from a person (Tatoeba, a textbook…) — the literal variant next to it
      jobs.push((async () => {
        try {
          const r = await Translators.translateMany([o.no], 'no', 'ru');
          const lit = String(r.out[0] || '').trim();
          if (lit && !(Translators.agrees ? Translators.agrees(lit, o.ru) : U.norm(lit) === U.norm(o.ru))) o.alt = { ru: lit, by: r.by || [] };
        } catch (e) { /* only the source's translation */ }
      })());
    }
    if (o.example && !String(o.exampleRu || '').trim()) {
      jobs.push((async () => {
        const cached = window.Study && Study.sentTr ? Study.sentTr(o.example) : '';
        if (cached) { o.exampleRu = cached; o.exBy = o.exBy || []; return; }
        try { const r = await Translators.translateMany([o.example], 'no', 'ru'); o.exampleRu = String(r.out[0] || '').trim(); o.exBy = r.by || []; } catch (e) { /* no example translation */ }
      })());
    }
    await Promise.all(jobs);
    o.filled = true;
  }

  function findDeck(name) { return Store.decks().find(d => d.name === name); }
  function dupIn(deckId, no) {
    const k = U.norm(first(no), { stripArticles: true });
    return deckId ? Store.cards(deckId).find(x => U.norm(first(x.no), { stripArticles: true }) === k) : null;
  }
  function srcText(spec) { const s = spec.source || {}; return (s.label || 'из приложения') + (s.url ? ' · ' + s.url : ''); }
  /** the translation the option will be saved with (source / literal / both) and who made it */
  function chosen(o) {
    // o.me: the translation is yours already (corrected / confirmed with ✓ before the window opened)
    if (o.edited.ru || o.me || !o.alt || o.trPick === 'src' || !o.trPick) return { ru: o.ru, by: o.edited.ru || o.me ? [] : (o.by || []), me: !!(o.edited.ru || o.me) };
    if (o.trPick === 'lit') return { ru: o.alt.ru, by: o.alt.by };
    return { ru: `${o.srcRu}\n(дословно: ${o.alt.ru})`, by: [...(o.by || []), ...o.alt.by], both: true };
  }

  const CardMaker = {
    whoHtml,

    /** reusable button (the caller listens for its own attribute) */
    btn(label = '➕ Создать карточку', cls = 'btn sm', attrs = '') {
      return `<button type="button" class="${cls} cm-btn" ${attrs} title="Создать карточку: автоматически (колода, перевод и источник подставятся сами) или самому — своё название, картинка, переводчики">${label}</button>`;
    },

    open(spec) {
      const opts = (spec.options || []).filter(o => o && String(o.no || '').trim())
        .map(o => Object.assign({ by: undefined, exBy: undefined, kind: /\s\S+\s/.test(o.no) && /[.!?…]$/.test(String(o.no).trim()) ? 'sent' : 'word' }, o, { edited: {} }));
      if (!opts.length) { UI.toast('Нет текста для карточки', 'warn'); return; }
      if (!opts.some(o => o.checked)) (opts.find(o => o.id === spec.pick) || opts[0]).checked = true;
      if (spec.manual) { this._manualQueue(spec, [opts[0]], null, false); return; }
      const remembered = spec.key && ((Store.settings.cmDecks || {})[spec.key]);
      let deckSel = remembered && Store.deck(remembered) ? remembered : spec.deckId && Store.deck(spec.deckId) ? spec.deckId : (findDeck(spec.deck) || {}).id || '__def';
      let busy = false;
      const s = spec.source || {};
      const groups = spec.groups || {};

      const deckOptions = () => {
        const def = findDeck(spec.deck);
        const list = Store.decks().slice().sort((a, b) => (b.id === (def || {}).id) - (a.id === (def || {}).id) || String(a.name).localeCompare(String(b.name), 'ru'));
        return `${def ? '' : `<option value="__def" ${deckSel === '__def' ? 'selected' : ''}>🆕 ${esc(spec.deck)} (новая)</option>`}
          ${list.map(d => `<option value="${esc(d.id)}" ${deckSel === d.id ? 'selected' : ''}>${esc(d.name)} · ${Store.cards(d.id).length}</option>`).join('')}
          <option value="__new">➕ Новая колода…</option>`;
      };
      const whoOf = o => {
        if (!o.filled && !String(o.ru || '').trim()) return '<span class="tg-who"><span class="spinner sm"></span> перевожу…</span>';
        const c = chosen(o);
        if (c.both) return `${whoHtml(o.srcRu, o.srcBy, false, o.byNote)} ${whoHtml(o.alt.ru, o.alt.by)}`;
        return whoHtml(c.ru, c.by, c.me, o.byNote);
      };
      const altsHtml = o => {
        if (!o.alt || o.edited.ru) return '';
        const p = o.trPick || 'src';
        const src = o.byNote || s.name || 'источник';
        return `<div class="cm-alts" role="radiogroup" aria-label="Какой перевод вставить">
            <button type="button" class="cm-alt ${p === 'src' ? 'on' : ''}" data-cm-alt="src" role="radio" aria-checked="${p === 'src'}" title="Перевод из источника — его написал человек, по смыслу">✓ по смыслу · ${esc(src)}</button>
            <button type="button" class="cm-alt ${p === 'lit' ? 'on' : ''}" data-cm-alt="lit" role="radio" aria-checked="${p === 'lit'}" title="Машинный перевод — слово в слово">⚠️ дословно · ${esc(Translators.provNames(o.alt.by))}</button>
            <button type="button" class="cm-alt ${p === 'both' ? 'on' : ''}" data-cm-alt="both" role="radio" aria-checked="${p === 'both'}" title="Оба: по смыслу и дословно в скобках">оба</button>
          </div>
          <div class="small muted cm-lit">${p === 'lit' ? `по смыслу: «${esc(o.srcRu)}»` : `дословно: «${esc(o.alt.ru)}»`} — ${p === 'lit' ? 'так переводит человек (идиома, по смыслу)' : 'слово в слово, машинный перевод'}</div>`;
      };
      const exHtml = o => !o.example ? '' : `<div lang="nb">💬 ${esc(o.example)}</div>
        <div class="ru-text">${o.exampleRu ? esc(o.exampleRu) + ' ' + whoHtml(o.exampleRu, o.exBy, false, o.exNote || s.name) : o.filled ? '<span class="muted">перевод примера не пришёл</span>' : '<span class="spinner sm"></span>'}</div>`;
      const noteHtml = o => {
        const dup = dupIn(deckSel.startsWith('__') ? null : deckSel, o.no);
        const c = chosen(o);
        return `${dup ? `<span class="chip cm-dup" title="Такая карточка уже есть в выбранной колоде">уже есть в колоде</span>` : ''}
          ${isMachine([...(c.by || []), ...(o.exBy || [])]) ? '<span class="small cm-mt">⚠️ перевод машинный — карточка будет помечена «перепроверьте»</span>' : ''}`;
      };
      // a long line (a sentence) gets a 2–3 line box — readable in full on a phone; a word — one line
      const long = (o, v) => o.kind === 'sent' || String(v || '').length > 38 || /\n/.test(v || '');
      const field = (o, i, f, v, extra) => long(o, f === 'ru' ? chosen(o).ru : o.no)
        ? `<textarea class="input cm-ta" data-cm-f="${f}" data-i="${i}" rows="${String(v || '').length > 90 ? 3 : 2}" autocomplete="off" ${extra}>${esc(v)}</textarea>`
        : `<input class="input" data-cm-f="${f}" data-i="${i}" value="${esc(v)}" autocomplete="off" ${extra}>`;
      const rowHtml = (o, i) => `<div class="cm-row ${o.checked ? 'on' : ''}" data-row="${i}">
          <label class="cm-chk" title="Добавить в карточки"><input type="checkbox" data-cm-chk="${i}" ${o.checked ? 'checked' : ''} aria-label="Добавить: ${esc(o.no)}"></label>
          <div class="cm-fields">
            <div class="cm-kind">${esc(o.label || (o.kind === 'sent' ? '💬 Предложение' : '🔤 Слово'))}</div>
            <div class="cm-pair">
              ${field(o, i, 'no', o.no, 'lang="nb" autocapitalize="off" spellcheck="false" aria-label="Норвежский"')}
              ${field(o, i, 'ru', chosen(o).ru, `placeholder="${o.filled ? (o.err ? 'перевод не пришёл — впишите сами' : 'перевод') : 'перевожу…'}" aria-label="Перевод"`)}
            </div>
            <div class="cm-who" data-cm-who="${i}">${whoOf(o)}</div>
            <div data-cm-alts="${i}">${altsHtml(o)}</div>
            <div class="cm-ex" data-cm-ex="${i}" ${o.example ? '' : 'hidden'}>${exHtml(o)}</div>
            <div class="cm-note" data-cm-note="${i}">${noteHtml(o)}</div>
          </div>
        </div>`;
      const listHtml = () => {
        let out = '', lastGroup = null;
        opts.forEach((o, i) => {
          if ((o.group || '') !== lastGroup) { lastGroup = o.group || ''; if (lastGroup && groups[lastGroup]) out += `<div class="cm-group">${esc(groups[lastGroup])}</div>`; }
          out += rowHtml(o, i);
        });
        return out;
      };
      // what the user changed here (typed, ticked, picked another translation) is not lost by an accidental ✕ / Esc / tap outside
      const initPick = opts.map(o => !!o.checked).join();
      const changed = () => opts.some(o => o.edited.no || o.edited.ru || o.trPick) || opts.map(o => !!o.checked).join() !== initPick;
      const m = UI.modal({
        title: '➕ Создать карточку', cls: 'cm-modal',
        beforeClose: UI.guard(() => busy || !changed() ? null
          : { title: 'Закрыть без сохранения?', line: 'Карточки не созданы — изменения не сохранены.', actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }] }),
        body: `
          ${opts.length > 1 ? `<div class="cm-top"><span class="small muted">Отметьте, что добавить в карточки:</span><button type="button" class="btn sm ghost" data-cm-all>☑ Выбрать всё</button></div>` : ''}
          <div class="cm-list" data-cm-list>${listHtml()}</div>
          <div class="cm-src"><span class="cm-src-ico">📍</span><span class="cm-src-t"><b>Откуда:</b> ${esc(s.label || 'из приложения')}${s.url ? ` <a href="${esc(s.url)}" target="_blank" rel="noopener">↗ на сайте</a>` : ''}</span></div>
          <label class="field cm-deck"><span>📚 Колода</span><select class="input" data-cm-deck>${deckOptions()}</select></label>
          <div class="small muted cm-hint"><b>⚡ Создать</b> — карточки сохранятся как есть: перевод, пример, отметка «откуда» и кто переводил${Store.settings.autoImages && Store.settings.imageProvider !== 'off' ? ', картинка подберётся сама' : ''}.
            <b>✍️ Заполнить самому</b> — откроется редактор${opts.length > 1 ? ' (для каждой отмеченной по очереди)' : ''}: своё название и перевод, картинка, проверка переводчиками и нейросетью.</div>`,
        foot: `<button class="btn ghost" data-cm="cancel">Отмена</button>
          <button class="btn" data-cm="manual">✍️ Заполнить самому</button>
          <button class="btn primary" data-cm="auto"></button>`,
      });
      const picked = () => opts.filter(o => o.checked);
      const syncFoot = () => {
        const n = picked().length;
        const a = m.$('[data-cm="auto"]'), h = m.$('[data-cm="manual"]'), all = m.$('[data-cm-all]');
        if (!busy) {
          a.innerHTML = n > 1 ? `⚡ Создать ${esc(U.cards ? U.cards(n) : n + ' карточек')}` : '⚡ Создать карточку';
          a.disabled = !n; h.disabled = !n;
        }
        if (all) all.innerHTML = n === opts.length ? '☐ Снять всё' : `☑ Выбрать всё (${opts.length})`;
      };
      // a translation that arrives later fills in only what is empty — what the user is typing stays, focus stays
      const refresh = i => {
        const o = opts[i], row = m.$(`[data-row="${i}"]`); if (!row) return;
        const ru = row.querySelector('[data-cm-f="ru"]');
        if (!o.edited.ru && document.activeElement !== ru) { ru.value = ru.tagName === 'TEXTAREA' ? String(chosen(o).ru || '') : String(chosen(o).ru || '').replace(/\n/g, ' '); ru.placeholder = o.err ? 'перевод не пришёл — впишите сами' : 'перевод'; }
        row.querySelector('[data-cm-who]').innerHTML = whoOf(o);
        row.querySelector('[data-cm-alts]').innerHTML = altsHtml(o);
        const ex = row.querySelector('[data-cm-ex]'); ex.innerHTML = exHtml(o); ex.hidden = !o.example;
        row.querySelector('[data-cm-note]').innerHTML = noteHtml(o);
      };
      const start = o => {
        if (!o.filling) o.filling = fill(o).then(() => { o.srcRu = o.ru; o.srcBy = o.by || []; if (m.el.isConnected) refresh(opts.indexOf(o)); });
        return o.filling;
      };
      syncFoot();
      // translations: the ticked ones first, then the rest (a few at a time — the translators have limits)
      (async () => {
        const order = [...picked(), ...opts.filter(o => !o.checked)];
        for (let k = 0; k < order.length; k += 3) { if (!m.el.isConnected) return; await Promise.all(order.slice(k, k + 3).map(start)); }
      })();

      m.el.addEventListener('input', e => {
        const f = e.target.dataset && e.target.dataset.cmF; if (!f) return;
        const i = +e.target.dataset.i, o = opts[i];
        if (f === 'ru' && !o.edited.ru && o.alt) { const c = chosen(o); o.ru = c.ru; o.by = c.by; }
        o.edited[f] = true; o[f] = e.target.value.trim();
        if (!o.checked) { o.checked = true; m.$(`[data-cm-chk="${i}"]`).checked = true; m.$(`[data-row="${i}"]`).classList.add('on'); syncFoot(); }
        if (f === 'ru') { m.$(`[data-cm-who="${i}"]`).innerHTML = whoOf(o); m.$(`[data-cm-alts="${i}"]`).innerHTML = ''; }
        m.$(`[data-cm-note="${i}"]`).innerHTML = noteHtml(o);
      });
      m.el.addEventListener('change', async e => {
        if (e.target.matches('[data-cm-chk]')) {
          const i = +e.target.dataset.cmChk; opts[i].checked = e.target.checked;
          m.$(`[data-row="${i}"]`).classList.toggle('on', e.target.checked); syncFoot();
          return;
        }
        if (!e.target.matches('[data-cm-deck]')) return;
        if (e.target.value === '__new') {
          const name = await UI.prompt('📚 Новая колода', spec.deck || '', 'Название колоды');
          if (name && name.trim()) { const d = findDeck(name.trim()) || Store.addDeck(name.trim(), s.label || ''); deckSel = d.id; Store.save(); }
          e.target.innerHTML = deckOptions();
        } else deckSel = e.target.value;
        opts.forEach((o, i) => { const n = m.$(`[data-cm-note="${i}"]`); if (n) n.innerHTML = noteHtml(o); });
      });
      m.el.addEventListener('click', async e => {
        const all = e.target.closest('[data-cm-all]');
        if (all) {
          const on = picked().length !== opts.length;
          opts.forEach((o, i) => { o.checked = on; m.$(`[data-cm-chk="${i}"]`).checked = on; m.$(`[data-row="${i}"]`).classList.toggle('on', on); });
          syncFoot(); return;
        }
        const alt = e.target.closest('[data-cm-alt]');
        if (alt) {
          const i = +alt.closest('[data-row]').dataset.row, o = opts[i];
          o.trPick = alt.dataset.cmAlt;
          if (!o.checked) { o.checked = true; m.$(`[data-cm-chk="${i}"]`).checked = true; m.$(`[data-row="${i}"]`).classList.add('on'); syncFoot(); }
          refresh(i); return;
        }
        const b = e.target.closest('[data-cm]'); if (!b || busy) return;
        if (b.dataset.cm === 'cancel') { m.tryClose(); return; }
        const list = picked().filter(o => String(o.no || '').trim());
        if (!list.length) { UI.toast('Отметьте хотя бы одну строку', 'warn'); return; }
        busy = true;
        const label = b.innerHTML;
        b.disabled = true; b.innerHTML = '<span class="spinner sm"></span> ' + (b.dataset.cm === 'auto' ? 'сохраняю…' : 'открываю…');
        try {
          await Promise.all(list.map(start)); // translations still coming
          let deckId = deckSel, created = false;
          if (deckId === '__def' || !Store.deck(deckId)) { const d = findDeck(spec.deck) || (created = true, Store.addDeck(spec.deck, spec.deckDesc || '')); deckId = d.id; }
          if (spec.key) Store.settings.cmDecks = Object.assign({}, Store.settings.cmDecks, { [spec.key]: deckId });
          if (b.dataset.cm === 'auto') {
            const cards = await this._saveAll(spec, list, deckId);
            m.close();
            if (cards.length && spec.onDone) spec.onDone(cards);
          } else {
            m.close();
            this._manualQueue(spec, list, deckId, created);
          }
        } catch (err) {
          UI.toast('Карточка не сохранилась: ' + err.message, 'bad');
          busy = false; b.disabled = false; b.innerHTML = label; syncFoot();
        }
      });
      return m;
    },

    /** provenance entries of an option (source first, then who translated / edited) */
    _history(spec, o) {
      const s = spec.source || {}, c = chosen(o);
      const h = [Prov.entry(s.by || 'import', 'import', null, srcText(spec))];
      if (o.edited.no || o.edited.ru) h.push(Prov.entry('manual', 'edit', null, 'поправлено вручную перед сохранением'));
      if (!c.me) Translators.provKeys(c.by).forEach(k => h.push(Prov.entry(k, 'translate', null, c.both ? 'дословный перевод (в скобках)' : 'перевод слова / фразы')));
      else if (o.me && !o.edited.ru && c.ru) h.push(Prov.entry('manual', 'verify', { ru: { old: '', new: c.ru } }, 'перевод проверен вами (✓)'));
      if (o.exMe && o.exampleRu) h.push(Prov.entry('manual', 'verify', { exampleRu: { old: '', new: o.exampleRu } }, 'перевод примера проверен вами (✓)'));
      else Translators.provKeys(o.exBy).forEach(k => h.push(Prov.entry(k, 'translate', null, 'перевод примера')));
      return h;
    },
    _fields(spec, o) {
      const s = spec.source || {};
      const desc = [o.description, `Источник: ${s.label || 'приложение'}${s.url ? ' · ' + s.url : ''}`].filter(Boolean).join('\n');
      return {
        no: o.no, ru: chosen(o).ru || '', example: o.example || '', exampleRu: o.exampleRu || '', wordClass: o.wordClass || '',
        description: desc, tags: [...new Set([...(spec.tags || []), ...(o.tags || [])])],
      };
    },
    _mt(o) { const c = chosen(o); const w = Translators.mtFlag([...(c.me ? [] : c.by || []), ...(o.exMe ? [] : o.exBy || [])]); return w || (o.me && c.me ? false : w); },
    async _saveAll(spec, list, deckId) {
      const cards = list.map(o => Store.addCard(deckId, Object.assign(this._fields(spec, o), { history: this._history(spec, o), mtWarn: this._mt(o) })));
      await Store.saveNow();
      const deck = Store.deck(deckId);
      const mt = list.some(o => this._mt(o));
      const what = cards.length === 1 ? `«${first(cards[0].no).slice(0, 40)}»` : (U.cards ? U.cards(cards.length) : cards.length + ' карточек');
      const msg = `➕ ${what} → ${deck.name}${mt ? ' · ⚠️ перевод машинный — перепроверьте' : ''}`;
      if (UI.toastAction) UI.toastAction(msg, cards.length === 1 ? '✏️ Открыть' : '📚 К колоде', () => {
        if (cards.length === 1) Views.editCard(cards[0].id, deckId, () => { if (App.view && App.view.name === 'deck') App.render(); });
        else UI.goTo('deck', { id: deckId }); // the windows above (exercise, player…) close — the deck is really shown
      }, 6000, '✅');
      else UI.toast(msg, 'good');
      if (Store.settings.autoImages && Store.settings.imageProvider !== 'off' && window.Images) cards.filter(c => !UI.isLong(c.no)).forEach(c => Images.ensure(c).catch(() => {}));
      if (Store.settings.aiAutoSave && AI.available() && Views.runAiCheck) Views.runAiCheck(cards, { quietIfOk: true });
      if (window.App && App.view && (App.view.name === 'deck' || App.view.name === 'home')) App.render();
      return cards;
    },
    /** the card editor for each ticked line, one after another */
    _manualQueue(spec, list, deckId, created) {
      if (!deckId) {
        const remembered = spec.key && (Store.settings.cmDecks || {})[spec.key];
        const d = (remembered && Store.deck(remembered)) || findDeck(spec.deck) || (created = true, Store.addDeck(spec.deck, spec.deckDesc || ''));
        deckId = d.id;
      }
      const made = [];
      const s = spec.source || {};
      const step = k => {
        if (k >= list.length) {
          if (made.length && spec.onDone) spec.onDone(made);
          else if (!made.length && created && window.Create) Create.dropIfEmpty(deckId);
          return;
        }
        const o = list[k];
        const go = () => {
          const c = chosen(o);
          const fieldBy = { no: o.edited.no ? 'manual' : s.by || 'import', example: s.by || 'import', description: s.by || 'import', wordClass: s.by || 'import', tags: s.by || 'import' };
          fieldBy.ru = c.me ? 'manual' : Translators.provKeys(c.by)[0] || s.by || 'import';
          fieldBy.exampleRu = Translators.provKeys(o.exBy)[0] || s.by || 'import';
          const more = list.length > 1 ? ` · карточка ${k + 1} из ${list.length}` : '';
          let saved = false;
          Views.editCard(null, deckId, card => {
            if (window.App && App.view && (App.view.name === 'deck' || App.view.name === 'home')) App.render();
            if (saved) return; // called again when the auto picture arrives — the next editor opens only once
            saved = true; made.push(card);
            setTimeout(() => step(k + 1), 320);
          }, {
            prefill: this._fields(spec, o), fieldBy, srcBy: s.by || 'import', note: srcText(spec) + more, mtWarn: this._mt(o),
            onCancel: () => { if (!saved) setTimeout(() => step(k + 1), 320); },
          });
        };
        if (!o.filled) {
          const busy = UI.busy ? UI.busy('Перевожу…') : null;
          (o.filling || fill(o).then(() => { o.srcRu = o.ru; o.srcBy = o.by || []; })).finally(() => { if (busy) busy.close(); go(); });
        } else go();
      };
      step(0);
    },
  };

  window.CardMaker = CardMaker;
})();
