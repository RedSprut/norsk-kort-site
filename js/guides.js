/* ============ Guides: wherever something needs the user's help, explain WHAT will happen, WHAT to do, WHAT to expect ============
 * Each guide has buttons with actions and "больше не показывать" (then the default action runs right away).
 */
(function () {
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  /** the Mac bridge exists only when the app is opened on the Mac (file / localhost) — on the site its hints are not shown */
  const onMac = () => (window.Net && Net.onMac ? Net.onMac() : location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(location.hostname));
  /** W7: drawn line icons (js/app.js NavIcons) instead of emoji */
  const NI = (n, s) => (window.NavIcons ? NavIcons.icon(n, s || 18) : '');
  const proOffered = () => { try { return !!(window.Pro && Pro.offered()); } catch (e) { return false; } };
  const Guides = {
    off(id) { return !!((Store.settings.guidesOff || {})[id]); },
    setOff(id) { const g = Object.assign({}, Store.settings.guidesOff || {}); g[id] = true; Store.setSetting('guidesOff', g); },
    /** every guide back + the intros / reminders kept outside the settings («❓ Как пользоваться», Telegram) */
    EXTRA_KEYS: ['nk-help', 'nk-tg-ui'],
    resetAll() {
      Store.setSetting('guidesOff', {});
      this.EXTRA_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } });
      document.dispatchEvent(new CustomEvent('hints-reset')); // e.g. the welcome («Как пользоваться») shows again
    },

    /** o: { icon, title, intro, steps[], expect, now, actions:[{label, value, cls}], def } -> Promise<value|null> */
    show(id, o) {
      if (this.off(id)) {
        // guide switched off: do the default action right away (still inside the user's click)
        const d = (o.actions || []).find(a => a.value === o.def);
        if (d && d.run) d.run();
        return Promise.resolve(o.def != null ? o.def : null);
      }
      return new Promise(resolve => {
        let result = null;
        const m = UI.modal({
          title: `${o.icon || NI('bulb', 22)} ${o.title}`, cls: 'narrow guide-modal',
          body: `${o.intro ? `<p class="guide-intro">${o.intro}</p>` : ''}
            ${o.steps && o.steps.length ? `<div class="guide-label">Что сделать:</div><ol class="guide-steps">${o.steps.map(s => `<li>${s}</li>`).join('')}</ol>` : ''}
            ${o.levels ? `<div class="guide-label">Насколько работает:</div>${this.levelsHtml(o.levels)}` : ''}
            ${o.expect ? `<div class="guide-box ok"><b>Что вы получите</b><div>${o.expect}</div></div>` : ''}
            ${o.now ? `<div class="guide-box"><b>Что будет сейчас</b><div>${o.now}</div></div>` : ''}
            <label class="switch small" style="margin-top:4px"><input type="checkbox" data-never><span class="track"></span><span>Больше не показывать эту подсказку</span></label>`,
          foot: (o.actions || [{ label: 'Понятно', value: o.def != null ? o.def : true, cls: 'primary' }])
            .map((a, i) => `<button class="btn ${a.cls || ''}" data-gi="${i}">${a.label}</button>`).join(''),
          onClose: () => resolve(result),
        });
        m.el.querySelector('.modal-foot').onclick = e => {
          const b = e.target.closest('[data-gi]'); if (!b) return;
          const a = (o.actions || [{ value: o.def != null ? o.def : true }])[+b.dataset.gi];
          if (m.$('[data-never]').checked) this.setOff(id);
          result = a.value;
          m.close();
          if (a.run) a.run(); // runs inside the click — browsers allow opening windows here
        };
      });
    },

    /** [{label, pct, text}] -> bars "Сейчас 30% — …", "С ключом 100% — …" */
    levelsHtml(levels) {
      return `<div class="lvl-list">${levels.map(l => `<div class="lvl ${l.pct >= 100 ? 'full' : l.pct >= 60 ? 'mid' : 'low'}">
        <div class="lvl-head"><b>${l.label}</b><span>${l.pct}%</span></div>
        <div class="lvl-bar"><i style="width:${l.pct}%"></i></div>
        <div class="lvl-text">${l.text}</div></div>`).join('')}</div>`;
    },

    /** live overview for Settings: every service, how much works NOW, and what to do for 100% */
    statusRows() {
      const st = Store.settings;
      const bridge = AI.bridge.up;
      const hasKey = k => !!(st[k] || '').trim();
      const voiceNo = typeof TTS !== 'undefined' && TTS.hasNorwegianVoice();
      const mac = onMac();
      const T = window.Translators && Translators.LIST ? Translators.LIST : {};
      const gWeb = !!(T.google && T.google.web);
      const proOn = proOffered(), proActive = proOn && window.Pro && Pro.isActive && Pro.isActive();
      return [
        proOn ? [`${NI('crown')} Norsk Kort Pro`, proActive ? 100 : 0, proActive ? 'подключено — нейросеть, перевод и голоса без своих ключей' : 'нейросеть, перевод и голоса без своих ключей', proActive ? '' : 'Настройки → Norsk Kort Pro'] : null,
        gWeb ? [`${NI('translate')} Google переводчик`, 30, 'открывается сайт Google Переводчика с вашим словом', 'перевод прямо в карточке дадут Norsk Kort Pro, ваша нейросеть или Microsoft с ключом']
          : [`${NI('translate')} Google переводчик`, 100, 'бесплатно, без ключа', ''],
        T.mymemory && !T.mymemory.hidden ? [`${NI('translate')} MyMemory`, 100, 'бесплатно, без ключа (≈5000 символов в день)', ''] : null,
        mac ? [`${NI('translate')} DeepL`, hasKey('deeplKey') && bridge ? 100 : 30, hasKey('deeplKey') ? (bridge ? 'ключ есть, мост запущен — перевод в карточке' : 'ключ есть, но нужен мост на Mac; на телефоне — сайт') : 'без ключа открывается сайт', hasKey('deeplKey') ? (bridge ? '' : 'запустите мост bridge/server.py') : 'добавьте бесплатный ключ DeepL API Free']
          : [`${NI('translate')} DeepL`, 30, 'открывается сайт DeepL с вашим словом', 'перевод в карточке дадут Microsoft с ключом или нейросеть'],
        [`${NI('translate')} Microsoft`, hasKey('msKey') ? 100 : 30, hasKey('msKey') ? 'ключ есть — перевод в карточке' : 'без ключа открывается Bing', hasKey('msKey') ? '' : 'добавьте бесплатный ключ Azure (F0)'],
        [`${BOT()} Нейросеть`, AI.available() ? 100 : 35, AI.available() ? `${AI.name()} подключена — все ИИ-функции` : 'не подключена — работают словари и переводчики', AI.available() ? '' : proOn ? 'Norsk Kort Pro или бесплатный Google Gemini / Groq' : 'подключите бесплатный Google Gemini или Groq'],
        mac ? [`${BOT()} Claude по подписке`, AI.bridge.ok ? 100 : 0, AI.bridge.ok ? 'мост работает'
          : bridge && AI.bridge.auth === 'bad' ? 'вход в Claude закончился — войдите ещё раз (один раз примерно на год)'
            : bridge && !AI.bridge.path ? 'мост запущен, но Claude Code не найден' : bridge ? 'мост запущен, Claude пока не ответил' : 'только на Mac через мост',
          AI.bridge.ok ? '' : bridge && AI.bridge.auth === 'bad' ? 'Настройки → Нейросети → «Войти в Claude»' : 'запустите мост (и войдите в Claude Code)'] : null,
        [`${NI('book')} Ordbøkene`, 100, 'статья, примеры, выражения, формы — с переводом', ''],
        [`${NI('dialogue')} Tatoeba`, 100, 'живые примеры NO→RU', ''],
        [`${NI('book')} Glosbe, LEXIN, NAOB, Яндекс`, 90, 'через «Вставить»: копируете на сайте — приложение переводит', 'автоматически невозможно — сайты закрыты'],
        [`${NI('image')} ИИ-картинки`, hasKey('pollinationsToken') ? 100 : 70, hasKey('pollinationsToken') ? 'ИИ рисует по смыслу' : 'фото из Википедии и эмодзи-картинки', hasKey('pollinationsToken') ? '' : 'бесплатный ключ Pollinations'],
        [`${NI('speaker')} Озвучка`, voiceNo ? 100 : 80, voiceNo ? 'норвежский голос есть на устройстве' : 'нет норвежского голоса на устройстве — читает онлайн-голос', voiceNo ? '' : mac ? 'скачайте голос «Nora» в настройках macOS' : 'голоса — Настройки → Озвучка'],
        [`${NI('mic')} Живой голос носителя`, 40, 'записи есть для части слов (Lingua Libre)', ''],
      ].filter(Boolean);
    },
    statusHtml() {
      return `<div class="status-grid">${this.statusRows().map(([n, pct, text, todo]) => `<div class="lvl ${pct >= 100 ? 'full' : pct >= 60 ? 'mid' : 'low'}">
        <div class="lvl-head"><b>${n}</b><span>${pct}%</span></div><div class="lvl-bar"><i style="width:${pct}%"></i></div>
        <div class="lvl-text">${text}${todo ? `<br><span class="lvl-todo">для 100%: ${todo}</span>` : ''}</div></div>`).join('')}</div>`;
    },

    /* ---------- ready-made guides ---------- */

    /** a neural network is needed for this button */
    needAI(feature) {
      const B = (window.AI && AI.bridge) || {};
      if (window.App && App.updateBadge) { try { App.updateBadge(); } catch (e) { /* not drawn yet */ } } // the 🤖 button tells the truth too
      // Claude by subscription is connected, only its login on this Mac expired: the re-login help, not «connect a key»
      if (onMac() && B.up && B.auth === 'bad' && !(window.AI && AI.available()) && window.AIHub && AIHub.authHelp) { AIHub.authHelp(); return Promise.resolve(null); }
      const pro = proOffered() && !(window.Pro && Pro.isActive && Pro.isActive());
      return this.show('need-ai', {
        icon: BOT(24), title: 'Нужна нейросеть',
        intro: `Функция «${U.esc(feature)}» работает через нейросеть, а она ещё не подключена. Это бесплатно и займёт 2 минуты.`,
        steps: [
          'Откройте <b>Google AI Studio</b> (кнопка ниже) и войдите своим Google-аккаунтом.',
          'Нажмите <b>«Create API key»</b> и скопируйте ключ.',
          `В приложении: <b>Настройки → Нейросети → Google Gemini</b> → вставьте ключ → «Проверить».`,
        ].concat(pro ? ['Или без ключей: <b>Norsk Kort Pro</b> — всё уже настроено (кнопка ниже).'] : []),
        levels: [
          { label: 'Сейчас, без нейросети', pct: 35, text: `работают: ${onMac() ? 'переводчики Google/MyMemory, ' : ''}Ordbøkene (статья + формы), Tatoeba (примеры), синонимы из словаря, фото по смыслу` },
          { label: 'С бесплатным Gemini или Groq', pct: 100, text: 'всё: проверка карточек, объяснения, полные формы с переводом, примеры по временам, синонимы с разницей, колоды по темам' },
        ],
        expect: 'Проверка карточек, объяснения, все формы слова с переводом, примеры, синонимы, новые колоды по темам.' + (onMac() ? ' На Mac можно вместо этого подключить Claude по вашей подписке (мост).' : '')
          + (window.AIHub ? `<br>Как только нейросеть заработает, откроется <b>${BOT()} Центр нейросети</b> — там по шагам, что делать дальше.` : ''),
        actions: [
          { label: 'Позже', value: null, cls: 'ghost' },
          { label: `${NI('key')}<span>Получить ключ Gemini ↗</span>`, value: 'key', run: () => window.open('https://aistudio.google.com/apikey', '_blank', 'noopener') },
          ...(pro ? [{ label: `${NI('crown')}<span>Norsk Kort Pro</span>`, value: 'pro', run: () => Pro.require(feature, { reason: 'ai' }) }] : []),
          { label: `${NI('gear')}<span>Открыть настройки</span>`, value: 'settings', cls: pro ? '' : 'primary', run: () => App.go('settings') },
        ],
      });
    },

    /** DeepL / Microsoft pressed without a key */
    needKey(trId, openFn) {
      const t = Translators.LIST[trId];
      const deepl = trId === 'deepl';
      return this.show('need-key-' + trId, {
        icon: NI('key', 22), title: `${t.name}: нужен бесплатный ключ`,
        intro: `Чтобы перевод ${t.name} появлялся <b>прямо в карточке</b>, нужен бесплатный ключ. Без ключа сайт ${t.name} откроется в новой вкладке с вашим словом.`,
        steps: deepl ? [
          'Зарегистрируйтесь на <b>DeepL API Free</b> (кнопка ниже). Это бесплатно: 500 000 символов в месяц, но DeepL может попросить карту для проверки, денег не списывает.',
          'В личном кабинете откройте <b>API Keys</b> и скопируйте ключ (он заканчивается на <code>:fx</code>).',
          'В приложении: <b>Настройки → Переводчики → DeepL</b> → вставьте ключ.',
          onMac() ? 'Важно: DeepL не пускает запросы прямо из браузера, поэтому на Mac должен быть запущен <b>мост</b> (bridge/server.py). На телефоне DeepL будет открываться сайтом.'
            : 'Важно: DeepL не пускает запросы прямо из браузера, поэтому здесь DeepL открывается своим сайтом с вашим словом. Перевод прямо в карточке дают Microsoft (с ключом), нейросети и Norsk Kort Pro.',
        ] : [
          'Создайте бесплатный ресурс <b>Azure Translator</b> (тариф F0, 2 млн символов в месяц) — инструкция по кнопке ниже.',
          'Скопируйте <b>ключ</b> и <b>регион</b> (например westeurope).',
          'В приложении: <b>Настройки → Переводчики → Microsoft</b> → вставьте ключ и регион.',
        ],
        levels: deepl ? [
          { label: 'Сейчас, без ключа', pct: 30, text: 'открывается сайт DeepL с вашим словом — переносить вручную' },
          ...(onMac() ? [{ label: 'С ключом на Mac (мост запущен)', pct: 100, text: 'перевод DeepL прямо в карточке, сверка, значок в истории' },
            { label: 'С ключом на телефоне', pct: 30, text: 'DeepL не пускает браузер без моста — откроется сайт' }]
            : [{ label: 'С ключом в версии на сайте', pct: 30, text: 'DeepL не пускает браузер — откроется сайт DeepL' }]),
        ] : [
          { label: 'Сейчас, без ключа', pct: 30, text: 'открывается Bing Translator с вашим словом' },
          { label: 'С ключом (Mac и телефон)', pct: 100, text: 'перевод Microsoft прямо в карточке, сверка, значок в истории' },
        ],
        expect: `Перевод ${t.name} сразу в карточке, сверка «✓ совпадает / ≠ отличается», значок ${t.name} в истории карточки.`,
        now: `Если нажать «Открыть сайт» — откроется ${t.name} с вашим словом.${onMac() ? ' Бесплатные Google и MyMemory работают в карточке без всяких ключей.' : ''}`,
        def: 'open',
        actions: [
          { label: `${NI('key')}<span>Как получить ключ ↗</span>`, value: 'key', run: () => window.open(t.keyUrl, '_blank', 'noopener') },
          { label: `${NI('gear')}<span>Настройки</span>`, value: 'settings', run: () => App.go('settings') },
          { label: `↗ Открыть сайт ${t.name}`, value: 'open', cls: 'primary', run: openFn },
        ],
      });
    },

    /** dictionary website: copy -> paste flow */
    webDict(id, openFn) {
      const t = Translators.LIST[id];
      const lexin = id === 'lexin';
      return this.show('web-dict', {
        icon: NI('book', 22), title: `${t.name}: как перенести в карточку`,
        intro: `${t.name} не даёт приложениям доступ к своим данным, поэтому берём текст через копирование — это законно и быстро.`,
        steps: [
          lexin ? 'Нажмите «Открыть» — откроется LEXIN, а слово уже <b>скопировано</b>: вставьте его в поиск (⌘V) и выберите <b>bokmål–russisk</b>.' : `Нажмите «Открыть» — откроется ${t.name} уже с вашим словом.`,
          'Выделите нужный текст (значения, примеры) и скопируйте: <b>⌘C</b> (на телефоне — «Скопировать»).',
          `Вернитесь в приложение и нажмите <b>«📋 Вставить из ${t.name}»</b> в уведомлении (или в меню 📚 → «📋 Вставить в карточку»).`,
          'Проверьте предпросмотр и нажмите <b>«➕ Добавить в карточку»</b>.',
        ],
        levels: [
          { label: `Автоматически из ${t.name}`, pct: 0, text: 'невозможно: сайт закрыт для приложений (и мы его не взламываем)' },
          { label: 'Через «📋 Вставить»', pct: 90, text: 'всё, что вы скопируете, попадёт в карточку с переводом и значком словаря; перевод делает Google — иногда неточен' },
        ],
        expect: 'Каждая норвежская строка получит <span class="gloss">(русский перевод в скобках)</span>, строки на русском останутся как есть. Блок будет подписан значком и названием словаря и попадёт в историю карточки.',
        def: 'open',
        actions: [{ label: 'Отмена', value: null, cls: 'ghost' }, { label: `↗ Открыть ${t.name}`, value: 'open', cls: 'primary', run: openFn }],
      });
    },

    /** pictures: why a photo / emoji instead of an AI drawing */
    images() {
      return this.show('images', {
        icon: NI('image', 22), title: 'Почему фото или эмодзи, а не ИИ-рисунок',
        intro: 'Бесплатный генератор ИИ-рисунков Pollinations теперь требует бесплатный ключ. Без него приложение всё равно подбирает картинку по смыслу: <b>фото из Википедии</b> для предметов или <b>эмодзи-картинку</b> для абстрактных слов.',
        steps: [
          'Получите бесплатный ключ на <b>enter.pollinations.ai</b> (кнопка ниже).',
          'Вставьте его в <b>Настройки → Картинки → «Ключ Pollinations»</b>.',
        ],
        levels: [
          { label: 'Сейчас, без ключа', pct: 70, text: 'предметы — точные фото из Википедии (bil → машина), абстрактные слова и фразы — эмодзи-картинка по смыслу всей карточки' },
          { label: 'С ключом Pollinations', pct: 100, text: 'ИИ рисует сцену по смыслу любого слова, даже «завтра» или «надеяться», а у фраз — по смыслу всей фразы («i dag regner det» → дождливая улица)' },
        ],
        expect: 'Нарисованные ИИ картинки по смыслу каждого слова. «🎨 Перерисовать» каждый раз даёт новый вариант.',
        now: 'Картинка уже есть (фото или эмодзи). «🎨 Перерисовать» покажет другое фото этого слова.',
        actions: [
          { label: 'Понятно', value: true, cls: 'ghost' },
          { label: `${NI('key')}<span>Получить ключ ↗</span>`, value: 'key', cls: 'primary', run: () => window.open('https://enter.pollinations.ai', '_blank', 'noopener') },
        ],
      });
    },

    /** native speaker audio is missing for this word */
    noNative(word) {
      return this.show('no-native', {
        icon: NI('mic', 22), title: 'Записи носителя пока нет',
        intro: `Для «${U.esc(word)}» нет записи на Lingua Libre (это бесплатная база голосов носителей, она пополняется добровольцами). Сейчас синтезированный голос прочитает всю карточку — паузу, стоп и «сначала» можно нажать в панели озвучки.`,
        steps: ['Послушать живое произношение можно на <b>Forvo</b>: справа на карточке 📚 → Forvo → «Открыть».'],
        levels: [
          { label: 'Записи носителей (🎙)', pct: 40, text: 'есть для части слов, в основном частых (bil, katt, spise); база пополняется добровольцами' },
          { label: 'Синтезированный голос (🔊)', pct: 100, text: 'любое слово и текст; качество зависит от голоса в системе (на Mac — «Nora»)' },
        ],
        expect: 'Для частых слов (bil, katt, spise…) записи носителей уже есть — кнопка 🎙 сыграет их.',
        actions: [{ label: 'Понятно', value: true, cls: 'primary' }],
      });
    },
  };

  window.Guides = Guides;
})();
