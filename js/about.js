/* ============ ℹ️ «О приложении» (js/about.js + css/about.css) ============
 * One window with the product information: logo, «Norsk Kort», «Версия 1.0.0 · сборка N · дата» (+ copy),
 * a one-line description, the author, «Что нового» (data/changelog.json — a static file made by tools/bump-version.mjs),
 * «Проверить обновления», «Сообщить о проблеме» (copies diagnostics — never keys, never personal data) and
 * «Лицензии и благодарности» (the open-source libraries and the data the app really uses).
 * The version comes from ONE place: window.APP (js/version.js).
 * Opens from: ⚙️ Настройки (bottom), the footer under every screen, the 🧭 navigator. Any [data-about] opens it.
 *   window.About = { open(), versionText(), diagText(), checkUpdate() }
 */
(function () {
  'use strict';
  const esc = s => U.esc(s == null ? '' : String(s));
  const APPI = () => window.APP || { name: 'Norsk Kort', version: '1.0.0', build: 0, date: '', author: '' };
  /** a drawn icon of the top-bar family (js/app.js NavIcons.icon) — never an emoji in the chrome (v229) */
  const IC = (n, s) => (window.NavIcons && NavIcons.icon ? NavIcons.icon(n, s) : '');
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  /** '2026-11-22' → «22 ноября 2026» */
  const ruDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : (iso || ''); };

  /** «Norsk Kort 1.0.0 (сборка 225, 22 ноября 2026)» — what «Скопировать» puts on the clipboard */
  function versionText() { const a = APPI(); return `${a.name} ${a.version} (сборка ${a.build}${a.date ? ', ' + ruDate(a.date) : ''})`; }

  /* ---------- 📜 what the app really uses (from the credits already in the code: speech.js, voices.js, lexicon.js, sources.js,
     library.js, levels.js, photos.js, fonts/art-fonts.css, util.js U.LIBS) ---------- */
  const LIBS = [
    ['transformers.js', 'Hugging Face', 'Apache-2.0', 'распознавание речи прямо в браузере', 'https://github.com/huggingface/transformers.js'],
    ['ONNX Runtime Web', 'Microsoft', 'MIT', 'запуск моделей речи и голосов на устройстве', 'https://github.com/microsoft/onnxruntime'],
    ['NB-Whisper', 'Национальная библиотека Норвегии', 'Apache-2.0', 'модель, которая понимает норвежскую речь', 'https://huggingface.co/NbAiLab'],
    ['Piper', 'Rhasspy, Open Home Foundation', 'MIT', 'офлайн-голоса; записи голосов — CC0 или Apache-2.0, у каждого голоса своя', 'https://github.com/rhasspy/piper'],
    ['espeak-ng', 'проект eSpeak NG', 'GPL-3.0', 'фонемы для голосов Piper — скачиваются с CDN только при использовании', 'https://github.com/espeak-ng/espeak-ng'],
    ['hls.js', 'video-dev', 'Apache-2.0', 'видео и радио NRK', 'https://github.com/video-dev/hls.js'],
    ['tesseract.js', 'Naptha', 'Apache-2.0', 'распознавание текста на фото и в кадре видео', 'https://github.com/naptha/tesseract.js'],
    ['PDF.js', 'Mozilla', 'Apache-2.0', 'чтение книг и учебников в PDF', 'https://github.com/mozilla/pdf.js'],
    ['SheetJS', 'SheetJS', 'Apache-2.0', 'таблицы Excel: импорт и экспорт', 'https://sheetjs.com'],
    ['JSZip', 'Stuart Knightley', 'MIT', 'колоды Anki, файлы Word и архивы', 'https://github.com/Stuk/jszip'],
    ['sql.js', 'sql.js', 'MIT', 'чтение колод Anki', 'https://github.com/sql-js/sql.js'],
    ['fzstd', '101arrowz', 'MIT', 'новые колоды Anki (сжатие zstd)', 'https://github.com/101arrowz/fzstd'],
    ['js-yaml', 'nodeca', 'MIT', 'импорт файлов YAML', 'https://github.com/nodeca/js-yaml'],
    ['FSRS', 'Open Spaced Repetition', 'MIT · BSD-3-Clause', 'расписание повторений и его подстройка под вас', 'https://github.com/open-spaced-repetition'],
    ['qrcode-generator', 'Kazuhiko Arase', 'MIT', 'QR-код в окне «Поделиться»', 'https://github.com/kazuhikoarase/qrcode-generator'],
    ['Supabase JS', 'Supabase', 'MIT', 'вход и синхронизация в облаке', 'https://github.com/supabase/supabase-js'],
    ['Шрифты оформления', 'Google Fonts и авторы шрифтов', 'SIL OFL 1.1', 'художественный вид карточек', 'https://openfontlicense.org'],
  ];
  const DATA = [
    ['Ordbøkene — Bokmålsordboka', 'Бергенский университет и Språkrådet', 'CC BY 4.0', 'значения, примеры и устойчивые выражения', 'https://ordbokene.no'],
    ['Norsk ordbank bokmål 2005', 'Språkbanken, Национальная библиотека Норвегии', 'CC BY 4.0', 'формы слов и род существительных', 'https://www.nb.no/sprakbanken/'],
    ['Tatoeba', 'tatoeba.org', 'CC BY 2.0 FR', 'живые предложения с переводом', 'https://tatoeba.org'],
    ['Lingua Libre', 'Wikimedia Commons', 'CC BY-SA', 'записи носителей языка', 'https://lingualibre.org'],
    ['Фото Wikimedia Commons и Википедии', 'авторы фото', 'свободные лицензии', 'автор и лицензия показаны у каждого фото', 'https://commons.wikimedia.org'],
    ['Norwegian KELLY list', 'Kelly project, Tekstlab UiO', 'CC BY-SA 4.0', 'лестница уровней', 'https://tekstlab.uio.no/kelly/'],
    ['FrequencyWords', 'OpenSubtitles 2018', 'CC BY-SA 4.0', 'частотность слов', 'https://github.com/hermitdave/FrequencyWords'],
    ['Wiktionary', 'en.wiktionary.org', 'CC BY-SA', 'идиомы и пословицы', 'https://en.wiktionary.org'],
    ['Норвежский конструктикон', 'UiT — Арктический университет Норвегии', 'CC BY 4.0', 'речевые шаблоны', 'https://github.com/constructicon/norwegian-data'],
    ['Голоса NVCC и talesyntese', 'Språkbanken', 'CC0', 'норвежская озвучка без интернета', 'https://huggingface.co/rhasspy/piper-voices'],
  ];
  const credit = ([name, who, lic, what, url]) => `<li class="ab-cr"><a href="${esc(url)}" target="_blank" rel="noopener" class="ab-cr-a"><b>${esc(name)}</b><span class="ab-tag">${esc(lic)}</span></a><small>${esc(what)} · ${esc(who)}</small></li>`;

  /* ---------- 🐞 diagnostics: what helps to find a problem — never keys, tokens, names or card texts ---------- */
  function browserName() {
    const ua = navigator.userAgent || '';
    const m = /Edg\/(\d+)/.exec(ua) ? ['Edge', /Edg\/(\d+)/.exec(ua)[1]] : /OPR\/(\d+)/.exec(ua) ? ['Opera', /OPR\/(\d+)/.exec(ua)[1]]
      : /Firefox\/(\d+)/.exec(ua) ? ['Firefox', /Firefox\/(\d+)/.exec(ua)[1]] : /CriOS\/(\d+)/.exec(ua) ? ['Chrome iOS', /CriOS\/(\d+)/.exec(ua)[1]]
      : /Chrome\/(\d+)/.exec(ua) ? ['Chrome', /Chrome\/(\d+)/.exec(ua)[1]] : /Version\/([\d.]+).*Safari/.exec(ua) ? ['Safari', /Version\/([\d.]+)/.exec(ua)[1]] : ['браузер', ''];
    const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
    return `${m[0]} ${m[1]}`.trim() + (os ? ` · ${os}` : '');
  }
  function aiLine() {
    try {
      if (!window.AI) return 'нет';
      const set = (Store.settings && Store.settings.aiProvider) || 'auto';
      const cur = AI.current && AI.current();
      const name = cur && AI.PROVIDERS && AI.PROVIDERS[cur] ? AI.PROVIDERS[cur].name : '';
      return `${name && AI.available && AI.available() ? name : 'не подключена'}${set === 'auto' ? ' (выбор: авто)' : ''}`;
    } catch (e) { return 'неизвестно'; }
  }
  function diagText() {
    const a = APPI();
    const sw = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
    const standalone = !!((window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone);
    let decks = 0, cards = 0; try { decks = Store.decks().length; cards = Store.cards().length; } catch (e) { /* not loaded */ }
    return [
      `${a.name} ${a.version} (сборка ${a.build}, ${a.date})`,
      `Браузер: ${browserName()}`,
      `User-Agent: ${navigator.userAgent || '—'}`,
      `Экран: ${screen.width}×${screen.height}, окно ${innerWidth}×${innerHeight}, масштаб ${Math.round((devicePixelRatio || 1) * 100) / 100}`,
      `Язык браузера: ${navigator.language || '—'} · тема: ${document.documentElement.dataset.theme === 'light' ? 'светлая' : 'тёмная'}`,
      `Установлено как приложение: ${standalone ? 'да' : 'нет'} · офлайн-кэш: ${sw ? 'работает' : 'нет'} · интернет: ${navigator.onLine ? 'есть' : 'нет'}`,
      `Нейросеть: ${aiLine()}`,
      `Раздел: ${(window.App && App.view && App.view.name) || '—'} · колод: ${decks}, карточек: ${cards}`,
      `Время: ${new Date().toISOString()}`,
      '(ключи, имена и тексты карточек сюда не попадают)',
    ].join('\n');
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* older browsers / no permission */ }
    try {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch (e) { return false; }
  }

  /* ---------- 🔄 «Проверить обновления»: ask the server for sw.js (its CACHE name carries the build) and the service worker to update ---------- */
  async function checkUpdate(say) {
    say = say || (() => {});
    const a = APPI();
    if (navigator.onLine === false) return say('Нет интернета — проверить обновления сейчас нельзя. Приложение работает и без него.', 'warn');
    say('Проверяю, нет ли новой версии…', 'busy');
    let remote = 0, reg = null;
    try {
      const r = await fetch('sw.js', { cache: 'no-store' });
      if (r.ok) remote = +((await r.text()).match(/norsk-kort-v(\d+)/) || [])[1] || 0;
    } catch (e) { remote = 0; }
    try { reg = navigator.serviceWorker && navigator.serviceWorker.getRegistration ? await navigator.serviceWorker.getRegistration() : null; } catch (e) { reg = null; }
    if (reg) { try { await reg.update(); } catch (e) { /* offline or blocked */ } }
    const pending = !!(reg && (reg.installing || reg.waiting));
    if (!remote && !pending) return say('Сейчас не получилось проверить — попробуйте чуть позже.', 'warn');
    if (remote > a.build || pending) {
      say(`Есть новая версия${remote > a.build ? ` — сборка ${remote}` : ''}. Обновляю, это пара секунд…`, 'good');
      // the new service worker takes over by itself (skipWaiting) and the app reloads on «controllerchange» (js/app.js);
      // without a service worker (or if that does not happen) the page reloads here
      setTimeout(() => location.reload(), reduce() ? 1200 : 2200);
      return 'update';
    }
    say(`У вас последняя версия — ${a.version}, сборка ${a.build}.`, 'good');
    return 'latest';
  }

  /* ---------- ✨ «Что нового» ---------- */
  let newsP = null;
  function news() {
    if (!newsP) newsP = fetch(`data/changelog.json?v=${APPI().build}`).then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(j => { if (!j) newsP = null; return (j && j.entries) || []; });
    return newsP;
  }

  function body() {
    const a = APPI();
    const ver = `Версия ${esc(a.version)} · сборка ${esc(a.build)}${a.date ? ' · ' + esc(ruDate(a.date)) : ''}`;
    const verSay = `Версия ${esc(a.version)}, сборка ${esc(a.build)}${a.date ? ', от ' + esc(ruDate(a.date)) + ' года' : ''}`;
    return `<div class="ab">
      <div class="ab-hero">
        <img class="ab-logo" src="icons/icon.svg" width="76" height="76" alt="">
        <div class="ab-id">
          <h3 class="ab-name">${esc(a.name)}</h3>
          <p class="ab-ver" aria-label="${verSay}">${ver}</p>
          <button type="button" class="btn sm ab-btn ab-copy" data-ab="copy" title="Скопировать номер версии — пригодится, если пишете автору">${IC('copy')}<span>Скопировать версию</span></button>
        </div>
      </div>
      <p class="ab-desc">Карточки для изучения норвежского с русским и украинским: интервальные повторения, озвучка, картинки и проверка нейросетями.</p>
      <p class="ab-author">Автор: ${a.author ? esc(a.author) : '<span aria-label="не указан">—</span>'}</p>
      <div class="ab-actions">
        <button type="button" class="btn ab-btn ab-upd" data-ab="update" title="Спросить сервер, нет ли версии новее, и обновиться">${IC('refresh', 20)}<span>Проверить обновления</span></button>
        <button type="button" class="btn ab-btn ab-bug" data-ab="report" title="Скопировать сведения о версии, браузере и экране — без ключей и личных данных">${IC('report', 20)}<span>Сообщить о проблеме</span></button>
      </div>
      ${window.Account && Account.user && window.Views && Views.deleteAccountFlow ? `<p class="ab-del"><button type="button" class="btn ab-btn ab-del-btn ghost" data-ab="delete" title="Удалить аккаунт и облачную копию — сначала покажу, что удалится и что останется">${IC('trash', 20)}<span>Удалить аккаунт</span></button></p>` : ''}
      <p class="ab-status" data-ab-status role="status" aria-live="polite"></p>
      <details class="ab-diag" data-ab-diag hidden><summary>Что скопировано</summary><pre data-ab-diag-text></pre></details>
      <section class="ab-sec" aria-labelledby="ab-news-h">
        <h4 id="ab-news-h" class="ui-t">${IC('sparkle', 20)}<span>Что нового</span></h4>
        <ul class="ab-news" data-ab-news><li class="ab-news-wait">Загружаю…</li></ul>
      </section>
      <details class="ab-sec ab-lic">
        <summary><span class="ui-t">${IC('licence', 20)}<span>Лицензии и благодарности</span></span></summary>
        <p class="small muted">Norsk Kort работает благодаря открытым программам и данным. Спасибо их авторам!</p>
        <h5>Программы</h5><ul class="ab-crs">${LIBS.map(credit).join('')}</ul>
        <h5>Словари, тексты, голоса и фото</h5><ul class="ab-crs">${DATA.map(credit).join('')}</ul>
        <p class="small muted">Картинки, нарисованные нейросетью, и тексты, проверенные нейросетью, создаются сервисами, которые вы сами подключили.</p>
      </details>
    </div>`;
  }

  function mount(root) {
    const $ = s => root.querySelector(s);
    const status = $('[data-ab-status]');
    const say = (msg, kind) => { if (!status) return; status.textContent = msg; status.dataset.kind = kind || ''; };
    news().then(list => {
      const ul = $('[data-ab-news]'); if (!ul) return;
      ul.innerHTML = list.length
        ? list.slice(0, 10).map(e => `<li><span class="ab-news-b">${esc(e.build)}</span><span class="ab-news-t">${esc(e.text)}${e.date ? `<small>${esc(ruDate(e.date))}</small>` : ''}</span></li>`).join('')
        : '<li class="ab-news-wait">Список изменений сейчас не загрузился — он появится, когда будет интернет.</li>';
    });
    root.addEventListener('click', async e => {
      const b = e.target.closest('[data-ab]'); if (!b || b.disabled) return;
      e.preventDefault();
      const k = b.dataset.ab;
      if (k === 'copy') {
        const ok = await copy(versionText());
        UI.toast(ok ? `Скопировано: ${versionText()}` : versionText(), ok ? 'good' : '', ok ? 2600 : 6000);
      } else if (k === 'report') {
        const t = diagText(); const ok = await copy(t);
        const d = $('[data-ab-diag]'), pre = $('[data-ab-diag-text]');
        if (pre) pre.textContent = t; if (d) d.hidden = false;
        UI.toast(ok ? 'Сведения для отчёта скопированы — вставьте их в письмо или сообщение и опишите, что случилось' : 'Не получилось скопировать — сведения показаны ниже, выделите их вручную', ok ? 'good' : 'warn', 5200);
        if (!ok && d) d.open = true;
      } else if (k === 'delete') {
        // the same flow as Settings → «Аккаунт и Norsk Kort Pro» → «Удалить аккаунт» (js/views.js)
        if (window.Views && Views.deleteAccountFlow) Views.deleteAccountFlow();
      } else if (k === 'update') {
        b.disabled = true; b.classList.add('busy');
        let r = null;
        try { r = await checkUpdate(say); } finally { if (r !== 'update') { b.disabled = false; b.classList.remove('busy'); } }
        if (r === 'latest') UI.toast('У вас последняя версия', 'good', 2600);
      }
    });
  }

  function open() {
    const title = `<span class="ui-t ab-title">${IC('info', 22)}<span>О приложении</span></span>`;
    if (window.Mobile && Mobile.sheet) return Mobile.sheet({ title, body: body(), cls: 'ab-sheet', detent: 'large', onMount: s => mount(s.body || s.el) });
    return UI.modal({ title, body: body(), cls: 'ab-modal', onMount: m => mount(m.el) });
  }

  // any [data-about] opens it (the footer line, the settings panel); from inside another window, that one closes first
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-about]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const bd = b.closest('.modal-backdrop');
    if (bd && bd._m && bd._m.close) { bd._m.close(); setTimeout(open, 220); return; }
    open();
  }, true);

  window.About = { open, versionText, diagText, checkUpdate };
})();
