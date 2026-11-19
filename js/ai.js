/* ============ Claude AI integration ============ */
(function () {
  const API = 'https://api.anthropic.com/v1/messages';
  const FIELDS = ['no', 'ru', 'en', 'description', 'example', 'exampleRu', 'wordClass', 'imagePrompt'];
  const FIELD_NAMES = {
    no: 'Норвежский', ru: 'Русский', en: 'English', description: 'Описание', example: 'Пример (NO)',
    exampleRu: 'Пример (RU)', wordClass: 'Часть речи', imagePrompt: 'Промпт картинки', tags: 'Теги',
  };

  /** shared context: every connected AI immediately knows where it is and what is expected */
  function appContext() {
    const name = (Store.settings.userName || '').trim();
    return `CONTEXT: You are the AI assistant built into "Norsk Kort" — a flashcard app for learning Norwegian (Bokmål) for a Russian-speaking learner${name ? ' named ' + name : ''}. Each card has a Norwegian side, a Russian side and an explanation (grammar forms, notes, examples). Your job: check that the translation is correct, fix mistakes, and add clear explanations — always helping the learner learn Norwegian as fast as possible.
HOUSE STYLE (very important): whenever you write Norwegian words, phrases, expressions or example sentences, put the Russian translation right after them in parentheses, e.g. "Jeg skal hente barna fra skolen. (Я заберу детей из школы.)" or "å hente seg inn (восстановиться)". Explanations themselves are in Russian.`;
  }

  function systemPrompt() {
    const art = Store.settings.aiArticles;
    return `${appContext()}
You are an expert lexicographer and teacher of Norwegian Bokmål for Russian speakers. You check, correct and enrich vocabulary flashcards.
MAIN GOAL: help the learner learn Norwegian as fast as possible. Every change must make the card better for memorising (correct, clear, memorable) and must never break the learner's format or remove their content. You may fix and complete Russian glosses in parentheses, add missing glosses for hard words, add grammar forms and a good example — but keep the card recognisable.
Card fields:
- "no": the Norwegian side (Bokmål). Correct spelling and letters æ ø å.${art ? ' Nouns MUST have the indefinite article (en/ei/et; for feminine nouns use "ei"). Verbs MUST have the infinitive marker "å".' : ' Keep the user\'s style regarding articles.'} Keep it short (the word or phrase only).
- "ru": accurate, natural Russian translation; the most common meaning first; up to 3 meanings separated by ", ".
- "en": English equivalent (1-3 words), used for image search.
- "description": a short helpful note IN RUSSIAN (max ~300 chars): part of speech and grammar forms (nouns: ubestemt entall – bestemt entall – ubestemt flertall – bestemt flertall; verbs: infinitiv – presens – preteritum – perfektum; adjectives: m/f – n – pl/bestemt), plus nuance/usage and 1 common expression if useful — every Norwegian phrase followed by its Russian translation in parentheses (house style).
- "example": one short natural Norwegian sentence (A1–B1) using the word.
- "exampleRu": Russian translation of that sentence.
- "wordClass": one of: substantiv, verb, adjektiv, adverb, preposisjon, pronomen, konjunksjon, tallord, interjeksjon, uttrykk.
- "imagePrompt": an English prompt for an image generator that depicts the MEANING clearly and unambiguously (a concrete object/scene/action/emotion; no text, no letters, no words in the image).
Rules: keep the user's content when it is correct (do not rephrase for style only). The user often writes interlinear text like "Hun (Она) er (есть) snill (добрая)" — Russian glosses in parentheses after Norwegian words: this format is intentional, KEEP it (only fix wrong glosses/spelling inside it). Multi-line notes with examples written by the user are intentional too. If a field value ends with "…[truncated]", return exactly "__KEEP__" for that field. Fix real errors: wrong translation, misspelling, wrong gender/article, Norwegian and Russian sides swapped or mismatched, nynorsk/danish forms instead of bokmål. Fill empty fields. Write "issues" IN RUSSIAN, short, only for real errors in the user's original "no"/"ru" fields. Respond with ONLY valid JSON, no markdown.`;
  }

  /* ---------- catalogue of AI services ----------
   * type: bridge (Claude subscription via Claude Code) | anthropic | openai (OpenAI-compatible chat/completions)
   * domain -> real service icon (favicon)
   */
  const PROVIDERS = {
    claude: { name: 'Claude (подписка)', short: 'Claude', domain: 'claude.ai', type: 'bridge', note: 'Ваш вход в Claude Code (Pro/Max) через мост — без ключа', models: ['', 'sonnet', 'opus', 'haiku'] },
    anthropic: { name: 'Claude API', short: 'Claude', domain: 'claude.ai', type: 'anthropic', base: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-5', keyUrl: 'https://console.anthropic.com/settings/keys', models: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'] },
    openai: { name: 'ChatGPT (OpenAI)', short: 'ChatGPT', domain: 'chatgpt.com', type: 'openai', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com/api-keys', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini'] },
    deepseek: { name: 'DeepSeek', short: 'DeepSeek', domain: 'deepseek.com', type: 'openai', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys', models: ['deepseek-chat', 'deepseek-reasoner'], cheap: true },
    gemini: { name: 'Google Gemini', short: 'Gemini', domain: 'gemini.google.com', type: 'openai', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-flash-latest', keyUrl: 'https://aistudio.google.com/apikey', models: ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'], free: true, limits: '≈15 запросов/мин, ~500 в день · без карты' },
    groq: { name: 'Groq (GPT-OSS, Qwen, Llama)', short: 'Groq', domain: 'groq.com', type: 'openai', base: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', keyUrl: 'https://console.groq.com/keys', models: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'llama-3.3-70b-versatile'], free: true, limits: '≈30 запросов/мин, ~1000 в день · без карты' },
    openrouter: { name: 'OpenRouter (бесплатные :free модели)', short: 'OpenRouter', domain: 'openrouter.ai', type: 'openai', base: 'https://openrouter.ai/api/v1', model: 'google/gemma-4-31b-it:free', keyUrl: 'https://openrouter.ai/keys', models: ['google/gemma-4-31b-it:free', 'nvidia/nemotron-3-ultra-550b-a55b:free', 'openai/gpt-4o-mini'], free: true, limits: '20 запросов/мин, 50 в день · без карты (список :free моделей меняется)' },
    mistral: { name: 'Mistral (план Experiment)', short: 'Mistral', domain: 'mistral.ai', type: 'openai', base: 'https://api.mistral.ai/v1', model: 'mistral-medium-latest', keyUrl: 'https://console.mistral.ai/api-keys', models: ['mistral-medium-latest', 'mistral-small-latest', 'mistral-large-latest'], free: true, limits: '≈1 запрос/сек, огромный месячный лимит · без карты (нужен телефон)' },
    cohere: { name: 'Cohere (есть модель-переводчик)', short: 'Cohere', domain: 'cohere.com', type: 'openai', base: 'https://api.cohere.ai/compatibility/v1', model: 'command-a-03-2025', keyUrl: 'https://dashboard.cohere.com/api-keys', models: ['command-a-03-2025', 'command-a-translate-08-2025'], free: true, limits: '20 запросов/мин, 1000 в месяц · без карты' },
    nvidia: { name: 'NVIDIA NIM (через мост на Mac)', short: 'NVIDIA', domain: 'nvidia.com', type: 'openai', base: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.3-70b-instruct', keyUrl: 'https://build.nvidia.com', models: ['meta/llama-3.3-70b-instruct', 'openai/gpt-oss-120b', 'qwen/qwen3-235b-a22b'], free: true, proxyOnly: true, limits: '40 запросов/мин, ~1000 кредитов · браузер не пускает — нужен мост' },
    zai: { name: 'Z.ai GLM Flash (через мост на Mac)', short: 'GLM', domain: 'z.ai', type: 'openai', base: 'https://api.z.ai/api/paas/v4', model: 'glm-4.5-flash', keyUrl: 'https://z.ai/manage-apikey/apikey-list', models: ['glm-4.5-flash', 'glm-4.7-flash'], free: true, proxyOnly: true, limits: 'бесплатные flash-модели · браузер не пускает — нужен мост' },
    xai: { name: 'Grok (xAI)', short: 'Grok', domain: 'x.ai', type: 'openai', base: 'https://api.x.ai/v1', model: 'grok-3-mini', keyUrl: 'https://console.x.ai', models: ['grok-3-mini', 'grok-3', 'grok-4'] },
    pollinations: { name: 'Pollinations — бесплатный ключ', short: 'Pollinations', domain: 'pollinations.ai', type: 'openai', base: 'https://text.pollinations.ai/openai', fullUrl: true, model: 'openai', free: true, keyUrl: 'https://enter.pollinations.ai', note: 'Тот же ключ, что для ИИ-рисунков (Настройки → Картинки)', models: ['openai', 'mistral', 'deepseek'] },
    ollama: { name: 'Ollama — локально на Mac, бесплатно', short: 'Ollama', domain: 'ollama.com', type: 'openai', base: 'http://localhost:11434/v1', model: 'llama3.1', noKey: true, free: true, keyUrl: 'https://ollama.com/download', models: ['llama3.1', 'qwen2.5', 'gemma2'] },
    custom: { name: 'Своя нейросеть (OpenAI-совместимая)', short: 'ИИ', domain: '', type: 'openai', base: '', model: '', editableBase: true, models: [] },
  };

  const AI = {
    FIELDS, FIELD_NAMES, PROVIDERS,
    bridge: { ok: false, up: false, version: '', error: '' },
    async detectBridge() {
      this.bridge = { ok: false, up: false, version: '', error: '' };
      if (!/^https?:$/.test(location.protocol)) { this.bridge.error = 'Приложение открыто как файл — запустите мост (bridge/server.py)'; return this.bridge; }
      try {
        const r = await fetch('/api/status', { cache: 'no-store' });
        if (r.ok) { const j = await r.json(); this.bridge = { ok: !!j.ok, up: true, version: j.version || '', error: j.error || '' }; }
        else this.bridge.error = 'Мост не запущен';
      } catch (e) { this.bridge.error = 'Мост не запущен'; }
      return this.bridge;
    },

    /* ---------- providers ---------- */
    cfg(id) {
      const st = Store.settings;
      st.aiCfg = st.aiCfg || {};
      const c = st.aiCfg[id] || (st.aiCfg[id] = {});
      // migrate the old single Claude key
      if (id === 'anthropic' && !c.key && st.claudeKey) { c.key = st.claudeKey; c.model = c.model || st.claudeModel; }
      if (id === 'claude' && c.model == null && st.bridgeModel) c.model = st.bridgeModel;
      return c;
    },
    configured(id) {
      const p = PROVIDERS[id]; if (!p) return false;
      if (p.type === 'bridge') return this.bridge.ok;
      const c = this.cfg(id);
      // Pollinations now rejects anonymous requests — its free key is required
      if (id === 'pollinations') return !!((c.key || '').trim() || (Store.settings.pollinationsToken || '').trim());
      if (p.editableBase && !(c.base || '').trim()) return false;
      return !!(p.noKey || (c.key || '').trim());
    },
    /** provider actually used now */
    current() {
      const sel = Store.settings.aiProvider || 'auto';
      if (sel !== 'auto') return PROVIDERS[sel] ? sel : null;
      if (this.bridge.ok) return 'claude';
      return Object.keys(PROVIDERS).find(id => id !== 'claude' && !PROVIDERS[id].noKey && this.configured(id)) || null;
    },
    mode() { return this.current() === 'claude' ? 'bridge' : 'api'; },
    available(id) { id = id || this.current(); return !!id && this.configured(id); },
    model(id) { const p = PROVIDERS[id]; return (this.cfg(id).model || '').trim() || p.model || ''; },
    name(id) { id = id || this.current(); return id && PROVIDERS[id] ? PROVIDERS[id].short : 'ИИ'; },
    shortName() { return this.name(); },
    who() {
      const st = Store.settings;
      const name = (st.userName || '').trim();
      const id = this.current();
      const label = id === 'claude' ? `Claude ${st.plan || ''}`.trim() : (id ? PROVIDERS[id].short : 'ИИ');
      return `${name ? name + ' · ' : ''}${label}`;
    },
    /** real service icon */
    icon(id, size = 16, title) {
      const p = PROVIDERS[id];
      if (!p) return '';
      const t = U.esc(title || p.name);
      if (!p.domain) return `<span class="ai-ico" title="${t}" style="font-size:${size - 2}px">🤖</span>`;
      return `<img class="ai-ico" src="https://www.google.com/s2/favicons?domain=${p.domain}&sz=64" width="${size}" height="${size}" alt="${U.esc(p.short)}" title="${t}" onerror="this.replaceWith(document.createTextNode('🤖'))">`;
    },
    /** icons of every AI that checked this card */
    cardBadges(card, size = 15) {
      const list = (card.aiChecks || []).slice();
      if (!list.length && card.aiChecked) list.push({ p: card.aiBy || 'claude', t: card.aiChecked });
      const seen = new Set();
      return list.filter(x => PROVIDERS[x.p] && !seen.has(x.p) && seen.add(x.p))
        .map(x => this.icon(x.p, size, `Проверено: ${PROVIDERS[x.p].name}${x.m ? ' (' + x.m + ')' : ''} · ${U.fmtDate(x.t)}`)).join('');
    },
    /** fields to store on a card after a check */
    /** opts: { action, fields, note, history:false } — also writes the card history (provenance) */
    stamp(card, id, opts = {}) {
      id = id || this.lastProvider || this.current();
      const entry = { p: id, m: this.model(id), t: Date.now() };
      const list = ((card && card.aiChecks) || []).filter(x => x.p !== id).concat(entry);
      const out = { aiChecked: entry.t, aiBy: id, aiChecks: list };
      if (opts.history !== false && window.Prov) {
        out.history = Prov.add(card, Prov.entry('ai:' + id, opts.action || 'check', opts.fields, opts.note || (entry.m ? 'модель ' + entry.m : '')));
      }
      return out;
    },

    async callBridge({ system, user }) {
      let res;
      try {
        res = await fetch('/api/claude', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ system, user, model: this.model('claude') }) });
      } catch (e) { throw new Error('Мост к Claude не отвечает — запустите bridge/server.py'); }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // the Claude Code login on this Mac expired: stop using it (badge turns red) and say how to fix
        if (/401|oauth|authenticat|expired|log ?in/i.test(j.error || '')) {
          this.bridge.ok = false;
          this.bridge.error = 'Вход в Claude Code истёк — в Терминале выполните  claude  и затем  /login';
          if (window.App && App.updateBadge) App.updateBadge();
          if (!this._authToast) { this._authToast = true; UI.toast('Claude: вход истёк. В Терминале: claude → /login, затем обновите страницу', 'warn', 8000); }
          throw new Error('Claude: вход в Claude Code истёк — выполните claude → /login');
        }
        throw new Error('Claude: ' + (j.error || res.statusText));
      }
      return j.text || '';
    },

    /** HTTP POST: direct from the browser; if blocked (CORS) and the bridge is running — through the bridge */
    async post(url, headers, body) {
      let res;
      try {
        res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      } catch (e) {
        if (!this.bridge.up) throw new Error('Нет связи с сервисом (интернет или ограничение браузера). Запустите мост bridge/server.py — он передаст запрос.');
        res = await fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, headers, body }) });
      }
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    },
    errText(id, status, data) {
      const n = PROVIDERS[id].short;
      const msg = (data && (data.error && (data.error.message || data.error)) || data.message || data.detail) || '';
      if (status === 401 || status === 403) return `${n}: неверный ключ или нет доступа`;
      if (status === 404) return `${n}: модель «${this.model(id)}» не найдена — выберите другую в Настройках`;
      if (status === 429) return `${n}: лимит запросов исчерпан, подождите немного`;
      if (status === 402) return `${n}: на счёте нет средств`;
      return `${n}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`.slice(0, 400);
    },

    /** order of AIs to try: the chosen one first, then every other connected one (free first);
     *  a network whose limit ran out a moment ago goes to the end (it is asked only if all others fail too) */
    chain() {
      const first = this.current();
      // key-less local services (Ollama) only when chosen explicitly — otherwise every failure would end with a localhost error
      const rest = Object.keys(PROVIDERS).filter(id => id !== first && !PROVIDERS[id].noKey && this.configured(id))
        .sort((a, b) => (PROVIDERS[b].free ? 1 : 0) - (PROVIDERS[a].free ? 1 : 0));
      const all = first ? [first, ...rest] : rest;
      return [...all.filter(id => !this.resting(id)), ...all.filter(id => this.resting(id))];
    },
    /* ---------- 🔁 limits: a network that said «limit reached» rests, the next one answers meanwhile ---------- */
    _rest: null,
    restMap() {
      if (!this._rest) { try { this._rest = JSON.parse(localStorage.getItem('nk-ai-rest') || '{}'); } catch (e) { this._rest = {}; } }
      return this._rest;
    },
    /** how long: a per-minute limit — a few minutes (longer each time in a row); a daily limit / no money — hours */
    rest(id, err) {
      const m = this.restMap(), now = Date.now(), msg = String(err && err.message || '');
      const prev = m[id] && now - m[id].at < 3 * 3600e3 ? m[id].n || 0 : 0;
      let min = Math.min(60, 3 * 2 ** prev); // 3, 6, 12, 24, 48, 60 minutes
      if (/day|daily|сутки|в день|per.?day|quota|на счёте нет|402|credit|billing/i.test(msg)) min = 6 * 60;
      m[id] = { until: now + min * 60e3, at: now, n: prev + 1 };
      try { localStorage.setItem('nk-ai-rest', JSON.stringify(m)); } catch (e) { /* full */ }
    },
    resting(id) { const r = this.restMap()[id]; return !!(r && Date.now() < r.until); },
    unrest(id) { const m = this.restMap(); if (m[id]) { delete m[id]; try { localStorage.setItem('nk-ai-rest', JSON.stringify(m)); } catch (e) { /* full */ } } },
    /** «limit» answers (not a wrong key or a broken request — those are not cured by waiting) */
    isLimit(err) { return /лимит|limit|429|quota|402|нет средств|rate|перегруж|overload|503|временно/i.test(String(err && err.message || '')); },
    /**
     * Ask the AI. If it fails (limit reached, quota, error, offline) and auto-switching is on,
     * the next connected AI answers instead. this.lastProvider = the AI that really answered
     * (its icon goes on the card).
     */
    async call(args) {
      // always the whole chain: when one network's limit runs out, the next connected one answers (no setting turns it off)
      const ids = args.provider ? [args.provider] : this.chain();
      if (!ids.length) throw new Error('Подключите нейросеть в Настройках (Claude по подписке, бесплатные Gemini / Groq / Cerebras или любую другую)');
      let lastErr;
      for (let k = 0; k < ids.length; k++) {
        try {
          const t = await this.callOnce(ids[k], args);
          this.lastProvider = ids[k];
          this.unrest(ids[k]);
          const chosen = this.current();
          if (ids[k] !== chosen && chosen && !args.quiet && Date.now() - (this._switchToast || 0) > 60000 && (this._switchToast = Date.now())) {
            UI.toast(`${PROVIDERS[chosen].short} ${this.resting(chosen) ? 'исчерпал лимит' : 'не ответил'} — переводит ${PROVIDERS[ids[k]].short}`, '', 4000);
          }
          if (window.TrNotice) try { TrNotice.badge(); } catch (e) { /* no player */ }
          return t;
        } catch (e) {
          lastErr = e;
          if (!args.provider && this.isLimit(e)) this.rest(ids[k], e); // it rests; the next calls start with another one
          console.warn('AI', ids[k], e.message);
        }
      }
      throw lastErr;
    },

    async callOnce(id, { system, user, maxTokens = 2048, temperature = 0.2 }) {
      if (!this.configured(id)) throw new Error(`${PROVIDERS[id].name}: не настроено — добавьте ключ в Настройках`);
      const p = PROVIDERS[id];
      const c = this.cfg(id);
      if (p.type === 'bridge') return this.callBridge({ system, user });
      if (p.type === 'anthropic') {
        const r = await this.post(p.base, {
          'content-type': 'application/json', 'x-api-key': c.key.trim(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
        }, { model: this.model(id), max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content: user }] });
        if (!r.ok) throw new Error(this.errText(id, r.status, r.data));
        return (r.data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      }
      // OpenAI-compatible
      const base = ((p.editableBase || id === 'ollama' ? c.base : '') || p.base).trim().replace(/\/$/, '');
      const url = p.fullUrl ? base : base + '/chat/completions';
      const headers = { 'content-type': 'application/json' };
      const key = ((c.key || '') || (id === 'pollinations' ? Store.settings.pollinationsToken || '' : '')).trim();
      if (key) headers.authorization = 'Bearer ' + key;
      if (id === 'openrouter') { headers['HTTP-Referer'] = location.origin.startsWith('http') ? location.origin : 'https://norsk-kort.local'; headers['X-Title'] = 'Norsk Kort'; }
      const body = { model: this.model(id), messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature, max_tokens: maxTokens };
      let r = await this.post(url, headers, body);
      if (!r.ok && r.status === 400 && /temperature|max_tokens|max_completion/i.test(JSON.stringify(r.data))) {
        // some reasoning models reject these parameters
        delete body.temperature; delete body.max_tokens;
        r = await this.post(url, headers, body);
      }
      if (!r.ok) throw new Error(this.errText(id, r.status, r.data));
      const ch = r.data.choices && r.data.choices[0];
      const txt = ch && ch.message ? (ch.message.content || '') : (typeof r.data === 'string' ? r.data : '');
      if (!txt) throw new Error(`${p.short}: пустой ответ`);
      return Array.isArray(txt) ? txt.map(x => x.text || '').join('') : String(txt).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    },

    parseJSON(text) {
      let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
      try { return JSON.parse(t); } catch (e) { /* continue */ }
      const first = Math.min(...['{', '['].map(ch => { const i = t.indexOf(ch); return i < 0 ? Infinity : i; }));
      const last = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
      if (first !== Infinity && last > first) {
        try { return JSON.parse(t.slice(first, last + 1)); } catch (e) { /* continue */ }
      }
      throw new Error(`${this.name(this.lastProvider)} вернул некорректный ответ — попробуйте ещё раз или другую модель`);
    },

    async test(provider) {
      const t = await this.call({ provider, system: 'Reply with one short sentence.', user: 'Say "Hei! Jeg er klar." exactly.', maxTokens: 60 });
      return t.trim().slice(0, 80);
    },

    cardPayload(c) {
      const o = { id: c.id };
      FIELDS.forEach(k => {
        const v = String(c[k] || '');
        o[k] = v.length > 350 ? v.slice(0, 350) + '…[truncated]' : v;
      });
      return o;
    },

    /** check many cards; onProgress(done,total). Returns [{id, ok, issues, changes:{field:{old,new}}}] */
    async checkCards(cards, onProgress) {
      const prov = this.current();
      const out = [];
      const chunk = 12;
      for (let i = 0; i < cards.length; i += chunk) {
        const part = cards.slice(i, i + chunk);
        const user = `Check and improve these flashcards (Norwegian ⇄ Russian). Return JSON: {"cards":[{"id":"<same id>","ok":true|false,"issues":["..."],${FIELDS.map(f => `"${f}":"..."`).join(',')}}]} — one object per input card, same ids, all fields filled.\n\nCards:\n${JSON.stringify(part.map(c => this.cardPayload(c)))}`;
        let parsed;
        try {
          parsed = this.parseJSON(await this.call({ system: systemPrompt(), user, maxTokens: 6000 }));
        } catch (e) {
          if (i === 0) throw e;
          UI.toast('Часть карт не проверена: ' + e.message, 'warn');
          continue;
        }
        const arr = Array.isArray(parsed) ? parsed : (parsed.cards || []);
        for (const r of arr) {
          const c = part.find(x => x.id === r.id);
          if (!c) continue;
          out.push(Object.assign(this.diff(c, r), { by: this.lastProvider || prov }));
        }
        onProgress && onProgress(Math.min(i + chunk, cards.length), cards.length);
      }
      return out;
    },
    diff(card, r) {
      const changes = {};
      FIELDS.forEach(f => {
        if (r[f] == null) return;
        const nv = String(r[f]).trim();
        if (nv === '__KEEP__' || nv.endsWith('[truncated]')) return;
        const ov = String(card[f] || '').trim();
        if (nv && nv !== ov) changes[f] = { old: ov, new: nv };
      });
      return { id: card.id, ok: r.ok !== false && !(r.issues && r.issues.length), issues: Array.isArray(r.issues) ? r.issues : [], changes };
    },

    /** fill a card from partial input (no and/or ru) */
    async fillCard(partial) {
      const user = `Create a complete flashcard from this partial input. If only Russian is given, find the best Norwegian equivalent. Return JSON object with keys ${FIELDS.join(', ')}.\nInput: ${JSON.stringify({ no: partial.no || '', ru: partial.ru || '', description: partial.description || '' })}`;
      return this.parseJSON(await this.call({ system: systemPrompt(), user, maxTokens: 1200 }));
    },

    /**
     * Explanation written straight into the card, in the learner's format:
     * Norwegian phrases / expressions / examples, each followed by the Russian translation in parentheses.
     */
    async explain(card) {
      const no = String(card.no || '').slice(0, 600), ru = String(card.ru || '').slice(0, 600);
      const desc = String(card.description || '').slice(0, 800);
      const user = `Напиши объяснение для карточки. Формат — обычный текст (без заголовков #, можно **жирный**), строго по разделам:
**Значение:** кратко по-русски, оттенки и когда употребляется.
**Формы:** грамматические формы на норвежском, у каждой перевод в скобках — например: hente – henter (забирает) – hentet (забрал) – har hentet (забрал).
**Примеры:** 4–6 естественных предложений, каждое на отдельной строке: норвежское предложение, затем перевод в скобках — «Jeg skal hente barna fra skolen i dag. (Я заберу детей из школы сегодня.)».
**Выражения:** 2–4 устойчивых выражения/словосочетания: «å hente seg inn (восстановиться)».
**Запомнить:** короткая мнемоника для русскоговорящего и частая ошибка.
Не повторяй то, что уже есть в объяснении карточки. Если перевод на карточке неточен — первой строкой напиши «⚠️ Точнее: …».
Карточка:
Норвежский: ${no}
Русский: ${ru}${desc ? '\nУже есть в объяснении: ' + desc : ''}`;
      const t = await this.call({ system: `${appContext()}\nYou are a friendly, precise Norwegian teacher for Russian speakers. Answer in Russian, following the house style strictly.`, user, maxTokens: 1600, temperature: 0.5 });
      return String(t).replace(/^#+\s*/gm, '').trim();
    },

    /** all grammatical forms of the word, each with its own Russian translation */
    async forms(card) {
      const user = `Give ALL main grammatical forms of this Norwegian Bokmål word, each with an accurate Russian translation of THAT form.
Return ONLY JSON: {"wordClass":"verb|substantiv|adjektiv|...","gender":"","forms":[{"label":"...","no":"...","ru":"..."}]}
- label: short Russian name + Norwegian term, e.g. "Инфинитив (infinitiv)".
- verb: Инфинитив (å + verb), Настоящее (presens), Прошедшее (preteritum), Перфект (har + perfektum partisipp), Плюсквамперфект (hadde + partisipp), Будущее (skal + infinitiv), Будущее (kommer til å + infinitiv), Повелительное (imperativ), Причастие прошедшего (perfektum partisipp). ru: translate each form naturally, e.g. drakk -> "пил / выпил", har drukket -> "выпил, пил (уже)", skal drikke -> "буду пить", drikk! -> "пей!". Mark irregular (sterkt) verbs in label of Прошедшее with "· неправильный".
- noun: gender in "gender" (en/ei/et), forms: Неопр. ед. (ubestemt entall), Опр. ед. (bestemt entall), Неопр. мн. (ubestemt flertall), Опр. мн. (bestemt flertall); for feminine also the "en"-variant. ru: "машина", "(эта) машина", "машины", "(эти) машины".
- adjective: м/ж род (hankjønn/hunkjønn), ср. род (intetkjønn), мн./опр. (flertall/bestemt), Сравнительная (komparativ), Превосходная (superlativ) — with translations.
- adverb/preposition/phrase: forms = [] (empty) unless it has real variants.
Card: Norwegian: ${String(card.no).split('\n')[0].slice(0, 120)} · Russian: ${String(card.ru).split('\n')[0].slice(0, 120)}`;
      const r = this.parseJSON(await this.call({ system: systemPrompt(), user, maxTokens: 1500, temperature: 0.1 }));
      const forms = (Array.isArray(r.forms) ? r.forms : []).filter(f => f && f.no).map(f => ({ label: String(f.label || '').slice(0, 60), no: String(f.no).slice(0, 120), ru: String(f.ru || '').slice(0, 160) }));
      return { forms, wordClass: r.wordClass || '', gender: r.gender || '' };
    },

    /** example sentences for every form / tense, with translation and usage */
    async examples(card) {
      const formsHint = (card.forms || []).map(f => f.no).join(', ');
      const user = `Write natural example sentences (level A2–B1, everyday Norway life) showing how this word is used in EACH of its forms/tenses.
Return ONLY JSON: {"examples":[{"label":"...","no":"...","ru":"...","note":"..."}]}
- verb: one sentence for each: Настоящее (presens), Прошедшее (preteritum), Перфект (perfektum), Будущее (skal …), Будущее (kommer til å …), Повелительное (imperativ), and one with a modal verb (kan/må/vil + infinitiv).
- noun: sentences using indefinite/definite singular and plural.
- adjective: sentences with the different forms + comparison.
- other words: 4–5 sentences in typical situations.
- label: short Russian label with Norwegian term, e.g. "Прошедшее (preteritum)". ru: natural Russian translation. note: very short Russian hint WHEN this form is used (max 70 chars), e.g. "законченное действие в прошлом с указанием времени".
Card: Norwegian: ${String(card.no).split('\n')[0].slice(0, 120)} · Russian: ${String(card.ru).split('\n')[0].slice(0, 120)}${formsHint ? ' · forms: ' + formsHint : ''}`;
      const r = this.parseJSON(await this.call({ system: systemPrompt(), user, maxTokens: 2200, temperature: 0.5 }));
      return (Array.isArray(r.examples) ? r.examples : []).filter(e => e && e.no).map(e => ({
        label: String(e.label || '').slice(0, 60), no: String(e.no).slice(0, 300), ru: String(e.ru || '').slice(0, 300), note: String(e.note || '').slice(0, 120),
      }));
    },

    /** synonyms with translation and the difference in meaning / usage */
    async synonyms(card) {
      const user = `Give 3–6 Norwegian Bokmål SYNONYMS (or very close words) for this word, the most useful for a learner first.
Return ONLY JSON: {"synonyms":[{"no":"...","ru":"...","note":"...","register":"..."}]}
- no: the synonym in dictionary form (nouns with en/ei/et, verbs with å).
- ru: accurate Russian translation.
- note: SHORT Russian explanation (max 110 chars) of how it differs from the card word and when to use it; you may add one tiny example in house style: "Jeg skjønner. (Я понимаю.)".
- register: one of "нейтральное", "разговорное", "книжное", "официальное", "устаревшее".
If the word has no real synonyms, return the closest related words and say so in note.
Card: Norwegian: ${String(card.no).split('\n')[0].slice(0, 120)} · Russian: ${String(card.ru).split('\n')[0].slice(0, 120)}`;
      const r = this.parseJSON(await this.call({ system: systemPrompt(), user, maxTokens: 1400, temperature: 0.3 }));
      return (Array.isArray(r.synonyms) ? r.synonyms : []).filter(s => s && s.no).map(s => ({
        no: String(s.no).slice(0, 80), ru: String(s.ru || '').slice(0, 120), note: [s.register ? String(s.register) : '', String(s.note || '')].filter(Boolean).join(' · ').slice(0, 200),
      }));
    },

    async generateDeck(topic, count, level, withExplain = true, exclude = []) {
      const user = `Generate ${count} useful, distinct Norwegian Bokmål vocabulary flashcards on the topic: "${topic}" (level ${level}).${exclude.length ? ' Do NOT repeat these already created words: ' + exclude.slice(-120).join(', ') + '.' : ''} Choose the words a Russian-speaking learner living in Norway needs most for this topic; mix nouns, verbs, adjectives and common everyday phrases. ${withExplain ? 'The "description" must follow the house style: grammar forms and 1–2 useful phrases, every Norwegian phrase followed by its Russian translation in parentheses.' : 'Keep "description" very short.'} Return JSON {"cards":[{${FIELDS.map(f => `"${f}":"..."`).join(',')}}]}.`;
      const parsed = this.parseJSON(await this.call({ system: systemPrompt(), user, maxTokens: Math.min(16000, 500 + count * (withExplain ? 380 : 260)), temperature: 0.6 }));
      return (Array.isArray(parsed) ? parsed : parsed.cards || []).filter(c => c && c.no && c.ru);
    },

    /** short English term for images (fallback when no image prompt) */
    async englishTerm(card) {
      const t = await this.call({ system: 'Translate to English. Reply with 1-3 words only.', user: `${card.no} (${card.ru})`, maxTokens: 20 });
      return t.trim().replace(/["'.]/g, '');
    },
  };

  window.AI = AI;
})();
