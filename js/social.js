/* ============ 🌐 More sources for the card's word: podcasts with transcripts, VK, TikTok, Instagram, Pinterest, Reddit ============
 * 🎧 Podcasts — «Норвежский акселератор обучения» (70 episodes, transcripts with Russian + Norwegian lines): find the word,
 *    play the audio exactly from that sentence, turn the pair into a card. Other learner podcasts: episodes by title/description.
 * 🟦 VK — public communities with the user's own free VK service key (VK does not let websites read walls): through the Mac
 *    bridge on the owner's Mac, through native HTTP in the store apps (Net.native — the key stays on the device). The site has
 *    no VK tab (docs/release-architecture.md §1.4 P8).
 * 🎵 TikTok / 📸 Instagram / 📌 Pinterest — paste a link -> watch here -> its text into cards; search opens the site.
 * Everything taken keeps its source (platform + link) on the card.
 */
(function () {
  const enc = encodeURIComponent;
  const ACCEL = 'https://feeds.captivate.fm/norwegian-learning-accelerator-ru-ru-to-nb-no/';
  const FEEDS = [
    ['Lær norsk nå! (Marius)', 'https://anchor.fm/s/19b5cbd8/podcast/rss', '🇳🇴'],
    ['Norsk for Beginners', 'https://anchor.fm/s/4adac90c/podcast/rss', '🇬🇧'],
    ['NorskPrat', 'https://feeds.captivate.fm/norskprat/', '🇳🇴'],
  ];
  const VK_GROUPS = [['norge_ru', 'Norge.ru — Норвегия по-русски'], ['norwegianschool', 'На пути в Норвегию (norwegianschool)']];
  const st = () => Store.settings;
  const macBridge = () => (window.Net && Net.isMacBridge ? Net.isMacBridge() : !!(window.AI && AI.bridge && AI.bridge.up));
  const native = () => !!(window.Net && Net.isNative && Net.isNative());
  const onMac = () => !!(window.Net && Net.onMac ? Net.onMac() : /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === 'file:');
  /** where VK can be read at all: the owner's Mac (with the bridge) and the store apps */
  const vkHere = () => onMac() || native();
  const fav = (d, s = 18) => `<img class="ai-ico" src="https://www.google.com/s2/favicons?domain=${d}&sz=64" width="${s}" height="${s}" alt="" onerror="this.replaceWith(document.createTextNode('🌐'))">`;

  /* ---------- podcasts ---------- */
  const xmlCache = new Map(), srtCache = new Map();
  async function feed(url) {
    if (xmlCache.has(url)) return xmlCache.get(url);
    const doc = new DOMParser().parseFromString(await (await fetch(url)).text(), 'application/xml');
    const items = [...doc.querySelectorAll('item')].map(it => {
      const tr = [...it.getElementsByTagName('*')].find(e => e.localName === 'transcript' && /srt|vtt/.test(e.getAttribute('type') || ''));
      return {
        title: (it.querySelector('title') || {}).textContent || '',
        desc: U.stripHtml((it.querySelector('description') || {}).textContent || '').slice(0, 600),
        audio: (it.querySelector('enclosure') || { getAttribute: () => '' }).getAttribute('url'),
        transcript: tr ? tr.getAttribute('url') : '',
        link: (it.querySelector('link') || {}).textContent || '',
      };
    });
    const out = { title: (doc.querySelector('channel > title') || {}).textContent || '', items };
    xmlCache.set(url, out);
    return out;
  }
  const secs = t => { const m = String(t).match(/(\d+):(\d+):(\d+)[,.](\d+)/); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000 : 0; };
  /** SRT -> pairs [{ru, no, start}] (the transcript alternates a Russian and a Norwegian line) */
  async function srtPairs(url) {
    if (srtCache.has(url)) return srtCache.get(url);
    const cues = (await (await fetch(url)).text()).replace(/\r/g, '').split(/\n\n+/).map(b => {
      const lines = b.split('\n'); const ti = lines.findIndex(l => l.includes('-->'));
      return ti < 0 ? null : { start: secs(lines[ti].split('-->')[0]), text: lines.slice(ti + 1).join(' ').replace(/<[^>]+>/g, '').trim() };
    }).filter(c => c && c.text);
    const cyr = s => U.cyrRatio(s) > 0.4;
    const pairs = [];
    for (let i = 0; i < cues.length - 1; i++) {
      const a = cues[i], b = cues[i + 1];
      if (cyr(a.text) && !cyr(b.text)) { pairs.push({ ru: a.text, no: b.text, start: b.start }); i++; }
      else if (!cyr(a.text) && cyr(b.text)) { pairs.push({ no: a.text, ru: b.text, start: a.start }); i++; }
    }
    srtCache.set(url, pairs);
    return pairs;
  }

  /* ---------- VK (the user's service key: the Mac bridge, or native HTTP in the store apps) ---------- */
  async function vkSearch(group, q) {
    const url = `https://api.vk.com/method/wall.search?domain=${enc(group)}&query=${enc(q)}&owners_only=1&count=20&v=5.199&access_token=${enc(st().vkToken || '')}`;
    let r = null;
    if (native()) r = await Net.native(url, { method: 'GET' }).catch(() => null);
    else if (macBridge()) r = await fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, method: 'GET' }) });
    if (!r) throw new Error('ВКонтакте сейчас не ответил — попробуйте позже');
    const j = await r.json().catch(() => ({}));
    if (j.error) throw new Error(j.error.error_msg || 'VK: ошибка');
    return ((j.response || {}).items || []).map(p => ({ group, id: p.id, owner: p.owner_id, text: p.text || '', date: p.date * 1000, link: `https://vk.com/wall${p.owner_id}_${p.id}`,
      photos: (p.attachments || []).filter(a => a.type === 'photo').map(a => { const s = a.photo.sizes || []; return (s[s.length - 1] || {}).url; }).filter(Boolean) }));
  }

  /* ---------- links -> embeds ---------- */
  function embedFor(url) {
    const u = String(url).trim();
    let m;
    if ((m = u.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/))) return { kind: 'tiktok', src: `https://www.tiktok.com/player/v1/${m[1]}`, h: 740 };
    if ((m = u.match(/instagram\.com\/(?:p|reels?|tv)\/([\w-]+)/))) return { kind: 'instagram', src: `https://www.instagram.com/p/${m[1]}/embed/captioned/`, h: 820 };
    if ((m = u.match(/pinterest\.[a-z.]+\/pin\/(\d+)/))) return { kind: 'pinterest', src: `https://assets.pinterest.com/ext/embed.html?id=${m[1]}`, h: 700 };
    if ((m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{6,})/))) return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${m[1]}`, h: 420 };
    if ((m = u.match(/reddit\.com(\/r\/[^?#]+)/))) return { kind: 'reddit', src: `https://embed.reddit.com${m[1]}?embed=true&theme=dark`, h: 600 };
    return null;
  }
  /** what kind of link is it, if it is not one post/video: a profile, a short TikTok link… — to explain instead of failing */
  function linkKind(url) {
    const u = String(url).trim();
    if (!u) return 'empty';
    if (!/^https?:\/\//i.test(u) && !/\.(com|no|it|be)\b/i.test(u)) return 'text';
    if (/(vm|vt)\.tiktok\.com\/|tiktok\.com\/t\//i.test(u)) return 'tiktok-short';
    let m;
    if ((m = u.match(/tiktok\.com\/@([\w.]+)\/?(?:[?#].*)?$/i))) return { profile: 'TikTok', name: m[1], url: `https://www.tiktok.com/@${m[1]}` };
    if ((m = u.match(/instagram\.com\/([\w.]+)\/?(?:[?#].*)?$/i)) && !/^(p|reel|reels|tv|explore|stories)$/i.test(m[1])) return { profile: 'Instagram', name: m[1], url: `https://www.instagram.com/${m[1]}/` };
    if ((m = u.match(/youtube\.com\/(@[\w.-]+|channel\/[\w-]+|c\/[\w-]+)/i))) return { profile: 'YouTube', name: m[1], url: `https://www.youtube.com/${m[1]}` };
    if (/pin\.it\//i.test(u)) return 'pin-short';
    return 'unknown';
  }
  /** a short TikTok link (from «Поделиться» on the phone) → the video id, via TikTok's own oEmbed */
  async function tiktokResolve(url) {
    try {
      const j = await (await fetch(`https://www.tiktok.com/oembed?url=${enc(url)}`)).json();
      // TikTok's oEmbed now answers with an <iframe src=".../player/v1/ID"> and embed_product_id (older answers: a blockquote with data-video-id)
      const h = String(j.html || '');
      const id = (/^\d+$/.test(j.embed_product_id || '') ? j.embed_product_id : null)
        || (h.match(/\/player\/v1\/(\d+)/) || h.match(/data-video-id="(\d+)"/) || h.match(/\/video\/(\d+)/) || [])[1];
      const who = j.author_unique_id || (String(j.author_url || '').match(/@([\w.]+)/) || [])[1] || 'user';
      return id ? `https://www.tiktok.com/@${who.replace(/\s/g, '')}/video/${id}` : null;
    } catch (e) { return null; }
  }
  async function tiktokCaption(url) {
    try { const j = await (await fetch(`https://www.tiktok.com/oembed?url=${enc(url)}`)).json(); return j.title || ''; } catch (e) { return ''; }
  }

  const Social = {
    async open(card, tab = 'pod') {
      const q0 = card ? Ordbok.bare(card.no) : '';
      const m = UI.modal({ title: `🌐 Ещё источники${q0 ? `: «${U.esc(q0)}»` : ''}`, cls: 'wide social-modal', body: '<div data-so></div>' });
      const box = m.$('[data-so]');
      const tabs = [['pod', '🎧 Подкасты']].concat(vkHere() ? [['vk', '🟦 ВКонтакте']] : [], [['link', '🔗 TikTok · Instagram · Pinterest — по ссылке'], ['search', '🔎 Искать везде']]);
      const go = t => {
        box.innerHTML = `<div class="tg-tabs">${tabs.map(([k, l]) => `<button class="chip ${k === t ? 'active' : ''}" data-sotab="${k}">${l}</button>`).join('')}</div><div data-sobody></div>`;
        this['tab_' + t](box.querySelector('[data-sobody]'), card, q0, m);
      };
      box.addEventListener('click', e => { const t = e.target.closest('[data-sotab]'); if (t) go(t.dataset.sotab); });
      go(tabs.some(x => x[0] === tab) ? tab : 'pod');
    },

    /** item -> cards through the shared pairs editor (source: platform + link) */
    toCards(title, link, text, photos, card) {
      Telegram.toCards({ src: 'local', chatTitle: `${title}${link ? ' · ' + link : ''}`, link: link || '', text: text || '', photos: photos || [], video: null }, card);
    },

    async tab_pod(el, card, q0) {
      el.innerHTML = `<div class="small">«<b>Норвежский акселератор обучения</b>» — 70 выпусков: фраза по-русски → по-норвежски, с расшифровкой. Найду ваше слово во всех выпусках и включу аудио ровно с этой фразы.</div>
        <div class="row" style="gap:8px;margin:8px 0"><input class="input grow" data-pq value="${U.esc(q0)}" placeholder="слово"><button class="btn primary" data-pgo>🔎 Найти</button></div>
        <div data-pres class="tg-res"></div>`;
      const run = async () => {
        const q = el.querySelector('[data-pq]').value.trim().toLowerCase();
        if (!q) return;
        const res = el.querySelector('[data-pres]');
        res.innerHTML = '<div class="small muted"><span class="spinner sm"></span> читаю расшифровки (первый раз ~10 с)…</div>';
        try {
          const f = await feed(ACCEL);
          const eps = f.items.filter(x => x.transcript);
          const hits = [];
          let k = 0;
          await Promise.all(Array.from({ length: 6 }, async () => {
            while (k < eps.length) {
              const ep = eps[k++];
              try { (await srtPairs(ep.transcript)).forEach(p => { if (new RegExp(`(^|[^\\p{L}])${U.escapeRegExp(q)}`, 'iu').test(p.no)) hits.push(Object.assign({ ep }, p)); }); } catch (e) { /* skip */ }
            }
          }));
          // other learner podcasts: the word in titles / descriptions
          const others = [];
          for (const [name, url, flag] of FEEDS) {
            try { (await feed(url)).items.filter(x => (x.title + ' ' + x.desc).toLowerCase().includes(q)).slice(0, 5).forEach(x => others.push(Object.assign({ name, flag }, x))); } catch (e) { /* feed offline */ }
          }
          this._pod = hits;
          res.innerHTML = (hits.length ? `<div class="small muted">Фраз с «${U.esc(q)}»: ${hits.length}</div>` + hits.slice(0, 60).map((h, i) => `<div class="tg-post">
              <div class="tg-post-head">🎧 <b>${U.esc(h.ep.title)}</b><span class="grow"></span><span class="small muted">${Math.floor(h.start / 60)}:${String(Math.floor(h.start % 60)).padStart(2, '0')}</span></div>
              <div class="tg-text" style="max-height:none">${UI.rich(`${h.no} (${h.ru})`)}</div>
              <div class="row" style="gap:6px;margin-top:6px"><button class="btn sm primary" data-play="${i}">▶ Слушать с этой фразы</button><button class="btn sm ai" data-pcard="${i}">➕ В карточку</button></div><div data-pl="${i}"></div></div>`).join('')
            : `<div class="small muted">В расшифровках «${U.esc(q)}» не встретилось. Попробуйте другую форму слова.</div>`)
            + (others.length ? `<h3 style="margin:14px 0 6px">Другие подкасты</h3>${others.map(x => `<div class="tg-post"><div class="tg-post-head">${x.flag} <b>${U.esc(x.name)}</b> · ${U.esc(x.title)}</div><div class="small muted">${U.esc(x.desc.slice(0, 200))}</div>${x.audio ? `<audio controls preload="none" src="${U.esc(x.audio)}"></audio>` : ''}</div>`).join('')}` : '');
        } catch (e) { res.innerHTML = `<div class="mt-warn">⚠️ <span>Подкаст не загрузился: ${U.esc(U.niceErr(e, '', true))}</span></div>`; }
      };
      el.addEventListener('click', e => {
        if (e.target.closest('[data-pgo]')) { run(); return; }
        const p = e.target.closest('[data-play]');
        if (p) {
          const h = this._pod[+p.dataset.play];
          const slot = el.querySelector(`[data-pl="${p.dataset.play}"]`);
          slot.innerHTML = `<audio controls autoplay src="${U.esc(h.ep.audio)}#t=${Math.max(0, h.start - 0.3).toFixed(1)}" style="width:100%;margin-top:6px"></audio>`;
          return;
        }
        const c = e.target.closest('[data-pcard]');
        if (c) { const h = this._pod[+c.dataset.pcard]; this.toCards(`Подкаст «Норвежский акселератор» · ${h.ep.title}`, h.ep.link, `${h.no} – ${h.ru}`, [], card); }
      });
      el.querySelector('[data-pq]').addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
      if (q0) run();
    },

    tab_vk(el, card, q0) {
      const groups = VK_GROUPS.concat((st().vkExtra || []).map(g => [g, g]));
      const ready = (macBridge() || native()) && (st().vkToken || '').trim();
      el.innerHTML = `${ready ? '' : `<div class="mt-warn">ℹ️ <span><b>ВКонтакте не даёт сайтам читать стены сообществ.</b> Нужно: ${native() ? '' : '1) мост на Mac; 2) '}бесплатный сервисный ключ VK — <a href="https://dev.vk.com/ru/admin/apps-list" target="_blank" rel="noopener">dev.vk.com → Мои приложения</a> → создать приложение → «Сервисный ключ доступа» → вставьте ниже. ВКонтакте недоступен в Украине.</span></div>`}
        <div class="row" style="gap:6px;margin:6px 0"><input class="input grow" type="password" data-vktok value="${U.esc(st().vkToken || '')}" placeholder="сервисный ключ VK" autocomplete="off"><button class="btn sm" data-vksave>Сохранить</button></div><div class="key-local">🔒 Ключ хранится только на этом устройстве — разработчики приложения его не видят</div>
        <div class="row" style="gap:8px"><input class="input grow" data-vq value="${U.esc(q0)}"><button class="btn primary" data-vgo ${ready ? '' : 'disabled'}>🔎 Найти в сообществах</button></div>
        <div class="small muted" style="margin:6px 0">Сообщества: ${groups.map(([g, n]) => `<a href="https://vk.com/${enc(g)}" target="_blank" rel="noopener">${U.esc(n)}</a>`).join(' · ')} · <a href="https://vk.com/search/communities?q=${enc('норвежский язык')}" target="_blank" rel="noopener">найти ещё ↗</a>
          <span class="row" style="gap:6px;margin-top:4px"><input class="input" data-vadd placeholder="добавить: адрес сообщества (vk.com/…)" style="max-width:300px"><button class="btn sm ghost" data-vaddgo>＋</button></span></div>
        <div data-vres class="tg-res"></div>`;
      el.addEventListener('click', async e => {
        if (e.target.closest('[data-vksave]')) { Store.setSetting('vkToken', el.querySelector('[data-vktok]').value.trim()); this.tab_vk(el, card, q0); UI.toast('Ключ VK сохранён (только в этом браузере)', 'good'); return; }
        if (e.target.closest('[data-vaddgo]')) {
          const g = el.querySelector('[data-vadd]').value.trim().replace(/^https?:\/\/(m\.)?vk\.(com|ru)\//, '').split(/[/?]/)[0];
          if (g) { Store.setSetting('vkExtra', [...new Set([...(st().vkExtra || []), g])]); this.tab_vk(el, card, q0); }
          return;
        }
        if (e.target.closest('[data-vgo]')) {
          const q = el.querySelector('[data-vq]').value.trim();
          const res = el.querySelector('[data-vres]');
          res.innerHTML = '<span class="spinner sm"></span>';
          const all = [];
          for (const [g, n] of groups) { try { (await vkSearch(g, q)).forEach(p => all.push(Object.assign({ n }, p))); } catch (err) { all.push({ n, error: U.niceErr(err) }); } }
          this._vk = all.filter(p => !p.error);
          res.innerHTML = this._vk.length ? this._vk.map((p, i) => `<div class="tg-post"><div class="tg-post-head">🟦 <b>${U.esc(p.n)}</b><span class="small muted">${new Date(p.date).toLocaleDateString('ru-RU')}</span><span class="grow"></span><a class="small" href="${U.esc(p.link)}" target="_blank" rel="noopener">↗</a></div>
              <div class="tg-text">${UI.rich(p.text)}</div>${p.photos.length ? `<div class="tg-photos">${p.photos.slice(0, 4).map(u => `<img src="${U.esc(u)}" alt="">`).join('')}</div>` : ''}
              <div class="row" style="gap:6px;margin-top:6px"><button class="btn sm ai" data-vcard="${i}">➕ В карточку</button>${Listen.hereBtn('.tg-post', 'ВКонтакте · ' + p.n, 'Слушать')}</div></div>`).join('')
            : `<div class="small muted">Ничего не найдено${all.find(p => p.error) ? ' · ' + U.esc(all.find(p => p.error).error) : ''}</div>`;
          return;
        }
        const c = e.target.closest('[data-vcard]');
        if (c) { const p = this._vk[+c.dataset.vcard]; this.toCards(`ВКонтакте · ${p.n}`, p.link, p.text, p.photos, card); }
        const t = e.target.closest('.tg-text'); if (t) t.closest('.tg-post').classList.toggle('open');
      });
    },

    tab_link(el, card) {
      el.innerHTML = `<div class="small">Вставьте ссылку на видео или пост — <b>TikTok, Instagram, Pinterest, YouTube, Reddit</b> — оно откроется здесь, а текст из подписи можно превратить в карточки.</div>
        <div class="row" style="gap:8px;margin:8px 0;flex-wrap:wrap"><input class="input grow" data-lurl placeholder="https://www.tiktok.com/@…/video/…  ·  https://www.instagram.com/p/…"><button class="btn" data-lpaste title="Вставить ссылку из буфера обмена">📋 Вставить</button><button class="btn primary" data-lgo>▶ Открыть</button></div>
        <div data-lout></div>
        <div class="small muted" style="margin-top:10px">Популярные учителя: TikTok <a href="https://www.tiktok.com/@speaknorsk" target="_blank" rel="noopener">@speaknorsk</a>, <a href="https://www.tiktok.com/@lenoonorge" target="_blank" rel="noopener">@lenoonorge</a>, <a href="https://www.tiktok.com/@norskgruppe" target="_blank" rel="noopener">@norskgruppe</a> (по-русски), <a href="https://www.tiktok.com/@norskfordeg" target="_blank" rel="noopener">@norskfordeg</a> · Instagram <a href="https://www.instagram.com/speaknorsk/" target="_blank" rel="noopener">@speaknorsk</a>, <a href="https://www.instagram.com/norwegian.with.ilys/" target="_blank" rel="noopener">@norwegian.with.ilys</a>, <a href="https://www.instagram.com/norskgruppe/" target="_blank" rel="noopener">@norskgruppe</a></div>`;
      const open = async () => {
        let url = el.querySelector('[data-lurl]').value.trim();
        const out = el.querySelector('[data-lout]');
        const how = '<b>Как взять ссылку:</b> откройте нужное видео или пост → «Поделиться» → «Копировать ссылку» → нажмите здесь «📋 Вставить».';
        let em = embedFor(url);
        if (!em && linkKind(url) === 'tiktok-short') {
          out.innerHTML = '<div class="small muted"><span class="spinner sm"></span> открываю короткую ссылку TikTok…</div>';
          const full = await tiktokResolve(url);
          if (full) { url = full; em = embedFor(url); }
        }
        if (!em) {
          const k = linkKind(url);
          out.innerHTML = `<div class="mt-warn"><span>ℹ️</span><span>${
            k === 'empty' ? `Вставьте сюда ссылку на <b>одно видео или пост</b>. ${how}`
            : k === 'text' ? `Это не похоже на ссылку. ${how}`
            : k.profile ? `Это ссылка на <b>профиль ${U.esc(k.profile)} «${U.esc(k.name)}»</b>, а показать здесь можно одно видео или пост. Откройте профиль, выберите видео — и вставьте ссылку на него. ${how}
                <br><a class="btn sm" href="${U.esc(k.url)}" target="_blank" rel="noopener" style="margin-top:6px">↗ Открыть профиль ${U.esc(k.name)}</a>`
            : k === 'tiktok-short' ? `TikTok не открыл эту короткую ссылку. Откройте её в TikTok и скопируйте полную ссылку на видео.`
            : k === 'pin-short' ? `Короткую ссылку pin.it браузер раскрыть не может — откройте её, и скопируйте полный адрес пина (pinterest.com/pin/…).`
            : `Эту ссылку здесь показать нельзя: подходят TikTok, Instagram, Pinterest, YouTube и Reddit — ссылка на одно видео или пост. ${how}`}</span></div>`;
          return;
        }
        const cap = em.kind === 'tiktok' ? await tiktokCaption(url) : '';
        out.innerHTML = `<iframe class="so-embed" referrerpolicy="strict-origin-when-cross-origin" src="${U.esc(em.src)}" style="height:${em.h}px" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>
          <label class="field"><span>Текст для карточек — скопируйте подпись из поста сюда (формат «norsk – русский», по строке на пару)</span><textarea class="input" data-ltext rows="4">${U.esc(cap)}</textarea></label>
          <button class="btn ai" data-lcard>➕ В карточки</button>`;
        out.querySelector('[data-lcard]').onclick = () => {
          const names = { tiktok: 'TikTok', instagram: 'Instagram', pinterest: 'Pinterest', youtube: 'YouTube', reddit: 'Reddit' };
          this.toCards(names[em.kind], url, out.querySelector('[data-ltext]').value, [], card);
        };
      };
      el.querySelector('[data-lgo]').onclick = open;
      el.querySelector('[data-lurl]').addEventListener('keydown', e => { if (e.key === 'Enter') open(); });
      // a link pasted into the field opens right away
      el.querySelector('[data-lurl]').addEventListener('paste', () => setTimeout(open, 50));
      el.querySelector('[data-lpaste]').onclick = async () => {
        try { const t = (await navigator.clipboard.readText()).trim(); if (t) { el.querySelector('[data-lurl]').value = t; open(); } else UI.toast('В буфере обмена пусто — сначала скопируйте ссылку', 'warn'); }
        catch (e) { el.querySelector('[data-lurl]').focus(); UI.toast('Браузер не дал прочитать буфер — вставьте ссылку в поле (⌘V / долгое нажатие → Вставить)', 'warn', 5000); }
      };
    },

    tab_search(el, card, q0) {
      const q = q0 || '';
      const L = [
        ['tiktok.com', 'TikTok', `https://www.tiktok.com/search?q=${enc(q + ' norsk')}`],
        ['instagram.com', 'Instagram (хэштег)', `https://www.instagram.com/explore/tags/${enc(q.replace(/\s+/g, ''))}/`],
        ['pinterest.com', 'Pinterest — карточки-картинки', `https://www.pinterest.com/search/pins/?q=${enc('norsk ' + q)}`],
        ['vk.com', 'ВКонтакте', `https://vk.com/search?c%5Bq%5D=${enc(q + ' норвежский')}&c%5Bsection%5D=statuses`],
        ['reddit.com', 'Reddit r/norsk', `https://www.reddit.com/r/norsk/search/?q=${enc(q)}&restrict_sr=1`],
        ['quizlet.com', 'Quizlet — наборы карточек', `https://quizlet.com/search?query=${enc('norsk ' + q)}&type=sets`],
        ['ankiweb.net', 'AnkiWeb — колоды', `https://ankiweb.net/shared/decks?search=${enc('norwegian')}`],
        ['morsmal.no', 'Tema morsmål (украинский)', `https://morsmal.no/uk/?s=${enc(q)}`],
        ['podcasts.apple.com', 'Подкасты (Apple)', `https://podcasts.apple.com/search?term=${enc('norsk ' + q)}`],
        ['open.spotify.com', 'Подкасты (Spotify)', `https://open.spotify.com/search/${enc('norsk ' + q)}/podcasts`],
        ['ok.ru', 'Одноклассники', `https://ok.ru/search?st.query=${enc('норвежский ' + q)}`],
        ['dzen.ru', 'Дзен', `https://dzen.ru/search?query=${enc('норвежский ' + q)}`],
      ];
      el.innerHTML = `<div class="small muted" style="margin-bottom:8px">Эти площадки не дают показывать поиск внутри других приложений — откроются на своём сайте. Понравившийся пост можно вставить ссылкой во вкладку «🔗 По ссылке».</div>
        <div class="yt-grid">${L.map(([d, n, u]) => `<a class="yt-ch" href="${U.esc(u)}" target="_blank" rel="noopener"><span class="yt-ch-ico">${fav(d, 20)}</span><span class="grow"><b>${U.esc(n)}</b><small>«${U.esc(q)}»</small></span><span class="yt-go">↗</span></a>`).join('')}</div>`;
    },
  };

  window.Social = Social;
})();
