/* ============ 📐 Grammar: grammatikk.com (free PDFs by Kjell H. Ullestad) ============
 * The site has no search and no API: every topic is a PDF. The app keeps the list of topics,
 * picks the ones that fit the card (words, word class, patterns), reads the PDF through the bridge
 * (the site does not allow browser requests), shows the text with a Russian translation and can add
 * the relevant lines to the card — with the source (© Kjell H. Ullestad, link) and who translated it.
 * Without the bridge the PDF opens right inside the window (reading only).
 * Only short parts are stored in the card; the whole topic stays on the author's site.
 */
(function () {
  const BASE = 'https://grammatikk.com/';
  const AUTHOR = 'Kjell H. Ullestad';
  const GROUPS = {
    noun: '📦 Существительные', verb: '⚙️ Глаголы', pron: '👤 Местоимения', adj: '🎨 Прилагательные и наречия',
    sent: '🧩 Предложения и порядок слов', conj: '🔗 Союзы', prep: '📍 Предлоги и время', pair: '⚖️ Что выбрать: похожие слова',
    sound: '🗣 Произношение и письмо', other: '📎 Разное', drill: '🏋️ Тренировки и упражнения (с ответами)',
  };
  // [file, Norwegian title, Russian title, group, trigger words (phrases with _), word classes]
  const T = [
    ['Substantiv.pdf', 'Substantivets former', 'Формы существительного', 'noun', '', 'substantiv'],
    ['Substantivtabell.pdf', 'Substantivets former – tabell', 'Формы существительного — таблица', 'noun', '', 'substantiv'],
    ['Nouns.pdf', 'The forms of the noun', 'Формы существительного (на английском)', 'noun', '', ''],
    ['BestemtUbestemt.pdf', 'Bestemt eller ubestemt form?', 'Определённая или неопределённая форма?', 'noun', 'en ei et den det de', 'substantiv'],
    ['Definite.pdf', 'Definite and indefinite form', 'Определённая и неопределённая форма (на английском)', 'noun', '', ''],
    ['UbestArt.pdf', 'Ubestemt artikkel', 'Неопределённый артикль', 'noun', 'en ei et', ''],
    ['Noytrum.pdf', '110 substantiv som er nøytrum', '110 существительных среднего рода (et)', 'noun', 'et', ''],
    ['IrregSubstantiv.pdf', 'Irregulære substantiv', 'Неправильные существительные', 'noun', 'mann menn bok bøker fot føtter hånd hender bror brødre barn øye øyne', ''],
    ['Genitiv.pdf', 'Genitiv', 'Родительный падеж (чей?)', 'noun', '', ''],
    ['Demonstrativer.pdf', 'Denne, dette, disse og den, det, de', 'Этот, эта, эти (denne, dette, disse)', 'noun', 'denne dette disse', ''],
    ['Substantivfraser.pdf', 'Substantivfraser engelsk-norsk', 'Именные группы: английский — норвежский', 'noun', '', ''],
    ['Substantivformer.pdf', 'Substantivfraser på åtte språk', 'Именные группы на восьми языках', 'noun', '', ''],
    ['VerbLita.pdf', 'Verbliste for begynnere', 'Список глаголов для начинающих', 'verb', '', 'verb'],
    ['VerbStor.pdf', 'Lang verbliste', 'Большой список глаголов', 'verb', '', 'verb'],
    ['Verb.pdf', 'Verbets former', 'Формы глагола', 'verb', 'å', 'verb'],
    ['Verbtabell.pdf', 'Fortid av regulære verb', 'Прошедшее время правильных глаголов', 'verb', '', 'verb'],
    ['PretPerf.pdf', 'Preteritum eller presens perfektum?', 'Претерит или перфект?', 'verb', 'har hadde i_går nettopp allerede aldri', ''],
    ['Tidsperspektiv.pdf', 'Fortelle om nåtid og fortid', 'Рассказ о настоящем и прошлом', 'verb', '', ''],
    ['Modalverb.pdf', 'Modalverb', 'Модальные глаголы (kan, vil, skal, må, bør)', 'verb', 'kan kunne kunnet vil ville villet skal skulle skullet må måtte måttet bør burde burdet få', ''],
    ['Futurum.pdf', 'Futurum', 'Будущее время', 'verb', 'skal vil kommer_til_å kommer_til', ''],
    ['Passiv.pdf', 'Passiv', 'Пассив (страдательный залог)', 'verb', 'blir ble blitt', ''],
    ['SVerb.pdf', 'S-verb', 'Глаголы на -s (synes, trives, møtes)', 'verb', 'synes syntes trives trivdes møtes finnes fantes lykkes minnes slåss', ''],
    ['Partisipp.pdf', 'Partisipp', 'Причастие', 'verb', '', ''],
    ['PersonligPronomen.pdf', 'Personlige pronomener', 'Личные местоимения', 'pron', 'jeg meg du deg han ham hun henne vi oss dere de dem', 'pronomen'],
    ['DetDen.pdf', 'Det – den', 'Det или den?', 'pron', 'det den', ''],
    ['RefleksivPronomen.pdf', 'Refleksive pronomener', 'Возвратные местоимения (seg)', 'pron', 'seg', ''],
    ['RefleksiveVerb.pdf', 'Refleksive verb', 'Возвратные глаголы (å vaske seg)', 'verb', 'seg', ''],
    ['SegHverandre.pdf', 'Seg eller hverandre?', 'Seg или hverandre (себя / друг друга)?', 'pron', 'seg hverandre', ''],
    ['Possessiv.pdf', 'Possessive pronomener', 'Притяжательные местоимения (min, din…)', 'pron', 'min mi mitt mine din di ditt dine hans hennes vår vårt våre deres', ''],
    ['Sin.pdf', 'Sin', 'Sin, si, sitt, sine (свой)', 'pron', 'sin si sitt sine', ''],
    ['NoenNoe.pdf', 'Noen eller noe?', 'Noen или noe?', 'pron', 'noen noe', ''],
    ['Man.pdf', 'Man', 'Man (безличное «люди»)', 'pron', 'man en', ''],
    ['AdjektivSamsvar.pdf', 'Adjektivets former', 'Формы прилагательного', 'adj', '', 'adjektiv'],
    ['Komparasjon.pdf', 'Komparasjon', 'Степени сравнения', 'adj', 'mer mest bedre best verre verst større størst eldre eldst flere flest mindre minst', 'adjektiv'],
    ['Adjektivmaskin.pdf', 'Adjektiv-maskin', 'Тренажёр прилагательных', 'adj', '', ''],
    ['Adverb.pdf', 'Adverb', 'Наречия', 'adj', '', 'adverb'],
    ['SubstAdjektiv.pdf', 'Adjektiv som substantiv', 'Прилагательное в роли существительного', 'adj', '', ''],
    ['Setninger.pdf', 'Norske setninger (Helsetninger)', 'Норвежское предложение, порядок слов (V2)', 'sent', '', ''],
    ['Sentences.pdf', 'Basic sentence structures', 'Строение предложения (на английском)', 'sent', '', ''],
    ['Leddsetninger.pdf', 'Leddsetninger', 'Придаточные предложения', 'sent', 'at om fordi når hvis mens selv_om', ''],
    ['Setningsadverb.pdf', 'Setningsadverb', 'Наречия предложения (ikke, aldri, alltid…)', 'sent', 'ikke aldri alltid også bare kanskje gjerne ofte sjelden nok vel jo heller egentlig fortsatt allerede', ''],
    ['Som.pdf', 'Som-setninger', 'Предложения с som (который)', 'sent', 'som', ''],
    ['DetSetninger.pdf', 'Det-setninger', 'Предложения с det (det er…, det regner)', 'sent', 'det_er det_var det_finnes', ''],
    ['SprLeddsetning.pdf', 'Indirekte spørsmål', 'Косвенный вопрос', 'sent', 'om', ''],
    ['TungeLetteLedd.pdf', 'Tunge og lette subjekt og objekt', 'Тяжёлые и лёгкие члены предложения', 'sent', '', ''],
    ['Hypotetisk.pdf', 'Hypotetiske setninger', 'Условные (гипотетические) предложения', 'sent', 'hvis ville hadde skulle', ''],
    ['Kommaregler.pdf', 'Komma (,)', 'Запятая', 'sent', '', ''],
    ['Konjunksjoner.pdf', 'Konjunksjoner', 'Сочинительные союзы (og, men, eller…)', 'conj', 'og men eller for så', 'konjunksjon'],
    ['Subjunksjoner.pdf', 'Subjunksjoner', 'Подчинительные союзы (at, fordi, når…)', 'conj', 'at om fordi når da hvis selv_om mens før etter_at siden til_tross_for_at slik_at', 'subjunksjon'],
    ['Relasjoner.pdf', 'Logiske relasjoner', 'Логические связи (причина, следствие…)', 'conj', 'derfor fordi likevel selv_om', ''],
    ['Kronologi.pdf', 'Kronologi', 'Последовательность событий (først, så, etterpå)', 'conj', 'først så etterpå deretter til_slutt før etter', ''],
    ['Saa.pdf', 'Så', 'Слово så', 'conj', 'så', ''],
    ['AtSom.pdf', 'At eller som?', 'At или som?', 'pair', 'at som', ''],
    ['HvisOm.pdf', 'Hvis eller om?', 'Hvis или om (если)?', 'pair', 'hvis om', ''],
    ['NaarDa.pdf', 'Når eller da?', 'Når или da (когда)?', 'pair', 'når da', ''],
    ['FordiFor.pdf', 'Fordi eller for?', 'Fordi или for (потому что)?', 'pair', 'fordi for', ''],
    ['LikevelDerimot.pdf', 'Likevel eller derimot?', 'Likevel или derimot?', 'pair', 'likevel derimot', ''],
    ['Stedspreposisjoner.pdf', 'Hvor-preposisjoner', 'Предлоги места (på, i, hos…)', 'prep', 'på i til fra hos ved under over bak foran mellom', 'preposisjon'],
    ['Tidsuttrykk.pdf', 'Tidsuttrykk', 'Выражения времени', 'prep', 'i_går i_dag i_morgen om for_siden på_mandag i_fjor i_år neste forrige siden', ''],
    ['Genitivprep.pdf', '«Of» på norsk', '«Of» по-норвежски: предлоги вместо родительного', 'prep', 'av', ''],
    ['Preposisjonsuttrykk.pdf', '94 uttrykk med preposisjoner', '94 выражения с предлогами', 'prep', 'lyst_til lyst_på glad_i interessert_i redd_for flink_til opptatt_av fornøyd_med ferdig_med vant_til', ''],
    ['For_aa.pdf', 'For å', 'For å (чтобы)', 'prep', 'for_å', ''],
    ['SammensatteOrd.pdf', 'Sammensatte ord', 'Сложные слова', 'other', '', ''],
    ['Ordlaging.pdf', 'Ordlaging', 'Словообразование', 'other', '', ''],
    ['Sporreord.pdf', 'Spørreord', 'Вопросительные слова', 'other', 'hva hvem hvor hvorfor hvordan hvilken hvilket hvilke når', ''],
    ['Stedsadverb.pdf', 'Stedsadverb', 'Наречия места (hjem / hjemme, ut / ute)', 'other', 'hjem hjemme ut ute inn inne opp oppe ned nede bort borte fram framme', ''],
    ['AllHel.pdf', 'All og hel', 'All и hel (весь, целый)', 'pair', 'all alt alle hel helt hele', ''],
    ['BadeBegge.pdf', 'Både og begge', 'Både и begge (оба, и… и…)', 'pair', 'både begge', ''],
    ['EntenVerken.pdf', 'Enten og verken', 'Enten… eller / verken… eller', 'pair', 'enten verken', ''],
    ['ForAnn.pdf', 'Forskjellig eller annerledes?', 'Forskjellig или annerledes (разный / иначе)?', 'pair', 'forskjellig forskjellige annerledes', ''],
    ['JaJoNei.pdf', 'Ja, jo eller nei?', 'Ja, jo или nei?', 'pair', 'ja jo nei', ''],
    ['Negasjon.pdf', 'Ikke noe(n) – ingen – ingenting', 'Отрицание: ikke noen / ingen / ingenting', 'pair', 'ikke ingen ingenting intet', ''],
    ['Nasjonaliteter.pdf', 'Land og nasjonaliteter', 'Страны и национальности', 'other', 'norsk nordmann norge russisk russland ukrainsk ukraina', ''],
    ['LikeSamme.pdf', 'Like eller samme?', 'Like или samme (одинаковый / тот же)?', 'pair', 'like lik samme', ''],
    ['LittLite.pdf', 'Litt eller lite?', 'Litt или lite (немного / мало)?', 'pair', 'litt lite', ''],
    ['MangeMye.pdf', 'Mange eller mye?', 'Mange или mye (много)?', 'pair', 'mange mye flere flest mer mest', ''],
    ['MenneskerPersoner.pdf', 'Mennesker, personer eller folk?', 'Mennesker, personer или folk (люди)?', 'pair', 'mennesker menneske personer person folk', ''],
    ['Kvantiteter.pdf', 'Ord for kvantitet og frekvens', 'Слова количества и частоты', 'other', 'alltid ofte sjelden aldri noen_ganger mange mye få lite', ''],
    ['SetteSitteLeggeLigge.pdf', 'Sette, sitte, legge og ligge', 'Sette, sitte, legge, ligge (ставить, сидеть, класть, лежать)', 'pair', 'sette satte satt sitte sitter legge la lagt ligge ligger lå ligget', ''],
    ['Tall.pdf', 'Tall og matematikk', 'Числа и математика', 'other', 'en to tre fire fem seks sju syv åtte ni ti hundre tusen', ''],
    ['TroSynes.pdf', 'Tro, synes, mene eller tenke?', 'Tro, synes, mene или tenke (думать)?', 'pair', 'tro tror trodde synes syntes mene mener mente tenke tenker tenkte', ''],
    ['ViteKjenne.pdf', 'Vite, kjenne eller kunne?', 'Vite, kjenne или kunne (знать)?', 'pair', 'vite vet visste kjenne kjenner kjente kunne kan', ''],
    ['VaereBliHaFaa.pdf', 'Være – bli – ha – få', 'Være, bli, ha, få', 'verb', 'være er var vært bli blir ble blitt ha har hadde hatt få får fikk fått', ''],
    ['Forkortelser.pdf', 'Noen vanlige forkortelser', 'Частые сокращения', 'other', 'f.eks osv bl.a ca', ''],
    ['Terminologi.pdf', 'Grammatikk-terminologi', 'Грамматические термины', 'other', '', ''],
    ['GrammarTerminology.pdf', 'Grammar terminology', 'Грамматические термины (на английском)', 'other', '', ''],
    ['Ordboktips.pdf', 'How to use your dictionary', 'Как пользоваться словарём (на английском)', 'other', '', ''],
    ['Konsonanter.pdf', 'Consonants made easy', 'Согласные (на английском)', 'sound', '', ''],
    ['Vokaler.pdf', 'Vowels made easy', 'Гласные (на английском)', 'sound', '', ''],
    ['Vokallengde.pdf', 'Long and short vowels', 'Долгие и краткие гласные (на английском)', 'sound', '', ''],
    ['Spelling.pdf', 'Spelling and pronunciation', 'Написание и произношение (на английском)', 'sound', '', ''],
    ['Trykk.pdf', 'Stress in Norwegian words', 'Ударение в норвежских словах (на английском)', 'sound', '', ''],
    ['Capital.pdf', 'Capital letters', 'Заглавные буквы (на английском)', 'sound', '', ''],
    ['Svensk.pdf', 'Fra svensk til norsk', 'Со шведского на норвежский', 'other', '', ''],
    ['Nynorsk.pdf', 'Nynorsk', 'Нюнорск', 'other', '', ''],
    ['NynBm.pdf', 'Nynorsk – bokmål', 'Нюнорск и букмол', 'other', '', ''],
    ['VerbNynorsk.pdf', 'Nynorsk verbliste', 'Глаголы на нюнорске', 'other', '', ''],
    ['DrillV2.pdf', 'Drill: Verbet på riktig plass (V2)', 'Тренировка: глагол на втором месте', 'drill', '', ''],
    ['DrillVerb1.pdf', 'Drill: Verb 1', 'Тренировка: глаголы 1', 'drill', '', 'verb'],
    ['DrillVerb2.pdf', 'Drill: Verb 2', 'Тренировка: глаголы 2', 'drill', '', 'verb'],
    ['DrillSubstantiv1.pdf', 'Drill: Substantiv 1', 'Тренировка: существительные 1', 'drill', '', 'substantiv'],
    ['DrillSubstantiv2.pdf', 'Drill: Substantiv 2', 'Тренировка: существительные 2', 'drill', '', 'substantiv'],
    ['DrillSubstantivIrreg.pdf', 'Drill: Irregulære substantiv', 'Тренировка: неправильные существительные', 'drill', '', ''],
    ['DrillNomen.pdf', 'Drill: Nomen', 'Тренировка: именные формы', 'drill', '', ''],
    ['DrillAdjektiv.pdf', 'Drill: Adjektiv', 'Тренировка: прилагательные', 'drill', '', 'adjektiv'],
    ['DrillKomparasjon.pdf', 'Drill: Komparasjon', 'Тренировка: степени сравнения', 'drill', '', ''],
    ['DrillPassiv.pdf', 'Drill: Passiv', 'Тренировка: пассив', 'drill', '', ''],
    ['DrillPossessiv.pdf', 'Drill: Possessiv', 'Тренировка: притяжательные местоимения', 'drill', '', ''],
    ['DrillSin.pdf', 'Drill: Sin', 'Тренировка: sin / hans', 'drill', '', ''],
    ['DrillPronomen.pdf', 'Drill: Pronomen', 'Тренировка: местоимения', 'drill', '', ''],
    ['DrillPreposisjoner.pdf', 'Drill: Preposisjoner', 'Тренировка: предлоги', 'drill', '', ''],
    ['DrillSporreord.pdf', 'Drill: Spørreord', 'Тренировка: вопросительные слова', 'drill', '', ''],
    ['DrillSprLeddsetning.pdf', 'Drill: Indirekte spørsmål', 'Тренировка: косвенный вопрос', 'drill', '', ''],
    ['DrillOrdpar1.pdf', 'Drill: Ordpar 1', 'Тренировка: пары слов 1', 'drill', '', ''],
    ['DrillOrdpar2.pdf', 'Drill: Ordpar 2', 'Тренировка: пары слов 2', 'drill', '', ''],
    ['DrillViktigeOrd.pdf', 'Drill: Viktige ord', 'Тренировка: важные слова', 'drill', '', ''],
    ['FlashVerb.pdf', 'Flashkort: verb', 'Карточки: глаголы', 'drill', '', ''],
    ['OppgaverVerb.pdf', 'Oppgaver: verb', 'Упражнения: глаголы (с ответами)', 'drill', '', ''],
    ['OppgaverNomen.pdf', 'Oppgaver: substantiv og adjektiv', 'Упражнения: существительные и прилагательные', 'drill', '', ''],
    ['OppgaverPronomen.pdf', 'Oppgaver: pronomen', 'Упражнения: местоимения', 'drill', '', ''],
    ['OppgaverPreposisjoner.pdf', 'Oppgaver: preposisjoner', 'Упражнения: предлоги', 'drill', '', ''],
    ['OppgaverSyntaks.pdf', 'Oppgaver: setninger og tekst', 'Упражнения: предложения и текст', 'drill', '', ''],
  ].map(([file, no, ru, group, trig, wc]) => ({ file, no, ru, group, trig: trig ? trig.split(' ').map(w => w.replace(/_/g, ' ')) : [], wc: wc ? wc.split(' ') : [] }));
  const byFile = Object.fromEntries(T.map(t => [t.file, t]));

  const LET = 'a-zæøåäöüéèáàóôò';
  const norm = s => String(s || '').toLowerCase().replace(/[«»"“”„()[\]{}.,;:!?…]/g, ' ').replace(/\s+/g, ' ').trim();
  const wordRe = w => new RegExp(`(^|[^${LET}])${U.escapeRegExp(w)}(?=[^${LET}]|$)`, 'i');
  // small words that are in almost every topic: not a reason to show / find a line when the card has other words
  const STOP = new Set(['en', 'ei', 'et', 'å', 'seg', 'de', 'det', 'den', 'i', 'på', 'til', 'av', 'med', 'for', 'om', 'har', 'er', 'og', 'som', 'at']);
  const url = t => BASE + 'pdf/' + t.file;
  const cacheKey = f => 'gk1:' + f;
  async function pool(items, fn, n = 4) {
    let k = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (k < items.length) { const i = k++; await fn(items[i], i); } }));
  }

  const Grammar = {
    TOPICS: T, GROUPS, AUTHOR,
    url,
    /** words of the card's Norwegian side (+ its forms) */
    words(card) {
      const main = norm(String(card.no).split('\n')[0]);
      const forms = (card.forms || []).map(f => norm(f.no)).filter(Boolean);
      const all = [main, ...forms].join(' ');
      return { main, text: ' ' + all + ' ', list: [...new Set(all.split(' ').filter(w => w.length > 1 || w === 'å'))] };
    },
    /** topics that fit the card, best first, each with the reason */
    match(card) {
      const w = this.words(card);
      const wc = String(card.wordClass || '').toLowerCase();
      const first = w.main.split(' ')[0];
      const out = [];
      T.forEach(t => {
        let score = 0; const why = [];
        t.trig.forEach(tr => {
          if (tr === 'å' || tr === 'en' || tr === 'ei' || tr === 'et' || tr === 'den' || tr === 'det' || tr === 'de') {
            // articles and «å» only count when they open the card (en bil, å snakke)
            // «en» opens a noun (en bil) — it says nothing about «man»/numbers topics
            if (first === tr && w.main.includes(' ') && (t.group === 'noun' || !['en', 'ei', 'et'].includes(tr))) { score += 6; why.push(tr); }
            return;
          }
          if (w.text.includes(' ' + tr + ' ')) {
            // a small word inside a longer phrase (har lyst til → «har», «til») says little about the topic
            const minor = STOP.has(tr) && w.main.includes(' ') && w.main !== tr;
            score += tr.includes(' ') ? 14 : minor ? 3 : 10; why.push(tr);
            // «X eller Y?» topics are the most specific when the card is exactly one of their words
            if (t.group === 'pair' && w.main === tr) score += 4;
          }
        });
        if (wc && t.wc.some(x => wc.startsWith(x))) { score += 5; why.push(wc); }
        // patterns: «å …» = verb, «en/ei/et …» = noun, «… seg» = reflexive, «-s» after å = s-verb
        if (first === 'å' && t.group === 'verb' && ['Verb.pdf', 'VerbLita.pdf'].includes(t.file)) { score += 4; why.push('глагол'); }
        if (['en', 'ei', 'et'].includes(first) && ['Substantiv.pdf', 'BestemtUbestemt.pdf'].includes(t.file)) { score += 4; why.push('существительное'); }
        if (first === 'et' && t.file === 'Noytrum.pdf') { score += 6; why.push('средний род'); }
        if (first === 'å' && /s$/.test(w.main.split(' ')[1] || '') && t.file === 'SVerb.pdf') { score += 8; why.push('глагол на -s'); }
        if (/(^| )seg( |$)/.test(w.main) && t.file === 'RefleksiveVerb.pdf') { score += 6; }
        if (t.group === 'drill') score = Math.min(score, 4); // exercises after the explanations
        if (score) out.push({ t, score, why: [...new Set(why)] });
      });
      return out.sort((a, b) => b.score - a.score).slice(0, 10);
    },

    /* ---------- reading a topic (PDF → lines → paragraphs) ---------- */
    async load(t) {
      try { const c = localStorage.getItem(cacheKey(t.file)); if (c) return JSON.parse(c); } catch (e) { /* no cache */ }
      if (!(window.AI && AI.bridge && AI.bridge.up)) throw Object.assign(new Error('nobridge'), { nobridge: true });
      const r = await fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: url(t), method: 'GET' }) });
      if (!r.ok) {
        let msg = `сайт ответил ${r.status}`;
        try { const j = await r.json(); if (j.error) msg = j.error; } catch (e) { /* pdf */ }
        if (/не разрешён/.test(msg)) msg = 'мост на Mac старой версии — перезапустите его, чтобы открыть grammatikk.com';
        throw new Error(msg);
      }
      return this.parsePdf(await r.arrayBuffer(), t);
    },
    /** a PDF the user downloaded from the site and picked here (works without the bridge — phone, GitHub version) */
    async loadFile(file, t) {
      if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) throw new Error('Это не PDF — выберите файл темы, скачанный с grammatikk.com');
      return this.parsePdf(await file.arrayBuffer(), t);
    },
    async parsePdf(buf, t) {
      const pdf = await (await U.lib.pdf()).getDocument({ data: new Uint8Array(buf) }).promise;
      const lines = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const tc = await (await pdf.getPage(p)).getTextContent();
        const rows = [];
        tc.items.forEach(it => {
          if (!it.str) return;
          const y = Math.round(it.transform[5]), x = it.transform[4];
          let row = rows.find(r => Math.abs(r.y - y) <= 2);
          if (!row) { row = { y, items: [] }; rows.push(row); }
          row.items.push({ x, w: it.width || 0, s: it.str });
        });
        rows.sort((a, b) => b.y - a.y).forEach(r => {
          r.items.sort((a, b) => a.x - b.x);
          let s = '', end = null;
          r.items.forEach(i => { if (end !== null && i.x - end > 1.5 && !/\s$/.test(s) && !/^\s/.test(i.s)) s += ' '; s += i.s; end = i.x + i.w; });
          lines.push(s.replace(/\s+/g, ' ').trim());
        });
      }
      const paras = this.paragraphs(lines, t);
      try { localStorage.setItem(cacheKey(t.file), JSON.stringify(paras)); } catch (e) { /* storage full — fine */ }
      return paras;
    },
    /** wrapped PDF lines -> paragraphs; footer/header lines removed; short title-like lines become headings */
    paragraphs(lines, t) {
      const title = (t.no || '').toLowerCase();
      const clean = lines.filter(l => l && !/grammatikk\.com|©/i.test(l) && !/\|\s*\d+\s*$/.test(l) && !/^[\s￼]*$/.test(l) && !/^\d+\s*\/\s*\d+$/.test(l));
      const out = [];
      clean.forEach((l, i) => {
        const isHead = l.length < 48 && !/[.!?:,;=]$/.test(l) && /^[A-ZÆØÅ0-9«"]/.test(l) && l.split(' ').length <= 7 && !/[.!?]\s/.test(l);
        const prev = out[out.length - 1];
        if (i === 0 && l.toLowerCase().replace(/[^a-zæøå ]/g, '').trim() === title.replace(/[^a-zæøå ]/g, '').trim()) return; // the PDF's own title
        if (/^[A-ZÆØÅ\s?!–-]{4,}$/.test(l) && i < 2) return; // UPPERCASE title
        const cont = prev && prev.k === 'p' && (/^[a-zæøå(,–"“«-]/.test(l) || /[,–-]$/.test(prev.t)) && !/[.!?:]["»”)]*$/.test(prev.t);
        if (cont) prev.t += (/[a-zæøå]-$/.test(prev.t) && /^[a-zæøå]/.test(l) ? '' : ' ') + l; // «Modal-» + «verbene»
        else out.push({ k: isHead && !(prev && prev.k === 'p' && /[,]$/.test(prev.t)) ? 'h' : 'p', t: l });
      });
      return out.filter(p => p.t.length > 1);
    },
    /** paragraphs that mention the card's words (with the heading above each) */
    relevant(paras, card) {
      const w = this.words(card);
      // «har lyst til» → look for «lyst», not for every «har»/«til» in the topic
      const key = w.list.filter(x => !STOP.has(x));
      const res = (key.length ? key : w.list).map(wordRe);
      if (!res.length) return [];
      const keep = new Set();
      paras.forEach((p, i) => {
        if (p.k === 'p' && res.some(r => r.test(p.t))) {
          keep.add(i);
          for (let j = i - 1; j >= 0 && j >= i - 6; j--) if (paras[j].k === 'h') { keep.add(j); break; }
        }
      });
      return [...keep].sort((a, b) => a - b).slice(0, 24);
    },

    /* ---------- window ---------- */
    /** opts.write(block, marker, translatedBy): the card editor is open — the topic goes into its form */
    open(card, opts = {}) {
      this._opts = opts;
      if (card && !opts.write) card = Store.card(card.id) || card;
      const found = card ? this.match(card) : [];
      const word = card ? String(card.no).split('\n')[0].slice(0, 60) : '';
      const bridge = !!(window.AI && AI.bridge && AI.bridge.up);
      const groups = Object.entries(GROUPS).map(([g, name]) => `<details class="gk-group"><summary>${name} <span class="muted small">${T.filter(t => t.group === g).length}</span></summary>
        <div class="gk-list">${T.filter(t => t.group === g).map(t => this.topicBtn(t)).join('')}</div></details>`).join('');
      const m = UI.modal({
        title: '📐 Грамматика · grammatikk.com', cls: 'wide gk-modal',
        body: `<div class="lib-intro">📐 <span>Бесплатные материалы по грамматике норвежского от <b>${AUTHOR}</b> (grammatikk.com). ${word ? `Подобрано к «<b>${U.esc(word)}</b>»: нажмите тему — увидите объяснение с переводом на русский и сможете добавить нужное в карточку.` : 'Выберите тему.'}</span></div>
          ${!bridge ? '<div class="mt-warn"><span>ℹ️</span><span>Сайт не даёт приложению прочитать PDF напрямую — тема откроется для чтения здесь же. <b>Перевод на русский и «В карточку»</b> работают, когда запущен мост на Mac (в облачной версии будет работать само).</span></div>' : ''}
          ${card ? `<div class="gk-sec">${found.length ? `К этой карточке подходят:` : 'Для этого слова нет отдельной темы — посмотрите список ниже'}${bridge ? ` <button class="btn sm ghost" data-gk-search title="Скачать все темы и найти, где встречается это слово (первый раз ~1 минута, потом мгновенно)">🔍 Найти «${U.esc(word.slice(0, 24))}» во всех темах</button>` : ''}</div>
          <div class="gk-list" data-found>${found.map(f => this.topicBtn(f.t, f.why)).join('')}</div>` : ''}
          <div class="gk-reader" data-reader hidden></div>
          <div class="gk-sec">Все темы <input class="input gk-filter" data-gk-filter placeholder="Поиск темы: verb, mye, предлоги…"></div>
          <div data-groups>${groups}</div>
          <div class="tiny muted" style="margin-top:10px">Тексты: grammatikk.com © ${AUTHOR} — «Alle dokumentene kan lastes ned og skrives ut gratis». В карточку попадают только нужные строки со ссылкой на автора и сайт.</div>`,
      });
      m.el.addEventListener('click', async e => {
        const tb = e.target.closest('[data-gk]');
        if (tb) { e.preventDefault(); this.show(m, byFile[tb.dataset.gk], card); return; }
        const say = e.target.closest('[data-gsay]'); if (say) { TTS.speak(say.dataset.gsay, say.dataset.lang || 'no'); return; }
        const act = e.target.closest('[data-gka]'); if (act) this.action(m, act.dataset.gka, card, act);
        if (e.target.closest('[data-gk-search]')) this.searchAll(m, card, e.target.closest('[data-gk-search]'));
      });
      m.$('[data-gk-filter]').addEventListener('input', e => {
        const q = norm(e.target.value);
        m.$$('.gk-group').forEach(g => {
          let n = 0;
          g.querySelectorAll('[data-gk]').forEach(b => { const t = byFile[b.dataset.gk]; const ok = !q || norm(`${t.no} ${t.ru} ${t.trig.join(' ')} ${t.file}`).includes(q); b.hidden = !ok; if (ok) n++; });
          g.hidden = !n; g.open = !!q && n > 0;
        });
      });
      if (found.length && found[0].score >= 10) this.show(m, found[0].t, card);
      return m;
    },
    topicBtn(t, why) {
      return `<button class="gk-topic" data-gk="${t.file}" title="${U.esc(t.no)}"><b>${U.esc(t.ru)}</b><span class="small muted">${U.esc(t.no)}</span>${why && why.length ? `<span class="gk-why">${why.slice(0, 4).map(w => U.esc(w)).join(', ')}</span>` : ''}</button>`;
    },
    /** show one topic: relevant part first, translated; or the PDF itself without the bridge */
    async show(m, t, card) {
      const box = m.$('[data-reader]');
      box.hidden = false;
      m.$$('[data-gk]').forEach(b => b.classList.toggle('active', b.dataset.gk === t.file));
      const head = `<div class="gk-head"><div><b>${U.esc(t.no)}</b><div class="small muted">${U.esc(t.ru)} · © ${AUTHOR}</div></div>
        <a class="btn sm" href="${url(t)}" target="_blank" rel="noopener">↗ PDF на сайте</a></div>`;
      box.innerHTML = head + '<div class="small muted"><span class="spinner sm"></span> Загружаю тему…</div>';
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this._cur = { t, card, paras: null, tr: {}, by: [], full: false };
      let paras;
      try { paras = await this.load(t); } catch (e) {
        if (this._cur.t !== t) return;
        // the app can't read the PDF by itself: show it, and offer to pick the downloaded file → translate → card
        box.innerHTML = head + `<div class="mt-warn"><span>${e.nobridge ? 'ℹ️' : '⚠️'}</span><span>${e.nobridge ? 'Сайт не даёт приложению прочитать тему напрямую.' : U.esc(e.message) + '.'}
            Чтобы <b>перевести тему и перенести её в карточку</b>: ${e.nobridge ? 'запустите мост на Mac — или' : 'перезапустите мост (в Терминале: <code>python3 bridge/server.py</code>) — или'}
            нажмите «↗ PDF на сайте», скачайте файл и выберите его здесь:</span></div>
          <label class="btn primary gk-file">📄 Выбрать скачанный PDF — перевести и перенести<input type="file" accept="application/pdf,.pdf" hidden data-gk-file></label>
          <iframe class="gk-pdf" src="${url(t)}" title="${U.esc(t.no)}"></iframe>`;
        box.querySelector('[data-gk-file]').addEventListener('change', async ev => {
          const f = ev.target.files[0]; if (!f) return;
          try {
            const p = await this.loadFile(f, t);
            try { localStorage.setItem(cacheKey(t.file), JSON.stringify(p)); } catch (err) { /* full */ }
            if (this._cur.t !== t) return;
            this.ready(m, t, card, p);
          } catch (err) { UI.toast(err.message, 'warn', 5000); }
        });
        return;
      }
      if (this._cur.t !== t) return;
      await this.ready(m, t, card, paras);
    },
    async ready(m, t, card, paras) {
      this._cur.paras = paras;
      const rel = card ? this.relevant(paras, card) : [];
      this._cur.rel = rel;
      this._cur.full = !rel.length;
      await this.render(m);
    },
    visible() {
      const c = this._cur;
      return c.full ? c.paras.map((p, i) => i) : c.rel;
    },
    async render(m, retranslate) {
      const c = this._cur; if (!c || !c.paras) return;
      const box = m.$('[data-reader]');
      const idx = this.visible();
      const word = c.card ? String(c.card.no).split('\n')[0].slice(0, 40) : '';
      const draw = loading => {
        const trNames = c.by.map(id => id === 'ai' ? AI.name(Translators.lastAI) : (Translators.LIST[id] || {}).name || id).join(' + ');
        box.innerHTML = `<div class="gk-head"><div><b>${U.esc(c.t.no)}</b><div class="small muted">${U.esc(c.t.ru)} · © ${AUTHOR}</div></div>
            ${trNames ? `<span class="chip">перевод: ${U.esc(trNames)}</span>` : ''}</div>
          ${c.card && c.rel.length ? `<div class="seg-mini"><button class="${c.full ? '' : 'active'}" data-gka="part">📌 Про «${U.esc(word)}» (${c.rel.length})</button><button class="${c.full ? 'active' : ''}" data-gka="full">📄 Вся тема (${c.paras.length})</button></div>` : ''}
          ${c.card && !c.rel.length ? `<div class="small muted">В этой теме нет строк со словом «${U.esc(word)}» — показана вся тема.</div>` : ''}
          <div class="gk-text">${idx.map(i => { const p = c.paras[i]; const ru = c.tr[i];
            return p.k === 'h' ? `<h4 class="gk-h">${U.esc(p.t)}${ru ? ` <span class="gk-ru">(${U.esc(ru)})</span>` : ''}</h4>`
              : `<div class="gk-p"><div class="gk-no">${U.esc(p.t)} <button class="icon-btn sm" data-gsay="${U.esc(p.t)}" title="Произнести">🔊</button></div>${ru ? `<div class="gk-ru">${U.esc(ru)}</div>` : loading ? '<div class="gk-ru muted">…</div>' : ''}</div>`; }).join('')}</div>
          <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:8px">
            ${c.card ? `<button class="btn sm primary" data-gka="add-all" title="Перевести всю тему и перенести её в карточку целиком — читать, понимать и учить новые слова">📥 Вся тема в карточку с переводом (${c.paras.length})</button>` : ''}
            ${c.card && !c.full ? `<button class="btn sm" data-gka="add" ${loading ? 'disabled' : ''}>➕ Только про «${U.esc(word)}»</button>` : ''}
            <button class="btn sm" data-gka="copy">📋 Копировать</button>
            ${Listen.hereBtn('.gk-text', 'Грамматика · ' + c.t.no, 'Слушать')}
            <a class="btn sm" href="${url(c.t)}" target="_blank" rel="noopener">↗ PDF на сайте</a>
          </div>
          ${Translators.machineWarnHtml(c.by, false)}`;
      };
      const need = idx.filter(i => !c.tr[i]);
      draw(need.length > 0);
      if (!need.length && !retranslate) return;
      try {
        const res = await Translators.translateMany(need.map(i => c.paras[i].t), 'no', 'ru');
        if (this._cur !== c) return;
        need.forEach((i, k) => { if (res.out[k]) c.tr[i] = res.out[k]; });
        c.by = [...new Set([...c.by, ...res.by])];
        if (res.missing) UI.toast(`Не удалось перевести ${res.missing} — переводчики сейчас не отвечают`, 'warn');
        // the source and the translator light up on the card (who worked on it)
        // once per topic and translator for this card — switching views must not fill the history with repeats
        this._logged = this._logged || new Set();
        const fresh = Translators.provKeys(res.by).filter(k => !this._logged.has(`${c.card && c.card.id}|${c.t.file}|${k}`));
        const first = !this._logged.has(`${c.card && c.card.id}|${c.t.file}`);
        if (c.card && !this._opts.write && Store.card(c.card.id) && (first || fresh.length)) {
          this._logged.add(`${c.card.id}|${c.t.file}`);
          fresh.forEach(k => this._logged.add(`${c.card.id}|${c.t.file}|${k}`));
          Prov.log(c.card.id, ...(first ? [Prov.entry('tr:grammatikk', 'verify', null, `тема «${c.t.no}» (${c.t.ru})`)] : []),
            ...fresh.map(k => Prov.entry(k, 'translate', null, `перевёл тему grammatikk.com «${c.t.no}» на русский`)));
          if (window.Study && Study.current && Study.current() && Study.refreshBadges) Study.refreshBadges();
        }
      } catch (e) { UI.toast('Перевод: ' + e.message, 'warn'); }
      draw(false);
    },
    /** text block for the card: no blank lines (the card's blocks are separated by empty lines) */
    toText(c, idx) {
      const lines = [`📐 Grammatikk.com · «${c.t.no}» (${c.t.ru}) — © ${AUTHOR}, ${url(c.t)}`];
      idx.forEach(i => { const p = c.paras[i]; const ru = c.tr[i];
        lines.push(p.k === 'h' ? `▸ ${p.t}${ru ? ` (${ru})` : ''}` : `   • ${p.t}${ru ? ` (${ru})` : ''}`); });
      return lines.join('\n');
    },
    async action(m, a, card, btn) {
      const c = this._cur; if (!c) return;
      if (a === 'part' || a === 'full') { c.full = a === 'full'; this.render(m); return; }
      const idx = this.visible();
      if (a === 'copy') {
        try { await navigator.clipboard.writeText(this.toText(c, idx)); UI.toast('Скопировано', 'good'); } catch (e) { UI.toast('Не удалось скопировать', 'warn'); }
        return;
      }
      if (a === 'add-all' && card) {
        // the whole topic: translate every line that has no translation yet, then put it all into the card
        const all = c.paras.map((p, i) => i);
        const need = all.filter(i => !c.tr[i]);
        if (need.length) {
          if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner sm"></span> перевожу всю тему: ${need.length} строк…`; }
          try {
            const res = await Translators.translateMany(need.map(i => c.paras[i].t), 'no', 'ru');
            need.forEach((i, k) => { if (res.out[k]) c.tr[i] = res.out[k]; });
            c.by = [...new Set([...c.by, ...res.by])];
          } catch (e) { UI.toast('Перевод: ' + e.message, 'warn'); }
        }
        c.full = true;
        await this.render(m);
        return this.addBlock(m, c, card, all, m.$('[data-gka="add-all"]'));
      }
      if (a === 'add' && card) return this.addBlock(m, c, card, idx, btn);
    },
    /** put these lines (with translations) into the card: source, translator, «перепроверьте» flag, history */
    async addBlock(m, c, card, take, btn) {
      {
        if (take.some(i => !c.tr[i] && c.paras[i].k === 'p') && !(await UI.confirm('Часть строк ещё без перевода (переводчик не ответил). Добавить так?', { ok: 'Добавить' }))) return;
        const block = this.toText(c, take);
        if (this._opts.write) {
          this._opts.write(block, `📐 Grammatikk.com · «${c.t.no}»`, c.by);
          UI.toast(`📐 Тема «${c.t.ru}» вставлена в описание — нажмите «Сохранить»`, 'good', 4500);
          m.close();
          return;
        }
        const fresh = Store.card(card.id); if (!fresh) return;
        const desc = Ordbok.mergeBlock(fresh.description, `📐 Grammatikk.com · «${c.t.no}»`, block);
        const via = c.by.map(id => id === 'ai' ? AI.name(Translators.lastAI) : (Translators.LIST[id] || {}).name || id).join(' + ') || 'без перевода';
        const warn = Translators.mtFlag(c.by);
        Store.updateCard(card.id, {
          description: desc, ...(warn ? { mtWarn: warn } : {}),
          history: Prov.add(fresh, Prov.entry('tr:grammatikk', 'explain', { description: { old: '', new: block } }, `грамматика: «${c.t.no}» с переводом (${via})`),
            ...Translators.provKeys(c.by).map(k => Prov.entry(k, 'translate', null, `перевёл тему grammatikk.com «${c.t.no}»`))),
        });
        UI.toast(`📐 Тема «${c.t.ru}» добавлена в карточку (${take.length} строк) ✓${warn ? ' · ⚠️ перевод машинный — перепроверьте' : ''}`, 'good', 4500);
        if (btn) { btn.disabled = true; btn.textContent = '✓ Добавлено'; }
        if (window.Study && Study.current && Study.current() && Study.current().card.id === card.id) { Study.renderCard(false); Study.flip(true); }
        else if (App.view.name !== 'study') App.render();
      }
    },
    /** 🔍 full-text: every topic (cached after the first time), where does the word occur */
    async searchAll(m, card, btn) {
      const w = this.words(card);
      let key = w.list.filter(x => x.length > 1 && !STOP.has(x));
      if (!key.length) key = w.list.filter(x => x.length > 1 && !['en', 'ei', 'et', 'de', 'det', 'den', 'seg'].includes(x));
      const res = key.map(wordRe);
      if (!res.length) { UI.toast('Нечего искать', 'warn'); return; }
      btn.disabled = true;
      const list = T.filter(t => t.group !== 'drill' && !/^(Nouns|Definite|Sentences|GrammarTerminology|Ordboktips|Konsonanter|Vokaler|Vokallengde|Spelling|Trykk|Capital)\.pdf$/.test(t.file));
      const hits = []; let done = 0;
      await pool(list, async t => {
        try {
          const paras = await this.load(t);
          const n = paras.filter(p => res.some(r => r.test(p.t))).length;
          if (n) hits.push({ t, n });
        } catch (e) { /* skip */ }
        done++; btn.innerHTML = `<span class="spinner sm"></span> ${done}/${list.length}`;
      }, 4);
      btn.innerHTML = `🔍 Найдено тем: ${hits.length}`;
      hits.sort((a, b) => b.n - a.n);
      const box = m.$('[data-found]');
      const have = new Set([...box.querySelectorAll('[data-gk]')].map(b => b.dataset.gk));
      box.insertAdjacentHTML('beforeend', hits.filter(h => !have.has(h.t.file)).slice(0, 20).map(h => this.topicBtn(h.t, [`встречается ${h.n}×`])).join(''));
      if (!hits.length) UI.toast('В темах grammatikk.com это слово не встречается', 'warn');
    },
  };

  window.Grammar = Grammar;
})();
