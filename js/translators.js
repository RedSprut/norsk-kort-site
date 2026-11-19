/* ============ Translators: DeepL, Google, Yandex, Microsoft, AI, MyMemory + dictionaries ============
 * Inline translators put the result straight into the card (or verify an existing translation).
 * Web-only ones (or ones without a key) open the service with the text already filled in.
 */
(function () {
  const LIST = {
    deepl: { name: 'DeepL', domain: 'deepl.com', key: 'deeplKey', keyUrl: 'https://www.deepl.com/pro-api', note: 'Самый точный. Бесплатный API-ключ: 500 000 символов в месяц' },
    google: { name: 'Google', domain: 'translate.google.com', free: true, note: 'Бесплатно, без ключа' },
    yandex: { name: 'Яндекс', domain: 'translate.yandex.ru', web: true, note: 'Хорош для русского, но доступен не во всех странах — включите, если он у вас работает' },
    microsoft: { name: 'Microsoft', domain: 'bing.com', key: 'msKey', keyUrl: 'https://learn.microsoft.com/azure/ai-services/translator/create-translator-resource', note: 'Бесплатно 2 млн символов в месяц (ключ Azure)' },
    ai: { name: 'ИИ', ai: true, note: 'Подключённая нейросеть: перевод с учётом смысла, до 3 значений' },
    mymemory: { name: 'MyMemory', domain: 'mymemory.translated.net', free: true, note: 'Бесплатно, без ключа (база переводов)' },
    glosbe: { name: 'Glosbe', domain: 'glosbe.com', web: true, dict: true, note: 'Словарь RU⇄NO с примерами из реальных текстов' },
    ordbok: { name: 'Ordbøkene', domain: 'ordbokene.no', dict: true, note: 'Официальный словарь норвежского: значения, примеры, выражения и формы — прямо в карточку, с переводом в скобках' },
    naob: { name: 'NAOB', domain: 'naob.no', web: true, dict: true, note: 'Большой академический словарь норвежского: значения, примеры, устойчивые выражения' },
    tatoeba: { name: 'Tatoeba', domain: 'tatoeba.org', dict: true, note: 'Живые предложения NO→RU, переведённые людьми — прямо в карточку (CC BY 2.0 FR)' },
    lexin: { name: 'LEXIN', domain: 'lexin.oslomet.no', web: true, dict: true, note: 'Норвежско-русский словарь OsloMet для иммигрантов: слово копируется — вставьте его в поиск' },
    forvo: { name: 'Forvo', domain: 'forvo.com', web: true, dict: true, note: 'Произношение слова носителями языка' },
    grammatikk: { name: 'Grammatikk.com', domain: 'grammatikk.com', emoji: '📐', dict: true, panel: true, note: 'Грамматика норвежского (Kjell H. Ullestad): темы к слову карточки — объяснение с переводом на русский, нужное добавляется в карточку' },
    // spare translator for long texts: open-source front-end of Google Translate on its own servers (not limited by your address)
    mozhi: { name: 'Mozhi', domain: 'mozhi.ducks.party', emoji: '🌍', free: true, panel: true, note: 'Запасной бесплатный переводчик (открытый сервис: Google через свой сервер) — когда Google временно ограничил переводы' },
    telegram: { name: 'Telegram', domain: 'telegram.org', dict: true, panel: true, note: 'Посты, видео, карточки-картинки и файлы из каналов о норвежском — по слову карточки, прямо в приложении (через мост на Mac)' },
  };
  const CODES = {
    // en / uk: for extra translations of expression cards (DeepL: source "EN", target "EN-GB")
    deepl: { no: 'NB', ru: 'RU', en: 'EN-GB', uk: 'UK' }, google: { no: 'no', ru: 'ru', en: 'en', uk: 'uk' }, microsoft: { no: 'nb', ru: 'ru', en: 'en', uk: 'uk' },
    mymemory: { no: 'nb', ru: 'ru', en: 'en', uk: 'uk' }, yandex: { no: 'no', ru: 'ru', en: 'en', uk: 'uk' }, bing: { no: 'nb', ru: 'ru', en: 'en', uk: 'uk' },
  };
  const deeplSrc = c => String(c).split('-')[0];

  const Translators = {
    LIST,
    enabled() {
      const order = Store.settings.translators || Object.keys(LIST);
      return order.filter(id => LIST[id]);
    },
    /** text to translate: first line, without Russian glosses in brackets when going NO→RU */
    prepare(text, from) {
      let t = String(text || '').split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
      if (from === 'no') t = t.replace(/\([^)]*[Ѐ-ӿ][^)]*\)/g, ' ');
      return U.stripHtml(t).replace(/\*\*|__|[*_`#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
    },
    detect(text) { return U.cyrRatio(text) > 0.3 ? { from: 'ru', to: 'no' } : { from: 'no', to: 'ru' }; },
    inline(id) {
      const t = LIST[id];
      if (!t || t.web) return false;
      if (t.ai) return AI.available();
      if (t.key) return !!(Store.settings[t.key] || '').trim();
      return true;
    },
    icon(id, size = 18) {
      const t = LIST[id];
      if (t.ai) return AI.current() ? AI.icon(AI.current(), size, 'Перевод нейросетью: ' + AI.name()) : `<span style="font-size:${size - 2}px">🤖</span>`;
      if (t.emoji) return `<span class="ai-ico tr-ico tr-emoji" style="font-size:${size - 3}px;width:${size}px;height:${size}px;display:inline-grid;place-items:center;line-height:1" title="${U.esc(t.name)}">${t.emoji}</span>`;
      return `<img class="ai-ico tr-ico" src="https://www.google.com/s2/favicons?domain=${t.domain}&sz=64" width="${size}" height="${size}" alt="${U.esc(t.name)}" onerror="this.replaceWith(document.createTextNode('🌐'))">`;
    },
    label(id) { return LIST[id].ai ? (AI.current() ? AI.name() : 'ИИ') : LIST[id].name; },

    webUrl(id, text, from, to) {
      const q = encodeURIComponent(text);
      const c = k => CODES[k][from] + '';
      switch (id) {
        case 'deepl': return `https://www.deepl.com/translator#${from === 'no' ? 'nb' : 'ru'}/${to === 'no' ? 'nb' : 'ru'}/${q}`;
        case 'google': return `https://translate.google.com/?sl=${CODES.google[from]}&tl=${CODES.google[to]}&text=${q}&op=translate`;
        case 'yandex': return `https://translate.yandex.ru/?source_lang=${CODES.yandex[from]}&target_lang=${CODES.yandex[to]}&text=${q}`;
        case 'microsoft': return `https://www.bing.com/translator?from=${CODES.bing[from]}&to=${CODES.bing[to]}&text=${q}`;
        case 'mymemory': return `https://mymemory.translated.net/ru/${from === 'ru' ? 'Русский/Норвежский' : 'Норвежский/Русский'}/${q}`;
        case 'glosbe': return `https://glosbe.com/${from === 'no' ? 'nb' : 'ru'}/${to === 'no' ? 'nb' : 'ru'}/${q}`;
        case 'ordbok': return `https://ordbokene.no/nob/bm/${encodeURIComponent((from === 'no' ? text : text).replace(/^(en|ei|et|å)\s+/i, '').split(/[,(]/)[0].trim())}`;
        case 'tatoeba': return `https://tatoeba.org/ru/sentences/search?from=nob&to=rus&query=${encodeURIComponent(text.replace(/^(en|ei|et|å)\s+/i, ''))}`;
        case 'lexin': return 'https://lexin.oslomet.no/';
        case 'forvo': return `https://forvo.com/word/${encodeURIComponent(text.replace(/^(en|ei|et|å)\s+/i, '').split(/[,(]/)[0].trim().toLowerCase())}/#no`;
        case 'naob': return `https://naob.no/s%C3%B8k/${encodeURIComponent(text.replace(/^(en|ei|et|å)\s+/i, '').split(/[,(]/)[0].trim())}`;
        case 'mozhi': return `https://mozhi.ducks.party/?engine=google&from=${CODES.google[from]}&to=${CODES.google[to]}&text=${q}`;
        case 'ai': return '';
      }
      return '';
    },
    open(id, text, from, to) {
      if (id === 'lexin') {
        // LEXIN has no public link format: copy the word, the user pastes it into the search field
        const w = String(text).replace(/^(en|ei|et|å)\s+/i, '').split(/[,(]/)[0].trim();
        const told = ok => UI.toast(ok ? `«${w}» скопировано — вставьте в поиск LEXIN (⌘V) и выберите bokmål–russisk` : `Введите в поиск LEXIN: «${w}» и выберите bokmål–russisk`, ok ? 'good' : 'warn', 6000);
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(w).then(() => told(true), () => told(false));
        else told(false);
      }
      const url = this.webUrl(id, text, from, to);
      if (url) window.open(url, '_blank', 'noopener');
    },

    /** Google request for one card: no connection or refused (limit) -> the same request through the Mac bridge */
    /** 🧯 Google refused («too many requests»): it rests 10 minutes — the other translators work meanwhile
     *  (before, every line kept asking Google and the bridge again: dozens of refusals, a longer block) */
    /** the same rest for every other translator (DeepL monthly limit, MyMemory daily limit, Mozhi server down…) */
    _trRest: null,
    trRestMap() { if (!this._trRest) { try { this._trRest = JSON.parse(sessionStorage.getItem('nk-tr-rest') || '{}'); } catch (e) { this._trRest = {}; } } return this._trRest; },
    trRest(id, min) { const m = this.trRestMap(); m[id] = Date.now() + min * 60000; try { sessionStorage.setItem('nk-tr-rest', JSON.stringify(m)); } catch (e) { /* private mode */ } },
    trResting(id) { return Date.now() < (this.trRestMap()[id] || 0); },
    trUnrest(id) { const m = this.trRestMap(); if (m[id]) { delete m[id]; try { sessionStorage.setItem('nk-tr-rest', JSON.stringify(m)); } catch (e) { /* ok */ } } },
    gCool(min = 10) {
      this._gCoolUntil = Date.now() + min * 60000;
      try { sessionStorage.setItem('nk-gcool', String(this._gCoolUntil)); } catch (e) { /* private mode */ }
    },
    gCooling() {
      if (!this._gCoolUntil) { try { this._gCoolUntil = +sessionStorage.getItem('nk-gcool') || 0; } catch (e) { this._gCoolUntil = 0; } }
      return Date.now() < this._gCoolUntil;
    },
    async gget(url) {
      const viaBridge = () => fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, method: 'GET' }) });
      const bridge = typeof AI !== 'undefined' && AI.bridge && AI.bridge.up;
      if (this.gCooling()) throw new Error('Google временно ограничил переводы — попробуйте через несколько минут');
      let r;
      try { r = await fetch(url); } catch (e) {
        if (!bridge) throw new Error('нет связи с Google Переводчиком (интернет или блокировщик рекламы)');
        r = await viaBridge();
      }
      if (!r.ok && (r.status === 429 || r.status === 403) && bridge) { try { const b = await viaBridge(); if (b.ok) r = b; } catch (e) { /* keep the first answer */ } }
      if (!r.ok && (r.status === 429 || r.status === 403)) this.gCool();
      if (!r.ok) throw new Error(r.status === 429 || r.status === 403 ? 'Google временно ограничил переводы с вашего адреса — подождите 5–15 минут' : 'Google ответил ошибкой ' + r.status);
      return r.json();
    },
    /** Mozhi (spare Google front-end) for one text */
    async mozhiOne(text, from, to) {
      for (const h of ['https://mozhi.ducks.party', 'https://mozhi.pussthecat.org']) {
        try {
          const r = await fetch(`${h}/api/translate?engine=google&from=${CODES.google[from]}&to=${CODES.google[to]}&text=${encodeURIComponent(text)}`);
          if (r.ok) { const j = await r.json(); const t = j && (j['translated-text'] || j.translated_text); if (t) return String(t).trim(); }
        } catch (e) { /* next server */ }
      }
      throw new Error('Mozhi сейчас не отвечает');
    },

    /** translate inline -> string */
    async translate(id, text, from, to, opts = {}) {
      text = String(text || '').trim();
      if (!text) throw new Error('Нет текста для перевода');
      switch (id) {
        case 'google': {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${CODES.google[from]}&tl=${CODES.google[to]}&dt=t&q=${encodeURIComponent(text)}`;
          const j = await this.gget(url);
          return (j[0] || []).map(x => x[0]).join('').trim();
        }
        case 'mozhi': return this.mozhiOne(text, from, to);
        case 'mymemory': {
          const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${CODES.mymemory[from]}|${CODES.mymemory[to]}`;
          const j = await (await fetch(url)).json();
          const t = j && j.responseData && j.responseData.translatedText;
          if (!t || /MYMEMORY WARNING|INVALID/i.test(t)) throw new Error('MyMemory: лимит или ошибка');
          return t.trim();
        }
        case 'deepl': {
          const key = (Store.settings.deeplKey || '').trim();
          const host = /:fx$/.test(key) ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
          const r = await AI.post(host + '/v2/translate', { 'content-type': 'application/json', authorization: 'DeepL-Auth-Key ' + key },
            { text: [text], source_lang: deeplSrc(CODES.deepl[from]), target_lang: CODES.deepl[to] });
          if (!r.ok) throw new Error(r.status === 403 ? 'DeepL: неверный ключ' : r.status === 456 ? 'DeepL: месячный лимит исчерпан' : 'DeepL: ошибка ' + r.status);
          return ((r.data.translations || [])[0] || {}).text || '';
        }
        case 'microsoft': {
          const key = (Store.settings.msKey || '').trim();
          const h = { 'content-type': 'application/json', 'ocp-apim-subscription-key': key };
          if ((Store.settings.msRegion || '').trim()) h['ocp-apim-subscription-region'] = Store.settings.msRegion.trim();
          const r = await AI.post(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${CODES.microsoft[from]}&to=${CODES.microsoft[to]}`, h, [{ Text: text }]);
          if (!r.ok) throw new Error('Microsoft: ' + ((r.data && r.data.error && r.data.error.message) || 'ошибка ' + r.status));
          return (((r.data || [])[0] || {}).translations || [{}])[0].text || '';
        }
        case 'ai': {
          const sys = from === 'no'
            ? 'Translate the Norwegian (Bokmål) word or phrase into Russian. For a single word give up to 3 most common meanings separated by ", ". Output ONLY the translation.'
            : 'Translate the Russian word or phrase into Norwegian Bokmål. Nouns with the indefinite article (en/ei/et), verbs with "å". If there are 2-3 common equivalents, separate them with ", ". Output ONLY the translation.';
          const t = await AI.call({ system: sys, user: text, maxTokens: 120, temperature: 0.1, quiet: true, provider: opts.provider });
          this.lastAI = AI.lastProvider;
          return String(t).replace(/<think>[\s\S]*?<\/think>/g, '').trim().split('\n')[0].replace(/^["«]|["»]$/g, '');
        }
      }
      throw new Error('Этот переводчик открывается на сайте');
    },

    /**
     * Translate many short texts at once, robustly (dictionary articles: definitions, examples, expressions).
     * Google gets a few batched requests (one line per text) instead of dozens of parallel calls — Google blocks those.
     * Gaps are then filled by DeepL / Microsoft (if keys are set), MyMemory, and finally the connected AI.
     * -> { out: [translations in the same order, '' where nothing worked], by: [translator ids used], missing }
     */
    _trCache: new Map(),
    /** translators that can translate a whole article, in the order they are tried (Settings → "Переводчик для статей") */
    DICT_TRANSLATORS: ['deepl', 'google', 'microsoft', 'mymemory', 'ai'],
    dictOrder() {
      const S = Store.settings;
      const usable = id => id === 'deepl' ? !!(S.deeplKey || '').trim() : id === 'microsoft' ? !!(S.msKey || '').trim() : id === 'ai' ? (typeof AI !== 'undefined' && AI.available()) : true;
      const pref = S.dictTranslator === 'lingva' ? 'mozhi' : S.dictTranslator || 'auto'; // Lingva was replaced by Mozhi
      const base = ['deepl', 'google', 'mozhi', 'microsoft', 'mymemory', 'ai'];
      const order = pref === 'auto' ? base : [pref, ...base.filter(x => x !== pref)];
      return order.filter(usable);
    },
    /** which translator will translate the next article (for the settings hint) */
    dictMain() { return this.dictOrder()[0] || 'google'; },
    /** 'google' -> 'tr:google', 'ai' -> 'ai:groq' — keys of the icons on the card */
    provKeys(ids) {
      return (ids || []).map(id => id === 'ai' ? 'ai:' + (this.lastAI || AI.current()) : 'tr:' + id);
    },
    provNames(ids) {
      return (ids || []).map(id => id === 'ai' ? AI.name(this.lastAI) : (LIST[id] || {}).name || id).join(' + ');
    },
    /** card.mtWarn: remembered on the card when its text was translated by machine only (no AI check) */
    mtFlag(by) {
      by = by || [];
      const machine = by.filter(id => ['google', 'mozhi', 'mymemory', 'microsoft', 'deepl'].includes(id));
      return machine.length && !by.includes('ai') ? { by: machine, t: Date.now() } : null;
    },
    /** warning under machine translations (Google & co.): they must be double-checked */
    machineWarnHtml(by, canRefine = true) {
      by = by || [];
      const machine = by.filter(id => ['google', 'mozhi', 'mymemory', 'microsoft', 'deepl'].includes(id));
      if (!machine.length) return '';
      if (by.includes('ai')) return `<div class="mt-warn ok">✓ Перевод проверен нейросетью (${U.esc(AI.name(this.lastAI))}). Нейросеть тоже может ошибаться — в важных случаях сверяйтесь со словарём.</div>`;
      const fix = AI.available()
        ? (canRefine ? 'кнопка «Уточнить перевод» (нейросеть проверит каждую строку)' : 'кнопка «Проверить карту» (нейросеть)')
        : 'подключите нейросеть (бесплатно: Gemini или Groq) — она проверит каждую строку';
      return `<div class="mt-warn">⚠️ <span><b>Машинный перевод (${U.esc(this.provNames(machine))}) — неточный, его нужно перепроверять.</b>
        Обычные фразы он переводит в основном верно, а устойчивые выражения и идиомы часто переводит дословно и неправильно.
        Как перепроверить: ${fix}, или сверьтесь с более точными источниками — DeepL, словари NAOB, LEXIN, Glosbe.</span></div>`;
    },
    /** opts.quiet: no «please wait» card (background work); opts.only: just these translators; opts.noAI: no neural network */
    async translateMany(texts, from = 'no', to = 'ru', opts = {}) {
      const clean = t => String(t || '').replace(/\s*\n\s*/g, ' ').trim();
      const src = texts.map(clean);
      const by = new Set();
      const out = src.map(t => { const c = this._trCache.get(`${from}|${to}|${t}`); if (c) by.add(c.id); return c ? c.t : ''; });
      const todo = () => src.map((t, i) => i).filter(i => src[i] && !out[i]);
      // ⏳ more than a few lines to translate: a «please wait» card with the progress
      const total = todo().length;
      let done = 0;
      const busy = total > 3 && !opts.quiet ? UI.busy('Подождите — идёт перевод…') : null;
      if (busy) busy.set(`0 из ${total}`, 0, total);
      const put = (i, t, id) => {
        t = String(t || '').trim(); if (!t) return;
        if (!out[i]) { done++; if (busy) busy.set(`${done} из ${total}`, done, total); }
        out[i] = t; by.add(id); this._trCache.set(`${from}|${to}|${src[i]}`, { t, id });
        // whoever shows these lines can draw each one as it arrives (gradually, not all at the end)
        if (this.onPut) { try { this.onPut(); } catch (e) { /* drawing is not our business */ } }
      };
      try { return await this._translateMany(src, from, to, out, by, todo, put, opts); } finally { if (busy) busy.close(); }
    },
    /** a translation already made in this session (lines that arrived while a long translation is still running) */
    cached(text, from = 'no', to = 'ru') {
      const c = this._trCache.get(`${from}|${to}|${String(text || '').replace(/\s*\n\s*/g, ' ').trim()}`);
      return c ? c.t : undefined;
    },
    async _translateMany(src, from, to, out, by, todo, put, opts = {}) {
      const S = Store.settings;
      const pool = async (ids, fn, n) => { let k = 0; await Promise.all(Array.from({ length: Math.min(n, ids.length) }, async () => { while (k < ids.length) await fn(ids[k++]); })); };
      const steps = {
        // DeepL: 40 texts per request
        deepl: async () => {
          const key = (S.deeplKey || '').trim();
          const host = /:fx$/.test(key) ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
          const ids = todo();
          for (let k = 0; k < ids.length; k += 40) {
            const part = ids.slice(k, k + 40);
            try {
              const r = await AI.post(host + '/v2/translate', { 'content-type': 'application/json', authorization: 'DeepL-Auth-Key ' + key },
                { text: part.map(i => src[i]), source_lang: deeplSrc(CODES.deepl[from]), target_lang: CODES.deepl[to] });
              if (!r.ok) {
                this.deeplError = r.status === 456 ? 'DeepL: месячный лимит исчерпан' : r.status === 403 ? 'DeepL: неверный ключ' : 'DeepL: ошибка ' + r.status;
                if (r.status === 456) this.trRest('deepl', 12 * 60); else if (r.status === 429 || r.status >= 500) this.trRest('deepl', 5);
                return;
              }
              (r.data.translations || []).forEach((t, n) => put(part[n], t.text, 'deepl'));
            } catch (e) { this.deeplError = e.message; this.trRest('deepl', 3); return; }
          }
        },
        // Google: a few requests of ~1200 characters, one text per line (dozens of parallel calls get blocked)
        google: async () => {
          const gtx = async q => {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${CODES.google[from]}&tl=${CODES.google[to]}&dt=t&q=${encodeURIComponent(q)}`;
            // Google said «too many» a moment ago: let it rest (every extra request only makes the block longer)
            if (this.gCooling()) throw Object.assign(new Error('Google временно ограничил переводы — перевожу другими переводчиками'), { limit: true });
            let r;
            try { r = await fetch(url); } catch (e) {
              // the browser could not reach Google (blocker, network filter) — the Mac bridge can
              if (!(AI.bridge && AI.bridge.up)) throw new Error('нет связи с Google Переводчиком (интернет или блокировщик рекламы)');
              r = await fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, method: 'GET' }) });
            }
            // refused (limit): the same request once more through the Mac bridge — another client, often still allowed
            if (!r.ok && (r.status === 429 || r.status === 403) && AI.bridge && AI.bridge.up) {
              try { const b = await fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, method: 'GET' }) }); if (b.ok) r = b; } catch (e) { /* keep the first answer */ }
            }
            if (!r.ok && (r.status === 429 || r.status === 403)) this.gCool();
            if (!r.ok) throw Object.assign(new Error(r.status === 429 || r.status === 403 ? 'Google временно ограничил переводы с вашего адреса (слишком много запросов за короткое время) — подождите 5–15 минут' : 'Google ответил ошибкой ' + r.status), { limit: r.status === 429 || r.status === 403 });
            const j = await r.json();
            return (j[0] || []).map(x => x[0] || '').join('');
          };
          const wait = ms => new Promise(res => setTimeout(res, ms));
          /** «gradually», like before: one line at a time with a small pause; stops only after several refusals in a row */
          const slow = async ids => {
            let fails = 0;
            for (const i of ids) {
              if (out[i]) continue;
              try { put(i, await gtx(src[i]), 'google'); fails = 0; await wait(250); } catch (e) {
                this.lastError = e.message;
                if (++fails >= 4) return false;
                await wait(1500 * fails); // back off a little and go on
              }
            }
            return true;
          };
          const chunks = []; let cur = [], len = 0;
          todo().forEach(i => { if (cur.length && (len + src[i].length > 1200 || cur.length >= 60)) { chunks.push(cur); cur = []; len = 0; } cur.push(i); len += src[i].length + 1; });
          if (cur.length) chunks.push(cur);
          // lines got merged by Google → split the part in halves (a few more requests, not one per line)
          const run = async ch => {
            const lines = (await gtx(ch.map(i => src[i]).join('\n'))).split('\n').map(s => s.trim());
            if (lines.length === ch.length) ch.forEach((i, k) => put(i, lines[k], 'google'));
            else if (ch.length === 1) put(ch[0], lines.join(' '), 'google');
            else { const h = Math.ceil(ch.length / 2); await run(ch.slice(0, h)); await run(ch.slice(h)); }
          };
          for (const ch of chunks) {
            try { await run(ch); } catch (e) {
              this.lastError = e.message;
              // refused for your address → first the spare translator (Mozhi), then — if something is still left —
              // Google again, gradually, one line at a time with pauses (as it used to). No internet → stop.
              if (e.limit && !this.gCooling()) this._gSlow = async () => { await wait(1200); await slow(todo()); };
              return;
            }
          }
        },
        // Mozhi: Google quality through public open-source servers — for when Google refuses your address
        // (Lingva, the older service of this kind, stopped working everywhere in 2026)
        mozhi: async () => {
          const hosts = ['https://mozhi.ducks.party', 'https://mozhi.pussthecat.org'];
          let alive = hosts.slice();
          const ask = async q => {
            for (const h of alive.slice()) {
              try {
                const r = await fetch(`${h}/api/translate?engine=google&from=${CODES.google[from]}&to=${CODES.google[to]}&text=${encodeURIComponent(q)}`);
                if (r.ok) { const j = await r.json(); const t = j && (j['translated-text'] || j.translated_text); if (t) return t; }
                if (r.status >= 500 || r.status === 404) alive = alive.filter(x => x !== h);
              } catch (e) { alive = alive.filter(x => x !== h); }
            }
            throw new Error('Mozhi сейчас не отвечает');
          };
          const chunks = []; let cur = [], len = 0;
          todo().forEach(i => { if (cur.length && (len + src[i].length > 700 || cur.length >= 25)) { chunks.push(cur); cur = []; len = 0; } cur.push(i); len += src[i].length + 1; });
          if (cur.length) chunks.push(cur);
          const run = async ch => {
            const lines = String(await ask(ch.map(i => src[i]).join('\n'))).split('\n').map(s => s.trim());
            if (lines.length === ch.length) ch.forEach((i, k) => put(i, lines[k], 'mozhi'));
            else if (ch.length === 1) put(ch[0], lines.join(' '), 'mozhi');
            else { const h = Math.ceil(ch.length / 2); await run(ch.slice(0, h)); await run(ch.slice(h)); }
          };
          for (const ch of chunks) {
            if (!alive.length) { if (!this.lastError) this.lastError = 'Mozhi сейчас не отвечает'; this.trRest('mozhi', 10); return; }
            try { await run(ch); } catch (e) { if (!this.lastError) this.lastError = e.message; }
          }
          // every server died during the last (or only) part: it rests too, not only when a next part is left
          if (!alive.length) this.trRest('mozhi', 10);
        },
        // AI: one request for everything that is still missing
        ai: async () => {
          const left = todo(); if (!left.length) return;
          try {
            const arr = left.map(i => src[i]);
            const lang = c => ({ no: 'Norwegian Bokmål', ru: 'Russian', en: 'English', uk: 'Ukrainian' })[c] || c;
            const r = AI.parseJSON(await AI.call({
              system: `Translate each ${lang(from)} line of the JSON array into ${lang(to)}. Return ONLY a JSON array of strings with the same length and order.`,
              user: JSON.stringify(arr), maxTokens: Math.min(4000, 200 + arr.join(' ').length * 3), temperature: 0.1, quiet: true,
            }));
            this.lastAI = AI.lastProvider;
            const list = Array.isArray(r) ? r : (r && (r.translations || r.items)) || [];
            left.forEach((i, k) => put(i, list[k], 'ai'));
          } catch (e) { /* next one */ }
        },
      };
      // Microsoft / MyMemory: one text per request, 3 at a time
      const single = id => async () => {
        let fails = 0, got = 0;
        await pool(todo(), async i => {
          if (fails > 2) return;
          try { put(i, await this.translate(id, src[i], from, to), id); got++; } catch (e) { fails++; if (!this.lastError) this.lastError = `${(LIST[id] || {}).name || id}: ${e.message}`; }
        }, 3);
        // it kept refusing (daily limit, server down): it rests; the next ones start without it
        if (fails > 2 && !got) this.trRest(id, /лимит|limit|quota|warning/i.test(this.lastError) ? 60 : 10);
      };
      this.lastError = '';
      let order = this.dictOrder();
      // MyMemory as the spare translator when Google is the only one (it is free, no key)
      if (!order.includes('mymemory')) order.push('mymemory');
      // the free spares always stand in line too (switching between translators is always on)
      ['mozhi', 'mymemory'].forEach(id => { if (!order.includes(id)) order.push(id); });
      if (opts.only) order = order.filter(id => opts.only.includes(id));
      if (opts.noAI) order = order.filter(id => id !== 'ai');
      // 🔁 a translator that refused a moment ago (limit, down) goes to the end: the working ones translate first
      const resting = id => id === 'google' ? this.gCooling() : this.trResting(id);
      order = [...order.filter(id => !resting(id)), ...order.filter(id => resting(id))];
      this._gSlow = null;
      for (const id of order) {
        if (!todo().length) break;
        const before = todo().length;
        await (steps[id] || single(id))();
        if (todo().length < before) this.trUnrest(id); // it answered again — no more rest
      }
      if (todo().length && this._gSlow) { const s = this._gSlow; this._gSlow = null; await s(); }
      const missing = todo().length;
      return { out, by: [...by], missing, error: missing ? this.lastError || 'переводчики сейчас не отвечают' : '' };
    },

    /** other meanings of ONE Norwegian word (Google: dictionary + alternative translations) — for finding the word
     *  in a sentence translation. One request; refused / resting Google → throws (the caller stops asking). */
    async alts(word, from = 'no', to = 'ru') {
      const j = await this.gget(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${CODES.google[from]}&tl=${CODES.google[to]}&dt=t&dt=bd&dt=at&q=${encodeURIComponent(word)}`);
      const out = [];
      const add = t => { t = String(t || '').trim(); if (t && t.length <= 40 && /[а-яё]/i.test(t) && !out.includes(t)) out.push(t); };
      ((j && j[0]) || []).forEach(x => add(x && x[0]));
      ((j && j[1]) || []).forEach(g => (g[1] || []).forEach(add));
      ((j && j[5]) || []).forEach(seg => (seg[2] || []).forEach(x => add(x && x[0])));
      return out.slice(0, 8);
    },
    /** main translation + other meanings (Google dictionary, MyMemory matches) */
    async detail(id, text, from, to, opts = {}) {
      if (id === 'google') {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${CODES.google[from]}&tl=${CODES.google[to]}&dt=t&dt=bd&q=${encodeURIComponent(text)}`;
        const j = await this.gget(url);
        const main = (j[0] || []).map(x => x[0]).join('').trim();
        const alts = [];
        const collect = jj => (jj[1] || []).forEach(group => (group[1] || []).forEach(t => { if (alts.length < 10 && !alts.includes(t)) alts.push(t); }));
        collect(j);
        // Google's dictionary doesn't know "å spise" / "en bil" — ask again with the bare word for other meanings
        const bare = text.replace(/^(å|en|ei|et)\s+/i, '');
        if (!alts.length && bare !== text) {
          try { collect(await this.gget(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${CODES.google[from]}&tl=${CODES.google[to]}&dt=t&dt=bd&q=${encodeURIComponent(bare)}`)); } catch (e) { /* ignore */ }
        }
        return { main, alts: alts.filter(a => U.norm(a) !== U.norm(main)) };
      }
      if (id === 'mymemory') {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${CODES.mymemory[from]}|${CODES.mymemory[to]}`;
        const j = await (await fetch(url)).json();
        const main = j && j.responseData && j.responseData.translatedText;
        if (!main || /MYMEMORY WARNING|INVALID/i.test(main)) throw new Error('MyMemory: лимит или ошибка');
        const alts = [];
        (j.matches || []).forEach(m => { const t = String(m.translation || '').trim(); if (t && t.length < 60 && !alts.some(a => U.norm(a) === U.norm(t)) && U.norm(t) !== U.norm(main)) alts.push(t); });
        return { main: main.trim(), alts: alts.slice(0, 6) };
      }
      return { main: await this.translate(id, text, from, to, opts), alts: [] };
    },

    /* ---------- word forms (from the card) translated one by one ---------- */
    LABELS: {
      verb: ['Инфинитив (infinitiv)', 'Настоящее (presens)', 'Прошедшее (preteritum)', 'Перфект (perfektum)', 'Повелительное (imperativ)'],
      substantiv: ['Неопр. ед. (ubestemt entall)', 'Опр. ед. (bestemt entall)', 'Неопр. мн. (ubestemt flertall)', 'Опр. мн. (bestemt flertall)'],
      adjektiv: ['м/ж род (hankjønn/hunkjønn)', 'ср. род (intetkjønn)', 'мн. / опр. (flertall/bestemt)', 'Сравнительная (komparativ)', 'Превосходная (superlativ)'],
    },
    /** forms of the card: saved ones, or parsed from "verb: å spise – spiser – spiste – har spist" */
    parseForms(card) {
      if ((card.forms || []).length) return { cls: card.wordClass || '', items: card.forms.map(f => ({ label: f.label, no: f.no })) };
      const m = String(card.description || '').match(/^\s*(verb|substantiv|adjektiv)\s*:\s*([^\n]+)/im);
      if (!m) return null;
      const cls = m[1].toLowerCase();
      const parts = m[2].replace(/\([^)]*\)/g, ' ').split(/\s+[–—-]\s+/).map(s => s.trim()).filter(Boolean).slice(0, 6);
      if (parts.length < 2) return null;
      const labels = this.LABELS[cls] || [];
      return { cls, items: parts.map((no, i) => ({ label: labels[i] || '', no })) };
    },
    /** verbs get a pronoun so the translation shows person and tense: "spiste" -> "jeg spiste" -> "я ел" */
    formQuery(cls, no, i) {
      if (cls === 'verb' && i > 0 && !/^(å|jeg|du|han|hun|vi|dere|de)\s/i.test(no)) return (i === 4 ? '' : 'jeg ') + no;
      return no;
    },
    async translateForms(id, card, opts = {}) {
      const p = this.parseForms(card);
      if (!p) return null;
      const items = await Promise.all(p.items.map(async (f, i) => {
        const q = this.formQuery(p.cls, f.no, i);
        try { return { label: f.label, no: q, ru: await this.translate(id, q, 'no', 'ru', opts) }; }
        catch (e) { return { label: f.label, no: q, ru: '' }; }
      }));
      return { cls: p.cls, items: items.filter(x => x.ru) };
    },

    /** does the translator agree with the card? */
    agrees(result, existing) {
      const alts = s => U.alternatives(String(s || '').split('\n')[0]).map(x => U.norm(x, { stripArticles: true }));
      const a = alts(result), b = alts(existing);
      return a.some(x => b.some(y => x && y && (x === y || x.includes(y) || y.includes(x))));
    },

    /** who took part in this card -> { 'tr:google': 2, 'ai:gemini': 1, ... } */
    activity(card, extraBys = []) {
      const counts = {};
      const add = by => { if (/^(tr|ai):/.test(by)) counts[by] = (counts[by] || 0) + 1; };
      if (card) {
        (card.history || []).forEach(h => add(h.by));
        if (!(card.history || []).some(h => String(h.by).startsWith('ai:'))) (card.aiChecks || []).forEach(x => add('ai:' + x.p));
      }
      extraBys.forEach(add);
      return counts;
    },
    /** one rail button (key = 'tr:google' | 'ai:gemini'); glows when it worked on this card */
    btnHtml(key, n, opts) {
      const [k, id] = key.split(':');
      const isAI = k === 'ai';
      const name = isAI ? AI.PROVIDERS[id].short : LIST[id].name;
      const state = n ? `работал с карточкой: ${n}×` : 'ещё не участвовал';
      const extra = opts.needsKey ? '🔑 без ключа откроется сайт' : opts.web ? 'откроется сайт ↗' : isAI ? 'перевод и сверка нейросетью' : 'перевод прямо в карточку';
      return `<button class="tr-btn ${opts.web || opts.needsKey ? 'web' : ''} ${opts.needsKey ? 'nokey' : ''} ${n ? 'on' : ''}" ${isAI ? `data-ai="${id}"` : `data-tr="${id}"`} data-rk="${key}" data-kind="${k}"
          title="${U.esc(name)} — ${state} · ${extra}">
          <span class="tr-ico">${isAI ? AI.icon(id, 22, name) : this.icon(id, 22)}</span>${n ? `<span class="tr-count">${n}</span>` : ''}
          <span class="tr-tip"><b>${U.esc(name)}</b><small>${state}<br>${extra}</small></span></button>`;
    },
    /** RIGHT rail: translators (inline first) + dictionaries/sites */
    railHtml(extraCls = '', card = null) {
      const act = this.activity(card);
      const ids = this.enabled().filter(id => id !== 'ai');
      const inline = ids.filter(id => !LIST[id].web);
      const web = ids.filter(id => LIST[id].web);
      return `<div class="tr-rail ${extraCls}" data-tr-rail data-side="right">
        ${inline.map(id => this.btnHtml('tr:' + id, act['tr:' + id] || 0, { needsKey: LIST[id].key && !this.inline(id) })).join('')}
        <button class="tr-btn compare" data-tr="compare" title="Сравнить все переводчики и нейросети"><span class="tr-ico">⚖️</span><span class="tr-tip"><b>Сравнить все</b><small>все переводчики рядом</small></span></button>
        ${web.length ? `<button class="tr-btn more ${web.some(id => act['tr:' + id]) ? 'on' : ''}" data-tr="more" title="Ещё словари: ${web.map(id => LIST[id].name).join(', ')}">
          <span class="tr-ico">📚</span><span class="tr-tip"><b>Ещё словари</b><small>${web.map(id => U.esc(LIST[id].name)).join(' · ')}</small></span></button>` : ''}
      </div>`;
    },
    /** popover with the dictionary websites (opened with the word already filled in) */
    /**
     * popover with the dictionary websites. Each: ↗ open with the word filled in, 📋 paste what you copied there
     * (translated line by line, with the dictionary as the source). Forvo is audio only — no paste.
     */
    moreMenu(anchor, text, from, to, onOpen, onPaste) {
      const web = this.enabled().filter(id => LIST[id] && LIST[id].web);
      const canPaste = id => !!onPaste && id !== 'forvo';
      const pop = UI.popover(anchor, `<div class="pop-title">📚 Словари и сайты</div>
        <div class="lt-grid">${web.map(id => `<div class="lt-tile web-tile">
          <span class="web-ico">${this.icon(id, 26)}</span>
          <span class="lt-text"><b>${U.esc(LIST[id].name)}</b><small>${U.esc(LIST[id].note)}</small>
            <span class="row" style="gap:6px;margin-top:6px">
              <button class="btn sm" data-web="${id}">↗ Открыть</button>
              ${canPaste(id) ? `<button class="btn sm primary" data-paste="${id}">📋 Вставить в карточку</button>` : ''}
            </span></span></div>`).join('')}</div>`, 'layout-pop');
      pop.el.onclick = e => {
        const o = e.target.closest('[data-web]');
        const p = e.target.closest('[data-paste]');
        if (o) {
          const id = o.dataset.web;
          pop.close();
          const go = () => {
            this.open(id, text, from, to);
            onOpen && onOpen(id);
            // when the user comes back from the site — one click to bring the copied text into the card
            if (canPaste(id)) UI.toastAction(`Скопировали текст на сайте ${LIST[id].name}? Вставьте его в карточку с переводом`, `📋 Вставить из ${LIST[id].name}`, () => onPaste(id), 60000, '📋');
          };
          // explain the copy -> paste way once (Forvo is audio only — just open it)
          if (canPaste(id)) Guides.webDict(id, go); else go();
        }
        if (p) { pop.close(); onPaste(p.dataset.paste); }
      };
    },
    /** LEFT rail: connected neural networks (each with its own icon) */
    aiRailHtml(extraCls = '', card = null) {
      const act = this.activity(card);
      const ids = AI.chain();
      return `<div class="tr-rail ai-rail ${extraCls}" data-ai-rail data-side="left">
        ${ids.map(id => this.btnHtml('ai:' + id, act['ai:' + id] || 0, {})).join('')}
        <button class="tr-btn add" data-ai="add" title="Подключить нейросеть"><span class="tr-ico">＋</span><span class="tr-tip"><b>Подключить нейросеть</b><small>Gemini, Groq, Claude, ChatGPT…</small></span></button>
      </div>`;
    },
    /**
     * FRONT side of the card: only the services that already worked on it, big and glowing,
     * in the same place as on the back (AIs left, translators right). Click -> history.
     */
    activeRailsHtml(card) {
      const act = this.activity(card);
      const keys = Object.keys(act);
      const btn = key => {
        const [k, id] = key.split(':');
        const name = k === 'ai' ? (AI.PROVIDERS[id] || {}).short : (LIST[id] || {}).name;
        if (!name) return '';
        return `<button class="tr-btn on" data-prov="${key}" data-card="${card.id}" data-kind="${k}" title="${U.esc(name)} — работал с карточкой: ${act[key]}× · нажмите, чтобы увидеть историю">
          <span class="tr-ico">${k === 'ai' ? AI.icon(id, 26, name) : this.icon(id, 26)}</span><span class="tr-count">${act[key]}</span>
          <span class="tr-tip"><b>${U.esc(name)}</b><small>работал с карточкой: ${act[key]}×<br>нажмите — история</small></span></button>`;
      };
      const ai = keys.filter(k => k.startsWith('ai:')), tr = keys.filter(k => k.startsWith('tr:'));
      return (ai.length ? `<div class="tr-rail vertical card-rail left front-rail" data-side="left">${ai.map(btn).join('')}</div>` : '')
        + (tr.length ? `<div class="tr-rail vertical card-rail right front-rail" data-side="right">${tr.map(btn).join('')}</div>` : '');
    },

    /** light up rails after an action (with a short "burst" on the icon just used) */
    light(rail, card, extraBys = [], burstKey = null) {
      if (!rail) return;
      const act = this.activity(card, extraBys);
      rail.querySelectorAll('[data-rk]').forEach(b => {
        const id = b.dataset.rk;
        const n = act[id] || 0;
        b.classList.toggle('on', !!n);
        let cnt = b.querySelector('.tr-count');
        if (n) { if (!cnt) { cnt = document.createElement('span'); cnt.className = 'tr-count'; b.appendChild(cnt); } cnt.textContent = n; }
        else if (cnt) cnt.remove();
        if (id === burstKey) { b.classList.remove('burst'); void b.offsetWidth; b.classList.add('burst'); setTimeout(() => b.classList.remove('burst'), 950); }
      });
    },

    /** modal: all translators side by side */
    compareDialog(text, from, to, onPick) {
      const ids = this.enabled().filter(id => !LIST[id].panel);
      const m = UI.modal({
        title: `⚖️ Сравнение переводов · ${from === 'no' ? '🇳🇴 → 🇷🇺' : '🇷🇺 → 🇳🇴'}`, cls: '',
        body: `<div class="tr-src">${UI.rich(text)}</div>
          <div class="tr-compare">${ids.map(id => `<div class="tr-row" data-row="${id}">
            <span class="tr-name">${this.icon(id, 20)} ${U.esc(this.label(id))}</span>
            <span class="tr-res">${this.inline(id) ? '<span class="spinner sm"></span>' : `<span class="muted small">${LIST[id].dict ? 'словарь' : 'на сайте'}</span>`}</span>
            <span class="tr-act">${this.inline(id) ? '' : `<button class="btn sm" data-open="${id}">Открыть ↗</button>`}</span>
          </div>`).join('')}</div>
          <div class="small muted">Совпадающие варианты отмечены ✓ — им можно доверять больше.</div>`,
        foot: `<button class="btn ghost" data-close2>Закрыть</button>`,
      });
      m.$('[data-close2]').onclick = () => m.close();
      const results = {};
      const mark = () => {
        const norm = s => U.norm(s, { stripArticles: true });
        const vals = Object.values(results).filter(Boolean).map(norm);
        Object.entries(results).forEach(([id, r]) => {
          const row = m.$(`[data-row="${id}"] .tr-res`); if (!row || !r) return;
          const n = vals.filter(v => v === norm(r)).length;
          row.querySelector('.agree') && row.querySelector('.agree').remove();
          if (n > 1) row.insertAdjacentHTML('beforeend', ` <span class="chip learned agree">✓ ${n}</span>`);
        });
      };
      ids.filter(id => this.inline(id)).forEach(async id => {
        const cell = m.$(`[data-row="${id}"] .tr-res`), act = m.$(`[data-row="${id}"] .tr-act`);
        try {
          const r = await this.translate(id, text, from, to);
          results[id] = r;
          cell.innerHTML = `<b>${UI.rich(r)}</b>`;
          if (onPick) act.innerHTML = `<button class="btn sm primary" data-pick="${id}">Вставить</button>`;
          mark();
        } catch (e) {
          cell.innerHTML = `<span class="muted small">${U.esc(e.message)}</span>`;
          act.innerHTML = `<button class="btn sm" data-open="${id}">Открыть ↗</button>`;
        }
      });
      m.el.addEventListener('click', e => {
        const o = e.target.closest('[data-open]'); if (o) this.open(o.dataset.open, text, from, to);
        const p = e.target.closest('[data-pick]'); if (p && onPick) { onPick(results[p.dataset.pick], p.dataset.pick); m.close(); }
      });
      return m;
    },
  };

  window.Translators = Translators;
})();
