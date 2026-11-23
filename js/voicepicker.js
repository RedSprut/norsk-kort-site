/* ============ 🔊 «Голоса»: choose a voice per language (🇳🇴 🇺🇦 🇷🇺), listen first, download offline voices, connect services ============
 * Loaded on first use by Voices.openChooser(lang) (js/voices.js) together with css/voicepicker.css.
 * Everything a voice needs is shown as a calm next step on its card («⬇ Скачать», «🔑 Подключить», «нужна установка на Mac»);
 * technical errors are never shown. Keys are saved through Store (sealed on the device, never in backups / exports).
 * 📍 «Где какой голос»: a row per place (cards, reader, video…) with a chip per language — tapping a chip opens this same
 * list for that place and language (st.place), «Как везде» on top; a pick there is the voice of that place only.
 */
(function () {
  const V = window.Voices;
  const esc = s => U.esc(String(s == null ? '' : s));
  const MB = 1e6; // as the phone / Finder count: 63 221 984 bytes = «63 МБ»
  const fmtMB = b => !b ? '0 МБ' : b < MB ? '<1 МБ' : b >= 1e9 ? (b / 1e9).toFixed(1).replace('.', ',') + ' ГБ' : (b / MB < 10 ? (b / MB).toFixed(1).replace('.', ',') : Math.round(b / MB)) + ' МБ';
  const fmtN = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const SAFARI = /Safari/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR|Android/.test(navigator.userAgent);
  const ANDROID = /Android/.test(navigator.userAgent);
  const TAB_ORDER = ['no', 'uk', 'ru'];
  const GROUPS = [
    ['offline', '📴', 'Без интернета', 'бесплатно · скачивается один раз'],
    ['online', '🌐', 'Онлайн', 'бесплатно · нужен интернет'],
    ['mac', '💻', 'Через мост на Mac', 'бесплатно · нейроголоса Microsoft'],
    ['key', '🔑', 'С вашим ключом', 'бесплатный месячный лимит'],
    ['device', '📱', 'Голоса этого устройства', 'бесплатно · без интернета'],
  ];
  const AZ_REGIONS = ['westeurope', 'northeurope', 'swedencentral', 'norwayeast', 'germanywestcentral', 'francecentral', 'uksouth', 'eastus', 'westus2'];
  const KEY_INFO = {
    azure: {
      title: 'Microsoft Azure Speech', tag: 'Рекомендуем', field: 'azureKey',
      free: '<b>Бесплатно 500 000 знаков в месяц.</b> Одна карточка — примерно 20 знаков, то есть около <b>25 000 озвучек в месяц</b>. Бесплатный тариф <b>F0 не умеет списывать деньги</b>: когда лимит кончится, голос просто замолчит до 1-го числа, а приложение возьмёт запасной. Нужна учётная запись Microsoft; карту могут попросить только для проверки личности.',
      steps: [
        'Откройте <a href="https://portal.azure.com" target="_blank" rel="noopener">portal.azure.com</a> и войдите с учётной записью Microsoft (или создайте бесплатную).',
        'Нажмите <b>«Create a resource»</b>, найдите <b>«Speech»</b> и нажмите <b>Create</b>.',
        'Заполните: Resource group — <b>Create new</b> (любое имя), Region — например <b>West Europe</b>, Name — любое, <b>Pricing tier — Free F0</b>. Нажмите <b>Review + create</b> → <b>Create</b>.',
        'Когда ресурс готов, нажмите <b>«Go to resource»</b> → слева <b>«Keys and Endpoint»</b>.',
        'Скопируйте <b>KEY 1</b> и <b>Location/Region</b> (например <code>westeurope</code>) и вставьте их ниже.',
        'Нажмите <b>«✓ Проверить»</b> — вы услышите голос. Готово!',
      ],
    },
    gcloud: {
      title: 'Google Cloud Text-to-Speech', tag: '30 голосов Google · нужна карта', field: 'gcloudKey',
      free: '<b>Бесплатно 1 млн знаков в месяц</b> на голоса Chirp 3 HD — те самые Umbriel, Despina, Sulafat, Algenib… Для норвежского и украинского их 30, для русского — 8. Ещё 4 млн знаков — на голоса попроще (WaveNet и Standard). Одна карточка — примерно 20 знаков, то есть около <b>45 000 озвучек в месяц</b>.',
      warn: '⚠️ Google требует <b>привязать банковскую карту</b>, а <b>сверх лимита списывает деньги</b>. Поэтому приложение <b>само останавливается на 950 000 знаков</b> (можно поставить меньше — ниже) и до 1-го числа читает запасным голосом. Пока вы в бесплатном лимите, деньги не спишутся. Для надёжности оставьте ключу только «Cloud Text-to-Speech API» и поставьте бюджет 1 $ с оповещением (Billing → Budgets &amp; alerts).',
      steps: [
        'Откройте <a href="https://console.cloud.google.com" target="_blank" rel="noopener">console.cloud.google.com</a> и войдите своим аккаунтом Google. Создайте проект: вверху «Select a project» → <b>New project</b>.',
        'Подключите оплату: <b>Billing</b> → <b>Link a billing account</b> → добавьте карту. Пока вы в бесплатном лимите, деньги не спишутся.',
        'Включите голоса: <a href="https://console.cloud.google.com/apis/library/texttospeech.googleapis.com" target="_blank" rel="noopener">APIs &amp; Services → Library → «Cloud Text-to-Speech API»</a> → <b>Enable</b>.',
        '<b>APIs &amp; Services → Credentials → Create credentials → API key</b>. Нажмите «Edit API key» и в «API restrictions» оставьте только Cloud Text-to-Speech API.',
        'Скопируйте ключ (он начинается с <code>AIza</code>), вставьте ниже и нажмите «✓ Проверить» — прозвучит голос.',
      ],
    },
    gemini: {
      title: 'Google Gemini — ключ AI Studio', tag: 'Только для себя · без карты', field: 'geminiKey',
      free: () => `<b>Без банковской карты.</b> Те же 30 голосов Google — Umbriel, Despina, Sulafat… — и для русского тоже все 30. Но бесплатный лимит маленький: <b>около 10 фраз в день на каждую модель</b>; приложение по очереди берёт несколько моделей, и выходит <b>несколько десятков новых фраз в день</b>. Озвученная фраза остаётся на устройстве и второй раз лимит не тратит. Лимит обновляется каждый день (у нас — около ${resetHM()}). Норвежский и русский — да, <b>украинского у Gemini нет</b>.`,
      warn: '👤 <b>Только для личного пользования.</b> Каждый подключает свой аккаунт Google и сам за него отвечает. На бесплатном тарифе Google может использовать отправленный текст, чтобы улучшать свои модели, — не озвучивайте ничего личного. Встраивать бесплатный Gemini в приложение для других людей в Европе (и в Норвегии) условия Google не разрешают, поэтому здесь каждый вставляет только свой ключ. <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener">Условия Gemini API</a>',
      steps: [
        'Откройте <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com</a> и войдите своим аккаунтом Google.',
        'Нажмите <b>«Create API key»</b>. Если попросят выбрать проект — создайте новый, это бесплатно. Карта не нужна.',
        'Скопируйте ключ (он начинается с <code>AIza</code>) и вставьте ниже.',
        'Нажмите «✓ Проверить» — прозвучит голос. Готово: голоса Gemini появятся в списке «С вашим ключом».',
      ],
    },
    eleven: {
      title: 'ElevenLabs', tag: 'Для личного использования', field: 'elevenKey',
      free: '<b>Бесплатно около 10 000 кредитов в месяц</b> — это примерно 15–20 минут речи, <b>500–1000 карточек</b>. Только для <b>личного, некоммерческого</b> использования. Голоса очень живые; для норвежского лучше выбрать носителя языка в библиотеке голосов.',
      steps: [
        'Зарегистрируйтесь на <a href="https://elevenlabs.io" target="_blank" rel="noopener">elevenlabs.io</a> (бесплатно).',
        'Профиль → <b>API Keys</b> → <b>Create API key</b> (достаточно права «Text to Speech»).',
        'Вставьте ключ ниже и нажмите «✓ Проверить». Кнопка «Мои голоса» покажет голоса из вашей библиотеки.',
      ],
    },
  };
  const resetHM = () => { const d = new Date(V.GEM.resetAt()); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const KEY_ORDER = ['azure', 'gcloud', 'gemini', 'eleven'];
  const LIST_SHORT = 8; // a long list (30 Google voices) shows this many first — «Показать все» opens the rest in place
  const WHY = {
    site: ['💻 Только в приложении на Mac', 'Эти голоса работают через мост на Mac. Здесь те же голоса доступны через Azure — бесплатный ключ подключается за 10 минут.'],
    bridge: ['💻 Мост на Mac не запущен', 'Запустите мост — и голоса Edge заработают бесплатно.'],
    install: ['💻 Нужна установка на Mac', 'Голоса Edge ставятся на Mac один раз — кнопкой «⬇ Установить» в этом разделе.'],
    old: ['💻 Мост нужно перезапустить', 'Мост на Mac старой версии — его нужно один раз перезапустить.'],
    key: ['🔑 Нужен ключ', 'Подключите сервис — бесплатный ключ, все шаги ниже.'],
    badkey: ['🔑 Ключ не подходит', 'Сервис не принял ключ. Проверьте его в разделе «Подключения».'],
    quota: ['⏳ Лимит на месяц исчерпан', 'Бесплатный лимит закончился — голос вернётся 1-го числа. Пока читает запасной.'],
    stale: ['💻 Голоса Edge нужно обновить', 'Microsoft поменяла защиту — обновите голоса Edge одной кнопкой в этом разделе.'],
    billing: ['💳 Подключите оплату в Google Cloud', 'Без платёжного аккаунта Google не озвучивает. Деньги не спишутся, пока вы в бесплатном лимите.'],
    blocked: ['🚫 Бесплатный тариф приостановлен', 'ElevenLabs приостановил бесплатный тариф — так бывает, если включён VPN. Ключ при этом верный.'],
    region: ['🌍 Недоступно в этой стране', 'Бесплатный Gemini не работает из этой страны.'],
    nolang: ['🇺🇦 Нет украинского', 'Gemini не говорит по-украински.'],
    down: ['⏸ Временно не отвечает', 'Голос недавно не ответил — пока читает запасной. Можно попробовать «▶ Послушать».'],
    offline: ['🌐 Нужен интернет', 'Сейчас нет интернета — этот голос заработает, когда связь вернётся.'],
    download: ['⬇ Не скачан', ''],
    nosupport: ['⚠ Не работает в этом браузере', 'Офлайн-голосам нужны WebAssembly и хранилище браузера.'],
    nosys: ['Нет на устройстве', ''],
  };
  const st = { allv: {}, lang: 'no', place: '', open: { places: true, offline: true, online: true, mac: true, key: false, device: false }, keyOpen: {}, dl: {}, playing: '', kar: null, prog: null, check: {}, editChain: false, own: '', more: {}, draft: {},
    recs: {}, edge: {}, anchor: '' };
  // recs: the «⭐ Рекомендуем» cards keep their order while the window is open · edge: the one-click Edge install
  // ({ phase: '' | installing | fail | restart | restarting | done, error }) · anchor: the card the person works with
  // stays exactly where it is when the window redraws
  let m = null;

  /** the pick the list shows: the place's own voice (place mode) or the voice «как везде» ('' = Авто / как везде) */
  const curPick = () => st.place ? V.placePick(st.place, st.lang) : V.pickOf(st.lang);
  const setCur = id => { if (st.place) V.setPlacePick(st.place, st.lang, id); else V.setPick(st.lang, id); };

  /* ---------- pieces ---------- */
  const stars = q => `<span class="vp-stars" aria-hidden="true">${'★'.repeat(q)}<i>${'★'.repeat(5 - q)}</i></span>`;
  const qBadge = q => `<span class="vp-q q${q}" title="Оценка качества звучания: ${q} из 5">${stars(q)}<span>${V.QUALITY[q] || ''}</span></span>`;
  const initial = e => (e.name || '?').replace(/[^\p{L}\p{N}]/gu, '').charAt(0).toUpperCase() || '♪';
  const hue = e => (V.ENGINES[e.engine] || {}).hue || 220;
  function chips(e, a) {
    const out = [];
    const ch = (t, c) => out.push(`<span class="vp-chip ${c || ''}">${t}</span>`);
    if (e.engine === 'piper') {
      ch('🆓 бесплатно', 'free');
      ch('📴 без интернета', 'off');
      if (a.ok) ch('✓ скачан', 'ok'); else if (e.size) ch('⬇ ' + fmtMB(e.size), 'size');
      // one honest warning at most (the rest is under «Подробнее»)
      if (/неизвестн/.test(e.licence || '')) ch('🔒 личное', 'priv'); else if (e.stress) ch('⚠ ударения', 'warn');
    } else if (e.engine === 'gtr') { ch('🆓 бесплатно', 'free'); ch('🌐 нужен интернет', 'net'); }
    else if (e.engine === 'edge') { ch('🆓 бесплатно', 'free'); ch('🌐 нужен интернет', 'net'); ch('💻 через Mac', 'mac'); }
    else if (e.engine === 'sys') { ch('🆓 бесплатно', 'free'); ch(e.local ? '📴 без интернета' : '🌐 нужен интернет', e.local ? 'off' : 'net'); }
    else {
      ch('🔑 нужен ключ', 'key'); ch('🌐 нужен интернет', 'net');
      if (e.engine === 'eleven') ch('🔒 личное', 'priv');
      if (e.engine === 'gemini') ch('👤 только для себя', 'priv');
    }
    return out.join('');
  }
  function why(a, e) {
    if (a.why === 'quota' && e) {
      const mt = V.Limits.meter(e.engine, e.key);
      return mt === 'gemini' ? ['⏳ Лимит на сегодня исчерпан', `Вернётся ${V.Limits.resetText(mt)}. Пока читает запасной.`] : [`⏳ Лимит до ${V.Limits.resetText(mt)}`, 'Бесплатный лимит этого месяца закончился. Пока читает запасной.'];
    }
    return WHY[a.why] || ['', ''];
  }

  /** the main action of a card: pick it, or what it needs first */
  function actions(e, a, picked, mini) {
    const playable = a.ok || a.why === 'down' || a.why === 'quota';
    const play = playable ? `<button type="button" class="vp-btn vp-play${st.playing === e.id ? ' on' : ''}" data-vp-play="${esc(e.id)}" aria-label="${st.playing === e.id ? 'Остановить' : 'Послушать голос ' + esc(e.name)}">${st.playing === e.id ? '■ Стоп' : '▶ Послушать'}</button>` : '';
    const pick = `<button type="button" role="radio" aria-checked="${picked}" class="vp-btn vp-pick${picked ? ' on' : ''}" data-vp-pick="${esc(e.id)}" aria-label="${picked ? 'Выбран' : 'Выбрать'}: ${esc(e.name)}">${picked ? '✓ Выбран' : '◉ Выбрать'}</button>`;
    if (a.ok || a.why === 'down' || a.why === 'quota') return play + pick;
    if (a.why === 'download') {
      if (st.dl[e.key]) return dlSlot(e);
      return `<button type="button" class="vp-btn vp-dl" data-vp-dl="${esc(e.key)}">⬇ Скачать · ${fmtMB(e.size)}</button>`;
    }
    if (a.why === 'key' || a.why === 'badkey' || a.why === 'billing') return `<button type="button" class="vp-btn vp-connect" data-vp-connect="${e.engine}">🔑 Подключить</button>`;
    // Edge before the one-click install: the same two buttons, resting — they wake up in place when the voices are there
    if (e.engine === 'edge' && (a.why === 'install' || a.why === 'old' || a.why === 'bridge' || a.why === 'stale')) {
      return `<button type="button" class="vp-btn vp-play" disabled aria-label="Послушать: сначала установите голоса Edge">▶ Послушать</button><button type="button" class="vp-btn vp-pick" disabled aria-label="Выбрать: сначала установите голоса Edge">◉ Выбрать</button>`;
    }
    return '';
  }
  function speakerSel(e, picked) {
    if (!e.speakers) return '';
    const cp = V.parse(curPick());
    const cur = cp.engine === 'piper' && cp.key === e.key ? cp.spk : V._spkOf(e.key);
    return `<label class="vp-spk"><span>Диктор</span><select class="input" data-vp-spk="${esc(e.key)}" aria-label="Диктор: ${esc(e.name)}">${Object.entries(e.speakers).map(([k, n]) => `<option value="${esc(k)}" ${k === cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
  }
  const leftTxt = d => {
    const left = d.speed > 0 ? Math.max(0, (d.total - d.done) / d.speed) : 0;
    return `${fmtMB(d.done)} из ${fmtMB(d.total)}${left > 3 ? ' · ~' + (left < 90 ? Math.max(5, Math.round(left / 5) * 5) + ' с' : Math.round(left / 60) + ' мин') : ''}`;
  };
  /** the download in progress: a bar in place of the «⬇ Скачать» button — the card keeps its height */
  function dlSlot(e) {
    const d = st.dl[e.key];
    if (d.err) return `<div class="vp-dlp err" data-dlp="${esc(e.key)}"><span class="vp-dlbar"><span data-dlp-txt>⚠ Не скачалось</span></span><button type="button" class="vp-btn" data-vp-dl="${esc(e.key)}">🔁 Ещё раз</button></div>`;
    const pctv = d.total ? Math.min(100, Math.round(d.done / d.total * 100)) : 0;
    return `<div class="vp-dlp" data-dlp="${esc(e.key)}">
      <span class="vp-dlbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pctv}" aria-label="Скачивание голоса ${esc(e.name)}"><i style="width:${pctv}%"></i><span data-dlp-txt>${d.total ? leftTxt(d) : 'Начинаю скачивание…'}</span></span>
      <button type="button" class="vp-btn ghost sq" data-vp-cancel="${esc(e.key)}" aria-label="Отменить скачивание" title="Отменить">✕</button></div>`;
  }
  function card(e, o = {}) {
    const lang = st.lang;
    const a = V.avail(e.id, lang);
    const pick = curPick();
    const pp = V.parse(pick);
    const picked = !!pick && (pick === e.id || (e.engine === 'piper' && pp.engine === 'piper' && pp.key === e.key));
    const [wt, wd] = a.ok ? ['', ''] : why(a, e);
    const ok = a.ok || a.why === 'down' || a.why === 'quota';
    const more = !o.mini && (e.about || e.licence || (e.engine === 'piper' && a.ok));
    // Edge: one short line while the voices wait for the install — and a «✓» line in its place right after it,
    // so the cards keep their height when the voices wake up
    const edgeNote = e.engine === 'edge' ? (a.ok && st.edge.phase === 'done' ? '<div class="vp-note good">✓ Установлено на Mac</div>'
      : a.why === 'install' || a.why === 'old' || a.why === 'stale' ? `<div class="vp-note">${esc(wt)}</div>` : null) : null;
    return `<article class="vp-card${picked ? ' is-picked' : ''}${ok ? '' : ' is-off'}${st.playing === e.id ? ' is-playing' : ''}${o.mini ? ' mini' : ''}" data-card="${esc(e.id)}" data-anchor="${esc((o.where || 'g') + ':' + e.id)}">
      <div class="vp-ava" style="--h:${hue(e)}" aria-hidden="true">${esc(initial(e))}</div>
      <div class="vp-info">
        <div class="vp-name"><b>${esc(e.name)}</b>${e.g ? `<span class="vp-g" title="${e.g === '♀' ? 'женский голос' : 'мужской голос'}">${e.g}</span>` : ''}${o.tag ? `<span class="vp-tag">${esc(o.tag)}</span>` : ''}</div>
        <div class="vp-eng">${esc((V.ENGINES[e.engine] || {}).short || '')}${e.ch ? ` · <span class="vp-ch">${esc(e.ch)}</span>` : ''}</div>
        ${qBadge(e.q)}
        <div class="vp-chips">${chips(e, a)}</div>
        ${edgeNote != null ? edgeNote : a.why === 'quota' || a.why === 'badkey' || a.why === 'down' || a.why === 'billing' || a.why === 'blocked' ? `<div class="vp-note">${esc(wt)}</div>` : !ok && wt && a.why !== 'download' && a.why !== 'key' ? `<div class="vp-note">${esc(wt)}${wd && !o.mini ? `<small>${esc(wd)}</small>` : ''}</div>` : ''}
        ${!o.mini ? speakerSel(e, picked) : ''}
      </div>
      <div class="vp-acts">${actions(e, a, picked, o.mini)}</div>
      ${st.playing === e.id ? '<div class="vp-pbar" aria-hidden="true"><i data-pbar></i></div>' : ''}
      ${more ? `<details class="vp-more"${st.more[e.id] ? ' open' : ''} data-more="${esc(e.id)}"><summary>Подробнее</summary><div class="small">${e.about ? esc(e.about) : ''}
        ${e.engine === 'piper' ? `<br>Лицензия записи: ${esc(e.licence || '—')} · программа Piper: MIT · фонемы espeak-ng (GPL-3.0) скачиваются с CDN.${e.stress ? '<br>Ударения ставятся по правилам — в редких словах бывают ошибки.' : ''}` : ''}
        <br>Оценка «${esc(V.QUALITY[e.q] || '')}» — по независимым замерам и на слух: ★★★★★ как живой человек, ★★ заметно «роботский».
        ${e.engine === 'piper' && a.ok ? `<div class="vp-row"><button type="button" class="vp-btn ghost" data-vp-del="${esc(e.key)}">🗑 Удалить с устройства</button></div>` : ''}</div></details>` : ''}
    </article>`;
  }

  /* ---------- the window ---------- */
  const baseId = id => { const p = V.parse(id); return p.engine === 'piper' ? 'piper:' + p.key : id; };
  const REC_TAG = { piper: 'Офлайн', edge: 'Бесплатно на Mac', azure: 'Живой голос', gtr: 'Без настройки', sys: 'На устройстве' };
  /** «⭐ Рекомендуем»: chosen when the window opens (per language and place) and kept in that order while it is open —
   *  a voice that has just been downloaded or installed does not jump to another place; only «Сейчас лучший» moves */
  function recs(lang) {
    const all = V.entries(lang), by = id => all.find(e => e.id === id);
    const best = baseId(V.recommend(lang));
    const k = lang + '|' + st.place;
    if (!st.recs[k]) {
      const ids = [];
      const add = id => { if (by(id) && !ids.includes(id)) ids.push(id); };
      add(best);
      add({ no: 'piper:no_NO-talesyntese-medium', uk: 'piper:uk_UA-tetiana-high', ru: 'piper:ru_RU-irina-medium' }[lang]);
      add((V.onMac() ? 'edge:' : 'azure:') + V.MS_DEFAULT[lang]);
      add('gtr:' + lang);
      st.recs[k] = ids.slice(0, 3);
    }
    return st.recs[k].map(id => by(id)).filter(Boolean).map(e => ({ e, tag: e.id === best ? 'Сейчас лучший' : REC_TAG[e.engine] || 'С ключом' }));
  }
  function deviceNote(lang) {
    const n = V.entries(lang).filter(e => e.engine === 'sys').length;
    const lines = [];
    if (IOS) lines.push('📱 <b>Safari на iPhone и iPad даёт сайтам только базовые («компактные») голоса Apple</b> — даже если в Настройках скачаны улучшенные. Это ограничение Apple, не приложения. Живой голос бесплатно: офлайн-голос Piper или Google.');
    else if (SAFARI) lines.push('💻 Safari иногда не показывает сайтам улучшенные голоса Apple. В Chrome на Mac они обычно видны.');
    if (!n) lines.push(lang === 'uk' ? '🇺🇦 Украинского голоса на этом устройстве нет. Украинский текст <b>никогда не читается русским голосом</b> — выберите голос выше.' : 'На этом устройстве нет голоса для этого языка.');
    const how = lang === 'no' ? 'Норвежский: Nora (улучшенный), Henrik' : lang === 'ru' ? 'Русский: Milena (улучшенный), Katya, Yuri' : 'Украинский: Lesya (улучшенный)';
    if (!IOS) lines.push(`<details class="vp-how"><summary>Как получить голос устройства получше</summary><div class="small">
      ${ANDROID ? '<b>Android:</b> Настройки → Озвучивание текста → Синтезатор речи Google → Установить голосовые данные → выберите язык и голос «высокого качества».' : `<b>Mac:</b> Системные настройки → Универсальный доступ → Устный контент → Системный голос → Управлять голосами… → ${how}. Потом перезапустите браузер.<br><b>Windows:</b> Параметры → Время и язык → Речь → Добавить голоса — или откройте приложение в Microsoft Edge: там есть бесплатные онлайн-нейроголоса.`}</div></details>`);
    return lines.length ? `<div class="vp-gnote">${lines.join('<br>')}</div>` : '';
  }
  function groupHtml(g, list, lang) {
    const [id, ico, title, sub] = g;
    let body = '';
    if (id === 'mac' && !V.onMac()) {
      body = `<div class="vp-gnote">💻 Нейроголоса Microsoft Edge бесплатны, но работают только <b>в приложении на Mac</b> (через мост). Здесь — те же голоса через <b>Azure</b>: бесплатный ключ, 500 000 знаков в месяц. <button type="button" class="vp-btn" data-vp-connect="azure">🔑 Подключить Azure</button></div>`;
    } else {
      if (id === 'mac') {
        const a = V.avail('edge:' + V.MS_DEFAULT[lang], lang);
        if (a.why === 'install' || a.why === 'bridge' || a.why === 'old' || a.why === 'stale' || st.edge.phase) body += edgeBox(a, lang);
      }
      if (id === 'key') {
        body += KEY_ORDER.map(en => {
          const ls = list.filter(e => e.engine === en);
          if (!ls.length) return en === 'gemini' && lang === 'uk' ? '<div class="vp-gnote">✦ Gemini не говорит по-украински. Те же 30 голосов Google для украинского есть в Google Cloud — выше.</div>' : '';
          const ready = V.ready(en);
          // not connected yet: a few voices to taste (▶ works after «Подключить»), the rest one tap away
          const short = ready ? LIST_SHORT : 4;
          const k = en + '|' + lang, all = !!st.allv[k] || ls.length <= short + 2;
          const pick = curPick();
          const shown = all ? ls : ls.filter((e, i) => i < short || e.id === pick);
          const rest = ls.length - shown.length;
          return `<div class="vp-sub" data-anchor="sub:${en}"><div class="vp-subh"><b>${esc(V.ENGINES[en].short)}</b>${ready ? '<span class="vp-chip ok">✓ подключено</span>' : `<button type="button" class="vp-btn sm" data-vp-connect="${en}">🔑 Подключить</button>`}</div>
            ${ready ? useHtml(en) : ''}
            <div class="vp-grid">${shown.map(e => card(e, { where: 'key' })).join('')}</div>
            ${ls.length > short + 2 ? `<div class="vp-row" data-anchor="allv:${k}"><button type="button" class="vp-btn ghost vp-allv" data-vp-allv="${k}" aria-expanded="${all}">${all ? '▴ Свернуть' : `▾ Показать ещё ${rest} ${U.plural ? U.plural(rest, ['голос', 'голоса', 'голосов']) : 'голосов'}`}</button></div>` : ''}</div>`;
        }).join('');
      } else body += list.length ? `<div class="vp-grid">${list.map(e => card(e, { where: id })).join('')}</div>` : '';
      if (id === 'device') body += deviceNote(lang);
      if (id === 'offline' && !list.length) body += '<div class="vp-gnote">Офлайн-голосов для этого языка пока нет.</div>';
    }
    const n = id === 'mac' && !V.onMac() ? 0 : list.length;
    return `<details class="vp-group" data-group="${id}" data-anchor="grp:${id}"${st.open[id] ? ' open' : ''}><summary><span class="vp-gico" aria-hidden="true">${ico}</span><span class="vp-gt"><b>${title}</b><small>${sub}${n ? ` · ${n}` : ''}</small></span><span class="vp-chev" aria-hidden="true">▾</span></summary>
      <div class="vp-gbody">${body}</div></details>`;
  }
  const BRIDGE_CMD = 'python3 "/Users/sprut/Norsk - Russisk/bridge/server.py"';
  const RESTART_CMD = '/bin/bash "/Users/sprut/Norsk - Russisk/tools/restart-bridge.command"';
  /** 💻 Edge: one calm box with ONE main button — install, the progress, the result (the cards below wake up in place) */
  function edgeBox(a, lang) {
    const ph = st.edge.phase || '';
    // the text and the button row keep at least the height they had when «Установить» was pressed: nothing below moves
    const hT = st.edge.textH ? ` style="min-height:${st.edge.textH}px"` : '', hR = st.edge.rowH ? ` style="min-height:${st.edge.rowH}px"` : '';
    const box = (title, text, row, extra) => `<div class="vp-how-box vp-edgebox" data-anchor="edgebox" aria-live="polite"><b>${title}</b><p class="vp-eb-t"${hT}>${text}</p><div class="vp-row vp-eb-row"${hR}>${row}</div>${extra || ''}</div>`;
    const manual = `<details class="vp-how"><summary>Если не получилось</summary><div class="small">Можно поставить вручную: откройте «Терминал» (новое окно — ⌘N), вставьте команду и нажмите Enter, потом нажмите «Проверить».
      <code class="vp-cmd" tabindex="0">python3 -m pip install --user -U edge-tts</code><span class="vp-row"><button type="button" class="vp-btn sm" data-vp-copy="python3 -m pip install --user -U edge-tts">📋 Скопировать</button><button type="button" class="vp-btn sm" data-vp-recheck>🔁 Проверить</button></span></div></details>`;
    const restartHow = `<details class="vp-how"><summary>Как перезапустить мост</summary><div class="small">В Finder откройте папку <b>«Norsk - Russisk»</b> → <b>«tools»</b> и дважды щёлкните файл <b>restart-bridge.command</b> — откроется окно Терминала, мост перезапустится в нём (это окно не закрывайте).<br>Или в <b>новом</b> окне Терминала (⌘N) вставьте одну строку и нажмите Enter:
      <code class="vp-cmd" tabindex="0">${esc(RESTART_CMD)}</code><button type="button" class="vp-btn sm" data-vp-copy="${esc(RESTART_CMD)}">📋 Скопировать</button></div></details>`;
    if (a.why === 'bridge') return box('💻 Мост на Mac не запущен', 'Запустите мост — и голоса Edge заработают бесплатно. Проще всего: в папке «Norsk - Russisk» → «tools» дважды щёлкните <b>restart-bridge.command</b>.',
      `<button type="button" class="vp-btn primary" data-vp-recheck>🔁 Я запустил — проверить</button>`,
      `<details class="vp-how"><summary>Через Терминал</summary><div class="small"><code class="vp-cmd" tabindex="0">${esc(BRIDGE_CMD)}</code><button type="button" class="vp-btn sm" data-vp-copy="${esc(BRIDGE_CMD)}">📋 Скопировать</button></div></details>`);
    if (a.why === 'old') return box('💻 Мост нужно перезапустить — один раз', 'На Mac работает мост старой версии. Перезапустите его один раз — дальше голоса Edge ставятся одной кнопкой прямо здесь.',
      `<button type="button" class="vp-btn primary" data-vp-recheck>🔁 Я перезапустил — проверить</button>`, restartHow);
    if (ph === 'installing' || ph === 'restarting') return box('💻 Голоса Microsoft Edge', ph === 'restarting' ? 'Перезапускаю мост… это несколько секунд.' : 'Устанавливаю… обычно меньше минуты. Можно пока слушать другие голоса.',
      `<span class="vp-busy" role="status"><i></i><span>${ph === 'restarting' ? '↻ Перезапускаю мост…' : '⏳ Устанавливаю голоса Edge…'}</span></span>`);
    if (ph === 'restart') return box('💻 Почти готово', 'Голоса установлены — осталось один раз перезапустить мост. Это несколько секунд.',
      `<button type="button" class="vp-btn primary" data-vp-restart>↻ Перезапустить мост</button>`, restartHow);
    if (ph === 'fail') return box('💻 Не получилось установить', `${esc(st.edge.error || 'Не получилось установить голоса.')} Ничего не сломалось — пока читают другие голоса.`,
      `<button type="button" class="vp-btn primary" data-vp-install>🔁 Попробовать ещё раз</button>`, manual);
    if (ph === 'done') {
      const id = 'edge:' + V.MS_DEFAULT[lang], e = V.entry(id, lang);
      return box('✓ Голоса Edge установлены', `Живые голоса Microsoft готовы — выберите любой ниже.${!V.pickOf(lang) && a.ok ? ' «Авто» уже читает ими.' : ''}`,
        `<button type="button" class="vp-btn primary${st.playing === id ? ' on' : ''}" data-vp-play="${esc(id)}"${a.ok || a.why === 'down' ? '' : ' disabled'}>${st.playing === id ? '■ Стоп' : `▶ Послушать ${esc(e ? e.name : '')}`}</button>`);
    }
    if (a.why === 'stale') return box('💻 Голоса Edge нужно обновить', 'Голоса Edge перестали отвечать — похоже, Microsoft поменяла защиту. Обычно помогает обновление — одна кнопка, меньше минуты. Пока читают другие голоса.',
      `<button type="button" class="vp-btn primary" data-vp-install>⬇ Обновить голоса Edge</button>`, manual);
    return box('💻 Голоса Microsoft Edge — бесплатно', 'Pernille, Iselin, Finn и другие — самые живые бесплатные голоса. Их нужно один раз установить на этот Mac — всё сделает кнопка.',
      `<button type="button" class="vp-btn primary" data-vp-install>⬇ Установить голоса Edge — бесплатно, ~1 минута</button>`);
  }
  function chainHtml(lang) {
    const conf = V.chainConf(lang);
    const cur = V.current(lang);
    const cand = [...new Set((Array.isArray(conf) ? conf : []).concat(V.autoChain(lang)))].filter(id => id !== cur);
    const order = Array.isArray(conf) ? conf.filter(id => id !== cur).concat(cand.filter(id => !conf.includes(id))) : cand;
    const name = id => esc(V.label(lang, id));
    const live = id => V.avail(id, lang).ok;
    if (!st.editChain) {
      const okList = order.filter(live);
      return `<section class="vp-chain"><h3>↪ Если голос не сработает</h3>
        <p class="small muted">Не ответил за ~4 секунды или ошибся — приложение тихо возьмёт следующий${Array.isArray(conf) ? ' (ваш порядок)' : ''}:</p>
        <div class="vp-flow"><span class="vp-step first">${name(cur)}</span>${okList.map(id => `<span class="vp-arr" aria-hidden="true">→</span><span class="vp-step">${name(id)}</span>`).join('')}${okList.length ? '' : '<span class="vp-arr" aria-hidden="true">→</span><span class="vp-step">голос устройства</span>'}</div>
        <div class="vp-row"><button type="button" class="vp-btn" data-vp-chain-edit>↕ Изменить порядок</button>${Array.isArray(conf) ? '<button type="button" class="vp-btn ghost" data-vp-chain-auto>↺ Авто</button>' : ''}</div></section>`;
    }
    return `<section class="vp-chain"><h3>↪ Порядок запасных голосов</h3>
      <ol class="vp-olist">${order.map((id, i) => `<li><span class="vp-oname">${name(id)}${live(id) ? '' : ' <small class="muted">· сейчас недоступен</small>'}</span>
        <button type="button" class="vp-btn sq" data-vp-up="${i}" ${i ? '' : 'disabled'} aria-label="Выше: ${name(id)}">↑</button><button type="button" class="vp-btn sq" data-vp-down="${i}" ${i < order.length - 1 ? '' : 'disabled'} aria-label="Ниже: ${name(id)}">↓</button></li>`).join('')}</ol>
      <div class="vp-row"><button type="button" class="vp-btn primary" data-vp-chain-done>Готово</button><button type="button" class="vp-btn ghost" data-vp-chain-auto>↺ Авто</button></div></section>`;
  }
  /** 📏 how much of the free limit is used: a thin bar «использовано 12 %»; from 75 % a quiet yellow line, at 100 % — when it comes back */
  function meterLine(mt, label, bare) {
    const L = V.Limits, cap = L.cap(mt);
    if (!cap) return '';
    const used = L.used(mt), p = used / cap, pc = Math.min(100, Math.floor(p * 100)), day = mt === 'gemini';
    const cls = p >= 1 ? ' over' : p >= 0.75 ? ' high' : '';
    const left = Math.max(0, cap - used);
    const note = p >= 1 ? `⏳ Лимит ${L.period(mt)} исчерпан — вернётся ${L.resetText(mt)}. Пока читает запасной голос.`
      : p >= 0.75 ? (day ? `Осталось около ${left} ${U.plural ? U.plural(left, ['новой фразы', 'новых фраз', 'новых фраз']) : 'новых фраз'} (лимит обновится ${L.resetText(mt)}).`
        : `Осталось ≈${fmtN(left)} знаков — лимит обновится ${L.resetText(mt)}. Дальше читать будет запасной голос.`) : '';
    return `<div class="vp-use${cls}">${bare ? '' : '<div class="vp-use-h"><small>'}${label ? esc(label) + ': ' : ''}${bare ? '' : `${day ? 'сегодня ' : ''}использовано ${pc} %</small></div>`}
      <div class="vp-bar thin" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pc}" aria-label="${esc((label || V.ENGINES[L.engineOf(mt)].short) + ': использовано ' + pc + ' %')}"><i style="width:${Math.max(pc ? 1.5 : 0, pc)}%"></i></div>
      ${note ? `<div class="vp-limitline">${esc(note)}</div>` : ''}</div>`;
  }
  function useHtml(eng) {
    if (eng !== 'gcloud') return meterLine(eng);
    // Google: Chirp 3 HD always; WaveNet / Standard (their own 4 M) once they were used this month
    const wn = V.Usage.get('gcloud-wn');
    return meterLine('gcloud', wn ? 'Chirp 3 HD' : '') + (wn ? meterLine('gcloud-wn', 'WaveNet и Standard') : '');
  }
  function keyHtml(eng) {
    const k = KEY_INFO[eng], s = Store.settings, ready = V.ready(eng), h = V.Health.state(eng);
    const mon = V.MONTHS_IN[new Date().getMonth()];
    const c = st.check[eng];
    const dr = st.draft[eng] || {}; // what was typed but not saved yet survives a redraw
    const over = eng === 'gcloud' ? V.Limits.over('gcloud') && V.Limits.over('gcloud-wn') : V.Limits.over(eng);
    const status = !ready ? '<span class="vp-chip">не подключено</span>' : h === 'badkey' ? '<span class="vp-chip bad">ключ не подходит</span>' : h === 'billing' ? '<span class="vp-chip warn">нужна оплата</span>'
      : h === 'blocked' ? '<span class="vp-chip warn">тариф приостановлен</span>' : h === 'quota' || over ? `<span class="vp-chip warn">лимит до ${esc(V.Limits.resetText(eng === 'gemini' ? 'gemini' : 'gcloud'))}</span>` : '<span class="vp-chip ok">✓ подключено</span>';
    return `<details class="vp-key" data-key-eng="${eng}"${st.keyOpen[eng] ? ' open' : ''}>
      <summary><span class="vp-ava sm" style="--h:${V.ENGINES[eng].hue}" aria-hidden="true">${eng === 'eleven' ? 'E' : eng === 'gcloud' ? 'G' : eng === 'gemini' ? '✦' : 'A'}</span><span class="vp-gt"><b>${k.title}</b><small>${k.tag}</small></span>${status}<span class="vp-chev" aria-hidden="true">▾</span></summary>
      <div class="vp-kbody">
        <p class="vp-free">${typeof k.free === 'function' ? k.free() : k.free}</p>
        ${k.warn ? `<p class="vp-warnbox">${k.warn}</p>` : ''}
        <details class="vp-steps-d"${ready ? '' : ' open'}><summary>Как получить бесплатный ключ — по шагам</summary><ol class="vp-steps">${k.steps.map(x => `<li>${x}</li>`).join('')}</ol></details>
        <div class="vp-fields">
          <label class="field"><span>${eng === 'azure' ? 'Ключ (KEY 1)' : 'API-ключ'}</span><input class="input" type="password" autocomplete="off" spellcheck="false" data-vp-key="${eng}" value="${esc(dr.key != null ? dr.key : s[k.field] || '')}" placeholder="${eng === 'gcloud' || eng === 'gemini' ? 'AIza…' : eng === 'eleven' ? 'sk_…' : 'вставьте ключ'}"></label>
          ${eng === 'azure' ? `<label class="field"><span>Регион (Location)</span><input class="input" list="vp-regions" autocomplete="off" spellcheck="false" data-vp-region value="${esc(dr.region != null ? dr.region : s.azureRegion || '')}" placeholder="westeurope"><datalist id="vp-regions">${AZ_REGIONS.map(r => `<option value="${r}">`).join('')}</datalist></label>` : ''}
        </div>
        <div class="key-local">🔒 Ключ хранится <b>только на этом устройстве</b>, в зашифрованном виде. Он <b>не попадает</b> в резервные копии, экспорт и синхронизацию.</div>
        <div class="vp-row"><button type="button" class="vp-btn primary" data-vp-check="${eng}">✓ Проверить</button>${ready ? `<button type="button" class="vp-btn ghost" data-vp-off="${eng}">Отключить</button>` : ''}${eng === 'eleven' && ready ? '<button type="button" class="vp-btn ghost" data-vp-eleven>⬇ Мои голоса</button>' : ''}</div>
        ${c ? `<div class="vp-msg ${c.cls}" role="status" aria-live="polite">${esc(c.t)}</div>` : ''}
        ${ready ? usageBox(eng, mon) : ''}
        ${eng === 'gcloud' ? capHtml() : ''}
      </div></details>`;
  }
  /** the key window: how much is used (counted on this device) */
  function usageBox(eng, mon) {
    const L = V.Limits;
    if (eng === 'gemini') {
      const used = L.used('gemini'), cap = L.cap('gemini');
      return `<div class="vp-usage"><div class="small">Сегодня озвучено ${used} из ≈${cap} ${U.plural ? U.plural(cap, ['новой фразы', 'новых фраз', 'новых фраз']) : 'новых фраз'} · лимит обновится ${esc(L.resetText('gemini'))} <span class="muted">(счёт этого устройства, примерно)</span></div>${meterLine('gemini', '', true)}</div>`;
    }
    const rows = eng === 'gcloud' ? [['gcloud', 'Chirp 3 HD'], ['gcloud-wn', 'WaveNet и Standard']] : [[eng, '']];
    return `<div class="vp-usage">${rows.map(([mt, nm]) => `<div class="small">${nm ? `<b>${nm}:</b> ` : ''}использовано ≈${fmtN(L.used(mt))} из ${fmtN(L.cap(mt))} знаков в ${mon}${L.hard(mt) ? '' : ' <span class="muted">(счёт этого устройства)</span>'}</div>${meterLine(mt, '', true)}`).join('')}
      ${eng === 'gcloud' ? '<div class="small muted">Счёт ведётся на этом устройстве. Если этот же ключ стоит и на другом устройстве, поставьте потолок пониже.</div>' : ''}</div>`;
  }
  /** Google Cloud: our own monthly ceilings (never above the free amount) */
  function capHtml() {
    const L = V.Limits;
    return `<div class="vp-fields vp-caps">
      <label class="field"><span>Не тратить больше, знаков Chirp 3 HD в месяц</span><input class="input" type="number" inputmode="numeric" min="1000" max="950000" step="1000" data-vp-cap="gcloudCap" value="${L.cap('gcloud')}"></label>
      <label class="field"><span>Не тратить больше, знаков WaveNet и Standard в месяц</span><input class="input" type="number" inputmode="numeric" min="1000" max="3800000" step="1000" data-vp-cap="gcloudWnCap" value="${L.cap('gcloud-wn')}"></label>
    </div><div class="small muted">Дойдя до потолка, голоса Google замолчат до 1-го числа, а читать будет запасной голос. Больше 950 000 и 3 800 000 поставить нельзя — это чуть меньше бесплатного лимита Google.</div>`;
  }
  function heroHtml(lang) {
    const pl = st.place;
    const cur = V.current(lang, pl), act = V.chain(lang, '', pl)[0] || cur, e = V.entry(cur, lang), fb = act !== cur;
    const autoOn = pl ? !V.placePick(pl, lang) : !V.pickOf(lang);
    const playing = st.playing === '__hero';
    return `<section class="vp-now" aria-label="Сейчас читает">
      <div class="vp-now-h"><span class="vp-kicker">${autoOn ? (pl ? '↺ Как везде · ' : '✨ Авто · ') : ''}Сейчас читает${pl ? ' здесь' : ''}</span>${e ? qBadge(e.q) : ''}</div>
      <div class="vp-now-main"><div class="vp-ava lg" style="--h:${e ? hue(e) : 220}" aria-hidden="true">${e ? esc(initial(e)) : '♪'}</div>
        <div class="vp-now-t"><b>${esc(V.label(lang, cur))}</b>${fb ? `<small class="vp-fb">Сейчас недоступен — читает запасной: ${esc(V.label(lang, act))}</small>` : e ? `<small>${chips(e, V.avail(cur, lang)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}</small>` : ''}</div></div>
      <div class="vp-sample-wrap"><p class="vp-sample" data-sample lang="${{ no: 'nb', uk: 'uk', ru: 'ru' }[lang]}">${esc(st.own || V.SAMPLE[lang])}</p></div>
      <div class="vp-row"><button type="button" class="vp-btn primary${playing ? ' on' : ''}" data-vp-hero aria-label="${playing ? 'Остановить' : 'Послушать текущий голос'}">${playing ? '■ Стоп' : '▶ Послушать'}</button>
        <button type="button" class="vp-btn ghost" data-vp-own aria-expanded="${st.ownOpen ? 'true' : 'false'}">✎ Свой текст</button>
        ${!autoOn ? `<button type="button" class="vp-btn ghost" data-vp-auto>${pl ? '↺ Вернуть «Как везде»' : '✨ Вернуть «Авто»'}</button>` : ''}</div>
      ${st.ownOpen ? `<label class="field vp-ownf"><span>Послушать на своём предложении</span><input class="input" data-vp-owntext maxlength="300" value="${esc(st.own)}" placeholder="${esc(V.SAMPLE[lang])}"></label>` : ''}
    </section>`;
  }
  /* ---------- 🎭 «Разные голоса в диалогах» ---------- */
  const ROLE_SAMPLE = {
    no: ['– Hei! Hvordan går det?', '– Bare bra, takk. Og med deg?'],
    uk: ['– Привіт! Як справи?', '– Добре, дякую. А в тебе?'],
    ru: ['– Привет! Как дела?', '– Хорошо, спасибо. А у тебя?'],
  };
  function rolesHtml(lang) {
    if (!V.rolesOn) return '';
    const on = V.rolesOn(), pl = st.place || '';
    let who = '';
    if (on) {
      const ids = V.roleVoices(lang, 2, pl), first = V.chain(lang, '', pl)[0] || V.current(lang, pl);
      const sys = V.parse(first).engine === 'sys';
      who = ids[1] ? `Первый собеседник — <b>${esc(V.label(lang, first))}</b>, второй — <b>${esc(V.label(lang, ids[1]))}</b>.`
        : sys ? 'Другого голоса для этого языка сейчас нет — второй собеседник говорит тем же голосом, но ниже.'
          : 'Другого голоса для этого языка сейчас нет — оба собеседника звучат одинаково. Подключите ещё один голос ниже, и они станут разными.';
    }
    const playing = st.playing === '__roles';
    return `<section class="vp-roles" data-anchor="roles" aria-label="Разные голоса в диалогах">
      <div class="vp-roles-top">${UI.switchHtml('vp-roles', on, '<b>🎭 Разные голоса в диалогах</b>').replace('data-key="vp-roles"', 'data-key="vp-roles" data-vp-roles')}
        ${on ? `<button type="button" class="vp-btn sm ghost${playing ? ' on' : ''}" data-vp-roles-play aria-label="${playing ? 'Остановить' : 'Послушать короткий диалог'}">${playing ? '■ Стоп' : '▶ Послушать диалог'}</button>` : ''}</div>
      <p class="small muted">${on ? 'Когда текст читается по ролям, у каждого собеседника свой голос: у первого — тот, что выбран выше, у второго — другой, по возможности другого пола. Так звучат «Диалоги», учебник, читалка, «Слушать» и карточки с диалогами. Пояснения между репликами читает основной голос.'
        : 'Выключено: все реплики читает один голос.'}</p>
      ${who ? `<p class="small vp-roles-who">${who}</p>` : ''}
    </section>`;
  }
  async function playRoles() {
    if (st.playing === '__roles') { stopPreview(); return; }
    stopPreview(true);
    st.playing = '__roles';
    const token = {};
    st.token = token;
    render();
    try { await TTS.speakText(ROLE_SAMPLE[st.lang].join('\n'), 'all', { place: st.place || '' }); } catch (e) { /* the voice says why itself */ }
    if (st.token === token && st.playing === '__roles') { st.playing = ''; render(); }
  }
  /* ---------- 📍 «Где какой голос» ---------- */
  function placesHtml() {
    const n = V.placeCount();
    const rows = V.PLACES.map(pl => {
      const own = TAB_ORDER.some(l => V.placePick(pl.id, l));
      const chipsH = TAB_ORDER.map(l => {
        const id = V.placePick(pl.id, l), e = id ? V.entry(id, l) : null;
        const nm = id ? (e ? e.name : V.label(l, id)) : 'как везде';
        const full = id ? V.label(l, id) : 'Как везде: ' + V.label(l);
        return `<button type="button" class="vp-pchip${id ? ' set' : ''}" data-vp-place="${pl.id}" data-vp-plang="${l}" title="${esc(full)}" aria-label="${esc(pl.name)}, ${V.LANG_NAME[l].toLowerCase()}: ${esc(full)}. Выбрать голос">
          <span class="vp-pflag" aria-hidden="true">${V.FLAG[l]}</span><span class="vp-pchip-t">${esc(nm)}</span></button>`;
      }).join('');
      const playing = st.playing === '__place:' + pl.id;
      return `<li class="vp-prow${own ? ' own' : ''}"><span class="vp-pico" aria-hidden="true">${pl.ico}</span>
        <span class="vp-pt"><b>${esc(pl.name)}</b><small>${esc(pl.sub)}</small></span>
        <span class="vp-pchips" role="group" aria-label="Голоса: ${esc(pl.name)}">${chipsH}</span>
        <button type="button" class="vp-btn sm vp-pplay${playing ? ' on' : ''}" data-vp-pplay="${pl.id}" aria-label="${playing ? 'Остановить' : `Послушать: ${esc(pl.name)}, ${V.LANG_NAME[st.lang].toLowerCase()}`}">${playing ? '■ Стоп' : `▶ Послушать <span class="vp-pflag" aria-hidden="true">${V.FLAG[st.lang]}</span>`}</button></li>`;
    }).join('');
    return `<details class="vp-group vp-places" id="vp-places" data-group="places"${st.open.places ? ' open' : ''}><summary><span class="vp-gico" aria-hidden="true">📍</span><span class="vp-gt"><b>Где какой голос</b><small>${n ? `свой голос в ${n} ${U.plural ? U.plural(n, ['месте', 'местах', 'местах']) : 'местах'}` : 'везде одинаково'}</small></span><span class="vp-chev" aria-hidden="true">▾</span></summary>
      <div class="vp-gbody"><p class="small muted">В каждом месте может звучать свой голос — например, в видео один, в карточках другой, в читалке третий. Нажмите на язык, чтобы выбрать. «Как везде» — голос, выбранный выше.</p>
        <ul class="vp-plist">${rows}</ul>
        <div class="vp-row"><button type="button" class="vp-btn ghost" data-vp-preset${n ? '' : ' disabled'}>↺ Сбросить — везде одинаково</button></div></div></details>`;
  }
  function placeBarHtml(lang) {
    const pl = V.placeInfo(st.place);
    return `<section class="vp-placebar" aria-label="Голос ${esc(pl.for)}">
      <button type="button" class="vp-btn ghost sm vp-pback" data-vp-pback>← Все места</button>
      <div class="vp-pb-t"><span class="vp-pico" aria-hidden="true">${pl.ico}</span><span><b>Голос ${esc(pl.for)} · ${V.FLAG[lang]} ${V.LANG_NAME[lang].toLowerCase()}</b>
        <small>Выбранный здесь голос читает только в этом месте (${esc(pl.sub)}). «Как везде» — голос всего приложения.</small></span></div></section>`;
  }
  function asAllHtml(lang) {
    const on = !V.placePick(st.place, lang);
    const gid = V.current(lang, ''), e = V.entry(gid, lang);
    const playing = st.playing === '__asall';
    return `<article class="vp-card vp-asall${on ? ' is-picked' : ''}${playing ? ' is-playing' : ''}" data-card="__asall">
      <div class="vp-ava" style="--h:${e ? hue(e) : 220}" aria-hidden="true">↺</div>
      <div class="vp-info">
        <div class="vp-name"><b>Как везде</b><span class="vp-tag">по умолчанию</span></div>
        <div class="vp-eng">${esc(V.label(lang, gid))}</div>
        ${e ? qBadge(e.q) : ''}
        <div class="small muted">Тот же голос, что во всём приложении. Поменяете его — поменяется и здесь.</div>
      </div>
      <div class="vp-acts"><button type="button" class="vp-btn vp-play${playing ? ' on' : ''}" data-vp-asall-play aria-label="${playing ? 'Остановить' : 'Послушать голос «как везде»'}">${playing ? '■ Стоп' : '▶ Послушать'}</button>
        <button type="button" role="radio" aria-checked="${on}" class="vp-btn vp-pick${on ? ' on' : ''}" data-vp-asall aria-label="${on ? 'Выбрано' : 'Выбрать'}: как везде">${on ? '✓ Выбран' : '◉ Выбрать'}</button></div>
      ${playing ? '<div class="vp-pbar" aria-hidden="true"><i data-pbar></i></div>' : ''}
    </article>`;
  }
  function html() {
    const lang = st.lang;
    const all = V.entries(lang);
    const tabs = TAB_ORDER.map(l => `<button type="button" role="tab" id="vp-tab-${l}" aria-controls="vp-panel" aria-selected="${l === lang}" tabindex="${l === lang ? 0 : -1}" class="vp-tab${l === lang ? ' on' : ''}" data-vp-tab="${l}"><span aria-hidden="true">${V.FLAG[l]}</span> <span class="vp-tabt">${V.LANG_NAME[l]} <span class="vp-tabg">голос</span></span></button>`).join('');
    const rec = recs(lang);
    const stats = V.Clips.stats();
    return `<div class="vp-head"><div class="vp-tabs" role="tablist" aria-label="Голос какого языка">${tabs}</div></div>
      <div class="vp-panel" id="vp-panel" role="tabpanel" aria-labelledby="vp-tab-${lang}">
      ${st.place ? placeBarHtml(lang) : ''}
      ${heroHtml(lang)}
      ${st.place ? `<section class="vp-asall-s" role="radiogroup" aria-label="Голос ${esc(V.placeInfo(st.place).for)}">${asAllHtml(lang)}</section>` : ''}
      <section class="vp-rec"><h3>⭐ Рекомендуем</h3><div class="vp-strip" role="radiogroup" aria-label="Рекомендуемые голоса">${rec.map(r => card(r.e, { mini: true, tag: r.tag, where: 'rec' })).join('')}</div></section>
      ${!st.place || st.place === 'dialogs' ? rolesHtml(lang) : ''}
      ${st.place ? '' : placesHtml()}
      <div class="vp-groups" role="radiogroup" aria-label="Голос: ${V.LANG_NAME[lang]}">
        ${GROUPS.map(g => groupHtml(g, all.filter(e => e.group === g[0]), lang)).join('')}
      </div>
      ${st.place ? `<section class="vp-chain"><h3>↪ Если голос не сработает</h3><p class="small muted">Здесь его тихо заменит голос «как везде» (${esc(V.label(lang, V.current(lang, '')))}), а дальше — запасные голоса языка. Их порядок меняется в общем списке — «← Все места».</p></section>` : chainHtml(lang)}
      <section class="vp-keys" id="vp-keys"><h3>🔑 Подключения</h3><p class="small muted">Сервисы с бесплатным лимитом. Один ключ — голоса сразу для всех языков, которые знает сервис.</p>
        ${KEY_ORDER.map(keyHtml).join('')}</section>
      <div class="vp-foot small muted">💾 Сохранённая на устройстве озвучка: ${fmtN(stats.count)} ${U.plural ? U.plural(stats.count, ['фраза', 'фразы', 'фраз']) : 'фраз'} · ${fmtMB(stats.bytes)} — повторно не тратит бесплатный лимит.${stats.count ? ' <button type="button" class="vp-btn sm ghost" data-vp-clear>Очистить</button>' : ''}</div>
      </div>`;
  }
  /** the element whose place on the screen must not change: the card the person works with, else the first one in sight */
  function anchorNow(box, body) {
    if (!body) return null;
    const br = body.getBoundingClientRect(), head = m.$('.vp-head');
    const top = head ? head.getBoundingClientRect().bottom : br.top;
    const seen = el => { const r = el.getBoundingClientRect(); return r.bottom > top && r.top < br.bottom; };
    let el = st.anchor ? box.querySelector(`[data-anchor="${CSS.escape(st.anchor)}"]`) : null;
    if (el && !seen(el)) el = null;
    if (!el) el = [...box.querySelectorAll('[data-anchor]')].find(x => { const r = x.getBoundingClientRect(); return r.top >= top && r.top < br.bottom; });
    return el ? { key: el.getAttribute('data-anchor'), top: el.getBoundingClientRect().top } : null;
  }
  function render() {
    if (!m || !m.el.isConnected) return;
    const box = m.$('[data-vp]'), body = m.$('.modal-body');
    const y = body ? body.scrollTop : 0;
    const f = document.activeElement && box.contains(document.activeElement) ? focusKey(document.activeElement) : null;
    const anc = anchorNow(box, body);
    box.innerHTML = html();
    const h2 = m.$('.modal-head h2'), pl = st.place && V.placeInfo(st.place);
    if (h2) h2.textContent = pl ? `🔊 Голос ${pl.for}` : '🔊 Голоса';
    if (body) {
      body.scrollTop = y;
      const el = anc && box.querySelector(`[data-anchor="${CSS.escape(anc.key)}"]`);
      // (from where the body really is: a shorter window may have clamped «y» already)
      if (el) { const d = el.getBoundingClientRect().top - anc.top; if (Math.abs(d) >= 1) body.scrollTop = body.scrollTop + d; }
    }
    if (f) { const el = box.querySelector(f); if (el) try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  const focusKey = el => {
    const card = el.closest('[data-anchor]');
    const inCard = card ? `[data-anchor="${CSS.escape(card.getAttribute('data-anchor'))}"] ` : '';
    for (const a of ['data-vp-play', 'data-vp-pick', 'data-vp-tab', 'data-vp-dl', 'data-vp-cancel', 'data-vp-check', 'data-vp-key', 'data-vp-up', 'data-vp-down', 'data-vp-hero', 'data-vp-spk', 'data-vp-pplay']) {
      if (el.hasAttribute(a)) return `${inCard}[${a}="${CSS.escape(el.getAttribute(a))}"]`;
    }
    for (const a of ['data-vp-install', 'data-vp-restart', 'data-vp-recheck']) if (el.hasAttribute(a)) return `[${a}]`;
    for (const a of ['data-vp-cap', 'data-vp-allv']) if (el.hasAttribute(a)) return `[${a}="${CSS.escape(el.getAttribute(a))}"]`;
    if (el.hasAttribute('data-vp-place')) return `[data-vp-place="${CSS.escape(el.dataset.vpPlace)}"][data-vp-plang="${CSS.escape(el.dataset.vpPlang)}"]`;
    for (const a of ['data-vp-asall', 'data-vp-asall-play', 'data-vp-auto']) if (el.hasAttribute(a)) return `[${a}]`;
    return null;
  };
  // a short calm line about a card: a toast — it never pushes the list around
  const msg = (id, t, cls) => { if (window.UI) UI.toast(t, cls === 'warn' ? 'warn' : cls || '', cls === 'warn' ? 5000 : 3500); };

  /* ---------- ▶ listen: the sample lights up word by word ---------- */
  function karaoke() {
    if (!st.kar) st.kar = new TTS.Karaoke({ name: 'vpk', cls: 'vp-kmark', host: el => el.closest('.vp-sample-wrap') });
    return st.kar;
  }
  function stopPreview(keep) {
    if (st.playing) { st.playing = ''; try { TTS.stop(); } catch (e) { /* ignore */ } }
    if (st.kar) st.kar.clear();
    if (!keep) render();
  }
  /** id: only that voice; else o.place ('' = «как везде») — o.tag marks the button that plays */
  async function preview(id, o = {}) {
    const lang = st.lang, text = (st.own || '').trim() || V.SAMPLE[lang];
    const tag = id || o.tag || '__hero';
    if (st.playing === tag) { stopPreview(); return; }
    stopPreview(true);
    st.playing = tag;
    render();
    const token = {};
    st.token = token;
    const opts = {
      onWord(i, s, e, info) {
        if (st.token !== token) return;
        const el = m && m.$('[data-sample]');
        if (el && el.textContent === text) karaoke().show(info.done ? [] : [{ el, cur: [s, e], done: s }]);
        const bar = m && m.$('[data-pbar]');
        if (bar && info.total) bar.style.width = Math.min(100, ((i + 1) / info.total) * 100) + '%';
      },
    };
    if (id) { opts.voiceId = id; opts.strict = true; } // the chooser wants to hear exactly this voice — or why not
    else opts.place = o.place != null ? o.place : st.place; // never the place of the window under this one
    try {
      await TTS.speak(text, lang, opts);
    } catch (e) {
      if (st.token === token && id) {
        const k = (e && e.kind) || '';
        const mt = V.Limits.meter(V.parse(id).engine, V.parse(id).key);
        msg(id, k === 'badkey' ? 'Ключ не подошёл — проверьте его в разделе «Подключения».' : k === 'quota' ? `Бесплатный лимит ${V.Limits.period(mt)} закончился — вернётся ${V.Limits.resetText(mt)}.`
          : k === 'billing' ? 'Google Cloud просит подключить оплату (деньги не спишутся, пока вы в бесплатном лимите).' : k === 'blocked' ? 'ElevenLabs приостановил бесплатный тариф — так бывает, если включён VPN.'
          : k === 'stale' ? 'Голоса Edge нужно обновить — кнопка в разделе «Через мост на Mac».' : k === 'rate' ? 'Слишком много запросов подряд — попробуйте через минуту.'
          : k === 'install' || k === 'old' ? 'Голосам Edge нужна установка на Mac — кнопка в разделе «Через мост на Mac».' : k === 'download' ? 'Этот голос нужно скачать заново — нажмите «⬇ Скачать».' : e && e.name === 'NotAllowedError' ? 'Браузер не дал включить звук — нажмите ещё раз.'
          : 'Голос сейчас не ответил. Попробуйте ещё раз чуть позже или выберите другой.', 'warn');
      }
    }
    if (st.token === token) { st.playing = ''; if (st.kar) st.kar.clear(); render(); }
  }

  /* ---------- ⬇ offline voices ---------- */
  async function confirmDl(key) {
    const ent = V.PIPER[key] || {}, e = V.entries(st.lang).find(x => x.id === 'piper:' + key) || {};
    let n = {};
    try { n = await Speech.piper.need(key); } catch (err) { n = {}; }
    if (n.ready) { download(key); return; }
    let free = null;
    try { if (navigator.storage && navigator.storage.estimate) { const est = await navigator.storage.estimate(); if (est.quota) free = Math.max(0, est.quota - (est.usage || 0)); } } catch (err) { /* unknown */ }
    const total = n.total || e.size || 0, low = free != null && free < 2 * total;
    const text = `Голос <b>«${esc(ent.name || key)}»</b> скачивается <b>один раз</b> и дальше работает <b>без интернета и бесплатно</b>. Займёт <b>${fmtMB(n.voice || e.size)}</b>${n.runtime ? ` (+${fmtMB(n.runtime)} общий модуль — один раз для всех офлайн-голосов)` : ''}. Лучше по Wi‑Fi.`
      + (free != null ? `<br><span class="small ${low ? 'vp-warn' : 'muted'}">${low ? '⚠️ Места на устройстве мало: ' : 'Свободно для приложения: '}${fmtMB(free)}</span>` : '')
      + (IOS ? '<br><span class="small muted">На iPhone большие голоса иногда не помещаются в память Safari. Если голос не заработает — выберите Google или голос поменьше.</span>' : '');
    if (await UI.confirm(text, { ok: `⬇ Скачать ${fmtMB(total)}`, title: '⬇ Офлайн-голос' })) download(key);
  }
  async function download(key) {
    const ctrl = new AbortController();
    const d = st.dl[key] = { done: 0, total: 0, ctrl, t0: Date.now(), speed: 0 };
    render();
    let last = 0;
    try {
      await Speech.piper.downloadVoice(key, (done, total) => {
        d.done = done; d.total = total;
        const el = (Date.now() - d.t0) / 1000;
        if (el > 1) d.speed = done / el;
        const now = Date.now();
        if (now - last < 150) return;
        last = now;
        // in place: the bar and its line (the voice can be on the screen twice — in «Рекомендуем» and in its group)
        const pctv = total ? Math.min(100, Math.round(done / total * 100)) : 0;
        (m ? [...m.el.querySelectorAll(`[data-dlp="${CSS.escape(key)}"]`)] : []).forEach(box => {
          const bar = box.querySelector('.vp-dlbar'), i = bar && bar.querySelector('i'), t = box.querySelector('[data-dlp-txt]');
          if (i) i.style.width = pctv + '%';
          if (bar) bar.setAttribute('aria-valuenow', pctv);
          if (t) t.textContent = leftTxt(d);
        });
      }, ctrl.signal);
      delete st.dl[key];
      if (V.Health) V.Health.forget('piper');
      const id = 'piper:' + key + (V._spkOf(key) ? '#' + V._spkOf(key) : '');
      const lang = (V.PIPER[key] || {}).lang || st.lang;
      // a better voice than the one reading now: it becomes the voice of the language (the user can switch back)
      const here = st.place && lang === st.lang ? st.place : '';
      const curE = V.entry(V.current(lang, here), lang);
      // («Авто» that already reads with a better voice — e.g. Edge — stays as it is; the toast says how to choose this one)
      const auto = !curE || curE.q <= ((V.PIPER[key] || {}).q || 3);
      if (auto) { if (here) V.setPlacePick(here, lang, id); else V.setPick(lang, id); }
      msg('piper:' + key, `✓ «${(V.PIPER[key] || {}).name || key}» скачан${auto ? ' и выбран' : ' — нажмите «◉ Выбрать», чтобы он читал'}. Работает без интернета.`, 'good');
      render();
      if (lang === st.lang) preview(id);
    } catch (e) {
      if (e && e.name === 'AbortError') { delete st.dl[key]; msg('piper:' + key, 'Скачивание остановлено. Уже скачанное сохранено — в следующий раз продолжится.', ''); render(); return; }
      d.err = true;
      msg('piper:' + key, e && e.name === 'QuotaExceededError' ? 'Не хватает места на устройстве — удалите ненужный голос или модель и попробуйте ещё раз.'
        : /не полностью/.test(e && e.message) ? 'Файл скачался не полностью — попробуйте ещё раз.' : navigator.onLine === false ? 'Нет интернета — скачивание продолжится, когда связь вернётся.' : 'Не получилось скачать. Попробуйте ещё раз (лучше по Wi‑Fi).', 'warn');
      render();
    }
  }

  /* ---------- 💻 Edge: install with one button ---------- */
  async function installEdge() {
    if (st.edge.phase === 'installing' || st.edge.phase === 'restarting') return;
    st.anchor = 'edgebox';
    const sz = edgeSizes();
    st.edge = Object.assign({ phase: 'installing' }, sz);
    render();
    const r = await V.installEdge();
    if (r.old) { st.edge = {}; render(); return; }
    if (r.ok) { edgeReady(); return; }
    st.edge = Object.assign(r.restart ? { phase: 'restart' } : { phase: 'fail', error: r.error }, sz);
    render();
  }
  /** the box's text / button-row heights now (kept as the minimum for its next steps) */
  function edgeSizes() {
    const t = m && m.$('.vp-edgebox .vp-eb-t'), r = m && m.$('.vp-edgebox .vp-eb-row');
    return { textH: t ? Math.ceil(t.getBoundingClientRect().height) : st.edge.textH || 0, rowH: r ? Math.ceil(r.getBoundingClientRect().height) : st.edge.rowH || 0 };
  }
  function edgeReady() {
    st.edge = Object.assign({ phase: 'done' }, edgeSizes());
    V.resetWarnings();
    render();
    UI.toast('✓ Голоса Edge установлены — живые голоса Microsoft готовы', 'good', 3500);
    const id = 'edge:' + V.MS_DEFAULT[st.lang];
    if (V.avail(id, st.lang).ok) preview(id);
  }
  async function restartBridge() {
    st.anchor = 'edgebox';
    const sz = edgeSizes();
    st.edge = Object.assign({ phase: 'restarting' }, sz);
    render();
    const ok = await V.restartBridge();
    if (ok && V.Edge.installed) { edgeReady(); return; }
    st.edge = ok ? {} : Object.assign({ phase: 'fail', error: 'Мост не ответил после перезапуска.' }, sz);
    render();
  }
  /** an install that is already running (the window was closed and opened again): wait for it here */
  async function followInstall() {
    if (st.edge.phase === 'installing') return;
    st.edge = { phase: 'installing' };
    render();
    for (let i = 0; i < 80 && m; i++) {
      await new Promise(r => setTimeout(r, 3000));
      await V.checkEdge(true);
      if (!V.Edge.installing) break;
    }
    if (V.Edge.installed) edgeReady();
    else { const li = V.Edge.lastInstall || {}; st.edge = li.restart ? { phase: 'restart' } : { phase: 'fail', error: li.error }; render(); }
  }

  /* ---------- 🔑 keys ---------- */
  function keyProblem(eng, key, region) {
    if (!key) return 'Вставьте ключ.';
    if (/\s/.test(key)) return 'В ключе есть пробел — скопируйте его ещё раз, целиком.';
    if (eng === 'azure') {
      if (key.length < 20) return 'Ключ слишком короткий — скопируйте KEY 1 целиком (32 или 84 символа).';
      if (!region) return 'Укажите регион, например westeurope (Keys and Endpoint → Location/Region).';
      if (!/^[a-z0-9]+$/.test(region)) return 'Регион пишется латиницей без пробелов, например westeurope.';
    }
    if (eng === 'gcloud' && !/^AIza[0-9A-Za-z_-]{30,}$/.test(key)) return 'Ключ Google начинается с «AIza» — скопируйте его целиком из Credentials.';
    if (eng === 'gemini' && !/^AIza[0-9A-Za-z_-]{30,}$/.test(key)) return 'Ключ AI Studio начинается с «AIza» — скопируйте его целиком.';
    if (eng === 'eleven' && key.length < 20) return 'Ключ слишком короткий — скопируйте его целиком.';
    return '';
  }
  async function checkKey(eng) {
    const s = Store.settings, k = KEY_INFO[eng];
    const box = m.$(`[data-key-eng="${eng}"]`);
    const key = (box.querySelector('[data-vp-key]').value || '').trim();
    const rIn = box.querySelector('[data-vp-region]');
    const region = rIn ? (rIn.value || '').trim().toLowerCase().replace(/\s+/g, '') : '';
    const bad = keyProblem(eng, key, region);
    st.keyOpen[eng] = true;
    if (bad) { st.draft[eng] = { key, region: rIn ? rIn.value : undefined }; st.check[eng] = { t: bad, cls: 'warn' }; render(); return; }
    Store.setSetting(k.field, key);
    if (eng === 'azure') Store.setSetting('azureRegion', region);
    delete st.draft[eng];
    V.Health.forget(eng);
    st.check[eng] = { t: '⏳ Проверяю — сейчас прозвучит голос…', cls: '' };
    render();
    // Gemini has no Ukrainian: the check speaks Norwegian then
    const lang = eng === 'gemini' && !V.GEM.LANGS.includes(st.lang) ? 'no' : st.lang, id = eng + ':' + V.voiceOfEngine(eng, lang);
    try {
      stopPreview(true);
      await TTS.speak(V.SAMPLE[lang], lang, { voiceId: id, strict: true });
      st.check[eng] = { t: `✓ Работает! ${!V.pickOf(lang) ? '«Авто» теперь может читать и этими голосами.' : 'Выберите голос в списке выше.'}`, cls: 'good' };
      V.resetWarnings();
      if (eng === 'gcloud') V.loadGoogleVoices(true).catch(() => {});
    } catch (e) {
      const kd = (e && e.kind) || '';
      st.check[eng] = { cls: 'warn', t: kd === 'badkey' ? (eng === 'azure' ? 'Ключ не подошёл. Проверьте, что скопирован KEY 1 и регион совпадает с Location/Region ресурса.' : eng === 'gemini' ? 'Ключ не подошёл. Скопируйте его ещё раз целиком на aistudio.google.com/apikey.' : eng === 'gcloud' ? 'Ключ не подошёл. Проверьте, что в проекте включён «Cloud Text-to-Speech API» и ключ не ограничен другим API.' : 'Ключ не подошёл — скопируйте его ещё раз.')
        : kd === 'quota' ? (eng === 'gemini' ? `Ключ верный, но бесплатный лимит Gemini на сегодня уже исчерпан — он обновится ${V.Limits.resetText('gemini')}.` : eng === 'gcloud' ? 'Месячный потолок уже достигнут — голоса Google вернутся 1-го числа (или поднимите потолок ниже).' : 'Ключ верный, но бесплатный лимит на этот месяц уже исчерпан.')
        : kd === 'billing' ? 'Ключ верный, но в проекте Google Cloud не подключена оплата. Подключите её: Billing → Link a billing account. Деньги не спишутся, пока вы в бесплатном лимите.'
        : kd === 'blocked' ? 'Ключ верный, но ElevenLabs приостановил бесплатный тариф — так бывает, если включён VPN. Выключите VPN или загляните в почту от ElevenLabs.'
        : kd === 'region' ? 'Ключ верный, но бесплатный Gemini не работает из этой страны.'
        : kd === 'rate' ? 'Слишком много запросов подряд — подождите минуту и нажмите ещё раз.'
        : navigator.onLine === false ? 'Нет интернета — проверьте связь и попробуйте ещё раз.' : 'Сервис сейчас не ответил. Попробуйте ещё раз через минуту.' };
    }
    render();
  }

  /* ---------- events ---------- */
  function bind() {
    const root = m.el;
    root.addEventListener('click', async e => {
      const t = e.target.closest('button, summary');
      if (!t || !root.contains(t)) return;
      const d = t.dataset;
      // the card (or box) the person works with stays where it is while the window redraws
      const anc = t.closest('[data-anchor]');
      if (anc && !d.vpTab) st.anchor = anc.getAttribute('data-anchor');
      if (d.vpTab) { if (d.vpTab !== st.lang) { stopPreview(true); st.lang = d.vpTab; st.anchor = ''; st.editChain = false; render(); const b = m.$(`[data-vp-tab="${d.vpTab}"]`); if (b) b.focus(); } return; }
      if (t.hasAttribute('data-vp-hero')) { preview(''); return; }
      if (t.hasAttribute('data-vp-roles-play')) { playRoles(); return; }
      if (d.vpPlace) {
        stopPreview(true);
        st.place = d.vpPlace; st.lang = d.vpPlang || st.lang; st.anchor = ''; st.editChain = false;
        render();
        const body = m.$('.modal-body'); if (body) body.scrollTop = 0;
        const f = m.$('[data-vp-asall]'); if (f) try { f.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
        return;
      }
      if (t.hasAttribute('data-vp-pback')) {
        stopPreview(true);
        const was = st.place;
        st.place = ''; st.open.places = true; st.anchor = '';
        render();
        const r = m.$(`[data-vp-place="${was}"][data-vp-plang="${st.lang}"]`) || m.$('#vp-places');
        if (r) { r.scrollIntoView({ block: 'center' }); try { r.focus({ preventScroll: true }); } catch (err) { /* ignore */ } }
        return;
      }
      if (d.vpPplay) { const tag = '__place:' + d.vpPplay; if (st.playing === tag) stopPreview(); else preview('', { place: d.vpPplay, tag }); return; }
      if (t.hasAttribute('data-vp-asall-play')) { if (st.playing === '__asall') stopPreview(); else preview('', { place: '', tag: '__asall' }); return; }
      if (t.hasAttribute('data-vp-asall')) { V.setPlacePick(st.place, st.lang, ''); render(); return; }
      if (t.hasAttribute('data-vp-preset')) {
        if (!await UI.confirm('Вернуть один голос для всего приложения? Свои голоса мест (читалка, видео, карточки…) будут сброшены — везде зазвучит голос, выбранный для языка.', { ok: 'Сбросить', title: 'Везде одинаково' })) return;
        V.resetPlaces(); render(); UI.toast('Готово — везде одинаковый голос', 'good', 2500); return;
      }
      if (d.vpPlay) { preview(d.vpPlay); return; }
      if (d.vpPick) {
        let id = d.vpPick;
        const p = V.parse(id);
        if (p.engine === 'piper' && !p.spk && V._spkOf(p.key)) {
          const sel = m.$(`[data-vp-spk="${CSS.escape(p.key)}"]`);
          id += '#' + (sel ? sel.value : V._spkOf(p.key));
        }
        setCur(id);
        V.resetWarnings();
        render();
        return;
      }
      if (t.hasAttribute('data-vp-auto')) { setCur(''); render(); return; }
      if (d.vpDl) { if (st.dl[d.vpDl] && st.dl[d.vpDl].err) { delete st.dl[d.vpDl]; download(d.vpDl); } else if (!st.dl[d.vpDl]) confirmDl(d.vpDl); return; }
      if (d.vpCancel) { const x = st.dl[d.vpCancel]; if (x && x.ctrl) x.ctrl.abort(); return; }
      if (d.vpDel) {
        const key = d.vpDel, ent = V.PIPER[key] || {};
        const own = await Speech.piper.ownBytes(key).catch(() => 0);
        if (!await UI.confirm(`Удалить голос «${ent.name || key}» с этого устройства? Освободится ${fmtMB(own)}. Понадобится — скачаете снова.`, { ok: 'Удалить', danger: true, title: 'Удалить голос' })) return;
        await Speech.piper.remove(key);
        V.onRemoved('piper:' + key);
        render();
        return;
      }
      if (d.vpConnect) {
        st.keyOpen[d.vpConnect] = true; render();
        const k = m.$(`[data-key-eng="${d.vpConnect}"]`);
        if (k) { k.scrollIntoView({ behavior: TTS.motionOk() ? 'smooth' : 'auto', block: 'start' }); const i = k.querySelector('[data-vp-key]'); if (i) setTimeout(() => i.focus({ preventScroll: true }), TTS.motionOk() ? 400 : 0); }
        return;
      }
      if (d.vpCopy != null) {
        try { await navigator.clipboard.writeText(d.vpCopy); UI.toast('Скопировано — вставьте в новое окно «Терминала» и нажмите Enter', 'good', 3000); } catch (err) { UI.toast('Выделите строку и скопируйте её вручную', '', 3000); }
        return;
      }
      if (t.hasAttribute('data-vp-install')) { installEdge(); return; }
      if (t.hasAttribute('data-vp-restart')) { restartBridge(); return; }
      if (t.hasAttribute('data-vp-recheck')) {
        // a real new question to the bridge (is it there, which version, is edge-tts there) — nothing from memory
        t.disabled = true;
        st.anchor = 'edgebox';
        if (window.AI && AI.detectBridge) await AI.detectBridge().catch(() => {});
        await V.checkEdge(true);
        const a = V.avail('edge:' + V.MS_DEFAULT[st.lang], st.lang);
        if (a.ok) { edgeReady(); return; }
        render();
        if (V.Edge.installing) { followInstall(); return; }
        UI.toast(a.why === 'old' ? 'Мост ещё старой версии — перезапустите его по шагам в разделе «Через мост на Mac».'
          : a.why === 'bridge' ? 'Мост пока не отвечает — запустите его и нажмите ещё раз.'
          : a.why === 'install' ? 'Мост новый — осталось нажать «⬇ Установить голоса Edge».' : 'Проверил.', a.why === 'install' ? 'good' : '', 4000);
        return;
      }
      if (d.vpCheck) { checkKey(d.vpCheck); return; }
      if (d.vpOff) {
        const eng = d.vpOff;
        if (!await UI.confirm(`Отключить ${KEY_INFO[eng].title}? Ключ будет удалён с этого устройства.`, { ok: 'Отключить', danger: true, title: 'Отключить сервис' })) return;
        Store.setSetting(KEY_INFO[eng].field, '');
        delete st.draft[eng];
        V.Health.forget(eng);
        delete st.check[eng];
        render();
        return;
      }
      if (t.hasAttribute('data-vp-eleven')) {
        try { const n = await V.loadElevenVoices(); st.check.eleven = { t: `✓ Загружено голосов: ${n}. Они — в списке «С вашим ключом».`, cls: 'good' }; }
        catch (err) { st.check.eleven = { t: 'Не получилось загрузить голоса — проверьте ключ и интернет.', cls: 'warn' }; }
        render(); return;
      }
      // «Показать ещё»: the cards above stay where they are; «Свернуть»: the button stays under the finger
      if (d.vpAllv) { st.anchor = st.allv[d.vpAllv] ? 'allv:' + d.vpAllv : 'sub:' + d.vpAllv.split('|')[0]; st.allv[d.vpAllv] = !st.allv[d.vpAllv]; render(); const b = m.$(`[data-vp-allv="${CSS.escape(d.vpAllv)}"]`); if (b) try { b.focus({ preventScroll: true }); } catch (err) { /* ignore */ } return; }
      if (t.hasAttribute('data-vp-own')) { st.ownOpen = !st.ownOpen; render(); const i = m.$('[data-vp-owntext]'); if (i) i.focus(); return; }
      if (t.hasAttribute('data-vp-chain-edit')) { st.editChain = true; render(); return; }
      if (t.hasAttribute('data-vp-chain-done')) { st.editChain = false; render(); return; }
      if (t.hasAttribute('data-vp-chain-auto')) { V.setChain(st.lang, null); st.editChain = false; render(); return; }
      if (d.vpUp != null || d.vpDown != null) {
        const lang = st.lang, conf = V.chainConf(lang), cur = V.current(lang);
        const cand = [...new Set((Array.isArray(conf) ? conf : []).concat(V.autoChain(lang)))].filter(id => id !== cur);
        const order = Array.isArray(conf) ? conf.filter(id => id !== cur).concat(cand.filter(id => !conf.includes(id))) : cand;
        const i = +(d.vpUp != null ? d.vpUp : d.vpDown), j = d.vpUp != null ? i - 1 : i + 1;
        if (j < 0 || j >= order.length) return;
        [order[i], order[j]] = [order[j], order[i]];
        V.setChain(lang, order);
        render();
        const b = m.$(`[data-vp-${d.vpUp != null ? 'up' : 'down'}="${j}"]`) || m.$(`[data-vp-up="${j}"]`) || m.$(`[data-vp-down="${j}"]`);
        if (b) b.focus();
        return;
      }
      if (t.hasAttribute('data-vp-clear')) {
        if (!await UI.confirm('Очистить сохранённую озвучку? Фразы озвучатся заново, когда понадобятся (облачные голоса снова потратят лимит).', { ok: 'Очистить', title: 'Сохранённая озвучка' })) return;
        await V.Clips.clear(); render(); return;
      }
    });
    // <details> open state survives re-rendering
    root.addEventListener('toggle', e => {
      const d = e.target;
      if (!d || d.tagName !== 'DETAILS') return;
      if (d.dataset.group) st.open[d.dataset.group] = d.open;
      if (d.dataset.keyEng) st.keyOpen[d.dataset.keyEng] = d.open;
      if (d.dataset.more) st.more[d.dataset.more] = d.open;
    }, true);
    root.addEventListener('change', e => {
      const t = e.target;
      if (t.hasAttribute('data-vp-roles')) {
        if (st.playing === '__roles') stopPreview(true);
        st.anchor = 'roles';
        V.setRolesOn(t.checked); // → voices-pick → the window redraws
        UI.toast(t.checked ? '🎭 В диалогах у каждого собеседника свой голос' : 'Все реплики диалогов читает один голос', 'good', 2600);
        return;
      }
      if (t.dataset.vpSpk) {
        const key = t.dataset.vpSpk, id = 'piper:' + key + '#' + t.value;
        const cv = Object.assign({}, Store.settings.cloudVoices || {});
        cv.piperSpk = Object.assign({}, cv.piperSpk || {}, { [key]: t.value });
        Store.setSetting('cloudVoices', cv);
        const p = V.parse(curPick());
        if (p.engine === 'piper' && p.key === key) setCur(id);
        if (V.avail(id, st.lang).ok) preview(id);
        return;
      }
      if (t.hasAttribute('data-vp-region')) t.value = t.value.trim().toLowerCase().replace(/\s+/g, '');
      if (t.dataset.vpCap) {
        const mx = t.dataset.vpCap === 'gcloudCap' ? 950000 : 3800000;
        const v = Math.max(1000, Math.min(mx, Math.round(+String(t.value).replace(/\s/g, '') || mx)));
        Store.setSetting(t.dataset.vpCap, v);
        t.value = v;
        UI.toast(`Потолок: ${fmtN(v)} знаков в месяц`, 'good', 2200);
        render();
      }
    });
    root.addEventListener('input', e => {
      const t = e.target;
      if (t.dataset.vpKey) (st.draft[t.dataset.vpKey] = st.draft[t.dataset.vpKey] || {}).key = t.value;
      if (t.hasAttribute('data-vp-region')) (st.draft.azure = st.draft.azure || {}).region = t.value;
    });
    root.addEventListener('input', e => { if (e.target.hasAttribute('data-vp-owntext')) { st.own = e.target.value.slice(0, 300); const p = m.$('[data-sample]'); if (p) { if (st.kar) st.kar.clear(); p.textContent = st.own.trim() || V.SAMPLE[st.lang]; } } });
    // ← → between the language tabs
    root.addEventListener('keydown', e => {
      const t = e.target;
      if (!t.dataset || !t.dataset.vpTab || !/^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key)) return;
      e.preventDefault();
      const i = TAB_ORDER.indexOf(t.dataset.vpTab);
      const n = e.key === 'Home' ? 0 : e.key === 'End' ? TAB_ORDER.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + TAB_ORDER.length) % TAB_ORDER.length;
      const b = m.$(`[data-vp-tab="${TAB_ORDER[n]}"]`); if (b) b.click();
    });
  }
  const onExternal = () => { if (m && m.el.isConnected && !st.playing) render(); };
  document.addEventListener('voices-changed', onExternal);
  document.addEventListener('voices-pick', onExternal);
  document.addEventListener('voices-spoke', onExternal);
  window.addEventListener('online', onExternal);
  window.addEventListener('offline', onExternal);

  function open(lang, o = {}) {
    st.lang = TAB_ORDER.includes(lang) ? lang : 'no';
    st.place = V.normPlace(o.place);
    if (o.section === 'keys') st.open.key = true;
    if (o.section === 'places') st.open.places = true;
    st.anchor = '';
    if (m && m.el.isConnected) { stopPreview(true); render(); const b = m.$('.modal-body'); if (b) b.scrollTop = 0; return m; }
    st.recs = {}; st.edge = {};
    m = UI.modal({
      title: '🔊 Голоса', cls: 'vp-modal wide', body: '<div class="vp" data-vp></div>',
      onClose() { stopPreview(true); Object.values(st.dl).forEach(d => d.ctrl && d.ctrl.abort()); m = null; if (window.App && App.view && App.view.name === 'settings' && App.render) App.render(); },
    });
    bind();
    render();
    // the first answer from the bridge may change «Сейчас лучший»: the recommended row is chosen again once — unless
    // the person has already started something in the window
    const edgeSeen = () => { if (!Object.keys(st.dl).length && !st.anchor && !st.edge.phase) st.recs = {}; render(); if (V.Edge.installing && m) followInstall(); };
    V.checkEdge(true).then(edgeSeen);
    if (window.AI && AI.detectBridge && V.onMac() && !AI.bridge.up) AI.detectBridge().then(() => V.checkEdge(true)).then(edgeSeen).catch(() => {});
    // a voice marked «downloaded» whose files the browser has removed: its card offers «⬇ Скачать» again
    if (window.Speech && Speech.piper && Speech.piper.available()) {
      Promise.all(Object.keys(V.PIPER).filter(k => Speech.piper.isReady(k)).map(k => Speech.piper.status(k).then(x => x.ready, () => true)))
        .then(r => { if (r.some(x => !x)) render(); }).catch(() => {});
    }
    // Google Cloud: the voices your key sees (once a week) — new Google voices appear by themselves
    if (V.ready('gcloud')) {
      const before = V.entries(st.lang).length;
      V.loadGoogleVoices().then(() => { if (m && V.entries(st.lang).length !== before) render(); }).catch(() => {});
    }
    if (o.section === 'keys') setTimeout(() => { const k = m && m.$('#vp-keys'); if (k) k.scrollIntoView({ block: 'start' }); }, 60);
    if (o.section === 'places' && !st.place) setTimeout(() => { const k = m && m.$('#vp-places'); if (k) k.scrollIntoView({ block: 'start' }); }, 60);
    return m;
  }

  window.VoicePicker = { open, render };
})();
