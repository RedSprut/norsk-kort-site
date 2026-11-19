/* ============ 🌐 Язык строки и музыка: что переводить в субтитрах ============
 * На радио и ТВ NRK звучат песни (часто на английском), а распознавание речи (NB-Whisper, язык зафиксирован «no»)
 * превращает их в мусорные строки. Здесь каждая строка получает метку языка и «музыка / песня», чтобы плеер
 * субтитров (js/subs.js) не тратил на них лимит переводчика и не путал ученика.
 *
 * Выбор (см. отчёт): маленький офлайн-определитель «высокой точности», без сети и без библиотек.
 *  - franc-min (n-граммы) на коротких строках путает nb / da / sv / nn и даже en, и тянул бы модуль с CDN; Whisper
 *    сам язык не определяет — ему задан «no» (без этого NB-Whisper хуже распознаёт норвежский, а отдельный проход
 *    определения языка стоит ещё один запуск декодера).
 *  - Поэтому: служебные и частые слова каждого языка + орфография (æøå / äöüß / апострофы английского / -ght…).
 *    Сравнение ПАРАМИ «изучаемый язык ↔ другой»: считаются только слова, которых нет в списке другого языка
 *    (общие «for», «at», «to», «i», «man» не решают ничего). Строка помечается чужой, только когда чужих слов
 *    достаточно (≥ 2) и они явно перевешивают норвежские; иначе — норвежская. Смешанная строка
 *    («All we were old, var det med …») остаётся норвежской: в ней есть что учить.
 *  - Короткая неоднозначная строка сразу после английской (≤ 15 с) тоже английская, если в ней нет ни одного
 *    норвежского признака (продолжение песни: «Oh baby», «Tonight»).
 *  - Музыка: ♪ / [Musikk] / (musikk) / «la la la», типичные «галлюцинации» Whisper на музыке («Teksting av …»,
 *    «Takk for at du så på») — только для распознанных строк; плюс звуковая подсказка из плеера (asr: music).
 * Обобщение: изучаемый язык — Store.settings.learnLang или 'no'; «близкие» (sv, da для no) помечаются, но переводятся.
 */
(function () {
  const W = (s, w = 1) => { const m = new Map(); s.trim().split(/\s+/).forEach(x => { const [k, v] = x.split(':'); m.set(k, v ? +v : w); }); return m; };

  /* Norwegian (bokmål + nynorsk): function words and very common words. Shared words cancel out pair by pair. */
  const NO = W(`og i er det som en et ei på til med av for ikke ikkje jeg eg du han hun ho vi me dere de dei den dette disse desse
    har hadde hatt var vært vore være vere skal skulle vil ville kan kunne må måtte blir ble blei vart bli blitt få fått fikk gjør gjorde
    gjort gjere sier sa si seier går gikk kom kommer kjem komme ser såg så nå da når om at fra frå etter før under over mot uten utan hos hjå
    ved mellom gjennom også òg men eller fordi hvis viss dersom hva kva hvem kven hvor kor hvordan korleis hvorfor kvifor hvilken
    noe noko noen nokon ingen ingenting alt alle mye mykje mange litt lite mer meir mest veldig svært bare berre helt heilt ganske kanskje
    jo vel nok altså egentlig eigentleg liksom sånn slik her der dit hit hjem heim hjemme ut inn opp ned bort igjen att alltid aldri ofte
    meg deg seg oss dem henne ham min din sin mitt ditt sitt mine dine sine vår våre deres hans hennes hennar takk hei ja nei
    tror trur synes syns vet veit liker snakke snakker sammen saman mennesker folk norge noreg norsk dag dager år tid kveld morgen
    godt bra fint flott stor store liten små ny nye gammel gamle første siste andre neste annen hele heile eget egen eit ein
    sjå seie gje gi gitt tatt ta tar lage laget hjelpe trenger trengs bruke bruker finnes fins skje skjedde akkurat ganske sikkert
    kjempe kjære skjønner forstår prøve prøver begynne begynner jobb jobbe skole barn unger venner venn livet mener betyr
    regjeringen kommunen fylket landet byen været nyheter nyhetene klokka klokken hverandre kvarandre etterpå dessuten derfor
    hvert hver kvar kvart enn enda ennå heller skulle burde bør nemlig visst jammen joda neida jaha nettopp
    får tar gir står ligger sitter heter bor hører leser skriver spiser kjører fremover kommune fylke
    ska sku va ka æ mæ dæ sæ hu dæm itj ittj by land hus mann vann mat tur ting`);

  /* English: function words and common (song) words. Words that are also common Norwegian words are left out or
   * get weight 0.5 («is» = is, «it», «in», «my» = mygg, «me» = nynorsk «we», «so», «do» = toilet, «oh» = å). */
  const EN = W(`the and you your yours you're i'm i've i'll i'd it's that's what's there's don't can't won't didn't doesn't isn't
    aren't wasn't weren't couldn't wouldn't shouldn't let's we're they're we'll we've you'll you've he's she's
    are was were been being have has had does did will would could should shall might must
    this that these those what when where why how who whom which whose
    we they them their theirs our ours us she he him his her hers
    of with from into onto about without through around because cause though although if then than but not
    never ever forever always nothing something anything everything everybody somebody nobody anyone everyone
    just only still yet again already also too very really much many more most some any every each
    love baby heart feel feeling night tonight light right fight high know knew known think thought want wanna gonna gotta
    need make made take took get got give gave go going gone come coming came say said tell told see saw seen look looking
    let way day away down out up back off over there here now today tomorrow yesterday
    girl boy world life live dream dreams eyes hold hands kiss sky fire rain sun shine shining burning heaven soul mind
    one two three yeah yes:0.5 please thank thanks:0.7 sorry:0.5 hello:0.5 goodbye
    little big good bad new old young long last first same other own
    people man woman friend friends home house place thing things
    such like as an a:0.6 am at:0 be:0.3 by:0 for:0 is:0.5 it:0.5 in:0.5 my:0.6 me:0.6 so:0.5 do:0.5 to:0 on:0.8 oh:0.5 no:0.3 all:0 or:0.8`);

  /* Swedish */
  const SV = W(`och inte jag är att som på för med av till det den en ett de vi ni hon han sig mig dig oss dem deras hennes hans
    vad hur varför när också mycket kanske bara efter från nu här där inget ingen något någon några sådan själv skulle ska kommer
    vara varit blir blev får fick gör gjorde säger sa tack hej ja nej men eller om så än även över under mellan utan hos vid genom
    min din sin mitt ditt sitt våra vår era alla allt mer mest lite väldigt jätte idag igår tillbaka kväll säga göra finns fanns
    honom bättre någonting ingenting sedan sen alltså också borde måste kunde ville hade har du mot kan i hem dag år tid
    många lätt böcker flicka gång varje hände huvudstad bästa vän nästa vecka låter menar tycker mår igen sjön åkte somras
    prata hjälpa hjälp jobbat dags jättekul sakna leker heter liten bott beslutat höja kostar ifrån förstår också någon`);

  /* Danish */
  const DA = W(`og i er det som en et på til med for ikke jeg du han hun vi de den der dem
    mig dig sig hvad nu efter af lidt bliver blev siger gør gjorde noget nogen nogle sådan tak hej nej ja lige ud op havde har været
    være kunne skulle ville får fik gik kom går ser så når hvor hvordan hvorfor hvem hvilken eller men fordi hvis om
    mod uden hos ved mellem gennem før under over igen altid aldrig måske rigtig rigtigt godt dag år hjem mange mere meget:0.5 ingen
    intet alting alle alt synes tror snakke sammen mennesker folk danmark dansk københavn jo nok vel da bare kun:0.3 også
    selv sgu altså jer jeres hende vores blevet gået spørge købe tage sige gøre kigge børn kvinde mand hvornår derfor
    skal kan vil har du mit min din sin hus by tid mener forstår snakke spise
    tilbage udenfor ude hedder kende kender arbejde arbejder sjovt veninde lyder mødes næste sidste bedste nødt søen bøger
    koldt dejlig dejligt øjne vej hjælpe hjælp besluttet hæve lignende boet sagde`);

  /* German */
  const DE = W(`und ich nicht ist das die der den ein eine einen zu mit sie wir es auf für von sich auch aber wie was wenn noch nur
    schon bei aus nach dem des bin sind war waren haben hat wird werden kann können mein meine dein sein über oder weil dass
    sehr jetzt hier heute wieder immer nichts etwas mehr nein gibt zum zur im vom wo warum wer euch uns ihr ihm ihn
    gut danke bitte liebe mich dich doch mal du mir dir bist machst kannst einem einer kleinen gesagt haus wohnt seit jahren
    gefahren schön vielen dank wochenende kinder garten spielen wirklich idee keine zeit alles andere würde tun spät helfen`);

  const PROF = { no: NO, en: EN, sv: SV, da: DA, de: DE };
  /* Norway's neighbours share most words: against them only words that are clearly NOT Swedish / Danish count for
   * Norwegian (otherwise «kommer», «hun», «ikke» would outvote a Danish line every time) */
  const VS = {
    'no>sv': W(`ikke ikkje jeg eg hva kva nå etter litt sier gjør gjorde gjort noe noko noen nokon sånn takk hei opp meg deg seg mye mykje
      bare berre kanskje hvorfor kvifor hvordan korleis hvem kven hvor kor hvis viss når fra frå også òg dere dei hun ho ham skal vil være
      vere vært hadde ble blei fikk gikk mange igjen aldri veldig sammen saman mellom gjennom uten utan ved og er nei før gammel første
      siste neste annen hele kveld morgen skole venner mener betyr synes liker snakke snakker mennesker gjøre gjere gi hjelpe trenger
      bruke finnes akkurat kjempe kjære skjønner forstår prøve begynne unger hverandre kvarandre etterpå derfor hver enn ennå nettopp`),
    'no>da': W(`hva kva nå etter av litt blir sier gjør gjorde gjort noe noko noen nokon sånn takk hei ut opp meg deg seg mye mykje meir
      berre heilt frå mellom gjennom uten utan mot igjen alltid aldri kanskje riktig hjå heim ble blei vart fikk gikk hadde vært vore
      vere ikkje eg kven kor korleis kvifor ingenting henne dere dei veldig liksom slik ennå enda kjempe skjønner hverandre kvarandre
      etterpå unger klokka sjå seie gje gi tatt ta tar lage laget trenger skje skjedde siste neste annen tilbake hjelpe arbeid
      sjøen bøker kaldt ute`),
  };
  const NAMES = { no: 'норвежский', en: 'английский', sv: 'шведский', da: 'датский', de: 'немецкий', ru: 'русский', uk: 'украинский', xx: 'другой язык' };
  const NEAR = { no: ['sv', 'da'], sv: ['no', 'da'], da: ['no', 'sv'] };

  /* ---------- music ---------- */
  const NOTE = /[♪♫♬🎵🎶]/u;
  const MUSIC_WORD = /^(musikk|music|musik|musiikki|instrumental|instrumentalt|sang|song|singing|synger|applaus|applause|jubel|latter|laughter|lyd|stille|intro|outro)$/i;
  // whole-line «[Musikk]», «(musikk)», «* Musikk *», «[Music playing]»
  const MUSIC_TAG = /^[\s*([—-]*(musikk|music|musik|instrumental|sang|song|applaus|applause|jubel|latter|laughter)([\s\w]*)[\s*)\].!-]*$/i;
  // song vocables (a whole line of them = music without words)
  const VOC = new Set('la lala lalala na nana nanana da dada ba bam dum dumdum di do doo du dudu oh ooh oooh ohh uh uhh ah aah ahh mm mmm hmm hm yeah yeh hey ho hoo woah whoa wo wow eh ey ay ayy sha shalala yo'.split(' '));
  // Whisper's hallucinations on music / silence (recognized lines only — never NRK's own subtitles)
  const HALLU = [
    /^(norsk\s+)?(teksting|tekst(et)?|undertekst(er|ing)?|oversatt|oversettelse|subtitles?|captions?)\b.{0,40}\b(av|by|fra|:)/i,
    /^takk for at (du|dere) (så|ser|har sett) på[\s.!]*$/i,
    /^(thanks|thank you) for (watching|listening)/i,
    /amara\.org|www\.|https?:|\.(com|no|org)\b/i,
    /^(abonner|subscribe|lik og del|like and subscribe)/i,
    /^(teksting|undertekst)/i,
  ];

  function learn() {
    try { const s = window.Store && Store.settings && Store.settings.learnLang; if (s) return String(s); } catch (e) { /* not loaded */ }
    return 'no';
  }
  const translatable = (lang, L = learn()) => !lang || lang === L || (NEAR[L] || []).includes(lang);

  /** strip music marks; → { text without them, music (bool) } */
  function stripMusic(s) {
    let music = NOTE.test(s);
    const t = s.replace(/[♪♫♬🎵🎶#]+/gu, ' ').replace(/\s+/g, ' ').trim();
    return { t, music };
  }

  /** score text for language X against the learn language A → { x, a } (exclusive evidence only) */
  function pairScore(toks, A, X) {
    const PA = PROF[A], PX = PROF[X];
    let x = 0, a = 0;
    const seen = new Set();
    for (const k of toks) {
      const w = k.w;
      if (seen.has(w)) continue;
      seen.add(w);
      if (k.cap) { if (X === 'en' && w === 'i') x += 1; continue; } // a name in the middle of a line says nothing (except English «I»)
      const inA = PA.has(w), inX = PX.has(w), vs = VS[A + '>' + X];
      if (inX && !inA) x += PX.get(w);
      else if (vs ? vs.has(w) : inA && !inX) a += (vs || PA).get(w);
      else if (!inA && !inX) {
        // orthography of words in no list
        if (/[æø]/.test(w)) { if (A === 'no' && X !== 'da') a += 1; else if (X === 'da' && A !== 'no') x += 1; }
        if (/å/.test(w)) { if (A === 'no' && X !== 'da' && X !== 'sv') a += 1; }
        if (/[äö]/.test(w)) { if (X === 'sv' || X === 'de') x += 1; else if (A === 'no') a += 0; }
        if (/[üß]/.test(w) && X === 'de') x += 1;
        if (X === 'en') {
          if (/'(s|t|m|re|ll|ve|d)$/.test(w)) x += 0.8;
          else if (/ght/.test(w) || /^(th|wh)/.test(w) || /w/.test(w) && !/^w/.test(w)) x += 0.5;
          else if (/ou/.test(w) && w.length > 3) x += 0.3;
        }
        if (/tion$/.test(w) && X !== 'no') x += 0.5;           // Norwegian writes -sjon
        if (A === 'no' && /(sjon|skj|kj|gj)/.test(w)) a += 0.7;  // Norwegian spelling
        if (X === 'da' && /\w{3}hed(en|er)?$/.test(w)) x += 0.7; // frihed (no: frihet)
        if ((X === 'da' || X === 'sv') && /[eø]j/.test(w)) x += 0.5; // dejlig, vej, øjne (no: deilig, vei, øyne)
        // Danish writes æ where Norwegian has e (længe, forældre, glæder, læse) — except Norwegian's own æ-words
        if (X === 'da' && /æ/.test(w) && !/^(u?vær|lær|nær|u?ær|bær|sær|kjær|fæl|hær|væsk|tær|hæl|æsj|æra|ærm|ærend|sæt|gær|stær|mæ$|æ$)/.test(w)) x += 0.5;
      }
    }
    return { x, a };
  }

  function tokens(s) {
    const out = [];
    const re = /[\p{L}'’]+/gu; let m, last = 0;
    while ((m = re.exec(s))) {
      const first = last === 0 || /[.!?…:;–—"«»-]/.test(s.slice(last, m.index));
      last = m.index + m[0].length;
      const raw = m[0].replace(/’/g, "'").replace(/^'+|'+$/g, ''); if (!raw) continue;
      const w = raw.toLowerCase();
      // «I» at the start of a sentence may be Norwegian «I dag» — it says nothing; inside the line it is English
      if (raw === 'I' && first) continue;
      // a capitalized word inside the line is a name (Regina Bell) — except «I»; the first word is ordinary
      const cap = raw === 'I' || (!first && /^\p{Lu}/u.test(raw));
      out.push({ w, cap, raw });
    }
    return out;
  }

  /**
   * text → { lang, music, noWords, conf, why }
   *  opts.asr — a line recognized by the app (Whisper's music hallucinations count as music);
   *  opts.music — a hint from the sound (steady energy without pauses);
   *  opts.prev — { lang } of the line just before (≤ 15 s): continues a foreign song / talk on short ambiguous lines.
   */
  function detect(text, opts = {}) {
    const A = opts.learn || learn();
    const res = { lang: A, music: !!opts.music, noWords: false, conf: 0, why: '' };
    let s = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const sm = stripMusic(s); s = sm.t; if (sm.music) { res.music = true; res.why = '♪'; }
    if (!s || !/\p{L}/u.test(s)) { if (sm.music || opts.music || opts.asr) { res.noWords = true; res.music = true; res.why = res.why || 'нет слов'; } return res; }
    if (MUSIC_TAG.test(s)) { res.music = true; res.noWords = true; res.why = 'метка музыки'; return res; }
    if (opts.asr && HALLU.some(r => r.test(s))) { res.music = true; res.noWords = true; res.why = 'галлюцинация распознавания'; return res; }
    // whole line of «la la la», «oh oh oh», «na na na na»
    const words = s.toLowerCase().match(/\p{L}+/gu) || [];
    if (words.length >= 2 && words.every(w => VOC.has(w)) && (opts.asr || sm.music || words.length >= 3)) { res.music = true; res.noWords = true; res.why = 'распев'; return res; }
    // script: Cyrillic / other alphabets
    const letters = s.match(/\p{L}/gu) || [];
    const cyr = letters.filter(c => /\p{Script=Cyrillic}/u.test(c)).length, lat = letters.filter(c => /\p{Script=Latin}/u.test(c)).length;
    if (cyr > lat && cyr >= 3) { res.lang = /[іїєґ]|(^|[^\p{L}])(що|це|дякую|дуже|щоб|ще|вже|якщо|мене|тебе|він|вона|ми|ви|вони|але|та)(?=$|[^\p{L}])/iu.test(s) ? 'uk' : 'ru'; res.conf = 1; res.why = 'кириллица'; return res; }
    if (lat < letters.length * 0.5 && letters.length >= 3) { res.lang = 'xx'; res.conf = 1; res.why = 'другой алфавит'; return res; }
    if (!PROF[A]) return res; // no profile for this learn language: only the script decides
    const toks = tokens(s), n = toks.length;
    let best = null;
    for (const X of Object.keys(PROF)) {
      if (X === A) continue;
      const { x, a } = pairScore(toks, A, X);
      if (!best || x - a > best.x - best.a) best = { X, x, a };
    }
    if (!best) return res;
    const { X, x, a } = best;
    // high precision: enough foreign words, clearly more than the learn language's own, a real share of the line
    const near = (NEAR[A] || []).includes(X);
    // (a neighbour language is translated anyway — its tag is only a hint, so one clear word in a longer line is enough)
    const confident = near ? (x >= 2 && x >= 1.5 * a + 1) || (x >= 1 && a === 0 && n >= 4) : x >= 2 && x >= 2 * a + 1 && x / Math.max(1, n) >= 0.25;
    // a short leftover of a foreign song / talk (after a foreign line): no sign of the learn language at all
    const cont = !confident && opts.prev && opts.prev.lang === X && a === 0 && x >= 0.5 && n <= 6;
    if (confident || cont) {
      res.lang = X; res.conf = Math.min(1, (x - a) / 4); res.why = cont ? 'продолжение строки выше' : `${x.toFixed(1)} против ${a.toFixed(1)}`;
    } else { res.conf = a > 0 ? Math.min(1, a / 3) : 0; res.why = `${A}: ${a.toFixed(1)} · ${X}: ${x.toFixed(1)}`; }
    return res;
  }

  /* ---------- the sound: music or speech? ----------
   * Low-energy ratio (Scheirer & Slaney 1997): speech has many quiet moments between syllables / words (≈40–60 % of
   * 20 ms frames under half the mean energy), music has few (sustained notes, a steady beat). Cheap and robust enough as
   * a HINT only: the chip «♪» and the calm «🎵 Музыка» line; it never decides about translation by itself.
   * pcm — 16 kHz mono Float32Array (≥ 2 s) → { music, ler } */
  function audioHint(pcm, rate = 16000) {
    const F = Math.round(rate * 0.02), n = Math.floor((pcm && pcm.length || 0) / F);
    if (n < 100) return { music: false, ler: 1 };
    const E = new Float32Array(n); let sum = 0;
    for (let f = 0; f < n; f++) { let q = 0; for (let j = f * F; j < f * F + F; j += 2) q += pcm[j] * pcm[j]; E[f] = q / (F / 2); sum += E[f]; }
    const mean = sum / n; if (mean < 1e-6) return { music: false, ler: 1 };
    let low = 0; for (let f = 0; f < n; f++) if (E[f] < 0.5 * mean) low++;
    const ler = low / n;
    return { music: ler < 0.18, ler }; // NRK speech (Supernytt, music beds too): ≥ 0.23 on 2 s; a pop song on P3: median 0.13
  }

  window.LangId = {
    detect, audioHint, learn, translatable,
    /** «EN», «SV»… */
    code: l => String(l || '').toUpperCase(),
    name: l => NAMES[l] || NAMES.xx,
    _prof: PROF,
  };
})();
