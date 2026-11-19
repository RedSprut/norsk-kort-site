/* ============ 🔤 Select text anywhere → instant translation, 🔊, ➕ card ============
 * Works in every window of the app: the textbook reader, grammar topics, card backs, Telegram / VK posts, news…
 * (not inside pages of other sites shown in a frame — the browser does not allow it; books from the shelf open in
 * «📘 Мой учебник» for that).
 * Norwegian → Russian (and Russian → Norwegian). The card gets the sentence the word was in, and where it came from.
 */
(function () {
  let pop = null, seq = 0, cur = null;
  const hide = () => { if (pop) { pop.remove(); pop = null; } cur = null; };
  const isCyr = s => U.cyrRatio(s) > 0.5;

  /** the sentence around the selection (for the card's example) */
  function sentenceOf(sel, text) {
    try {
      const node = sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode);
      const block = node && node.closest('p, li, .tb-s, .tb-p, .gk-p, .desc-line, .ex-body, .tg-text, div');
      // only the text itself: not the 🔊 buttons, nor the translations shown next to it (views «sent» / «word»)
      const clean = block && block.cloneNode(true);
      if (clean) clean.querySelectorAll('button, .ex-ru, .ex-ru-in, .tb-ru, .wbw-ru, .sel-pop').forEach(x => x.remove());
      const whole = clean ? clean.textContent.replace(/\s+/g, ' ').trim() : '';
      const s = Study.splitSent(whole).find(x => x.includes(text));
      return s && s !== text && s.length < 400 ? s : '';
    } catch (e) { return ''; }
  }
  /** where the text was selected — to say so on the card */
  function sourceOf(sel) {
    if (window.Textbook && Textbook._rec && Textbook._m && document.body.contains(Textbook._m.el)) {
      const r = Textbook._rec;
      return { label: `📘 «${r.title}», стр. ${r.last}${r.off ? ` (в книге ${r.last - r.off})` : ''}`, deck: `📘 ${r.title}`, textbook: r.title };
    }
    const modal = sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode).closest('.modal');
    const t = modal && modal.querySelector('.modal-head h2');
    return { label: t ? `выделено: ${t.textContent.trim().slice(0, 80)}` : 'выделено в приложении', deck: '📖 Слова из чтения' };
  }

  async function show() {
    const sel = window.getSelection();
    const text = sel ? sel.toString().replace(/\s+/g, ' ').trim() : '';
    if (!text || text.length > 400 || !/\p{L}/u.test(text) || !sel.rangeCount) { hide(); return; }
    const anchor = sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode);
    if (!anchor || anchor.closest('input, textarea, [contenteditable], .sel-pop, .dark-screen')) return;
    if (cur && cur.text === text) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    const from = isCyr(text) ? 'ru' : 'no', to = from === 'ru' ? 'no' : 'ru';
    const id = ++seq;
    const next = { text, from, to, sentence: from === 'no' ? sentenceOf(sel, text) : '', src: sourceOf(sel) };
    if (pop) { pop.remove(); pop = null; }
    cur = next;
    pop = document.createElement('div');
    pop.className = 'sel-pop';
    pop.innerHTML = `<div class="sp-tr"><span class="spinner sm"></span> перевожу…</div>
      <div class="sp-row">
        <button class="media-btn sm" data-sp="say" title="Произнести">🔊</button>
        <button class="btn sm primary" data-sp="card" title="Сразу сделать карточку: ${U.esc(cur.src.deck)}">➕ В карточку</button>
        <button class="btn sm" data-sp="more" title="Выбрать: слово или всё предложение, колоду, перевод — или заполнить карточку самому (картинка, переводчики)">✍️ Выбрать…</button>
        <button class="icon-btn sm" data-sp="x" title="Закрыть">✕</button>
      </div>`;
    document.body.appendChild(pop);
    // above the selection (or below, if there is no room), inside the screen
    const pw = Math.min(340, window.innerWidth - 16);
    pop.style.width = pw + 'px';
    const left = Math.max(8, Math.min(window.innerWidth - pw - 8, rect.left + rect.width / 2 - pw / 2));
    const ph = pop.offsetHeight || 90;
    const top = rect.top - ph - 10 > 8 ? rect.top - ph - 10 : Math.min(window.innerHeight - ph - 8, rect.bottom + 10);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    // translation: a single small word from the hand-made list first, then the translators
    // (kept as a promise: «➕ В карточку» pressed while it is still coming waits for it)
    next.ready = (async () => {
      let tr = from === 'no' && !/\s/.test(text) ? NoGloss.get(text) : null;
      let by = tr ? [] : null;
      if (!tr) {
        try { const r = await Translators.translateMany([text], from, to); tr = r.out[0] || ''; by = r.by; next.err = r.error; } catch (e) { tr = ''; }
      }
      next.tr = tr || ''; next.by = by || [];
    })();
    await next.ready;
    if (id !== seq || !pop) return;
    const { tr, by } = next;
    pop.querySelector('.sp-tr').innerHTML = tr
      ? `<b>${U.esc(tr)}</b>${by.length ? `<small> · ${U.esc(Translators.provNames(by))}</small>` : '<small> · словарик</small>'}`
      : `<span class="muted">Перевод не пришёл${next.err ? ': ' + U.esc(next.err) : ''}</span>`;
  }

  async function makeCard() {
    const c = cur; if (!c || c.saving) return;
    c.saving = true; // a double tap must not make two cards
    const done = () => { if (cur === c) hide(); }; // (not the bubble of a newer selection)
    const b = pop && pop.querySelector('[data-sp="card"]');
    if (b) { b.disabled = true; b.innerHTML = '<span class="spinner sm"></span> сохраняю…'; }
    if (c.ready) await c.ready; // the translation is still coming
    if (c.from === 'ru' && !c.tr) { UI.toast('Норвежский перевод не пришёл — карточку сделать не из чего', 'warn'); done(); return; }
    const decks = Store.decks();
    let deck = decks.find(d => (c.src.textbook && d.textbook === c.src.textbook) || d.name === c.src.deck);
    if (!deck) { deck = Store.addDeck(c.src.deck, c.src.textbook ? `Учебник «${c.src.textbook}»` : 'Слова и фразы, выделенные при чтении'); if (c.src.textbook) Store.updateDeck(deck.id, { textbook: c.src.textbook }); }
    const no = c.from === 'no' ? c.text : (c.tr || '');
    const ru = c.from === 'no' ? (c.tr || '') : c.text;
    if (Store.cards(deck.id).some(x => U.norm(String(x.no).split('\n')[0]) === U.norm(no))) { UI.toast(`«${no}» уже есть в «${deck.name}»`, 'warn'); done(); return; }
    // the example sentence with its translation (if it is quick to get)
    let exRu = '';
    if (c.sentence) { try { exRu = Study.sentTr(c.sentence) || (await Translators.translateMany([c.sentence], 'no', 'ru')).out[0] || ''; } catch (e) { /* no example translation */ } }
    Store.addCard(deck.id, {
      no, ru, example: c.sentence || '', exampleRu: exRu, description: c.src.label,
      tags: c.src.textbook ? ['textbook', 'selection'] : ['selection'],
      history: [Prov.entry('import', 'create', null, c.src.label), ...Translators.provKeys(c.by).map(k => Prov.entry(k, 'translate', null, 'перевод выделенного текста'))],
      mtWarn: Translators.mtFlag(c.by),
    });
    await Store.saveNow();
    UI.toast(`➕ «${no.slice(0, 40)}» → ${deck.name}`, 'good', 3000);
    done();
    if (App.view && App.view.name === 'deck') App.render();
  }

  // after the mouse / finger lets go of a selection
  let t = null;
  const later = () => { clearTimeout(t); t = setTimeout(show, 280); };
  document.addEventListener('mouseup', e => { if (!e.target.closest('.sel-pop')) later(); });
  document.addEventListener('touchend', e => { if (!e.target.closest('.sel-pop')) later(); }, { passive: true });
  document.addEventListener('keyup', e => { if (e.shiftKey) later(); });
  document.addEventListener('mousedown', e => { if (pop && !e.target.closest('.sel-pop')) hide(); });
  // Escape closes the bubble only (before the window under it sees the key: windows close on Escape, the study session ends)
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && pop) { e.stopPropagation(); e.preventDefault(); hide(); } }, true);
  document.addEventListener('scroll', () => { if (pop) hide(); }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest('.sel-pop [data-sp]'); if (!b) return;
    e.stopPropagation();
    if (b.dataset.sp === 'x') hide();
    if (b.dataset.sp === 'say' && cur) TTS.speak(cur.text, cur.from);
    if (b.dataset.sp === 'card') makeCard();
    if (b.dataset.sp === 'more' && cur) more(cur);
  }, true);

  /** «✍️ Выбрать…»: the CardMaker window — the word or the whole sentence, the deck, the translation, or by hand */
  async function more(c) {
    hide();
    if (c.ready) { try { await c.ready; } catch (e) { /* translation later in the window */ } }
    const no = c.from === 'no' ? c.text : (c.tr || '');
    const ru = c.from === 'no' ? (c.tr || '') : c.text;
    const options = [];
    if (no) options.push({ id: 'sel', kind: /\s/.test(no) && /[.!?…]$/.test(no) ? 'sent' : 'word', label: c.from === 'no' ? '🔤 Выделенное' : '🔤 Выделенное (перевод на норвежский)', no, ru,
      by: c.from === 'no' ? (c.by || []) : [], byNote: c.from === 'no' && c.tr && !(c.by || []).length ? 'словарик' : '',
      example: c.sentence || '', checked: true });
    if (c.sentence) options.push({ id: 'sent', kind: 'sent', label: '💬 Всё предложение', no: c.sentence, ru: (window.Study && Study.sentTr(c.sentence)) || '' });
    if (!options.length) { UI.toast('Норвежский перевод не пришёл — карточку сделать не из чего', 'warn'); return; }
    const textbook = c.src.textbook;
    CardMaker.open({
      key: textbook ? 'tb:' + textbook : 'selection', deck: c.src.deck,
      deckId: textbook ? (Store.decks().find(d => d.textbook === textbook) || {}).id : null,
      deckDesc: textbook ? `Учебник «${textbook}»` : 'Слова и фразы, выделенные при чтении',
      tags: textbook ? ['textbook', 'selection'] : ['selection'],
      source: { by: 'import', label: c.src.label, name: textbook ? 'учебник' : 'текст' },
      options,
      onDone: () => { if (window.App && App.view && App.view.name === 'deck') App.render(); },
    });
  }

  window.SelPop = { hide };
})();
