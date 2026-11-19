/* ============ 🌳👦👧 Decks by grammatical gender: et (neuter), en (masculine), ei (feminine) ============
 * Icons: 👦 boy = masculine (en), 👧 girl = feminine (ei), 🌳 tree = neuter (et) — «et tre» / «дерево» is neuter
 * in both languages (a thing, «оно»; not a person).
 * Teachers' advice: learn the neuter nouns (et) by heart — then you never mix up en/ei/et.
 * Sources: the most frequent Norwegian nouns (FrequencyWords no_50k, OpenSubtitles, CC BY-SA 4.0) with the gender
 * from Ordbøkene (each article's paradigm tags: Masc / Fem / Neuter) — or the nouns already in your own cards.
 * Feminine nouns in Bokmål can always also be masculine (ei/en jente) — the card shows both.
 */
(function () {
  const FREQ = 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/no/no_50k.txt';
  const API = 'https://ord.uib.no';
  const G = {
    n: { art: 'et', name: 'Средний род', icon: '🌳', deck: '🌳 Средний род (et)', old: '⚪ Средний род (et)', color: '#e2e8f0' },
    m: { art: 'en', name: 'Мужской род', icon: '👦', deck: '👦 Мужской род (en)', old: '🔵 Мужской род (en)', color: '#60a5fa' },
    f: { art: 'ei', name: 'Женский род', icon: '👧', deck: '👧 Женский род (ei / en)', old: '🔴 Женский род (ei / en)', color: '#f87171' },
  };
  /** decks made with the old icons (⚪🔵🔴) get the new names — once, keeps their cards and progress */
  function migrateNames() {
    let changed = false;
    Object.values(G).forEach(g => {
      if (Store.decks().some(d => d.name === g.deck)) return; // a deck with the new name already exists: no twin names
      const d = Store.decks().find(x => x.name === g.old);
      if (d) { Store.updateDeck(d.id, { name: g.deck }); changed = true; }
    });
    return changed;
  }
  // subtitle artefacts / words that are mostly something else
  const BLOCK = new Set(['sir', 'mr', 'mrs', 'miss', 'pokker', 'ganger', 'vondt', 'mark', 'klær', 'ok', 'okay', 'faen', 'jesus', 'gud',
    // past tense of strong verbs that also exist as rare nouns (skrev = wrote / et skrev = crotch)
    'skrev', 'drev', 'bet', 'red', 'skjøt', 'sprang', 'rant', 'fløy', 'brøt', 'krøp', 'strøk', 'slo', 'lo', 'fant', 'bant']);
  // frequent nouns the automatic filter would drop (they look like verb/adjective forms)
  const ALLOW = ['liv', 'sted', 'mor', 'side', 'dør', 'hjelp', 'ting', 'bord', 'skip', 'egg', 'politi', 'øl', 'far', 'vann', 'arbeid', 'land', 'by', 'hånd', 'øye', 'hode', 'jobb', 'skole', 'mat', 'penger', 'rom', 'bil'];

  const GENDER_FIX = { øl: 'n', egg: 'n', bord: 'n', rom: 'n' };
  let lemmaIdx = null, freq = null, rank = null;
  const artCache = new Map();
  async function nouns() {
    if (lemmaIdx) return lemmaIdx;
    const all = await (await fetch(API + '/bm/fil/lemma.json')).json();
    const pos = new Map();
    all.forEach(([l, id, p]) => { const k = String(l).toLowerCase(); if (!pos.has(k)) pos.set(k, { ids: [], other: false }); const e = pos.get(k); if (p === 'NOUN') e.ids.push(id); else e.other = true; });
    lemmaIdx = pos;
    return pos;
  }
  async function frequency() {
    if (freq) return freq;
    const t = await (await fetch(FREQ)).text();
    freq = t.split('\n').map(l => l.split(' ')[0]).filter(Boolean);
    rank = new Map(); freq.forEach((w, i) => { if (!rank.has(w)) rank.set(w, i); });
    return freq;
  }
  /** article -> { genders:Set('n'|'m'|'f'), forms:{sd, pi, pd}, lemma } for this word */
  async function nounInfo(word, ids) {
    // homographs (en bord «борт» / et bord «стол», ei egg «лезвие» / et egg «яйцо»): every noun article is read,
    // and the one whose own forms are the most frequent in everyday speech wins (bordet ≫ borden)
    const cands = [];
    for (const id of ids.slice(0, 3)) {
      const one = await articleInfo(word, id);
      if (one) cands.push(one);
    }
    if (!cands.length) return null;
    // the dictionary gender where everyday speech leans the other way (en øl = «a bottle of beer», the noun is et øl)
    if (GENDER_FIX[word]) { const c = cands.find(x => x.g === GENDER_FIX[word]); if (c) return c; }
    // forms both homographs share (eggene) prove nothing — only their own forms count (egget vs egga)
    const all = cands.flatMap(c => c.forms ? [c.forms.sd, c.forms.pi, c.forms.pd] : []).map(x => String(x || '').toLowerCase());
    const shared = new Set(all.filter((x, i) => x && all.indexOf(x) !== i));
    const score = c => {
      if (!rank || !c.forms) return Infinity;
      const r = x => { x = String(x || '').toLowerCase(); return x && x !== word && !shared.has(x) && rank.has(x) ? rank.get(x) : Infinity; };
      return Math.min(r(c.forms.sd), r(c.forms.pi), r(c.forms.pd));
    };
    let best = cands[0];
    cands.slice(1).forEach(c => { if (score(c) < score(best)) best = c; });
    return best;
  }
  /** one dictionary article: gender + the forms of its main paradigm */
  async function articleInfo(word, id) {
    const genders = new Set(); let forms = null, formsFrom = '', formsFem = false;
    {
      let a = artCache.get(id);
      if (!a) { a = await (await fetch(`${API}/bm/article/${id}.json`)).json(); artCache.set(id, a); }
      (a.lemmas || []).filter(l => String(l.lemma).toLowerCase() === word).forEach(l => (l.paradigm_info || []).forEach(p => {
        const t = p.tags || [];
        if (t[0] !== 'NOUN') return;
        if (t.includes('Neuter')) genders.add('n');
        if (t.includes('Masc')) genders.add('m');
        if (t.includes('Fem')) genders.add('f');
        const get = (num, def) => ((p.inflection || []).find(f => (f.tags || []).join(' ') === `${num} ${def}`) || {}).word_form;
        // prefer the Fem paradigm for ei-words ("jenta"); then an irregular plural the dictionary lists (øyne, not øyer);
        // otherwise the usual Bokmål plural in -ene (menneskene, not menneska) — unless that paradigm was only added
        // later than the current one (barnene came in 2005, barna is the main form)
        const f = { sd: get('Sing', 'Def'), pi: get('Plur', 'Ind'), pd: get('Plur', 'Def') };
        const usual = x => x && x.pd && /ene$/.test(x.pd);
        const irregular = x => !!(x && x.pi) && ![word, word + 'r', word + 'er', word.replace(/e$/, '') + 'er'].includes(x.pi);
        const newer = (p.from || '') > formsFrom;
        const better = irregular(f) !== irregular(forms) ? irregular(f) : !usual(forms) && usual(f) && !newer;
        const fem = t.includes('Fem'); // the first Fem paradigm wins (mor: mødre, not the later mødrer)
        if (!forms || (fem && !formsFem) || (fem === formsFem && better)) { forms = f; formsFrom = p.from || ''; formsFem = fem; }
      }));
    }
    if (!genders.size) return null;
    const g = genders.has('n') && !genders.has('m') ? 'n' : genders.has('f') ? 'f' : genders.has('m') && !genders.has('n') ? 'm' : null;
    return g ? { g, forms } : null;
  }
  const withArt = (g, w) => g === 'f' ? `ei ${w}` : `${G[g].art} ${w}`;
  const formsLine = (g, w, f) => f ? [withArt(g, w), f.sd, f.pi, f.pd].filter(Boolean).join(' – ') : withArt(g, w);

  const Genders = {
    G, migrateNames,
    open() {
      const m = UI.modal({
        title: '🌳👦👧 Колоды по родам: et · en · ei', cls: 'wide',
        body: `<div class="lib-intro">💡 <span>Преподаватели советуют <b>выучить наизусть существительные среднего рода (et)</b> — их меньше всего, и тогда остальные почти всегда «en». Женский род (ei) в bokmål всегда можно заменить на «en»: <i>ei/en jente</i>.</span></div>
          <div class="gender-pick">${Object.entries(G).map(([k, g]) => `<label class="gender-opt" style="--gc:${g.color}"><input type="checkbox" data-g="${k}" ${k === 'n' ? 'checked' : ''}><span class="gi">${g.icon}</span><b>${g.name}</b><small>${k === 'f' ? 'ei / en' : g.art} …</small></label>`).join('')}</div>
          <div class="field"><span>Откуда взять слова</span>
            <label class="radio"><input type="radio" name="gsrc" value="freq" checked> 📈 Самые частые существительные норвежского (из живой речи) — с родом из словаря Ordbøkene</label>
            <label class="radio"><input type="radio" name="gsrc" value="mine"> 🗂 Мои карточки — разложить мои существительные по родам</label></div>
          <div class="field-row"><label class="field"><span>Сколько слов каждого рода</span><input class="input" type="number" data-n value="50" min="10" max="300"></label>
            <label class="field"><span>Вид карточки</span><select class="input" data-mode>
              <option value="quiz">Тренировка рода: спереди «hus», на обороте «et hus — дом» и все формы</option>
              <option value="plain">Обычная: спереди «et hus», на обороте «дом»</option></select></label></div>
          ${UI.switchHtml('g-skip', true, 'Пропускать слова, которые уже есть в этих колодах')}
          <div class="row" style="gap:8px;margin-top:6px"><button class="btn primary" data-go>➕ Создать колоды</button><button class="btn ghost" data-stop hidden>■ Остановить</button><span class="small muted" data-log></span></div>
          <div class="tiny muted">Слова: FrequencyWords (OpenSubtitles 2018, CC BY-SA 4.0) · род и формы: Bokmålsordboka (UiB и Språkrådet, CC BY 4.0) · перевод: ${AI.available() ? U.esc(AI.name()) : 'машинный переводчик (перепроверяйте)'}.</div>`,
      });
      let stop = false;
      const log = t => { m.$('[data-log]').innerHTML = t ? `<span class="spinner sm"></span> ${U.esc(t)}` : ''; };
      m.$('[data-stop]').onclick = () => { stop = true; };
      m.$('[data-go]').onclick = async () => {
        const want = Object.keys(G).filter(k => m.$(`[data-g="${k}"]`).checked);
        if (!want.length) { UI.toast('Выберите хотя бы один род', 'warn'); return; }
        const n = U.clamp(+m.$('[data-n]').value || 50, 5, 300);
        const mode = m.$('[data-mode]').value;
        const src = m.$('input[name="gsrc"]:checked').value;
        const skip = m.$('[data-key="g-skip"]').checked;
        m.$('[data-go]').disabled = true; m.$('[data-stop]').hidden = false; stop = false;
        try {
          const found = { n: [], m: [], f: [] };
          migrateNames();
          const decks = {}; want.forEach(k => { decks[k] = Store.decks().find(d => d.name === G[k].deck); });
          const have = new Set(want.flatMap(k => decks[k] ? Store.cards(decks[k].id).map(c => U.norm(c.no).replace(/^(en|ei|et) /, '')) : []));
          // a few spare words: some are dropped after translation (it shows they are really verb forms)
          const cap = src === 'mine' ? n : Math.ceil(n * 1.25) + 3;
          const enough = () => want.every(k => found[k].length >= cap);
          log('загружаю словарь Ordbøkene (≈5 МБ, один раз)…');
          const idx = await nouns();
          let words;
          if (src === 'mine') {
            words = Store.cards().map(c => String(c.no).split('\n')[0].trim().toLowerCase()).filter(w => /^((en|ei|et)\s+)?[a-zæøå-]+$/.test(w));
          } else {
            log('загружаю частотный список…');
            const f = await frequency();
            const top = f.slice(0, 6000).filter(w => !BLOCK.has(w) && w.length > 1 && idx.has(w) && idx.get(w).ids.length && (!idx.get(w).other || ALLOW.includes(w)));
            words = [...new Set(ALLOW.filter(w => idx.has(w)).concat(top))].sort((a, b) => f.indexOf(a) - f.indexOf(b));
          }
          let i = 0, done = 0;
          await Promise.all(Array.from({ length: 6 }, async () => {
            while (i < words.length && !stop && !enough()) {
              const raw = words[i++];
              const art = (raw.match(/^(en|ei|et)\s+/) || [])[1];
              const w = raw.replace(/^(en|ei|et)\s+/, '');
              const e = idx.get(w);
              if (!e || !e.ids.length || (skip && have.has(w))) continue;
              try {
                const info = await nounInfo(w, e.ids);
                // a frequent word that is really a form of another word («nytt» = ny, «godt» = god, «gir» = gi) has a rare
                // noun twin in the dictionary: a real everyday noun also has its own forms in everyday speech (stedet, husene)
                if (src !== 'mine' && rank && !ALLOW.includes(w) && info && info.forms) {
                  // a form spelled like the word itself proves nothing (et hold – hold, et sto – sto: plural = singular)
                  const r = x => x && String(x).toLowerCase() !== w ? (rank.has(String(x).toLowerCase()) ? rank.get(String(x).toLowerCase()) : Infinity) : Infinity;
                  const best = Math.min(r(info.forms.sd), r(info.forms.pi), r(info.forms.pd));
                  if (best === Infinity) { done++; continue; }
                  // a verb twin (bor → bore, kjør → kjøre, hold → holde) and noun forms far rarer than the word:
                  // the frequent word is the verb («he lives», «drive!»), not the noun
                  const verb = idx.get(w + 'e');
                  const own = rank.has(w) ? rank.get(w) : Infinity;
                  if (verb && verb.other && best > own * 5) { done++; continue; }
                }
                let g = info && info.g;
                if (!g && art) g = art === 'et' ? 'n' : art === 'ei' ? 'f' : 'm';
                if (g && want.includes(g) && found[g].length < cap && !found[g].some(x => x.w === w)) found[g].push({ w, forms: info && info.forms, card: src === 'mine' ? Store.cards().find(c => String(c.no).toLowerCase().split('\n')[0].trim() === raw) : null });
              } catch (err) { /* skip word */ }
              done++;
              if (done % 5 === 0) log(`проверяю род: ${done} слов · ${want.map(k => `${G[k].icon} ${found[k].length}/${n}`).join(' · ')}`);
            }
          }));
          // translations (the article helps the translator: "et hus" -> "дом")
          const all = want.flatMap(k => found[k].map(x => Object.assign(x, { g: k })));
          if (!all.length) throw new Error('Существительных не найдено');
          const need = all.filter(x => !(x.card && x.card.ru));
          log(`перевожу ${need.length} слов…`);
          let by = [];
          if (need.length) {
            if (AI.available()) {
              try {
                for (let k = 0; k < need.length; k += 40) {
                  const part = need.slice(k, k + 40);
                  const arr = AI.parseJSON(await AI.call({ system: 'You are a Norwegian–Russian dictionary.', user: `Translate each Norwegian Bokmål noun into Russian: the 1–3 most common meanings, comma-separated. Return ONLY a JSON array of strings, same order.\n${JSON.stringify(part.map(x => withArt(x.g, x.w)))}`, maxTokens: 120 + part.length * 30, temperature: 0.1 }));
                  part.forEach((x, j) => { if (arr[j]) x.ru = String(arr[j]).trim(); });
                }
                by = ['ai']; Translators.lastAI = AI.lastProvider;
              } catch (e) { /* machine translation below */ }
            }
            const rest = need.filter(x => !x.ru);
            if (rest.length) {
              // the definite form translates as the noun itself: «stedet» → «место» («et sted» came out as «где-то»)
              const res = await Translators.translateMany(rest.map(x => (x.forms && x.forms.sd) || withArt(x.g, x.w)), 'no', 'ru');
              const res2 = await Translators.translateMany(rest.map(x => withArt(x.g, x.w)), 'no', 'ru');
              // «boret» → «пробуренный», «skrevet» → «написано»: the -et form was read as a participle → use «et X»;
              // if that is a verb form too, the word is not a real noun here — dropped
              const verbish = t => /(нн(ый|ая|ое|ые)|(ано|ено|ято|ито|ыто)|ться|ть|вший|ющий|ящий)$/i.test(String(t).trim().split(/[\s,]+/)[0] || '');
              const strip = t => String(t || '').replace(/^(один|одна|одно)\s+/i, '').trim();
              rest.forEach((x, j) => {
                const a = strip(res.out[j]), b = strip(res2.out[j]);
                if (a && !verbish(a)) x.ru = a;
                else if (b && !verbish(b)) x.ru = b;
                else if (a || b) x.bad = true; // both translations are verb forms (no answer at all = keep, untranslated)
              });
              by = [...new Set(by.concat(res.by, res2.by))];
            }
          }
          // decks + cards
          let made = 0;
          want.forEach(k => {
            // spare words were collected — keep the order of frequency, drop the verb forms, take as many as asked
            found[k] = found[k].filter(x => !x.bad).slice(0, n);
            if (!found[k].length) return;
            const deck = decks[k] || Store.addDeck(G[k].deck, k === 'n' ? 'Существительные среднего рода — выучить наизусть' : k === 'f' ? 'Женский род: ei (можно и en)' : 'Мужской род: en');
            found[k].forEach(x => {
              const ru = x.ru || (x.card && x.card.ru) || '';
              const line = formsLine(k, x.w, x.forms);
              const quiz = mode === 'quiz';
              Store.addCard(deck.id, {
                no: quiz ? x.w : withArt(k, x.w), ru: quiz ? `${withArt(k, x.w)} — ${ru}` : ru, wordClass: 'substantiv',
                description: `${G[k].icon} ${G[k].name}${k === 'f' ? ' (ei / en)' : ''}: ${line}`,
                forms: x.forms ? [
                  { label: 'Неопр. ед. (ubestemt entall)', no: withArt(k, x.w), ru },
                  x.forms.sd && { label: 'Опр. ед. (bestemt entall)', no: x.forms.sd, ru },
                  x.forms.pi && { label: 'Неопр. мн. (ubestemt flertall)', no: x.forms.pi, ru },
                  x.forms.pd && { label: 'Опр. мн. (bestemt flertall)', no: x.forms.pd, ru },
                ].filter(Boolean) : [],
                tags: ['kjønn', { n: 'intetkjønn', m: 'hankjønn', f: 'hunkjønn' }[k]],
                history: [Prov.entry('tr:ordbok', 'create', null, `род и формы из Ordbøkene · ${G[k].name}`), ...Translators.provKeys(by).map(b => Prov.entry(b, 'translate', null, 'перевод слова'))],
                mtWarn: Translators.mtFlag(by),
              });
              made++;
            });
          });
          await Store.saveNow();
          log('');
          m.close();
          UI.toast(`Создано ${U.cards(made)}: ${want.map(k => `${G[k].icon} ${found[k].length}`).join(' · ')}${Translators.mtFlag(by) ? ' · ⚠️ перевод машинный — перепроверьте' : ''}`, 'good', 6000);
          App.go('home');
        } catch (e) {
          log(''); UI.toast(e.message, 'bad', 6000);
          m.$('[data-go]').disabled = false; m.$('[data-stop]').hidden = true;
        }
      };
    },
  };

  window.Genders = Genders;
})();
