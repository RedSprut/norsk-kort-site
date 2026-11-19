/* ============ 📤 Share the app: system share sheet + every popular network + link + QR ============ */
(function () {
  const enc = encodeURIComponent;
  // the common "share" sign: three connected circles
  const SHARE_SVG = (s = 20) => `<svg class="ico share-ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8.6 10.7 15.4 6.8M8.6 13.3l6.8 3.9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="18" cy="5.5" r="2.9" fill="currentColor"/><circle cx="6" cy="12" r="2.9" fill="currentColor"/><circle cx="18" cy="18.5" r="2.9" fill="currentColor"/></svg>`;
  const url = () => {
    const s = (Store.settings.appUrl || '').trim();
    if (s) return s;
    return /^https:/.test(location.protocol) && !/localhost|127\.0\.0\.1/.test(location.host) ? location.origin + location.pathname.replace(/index\.html$/, '') : 'https://github.com/';
  };
  // the message: Russian or Ukrainian (the people we make it for), and the user may edit it before sharing
  const TEXTS = {
    ru: 'Norsk Kort — учу норвежский с удовольствием: передачи NRK и YouTube с субтитрами и переводом каждого слова, карточки с интервальным повторением, слушаю в наушниках. Бесплатно 🇳🇴',
    uk: 'Norsk Kort — вчу норвезьку із задоволенням: передачі NRK і YouTube із субтитрами та перекладом кожного слова, картки з інтервальним повторенням, слухаю в навушниках. Безкоштовно 🇳🇴',
  };
  const SUBJ = { ru: 'Norsk Kort — учим норвежский', uk: 'Norsk Kort — вчимо норвезьку' };
  let LANG = 'ru', TEXT = TEXTS.ru;
  /* our own sharp brand marks (Simple Icons 11.15.0, CC0 — the last version that still has every one of these, LinkedIn included;
   * fetched once from jsdelivr, then cached by the service worker). Colours: Simple Icons' brand hex, except
   * X / Threads (#000 brand → light mark on the dark theme, see css), TikTok (its pink accent) and Pinterest (current #E60023).
   * kind: 'link' — opens the network's share page; 'app' — the network takes no links from websites:
   * the text + link is copied and the app / site opens, a hint says where to paste it */
  const SI = 'https://cdn.jsdelivr.net/npm/simple-icons@11.15.0/icons/';
  const NETS = u => {
    const t = TEXT, both = `${t} ${u}`;
    return [
      ['telegram', 'Telegram', '#26A5E4', 'link', `https://t.me/share/url?url=${enc(u)}&text=${enc(t)}`],
      ['whatsapp', 'WhatsApp', '#25D366', 'link', `https://wa.me/?text=${enc(both)}`],
      ['instagram', 'Instagram', '#E4405F', 'app', 'https://www.instagram.com/', 'Вставьте в сторис (стикер «Ссылка»), в сообщение или в описание профиля'],
      ['viber', 'Viber', '#7360F2', 'link', `viber://forward?text=${enc(both)}`],
      ['facebook', 'Facebook', '#0866FF', 'link', `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}`],
      ['messenger', 'Messenger', '#00B2FF', 'link', `fb-messenger://share/?link=${enc(u)}`],
      ['tiktok', 'TikTok', '#FE2C55', 'app', 'https://www.tiktok.com/', 'Вставьте в описание профиля или в комментарий к ролику'],
      ['youtube', 'YouTube', '#FF0000', 'app', 'https://studio.youtube.com/', 'Вставьте в описание ролика или канала'],
      ['snapchat', 'Snapchat', '#FFFC00', 'app', 'https://www.snapchat.com/', 'Вставьте в снап (кнопка 🔗) или в сообщение'],
      ['x', 'X (Twitter)', '#e7e9ea', 'link', `https://x.com/intent/post?text=${enc(t)}&url=${enc(u)}`],
      ['threads', 'Threads', '#e7e9ea', 'link', `https://www.threads.net/intent/post?text=${enc(both)}`],
      ['bluesky', 'Bluesky', '#0285FF', 'link', `https://bsky.app/intent/compose?text=${enc(both)}`],
      ['reddit', 'Reddit', '#FF4500', 'link', `https://www.reddit.com/submit?url=${enc(u)}&title=${enc(t)}`],
      ['vk', 'ВКонтакте', '#0077FF', 'link', `https://vk.com/share.php?url=${enc(u)}&title=${enc(t)}`],
      ['odnoklassniki', 'Одноклассники', '#EE8208', 'link', `https://connect.ok.ru/offer?url=${enc(u)}&title=${enc(t)}`],
      ['signal', 'Signal', '#3A76F0', 'app', 'https://signal.me/', 'Вставьте в чат Signal'],
      ['discord', 'Discord', '#5865F2', 'app', 'https://discord.com/app', 'Вставьте в нужный канал или чат'],
      ['linkedin', 'LinkedIn', '#0A66C2', 'link', `https://www.linkedin.com/sharing/share-offsite/?url=${enc(u)}`],
      ['pinterest', 'Pinterest', '#E60023', 'link', `https://pinterest.com/pin/create/button/?url=${enc(u)}&description=${enc(t)}`],
      ['@mail', 'Почта', '#8ab4ff', 'link', `mailto:?subject=${enc(SUBJ[LANG])}&body=${enc(both)}`],
      ['@sms', 'SMS / iMessage', '#34C759', 'link', `sms:?&body=${enc(both)}`],
    ];
  };
  // marks we draw ourselves (no brand needed); a letter stands in while / if a brand mark can't load
  const OWN = {
    '@mail': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>',
    '@sms': '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3.5c-5 0-9 3.3-9 7.4 0 2.3 1.3 4.4 3.3 5.8-.2 1.3-.9 2.6-2 3.5 1.9 0 3.7-.7 5-1.8.9.2 1.8.3 2.7.3 5 0 9-3.3 9-7.4S17 3.5 12 3.5z"/></svg>',
    '@link': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/></svg>',
  };
  const iconCache = {}, iconLoad = {};
  const ico = (slug, n) => OWN[slug] || iconCache[slug] || `<b>${U.esc(n.charAt(0))}</b>`;
  /** a Simple Icons mark as inline SVG; only a plain <svg><path/></svg> drawing is let in (no scripts, handlers, links, other tags) */
  function brandSvg(slug) {
    return iconLoad[slug] || (iconLoad[slug] = fetch(SI + slug + '.svg').then(r => { if (!r.ok) throw new Error('no icon'); return r.text(); }).then(raw => {
      const t = raw.trim().replace(/<title>[^<]*<\/title>/, '').replace(/\srole="img"/, ''); // the tile has its own title / label
      if (!/^<svg[\s>]/.test(t) || /<script|\son[a-z]+\s*=|href\s*=|javascript:/i.test(t) || /<(?!\/?(?:svg|path|g)[\s>/])/i.test(t)) throw new Error('bad icon');
      return (iconCache[slug] = t.replace('<svg ', '<svg fill="currentColor" aria-hidden="true" '));
    }).catch(e => { delete iconLoad[slug]; throw e; })); // offline: tried again next time the window opens
  }
  const httpsUrl = v => { try { const x = new URL(v); return x.protocol === 'https:' && /\.[a-z0-9-]{2,}$/i.test(x.hostname) && !/\s/.test(v); } catch (e) { return false; } };

  const ShareApp = {
    SHARE_SVG,
    async open() {
      const u = url();
      const real = !/github\.com\/?$/.test(u); // until the app has its own address the link is only a placeholder
      // web pages open in a new tab; app links (viber:, fb-messenger:, mailto:, sms:) open in place so no empty tab is left behind
      const tiles = () => NETS(u).map(([slug, n, color, kind, href, hint]) => `<a class="share-net${kind === 'app' ? ' via-copy' : ''}" data-slug="${U.esc(slug)}" style="--brand:${color}" href="${U.esc(href)}"${/^https:/.test(href) ? ' target="_blank" rel="noopener"' : ''}
          ${kind === 'app' ? `data-viacopy="${U.esc(hint || '')}" data-net="${U.esc(n)}"` : ''} title="${kind === 'app' ? U.esc(`${n}: текст со ссылкой скопируется. ${hint || ''}`) : 'Поделиться в ' + U.esc(n)}">
          <span class="share-net-ico" data-ico="${U.esc(slug)}">${ico(slug, n)}</span><span>${U.esc(n)}</span>${kind === 'app' ? '<small>копировать и открыть</small>' : ''}</a>`).join('');
      const m = UI.modal({
        title: `${SHARE_SVG(22)} Поделиться приложением`, cls: 'wide share-app',
        body: `<div class="lib-intro">💙 <span>Расскажите о Norsk Kort друзьям, которые учат норвежский — в любой сети или мессенджере.</span></div>
          ${real ? '' : `<div class="mt-warn"><span>🌐</span><span>У приложения ещё нет своего адреса в интернете — сейчас ссылка ведёт на заглушку. Когда сайт будет опубликован, укажите его адрес здесь:
            <span class="share-url-row"><input class="input" type="url" inputmode="url" autocomplete="url" data-appurl placeholder="https://norskkort.no" value="${U.esc(Store.settings.appUrl || '')}"><button class="btn sm primary" data-appurl-save>Сохранить</button></span></span></div>`}
          <div class="share-msg"><div class="share-msg-head"><span class="small muted">Текст сообщения — можно изменить:</span>
            <span class="seg-mini sm"><button data-lang="ru"${LANG === 'ru' ? ' class="active"' : ''}>🇷🇺 по-русски</button><button data-lang="uk"${LANG === 'uk' ? ' class="active"' : ''}>🇺🇦 українською</button></span></div>
            <textarea class="input" rows="3" data-msg>${U.esc(TEXT)}</textarea></div>
          ${navigator.share ? `<button class="btn primary lg" data-native>${SHARE_SVG(20)} Поделиться… (все приложения телефона / Mac)</button>` : ''}
          <div class="share-nets" data-nets>${tiles()}
            <button class="share-net" data-copy style="--brand:#a5b4fc"><span class="share-net-ico">${OWN['@link']}</span><span>Скопировать ссылку</span></button></div>
          <div class="share-qr-row"><div data-qr class="share-qr"></div>
            <div class="small"><b>Instagram, TikTok, YouTube, Snapchat, Signal, Discord</b> не принимают ссылки с сайтов напрямую: нажмите их кнопку — текст со ссылкой скопируется и откроется приложение, останется вставить. Или покажите этот QR-код в сторис — его сканируют камерой.<br><br>
              <button class="btn sm" data-copy>🔗 Скопировать ссылку</button> <button class="btn sm" data-qrsave>⬇ Скачать QR-код</button>
              <div class="tiny muted" style="margin-top:8px">${U.esc(u)}</div></div></div>`,
      });
      // the sharp brand marks arrive after the first open (a letter stands in meanwhile / offline); later opens draw them at once
      m.$$('[data-ico]').forEach(el => { if (!el.querySelector('svg')) brandSvg(el.dataset.ico).then(s => { el.innerHTML = s; }, () => { /* the letter stays */ }); });
      // a new text only changes the links: the tiles (and their marks) stay as they are
      const relink = () => { for (const [slug, , , , href] of NETS(u)) { const a = m.$(`.share-net[data-slug="${slug}"]`); if (a) a.href = href; } };
      const copy = async (quiet) => { try { await navigator.clipboard.writeText(`${TEXT} ${u}`); if (!quiet) UI.toast('🔗 Текст со ссылкой скопирован', 'good', 1800); return true; } catch (e) { UI.toast(u, '', 6000); return false; } };
      const saveUrl = () => {
        const v = (m.$('[data-appurl]').value || '').trim();
        if (v && !httpsUrl(v)) { UI.toast('Адрес должен начинаться с https:// — например https://norskkort.no', 'warn'); m.$('[data-appurl]').focus(); return; }
        Store.setSetting('appUrl', v); m.close(); UI.toast(v ? 'Адрес сохранён' : 'Адрес убран', 'good'); setTimeout(() => ShareApp.open(), 250);
      };
      m.el.addEventListener('input', e => { if (e.target.matches('[data-msg]')) { TEXT = e.target.value.trim() || TEXTS[LANG]; relink(); } });
      m.el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-appurl]')) { e.preventDefault(); saveUrl(); } });
      m.el.addEventListener('click', async e => {
        const lg = e.target.closest('.share-msg [data-lang]');
        if (lg) { LANG = lg.dataset.lang; TEXT = TEXTS[LANG]; m.$('[data-msg]').value = TEXT; m.$$('.share-msg [data-lang]').forEach(b => b.classList.toggle('active', b === lg)); relink(); return; }
        if (e.target.closest('[data-appurl-save]')) { saveUrl(); return; }
        // networks that take no links from websites: copy first, then open the app / site, and say where to paste
        const vc = e.target.closest('[data-viacopy]');
        if (vc) { e.preventDefault(); if (await copy(true)) UI.toast(`📋 Текст со ссылкой скопирован. ${vc.dataset.net}: ${vc.dataset.viacopy}.`, 'good', 6000); window.open(vc.getAttribute('href'), '_blank', 'noopener'); return; }
        if (e.target.closest('[data-copy]')) { copy(); return; }
        if (e.target.closest('[data-native]')) { try { await navigator.share({ title: 'Norsk Kort', text: TEXT, url: u }); } catch (err) { /* cancelled */ } return; }
        if (e.target.closest('[data-qrsave]')) {
          const svg = m.$('[data-qr] svg'); if (!svg) return;
          const a = document.createElement('a'); a.href = 'data:image/svg+xml;charset=utf-8,' + enc(svg.outerHTML); a.download = 'norsk-kort-qr.svg'; a.click();
        }
      });
      try {
        await U.loadScript('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js');
        const q = window.qrcode(0, 'M'); q.addData(u); q.make();
        m.$('[data-qr]').innerHTML = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
      } catch (e) { m.$('[data-qr]').textContent = 'QR недоступен офлайн'; }
    },
  };

  window.ShareApp = ShareApp;
})();
