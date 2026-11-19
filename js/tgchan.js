/* ============ 📢 «Норвежские каналы в Телеграме» + the Telegram intro ============
 *  - the shipped list data/tg-channels.json (filled by the owner through «Экспорт списка»), plus channels the user adds
 *    by @username / t.me link — cards: title, description, category, members; «Открыть в Телеграме» · «Добавить в
 *    приложение» (the channel joins the user's Telegram sources) · «Убрать»;
 *  - 🧭 «Подобрать норвежские каналы» (the owner's tool; Telegram connected): his dialogs → ONLY public channels and
 *    groups with a @username (private chats, private groups and personal chats are never listed) → tick, describe, category
 *    → saved here + «Экспорт списка» (tg-channels.json, to be shipped as data/tg-channels.json);
 *  - the intro window (paper plane + chat bubbles) on the first visit of the Telegram section, then a soft reminder.
 * Everything that comes from outside (the shared file, Telegram) is cleaned (Store.Safe) and escaped (U.esc): text only.
 */
(function () {
  const UI_KEY = 'nk-tg-ui', CUR_KEY = 'nk-tg-curated', MINE_KEY = 'nk-tg-mine', HIDE_KEY = 'nk-tg-hidden';
  const ls = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full / private mode */ } };
  const state = () => ls(UI_KEY, {}) || {};
  const patch = o => { const s = Object.assign(state(), o); lsSet(UI_KEY, s); return s; };
  const esc = s => U.esc(s);
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const TG = (s = 18) => Telegram.TG_SVG(s);
  const modalOpen = () => !!document.querySelector('#modal-root > .modal-backdrop:not(.closing)');

  const CATS = [['lessons', '📘', 'уроки'], ['words', '🔤', 'слова'], ['video', '🎬', 'видео'], ['news', '📰', 'новости'], ['chat', '💬', 'общение']];
  const CAT = Object.fromEntries(CATS.map(([k, i, t]) => [k, { i, t }]));
  const STRONG = /norsk|norge|norw|nynorsk|bokm[aå]l|норвеж|норвег|норвез/i;
  const WEAK = /spr[aå]k|l[aæ]ring|язык|мова/i;
  const okUser = u => /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(String(u || ''));
  /** «@name», «t.me/name», «https://t.me/s/name/123», «telegram.me/name» → name; invite links (private) → '' */
  function parseUser(v) {
    v = String(v || '').trim();
    if (/joinchat|\/\+|^\+/.test(v)) return '';
    v = v.replace(/^https?:\/\//i, '').replace(/^(www\.)?(t\.me|telegram\.me|telegram\.dog)\/(s\/)?/i, '').replace(/^@/, '').split(/[/?#\s]/)[0];
    return okUser(v) && !/bot$/i.test(v) ? v : '';
  }
  const numRu = n => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',').replace(',0', '') + ' млн' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace('.', ',').replace(',0', '') + ' тыс.' : String(n));
  const hue = u => [...String(u)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  /** one channel from any source → plain, safe fields (or null) */
  function clean(x) {
    if (!x || typeof x !== 'object') return null;
    const username = parseUser(x.username || x.link || '');
    if (!username) return null;
    const S = Store.Safe;
    const one = s => S.text(String(s == null ? '' : s), 400).replace(/\s+/g, ' ').trim();
    return {
      username,
      title: one(x.title).slice(0, 90) || '@' + username,
      about: one(x.about).slice(0, 220),
      category: CAT[x.category] ? x.category : 'lessons',
      members: Math.max(0, Math.min(1e9, Math.round(+x.members || 0))) || 0,
    };
  }
  const lower = u => String(u).toLowerCase();

  /* ---------------- the lists ---------------- */
  let shippedP = null;
  const TgChan = {
    CATS, parseUser, clean,
    shipped() {
      if (!shippedP) {
        shippedP = fetch('data/tg-channels.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : [])).catch(() => [])
          .then(a => (Array.isArray(a) ? a.slice(0, 300).map(clean).filter(Boolean) : []));
      }
      return shippedP;
    },
    curated() { return (ls(CUR_KEY, []) || []).map(clean).filter(Boolean); },
    mine() { return (ls(MINE_KEY, []) || []).map(clean).filter(Boolean); },
    hidden() { return new Set((ls(HIDE_KEY, []) || []).map(lower)); },
    /** shipped ∪ the owner's own selection (not published yet) ∪ the user's own — without the removed ones */
    async list() {
      const hid = this.hidden(), seen = new Set(), out = [];
      const add = (arr, from) => arr.forEach(c => { const k = lower(c.username); if (seen.has(k) || hid.has(k)) return; seen.add(k); out.push(Object.assign({ from }, c)); });
      add(await this.shipped(), 'ship'); add(this.curated(), 'draft'); add(this.mine(), 'mine');
      return out;
    },
    added(u) {
      const k = lower(u), st = Store.settings;
      if ((st.tgExtra || []).some(x => lower(x) === k)) return true;
      const off = new Set((st.tgOff || []).map(lower));
      return Telegram.CHANNELS.some(([x]) => lower(x) === k) && !off.has(k);
    },
    addToApp(u) {
      const st = Store.settings, k = lower(u);
      if (!Telegram.CHANNELS.some(([x]) => lower(x) === k)) Store.setSetting('tgExtra', [...new Set([...(st.tgExtra || []), u])]);
      Store.setSetting('tgOff', (st.tgOff || []).filter(x => lower(x) !== k));
      patch({ used: state().used || Date.now() });
    },
    removeFromApp(u) {
      const st = Store.settings, k = lower(u);
      Store.setSetting('tgExtra', (st.tgExtra || []).filter(x => lower(x) !== k));
    },

    /* ---------------- the block (Telegram section, «Что выучить?») ---------------- */
    cardHtml(c) {
      const cat = CAT[c.category] || CAT.lessons, on = this.added(c.username), u = esc(c.username);
      return `<article class="tgc-card" data-tgc="${u}" style="--h:${hue(c.username)}">
          <span class="tgc-ava" aria-hidden="true">${esc((c.title.replace(/[^\p{L}\p{N}]/gu, '')[0] || c.username[0]).toUpperCase())}</span>
          <div class="tgc-main">
            <b class="tgc-title">${esc(c.title)}</b>
            <span class="tgc-meta"><span class="tgc-cat">${cat.i} ${cat.t}</span>${c.members ? `<span>👥 ${numRu(c.members)}</span>` : ''}<span class="tgc-at">@${u}</span>${c.from === 'draft' ? '<span class="tgc-draft" title="Ваш выбор — ещё не в общем списке">черновик</span>' : c.from === 'mine' ? '<span class="tgc-draft mine">добавили вы</span>' : ''}</span>
            ${c.about ? `<p class="tgc-about">${esc(c.about)}</p>` : ''}
          </div>
          <div class="tgc-acts">
            <a class="btn sm tgc-open" href="https://t.me/${u}" target="_blank" rel="noopener noreferrer" data-tgc-open="${u}">${TG(16)} Открыть в Телеграме</a>
            ${on ? `<button type="button" class="btn sm tgc-in" data-tgc-out="${u}" title="Уже в приложении — нажмите, чтобы убрать из источников">✓ В приложении</button>`
              : `<button type="button" class="btn sm primary tgc-addbtn" data-tgc-add="${u}">➕ Добавить в приложение</button>`}
            <button type="button" class="btn sm ghost tgc-del" data-tgc-del="${u}" title="Убрать из этого списка">Убрать</button>
          </div>
        </article>`;
    },
    emptyHtml() {
      return `<div class="tgc-empty">
          <div class="tgc-empty-ico" aria-hidden="true">${TG(40)}</div>
          <b>Список скоро появится</b>
          <p>Мы собираем проверенные норвежские каналы. А пока найти их легко самим:</p>
          <ol class="tgc-how">
            <li><span aria-hidden="true">🔎</span><span>Откройте Telegram и нажмите на поиск.</span></li>
            <li><span aria-hidden="true">⌨️</span><span>Напишите <b>«norsk»</b> или <b>«Норвегия язык»</b> — появятся каналы и группы.</span></li>
            <li><span aria-hidden="true">🔗</span><span>Откройте канал → его название → <b>«Поделиться»</b> или <b>«Копировать ссылку»</b>.</span></li>
            <li><span aria-hidden="true">📋</span><span>Вставьте ссылку ниже — канал появится здесь.</span></li>
          </ol>
        </div>`;
    },
    /** el: where to draw; o.compact — the short version for «Что вы хотите выучить?» */
    async render(el, o = {}) {
      if (!el) return;
      const authorized = !!(Telegram.status && Telegram.status.authorized);
      if (authorized) patch({ used: state().used || Date.now() });
      el.classList.add('tgc');
      el.innerHTML = `<div class="tgc-head">
            <div><h3>${TG(22)} Норвежские каналы в Телеграме</h3>
            <p class="tgc-sub">Открытые каналы, где учат норвежский: уроки, слова, видео, новости.</p></div>
            ${authorized && !o.compact ? '<button type="button" class="btn sm tgc-pick" data-tgc-pick title="Ваши каналы и группы — выбрать норвежские для общего списка">🧭 Подобрать норвежские каналы</button>' : ''}
          </div>
          <div class="tgc-filter" data-tgcf hidden></div>
          <div class="tgc-list" data-tgcl><div class="small muted"><span class="spinner sm"></span> загружаю…</div></div>
          ${o.compact ? '<button type="button" class="btn sm ghost tgc-all" data-tgc-allbtn>Все каналы и добавить свой ›</button>' : `
          <form class="tgc-add" data-tgc-form autocomplete="off">
            <label class="tgc-add-l"><span>Добавить канал</span><input class="input" data-tgc-in placeholder="@username или ссылка t.me/…" inputmode="url" spellcheck="false" aria-label="Ссылка на канал или @username"></label>
            <button type="submit" class="btn primary">＋ Добавить</button>
          </form>
          <p class="tgc-privacy">🔒 В список попадают только открытые каналы с публичной ссылкой. Ваши личные чаты не показываются никому.</p>
          ${this.curated().length ? `<div class="tgc-owner"><span>🧭 Ваш выбор: <b>${this.curated().length}</b> — пока виден только вам.</span><button type="button" class="btn sm" data-tgc-export>⬇ Экспорт списка</button></div>` : ''}`}`;
      let filter = 'all';
      const draw = async () => {
        const all = await this.list();
        const list = o.compact ? all.slice(0, 4) : all.filter(c => filter === 'all' || c.category === filter);
        const fl = el.querySelector('[data-tgcf]');
        const used = new Set(all.map(c => c.category));
        if (fl) {
          fl.hidden = o.compact || all.length < 4 || used.size < 2;
          if (!fl.hidden) fl.innerHTML = [['all', '', 'все']].concat(CATS.filter(([k]) => used.has(k))).map(([k, i, t]) => `<button type="button" class="chip ${filter === k ? 'active' : ''}" data-tgc-f="${k}">${i} ${t}</button>`).join('');
        }
        const box = el.querySelector('[data-tgcl]');
        box.innerHTML = list.length ? list.map(c => this.cardHtml(c)).join('') : all.length ? '<div class="small muted">В этой категории пока пусто.</div>' : o.compact ? `<div class="tgc-empty sm"><span aria-hidden="true">🔎</span><span>Найдите каналы в Telegram по словам <b>«norsk»</b> или <b>«Норвегия язык»</b> — и добавьте ссылку в разделе Telegram.</span></div>` : this.emptyHtml();
        const ab = el.querySelector('[data-tgc-allbtn]'); if (ab) ab.textContent = all.length > 4 ? `Все каналы (${all.length}) и добавить свой ›` : 'Добавить свой канал ›';
      };
      el._tgcDraw = draw;
      if (!el._tgcBound) {
        el._tgcBound = true;
        el.addEventListener('click', async e => {
          const f = e.target.closest('[data-tgc-f]'); if (f) { filter = f.dataset.tgcF; draw(); return; }
          const add = e.target.closest('[data-tgc-add]');
          if (add) {
            this.addToApp(add.dataset.tgcAdd);
            UI.toast(AI.bridge.up ? `Канал @${add.dataset.tgcAdd} добавлен — его посты теперь ищутся во вкладках «Найти по слову» и «Создать карточки из чата»` : `Канал @${add.dataset.tgcAdd} добавлен. Читать его прямо в приложении можно на компьютере с подключённым Telegram — а пока он откроется в самом Телеграме`, 'good', 6000);
            el._tgcDraw(); return;
          }
          const out = e.target.closest('[data-tgc-out]');
          if (out) { this.removeFromApp(out.dataset.tgcOut); UI.toast(`Канал @${out.dataset.tgcOut} больше не источник карточек`, '', 3000); el._tgcDraw(); return; }
          const del = e.target.closest('[data-tgc-del]');
          if (del) {
            const u = del.dataset.tgcDel, was = this.added(u);
            const card = del.closest('.tgc-card'); if (card) card.classList.add('gone');
            lsSet(HIDE_KEY, [...this.hidden(), lower(u)]);
            lsSet(MINE_KEY, (ls(MINE_KEY, []) || []).filter(c => lower(c.username || '') !== lower(u)));
            if (was) this.removeFromApp(u);
            setTimeout(() => el._tgcDraw(), reduce() ? 0 : 220);
            UI.toastAction(`Канал @${u} убран`, '↶ Вернуть', () => { lsSet(HIDE_KEY, [...this.hidden()].filter(x => x !== lower(u))); if (was) this.addToApp(u); el._tgcDraw(); }, 7000, '🙈');
            return;
          }
          if (e.target.closest('[data-tgc-open]')) patch({ used: state().used || Date.now() });
          if (e.target.closest('[data-tgc-pick]')) { this.curate(() => this.render(el, o)); return; }
          if (e.target.closest('[data-tgc-export]')) { this.exportList(); return; }
          if (e.target.closest('[data-tgc-allbtn]')) { if (o.onAll) o.onAll(); else Telegram.open(null, 'channels'); }
        });
        el.addEventListener('submit', e => {
          const form = e.target.closest('[data-tgc-form]'); if (!form) return;
          e.preventDefault();
          const inp = form.querySelector('[data-tgc-in]');
          const u = parseUser(inp.value);
          if (!u) { UI.toast(/joinchat|\/\+/.test(inp.value) ? 'Это ссылка-приглашение в закрытую группу — добавить можно только открытые каналы' : 'Вставьте ссылку t.me/… или @имя канала', 'warn', 4500); inp.focus(); return; }
          const mine = (ls(MINE_KEY, []) || []).filter(c => lower(c.username || '') !== lower(u));
          mine.unshift({ username: u, title: '@' + u, about: '', category: 'lessons', members: 0 });
          lsSet(MINE_KEY, mine.slice(0, 200));
          lsSet(HIDE_KEY, [...this.hidden()].filter(x => x !== lower(u)));
          this.addToApp(u);
          inp.value = '';
          UI.toast(`Канал @${u} добавлен`, 'good', 3000);
          el._tgcDraw();
        });
      }
      await draw();
    },
    /** the short block in «Что вы хотите выучить?» */
    mini(el, onAll) { return this.render(el, { compact: true, onAll }); },

    /* ---------------- 🧭 the owner's tool ---------------- */
    async curate(onDone) {
      const m = UI.modal({
        title: '🧭 Подобрать норвежские каналы', cls: 'wide tgcur-modal',
        body: `<p class="tgc-privacy">🔒 В список попадают только открытые каналы с публичной ссылкой. Ваши личные чаты не показываются никому.</p>
          <div data-cur><div class="small muted"><span class="spinner sm"></span> читаю ваши каналы и группы…</div></div>`,
        foot: `<span class="small muted grow" data-curn></span><button type="button" class="btn" data-cur-export disabled>⬇ Экспорт списка</button><button type="button" class="btn primary" data-cur-save disabled>💾 Сохранить выбор</button>`,
      });
      const box = m.$('[data-cur]');
      let rows = [];
      try {
        const r = await fetch('/api/tg/dialogs');
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Telegram не ответил');
        // ONLY public channels / groups: a @username is a must; personal chats and bots never (whatever the server sends)
        rows = (j.dialogs || []).filter(d => d && (!d.kind || d.kind === 'channel' || d.kind === 'group') && !d.bot && !d.user && okUser(d.username) && d.public !== false)
          .map(d => ({ id: d.id, username: d.username, title: Store.Safe.text(String(d.name || ''), 200).trim(), count: +d.count || 0, group: !!d.group, about: '' }));
      } catch (e) {
        box.innerHTML = `<div class="mt-warn"><span>⚠️</span><span>Не удалось прочитать ваши каналы: ${esc(e.message)}. Проверьте, что Telegram подключён (вкладка «Каналы и аккаунт»).</span></div>`;
        return m;
      }
      const prev = new Map(this.curated().map(c => [lower(c.username), c]));
      const guessCat = s => (/vide|видео|youtube|film|tv\b/i.test(s) ? 'video' : /nyhet|news|новост/i.test(s) ? 'news' : /\bord|glos|слов|vocab|lexi/i.test(s) ? 'words' : /chat|prat|чат|общен|клуб|group|групп/i.test(s) ? 'chat' : 'lessons');
      const score = r => { const t = `${r.title} ${r.about} ${r.username}`; return STRONG.test(t) ? 2 : WEAK.test(t) ? 1 : 0; };
      rows.forEach(r => {
        const p = prev.get(lower(r.username));
        r.on = !!p; r.cat = p ? p.category : guessCat(`${r.title} ${r.username}`); r.desc = p ? p.about : '';
        r.s = score(r);
      });
      let showAll = false, q = '', aboutState = 'wait';
      const visible = () => rows.filter(r => (showAll || r.s > 0 || r.on) && (!q || `${r.title} ${r.username} ${r.about}`.toLowerCase().includes(q)));
      const rowHtml = r => {
        const i = rows.indexOf(r);
        return `<div class="tgcur-row ${r.on ? 'on' : ''}" data-i="${i}" style="--h:${hue(r.username)}">
            <label class="tgcur-pick"><input type="checkbox" data-cur-on="${i}" ${r.on ? 'checked' : ''} aria-label="Включить в список"><span class="tgc-ava" aria-hidden="true">${esc((r.title.replace(/[^\p{L}\p{N}]/gu, '')[0] || r.username[0]).toUpperCase())}</span>
              <span class="tgcur-name"><b>${esc(r.title || '@' + r.username)}</b><small>@${esc(r.username)} · ${r.group ? 'группа' : 'канал'}${r.count ? ` · 👥 ${numRu(r.count)}` : ''} ${r.s === 2 ? '<span class="tgcur-tag">⭐ норвежский</span>' : r.s === 1 ? '<span class="tgcur-tag weak">возможно</span>' : ''}</small></span></label>
            ${r.about ? `<p class="tgcur-about">${esc(r.about.slice(0, 240))}</p>` : ''}
            <div class="tgcur-edit" ${r.on ? '' : 'hidden'}>
              <label class="field"><span>Коротко по-русски — чем полезен</span><input class="input" data-cur-desc="${i}" maxlength="200" value="${esc(r.desc)}" placeholder="Например: короткие уроки грамматики и слова дня"></label>
              <label class="field"><span>Категория</span><select class="input" data-cur-cat="${i}">${CATS.map(([k, ic, t]) => `<option value="${k}" ${r.cat === k ? 'selected' : ''}>${ic} ${t}</option>`).join('')}</select></label>
            </div>
          </div>`;
      };
      const count = () => {
        const n = rows.filter(r => r.on).length;
        m.$('[data-curn]').textContent = n ? `Выбрано: ${n}` : 'Отметьте каналы для списка';
        m.$('[data-cur-save]').disabled = false;
        m.$('[data-cur-export]').disabled = !n;
      };
      const draw = () => {
        const v = visible(), strong = rows.filter(r => r.s > 0).length;
        box.innerHTML = `<div class="tgcur-tools">
            <span class="seg-mini sm" role="group" aria-label="Что показать"><button type="button" data-cur-all="0" class="${showAll ? '' : 'active'}">⭐ Похожие на норвежские (${strong})</button><button type="button" data-cur-all="1" class="${showAll ? 'active' : ''}">Все открытые (${rows.length})</button></span>
            <input class="input" type="search" data-cur-q placeholder="🔎 Найти" value="${esc(q)}" aria-label="Найти канал">
          </div>
          ${aboutState === 'old' ? '<div class="mt-warn"><span>ℹ️</span><span>Описания каналов появятся, когда мост на Mac будет перезапущен (новая версия).</span></div>' : aboutState === 'wait' ? '<div class="small muted"><span class="spinner sm"></span> читаю описания каналов…</div>' : ''}
          <div class="tgcur-list">${v.length ? v.map(rowHtml).join('') : `<div class="tgc-empty sm"><span aria-hidden="true">🤷</span><span>${rows.length ? 'Похожих на норвежские не нашлось — посмотрите «Все открытые».' : 'У вас нет открытых каналов и групп. Подпишитесь на норвежские каналы в Telegram — и они появятся здесь.'}</span></div>`}</div>`;
        const qi = box.querySelector('[data-cur-q]');
        qi.addEventListener('input', () => { readEdits(); q = qi.value.trim().toLowerCase(); const pos = qi.selectionStart; draw(); const n = box.querySelector('[data-cur-q]'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } });
        count();
      };
      draw();
      // descriptions + member counts — only for the public ones (the bridge refuses the others too)
      (async () => {
        const ids = rows.map(r => r.id);
        try {
          for (let k = 0; k < ids.length; k += 40) {
            const r = await fetch('/api/tg/about?ids=' + ids.slice(k, k + 40).join(','));
            if (r.status === 404) { aboutState = 'old'; break; }
            const j = await r.json().catch(() => ({}));
            const a = j.about || {};
            rows.forEach(x => { const v = a[String(x.id)]; if (v && !v.error) { x.about = Store.Safe.text(String(v.about || ''), 600).trim(); if (v.count) x.count = +v.count; x.s = score(x); } });
            aboutState = 'done';
          }
        } catch (e) { aboutState = 'done'; }
        if (aboutState === 'wait') aboutState = 'done';
        if (m.el.isConnected) { readEdits(); draw(); }
      })();
      const readEdits = () => {
        box.querySelectorAll('[data-cur-desc]').forEach(i => { rows[+i.dataset.curDesc].desc = i.value; });
        box.querySelectorAll('[data-cur-cat]').forEach(s => { rows[+s.dataset.curCat].cat = s.value; });
      };
      const selection = () => {
        readEdits();
        return rows.filter(r => r.on).map(r => clean({ username: r.username, title: r.title, about: (r.desc || '').trim() || r.about.slice(0, 200), category: r.cat, members: r.count })).filter(Boolean);
      };
      box.addEventListener('change', e => {
        const c = e.target.closest('[data-cur-on]');
        if (c) {
          const r = rows[+c.dataset.curOn]; r.on = c.checked;
          const row = c.closest('.tgcur-row'); row.classList.toggle('on', r.on); row.querySelector('.tgcur-edit').hidden = !r.on;
          if (r.on && !r.desc) { const d = row.querySelector('[data-cur-desc]'); if (d) setTimeout(() => d.focus(), 30); }
          count();
        }
      });
      box.addEventListener('click', e => { const a = e.target.closest('[data-cur-all]'); if (a) { readEdits(); showAll = a.dataset.curAll === '1'; draw(); } });
      m.$('[data-cur-save]').onclick = () => {
        const list = selection();
        lsSet(CUR_KEY, list);
        UI.toast(list.length ? `Сохранено: ${list.length}. Чтобы список увидели все — «Экспорт списка»` : 'Выбор очищен', 'good', 5000);
        m.close(); if (onDone) onDone();
      };
      m.$('[data-cur-export]').onclick = () => { const list = selection(); lsSet(CUR_KEY, list); this.exportList(list); };
      return m;
    },
    /** ⬇ tg-channels.json — the owner puts it into data/ of the app */
    exportList(list) {
      list = (list || this.curated()).map(clean).filter(Boolean).map(({ username, title, about, category, members }) => ({ username, title, about, category, members }));
      if (!list.length) { UI.toast('Сначала отметьте каналы', 'warn'); return; }
      U.download('tg-channels.json', JSON.stringify(list, null, 2) + '\n', 'application/json');
      UI.toast(`Скачан tg-channels.json (${list.length}). Положите его в папку data приложения — список увидят все`, 'good', 7000);
    },

    /* ---------------- the intro: a paper plane and chat bubbles ---------------- */
    intro() {
      patch({ intro: state().intro || Date.now() });
      if (window.Guides) Guides.setOff('tg-intro');
      const auth = !!(Telegram.status && Telegram.status.authorized);
      const m = UI.modal({
        title: '', cls: 'narrow tgi-intro',
        body: `<div class="tgi-stage ${reduce() ? 'still' : ''}" aria-hidden="true">
            <span class="tgi-ring r1"></span><span class="tgi-ring r2"></span>
            <svg class="tgi-svg" viewBox="0 0 260 160">
              <defs>
                <linearGradient id="tgiP" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9efff"/></linearGradient>
                <linearGradient id="tgiC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#37bbfe"/><stop offset="1" stop-color="#1d8fd8"/></linearGradient>
                <radialGradient id="tgiS" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
              </defs>
              <path class="tgi-trail" d="M8 136 C 60 128, 80 70, 140 66 S 220 36, 258 8" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2.2" stroke-dasharray="2 9" stroke-linecap="round"/>
              <g transform="translate(130 82)"><g class="tgi-logo">
                <circle cx="0" cy="0" r="34" fill="url(#tgiC)"/><circle cx="0" cy="0" r="34" fill="url(#tgiS)"/>
                <path d="M-17-1.6 15-14.1c1.5-.6 2.9.3 2.4 2.5l-5.5 25.8c-.4 1.8-1.5 2.2-3.1 1.3l-8.4-6.2-4.1 3.9c-.4.4-.9.9-1.8.9l.7-8.6 15.4-14c.7-.7-.1-1-1.1-.4l-19 12-8.2-2.5c-1.8-.6-1.8-1.8.4-2.6z" fill="url(#tgiP)"/>
              </g></g>
              <g class="tgi-fly"><path d="M-12-1 10-9.6c1-.4 2 .2 1.7 1.8l-3.8 18c-.3 1.2-1.1 1.5-2.1.9l-5.9-4.3-2.8 2.7c-.3.3-.6.6-1.2.6l.5-6 10.7-9.7c.5-.5-.1-.7-.8-.3L-6.3 1.8-12 0c-1.2-.4-1.2-1.2.3-1.8z" fill="#fff"/></g>
            </svg>
            <span class="tgi-bub b1"><span class="tgi-flag">🇳🇴</span> Hei!</span>
            <span class="tgi-bub b2 me"><span class="tgi-flag">🇷🇺</span> Привет!</span>
            <span class="tgi-bub b3"><span class="tgi-flag">🇳🇴</span> et ord ✨</span>
          </div>
          <h2 class="tgi-h">Норвежский из Телеграма — прямо в карточки</h2>
          <ul class="tgi-list">
            <li><span aria-hidden="true">📢</span><span><b>Канал</b> — это как журнал в Телеграме: автор пишет посты, вы читаете. Есть каналы, где каждый день учат норвежский.</span></li>
            <li><span aria-hidden="true">🔎</span><span><b>Как найти:</b> в поиске Телеграма напишите «norsk» или «Норвегия язык». Или откройте наш список «Норвежские каналы».</span></li>
            <li><span aria-hidden="true">🃏</span><span><b>Что делает приложение:</b> находит в постах слова и фразы с переводом и делает из них карточки. Каждую пару сверяет с переводчиком — ошибки авторов отсеиваются.</span></li>
            <li><span aria-hidden="true">🎬</span><span><b>Скоро:</b> видео авторов с субтитрами и «слушать автора» — в наушниках.</span></li>
            <li><span aria-hidden="true">🔐</span><span><b>Что нужно:</b> один раз подключить свой Telegram. Ключи хранятся только на вашем устройстве, в защищённом месте. Приложение только читает — ничего не пишет от вашего имени.</span></li>
          </ul>`,
        foot: `<button type="button" class="btn ghost" data-tgi="ok">Понятно</button>${auth ? '<button type="button" class="btn primary lg tgi-cta" data-tgi="list">📢 Норвежские каналы</button>' : `<button type="button" class="btn primary lg tgi-cta" data-tgi="login">${TG(20)} Подключить Telegram</button>`}`,
      });
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-tgi]'); if (!b) return;
        m.close();
        if (b.dataset.tgi === 'login') Telegram.loginWizard(() => { patch({ used: Date.now() }); });
        if (b.dataset.tgi === 'list') { const t = document.querySelector('#modal-root .tg-modal [data-tgtab="channels"]'); if (t) t.click(); else Telegram.open(null, 'channels'); }
      });
      return m;
    },
    firstVisit() {
      if (state().intro || (window.Help && Help.touring)) return;
      setTimeout(() => { if (!state().intro && !(window.Help && Help.touring) && document.querySelector('#modal-root .tg-modal')) this.intro(); }, 450);
    },
    /** the soft reminder: after the intro, until Telegram is really used — a dot + a bubble ≤ once a day, ≤ 5 times */
    remind() {
      const s = state();
      if (!s.intro || s.used || (window.Guides && Guides.off('tg-remind'))) return;
      const anchor = () => [document.querySelector('.sidebar [data-sb="telegram"]'), document.querySelector('#view [data-act="telegram"]')]
        .find(b => b && b.getBoundingClientRect().width && b.getBoundingClientRect().top > 0 && b.getBoundingClientRect().bottom < innerHeight - 60);
      document.querySelectorAll('.sidebar [data-sb="telegram"], #view [data-act="telegram"]').forEach(b => b.classList.add('tgr-new'));
      const now = Date.now(), day = 20 * 3600e3;
      if ((s.shown || 0) >= 5 || (s.last && now - s.last < day) || now - s.intro < day / 2) return;
      let tries = 0;
      const t = setInterval(() => {
        if (++tries > 120) { clearInterval(t); return; }
        if (!(App.view && App.view.name === 'home') || modalOpen() || (window.Help && Help.touring) || document.querySelector('.lt-hint, .hc-hint, .tgr-hint')) return;
        const b = anchor(); if (!b) return;
        clearInterval(t);
        patch({ shown: (state().shown || 0) + 1, last: Date.now() });
        const tip = document.createElement('div');
        tip.className = 'tgr-hint'; tip.setAttribute('role', 'status');
        tip.innerHTML = `<span class="tgr-txt">${TG(20)}<span>В Телеграме много <b>норвежских каналов</b>. Приложение превращает их посты в карточки — и проверяет перевод.</span></span>
          <span class="tgr-act"><button type="button" class="btn sm primary" data-tgr="go">Показать</button><button type="button" class="btn sm ghost" data-tgr="never">Больше не напоминать</button></span>`;
        document.body.appendChild(tip);
        const place = () => {
          if (!tip.isConnected) return;
          const r = b.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
          const left = Math.max(10, Math.min(innerWidth - w - 10, r.left + r.width / 2 - w / 2));
          const below = r.bottom + 12 + h < innerHeight - 10;
          tip.classList.toggle('above', !below);
          tip.style.left = left + 'px'; tip.style.top = (below ? r.bottom + 12 : r.top - 12 - h) + 'px';
          tip.style.setProperty('--arrow', Math.max(16, Math.min(w - 16, r.left + r.width / 2 - left)) + 'px');
        };
        place(); requestAnimationFrame(place);
        window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
        const gone = () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); tip.classList.add('out'); setTimeout(() => tip.remove(), 300); };
        tip.addEventListener('click', e => {
          const x = e.target.closest('[data-tgr]'); if (!x) return;
          gone();
          if (x.dataset.tgr === 'go') Telegram.open(null, 'channels');
          else { if (window.Guides) Guides.setOff('tg-remind'); document.querySelectorAll('.tgr-new').forEach(n => n.classList.remove('tgr-new')); UI.toast('Хорошо. Telegram — на главной и в меню слева', '', 3500); }
        });
        setTimeout(() => { if (tip.isConnected) gone(); }, 14000);
      }, 1000);
    },
  };

  /* ---------------- into the Telegram window: the «📢 Норвежские каналы» tab + the intro on the first visit ---------------- */
  Telegram.tab_channels = function (el) { TgChan.render(el); };
  const open0 = Telegram.open;
  Telegram.open = async function (...a) {
    const r = await open0.apply(this, a);
    try { if (this.status && this.status.authorized) patch({ used: state().used || Date.now() }); TgChan.firstVisit(); } catch (e) { console.warn('tg intro', e); }
    return r;
  };
  // the home screen is drawn again and again: the reminder dot comes back with it
  const boot = () => setTimeout(() => {
    try { TgChan.remind(); } catch (e) { console.warn('tg remind', e); }
    const v = document.getElementById('view');
    const mo = new MutationObserver(() => { const s = state(); if (s.intro && !s.used && !(window.Guides && Guides.off('tg-remind'))) document.querySelectorAll('.sidebar [data-sb="telegram"]:not(.tgr-new), #view [data-act="telegram"]:not(.tgr-new)').forEach(b => b.classList.add('tgr-new')); else document.querySelectorAll('.tgr-new').forEach(b => b.classList.remove('tgr-new')); });
    [v, document.getElementById('sidebar')].forEach(n => { if (n) mo.observe(n, { childList: true }); });
  }, 6000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.TgChan = TgChan;
})();
