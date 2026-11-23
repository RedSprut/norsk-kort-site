/* ============ 🤖 «Нейросети» — the chooser of every AI the app supports (js/aichooser.js) ============
 * A tap / click on the AI button of the top bar (#claude-badge) or on «Нейросеть» in the phone's «Меню» sheet
 * (both data-action="ai-menu", js/app.js) opens it:
 *  - on top: «🤖 Что умеет нейросеть» (AIHub.open) and, while a check runs, its progress;
 *  - the connected ones (✓ сейчас / подключена) — a tap makes it the active one;
 *  - the rest («подключить», free ones marked «бесплатно») — a tap opens ⚙️ Настройки right at that service,
 *    opened, scrolled into view and highlighted.
 * Desktop: a dropdown anchored under the button (the look of the hover fan); arrows / Home / End / Esc, Tab stays inside.
 * Phones (html.m-phone): a bottom sheet (Mobile.sheet: pull down, ✕, Back, Esc).
 * Back / Esc everywhere: js/nav.js (the dropdown is a .popover with _close).
 */
(function () {
  'use strict';
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const html = document.documentElement;
  const esc = s => U.esc(s);
  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const phone = () => html.classList.contains('m-phone') && !!(window.Mobile && Mobile.sheet);
  // the order of the «подключить» list: the recommended free ones first, then the other free ones, then the paid ones
  const FIRST = ['gemini', 'groq'];

  const conf = id => { try { return AI.configured(id); } catch (e) { return false; } };
  /* 💻 / 🔑 a small badge on the logo: a subscription through the Mac bridge vs a paid-per-request (or free) API key —
     only where the same company has both (Claude, ChatGPT, Gemini) */
  const BADGE_SVG = {
    mac: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.2" y="3" width="11.6" height="7.6" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M1 12.6h14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    key: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="5.3" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.2 8h6.3M12.2 8v2.4M14.3 8v1.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  };
  const TIPS = {
    claude: 'Claude по вашей подписке Pro/Max — через Claude Code на этом Mac (мост). Без ключа и без оплаты за запросы. Работает только в приложении на Mac.',
    anthropic: 'Claude по API-ключу Anthropic — оплата за каждый запрос. Работает везде, и на iPhone.',
    chatgpt: 'ChatGPT по вашей подписке (Plus, Pro, Business, Edu, Enterprise) — через программу OpenAI Codex на этом Mac (мост). Без ключа и без оплаты за запросы. Только на Mac.',
    openai: 'ChatGPT по API-ключу OpenAI — оплата за каждый запрос. Работает везде, и на iPhone.',
    'gemini-cli': 'Gemini через ваш аккаунт Google — бесплатно, с лимитом Google. Через программу Google Antigravity CLI на этом Mac (мост). Только на Mac.',
    gemini: 'Gemini по бесплатному ключу Google AI Studio — работает везде, и на iPhone.',
  };
  const badgeOf = id => {
    const p = AI.PROVIDERS[id]; if (!p) return '';
    if (p.sub) return 'mac';
    return Object.keys(AI.PROVIDERS).some(k => AI.PROVIDERS[k].twin === id) ? 'key' : '';
  };
  const logo = (id, cls = '') => {
    const p = AI.PROVIDERS[id] || {};
    const coin = window.App && App.aiLogo ? App.aiLogo(id, ' aic-logo' + cls) : `<span class="aic-logo">${BOT(20)}</span>`;
    const b = badgeOf(id);
    return b ? `<span class="aic-lw">${coin}<i class="aic-bdg ${b}" aria-hidden="true">${BADGE_SVG[b]}</i></span>` : coin;
  };
  /** «Groq (GPT-OSS, Qwen, Llama)» → { t: 'Groq', s: 'GPT-OSS, Qwen, Llama' } */
  function names(id) {
    const p = AI.PROVIDERS[id];
    if (id === 'claude') return { t: 'Claude · подписка', s: 'Pro/Max · через Claude Code на Mac, без ключа' };
    if (id === 'anthropic') return { t: 'Claude · по ключу', s: 'API-ключ Anthropic, оплата за запросы' };
    if (id === 'chatgpt') return { t: 'ChatGPT · подписка', s: 'Plus/Pro · через Codex на Mac, без ключа' };
    if (id === 'openai') return { t: 'ChatGPT · по ключу', s: 'API-ключ OpenAI, оплата за запросы' };
    if (id === 'gemini-cli') return { t: 'Gemini · аккаунт Google', s: 'бесплатно с лимитом · через Antigravity на Mac' };
    if (id === 'gemini') return { t: 'Gemini · по ключу', s: 'бесплатный ключ Google AI Studio' };
    const m = /^(.*?)\s*(?:\((.+)\)|—\s*(.+))$/.exec(p.name);
    return m ? { t: m[1], s: m[2] || m[3] } : { t: p.name, s: '' };
  }

  function lists() {
    const P = AI.PROVIDERS, cur = AI.available() ? AI.current() : null;
    const ids = Object.keys(P);
    // subscriptions (Claude, ChatGPT, Gemini by account) first in both lists
    const sub = id => (P[id].sub ? 1 : 0);
    const on = ids.filter(conf).sort((a, b) => ((b === cur) - (a === cur)) || (sub(b) - sub(a)));
    const off = ids.filter(id => !conf(id)).sort((a, b) => {
      const r = id => (P[id].sub ? -10 + ids.indexOf(id) / 100 : FIRST.includes(id) ? FIRST.indexOf(id) : P[id].free ? 10 : id === 'custom' ? 30 : 20);
      return r(a) - r(b);
    });
    return { cur, on, off };
  }

  function row(id, cur) {
    const p = AI.PROVIDERS[id], n = names(id), ok = conf(id), isCur = id === cur;
    const tag = isCur ? '<span class="aic-tag cur">✓ сейчас</span>'
      : ok ? '<span class="aic-tag ok">подключена</span>'
        : `${p.free ? '<span class="aic-free">бесплатно</span>' : ''}<span class="aic-tag add">подключить</span>`;
    const hint = isCur ? 'Работает сейчас' : ok ? 'Сделать активной' : p.cli ? 'Подключить — пошаговое окно' : `Подключить — откроются Настройки${p.limits ? ' · ' + p.limits : ''}`;
    const s = p.cli && AI.cliState ? AI.cliState(p.cli) : null;
    const rest = p.cli && ok && AI.resting && AI.resting(id) ? '<span class="aic-tag rest">лимит</span>' : '';
    return `<button type="button" class="aic-row ${isCur ? 'cur' : ok ? 'ok' : 'no'}" data-aic="${ok ? 'pick' : 'connect'}" data-id="${esc(id)}"
      title="${esc(`${n.t} — ${hint}${TIPS[id] ? '\n' + TIPS[id] : ''}`)}"${isCur ? ' aria-current="true"' : ''}${s && s.installed && !ok ? ' data-half="1"' : ''}>
      ${logo(id, isCur ? ' cur' : ok ? ' ok' : ' no')}
      <span class="aic-t"><b>${esc(n.t)}</b>${n.s ? `<small>${esc(n.s)}</small>` : ''}</span>
      <span class="aic-tags">${rest}${tag}</span></button>`;
  }

  function bodyHtml() {
    const { cur, on, off } = lists();
    let top = '';
    if (window.AIHub && AIHub.open) {
      top += `<button type="button" class="aic-row aic-hub" data-aic="hub"><span class="aic-ico" aria-hidden="true">${BOT(24)}</span>
        <span class="aic-t"><b>Что умеет нейросеть</b><small>Центр нейросети · проверка колод, советы</small></span><span class="aic-chev" aria-hidden="true">›</span></button>`;
      let st = null; try { st = AIHub.state && AIHub.state(); } catch (e) { st = null; }
      if (st && st.run) {
        const pct = st.total ? Math.round(st.done / st.total * 100) : 0;
        top += `<button type="button" class="aic-row aic-run" data-aic="run"><span class="aic-ico" aria-hidden="true">${st.live ? '⏳' : '⏸'}</span>
          <span class="aic-t"><b>Проверка нейросетью: ${pct}%</b><small>${st.live ? 'идёт — открыть' : 'на паузе — открыть'}</small>
          <i class="aic-bar" aria-hidden="true"><i style="width:${pct}%"></i></i></span><span class="aic-chev" aria-hidden="true">›</span></button>`;
      }
    }
    return `${top ? `<div class="aic-sec aic-top">${top}</div>` : ''}
      ${on.length ? `<div class="aic-h" id="aic-h-on">Подключены · ${on.length}</div>
        <div class="aic-sec" role="group" aria-labelledby="aic-h-on">${on.map(id => row(id, cur)).join('')}</div>` : ''}
      <div class="aic-h" id="aic-h-off">${on.length ? 'Подключить ещё' : 'Подключить нейросеть'} · ${off.length}</div>
      ${on.length ? '' : '<p class="aic-lead">Ни одна не подключена. <b>Gemini</b> и <b>Groq</b> — бесплатно, нужен только ключ (пара минут).</p>'}
      <div class="aic-sec" role="group" aria-labelledby="aic-h-off">${off.map(id => row(id, cur)).join('')}</div>
      <button type="button" class="aic-foot" data-aic="settings">⚙️ Все настройки нейросетей</button>`;
  }

  /* ---------------- what a row does ---------------- */
  function act(b) {
    const k = b.dataset.aic, id = b.dataset.id;
    if (k === 'hub') return AIHub.open();
    if (k === 'run') return AIHub.showRun();
    if (k === 'settings') return toSettings(null);
    if (k === 'connect') return AI.PROVIDERS[id] && AI.PROVIDERS[id].cli ? connectCli(id) : toSettings(id);
    if (k === 'pick') {
      const p = AI.PROVIDERS[id];
      Store.setSetting('aiProvider', id); App.updateBadge(); App.render();
      UI.toast('Теперь карточки проверяет: ' + p.name, 'good');
    }
  }

  /** ⚙️ Настройки, opened right at one service: its block is opened, scrolled to the middle and lit up for a moment */
  function toSettings(id) {
    if (window.App.view.name === 'settings') App.render(); else App.goAsk('settings');
    if (!id) return;
    const t0 = Date.now();
    const find = () => {
      const btn = App.view.name === 'settings' && document.querySelector(`#view details.prov [data-act="test-prov"][data-id="${CSS.escape(id)}"]`);
      const d = btn && btn.closest('details.prov');
      if (!d) { if (Date.now() - t0 < 8000) setTimeout(find, 120); return; } // a session asks «Закончить занятие?» first
      document.querySelectorAll('#view details.prov[open]').forEach(x => { if (x !== d) x.open = false; });
      d.open = true;
      d.classList.remove('aic-flash'); void d.offsetWidth; d.classList.add('aic-flash');
      clearTimeout(d._aicT); d._aicT = setTimeout(() => d.classList.remove('aic-flash'), 2800);
      // after App.go's own «scroll to the top» has started: ours wins
      hold(d);
      setTimeout(() => {
        d.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' });
        const inp = d.querySelector('input[data-ai$=".key"], input[data-ai$=".base"]');
        // a computer: the cursor waits in the key field; a phone: no keyboard popping up over the instructions
        if (inp && !inp.value && !phone()) { try { inp.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
        else { const s = d.querySelector('summary'); if (s) try { s.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      }, 90);
    };
    setTimeout(find, 60);
  }

  /** the first-visit tips of ⚙️ Настройки (js/coachmarks.js) wait while the person connects the service they came for:
   *  a quiet marker it counts as «something on screen» (.nk-here) — gone after 15 s unless the focus is still in that block */
  function hold(d) {
    let m = document.querySelector('body > .aic-hold');
    if (!m) { m = document.createElement('i'); m.className = 'nk-here aic-hold'; m.hidden = true; m.setAttribute('aria-hidden', 'true'); document.body.appendChild(m); }
    const t0 = Date.now();
    clearInterval(hold._t);
    hold._t = setInterval(() => {
      const busy = App.view.name === 'settings' && d.isConnected && (Date.now() - t0 < 15000 || d.contains(document.activeElement));
      if (!busy || Date.now() - t0 > 180000) { clearInterval(hold._t); m.remove(); }
    }, 1000);
  }

  /* ---------------- desktop: the dropdown under the button ---------------- */
  let pop = null;
  function closePop(restore = true) {
    if (!pop) return;
    const p = pop; pop = null;
    document.removeEventListener('pointerdown', p._outside, true);
    window.removeEventListener('resize', p._place);
    if (p._anchor) p._anchor.setAttribute('aria-expanded', 'false');
    p.classList.add('out');
    setTimeout(() => p.remove(), reduce() ? 0 : 160);
    if (restore && p._anchor && p._anchor.isConnected) { try { p._anchor.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  function openPop(anchor) {
    document.querySelectorAll('.dropdown-menu').forEach(m => m.remove());
    document.querySelectorAll('.popover').forEach(p => (p._close ? p._close(false) : p.remove()));
    const el = document.createElement('div');
    el.className = 'popover aic-pop' + (reduce() ? ' aic-still' : '');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Выбор нейросети');
    el.innerHTML = `<div class="aic-head"><span>Нейросети в приложении · ${Object.keys(AI.PROVIDERS).length}</span>
      <button type="button" class="aic-x" data-aic-close aria-label="Закрыть" title="Закрыть (Esc)">✕</button></div>
      <div class="aic-scroll">${bodyHtml()}</div>`;
    document.body.appendChild(el);
    pop = el; el._anchor = anchor;
    el._close = (restore) => closePop(restore !== false); // Back / Esc (js/nav.js)
    anchor.setAttribute('aria-haspopup', 'dialog');
    anchor.setAttribute('aria-expanded', 'true');
    const place = () => {
      const r = anchor.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
      const w = Math.min(400, vw - 24);
      el.style.width = w + 'px';
      const visible = r.width > 0 && r.bottom > 0 && r.top < vh;
      const left = visible ? Math.min(vw - w - 12, Math.max(12, r.right - w)) : (vw - w) / 2;
      const top = visible ? r.bottom + 12 : 72;
      el.style.left = left + 'px'; el.style.top = top + 'px';
      el.style.setProperty('--aic-max', Math.max(220, vh - top - 16) + 'px');
      el.style.setProperty('--arrow-x', (visible ? Math.min(w - 22, Math.max(22, r.left + r.width / 2 - left)) : w / 2) + 'px');
    };
    place();
    el._place = place;
    window.addEventListener('resize', place);
    el._outside = e => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePop(false); };
    setTimeout(() => { if (pop === el) document.addEventListener('pointerdown', el._outside, true); }, 0);
    el.addEventListener('click', e => {
      if (e.target.closest('[data-aic-close]')) { closePop(); return; }
      const b = e.target.closest('[data-aic]'); if (!b) return;
      e.stopPropagation();
      closePop(false);
      act(b);
    });
    el.addEventListener('keydown', e => {
      const rows = [...el.querySelectorAll('.aic-row, .aic-foot, .aic-x')].filter(x => x.offsetParent !== null);
      const i = rows.indexOf(document.activeElement);
      const to = k => { const t = rows[(k + rows.length) % rows.length]; if (t) { e.preventDefault(); t.focus(); } };
      if (e.key === 'ArrowDown') to(i + 1);
      else if (e.key === 'ArrowUp') to(i < 0 ? rows.length - 1 : i - 1);
      else if (e.key === 'Home') to(0);
      else if (e.key === 'End') to(rows.length - 1);
      else if (e.key === 'Tab') { e.preventDefault(); to(e.shiftKey ? (i < 0 ? rows.length - 1 : i - 1) : i + 1); }
    });
    const first = el.querySelector('.aic-row.cur') || el.querySelector('.aic-row');
    requestAnimationFrame(() => { if (first && pop === el) try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } });
  }

  /* ---------------- phones: a bottom sheet ---------------- */
  function openSheet() {
    Mobile.sheet({
      title: `${BOT(22)} Нейросети`, body: `<div class="aic-sheet-in">${bodyHtml()}</div>`, cls: 'aic-sheet', detent: 'large',
      onClick(e, sh) {
        const b = e.target.closest('[data-aic]'); if (!b) return;
        sh.close();
        requestAnimationFrame(() => setTimeout(() => { try { act(b); } catch (err) { console.warn('aichooser', err); } }, 30));
      },
    });
  }

  /* ---------------- the deck page's row: every AI as an icon (the same lists, the same taps as the chooser) ---------------- */
  function stripHtml() {
    if (!window.AI || !AI.PROVIDERS) return '';
    const { cur, on, off } = lists(), n = Object.keys(AI.PROVIDERS).length;
    const chip = id => {
      const p = AI.PROVIDERS[id], nm = names(id), ok = conf(id), isCur = id === cur;
      const what = isCur ? 'работает сейчас' : ok ? 'подключена — сделать активной' : `подключить${p.free ? ' (бесплатно)' : ''}${p.cli ? '' : ' — откроются Настройки'}`;
      return `<button type="button" class="aic-chip ${isCur ? 'cur' : ok ? 'ok' : 'no'}" data-aic="${ok ? 'pick' : 'connect'}" data-id="${esc(id)}"
        title="${esc(`${nm.t} — ${what}${TIPS[id] ? '\n' + TIPS[id] : ''}`)}" aria-label="${esc(`${nm.t} — ${what}`)}"${isCur ? ' aria-current="true"' : ''}>${logo(id, isCur ? ' cur' : ok ? ' ok' : ' no')}</button>`;
    };
    const now = cur ? `Сейчас: <b>${esc(names(cur).t)}</b> — проверяет и дополняет карточки` : 'Ни одна не подключена — нажмите на любую. <b>Gemini</b> и <b>Groq</b> — бесплатно';
    return `<div class="aic-strip" data-aic-strip role="group" aria-labelledby="aic-strip-h">
      <div class="aic-strip-top"><span class="aic-strip-h" id="aic-strip-h">Нейросети в приложении · ${n}</span>
        <button type="button" class="aic-strip-all" data-aic-all aria-haspopup="dialog" title="Все нейросети: что умеет, подключить, выбрать">Все ›</button></div>
      <div class="aic-strip-row">${on.concat(off).map(chip).join('')}</div>
      <div class="aic-strip-now">${now}</div></div>`;
  }
  document.addEventListener('click', e => {
    const strip = e.target.closest && e.target.closest('[data-aic-strip]'); if (!strip) return;
    const all = e.target.closest('[data-aic-all]');
    if (all) { e.stopPropagation(); window.AIChooser.open(all); return; }
    const b = e.target.closest('[data-aic]'); if (!b) return;
    e.stopPropagation();
    try { act(b); } catch (err) { console.warn('aichooser strip', err); }
  }, true);

  /* =====================================================================
   * 💬 ChatGPT · подписка / Gemini · аккаунт Google — the step-by-step window:
   * «Установить (1 раз)» → «Войти в аккаунт» → «Проверить», with «Если не получается: …». The bridge does the work
   * (bridge/aicli.py); this window only asks it and explains. Works only in the app on the Mac with the bridge.
   * ===================================================================== */
  const CLI_TEXT = {
    chatgpt: {
      lead: 'Работает через <b>вашу подписку ChatGPT</b> — без ключа и без оплаты за каждый запрос. Для этого на Mac нужна официальная программа OpenAI <b>Codex</b>: приложение поставит её само, один раз.',
      plan: 'Нужен <b>платный ChatGPT</b>: Plus, Pro, Business, Edu или Enterprise. С бесплатным аккаунтом ChatGPT программа Codex может не работать.',
      install: 'Скачает программу Codex (≈ 1–3 минуты) в папку приложения, без пароля администратора.',
      login: 'Откроется браузер: войдите в свой аккаунт ChatGPT и нажмите «Continue». Ключ не нужен.',
      account: 'аккаунт ChatGPT',
    },
    'gemini-cli': {
      lead: 'Работает через <b>ваш аккаунт Google</b> — без ключа, бесплатно, но с лимитом Google в день/неделю. Нужна официальная программа Google <b>Antigravity CLI</b> — с 18 июня 2026 года она заменила Gemini CLI для личных аккаунтов Google.',
      plan: 'Подойдёт обычный аккаунт Google (Gmail). <b>Важно:</b> на бесплатном плане Google может использовать ваши запросы для улучшения своих продуктов — не отправляйте через него ничего личного.',
      install: 'Откроется окно Терминала с официальным установщиком Google — просто дождитесь слова «Готово».',
      login: 'Откроется Терминал с программой, а затем браузер: выберите вход через Google, войдите и разрешите доступ. Когда в Терминале появится строка для вопроса — напишите /quit и нажмите Enter.',
      account: 'аккаунт Google',
    },
  };
  const NODE_URL = 'https://nodejs.org';
  let cliModal = null;

  function cliHelp(id, s) {
    const t = CLI_TEXT[id], gpt = id === 'chatgpt';
    const li = [];
    if (gpt) li.push(`<li><b>«Нет Node.js»</b> — он нужен один раз для установки. Скачайте установщик «LTS» с <a href="${NODE_URL}" target="_blank" rel="noopener">nodejs.org</a>, установите как обычную программу и нажмите «Я установил — проверить».</li>`);
    li.push(`<li><b>Нет подписки</b> — ${t.plan} Без неё подключите «${gpt ? 'ChatGPT' : 'Gemini'} · по ключу» или бесплатные Gemini / Groq.</li>`);
    li.push(`<li><b>Окно входа не открылось</b> — ${gpt ? 'нажмите «Открыть страницу входа» или «Войти через Терминал».' : 'проверьте, что Терминал разрешено открывать; или откройте Терминал сами и выполните команду ниже.'}</li>`);
    if (s && s.loginCmd) li.push(`<li>Команда для входа вручную (в Терминале): <code translate="no" class="aicc-code">${esc(s.loginCmd)}</code></li>`);
    if (!gpt && s && s.installCmd && !s.installed) li.push(`<li>Установка вручную (в Терминале): <code translate="no" class="aicc-code">${esc(s.installCmd)}</code></li>`);
    li.push(`<li><b>Лимит исчерпан</b> — ${gpt ? 'у подписки ChatGPT есть лимит на 5 часов и на неделю' : 'у бесплатного плана Google есть лимит'}. Приложение само переключится на другую подключённую нейросеть и вернётся, когда лимит восстановится.</li>`);
    li.push('<li><b>Работает только на этом Mac</b>, пока запущен мост. На iPhone и на сайте используйте нейросети по ключу.</li>');
    li.push('<li>Обновили приложение, а кнопки не отвечают? Один раз нажмите «↻ Перезапустить мост».</li>');
    return `<details class="aicc-help"><summary>Если не получается…</summary><ul>${li.join('')}</ul></details>`;
  }

  function cliBody(id) {
    const p = AI.PROVIDERS[id], t = CLI_TEXT[id], gpt = id === 'chatgpt';
    const B = AI.bridge || {};
    if (!AI.onMac()) {
      return `<p class="aicc-lead">${t.lead}</p><div class="aicc-box warn">💻 Это работает только в приложении <b>на Mac</b> (через мост). На iPhone и на сайте подключите нейросеть по ключу — <b>${gpt ? 'ChatGPT · по ключу' : 'Gemini · по ключу (бесплатно)'}</b>.</div>
        <div class="aicc-act"><button class="btn primary" data-cc="twin">🔑 ${gpt ? 'ChatGPT' : 'Gemini'} по ключу</button></div>`;
    }
    if (!B.up) {
      return `<p class="aicc-lead">${t.lead}</p><div class="aicc-box warn">Мост на Mac не запущен. Запустите его (двойной щелчок по <b>tools/restart-bridge.command</b> в папке приложения) и откройте это окно снова.</div>
        <div class="aicc-act"><button class="btn" data-cc="recheck">↻ Проверить снова</button></div>`;
    }
    if (!B.cliBridge) {
      return `<p class="aicc-lead">${t.lead}</p><div class="aicc-box warn">Мост на Mac старой версии — он ещё не умеет подключать ${esc(p.short)}. Перезапустите его один раз.</div>
        <div class="aicc-act"><button class="btn primary" data-cc="restart">↻ Перезапустить мост</button></div><p class="aicc-msg" data-cc-msg></p>`;
    }
    const s = AI.cliState(p.cli) || {};
    const ins = s.install || {}, lg = s.login || {};
    const ready = AI.cliReady(p.cli);
    const lim = s.limitUntil > Date.now() ? new Date(s.limitUntil) : null;
    const step = (n, done, active, title, inner) => `<li class="aicc-step ${done ? 'done' : active ? 'active' : 'wait'}"><span class="aicc-n" aria-hidden="true">${done ? '✓' : n}</span><div><b>${title}</b>${inner}</div></li>`;
    // 1 · install
    let one;
    if (s.installed) one = `<p class="aicc-ok">Установлено${s.version ? ` · ${esc(s.version)}` : ''}</p>${s.engine === 'gemini' ? '<div class="aicc-box warn">Это старая программа Gemini CLI — личные аккаунты Google в ней больше не работают. Поставьте её замену, Antigravity CLI.</div><div class="aicc-act"><button class="btn" data-cc="install">⬇ Установить Antigravity CLI</button></div>' : ''}`;
    else if (ins.state === 'running') one = '<p class="aicc-wait"><span class="aicc-spin" aria-hidden="true"></span> Устанавливаю… обычно 1–3 минуты, окно можно не закрывать.</p>';
    else if (ins.state === 'failed' && ins.noNode) one = `<div class="aicc-box warn">${esc(ins.error)}</div><div class="aicc-act"><a class="btn" href="${NODE_URL}" target="_blank" rel="noopener">↗ Скачать Node.js</a><button class="btn primary" data-cc="install">Я установил — проверить</button></div>`;
    else if (ins.state === 'failed') one = `<div class="aicc-box warn">${esc(ins.error || 'Не получилось установить.')}</div><div class="aicc-act"><button class="btn primary" data-cc="install">Установить ещё раз</button></div>`;
    else if (ins.state === 'terminal') one = `<p class="aicc-wait">Окно Терминала открыто — дождитесь конца установки, затем нажмите «Проверить».</p><div class="aicc-act"><button class="btn primary" data-cc="recheck">Проверить</button><button class="btn" data-cc="install">Открыть установку снова</button></div>`;
    else one = `<p>${t.install}</p><div class="aicc-act"><button class="btn primary" data-cc="install">⬇ Установить (1 раз)</button></div>`;
    // 2 · sign in
    let two = '';
    if (s.installed) {
      if (s.loggedIn === true && s.problem !== 'moved') two = `<p class="aicc-ok">Вход выполнен${s.authMode === 'chatgpt' ? ' · аккаунт ChatGPT' : ''}</p>${s.authMode === 'apikey' ? '<div class="aicc-box warn">Codex вошёл по API-ключу — тогда запросы оплачиваются отдельно, а не подпиской. Войдите аккаунтом ChatGPT: нажмите «Войти в аккаунт» ещё раз.</div><div class="aicc-act"><button class="btn" data-cc="login">Войти в аккаунт</button></div>' : ''}`;
      else if (lg.state === 'waiting') two = `<p class="aicc-wait"><span class="aicc-spin" aria-hidden="true"></span> Ждём входа… ${t.login}</p><div class="aicc-act">${lg.url ? `<a class="btn" href="${esc(lg.url)}" target="_blank" rel="noopener">↗ Открыть страницу входа</a>` : ''}<button class="btn" data-cc="terminal">Войти через Терминал</button></div>`;
      else if (lg.state === 'terminal') two = `<p class="aicc-wait">Окно Терминала открыто. ${t.login}</p><div class="aicc-act"><button class="btn primary" data-cc="check">Я вошёл — проверить</button><button class="btn" data-cc="${gpt ? 'terminal' : 'login'}">Открыть вход снова</button></div>`;
      else two = `<p>${t.login}</p>${lg.state === 'failed' && lg.error ? `<div class="aicc-box warn">${esc(lg.error)}</div>` : ''}${s.problem === 'moved' ? '<div class="aicc-box warn">Google больше не пускает личные аккаунты в Gemini CLI. Установите Antigravity CLI (шаг 1) и войдите в нём.</div>' : ''}<div class="aicc-act"><button class="btn primary" data-cc="login">🔐 Войти в аккаунт</button>${gpt ? '<button class="btn" data-cc="terminal">Через Терминал</button>' : ''}</div>`;
    }
    // 3 · check
    let three = '';
    if (s.installed) {
      three = ready && !lim ? `<p class="aicc-ok">Работает — ${esc(p.short)} отвечает через ваш ${t.account}.</p>`
        : lim ? `<div class="aicc-box">Лимит на сейчас исчерпан — снова можно примерно в ${lim.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}${lim - Date.now() > 20 * 3600e3 ? ` (${lim.toLocaleDateString('ru-RU')})` : ''}. Пока отвечает другая подключённая нейросеть.</div>`
          : s.problem === 'plan' ? `<div class="aicc-box warn">${t.plan}</div>`
            : '<p>Один маленький запрос покажет, что всё работает.</p>';
      three += `<div class="aicc-act"><button class="btn ${ready ? '' : 'primary'}" data-cc="check">🔌 Проверить</button>${ready && AI.current() !== id ? '<button class="btn primary" data-cc="use">★ Сделать активной</button>' : ''}</div>`;
    }
    return `<p class="aicc-lead">${t.lead}</p>
      ${id === 'gemini-cli' ? '<div class="aicc-box note">🔎 На бесплатном плане Google может использовать запросы для улучшения своих продуктов.</div>' : ''}
      <ol class="aicc-steps">
        ${step(1, s.installed, !s.installed, 'Установить (1 раз)', one)}
        ${step(2, s.installed && s.loggedIn === true && s.problem !== 'moved', s.installed && s.loggedIn !== true, 'Войти в аккаунт', two)}
        ${step(3, ready && !lim, s.installed && s.loggedIn === true, 'Проверить', three)}
      </ol>
      <p class="aicc-msg" data-cc-msg role="status"></p>
      ${cliHelp(id, s)}
      <div class="aicc-foot"><button class="btn sm ghost" data-cc="restart">↻ Перезапустить мост</button></div>`;
  }

  function connectCli(id) {
    const p = AI.PROVIDERS[id]; if (!p || !p.cli) return;
    if (cliModal) cliModal.close();
    const n = names(id);
    const m = cliModal = UI.modal({
      title: `<span class="aicc-title">${logo(id, ' ok')} ${esc(n.t)}</span>`, cls: 'aicc-modal',
      body: `<div class="aicc" data-cc-root>${cliBody(id)}</div>`,
      onClose() { clearInterval(m && m._poll); if (cliModal === m) cliModal = null; },
    });
    const root = m.$('[data-cc-root]');
    const msg = (t, cls = '') => { const e = root.querySelector('[data-cc-msg]'); if (e) { e.className = 'aicc-msg ' + cls; e.textContent = t; } };
    const draw = () => {
      const open = root.querySelector('.aicc-help') && root.querySelector('.aicc-help').open;
      const keep = root.querySelector('[data-cc-msg]') ? root.querySelector('[data-cc-msg]').outerHTML : '';
      root.innerHTML = cliBody(id);
      if (open) root.querySelector('.aicc-help').open = true;
      const e = root.querySelector('[data-cc-msg]'); if (e && keep) e.outerHTML = keep;
      if (window.App && App.updateBadge) App.updateBadge();
    };
    const busy = () => { const s = AI.cliState(p.cli) || {}; return (s.install || {}).state === 'running' || (s.login || {}).state === 'waiting'; };
    // while installing / waiting for the browser sign-in: look every 2 s (the status flips by itself)
    m._poll = setInterval(async () => {
      if (!busy() || !root.isConnected) return;
      try { await AI.cliRefresh(p.cli); draw(); } catch (e) { /* the bridge restarts */ }
    }, 2000);
    root.addEventListener('click', async e => {
      const b = e.target.closest('[data-cc]'); if (!b || b.disabled) return;
      const k = b.dataset.cc, label = b.textContent;
      const work = async (fn, wait) => { b.disabled = true; if (wait) b.textContent = wait; try { await fn(); } catch (err) { msg(String(err && err.message || err), 'bad'); } finally { if (b.isConnected) { b.disabled = false; b.textContent = label; } } };
      if (k === 'twin') { m.close(); toSettings(p.twin); return; }
      if (k === 'use') {
        Store.setSetting('aiProvider', id); App.updateBadge(); App.render();
        UI.toast(`Теперь карточки проверяет: ${n.t}`, 'good'); m.close(); return;
      }
      if (k === 'restart') {
        await work(async () => {
          msg('Перезапускаю мост…');
          await fetch('/api/restart', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
          for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 700)); try { const r = await fetch('/api/ai/status', { cache: 'no-store' }); if (r.ok) break; } catch (x) { /* not yet */ } }
          await AI.detectBridge(); draw(); msg('✓ Мост перезапущен', 'good');
        }, 'Перезапускаю…');
        return;
      }
      if (k === 'recheck') { await work(async () => { await AI.detectBridge(); draw(); }, 'Проверяю…'); return; }
      if (k === 'install') { await work(async () => { const j = await AI.cliInstall(p.cli); draw(); if (j.terminal) msg('Открыл Терминал с установкой — дождитесь «Готово».'); }, 'Запускаю…'); return; }
      if (k === 'login' || k === 'terminal') {
        await work(async () => { const j = await AI.cliLogin(p.cli, k === 'terminal'); if (j.ok === false) throw new Error(j.error); draw(); if (j.terminal) msg('Открыл Терминал — следуйте подсказкам в нём.'); }, 'Открываю…');
        return;
      }
      if (k === 'check') {
        await work(async () => {
          msg('Спрашиваю одним маленьким запросом… (до минуты)');
          await AI.cliRefresh(p.cli, true); draw();
          const s = AI.cliState(p.cli) || {};
          if (AI.cliReady(p.cli) && !(s.limitUntil > Date.now())) {
            msg(`✓ ${n.t} работает`, 'good');
            if (window.AIHub && AIHub.onConnected) try { AIHub.onConnected(id); } catch (x) { /* optional */ }
          } else msg(s.problem === 'limit' || s.limitUntil > Date.now() ? 'Вход есть, но лимит на сейчас исчерпан.' : s.problem === 'plan' ? 'Вход есть, но тариф не подходит — см. «Если не получается».' : s.problem === 'moved' ? 'Нужна программа Antigravity CLI — шаг 1.' : 'Пока не получилось войти — выполните шаг 2 и нажмите ещё раз.', 'bad');
        }, 'Проверяю…');
      }
    });
    return m;
  }

  /* ---------- the same brand coins for the subscription twins everywhere (App.aiLogo has no 'chatgpt' / 'gemini-cli') ---------- */
  if (window.App && App.aiLogo && !App.aiLogo._aicAlias) {
    const orig = App.aiLogo;
    App.aiLogo = Object.assign((k, ...r) => orig((AI.PROVIDERS[k] && AI.PROVIDERS[k].logo) || k, ...r), { _aicAlias: true });
  }
  /* the 🤖 button (App.updateBadge draws its coins itself): put the right brand coin on the subscription entries */
  if (window.App && App.updateBadge && !App.updateBadge._aicAlias) {
    const origB = App.updateBadge;
    App.updateBadge = Object.assign(function (...a) {
      const r = origB.apply(this, a);
      try {
        const b = document.getElementById('claude-badge'), P = AI.PROVIDERS; if (!b) return r;
        const fix = (el, k) => {
          const t = document.createElement('template'); t.innerHTML = App.aiLogo(k);
          const c = t.content.firstElementChild; if (!c || !el) return;
          el.style.setProperty('--c', c.style.getPropertyValue('--c')); el.innerHTML = c.innerHTML;
        };
        const cur = AI.available() ? AI.current() : null;
        if (cur && P[cur] && P[cur].logo) b.querySelectorAll('.aib-corner, .aib-stack .aib-i').forEach(el => fix(el, cur));
        Object.keys(P).filter(k => P[k].logo).forEach(k => b.querySelectorAll('.aib-fan .aib-i[data-n]').forEach(el => { if (el.dataset.n.startsWith(P[k].name)) fix(el, k); }));
      } catch (e) { /* the button stays as drawn */ }
      return r;
    }, { _aicAlias: true });
  }
  /* ⚙️ Настройки (js/views.js draws a Claude-only block for every «bridge» entry): the ChatGPT / Gemini subscription
     rows get their own short state and the step-by-step window instead */
  if (window.Views && Views.settings && !Views.settings._aicCli) {
    const origS = Views.settings;
    Views.settings = Object.assign(function (root, ...a) {
      const r = origS.call(this, root, ...a);
      try {
        Object.keys(AI.PROVIDERS).filter(id => AI.PROVIDERS[id].cli).forEach(id => {
          const btn = root.querySelector(`details.prov [data-act="test-prov"][data-id="${CSS.escape(id)}"]`);
          const col = btn && btn.closest('.col'); if (!col) return;
          const p = AI.PROVIDERS[id], s = AI.cliState(p.cli) || {}, ok = AI.cliReady(p.cli);
          const state = !AI.onMac() ? 'ℹ️ Работает только в приложении на Mac (через мост). Здесь подключите нейросеть по ключу.'
            : !(AI.bridge && AI.bridge.up) ? 'Мост на Mac не запущен.'
              : ok ? `✓ Установлено и вход выполнен${s.version ? ' · ' + U.esc(s.version) : ''}`
                : s.installed ? 'Установлено — осталось войти в аккаунт.' : 'Программа ещё не установлена.';
          const row = btn.closest('.row');
          [...col.children].forEach(ch => { if (ch !== row) ch.remove(); });
          col.insertAdjacentHTML('afterbegin', `<div class="small muted">${U.esc(p.note || '')}</div>
            <div class="${ok ? 'aicc-ok' : 'small'}">${state}</div>
            <div class="row"><button type="button" class="btn sm primary" data-aicli="${U.esc(id)}">${ok ? '⚙ Состояние и помощь' : '🔌 Подключить по шагам'}</button></div>`);
        });
      } catch (e) { console.warn('aichooser settings', e); }
      return r;
    }, { _aicCli: true });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-aicli]'); if (!b) return;
    e.preventDefault(); connectCli(b.dataset.aicli);
  });

  window.AIChooser = {
    /** 💬 the step-by-step window of a subscription on the Mac (ChatGPT · подписка / Gemini · аккаунт Google) */
    connectCli,
    /** the row of every AI's icon (the deck page): a tap picks a connected one or opens its settings */
    stripHtml,
    /** open (or, from the same button, close) the chooser */
    open(anchor) {
      if (!window.AI || !AI.PROVIDERS) return;
      if (phone()) { closePop(false); openSheet(); return; }
      if (pop && pop._anchor === anchor) { closePop(); return; }
      openPop(anchor || document.getElementById('claude-badge'));
    },
    close() { closePop(); },
    get isOpen() { return !!pop || !!(window.Mobile && Mobile.open && Mobile.open.el && Mobile.open.el.classList.contains('aic-sheet')); },
    toSettings,
  };
})();
