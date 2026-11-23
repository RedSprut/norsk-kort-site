/* ============ 🔑 «Войти в Claude» — one button instead of commands in the Terminal (js/claudelogin.js) ============
 * The Mac bridge (bridge/server.py, POST /api/claude/login) opens a NEW Terminal window that runs tools/claude-token.sh:
 * the browser asks to confirm the Claude account, the script saves a long-lived key (≈ a year) only on this Mac.
 * Meanwhile the app asks the bridge /api/status?fresh=1 every 3 s (up to 3 min) and says «✓ Claude на связи» when it is.
 *
 * ClaudeLogin.start(btn?)  — press the button (btn: the pressed button — it shows the progress; optional)
 * ClaudeLogin.buttonHtml() — «🔑 Войти в Claude» + «Проверить» (data-claude-login="go|check"; clicks are caught here)
 * The «Claude просит войти ещё раз» panels of js/aihub.js (.aih-auth) get the same button on their own (a small observer).
 * An older bridge without the endpoint: it is restarted once (POST /api/restart) and asked again.
 */
(function () {
  'use strict';
  const POLL_MS = 3000, POLL_MAX = 180000;
  const toast = (m, k, ms) => { if (window.UI && UI.toast) UI.toast(m, k || '', ms || 3200); };
  // the one «are we on the Mac» (js/net.js): never in the store apps, never on the site
  const onMac = () => { try { return window.Net && Net.onMac ? Net.onMac() : !!(window.AI && AI.onMac && AI.onMac()); } catch (e) { return false; } };
  const NI = (n, s) => (window.NavIcons ? NavIcons.icon(n, s || 18) : '');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let run = null; // the login in progress: { t0, timer, stop }

  /** the status line under the buttons (every place that shows them) */
  function say(text, cls) {
    document.querySelectorAll('[data-claude-login-msg]').forEach(m => { m.className = 'cl-msg ' + (cls || ''); m.textContent = text; });
  }
  function busy(on) {
    document.querySelectorAll('[data-claude-login="go"]').forEach(b => {
      b.disabled = !!on;
      if (!b.dataset.label) b.dataset.label = b.innerHTML;
      b.innerHTML = on ? `${NI('hourglass')}<span>Жду входа…</span>` : b.dataset.label;
    });
  }
  function done(ok) {
    if (run) { clearTimeout(run.timer); run = null; }
    busy(false);
    if (ok) {
      say('✓ Claude на связи', 'good');
      toast('✓ Claude на связи — можно пользоваться', 'good', 4000);
      try { if (window.App && App.updateBadge) App.updateBadge(); } catch (e) { /* not drawn yet */ }
      // the settings screen redraws itself with the green «✓ Мост работает»; the aihub panel closes by its own «проверить»
      setTimeout(() => { try { if (window.App && App.view && App.view.name === 'settings') App.render(); } catch (e) { console.warn('claude login redraw', e); } }, 900);
      document.querySelectorAll('.aih-auth [data-auth="recheck"]').forEach(b => { if (!b.disabled) b.click(); });
    }
  }
  async function status() {
    try { await AI.detectBridge({ fresh: true }); } catch (e) { /* the bridge is down — AI.bridge says so */ }
    return (window.AI && AI.bridge) || {};
  }
  function poll() {
    if (!run) return;
    run.timer = setTimeout(async () => {
      if (!run) return;
      const B = await status();
      if (!run) return;
      if (B.ok && B.auth !== 'bad') { done(true); return; }
      if (Date.now() - run.t0 > POLL_MAX) {
        done(false);
        say('Пока не получилось. Если в окне Терминала написано «Ключ сохранён» — нажмите «Проверить». Если окно закрылось раньше — нажмите «Войти в Claude» ещё раз.', 'bad');
        return;
      }
      say(B.up ? 'Окно Терминала открыто: подтвердите вход в браузере (кнопка «Authorize»). Я проверяю каждые 3 секунды…' : 'Мост на Mac не отвечает — проверю ещё раз через 3 секунды…', '');
      poll();
    }, POLL_MS);
  }
  async function post(path) {
    const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store' });
    let j = {}; try { j = await r.json(); } catch (e) { j = {}; }
    return { status: r.status, j };
  }
  /** an older bridge (no /api/claude/login yet): restart it once, wait for it to come back */
  async function restartBridge() {
    say('Обновляю мост на Mac — несколько секунд…');
    try { await post('/api/restart'); } catch (e) { return false; }
    for (let i = 0; i < 20; i++) {
      await wait(700);
      try { const r = await fetch('/api/status', { cache: 'no-store' }); if (r.ok) return true; } catch (e) { /* still restarting */ }
    }
    return false;
  }
  async function start(btn) {
    if (run) { say('Уже жду входа — подтвердите его в браузере, который открылся.'); return; }
    if (!onMac()) { toast('Claude по подписке работает только в версии для Mac', '', 4500); return; }
    busy(true);
    say('Открываю окно Терминала…');
    let res = null;
    try {
      res = await post('/api/claude/login');
      if (res.status === 404 || res.status === 501) { // the bridge is older than this button
        if (await restartBridge()) res = await post('/api/claude/login');
      }
    } catch (e) { res = null; }
    if (!res || !(res.j && res.j.ok)) {
      busy(false);
      const why = res && res.j && res.j.error ? res.j.error : !res ? 'Мост на Mac не отвечает — запустите его и нажмите ещё раз.' : 'Мост не смог открыть Терминал. Перезапустите мост и нажмите ещё раз.';
      say(why, 'bad');
      return;
    }
    run = { t0: Date.now(), timer: 0 };
    say('Открылось окно Терминала, а в браузере — страница Claude. Войдите своим аккаунтом и нажмите «Authorize». Я проверяю каждые 3 секунды…');
    poll();
    if (btn && btn.focus) { try { btn.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  async function check(btn) {
    if (btn) { btn.disabled = true; }
    say('Спрашиваю Claude одним маленьким запросом…');
    const B = await status();
    if (btn) btn.disabled = false;
    if (B.ok && B.auth !== 'bad') { done(true); return; }
    say(!B.up ? 'Мост на Mac не отвечает — запустите его и нажмите ещё раз.' : B.auth === 'bad' ? 'Claude пока не пускает — нажмите «Войти в Claude».' : B.checking ? 'Claude ещё отвечает — нажмите «Проверить» через пару секунд.' : 'Claude пока не ответил — нажмите «Проверить» ещё раз чуть позже.', 'bad');
  }
  const buttonHtml = () => (!onMac() ? `<p class="cl-msg st-maconly">${NI('laptop')}<span>Claude по подписке работает только в версии для Mac.</span></p>` : `<div class="cl-box"><div class="cl-acts">
      <button type="button" class="btn primary cl-go" data-claude-login="go" title="Откроется окно Терминала и страница Claude в браузере — войдите, и вход сохранится примерно на год">${NI('key')}<span>Войти в Claude</span></button>
      <button type="button" class="btn cl-check" data-claude-login="check" title="Спросить Claude, пускает ли он уже">Проверить</button></div>
      <p class="cl-msg" data-claude-login-msg role="status" aria-live="polite"></p></div>`);

  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-claude-login]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (b.dataset.claudeLogin === 'go') start(b); else check(b);
  }, true);

  /* the «Claude просит войти ещё раз» panels (js/aihub.js .aih-auth): the same one button on top of their steps */
  function enhance(root) {
    if (!onMac()) return;
    (root.querySelectorAll ? root.querySelectorAll('.aih-auth') : []).forEach(p => {
      if (p.querySelector('[data-claude-login]')) return;
      const steps = p.querySelector('.aih-auth-steps');
      const box = document.createElement('div');
      box.className = 'cl-in-auth';
      box.innerHTML = `<p class="cl-lead"><b>Проще всего — одной кнопкой:</b> откроется окно Терминала и страница Claude, войдите — и вход сохранится примерно на год.</p>${buttonHtml()}`;
      if (steps) steps.before(box); else p.appendChild(box);
      if (steps && !steps.closest('details')) { // the commands stay, folded — for those who prefer the Terminal
        const d = document.createElement('details'); d.className = 'cl-by-hand';
        d.innerHTML = '<summary>Или вручную, командой в Терминале ▾</summary>';
        steps.before(d); d.appendChild(steps);
      }
      if (run) busy(true);
    });
  }
  if ('MutationObserver' in window) {
    const mo = new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches('.aih-auth') || n.querySelector('.aih-auth'))) enhance(n.matches('.aih-auth') ? n.parentNode || n : n); });
    const go = () => mo.observe(document.body, { childList: true, subtree: true });
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
  }

  window.ClaudeLogin = { start, check, buttonHtml, busy: () => !!run };
})();
