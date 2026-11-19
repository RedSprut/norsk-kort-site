/* ============ Extra open Norwegian sources ============
 * Tatoeba     — real sentence pairs Norwegian Bokmål → Russian, translated by people (CC BY 2.0 FR). Browser-friendly API.
 * Lingua Libre — recordings by native speakers on Wikimedia Commons (CC BY-SA).
 */
(function () {
  const Sources = {
    /* ---------- Tatoeba ---------- */
    async tatoeba(card, limit = 6) {
      const word = Ordbok.bare(card.no);
      if (!word) throw new Error('Нет норвежского слова');
      const url = `https://api.tatoeba.org/v1/sentences?lang=nob&q=${encodeURIComponent(word)}&trans:lang=rus&showtrans=matching&sort=relevance&limit=${limit}`;
      const j = await (await fetch(url)).json();
      const flat = t => Array.isArray(t) ? t.flatMap(flat) : (t ? [t] : []);
      const out = (j.data || []).map(s => {
        const ru = flat(s.translations).find(t => t && t.lang === 'rus');
        return ru ? { label: 'Tatoeba', no: String(s.text || '').trim(), ru: String(ru.text || '').trim(), note: 'живой пример · tatoeba.org (CC BY 2.0 FR)' } : null;
      }).filter(Boolean);
      if (!out.length) throw new Error(`Tatoeba: нет примеров с переводом на русский для «${word}»`);
      return out;
    },
    tatoebaUrl(card) { return `https://tatoeba.org/ru/sentences/search?from=nob&to=rus&query=${encodeURIComponent(Ordbok.bare(card.no))}`; },

    /* ---------- Lingua Libre: native speaker audio ---------- */
    _audio: {},
    async nativeAudio(card) {
      const word = Ordbok.bare(card.no).toLowerCase();
      if (!word) throw new Error('Нет слова');
      if (this._audio[word] !== undefined) return this._audio[word];
      const api = 'https://commons.wikimedia.org/w/api.php?format=json&origin=*';
      const s = await (await fetch(`${api}&action=query&list=search&srnamespace=6&srlimit=10&srsearch=${encodeURIComponent(`intitle:"LL-Q9043 (nor)" intitle:"-${word}.wav"`)}`)).json();
      const hit = ((s.query && s.query.search) || []).map(r => r.title).find(t => new RegExp(`-${U.escapeRegExp(word)}\\.wav$`, 'i').test(t));
      if (!hit) { this._audio[word] = null; return null; }
      const i = await (await fetch(`${api}&action=query&prop=imageinfo&iiprop=url&titles=${encodeURIComponent(hit)}`)).json();
      const page = Object.values((i.query && i.query.pages) || {})[0];
      const url = page && page.imageinfo && page.imageinfo[0].url;
      this._audio[word] = url ? { url, speaker: (hit.match(/\(nor\)-([^-]+)-/) || [])[1] || '' } : null;
      return this._audio[word];
    },
    async playNative(card) {
      const a = await this.nativeAudio(card);
      if (!a) throw new Error('У этого слова пока нет записи носителя на Lingua Libre — звучит синтезированный голос');
      TTS.stop();
      const audio = new Audio(a.url);
      TTS._audio = audio;
      await audio.play();
      return a;
    },
  };

  window.Sources = Sources;
})();
