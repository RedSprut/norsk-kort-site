/* ============ Short Russian glosses for the most frequent Norwegian (Bokmål) words ============
 * Used by the «Слово (перевод)» view of examples. Machine translators get these small words wrong when they see
 * them alone (han → «Хан», var → «Var», den → «вытачивать», ser → garbage) — so they come from this hand-made list.
 * The gloss gives the usual meaning(s); grammar words get a short note in brackets.
 */
(function () {
  const G = {
    // personal pronouns
    jeg: 'я', meg: 'меня/мне', du: 'ты', deg: 'тебя/тебе', han: 'он', ham: 'его/ему', hun: 'она', henne: 'её/ей',
    den: 'он/она/это', det: 'это/оно', vi: 'мы', oss: 'нас/нам', dere: 'вы', de: 'они', dem: 'их/им', seg: 'себя/себе',
    man: 'люди (безл.)', hverandre: 'друг друга', selv: 'сам/сама',
    // possessives
    min: 'мой', mi: 'моя', mitt: 'моё', mine: 'мои', din: 'твой', di: 'твоя', ditt: 'твоё', dine: 'твои',
    hans: 'его', hennes: 'её', dens: 'его/её', dets: 'его', vår: 'наш', vårt: 'наше', våre: 'наши', deres: 'ваш/их',
    sin: 'свой', si: 'своя/сказать', sitt: 'своё', sine: 'свои',
    // articles, demonstratives, quantifiers
    en: 'один/(артикль)', ei: 'одна/(артикль)', et: 'одно/(артикль)', denne: 'этот/эта', dette: 'это', disse: 'эти',
    alle: 'все', alt: 'всё', all: 'весь', hele: 'весь/целый', hver: 'каждый', hvert: 'каждое', enhver: 'любой/каждый',
    noen: 'кто-то/некоторые', noe: 'что-то', ingen: 'никто/ни один', ingenting: 'ничего', intet: 'ничто',
    mange: 'многие/много', mye: 'много', flere: 'больше/несколько', flest: 'больше всего', få: 'мало/получить',
    lite: 'мало', litt: 'немного', begge: 'оба', annen: 'другой', annet: 'другое', andre: 'другие/второй', samme: 'тот же',
    slik: 'такой/так', sånn: 'такой/так', egen: 'собственный', eget: 'собственное', egne: 'собственные',
    // be / have / become + modal verbs
    være: 'быть', er: 'есть/является', var: 'был(а)', vært: 'был (прич.)', bli: 'стать', blir: 'становится/будет',
    ble: 'стал/был (пассив)', blitt: 'стал (прич.)', ha: 'иметь', har: 'имеет (вспом.)', hadde: 'имел (вспом.)', hatt: 'имел (прич.)',
    kan: 'может', kunne: 'мог/мочь', vil: 'хочет/будет', ville: 'хотел/бы', skal: 'будет/должен', skulle: 'должен был/бы',
    må: 'должен', måtte: 'должен был', bør: 'следует', burde: 'следовало бы', får: 'получает/может', fikk: 'получил', fått: 'получил (прич.)',
    // frequent verbs
    gjør: 'делает', gjorde: 'сделал', gjort: 'сделано', gjøre: 'делать', sier: 'говорит', sa: 'сказал',
    sagt: 'сказано', se: 'видеть/смотреть', ser: 'видит/смотрит', så: 'так/потом/увидел', sett: 'видел (прич.)',
    gå: 'идти', går: 'идёт', gikk: 'шёл', gått: 'ушёл (прич.)', komme: 'прийти', kommer: 'приходит', kom: 'пришёл', kommet: 'пришёл (прич.)',
    ta: 'взять', tar: 'берёт', tok: 'взял', tatt: 'взято', gi: 'дать', gir: 'даёт', ga: 'дал', gitt: 'дано',
    vet: 'знает', visste: 'знал', vite: 'знать', tror: 'думает/верит', trodde: 'думал', synes: 'считает', syntes: 'считал',
    liker: 'нравится/любит', likte: 'нравилось', ønsker: 'желает', trenger: 'нуждается', bruker: 'использует',
    står: 'стоит', sto: 'стоял', sitter: 'сидит', satt: 'сидел/поставил', ligger: 'лежит', lå: 'лежал', heter: 'зовут',
    snakker: 'говорит', spiser: 'ест', spise: 'есть (кушать)', drikker: 'пьёт', bor: 'живёт', jobber: 'работает',
    lurer: 'интересуется/обманывает', føler: 'чувствует', føltes: 'ощущалось', virker: 'кажется/работает', finnes: 'существует',
    // prepositions
    på: 'на', i: 'в', til: 'к/до/для', fra: 'из/от', av: 'из/от', med: 'с', for: 'для/за', om: 'о/через/если',
    ved: 'у/возле', hos: 'у', under: 'под/во время', over: 'над/через', mot: 'к/против', etter: 'после/за',
    før: 'до/раньше', uten: 'без', mellom: 'между', gjennom: 'через/сквозь', rundt: 'вокруг', bak: 'за/позади',
    foran: 'перед', langs: 'вдоль', blant: 'среди', innen: 'в течение/до', siden: 'с тех пор/так как', per: 'за/в',
    // conjunctions, subjunctions
    og: 'и', men: 'но', eller: 'или', at: 'что', som: 'который/как', da: 'тогда/когда', når: 'когда', hvis: 'если',
    fordi: 'потому что', mens: 'пока/в то время как', enn: 'чем', både: 'и… и', enten: 'либо', verken: 'ни', idet: 'в тот момент, как',
    dersom: 'если', derfor: 'поэтому', likevel: 'всё же', altså: 'то есть', jo: 'ведь/да',
    // question words
    hva: 'что', hvem: 'кто', hvor: 'где/куда/как', hvorfor: 'почему', hvordan: 'как', hvilken: 'какой', hvilket: 'какое', hvilke: 'какие',
    // adverbs
    ikke: 'не', aldri: 'никогда', alltid: 'всегда', ofte: 'часто', sjelden: 'редко', også: 'тоже', bare: 'только',
    nok: 'наверно/достаточно', kanskje: 'может быть', gjerne: 'охотно', allerede: 'уже', fortsatt: 'всё ещё', ennå: 'ещё',
    nå: 'сейчас', her: 'здесь', der: 'там', hit: 'сюда', dit: 'туда', hjem: 'домой', hjemme: 'дома',
    ut: 'наружу', ute: 'снаружи', inn: 'внутрь', inne: 'внутри', opp: 'вверх', oppe: 'наверху', ned: 'вниз', nede: 'внизу',
    bort: 'прочь', borte: 'далеко/нет', fram: 'вперёд', tilbake: 'назад', igjen: 'снова', veldig: 'очень', svært: 'очень',
    mer: 'больше', mest: 'больше всего', mindre: 'меньше', minst: 'меньше всего', godt: 'хорошо', bra: 'хорошо', dårlig: 'плохо',
    vel: 'ведь/пожалуй', egentlig: 'вообще-то', akkurat: 'как раз/точно', helt: 'совсем', ganske: 'довольно', snart: 'скоро',
    plutselig: 'вдруг', sammen: 'вместе', alene: 'один (сам)', først: 'сначала', sist: 'последний раз', senere: 'позже', tidligere: 'раньше',
    i_dag: 'сегодня', ja: 'да', nei: 'нет', takk: 'спасибо',
    // particle
    å: '(частица: «å» + глагол)',
    // numbers
    to: 'два', tre: 'три', fire: 'четыре', fem: 'пять', seks: 'шесть', sju: 'семь', syv: 'семь', åtte: 'восемь', ni: 'девять', ti: 'десять',
    tjue: 'двадцать', hundre: 'сто', tusen: 'тысяча',
    // frequent nouns machine translators like to mangle alone
    tid: 'время', år: 'год', dag: 'день', ting: 'вещь', mann: 'мужчина', kvinne: 'женщина', barn: 'ребёнок/дети', barna: 'дети',
    verden: 'мир', liv: 'жизнь', folk: 'люди', måte: 'способ', sted: 'место', stedet: 'место', hus: 'дом',
    kongen: 'король', konge: 'король', minutt: 'минута', timer: 'часы', time: 'час',
  };
  window.NoGloss = {
    get(word) {
      const k = String(word || '').toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
      return Object.prototype.hasOwnProperty.call(G, k) ? G[k] : null;
    },
    has(word) { return this.get(word) !== null; },
  };
})();
