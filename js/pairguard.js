/* ============ 🛡 PairGuard — only real «norsk — русский» translations become cards ============
 * Free text (Telegram posts, photos, pasted lessons) mixes example sentences with explanations, exercise questions,
 * hashtags, links and course menus. Pairing a Norwegian line with the next Russian line then produces nonsense
 * («Familien har fått også ny bilen.» — «Правильные ответы даны в комментариях.»).
 *
 * Two steps, as in parallel-corpus cleaning (Bicleaner's «hard rules» + a translation check):
 *  1) hard rules — junk is dropped before anything else: no letters, hashtags, links, Cyrillic or English on the
 *     Norwegian side, the Russian side is a channel phrase («пишите в комментариях», «знали?»), numbers differ,
 *     lengths far apart, a question answered by a statement…
 *  2) the translation check — every remaining pair is compared with a machine translation of the Norwegian line
 *     (word stems, Russian stop-words ignored, negation must match):
 *       ✓ ok        — the Russian line says the same thing → ticked;
 *       ? unsure    — partly the same / a single word with other synonyms → NOT ticked, the user decides;
 *       ✗ bad       — says something else → set aside (can be restored).
 *     🤖 optionally a neural network re-checks the unsure ones and can correct the translation.
 * Nothing is thrown away silently: rejected lines are listed with the reason.
 */
(function () {
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const CYR = /[а-яё]/i;
  const RU_STOP = new Set(('и в во не ни на с со что как а но да нет по к ко у же ли бы то это этот эта эти тот та те мы вы ты я он она оно они его ее её их им ей ему мне меня тебя тебе нас вас ' +
    'от за из о об до для так там тут вот уже еще ещё очень был была было были быть есть будет все всё всех весь вся сам сама свой своя свои мой моя мои твой ' +
    'который которая которые при над под без про через когда где если или чтобы чем тоже также только даже ну ведь вам ним ней них себя себе').split(' '));
  const NEG_NO = /\b(ikke|aldri|ingen|ingenting|intet|ingensteds|verken)\b/i;
  const NEG_RU = /(^|[^а-яё])(не|ни|нет|никогда|никто|ничего|нигде|никак|нельзя)([^а-яё]|$)/i;
  // a channel's own words around the examples — not translations
  // Cyrillic is not \w and has no \b in a JS RegExp without /u — letters are spelled out
  const META_RU = /(коммента|напиши|пишите|переведите|переведи|ответы? (дан|будут|ниже)|правильн[а-яё]* ответ|^знали\s*\??$|в видео (раз|покаж|объясн)|видео ?урок|о курсе|на курс[ае]? (грамм|норв)|аудиорепетитор|подписывай|подпишись|ссылк[аеуи]|канал[аеу]?(?![а-яё])|ставьте|лайк|репост|сохраняй|делитесь|прочитайте|послушайте|упражнени|задани[ея]|вариант[а-яё]* (в|ниже|ответ)|урок[а-яё]*\s*\d|часть\s*\d|выпуск|эфир|трансляци|марафон|розыгрыш|скидк|оплат|запис[а-яё]+ на|telegra\.ph|#|^(вот так|итак|например|кстати|важно|запомните|обратите внимание)(?![а-яё]))/i;
  const isMeta = s => META_RU.test(unquote(s));
  const EN_STOP = new Set('the a an and or is are was were be been you your i me my we our they their he she it its this that these those of to in on at for with from by as not do does did have has had will would can could should what which who how why when where there here'.split(' '));
  const NO_STOP = new Set('og i er det en et ei på som til med av for har jeg du han hun vi dere de ikke den å at var om men så kan skal vil fra eller hva hvor hvorfor når her der også bare nå veldig mye mange litt'.split(' '));

  const letters = s => (String(s).match(/\p{L}/gu) || []).length;
  const words = s => String(s).toLowerCase().replace(/ё/g, 'е').split(/[^\p{L}\d-]+/u).filter(Boolean);
  const nums = s => (String(s).match(/\d+/g) || []).sort().join(',');
  const unquote = s => String(s || '').replace(/^[\s«»"“”„'`]+|[\s«»"“”„'`]+$/g, '').replace(/\s+/g, ' ').trim();

  /** why the Norwegian side is not usable ('' = fine) */
  function badNo(no) {
    const s = unquote(no);
    if (!s) return 'пусто';
    if (letters(s) < 2) return 'нет слов (номер, символы)';
    if (/https?:|www\.|t\.me\/|\/\/\S|\.(com|no|ru|ph|org)\b/i.test(s)) return 'ссылка';
    if (/(^|\s)#[\p{L}\d_]/u.test(s)) return 'хэштеги';
    if (CYR.test(s)) return 'в норвежской строке русский текст';
    if (letters(s) / s.replace(/\s/g, '').length < 0.6) return 'больше цифр и символов, чем слов';
    const w = words(s);
    if (w.length >= 3 && !/[æøå]/i.test(s)) {
      const en = w.filter(x => EN_STOP.has(x)).length, nb = w.filter(x => NO_STOP.has(x)).length;
      if (en >= 2 && en > nb) return 'это английский, не норвежский';
    }
    if (s.length > 220) return 'слишком длинно для карточки';
    return '';
  }
  /** why the Russian side is not a translation by its look alone ('' = fine) */
  function badRu(ru, no) {
    const s = unquote(ru);
    if (!s) return 'нет перевода';
    if (U.cyrRatio(s) < 0.5) return 'перевод не на русском';
    if (/https?:|www\.|t\.me\/|\/\/\S/i.test(s)) return 'в переводе ссылка';
    const nn = nums(no), nr = nums(s);
    if (nn && nr && nn !== nr) return 'числа не совпадают';
    const n = unquote(no);
    if (words(n).length >= 3) {
      const r = s.length / Math.max(1, n.length);
      if (r < 0.35 || r > 3) return 'длина совсем другая';
      if (/\?\s*$/.test(n) !== /\?\s*$/.test(s) && /\?/.test(n + s)) return 'вопрос и не вопрос';
    }
    return '';
  }

  /** a word → its stem (cheap Russian stemmer: enough to match «семья / семьи / семьёй») */
  const stem = w => w.length <= 4 ? w : w.slice(0, Math.max(4, Math.min(6, w.length - 2)));
  const bag = s => new Set(words(s).filter(w => w.length > 1 && !RU_STOP.has(w) && /\p{L}/u.test(w)).map(stem));
  /** 0..1 — how much the two Russian texts say the same (Dice coefficient on stems) */
  function sim(a, b) {
    const A = bag(a), B = bag(b);
    if (!A.size || !B.size) return 0;
    let n = 0; A.forEach(x => { if (B.has(x)) n++; });
    return 2 * n / (A.size + B.size);
  }
  /** any shared stem (for single words with synonym lists: «печальный, досадный» vs «грустный, печальный») */
  const shares = (a, b) => { const A = bag(a), B = bag(b); for (const x of A) if (B.has(x)) return true; return false; };

  /**
   * judge one pair against a machine translation (mt).
   * → { st: 'ok'|'unsure'|'bad', why, score }
   */
  function judge(no, ru, mt) {
    const n = unquote(no);
    const isWord = words(n).length <= 2;
    const meta = isMeta(ru);
    if (!mt) return meta ? { st: 'bad', why: 'служебная фраза канала, не перевод', score: null } : { st: 'unsure', why: 'не удалось сверить (нет связи с переводчиком)', score: null };
    if (meta && sim(ru, mt) < 0.34 && !Translators.agrees(mt, ru)) return { st: 'bad', why: 'служебная фраза канала, не перевод', score: sim(ru, mt) };
    if (NEG_NO.test(n) !== NEG_RU.test(ru) && !isWord) return { st: 'unsure', why: 'отрицание не совпадает («ikke» ↔ «не»)', score: sim(ru, mt) };
    if (isWord) {
      if (shares(ru, mt) || Translators.agrees(mt, ru)) return { st: 'ok', why: 'совпадает с машинным переводом', score: 1 };
      return { st: 'unsure', why: `машинный перевод другой: «${mt}»`, score: 0 };
    }
    const s = sim(ru, mt);
    if (s >= 0.34 || Translators.agrees(mt, ru)) return { st: 'ok', why: 'совпадает с машинным переводом', score: s };
    if (s >= 0.12) return { st: 'unsure', why: `похоже лишь частично; машинный перевод: «${mt}»`, score: s };
    // nothing in common: «не перевод» only with a second sign (very different length); a free / idiomatic translation
    // («Ikke vær lei deg!» — «Не расстраивайся!») stays «? проверьте» — unticked, the user or the AI decides
    const ratio = unquote(ru).length / Math.max(1, mt.length);
    if (ratio < 0.55 || ratio > 1.9) return { st: 'bad', why: `не похоже на перевод; машинный перевод: «${mt}»`, score: s };
    return { st: 'unsure', why: `сказано иначе, чем в машинном переводе: «${mt}» — возможно, перевод по смыслу`, score: s };
  }

  const PairGuard = {
    badNo, badRu, judge, sim, unquote,

    /** step 1 only (cheap, synchronous): cleaned rows + rejected rows with reasons */
    clean(rows) {
      const keep = [], rejected = [];
      rows.forEach(r0 => {
        const r = Object.assign({}, r0, { no: unquote(r0.no), ru: unquote(r0.ru) });
        const why = badNo(r.no) || badRu(r.ru, r.no);
        if (why) rejected.push(Object.assign(r, { st: 'bad', why })); else keep.push(r);
      });
      return { keep, rejected };
    },

    /**
     * step 2: compare every kept pair with a machine translation (batched, cached by the translators).
     * onProgress(done, total). Sets r.st / r.why / r.mt / r.mtBy on each row; returns the rows.
     */
    async verify(rows, onProgress, stop) {
      const B = 40;
      for (let k = 0; k < rows.length; k += B) {
        if (stop && stop()) break;
        const part = rows.slice(k, k + B);
        let res = null;
        try { res = await Translators.translateMany(part.map(r => r.no), 'no', 'ru'); } catch (e) { res = null; }
        part.forEach((r, i) => {
          const mt = res ? String(res.out[i] || '').trim() : '';
          Object.assign(r, judge(r.no, r.ru, mt), { mt, mtBy: res ? res.by || [] : [] });
        });
        if (onProgress) onProgress(Math.min(k + B, rows.length), rows.length);
      }
      return rows;
    },

    /** 🤖 a neural network re-checks pairs: { i: {ok, ru} } — ok=false with a corrected ru when it was wrong */
    async aiCheck(rows) {
      const out = {};
      for (let k = 0; k < rows.length; k += 25) {
        const part = rows.slice(k, k + 25);
        const user = `For each pair decide if the Russian is a CORRECT translation of the Norwegian Bokmål (meaning, not word-for-word; idioms may be translated freely). ` +
          `If it is wrong or is not a translation at all, give the correct Russian translation. ` +
          `Return ONLY a JSON array, same order: [{"ok":true} or {"ok":false,"ru":"правильный перевод"}].\n` +
          JSON.stringify(part.map(r => ({ no: r.no, ru: r.ru })));
        const arr = AI.parseJSON(await AI.call({ system: 'You are a careful Norwegian–Russian translator and teacher.', user, maxTokens: 200 + part.length * 60, temperature: 0.1 }));
        (Array.isArray(arr) ? arr : []).forEach((x, i) => { if (x && typeof x.ok === 'boolean') out[k + i] = { ok: x.ok, ru: String(x.ru || '').trim() }; });
      }
      return out;
    },

    /** small badge for a row */
    badge(r) {
      if (r.st === 'ok') return `<span class="pg-b ok" title="${U.esc(r.why || '')}">✓ перевод подтверждён</span>`;
      if (r.st === 'ai') return `<span class="pg-b ok" title="Проверила нейросеть">${BOT()} проверено</span>`;
      if (r.st === 'aifix') return `<span class="pg-b ai" title="Нейросеть исправила перевод автора">${BOT()} исправлено</span>`;
      if (r.st === 'unsure') return `<span class="pg-b unsure" title="${U.esc(r.why || '')}">? проверьте</span>`;
      if (r.st === 'bad') return `<span class="pg-b bad" title="${U.esc(r.why || '')}">✗ ${U.esc(r.why || 'не перевод')}</span>`;
      return '<span class="pg-b"><span class="spinner sm"></span> проверяю…</span>';
    },
  };

  window.PairGuard = PairGuard;
})();
