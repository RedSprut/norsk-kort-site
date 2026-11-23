/* ============ 🃏 Phrase library: fixed expressions (faste uttrykk) from open sources -> flashcards ============
 * "Learn expressions, not single words." Every free source we know of, in one window:
 *  - auto:  cards are created right here (Språkbanken frequency list, Ordbøkene, Wiktionary, Constructicon, 50languages)
 *  - paste: open the page, copy the list, paste it here -> cards
 *  - anki:  ready-made decks on AnkiWeb -> download .apkg -> import
 *  - link:  advice, textbooks, discussions
 * Meaning first: idioms are translated from their dictionary DEFINITION (or by the connected AI), never word for word.
 */
(function () {
  const fav = (domain, size = 22) => `<img class="ai-ico" src="https://www.google.com/s2/favicons?domain=${domain}&sz=64" width="${size}" height="${size}" alt="" onerror="this.replaceWith(document.createTextNode('🌐'))">`;
  const HF_FREQ = 'https://huggingface.co/datasets/Sprakbanken/Norwegian_idioms/resolve/main/idiom_freqs/idiom_frequencies.csv';
  const CXN_YAML = 'https://raw.githubusercontent.com/constructicon/norwegian-data/generated/data-combined.yml';
  const WIKT = 'https://en.wiktionary.org';
  const BOOK2 = 'https://www.goethe-verlag.com/book2';
  const ANKI = q => 'https://ankiweb.net/shared/decks?search=' + encodeURIComponent(q);

  const CARDS_SVG = (s = 18) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">
    <rect x="7.5" y="3" width="11" height="15" rx="2.2" transform="rotate(12 13 10.5)" opacity=".55"/><rect x="4" y="5" width="11" height="15" rx="2.2" fill="currentColor" fill-opacity=".12"/>
    <path d="M7.5 10.5h4M7.5 13.5h3"/></svg>`;

  const SOURCES = [
    // ---------- cards are created automatically ----------
    { id: 'freq', kind: 'auto', name: 'Самые частые выражения норвежцев', org: 'Språkbanken · Национальная библиотека Норвегии', domain: 'nb.no',
      url: 'https://huggingface.co/datasets/Sprakbanken/Norwegian_idioms', count: '3 472', langs: '🇳🇴', lic: 'CC0 — свободно',
      desc: 'Идиомы и устойчивые выражения, отсортированные по тому, как часто они встречаются в реальных текстах (först og fremst, av og til, rett og slett…). Лучший ответ на вопрос «что учить первым». Значение берётся из Ordbøkene, перевод — по смыслу.' },
    { id: 'ordbok', kind: 'auto', name: 'Ordbøkene — faste uttrykk', org: 'Бергенский университет и Språkrådet', domain: 'ordbokene.no',
      url: 'https://ordbokene.no', count: '≈ 9 000', langs: '🇳🇴', lic: 'CC BY 4.0',
      desc: 'Все устойчивые выражения официального словаря с толкованием и примерами. Можно взять все выражения с нужным словом (например «hjerte», «ta») или случайную подборку.' },
    { id: 'wikt', kind: 'auto', name: 'Wiktionary — идиомы, фразы, пословицы', org: 'en.wiktionary.org', domain: 'wiktionary.org',
      url: 'https://en.wiktionary.org/wiki/Category:Norwegian_Bokmål_idioms', count: '≈ 220', langs: '🇳🇴 🇬🇧', lic: 'CC BY-SA',
      desc: 'Идиомы (bite i gresset), разговорные фразы (det er gresk for meg) и пословицы (brent barn skyr ilden) с английским значением.' },
    { id: 'cxn', kind: 'auto', name: 'Норвежский конструктикон', org: 'UiT — Арктический университет Норвегии', domain: 'uit.no',
      url: 'https://github.com/constructicon/norwegian-data', count: '≈ 2 000', langs: '🇳🇴 🇬🇧', lic: 'CC BY 4.0',
      desc: 'Речевые шаблоны («gå på X», «X er på fornavn med Y») с примерами из живых текстов; у части есть уровень A1–C1 и объяснение.' },
    { id: 'book2', kind: 'auto', name: '50languages (book2) — 100 уроков бытовых фраз', org: 'Goethe Verlag', domain: 'goethe-verlag.com',
      url: `${BOOK2}/RU/RUNO/RUNO002.HTM`, count: '≈ 1 800', langs: '🇳🇴 🇷🇺 🇺🇦', lic: 'бесплатно для учёбы',
      desc: 'Готовые разговорные фразы с ПЕРЕВОДОМ ОТ ЛЮДЕЙ на русский и украинский: знакомство, магазин, врач, работа… Сайт не пускает браузер напрямую — работает через мост на Mac; без моста — откройте урок и вставьте текст.', needsBridge: true },
    // ---------- open the page, copy, paste ----------
    { id: 'vk', kind: 'paste', name: 'VK «Норвежский язык для тебя» — 35 идиом', domain: 'vk.com',
      url: 'https://vk.ru/@norskfordeg-35-norvezhskih-idiom-o-znachenii-kotoryh-vam-budet-trudno-do', count: '35', langs: '🇳🇴 🇷🇺', lic: 'бесплатно',
      desc: 'Идиома, дословный перевод, смысл по-русски и часто русский аналог.' },
    { id: 'speakasap', kind: 'paste', name: 'SpeakASAP — идиомы', domain: 'speakasap.com',
      url: 'https://speakasap.com/no/grammar/idiomy/', count: '48', langs: '🇷🇺 🇳🇴', lic: 'бесплатная страница',
      desc: 'Русские идиомы и их норвежские соответствия (есть PDF).' },
    { id: 'lingu', kind: 'paste', name: 'Lingu — «99 idioms» (PDF)', domain: 'lingu.no',
      url: 'https://lingu.no/en/99-idioms-ebook', count: '99', langs: '🇳🇴 🇬🇧', lic: 'бесплатный PDF',
      desc: '99 частых идиом и пословиц с объяснением по-английски. Скачайте PDF, скопируйте список и вставьте.' },
    { id: 'learnnow', kind: 'paste', name: 'NTNU LearnNoW-UA — курс для украинцев', domain: 'ntnu.edu',
      url: 'https://www.ntnu.edu/learnnow-ua', count: '12 глав', langs: '🇳🇴 🇺🇦', lic: 'бесплатно',
      desc: 'Таблицы слов и фраз с украинским переводом (alt i orden — все по порядку).' },
    { id: 'now', kind: 'paste', name: 'NTNU Norwegian on the Web', domain: 'ntnu.edu',
      url: 'https://www.ntnu.edu/now', count: '10 глав', langs: '🇳🇴 🇬🇧', lic: 'бесплатно',
      desc: 'Университетский курс; словари глав с английским переводом и фразами (av og til, alt mulig).' },
    { id: 'reddit70', kind: 'paste', name: 'Reddit r/norsk — «70+ Norwegian Idioms and Sayings»', domain: 'reddit.com',
      url: 'https://www.reddit.com/r/norsk/comments/11hcfaz/', count: '70+', langs: '🇳🇴 🇬🇧', lic: 'обсуждение',
      desc: 'Список, который носители языка поправили в комментариях.' },
    { id: 'reddit-teach', kind: 'paste', name: 'Reddit r/norsk — «Teach me an idiom»', domain: 'reddit.com',
      url: 'https://www.reddit.com/r/norsk/comments/pwocri/', count: '74 ответа', langs: '🇳🇴 🇬🇧', lic: 'обсуждение',
      desc: 'Норвежцы делятся любимыми идиомами и объясняют их.' },
    { id: 'lexin', kind: 'paste', name: 'LEXIN — норвежско-русский / украинский', domain: 'lexin.oslomet.no',
      url: 'https://lexin.oslomet.no', count: '≈ 11 000 статей', langs: '🇳🇴 🇷🇺 🇺🇦', lic: 'только просмотр',
      desc: 'Официальный словарь для иммигрантов: в статьях есть фразы и идиомы с русским переводом. Ищите слово, копируйте нужные выражения.' },
    { id: 'naob', kind: 'paste', name: 'NAOB — академический словарь', domain: 'naob.no',
      url: 'https://naob.no', count: '≈ 200 000 статей', langs: '🇳🇴', lic: 'только просмотр',
      desc: 'Устойчивые выражения, поговорки и их происхождение.' },
    // ---------- ready-made Anki decks (download .apkg -> import) ----------
    { id: 'anki-av', kind: 'anki', name: 'Norwegian Idiomatic Prepositional Phrases using «Av»', domain: 'ankiweb.net', url: ANKI('Norwegian Idiomatic Prepositional Phrases'), count: '40', langs: '🇳🇴 🇬🇧', desc: 'Единственная готовая колода именно с выражениями (предлог «av»).' },
    { id: 'anki-noru', kind: 'anki', name: 'Norsk – Русский', domain: 'ankiweb.net', url: ANKI('Norsk - Русский'), count: '5 503', langs: '🇳🇴 🇷🇺', desc: 'Большая словарная колода, в основном слова.' },
    { id: 'anki-runo', kind: 'anki', name: 'Russisk – Norsk', domain: 'ankiweb.net', url: ANKI('Russisk - Norsk'), count: '2 213', langs: '🇷🇺 🇳🇴', desc: 'Словарная колода с русской стороны.' },
    { id: 'anki-bumal', kind: 'anki', name: 'норвежский-русский norge bumal', domain: 'ankiweb.net', url: ANKI('норвежский-русский'), count: '1 647', langs: '🇳🇴 🇷🇺', desc: 'Слова и фразы.' },
    { id: 'anki-elem', kind: 'anki', name: 'Norwegian – russian Elementary 1', domain: 'ankiweb.net', url: ANKI('Norwegian - russian Elementary'), count: '117', langs: '🇳🇴 🇷🇺', desc: 'Начальный уровень.' },
    { id: 'anki-ua', kind: 'anki', name: 'Norwegian (Українська) Sentences with Audio', domain: 'ankiweb.net', url: ANKI('Norwegian Українська'), count: '2 312', langs: '🇳🇴 🇺🇦', desc: 'Предложения с озвучкой и украинским переводом.' },
    // ---------- advice & where else ----------
    { id: 'karense', kind: 'link', name: 'Norsklærer Karense — серия «faste uttrykk»', domain: 'youtube.com', url: 'https://www.youtube.com/@NorsklrerKarense/search?query=faste%20uttrykk', count: '≈ 70 видео', langs: '🇳🇴', desc: 'Самый популярный норвежский учитель на YouTube; десятки уроков именно про устойчивые выражения.' },
    { id: 'norskfordeg-yt', kind: 'link', name: 'Norsk For Deg! — выражения', domain: 'youtube.com', url: 'https://www.youtube.com/@norskfordeg/search?query=uttrykk', count: '≈ 20 видео', langs: '🇳🇴', desc: 'Уроки A1–C1, слова и выражения дня.' },
    { id: 'textbooks', kind: 'link', name: 'Учебники På vei → Stein på stein → Her på berget', domain: 'cappelendamm.no', url: 'https://www.google.com/search?q=' + encodeURIComponent('På vei Stein på stein Her på berget Cappelen Damm'), count: 'A1 → B2', langs: '🇳🇴', desc: 'Стандартные учебники курсов норвежского (платные). На Reddit их советуют учить вместе с карточками; к ним есть словарики с русским и украинским.' },
    { id: 'klartale', kind: 'link', name: 'Klar Tale — новости простым языком', domain: 'klartale.no', url: 'https://www.klartale.no', count: 'каждый день', langs: '🇳🇴', desc: 'Живые выражения в лёгких текстах — удобно выписывать в карточки.' },
    { id: 'reddit-ok', kind: 'link', name: 'Reddit: как дошли до B2/C1 с карточками', domain: 'reddit.com', url: 'https://www.reddit.com/r/norsk/comments/t0fczv/', count: 'опыт', langs: '🇬🇧', desc: 'Истории учеников и их колоды; ещё: r/norsk/comments/t0ipvl, 91ksp6, yk6dh9 (Quizlet).' },
  ];
  const GROUPS = [
    ['auto', '⚡ Создать карточки автоматически', 'Выражения, значение и перевод подтянутся сами'],
    ['paste', '📋 Открыть страницу → скопировать → вставить сюда', 'Карточки сделаются из вставленного текста'],
    ['anki', '🗂 Готовые колоды Anki', 'Скачайте .apkg на AnkiWeb и импортируйте — приложение читает Anki'],
    ['link', '💡 Где ещё учить выражения', 'Видео, учебники, советы'],
  ];

  /* ---------------- helpers ---------------- */
  /** CSV with quotes, commas and line breaks inside fields */
  function parseCSV(text) {
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; continue; }
      if (ch === '"') q = true;
      else if (ch === ',') { row.push(f); f = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
      else f += ch;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim()));
  }
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  async function pool(items, fn, n = 4, stop) {
    let k = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (k < items.length && !(stop && stop())) { const i = k++; await fn(items[i], i); } }));
  }
  const strip = h => U.stripHtml(String(h || '')).replace(/\s+/g, ' ').trim();
  /** pages that block browsers: through the Mac bridge (GET) */
  async function viaBridge(url) {
    const r = await fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, method: 'GET' }) });
    if (!r.ok) throw new Error('Мост: ' + r.status);
    return r.text();
  }
  const have = () => new Set(Store.cards().map(c => U.norm(c.no)));

  /* ---------------- loaders: -> [{ no, def?, en?, ru?, uk?, examples?, note?, level? }] ---------------- */
  const Load = {
    _freq: null,
    async freq(o, log) {
      if (!this._freq) {
        log('Загружаю список Национальной библиотеки…');
        const rows = parseCSV(await (await fetch(HF_FREQ)).text());
        this._freq = rows.slice(1).filter(r => r[1] === 'nob').map(r => ({ no: r[0].trim(), f: parseFloat(r[2]) || 0 })).sort((a, b) => b.f - a.f);
      }
      const known = o.skipKnown ? have() : new Set();
      const start = Math.max(0, (o.from || 1) - 1);
      return this._freq.slice(start).filter(x => !known.has(U.norm(x.no))).slice(0, o.count)
        .map(x => ({ no: x.no, note: `частотность: №${this._freq.indexOf(x) + 1} из ${this._freq.length}`, needDef: true }));
    },
    async ordbok(o, log) {
      const known = o.skipKnown ? have() : new Set();
      if (o.word) {
        log(`Ordbøkene: выражения со словом «${o.word}»…`);
        const a = await Ordbok.lookup({ no: o.word });
        const list = a.expressions.filter(x => x.lemma && !known.has(U.norm(Ordbok.exprLabel(x.lemma))));
        if (!list.length) throw new Error(`В статье «${a.lemma}» нет новых устойчивых выражений`);
        return list.slice(0, o.count).map(x => ({
          no: Ordbok.exprLabel(x.lemma), def: (x.definitions[0] || {}).text || '',
          examples: (x.definitions[0] || { examples: [] }).examples.slice(0, 2).map(e => ({ no: e })), fromOrdbok: true,
        }));
      }
      log('Ordbøkene: загружаю список всех выражений (≈5 МБ, один раз)…');
      const idx = await Ordbok.exprIndex();
      const pick = shuffle(idx.list.slice()).filter(x => !known.has(U.norm(Ordbok.exprLabel(x.lemma)))).slice(0, o.count * 2);
      const out = [];
      await pool(pick, async x => {
        if (out.length >= o.count) return;
        try {
          const a = await Ordbok.article(x.id);
          const d = a.definitions[0];
          if (!d || !d.text || out.length >= o.count) return;
          out.push({ no: Ordbok.exprLabel(a.lemma || x.lemma), def: d.text, examples: d.examples.slice(0, 2).map(e => ({ no: e })), fromOrdbok: true });
          log(`Ordbøkene: ${out.length} из ${o.all ? 'всех ≈' + pick.length : o.count}`);
        } catch (e) { /* skip */ }
      }, 4, () => out.length >= o.count || !!(o.stop && o.stop()));
      return out.slice(0, o.count);
    },
    async wikt(o, log) {
      const cats = o.cats && o.cats.length ? o.cats : ['idioms', 'phrases', 'proverbs'];
      const known = o.skipKnown ? have() : new Set();
      let titles = [];
      for (const c of cats) {
        log(`Wiktionary: ${c}…`);
        const j = await (await fetch(`${WIKT}/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent('Category:Norwegian Bokmål ' + c)}&cmlimit=500&cmnamespace=0&format=json&origin=*`)).json();
        titles = titles.concat(((j.query || {}).categorymembers || []).map(m => m.title));
      }
      titles = shuffle([...new Set(titles)].filter(t => /\s/.test(t) && /^[\p{Ll}\p{Lu}]/u.test(t) && !known.has(U.norm(t))));
      const out = [];
      await pool(titles, async t => {
        if (out.length >= o.count) return;
        try {
          const j = await (await fetch(`${WIKT}/api/rest_v1/page/definition/${encodeURIComponent(t.replace(/ /g, '_'))}`)).json();
          const e = (j.other || []).concat(j.nb || [], j.no || []).find(x => /Bokmål|Norwegian/.test(x.language || ''));
          const d = e && (e.definitions || []).find(x => strip(x.definition));
          if (!d || out.length >= o.count) return;
          const ex = (d.parsedExamples || []).slice(0, 1).map(p => ({ no: strip(p.example), en: strip(p.translation) }));
          out.push({ no: t, en: strip(d.definition), examples: ex });
          log(`Wiktionary: ${out.length} из ${o.all ? titles.length : Math.min(o.count, titles.length)}`);
        } catch (e) { /* skip */ }
      }, 4, () => out.length >= o.count || !!(o.stop && o.stop()));
      return out.slice(0, o.count);
    },
    _cxn: null,
    async cxn(o, log) {
      if (!this._cxn) {
        log('Конструктикон: загружаю базу (≈1 МБ)…');
        const yaml = await U.lib.yaml();
        const data = yaml.load(await (await fetch(CXN_YAML)).text());
        const recs = Array.isArray(data) ? data : Object.values(data || {});
        this._cxn = recs.filter(r => r && (r.illustration || (r.examples || []).length)).map(r => {
          const defs = [].concat(r.definitions || []);
          const def = k => strip((defs.find(d => d && d[k]) || {})[k]);
          // "… barn (Språkrådet)", "(NoWaC)", "(Karusellen, Alex Brinchmann, 1940)" — corpus source tags, not part of the sentence
          const src = s => strip(s).replace(/\s*\([^()]*\)\s*$/, '').trim();
          return { name: strip(r.name), level: strip(r.cefr_level), ill: src(r.illustration || r.examples[0]), defNo: def('norwegian'), defEn: def('english'), examples: (r.examples || []).slice(0, 2).map(src) };
        });
      }
      const known = o.skipKnown ? have() : new Set();
      let list = this._cxn.filter(r => r.ill && !known.has(U.norm(r.ill)));
      if (o.level && o.level !== 'all') list = list.filter(r => r.level === o.level);
      if (o.level === 'all') list = list.sort((a, b) => (b.level ? 1 : 0) - (a.level ? 1 : 0) || (b.defNo ? 1 : 0) - (a.defNo ? 1 : 0));
      return shuffle(list.slice(0, Math.max(o.count * 3, 60))).slice(0, o.count).map(r => ({
        no: r.ill, def: r.defNo, en: r.defEn, enGiven: !!r.defEn, ruFromNo: true, level: r.level, note: `шаблон: ${r.name}${r.level ? ' · ' + r.level : ''}`,
        examples: r.examples.filter(x => x && x !== r.ill).slice(0, 1).map(x => ({ no: x })),
      }));
    },
    async book2(o, log) {
      const known = o.skipKnown ? have() : new Set();
      const page = (L, n) => `${BOOK2}/${L}/${L}NO/${L}NO${String(n + 2).padStart(3, '0')}.HTM`;
      const parse = (html, lang) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const title = ((doc.querySelector('h1.text-dark') || {}).textContent || '').split(/\s[–-]\s/)[0].trim();
        const pairs = [...doc.querySelectorAll(`div.Stil35[lang="${lang}"]`)].map(el => {
          const tr = el.closest('tr');
          const no = tr && tr.querySelector('div[id^="hn_"] a[lang="no"]');
          return { src: el.textContent.trim(), no: no ? no.textContent.trim() : '' };
        }).filter(p => p.src && p.no);
        return { title, pairs };
      };
      const out = [];
      for (let n = o.from; n <= o.to && out.length < o.count && !(o.stop && o.stop()); n++) {
        log(`50languages: урок ${n}…`);
        const ru = parse(await viaBridge(page('RU', n)), 'ru');
        const uk = o.uk ? parse(await viaBridge(page('UK', n)), 'uk') : null;
        ru.pairs.forEach((p, i) => {
          if (out.length >= o.count || known.has(U.norm(p.no))) return;
          const u = uk && uk.pairs[i] && uk.pairs[i].no === p.no ? uk.pairs[i].src : '';
          out.push({ no: p.no, ru: p.src, uk: u, note: `урок ${n}: ${ru.title}`, humanRu: true });
        });
      }
      return out;
    },
    /** pasted text: "norsk – русский", "norsk: русский", "русский — norsk", "norsk (русский)", two-line pairs, or just Norwegian */
    paste(text) {
      const lines = String(text).split(/\r?\n/).map(l => l.replace(/^\s*(?:\d+[.)]|[•·*\-–—])\s*/, '').trim()).filter(l => l && l.length < 300);
      const cyr = s => U.cyrRatio(s) > 0.35;
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const m = l.match(/^(.+?)\s+[–—-]\s+(.+)$/) || l.match(/^(.+?)\s*[:=\t]\s*(.+)$/) || l.match(/^([^()]+?)\s*\(([^)]+)\)\s*$/);
        if (m) {
          const [a, b] = [m[1].trim(), m[2].trim()];
          if (cyr(a) && !cyr(b)) out.push({ no: b, ru: a });
          else if (!cyr(a) && cyr(b)) out.push({ no: a, ru: b });
          else if (!cyr(a) && !cyr(b)) out.push({ no: a, en: b });
          continue;
        }
        if (cyr(l)) { if (out.length && !out[out.length - 1].ru) out[out.length - 1].ru = l; continue; }
        if (lines[i + 1] && cyr(lines[i + 1]) && !/\s[–—-]\s|:/.test(lines[i + 1])) { out.push({ no: l, ru: lines[i + 1] }); i++; continue; }
        if (/\p{L}/u.test(l) && l.split(/\s+/).length <= 12) out.push({ no: l });
      }
      const seen = new Set();
      return out.filter(x => x.no && !seen.has(U.norm(x.no)) && seen.add(U.norm(x.no)));
    },
  };

  /* ---------------- meaning + translations ---------------- */
  async function complete(items, o, log, stop) {
    // 1) Ordbøkene meaning (+ example) for expressions that came without one
    const needDef = items.filter(x => x.needDef && !x.def);
    if (needDef.length) {
      let n = 0;
      try { await Ordbok.exprIndex(); } catch (e) { /* dictionary offline — meanings by AI/translator only */ }
      await pool(needDef, async x => {
        try {
          const a = await Ordbok.expression(x.no);
          if (a) {
            const d = a.definitions[0];
            x.def = d.text; x.fromOrdbok = true;
            if (!x.examples || !x.examples.length) x.examples = d.examples.slice(0, 2).map(e => ({ no: e }));
          }
        } catch (e) { /* skip */ }
        log(`Ordbøkene: значения ${++n}/${needDef.length}`);
      }, 4, stop);
    }
    const by = new Set();
    // 2) the AI: meaning-based translation of everything at once (batches of 12)
    if (AI.available() && o.useAI !== false) {
      for (let k = 0; k < items.length && !(stop && stop()); k += 12) {
        const part = items.slice(k, k + 12);
        log(`${AI.name()}: перевожу по смыслу ${Math.min(k + 12, items.length)}/${items.length}…`);
        const user = `Norwegian Bokmål fixed expressions for a Russian-speaking learner. For each item return an object with:
- "ru": the MEANING in natural Russian (a Russian idiom with the same meaning if one exists, otherwise a short explanation). Use "def" (Norwegian dictionary definition) and "en" to get the meaning right. NEVER translate word for word. If "ru" is already given, keep it unless it is wrong.
${o.en ? '- "en": the meaning in English.\n' : ''}${o.uk ? '- "uk": the meaning in Ukrainian.\n' : ''}- "lit": literal word-for-word Russian translation, only if it differs a lot from the meaning (else "").
- "ex_no": ${o.examples ? 'a short natural everyday example sentence using the expression (keep the given one if present)' : '""'}, "ex_ru": its Russian translation.
Return ONLY a JSON array (same order, same length).
${JSON.stringify(part.map(x => ({ no: x.no, def: x.def || '', en: x.en || '', ru: x.ru || '', ex: (x.examples || [])[0] ? x.examples[0].no : '' })))}`;
        try {
          const arr = AI.parseJSON(await AI.call({ system: 'You are an expert Norwegian–Russian lexicographer and teacher.', user, maxTokens: 400 + part.length * 220, temperature: 0.2 }));
          const list = Array.isArray(arr) ? arr : (arr.items || []);
          part.forEach((x, i) => {
            const r = list[i] || {};
            if (r.ru && !x.humanRu) x.ru = String(r.ru).trim();
            if (o.en && r.en && !x.enGiven) x.en = x.en || String(r.en).trim();
            if (o.uk && r.uk && !x.uk) x.uk = String(r.uk).trim();
            if (r.lit) x.lit = String(r.lit).trim();
            if (o.examples && r.ex_no) {
              const ex = (x.examples || [])[0];
              if (ex && U.norm(ex.no) === U.norm(r.ex_no)) ex.ru = r.ex_ru || ex.ru;
              else if (!ex) x.examples = [{ no: String(r.ex_no).trim(), ru: String(r.ex_ru || '').trim() }];
            }
            x.aiBy = AI.lastProvider;
          });
          by.add('ai'); Translators.lastAI = AI.lastProvider;
        } catch (e) { log(`${AI.name()}: ${U.niceErr(e, '', true)} — перевожу переводчиком`); }
      }
    }
    // 3) machine translators for whatever is still missing (meaning = translated definition)
    const miss = (field, src) => items.filter(x => !x[field] && src(x));
    const run = async (list, getText, from, to, set) => {
      if (!list.length) return;
      log(`Переводчик: ${list.length} строк…`);
      const res = await Translators.translateMany(list.map(getText), from, to);
      res.by.forEach(b => by.add(b));
      list.forEach((x, i) => { if (res.out[i]) set(x, Ordbok.tidy(getText(x), res.out[i])); });
    };
    // sentences (constructicon) and long definitions: translate the Norwegian text itself; idioms: their short definition
    const srcText = x => (x.ruFromNo || !x.def || x.def.length > 160) ? x.no : x.def;
    await run(miss('ru', srcText), srcText, 'no', 'ru', (x, t) => { x.ru = t; });
    if (o.en) await run(miss('en', srcText), srcText, 'no', 'en', (x, t) => { x.en = t; });
    if (o.uk) await run(miss('uk', srcText), srcText, 'no', 'uk', (x, t) => { x.uk = t; });
    const exs = items.flatMap(x => (x.examples || []).filter(e => e.no && !e.ru));
    if (exs.length) {
      const res = await Translators.translateMany(exs.map(e => e.no), 'no', 'ru');
      res.by.forEach(b => by.add(b));
      exs.forEach((e, i) => { e.ru = res.out[i] || ''; });
    }
    return [...by];
  }

  /** item -> card data (Norwegian front, Russian back; meaning, English / Ukrainian and source in the description) */
  function toCard(x, src, by) {
    const desc = [];
    if (x.def) desc.push(x.fromOrdbok ? `📖 Ordbøkene · значение: ${x.def}` : `💡 Объяснение: ${x.def}`);
    if (x.lit) desc.push(`Дословно: ${x.lit}`);
    if (x.en) desc.push(`🇬🇧 ${x.en}`);
    if (x.uk) desc.push(`🇺🇦 ${x.uk}`);
    if (x.note) desc.push(`ℹ️ ${x.note}`);
    desc.push(`Источник: ${src.name}${src.lic ? ' · ' + src.lic : ''}`);
    const ex = (x.examples || [])[0];
    const machine = by.filter(b => b !== 'ai');
    const usedBy = x.humanRu ? [] : (x.aiBy ? ['ai'] : machine);
    const hist = [Prov.entry('import', 'create', null, `библиотека выражений: ${src.name}`)];
    if (x.fromOrdbok) hist.push(Prov.entry('tr:ordbok', 'explain', null, 'значение выражения из Ordbøkene'));
    Translators.provKeys(usedBy).forEach(k => hist.push(Prov.entry(k, 'translate', null, 'перевёл выражение по смыслу')));
    return {
      no: x.no, ru: x.ru || '', en: x.en || '', wordClass: 'uttrykk',
      description: desc.join('\n'), example: ex ? ex.no : '', exampleRu: ex ? (ex.ru || '') : '',
      tags: ['uttrykk', 'lib-' + src.id].concat(x.level ? [x.level] : []),
      history: hist, mtWarn: x.humanRu ? null : Translators.mtFlag(usedBy),
    };
  }

  /* ---------------- UI ---------------- */
  const tile = s => `<div class="lib-tile" data-src="${s.id}">
      <div class="lib-tile-head">${fav(s.domain, 26)}<div class="grow"><b>${U.esc(s.name)}</b>${s.org ? `<small>${U.esc(s.org)}</small>` : ''}</div></div>
      <div class="lib-chips"><span class="chip">${U.esc(s.count)}</span><span class="chip">${s.langs}</span>${s.lic ? `<span class="chip learned">${U.esc(s.lic)}</span>` : ''}${s.needsBridge ? `<span class="chip ${AI.bridge.up ? 'learned' : 'due'}">${AI.bridge.up ? '✓ мост работает' : 'нужен мост на Mac'}</span>` : ''}</div>
      <p class="small muted">${U.esc(s.desc)}</p>
      <div class="row" style="gap:6px">
        ${s.kind === 'auto' ? `<button class="btn sm primary" data-lib="make" data-id="${s.id}">➕ Создать карточки</button>` : ''}
        ${s.kind === 'paste' ? `<button class="btn sm primary" data-lib="paste" data-id="${s.id}">📋 Вставить текст</button>` : ''}
        ${s.kind === 'anki' ? '<button class="btn sm primary" data-lib="apkg">📥 Импортировать .apkg</button>' : ''}
        <a class="btn sm" href="${U.esc(s.url)}" target="_blank" rel="noopener">↗ ${s.kind === 'anki' ? 'Найти на AnkiWeb' : 'Открыть'}</a>
      </div></div>`;

  const Library = {
    SOURCES, CARDS_SVG, Load, complete, toCard, parseCSV,
    /** the hover card on the 🃏 button: what it is + sources */
    hoverHtml() {
      return `<div class="lib-hover" role="tooltip">
        <b>🃏 Колода устойчивых выражений</b>
        <p>Учите не отдельные слова, а готовые выражения — <i>faste uttrykk</i>. Так советуют преподаватели норвежского.</p>
        <p class="small">Источники:</p>
        <div class="lib-hover-src">${SOURCES.filter(s => s.kind === 'auto' || s.kind === 'paste').slice(0, 10).map(s => `<span>${fav(s.domain, 14)} ${U.esc(s.name.split(' — ')[0])}</span>`).join('')}<span>+ колоды Anki, YouTube…</span></div>
      </div>`;
    },
    buttonHtml(cls = 'btn', label = 'Колода устойчивых выражений') {
      return `<span class="lib-btn-wrap"><button class="${cls} lib-btn" data-act="library">${CARDS_SVG(18)} <span>${label}</span></button>${this.hoverHtml()}</span>`;
    },

    open(deckId) {
      const m = UI.modal({
        title: `${CARDS_SVG(22)} Библиотека устойчивых выражений`, cls: 'wide lib-modal',
        body: `<div data-lib-body></div>`,
      });
      const body = m.$('[data-lib-body]');
      const home = () => {
        body.innerHTML = `
          <div class="lib-intro">💬 <span>Преподаватели норвежского советуют учить <b>не отдельные слова, а устойчивые выражения</b> (faste uttrykk): так речь звучит естественно, а слова запоминаются в контексте.
            Здесь собраны все открытые источники, которые мы нашли — университеты, словари, Национальная библиотека, сообщества.
            Перевод идиом делается <b>по смыслу</b> (по толкованию из словаря или нейросетью), а не дословно.</span></div>
          <div class="row lib-listen"><button class="btn listen-cta" data-listen-choose="expr" title="Колоды выражений и фраз — вслух, в наушниках или через динамик">${Listen.HEADPHONES(18, true)} Слушать выражения</button><span class="small muted">по-норвежски и перевод — можно с выключенным экраном</span></div>
          ${!AI.available() ? `<div class="mt-warn">⚠️ <span>Нейросеть не подключена — выражения переведёт машинный переводчик по их толкованию. Это неточно: перепроверяйте. Для точного перевода подключите бесплатную нейросеть (Gemini или Groq) в Настройках.</span></div>` : ''}
          ${GROUPS.map(([k, t, sub]) => `<div class="lib-group"><div class="lib-group-head"><h3>${t}</h3><span class="small muted">${sub}</span></div>
            <div class="lib-grid">${SOURCES.filter(s => s.kind === k).map(tile).join('')}</div></div>`).join('')}
          <div class="tiny muted">Данные: Bokmålsordboka (UiB и Språkrådet, CC BY 4.0) · Språkbanken (CC0) · Wiktionary (CC BY-SA) · Norwegian Constructicon (UiT, CC BY 4.0) · 50languages (Goethe Verlag) · Tatoeba (CC BY 2.0 FR).</div>`;
      };
      home();
      body.addEventListener('click', e => {
        const b = e.target.closest('[data-lib]'); if (!b) return;
        const s = SOURCES.find(x => x.id === b.dataset.id);
        if (b.dataset.lib === 'make') this.form(body, s, deckId, m, home);
        if (b.dataset.lib === 'paste') this.pasteForm(body, s, deckId, m, home);
        if (b.dataset.lib === 'apkg') { m.close(); App.pickFiles(); }
        if (b.dataset.lib === 'back') home();
      });
    },

    deckPicker(deckId, defName) {
      const decks = Store.decks();
      return `<label class="field"><span>Куда добавить</span><select class="input" data-o="deck">
          <option value="">➕ Новая колода «${U.esc(defName)}»</option>
          ${decks.map(d => `<option value="${d.id}" ${d.id === deckId ? 'selected' : ''}>${U.esc(d.name)}</option>`).join('')}</select></label>`;
    },
    commonOpts() {
      return `<div class="lib-opts">
        ${UI.switchHtml('lib-en', false, '🇬🇧 Добавить английский перевод')}
        ${UI.switchHtml('lib-uk', false, '🇺🇦 Добавить украинский перевод')}
        ${UI.switchHtml('lib-ex', true, '💬 С примером употребления')}
        ${UI.switchHtml('lib-skip', true, 'Пропускать выражения, которые уже есть в моих карточках')}
      </div>`;
    },

    form(body, s, deckId, m, home) {
      const extra = {
        freq: `<div class="field-row"><label class="field"><span>Сколько выражений</span><input class="input" type="number" data-o="count" value="30" min="1"></label>
                 <label class="field"><span>Начать с места в рейтинге частоты</span><input class="input" type="number" data-o="from" value="1" min="1" max="3472"></label></div>
               <div class="small muted">№1 — самое частое выражение. Уже имеющиеся пропускаются, так что можно просто нажимать ещё раз — придут следующие.</div>`,
        ordbok: `<label class="field"><span>Слово (все выражения с ним) — или оставьте пустым для случайной подборки</span><input class="input" data-o="word" placeholder="например: hjerte, ta, gå, hånd"></label>
                 <label class="field"><span>Сколько выражений</span><input class="input" type="number" data-o="count" value="25" min="1"></label>`,
        wikt: `<div class="row" style="gap:14px">${UI.switchHtml('cat-idioms', true, 'Идиомы (76)')}${UI.switchHtml('cat-phrases', true, 'Фразы (123)')}${UI.switchHtml('cat-proverbs', true, 'Пословицы (25)')}</div>
               <label class="field"><span>Сколько выражений</span><input class="input" type="number" data-o="count" value="25" min="1"></label>`,
        cxn: `<div class="field-row"><label class="field"><span>Уровень</span><select class="input" data-o="level">${[['all', 'Любой (сначала с уровнем и объяснением)'], ['A1', 'A1'], ['A2', 'A2'], ['B1', 'B1'], ['B2', 'B2'], ['C1', 'C1']].map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
              <label class="field"><span>Сколько</span><input class="input" type="number" data-o="count" value="20" min="1"></label></div>`,
        book2: `${AI.bridge.up ? '' : !(AI.onMac && AI.onMac()) ? '<div class="mt-warn">⚠️ <span>Сайт 50languages не пускает браузер напрямую. Откройте урок ↗, скопируйте фразы и нажмите «📋 Вставить текст».</span></div>' : `<div class="mt-warn">⚠️ <span>Сайт 50languages не пускает браузер напрямую. Запустите мост на Mac (Настройки → Нейросети → Claude, команда в Терминале) и перезапустите его, если он был запущен раньше. Без моста: откройте урок ↗, скопируйте фразы и нажмите «📋 Вставить текст».</span></div>`}
               <div class="field-row"><label class="field"><span>Уроки с</span><input class="input" type="number" data-o="from" value="1" min="1" max="100"></label>
               <label class="field"><span>по</span><input class="input" type="number" data-o="to" value="5" min="1" max="100"></label>
               <label class="field"><span>Максимум фраз</span><input class="input" type="number" data-o="count" value="90" min="1"></label></div>
               <div class="small muted">В каждом уроке 18 фраз. Русский (и украинский) перевод — от людей, не машинный.</div>`,
      }[s.id] || '';
      body.innerHTML = `<button class="btn sm ghost" data-lib="back">← Все источники</button>
        <div class="lib-form-head">${fav(s.domain, 30)}<div><h3 style="margin:0">${U.esc(s.name)}</h3><div class="small muted">${U.esc(s.desc)}</div></div></div>
        ${extra}
        ${this.deckPicker(deckId, s.id === 'book2' ? 'Разговорные фразы' : 'Устойчивые выражения')}
        ${this.commonOpts()}
        <div class="small muted" data-o="who">Перевод на русский: ${AI.available() ? `${AI.icon(AI.current(), 14)} <b>${U.esc(AI.name())}</b> — по смыслу` : `<b>${U.esc(Translators.provNames([Translators.dictMain()]))}</b> по толкованию из словаря (неточно — перепроверяйте)`}${s.id === 'book2' ? ' · для 50languages перевод уже готовый, от людей' : ''}</div>
        <div class="row" style="gap:8px;margin-top:6px"><button class="btn primary" data-go>➕ Создать карточки</button><span class="small muted" data-status></span></div>`;
      if (s.id === 'book2') body.querySelector('[data-key="lib-uk"]').checked = true;
      // quick amounts: 25 · 100 · 250 · 500 · 1000 · 3000 · Все (no upper limit — the source decides)
      const cnt = body.querySelector('[data-o="count"]');
      if (cnt) {
        cnt.closest('label').insertAdjacentHTML('afterend', `<div class="count-chips">${[25, 100, 250, 500, 1000, 3000].map(n => `<button class="chip" data-cnt="${n}">${n}</button>`).join('')}<button class="chip" data-cnt="all">Все</button>
          <span class="small muted">или впишите любое число</span></div>`);
        body.querySelector('.count-chips').addEventListener('click', e => {
          const c = e.target.closest('[data-cnt]'); if (!c) return;
          body.querySelectorAll('[data-cnt]').forEach(x => x.classList.toggle('active', x === c));
          if (c.dataset.cnt === 'all') { cnt.value = ''; cnt.placeholder = 'все'; cnt.dataset.all = '1'; if (s.id === 'book2') { body.querySelector('[data-o="from"]').value = 1; body.querySelector('[data-o="to"]').value = 100; } }
          else { cnt.value = c.dataset.cnt; cnt.dataset.all = ''; }
        });
        cnt.addEventListener('input', () => { cnt.dataset.all = ''; body.querySelectorAll('[data-cnt]').forEach(x => x.classList.remove('active')); });
      }
      const val = k => (body.querySelector(`[data-o="${k}"]`) || {}).value;
      const on = k => { const el = body.querySelector(`[data-key="${k}"]`); return !!(el && el.checked); };
      body.querySelector('[data-go]').onclick = async () => {
        const o = {
          count: cnt && cnt.dataset.all === '1' ? 1e6 : U.clamp(+val('count') || 25, 1, 100000), all: !!(cnt && cnt.dataset.all === '1'), from: Math.max(1, +val('from') || 1), to: Math.max(1, +val('to') || 1),
          word: (val('word') || '').trim(), level: val('level') || 'all',
          cats: ['idioms', 'phrases', 'proverbs'].filter(c => on('cat-' + c)),
          en: on('lib-en'), uk: on('lib-uk'), examples: on('lib-ex'), skipKnown: on('lib-skip'),
        };
        if (s.id === 'book2') { o.to = Math.min(100, Math.max(o.from, o.to)); if (!AI.bridge.up) { UI.toast(AI.onMac && AI.onMac() ? 'Нужен мост на Mac — или вставьте текст урока вручную' : 'В версии на сайте это пока недоступно — вставьте текст урока вручную', 'warn', 5000); return; } }
        await this.run(body, s, o, () => Load[s.id](o, msg => this.status(body, msg)), m);
      };
    },

    pasteForm(body, s, deckId, m, home) {
      body.innerHTML = `<button class="btn sm ghost" data-lib="back">← Все источники</button>
        <div class="lib-form-head">${fav(s.domain, 30)}<div><h3 style="margin:0">${U.esc(s.name)}</h3><div class="small muted">${U.esc(s.desc)}</div></div></div>
        <ol class="small lib-steps"><li><a href="${U.esc(s.url)}" target="_blank" rel="noopener">Откройте страницу ↗</a></li><li>Выделите список выражений и скопируйте (⌘C)</li><li>Вставьте сюда (⌘V) — каждая строка станет карточкой. Понимаю форматы «norsk – русский», «norsk: русский», «norsk (русский)», пары строк, или просто норвежский текст.</li></ol>
        <textarea class="input" data-o="text" rows="8" placeholder="Вставьте текст со страницы…"></textarea>
        ${this.deckPicker(deckId, 'Устойчивые выражения')}
        ${this.commonOpts()}
        ${AI.available() ? UI.switchHtml('lib-aiparse', true, `${U.esc(AI.name())} сама найдёт в тексте выражения и их значения (для «грязного» текста со страницы)`) : ''}
        <div class="row" style="gap:8px;margin-top:6px"><button class="btn primary" data-go>➕ Создать карточки</button><span class="small muted" data-status></span></div>`;
      const on = k => { const el = body.querySelector(`[data-key="${k}"]`); return !!(el && el.checked); };
      body.querySelector('[data-go]').onclick = async () => {
        const text = body.querySelector('[data-o="text"]').value;
        if (!text.trim()) { UI.toast('Вставьте текст', 'warn'); return; }
        const o = { en: on('lib-en'), uk: on('lib-uk'), examples: on('lib-ex'), skipKnown: on('lib-skip') };
        await this.run(body, s, o, async () => {
          let items;
          if (on('lib-aiparse')) {
            this.status(body, `${AI.name()} разбирает текст…`);
            const r = AI.parseJSON(await AI.call({
              system: 'You extract Norwegian Bokmål fixed expressions / idioms / set phrases from pasted web text for flashcards.',
              user: `Extract every Norwegian expression from this text. For each return {"no": the Norwegian expression, "ru": its Russian MEANING if the text gives it or you know it (not word for word), "lit": literal translation if the text gives one, "note": short usage note if the text gives one}. Ignore navigation, ads and comments that are not expressions. Return ONLY a JSON array.\n\nTEXT:\n${text.slice(0, 12000)}`,
              maxTokens: 6000, temperature: 0.1,
            }));
            items = (Array.isArray(r) ? r : r.items || []).filter(x => x && x.no).map(x => ({ no: String(x.no).trim(), ru: String(x.ru || '').trim(), lit: String(x.lit || '').trim(), note: String(x.note || '').trim(), needDef: true }));
          } else items = Load.paste(text).map(x => Object.assign(x, { needDef: true }));
          if (o.skipKnown) { const k = have(); items = items.filter(x => !k.has(U.norm(x.no))); }
          return items;
        }, m);
      };
    },

    status(body, msg) { const st = body.querySelector('[data-status]'); if (st) st.innerHTML = `<span class="spinner sm"></span> ${U.esc(msg)}`; },

    async run(body, s, o, load, m) {
      const btn = body.querySelector('[data-go]');
      btn.disabled = true;
      let stopped = false;
      const stopBtn = document.createElement('button');
      stopBtn.className = 'btn sm ghost'; stopBtn.textContent = '■ Остановить';
      stopBtn.onclick = () => { stopped = true; stopBtn.disabled = true; };
      btn.after(stopBtn);
      o.stop = () => stopped;
      try {
        const items = await load();
        if (!items.length) throw new Error(stopped ? 'Остановлено' : 'Новых выражений не найдено — в этом источнике всё уже есть в ваших карточках');
        const by = await complete(items, o, msg => this.status(body, msg), () => stopped);
        const deckSel = body.querySelector('[data-o="deck"]').value;
        const deck = deckSel ? Store.deck(deckSel) : Store.addDeck(s.id === 'book2' ? 'Разговорные фразы' : 'Устойчивые выражения', `Библиотека выражений · ${s.name}`);
        const ready = items.filter(x => x.no && (x.ru || x.en));
        ready.forEach(x => Store.addCard(deck.id, toCard(x, s, by)));
        Store.autoNameDeck(deck.id); // 🏷 a deck without a name: its first expression
        await Store.saveNow();
        m.close();
        const machine = !by.includes('ai') && ready.some(x => !x.humanRu);
        // the source ran out before the wanted number: say so
        const ranOut = !stopped && items.length < o.count;
        const msg = stopped ? `Остановлено — сохранено ${U.cards(ready.length)} в «${deck.name}»`
          : ranOut ? `В этом источнике больше нет новых выражений — добавлено всё, что было: ${U.cards(ready.length)} в «${deck.name}»`
          : `Создано ${U.cards(ready.length)} в «${deck.name}»`;
        UI.toast(`${msg}${machine ? ' · ⚠️ перевод машинный — перепроверьте' : ''}`, machine || ranOut ? 'warn' : 'good', 8000);
        App.go('deck', { id: deck.id });
      } catch (e) {
        UI.toast(e.message, 'bad', 6000);
        btn.disabled = false; stopBtn.remove();
        const st = body.querySelector('[data-status]'); if (st) st.textContent = '';
      }
    },
  };

  window.Library = Library;
  // the hover card next to «Выражения» is shifted back inside the window (it was cut at the right edge on wide screens)
  const fitHover = e => {
    const w = e.target && e.target.closest && e.target.closest('.lib-btn-wrap');
    const h = w && w.querySelector('.lib-hover'); if (!h) return;
    h.style.marginLeft = '0px';
    const r = h.getBoundingClientRect();
    h.style.marginLeft = (r.right > innerWidth - 12 ? innerWidth - 12 - r.right : r.left < 12 ? 12 - r.left : 0) + 'px';
  };
  document.addEventListener('mouseover', fitHover);
  document.addEventListener('focusin', fitHover);
})();
