/* ============ Card provenance: who worked on this card (manual / import / translator / AI) + history ============
 * card.history = [{ t, by, a, f, n }]
 *   by: 'manual' | 'import' | 'tr:<translator id>' | 'ai:<ai provider id>'
 *   a:  create | edit | import | translate | verify | check | explain | generate | fill
 *   f:  { field: { old, new } }   n: note
 */
(function () {
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  // clear line icons (the 📥 / ✍️ emoji were too small to recognise on the card)
  const SVG = {
    // arrow going down into a box = "imported from a file / another app"
    import: s => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v11"/><path d="m7 9.5 5 5 5-5"/><path d="M4 15v3.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V15"/></svg>`,
    // pencil = "typed by hand"
    manual: s => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/><path d="m14.5 5.5 3 3"/></svg>`,
  };
  const BASE = {
    manual: { name: 'Ручной ввод', short: 'Вручную', emoji: '✍️' },
    import: { name: 'Импорт', short: 'Импорт', emoji: '📥' },
  };
  const ACTIONS = {
    create: 'создал карточку', edit: 'изменил', import: 'импортировал', translate: 'перевёл', verify: 'сверил перевод',
    check: 'проверил', explain: 'добавил объяснение', generate: 'создал карточку', fill: 'заполнил поля',
    forms: 'заполнил формы слова', examples: 'добавил примеры по формам', synonyms: 'добавил синонимы',
  };
  const FIELD = { no: '🇳🇴 Норвежский', ru: '🇷🇺 Русский', uk: '🇺🇦 Перевод на украинский', description: '📝 Объяснение', example: '💬 Пример', exampleRu: '💬 Перевод примера', wordClass: 'Часть речи', en: 'English', imagePrompt: 'Картинка', tags: 'Теги', forms: '📚 Формы слова', examples: '💬 Примеры по формам', synonyms: '🔁 Синонимы' };
  /** labels for history entries that are not compared by diff() by default */
  const LABEL = Object.assign({}, FIELD, { formsTr: '📚 Переводы форм слова (🇷🇺 / 🇺🇦)', exampleUk: '💬 🇺🇦 Перевод примера на украинский' });
  /** a form's / example's translation: «ru · 🇺🇦 uk» (the Ukrainian one only when there is one) */
  const trOf = x => [x.ru, x.uk && String(x.uk).trim() !== String(x.ru || '').trim() ? '🇺🇦 ' + x.uk : ''].filter(Boolean).join(' · ');
  /** forms/examples arrays <-> readable text (for history and the editor) */
  const listText = (arr, withNote) => (arr || []).map(x => `${x.label ? x.label + ': ' : ''}${x.no}${trOf(x) ? ' (' + trOf(x) + ')' : ''}${withNote && x.note ? ' — ' + x.note : ''}`).join('\n');
  const MAX = 40;
  const cut = s => { s = String(s == null ? '' : s); return s.length > 600 ? s.slice(0, 600) + '…' : s; };

  const Prov = {
    ACTIONS, listText, FIELD, LABEL,
    /** «🇷🇺 Русский», «🇺🇦 Перевод на украинский», … — the label of a card field in the history */
    fieldLabel(k) { return LABEL[k] || k; },
    name(by) {
      if (BASE[by]) return BASE[by].name;
      const [k, id] = String(by).split(':');
      if (k === 'ai') return AI.PROVIDERS[id] ? AI.PROVIDERS[id].name : 'Нейросеть';
      if (k === 'tr') return Translators.LIST[id] ? 'Переводчик ' + Translators.LIST[id].name : 'Переводчик';
      return by;
    },
    icon(by, size = 16) {
      if (BASE[by]) return SVG[by](size);
      const [k, id] = String(by).split(':');
      if (k === 'ai') { const h = AI.icon(id, size, Prov.name(by)); return h && !/>🤖</.test(h) ? h : BOT(size); }
      if (k === 'tr' && Translators.LIST[id]) {
        const t = Translators.LIST[id];
        if (t.emoji) return Translators.icon(id, size);
        return t.ai ? BOT(size) : `<img class="ai-ico" src="https://www.google.com/s2/favicons?domain=${t.domain}&sz=64" width="${size}" height="${size}" alt="${U.esc(t.name)}" onerror="this.replaceWith(document.createTextNode('🌐'))">`;
      }
      return '❔';
    },
    entry(by, a, fields, note) {
      const e = { t: Date.now(), by, a };
      if (fields && Object.keys(fields).length) {
        e.f = {};
        Object.entries(fields).forEach(([k, v]) => { e.f[k] = { old: cut(v.old), new: cut(v.new) }; });
      }
      if (note) e.n = String(note).slice(0, 300);
      return e;
    },
    /** new history array (does not save) */
    add(card, ...entries) {
      return ((card && card.history) || []).concat(entries.filter(Boolean)).slice(-MAX);
    },
    /** save entries on a stored card */
    log(cardId, ...entries) {
      const c = Store.card(cardId);
      if (c) Store.updateCard(cardId, { history: this.add(c, ...entries) });
    },
    /** changed fields between two card states */
    diff(before, after, keys) {
      const out = {};
      (keys || Object.keys(FIELD)).forEach(k => {
        const val = x => k === 'tags' ? (x[k] || []).join(' ') : (k === 'forms' || k === 'examples' || k === 'synonyms') ? listText(x[k], k !== 'forms') : String(x[k] || '').trim();
        const o = val(before), n = val(after);
        if (o !== n) out[k] = { old: o, new: n };
      });
      return out;
    },
    /** everyone who worked on the card, in order of first appearance */
    sources(card) {
      const list = [];
      (card.history || []).forEach(h => { if (!list.includes(h.by)) list.push(h.by); });
      // cards from older versions: AI checks without history
      (card.aiChecks || []).forEach(x => { const by = 'ai:' + x.p; if (!list.includes(by)) list.push(by); });
      if (!list.length && card.aiChecked && card.aiBy) list.push('ai:' + card.aiBy);
      return list;
    },
    /** labeled: icon + a short word ("Импорт", "Вручную") — used on the study card, where a bare icon was unclear */
    badges(card, size = 15, only = null, labeled = false) {
      const src = this.sources(card).filter(by => !only || only.includes(by));
      if (!src.length) return '';
      const tip = by => BASE[by] ? `${this.name(by)}: ${by === 'import' ? 'карточка загружена из файла или другого приложения' : 'карточку ввели вручную'}. Нажмите — покажу всю историю карточки` : `${this.name(by)} — нажмите, чтобы увидеть, что он сделал`;
      return `<span class="prov-badges${labeled ? ' labeled' : ''}">${src.map(by => `<button class="prov-b${labeled && BASE[by] ? ' labeled' : ''}" data-prov="${U.esc(by)}" data-card="${card.id}" title="${U.esc(tip(by))}" aria-label="${U.esc(tip(by))}">${this.icon(by, size)}${labeled && BASE[by] ? `<span>${BASE[by].short}</span>` : ''}</button>`).join('')}</span>`;
    },

    /** history modal (optionally focused on one source) */
    historyDialog(cardId, focus) {
      const card = Store.card(cardId);
      if (!card) return;
      let filter = focus || 'all';
      const src = this.sources(card);
      const legacy = (card.aiChecks || []).filter(x => !(card.history || []).some(h => h.by === 'ai:' + x.p))
        .map(x => ({ t: x.t, by: 'ai:' + x.p, a: 'check', n: x.m ? 'модель ' + x.m : '' }));
      const all = (card.history || []).concat(legacy).sort((a, b) => b.t - a.t);
      const m = UI.modal({
        title: '🧾 Происхождение и история карточки', cls: 'wide',
        body: `<div class="hist-card"><b>${UI.rich(String(card.no).split('\n')[0].slice(0, 120))}</b> — ${UI.rich(String(card.ru || '').split('\n')[0].slice(0, 120))}${String(card.uk || '').trim() ? ` <span lang="uk">· 🇺🇦 ${UI.rich(String(card.uk).split('\n')[0].slice(0, 120))}</span>` : ''}</div>
          <div class="row" style="gap:6px" data-filters>
            <button class="chip ${filter === 'all' ? 'active' : ''}" data-f="all">Все (${all.length})</button>
            ${src.map(by => `<button class="chip ${filter === by ? 'active' : ''}" data-f="${U.esc(by)}">${this.icon(by, 15)} ${U.esc(this.name(by))} (${all.filter(h => h.by === by).length})</button>`).join('')}
          </div>
          <div class="hist-list" data-list></div>`,
        foot: '<button class="btn ghost" data-close2>Закрыть</button>',
      });
      const TEXT = ['no', 'ru', 'uk', 'description', 'example', 'exampleRu', 'wordClass'];
      // a version can be restored if it changed text fields and nothing was cut off when saving it
      // "explanation added below" stores only the added part — reverting it would wipe the whole text, so not offered
      const revertable = h => h.f && !(h.a === 'explain' && !/заменено/.test(h.n || '')) && Object.entries(h.f).some(([k, v]) => TEXT.includes(k) && v.old !== v.new && !(String(v.old).length > 600));
      const draw = () => {
        const items = all.filter(h => filter === 'all' || h.by === filter);
        m.$('[data-list]').innerHTML = items.length ? items.map(h => `
          <div class="hist-item">
            <div class="hist-head">${this.icon(h.by, 20)} <b>${U.esc(this.name(h.by))}</b> <span>${U.esc(ACTIONS[h.a] || h.a)}</span>
              <span class="muted small" style="margin-left:auto">${new Date(h.t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              ${revertable(h) ? `<button class="btn sm" data-revert="${h.t}" title="Вернуть значения, которые были до этого изменения">↶ Вернуть как было</button>` : ''}</div>
            ${h.n ? `<div class="small muted">${U.esc(h.n)}</div>` : ''}
            ${h.f ? Object.entries(h.f).map(([k, v]) => `<div class="change"><b>${LABEL[k] || k}</b><span>${v.old ? `<span class="old">${UI.rich(v.old)}</span><br>` : ''}<span class="new">${UI.rich(v.new)}</span></span></div>`).join('') : ''}
          </div>`).join('') : '<div class="muted center" style="padding:20px">Нет записей</div>';
      };
      draw();
      m.$('[data-close2]').onclick = () => m.close();
      m.$('[data-list]').addEventListener('click', async e => {
        const b = e.target.closest('[data-revert]'); if (!b) return;
        const h = all.find(x => String(x.t) === b.dataset.revert); if (!h) return;
        const fields = Object.entries(h.f).filter(([k, v]) => TEXT.includes(k) && String(v.old).length <= 600);
        const list = fields.map(([k, v]) => `<b>${LABEL[k] || k}</b>: ${UI.rich(v.old || '— пусто —')}`).join('<br>');
        if (!(await UI.confirm(`Вернуть как было до изменения «${U.esc(this.name(h.by))}»?<br><br>${list}`, { ok: '↶ Вернуть' }))) return;
        const cur = Store.card(cardId); if (!cur) return;
        const patch = {}, diff = {};
        fields.forEach(([k, v]) => { patch[k] = v.old; diff[k] = { old: cur[k] || '', new: v.old }; });
        patch.history = this.add(cur, this.entry('manual', 'edit', diff, `возврат версии до «${this.name(h.by)}»`));
        Store.updateCard(cardId, patch);
        UI.toast('Версия возвращена', 'good');
        m.close(); App.render();
      });
      m.$('[data-filters]').onclick = e => {
        const b = e.target.closest('[data-f]'); if (!b) return;
        filter = b.dataset.f;
        m.$$('[data-f]').forEach(x => x.classList.toggle('active', x === b));
        draw();
      };
    },
  };

  window.Prov = Prov;
})();
