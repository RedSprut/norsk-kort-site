/* ============ 🎬 «Как пользоваться»: the animated «mini screen» of a topic (loaded by js/help.js on first use) ============
 *  HelpAnim.mount(host, topic, { list, hand, tip, ratio }) → { jump(k), play(), pause(), destroy() }
 *    host  — the box on the topic page; list — its <ol> of steps (the row of the playing step lights up: li.now / li.done)
 *    hand  — our hand's <svg> markup (js/help.js), tip — [x, y] of the fingertip inside it (0…1), ratio — height / width
 *  A topic gets a demo by itself from its `steps` («…» quoted words become the button captions on the mini screen);
 *  richer scripts for the main topics are in DEMOS below (a module may also give its topic `demo: [scenes]`).
 *  A scene: { s: step index, html: the panel, run: async A => { await A.tap('.x'); A.add('.y', 'on'); await A.wait(500); … } }
 *  ▶/⏸, ↺, speed (1× → 1,5× → 0,75×); it pauses itself when scrolled away or the tab is hidden; reduced motion — no autoplay, no glides.
 */
(function () {
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plain = html => { const d = document.createElement('div'); d.innerHTML = String(html || ''); return (d.textContent || '').replace(/\s+/g, ' ').trim(); };
  const quotes = html => [...plain(html).matchAll(/«([^»]{1,42})»/g)].map(m => m[1].trim()).filter(Boolean);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const STOP = { stop: true };
  const TG = () => (window.Telegram && Telegram.TG_SVG ? Telegram.TG_SVG(18) : '✈️');
  const SIC = () => (window.NavIcons ? NavIcons.statsIco() : '📊'); // 📊 → the drawn «Статистика» bars (js/app.js NavIcons)
  const ico = (i, t) => (i === 'tg' ? TG() : i === '📊' ? SIC() : i === 'tap' || i === '👆' || i === '👉' ? esc((t && t.icon !== 'tg' && t.icon) || '✨') : esc(i));
  /** a short label from a step without «…»: up to the first comma / dot, ~30 letters */
  const short = html => {
    let p = plain(html).replace(/^(нажмите|откройте|выберите|найдите)\s+/i, m => m);
    const cut = p.search(/[.,:;—(]/);
    if (cut > 6) p = p.slice(0, cut);
    if (p.length > 32) p = p.slice(0, 30).replace(/\s+\S*$/, '') + '…';
    return p;
  };
  const sk = (w = 70) => `<i class="hd-sk" style="--w:${w}%"></i>`;
  const row = (icon, a = 64, b = 40) => `<div class="hd-row"><span class="hd-ri">${icon}</span><span class="hd-rt">${sk(a)}${sk(b)}</span></div>`;
  const top = (title, icon = '') => `<div class="hd-top"><span class="hd-back" aria-hidden="true">‹</span><b>${title}</b><span class="hd-ti">${icon}</span></div>`;

  /* ---------------- a demo from any topic's steps ---------------- */
  function generic(t) {
    const steps = Array.isArray(t.steps) ? t.steps : [];
    const tIcon = ico(t.icon, t);
    const name = esc(String(t.title || '').split(/[—:,(]/)[0].trim().split(' ').slice(0, 3).join(' '));
    return steps.map(([i, html], k) => {
      const q = quotes(html);
      const label = q.length ? esc(q[0]) : esc(short(html));
      const more = q.slice(1, 3).map(x => `<span class="hd-chip">${esc(x)}</span>`).join('');
      const si = ico(i, t);
      const v = q.length ? k % 3 : 2;
      let body;
      if (v === 0) body = `${row(si, 70, 45)}${row(tIcon, 58, 34)}<span class="hd-btn hd-t">${label}</span>${more ? `<div class="hd-chips">${more}</div>` : ''}`;
      else if (v === 1) {
        const others = steps.map(x => x[0]).filter((x, j) => j !== k).slice(0, 3);
        body = `<div class="hd-tiles"><span class="hd-tile hd-t"><span class="hd-te">${si}</span><b>${label}</b></span>${others.map(x => `<span class="hd-tile dim"><span class="hd-te">${ico(x, t)}</span>${sk(60)}</span>`).join('')}</div>${more ? `<div class="hd-chips">${more}</div>` : ''}`;
      } else body = `<div class="hd-big"><span class="hd-bige">${si}</span>${q.length ? sk(66) + sk(44) : `<b class="hd-bigt">${label}</b>`}<span class="hd-btn hd-t ${q.length ? '' : 'ghost'}">${q.length ? label : 'OK'}</span></div>${more ? `<div class="hd-chips">${more}</div>` : ''}`;
      return { s: k, html: top(name, tIcon) + `<div class="hd-body">${body}</div>`,
        run: async A => { await A.wait(380); await A.tap('.hd-t'); A.add('.hd-t', 'done'); await A.wait(900); } };
    });
  }

  /* ---------------- richer scripts for the main topics ---------------- */
  const tab = on => `<div class="hd-tabbar"><span class="hd-tab">📚<small>Колоды</small></span><span class="hd-tab t-study ${on ? 'on' : ''}">▶<small>Учить</small></span><span class="hd-tab">${SIC()}<small>Статистика</small></span></div>`;
  const card = (front, back, ex) => `<div class="hd-flash"><div class="hd-fl-in"><div class="hd-face f"><small>🔊</small><b>${front}</b></div><div class="hd-face b"><b>${back}</b><small>${ex}</small></div></div></div>`;
  const appBar = right => `<div class="hd-appbar"><span class="hd-logo">N</span><b>Norsk Kort</b><span class="grow"></span>${right}</div>`;
  const wave = (n = 9) => `<span class="hd-wave">${Array.from({ length: n }, (x, i) => `<i style="--k:${i}"></i>`).join('')}</span>`;
  const video = sub => `<div class="hd-video"><span class="hd-sun"></span><span class="hd-mnt"></span><span class="hd-sea"></span><span class="hd-vbadge">NRK</span><span class="hd-pause">⏸</span>${sub || ''}</div>`;
  const WORDS = [['Jeg', 'я'], ['har', 'имею'], ['det', 'это'], ['bra,', 'хорошо'], ['takk.', 'спасибо']];
  const subLine = () => `<div class="hd-subs"><div class="hd-sl">${WORDS.map(([w, r], i) => `<span class="hd-w" data-w="${i}">${w}<i>${r}</i></span>`).join(' ')}</div><div class="hd-slr">У меня всё хорошо, спасибо.</div></div>`;

  const DEMOS = {
    study: [
      { s: 0, html: top('Колоды', '📚') + `<div class="hd-body">${row('🇳🇴', 60, 30).replace('</span></div>', '</span><span class="hd-badge">12</span></div>')}${row('🍎', 46, 28).replace('</span></div>', '</span><span class="hd-badge">5</span></div>')}${row('🏠', 52, 36)}</div>${tab(false)}`,
        run: async A => { await A.wait(400); await A.tap('.t-study'); A.add('.t-study', 'on'); await A.wait(600); } },
      { s: 1, html: top('Учить · 3 из 12', '▶') + `<div class="hd-body"><span class="hd-prog"><i style="--p:.25"></i></span>${card('en hund', 'собака', 'Hunden min heter Rex.')}<span class="hd-think">?</span></div>`,
        run: async A => { await A.wait(300); await A.point('.hd-flash', { dx: .78, dy: .9 }); A.add('.hd-think', 'on'); await A.wait(1500); } },
      { s: 2, html: top('Учить · 3 из 12', '▶') + `<div class="hd-body"><span class="hd-prog"><i style="--p:.25"></i></span>${card('en hund', 'собака', 'Hunden min heter Rex.')}</div>`,
        run: async A => { await A.wait(300); await A.tap('.hd-flash'); A.add('.hd-flash', 'flip'); await A.wait(1300); } },
      { s: 3, html: top('Учить · 3 из 12', '▶') + `<div class="hd-body"><span class="hd-prog"><i style="--p:.25"></i></span>${card('en hund', 'собака', 'Hunden min heter Rex.').replace('hd-flash', 'hd-flash flip')}<div class="hd-ans"><span class="hd-btn bad">✗ Не знаю</span><span class="hd-btn good hd-know">✓ Знаю</span></div><span class="hd-toast good up">+1 · следующая карточка</span></div>`,
        run: async A => { await A.wait(350); await A.tap('.hd-know'); A.add('.hd-flash', 'away'); A.add('.hd-toast', 'on'); A.add('.hd-prog', 'more'); await A.wait(1300); } },
      { s: 4, html: top('Когда повторить', '📅') + `<div class="hd-body"><div class="hd-cal">${['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((d, i) => `<span class="hd-day ${i === 0 ? 'today' : ''} ${i === 4 ? 'later' : ''}"><small>${d}</small><b>${17 + i}</b></span>`).join('')}<span class="hd-wchip">hund</span></div><p class="hd-note">Вспомнили — слово вернётся <b>через 4 дня</b>, потом через неделю, месяц…</p></div>`,
        run: async A => { await A.wait(500); await A.point('.hd-wchip', { dy: .9 }); A.add('.hd-cal', 'move'); await A.wait(500); await A.point('.hd-day.later', { dy: .9, follow: true }); await A.wait(1300); } },
    ],
    listen: [
      { s: 0, html: appBar('<span class="hd-pill hd-listen">🎧 Слушать</span><span class="hd-dotbtn">⋯</span>') + `<div class="hd-body">${row('🃏', 60, 34)}${row('📖', 50, 30)}${row('📺', 56, 38)}</div>`,
        run: async A => { await A.wait(350); await A.tap('.hd-listen'); await A.wait(500); } },
      { s: 1, html: top('Что послушать', '🎧') + `<div class="hd-body"><div class="hd-tiles five">${[['🗂', 'Колоды'], ['📖', 'Книги'], ['📰', 'Новости'], ['📻', 'Радио'], ['🎙', 'Подкасты']].map(([e, l], i) => `<span class="hd-tile ${i === 0 ? 'hd-t' : ''}"><span class="hd-te">${e}</span><b>${l}</b></span>`).join('')}</div></div>`,
        run: async A => { await A.wait(450); await A.tap('.hd-t'); A.add('.hd-t', 'done'); await A.wait(500); } },
      { s: 2, html: top('Сейчас играет', '🎧') + `<div class="hd-body hd-np"><span class="hd-npw"><b>et hus</b><small>дом</small></span>${wave(11)}<div class="hd-np-btns"><span class="hd-rb">⏮</span><span class="hd-rb big hd-pp">▶</span><span class="hd-rb">⏭</span></div></div>`,
        run: async A => { await A.wait(350); await A.tap('.hd-pp'); A.add('.hd-np', 'play'); A.text('.hd-pp', '⏸'); await A.wait(1700); } },
      { s: 3, html: top('Сейчас играет', '🎧') + `<div class="hd-body hd-np play"><span class="hd-npw"><b>et hus</b><small>дом</small></span>${wave(11)}<div class="hd-chips c3"><span class="hd-chip hd-slow">🐢 Медленно</span><span class="hd-chip on hd-norm">Обычно</span><span class="hd-chip">Быстро</span></div><div class="hd-chips"><span class="hd-chip">🔀 🇳🇴 → 🇷🇺</span><span class="hd-chip">🧠 Вспомни сам</span></div></div>`,
        run: async A => { await A.wait(350); await A.tap('.hd-slow'); A.rm('.hd-norm', 'on'); A.add('.hd-slow', 'on'); A.add('.hd-np', 'slow'); await A.wait(1300); } },
      { s: 4, html: top('Сейчас играет', '🎧') + `<div class="hd-body hd-np play"><span class="hd-npw"><b>et hus</b><small>дом</small></span>${wave(11)}<span class="hd-btn hd-darkb">🌑 Тёмный экран</span><div class="hd-dark"><span>🌙</span>${wave(7)}<small>Звук продолжится — телефон можно в карман</small></div></div>`,
        run: async A => { await A.wait(350); await A.tap('.hd-darkb'); A.add('.hd-dark', 'on'); await A.wait(400); A.handAway(); await A.wait(1900); } },
    ],
    interp: [
      { s: 0, html: top('Переводчик', '🗣') + `<div class="hd-body hd-center"><span class="hd-buds">🎧<i class="hd-ok">✓</i></span><b class="hd-bigt">Наденьте наушники</b><small class="hd-muted">AirPods или любые другие</small></div>`,
        run: async A => { await A.wait(300); await A.tap('.hd-buds'); A.add('.hd-buds', 'on'); await A.wait(900); } },
      { s: 1, html: appBar('<span class="hd-pill hd-ip">🗣 Переводчик</span>') + `<div class="hd-body">${row('🃏', 60, 34)}${row('📖', 50, 30)}${row('🎧', 56, 38)}</div>`,
        run: async A => { await A.wait(350); await A.tap('.hd-ip'); await A.wait(500); } },
      { s: 2, html: top('Переводчик', '🗣') + `<div class="hd-body">${row('🎙', 56, 30)}${row('🎧', 44, 30)}<div class="hd-dlg"><b>Разрешить доступ к микрофону?</b><div class="hd-ans"><span class="hd-btn ghost">Запретить</span><span class="hd-btn hd-allow">Разрешить</span></div></div></div>`,
        run: async A => { await A.wait(400); await A.tap('.hd-allow'); A.add('.hd-dlg', 'gone'); await A.wait(700); } },
      { s: 3, html: top('Переводчик · слушаю', '🎙') + `<div class="hd-body hd-chat"><div class="hd-bub no"><small>🇳🇴</small><span class="hd-typed" data-text="Hva kan jeg hjelpe deg med?"></span></div><div class="hd-bub ru"><small>🇷🇺 в наушниках</small><b>Чем я могу вам помочь?</b>${wave(5)}</div></div>`,
        run: async A => { await A.type('.hd-typed', 'Hva kan jeg hjelpe deg med?'); await A.wait(250); A.add('.hd-bub.ru', 'on'); await A.wait(500); await A.point('.hd-bub.ru', { dx: .85, dy: .8 }); await A.wait(1300); } },
      { s: 4, html: top('Переводчик · слушаю', '🎙') + `<div class="hd-body hd-chat"><div class="hd-bub me"><small>Вы, по-русски</small><span class="hd-typed" data-text="Мне нужен хлеб"></span></div><div class="hd-bub no2"><small>🇳🇴 скажите так</small><b>Jeg trenger brød.</b></div><div class="hd-chips hd-sugg"><span class="hd-chip">🤖 Takk!</span><span class="hd-chip">🤖 Hvor er det?</span></div></div>`,
        run: async A => { await A.type('.hd-typed', 'Мне нужен хлеб'); await A.wait(250); A.add('.hd-bub.no2', 'on'); await A.wait(500); A.add('.hd-sugg', 'on'); await A.point('.hd-bub.no2', { dx: .8, dy: .8 }); await A.wait(1400); } },
    ],
    video: [
      { s: 0, html: top('Главная', '📚') + `<div class="hd-body"><div class="hd-tiles">${[['📺', 'NRK TV', 'hd-t'], ['▶', 'YouTube', ''], ['📻', 'NRK Радио', ''], ['📰', 'Новости', '']].map(([e, l, c]) => `<span class="hd-tile ${c}"><span class="hd-te">${e}</span><b>${l}</b></span>`).join('')}</div></div>`,
        run: async A => { await A.wait(400); await A.tap('.hd-t'); A.add('.hd-t', 'done'); await A.wait(500); } },
      { s: 1, html: top('NRK TV', '📺') + `<div class="hd-body"><span class="hd-field">🔎 <span class="hd-typed"></span><i class="hd-caret"></i></span><div class="hd-res">${row('📺', 64, 40).replace('hd-row', 'hd-row hd-r1')}${row('📺', 52, 36)}</div></div>`,
        run: async A => { await A.wait(250); await A.tap('.hd-field', { quick: true }); await A.type('.hd-typed', 'Nytt på nytt'); A.add('.hd-res', 'on'); await A.wait(500); await A.tap('.hd-r1'); await A.wait(400); } },
      { s: 2, html: top('Nytt på nytt', '📺') + `<div class="hd-body hd-vbody">${video(subLine())}<div class="hd-chips c3"><span class="hd-chip on hd-m1">Виден</span><span class="hd-chip hd-m2">Слово (перевод)</span><span class="hd-chip">Скрыт</span></div></div>`,
        run: async A => { await A.wait(300); A.add('.hd-subs', 'on'); await A.wait(1200); await A.tap('.hd-m2'); A.rm('.hd-m1', 'on'); A.add('.hd-m2', 'on'); A.add('.hd-subs', 'words');
          for (let i = 0; i < WORDS.length; i++) { A.add(`.hd-w[data-w="${i}"]`, 'tr'); await A.wait(330); } await A.wait(1100); } },
      { s: 3, html: top('Nytt på nytt', '📺') + `<div class="hd-body hd-vbody">${video(subLine().replace('hd-subs', 'hd-subs on'))}<div class="hd-pop"><b>bra</b> — хорошо <span class="hd-btn sm">➕ В карточку</span></div></div>`,
        run: async A => { await A.wait(300); await A.tap('.hd-w[data-w="3"]'); A.add('.hd-w[data-w="3"]', 'sel'); A.add('.hd-video', 'paused'); A.add('.hd-pop', 'on'); await A.wait(500); await A.tap('.hd-pop .hd-btn'); A.add('.hd-pop .hd-btn', 'done'); await A.wait(900); } },
      { s: 4, html: top('Nytt på nytt', '📺') + `<div class="hd-body hd-vbody">${video(subLine().replace('hd-subs', 'hd-subs on').replace('<div class="hd-sl">', '<div class="hd-sl"><span class="hd-add">➕</span>'))}<div class="hd-newcard"><b>Jeg har det bra, takk.</b><small>У меня всё хорошо, спасибо. 🔊 звук из видео</small></div><span class="hd-toast good">Карточка готова ✓</span></div>`,
        run: async A => { await A.wait(300); await A.tap('.hd-add'); A.add('.hd-newcard', 'on'); await A.wait(500); A.add('.hd-toast', 'on'); await A.wait(1500); } },
    ],
    telegram: [
      { s: 0, html: `<div class="hd-top tgb"><b>${TG()} Telegram</b></div><div class="hd-body"><span class="hd-field">🔎 <span class="hd-typed"></span><i class="hd-caret"></i></span><div class="hd-res">${['Norsk med Anna', 'Lær norsk 🇳🇴', 'Норвежский каждый день'].map((n, i) => `<div class="hd-row ${i === 0 ? 'hd-r1' : ''}"><span class="hd-ri av" style="--a:${i * 70}">${n[0]}</span><span class="hd-rt"><b>${n}</b>${sk(50)}</span></div>`).join('')}</div></div>`,
        run: async A => { await A.wait(250); await A.type('.hd-typed', 'norsk'); A.add('.hd-res', 'on'); await A.wait(600); await A.point('.hd-r1', { dx: .7 }); await A.wait(900); } },
      { s: 1, html: top('Норвежские каналы', '📢') + `<div class="hd-body">${['Norsk med Anna', 'Lær norsk'].map((n, i) => `<div class="hd-row"><span class="hd-ri av" style="--a:${i * 70}">${n[0]}</span><span class="hd-rt"><b>${n}</b>${sk(46)}</span><span class="hd-btn sm ${i === 0 ? 'hd-t' : 'ghost'}">${i === 0 ? '➕ Добавить' : 'Открыть'}</span></div>`).join('')}</div>`,
        run: async A => { await A.wait(400); await A.tap('.hd-t'); A.add('.hd-t', 'done'); A.text('.hd-t', '✓ Добавлен'); await A.wait(1000); } },
      { s: 2, html: top('Подключить Telegram', '🔐') + `<div class="hd-body hd-center"><span class="hd-qr">${Array.from({ length: 49 }, (x, i) => `<i class="${(i * 7 + (i % 5) * 3) % 3 === 0 || [0, 1, 7, 8, 5, 6, 12, 13, 35, 36, 42, 43].includes(i) ? 'on' : ''}"></i>`).join('')}</span><small class="hd-muted">Наведите камеру Telegram на телефоне</small><span class="hd-btn hd-t">🔐 Подключить</span></div>`,
        run: async A => { await A.wait(400); await A.tap('.hd-t'); A.add('.hd-t', 'done'); A.text('.hd-t', '✓ Подключено'); await A.wait(1000); } },
      { s: 3, html: top('Norsk med Anna', TG()) + `<div class="hd-body hd-chat"><div class="hd-bub tg">hus — дом<br>bil — машина<br>skole — школа</div><span class="hd-btn hd-t">🗂 Создать карточки из чата</span><div class="hd-pairs">${[['hus', 'дом'], ['bil', 'машина'], ['skole', 'школа']].map(([a, b], i) => `<span class="hd-pair" style="--k:${i}">${a} — ${b}</span>`).join('')}</div></div>`,
        run: async A => { await A.wait(400); await A.tap('.hd-t'); A.add('.hd-pairs', 'on'); await A.wait(1500); } },
      { s: 4, html: top('Проверка пар', '🛡') + `<div class="hd-body"><div class="hd-pairs on chk">${[['hus', 'дом', 1], ['bil', 'машина', 1], ['katt', 'собака', 0]].map(([a, b, ok], i) => `<span class="hd-pair ${ok ? 'ok' : 'bad'}" style="--k:${i}">${a} — <s>${b}</s>${ok ? '' : ' <b>кошка</b>'}<i>${ok ? '✓' : '✗'}</i></span>`).join('')}</div><p class="hd-note">Каждая пара сверяется с переводчиком — ошибки отсеиваются.</p></div>`,
        run: async A => { await A.wait(300); A.add('.hd-pairs', 'go'); await A.wait(1300); await A.point('.hd-pair.bad', { dx: .8 }); await A.wait(1300); } },
    ],
    ai: [
      { s: 0, html: appBar('<span class="hd-pill hd-ai">🤖 <small>выкл</small></span><span class="hd-dotbtn">?</span>') + `<div class="hd-body">${row('🃏', 60, 34)}${row('📖', 50, 30)}${row('📺', 56, 38)}</div>`,
        run: async A => { await A.wait(350); await A.tap('.hd-ai'); await A.wait(500); } },
      { s: 1, html: top('Нейросеть', '🤖') + `<div class="hd-body">${[['✨', 'Google Gemini', 'бесплатно'], ['⚡', 'Groq', 'бесплатно']].map(([e, n, f], i) => `<div class="hd-row ${i === 0 ? 'hd-r1' : ''}"><span class="hd-ri">${e}</span><span class="hd-rt"><b>${n}</b><small>${f}</small></span>${i === 0 ? '<span class="hd-btn sm hd-t">🔑 Получить ключ</span>' : ''}</div>`).join('')}</div>`,
        run: async A => { await A.wait(400); await A.tap('.hd-t'); A.add('.hd-t', 'done'); await A.wait(800); } },
      { s: 2, html: top('Настройки → Нейросети', '⚙️') + `<div class="hd-body"><small class="hd-muted">Ключ Gemini</small><span class="hd-field"><span class="hd-typed"></span><i class="hd-caret"></i></span><span class="hd-btn hd-t">Проверить</span><span class="hd-toast good">✓ Работает</span></div>`,
        run: async A => { await A.wait(250); await A.type('.hd-typed', 'AIza••••••••••••', 40); await A.wait(250); await A.tap('.hd-t'); A.add('.hd-toast', 'on'); await A.wait(1300); } },
      { s: 3, html: top('Проверить карту', '✨') + `<div class="hd-body"><div class="hd-newcard on"><b>ønska</b><small class="hd-fix"><s>желание</s> <b>хотел</b> ✓</small></div><p class="hd-note">Перевод по смыслу всей фразы, примеры, формы слов, объяснения.</p><span class="hd-spark">✦</span><span class="hd-spark b">✦</span></div>`,
        run: async A => { await A.wait(400); await A.tap('.hd-newcard'); A.add('.hd-fix', 'on'); A.add('.hd-body', 'sparks'); await A.wait(1500); } },
    ],
    library: [
      { s: 0, html: top('Главная', '📚') + `<div class="hd-body">${row('🃏', 60, 34)}<span class="hd-btn hd-t">📚 Библиотека — читать и слушать</span>${row('📺', 56, 38)}</div>`,
        run: async A => { await A.wait(350); await A.tap('.hd-t'); await A.wait(500); } },
      { s: 1, html: top('Библиотека', '📚') + `<div class="hd-body"><div class="hd-now"><span class="hd-cover">Sult</span><span class="hd-rt"><b>Читаю сейчас</b><small>Knut Hamsun · 46%</small><span class="hd-prog"><i style="--p:.46"></i></span></span></div><span class="hd-btn hd-t">▶ Продолжить</span><div class="hd-page"><span>Det var i den tid jeg gikk omkring</span> <mark>og sultet i Kristiania…</mark></div></div>`,
        run: async A => { await A.wait(400); await A.tap('.hd-t'); A.add('.hd-page', 'on'); await A.wait(1500); } },
      { s: 2, html: top('Библиотека', '📚') + `<div class="hd-body"><div class="hd-chips c3"><span class="hd-chip">Читаю</span><span class="hd-chip hd-t">📥 Мои книги</span><span class="hd-chip">🎧 Слушать</span></div><div class="hd-res">${['📕 Sult.epub', '📘 Norsk 1.pdf', '📗 Eventyr.txt'].map(b => `<div class="hd-row"><span class="hd-rt"><b>${b}</b>${sk(40)}</span></div>`).join('')}</div></div>`,
        run: async A => { await A.wait(350); await A.tap('.hd-t'); A.add('.hd-t', 'on'); A.add('.hd-res', 'on'); await A.wait(1300); } },
      { s: 3, html: top('Слушать', '🎧') + `<div class="hd-body hd-np play"><span class="hd-npw"><b>Sult</b><small>глава 1</small></span>${wave(11)}<div class="hd-chips c3"><span class="hd-chip">🌙 10 мин</span><span class="hd-chip hd-t">🌙 30 мин</span><span class="hd-chip">До конца главы</span></div></div>`,
        run: async A => { await A.wait(350); await A.tap('.hd-t'); A.add('.hd-t', 'on'); await A.wait(1300); } },
      { s: 4, html: top('Найти книгу', '🔎') + `<div class="hd-body"><span class="hd-field">🔎 <span class="hd-typed"></span><i class="hd-caret"></i></span><div class="hd-res">${['Sult — бесплатно', 'Markens grøde'].map((b, i) => `<div class="hd-row ${i === 0 ? 'hd-r1' : ''}"><span class="hd-ri">📖</span><span class="hd-rt"><b>${b}</b>${sk(40)}</span></div>`).join('')}</div></div>`,
        run: async A => { await A.wait(250); await A.type('.hd-typed', 'Hamsun'); A.add('.hd-res', 'on'); await A.wait(500); await A.tap('.hd-r1'); await A.wait(900); } },
    ],
    reader: [
      { s: 0, html: top('Читалка', '📖') + `<div class="hd-body">${row('📕', 54, 30)}<span class="hd-btn hd-t">➕ Добавить книгу</span><span class="hd-file">📕 Sult.epub</span></div>`,
        run: async A => { await A.wait(350); await A.tap('.hd-t'); A.add('.hd-file', 'on'); await A.wait(1000); } },
      { s: 1, html: top('Sult', '<span class="hd-aa">Aa</span>') + `<div class="hd-body"><div class="hd-page on"><span>Det var i den tid jeg gikk omkring og sultet i Kristiania…</span></div><div class="hd-slider"><small>A</small><span class="hd-track"><i></i></span><b>A</b></div></div>`,
        run: async A => { await A.wait(350); await A.tap('.hd-aa'); A.add('.hd-slider', 'on'); await A.wait(300); A.add('.hd-page', 'big'); A.add('.hd-slider', 'moved'); await A.wait(1200); } },
      { s: 2, html: top('Sult', '▶') + `<div class="hd-body"><div class="hd-page on"><mark>Det var i den tid jeg gikk omkring</mark><small class="hd-ru">Это было в то время, когда я бродил…</small></div><div class="hd-np-btns"><span class="hd-chip">🇳🇴 голос</span><span class="hd-rb big hd-pp">▶</span><span class="hd-chip">🇷🇺 голос</span></div></div>`,
        run: async A => { await A.wait(350); await A.tap('.hd-pp'); A.text('.hd-pp', '⏸'); A.add('.hd-page', 'reading'); await A.wait(1700); } },
      { s: 3, html: top('Sult', '📖') + `<div class="hd-body"><div class="hd-page on">Det var i den tid jeg gikk omkring og <span class="hd-word">sultet</span> i Kristiania…</div><div class="hd-pop"><b>sulte</b> — голодать <span class="hd-btn sm">➕ В карточки</span></div></div>`,
        run: async A => { await A.wait(350); await A.tap('.hd-word'); A.add('.hd-word', 'sel'); A.add('.hd-pop', 'on'); await A.wait(500); await A.tap('.hd-pop .hd-btn'); A.add('.hd-pop .hd-btn', 'done'); await A.wait(900); } },
      { s: 4, html: top('Читалка', '🔖') + `<div class="hd-body">${row('📕', 54, 30)}<div class="hd-dlg on"><b>Продолжить с того же места?</b><div class="hd-ans"><span class="hd-btn ghost">Начать сначала</span><span class="hd-btn hd-t">🔖 Продолжить</span></div></div></div>`,
        run: async A => { await A.wait(400); await A.tap('.hd-t'); A.add('.hd-dlg', 'gone'); await A.wait(800); } },
    ],
  };
  DEMOS.audiocourse = null; // the generic one fits

  /* 🎤 «Бегущая строка»: the word lights up (with its translation) the moment it is said */
  const karLine = (cls = '') => `<div class="hd-subs on words hd-kar ${cls}"><span class="hd-voice">🔊${wave(5)}</span><span class="hd-knote">⏳ слова опаздывают</span><div class="hd-sl">${WORDS.map(([w, r], i) => `<span class="hd-w" data-w="${i}">${w}<i>${r}</i></span>`).join(' ')}</div><div class="hd-slr">У меня всё хорошо, спасибо.</div></div>`;
  const karBar = (on, mode) => `<div class="hd-kbar"><span class="hd-chip hd-kbtn ${on ? 'on' : ''}">🎤 Бегущая строка</span>${on ? `<span class="hd-chip hd-khl ${mode === 'hl' ? 'on' : ''}">✨ Подсветка</span><span class="hd-chip hd-kwbw ${mode === 'wbw' ? 'on' : ''}">👣 Слово за словом</span>` : ''}</div>`;
  /** the words one after another, as if said: kp — said, kc — now */
  const sayWords = async (A, ms = 430) => {
    A.rm('.hd-w', 'kp'); A.rm('.hd-w', 'kc'); A.add('.hd-kar', 'go');
    if (A.$('.hd-kar.late')) await A.wait(420); // the voice is ahead of the words
    for (let i = 0; i < WORDS.length; i++) {
      if (i) { A.rm(`.hd-w[data-w="${i - 1}"]`, 'kc'); A.add(`.hd-w[data-w="${i - 1}"]`, 'kp'); }
      A.add(`.hd-w[data-w="${i}"]`, 'kc');
      await A.wait(i === 3 ? ms + 260 : ms); // «bra,» — a comma: a short pause after it
    }
    A.rm('.hd-w', 'kc'); A.add('.hd-w', 'kp'); A.rm('.hd-kar', 'go');
  };
  DEMOS.karaoke = [
    { s: 0, html: top('Nytt på nytt', '📺') + `<div class="hd-body hd-vbody">${video(karLine('idle'))}${karBar(false)}</div>`,
      run: async A => { await A.wait(500); await A.tap('.hd-kbtn'); A.add('.hd-kbtn', 'on'); A.rm('.hd-kar', 'idle'); await A.wait(250); await sayWords(A); await A.wait(500); } },
    { s: 1, html: top('Nytt på nytt', '📺') + `<div class="hd-body hd-vbody">${video(karLine())}${karBar(true, 'hl')}</div>`,
      run: async A => { await A.wait(300); await A.point('.hd-khl', { dy: 0.9 }); await A.wait(200); A.handAway(); await sayWords(A); await A.wait(400); await sayWords(A, 380); await A.wait(500); } },
    { s: 2, html: top('Nytt på nytt', '📺') + `<div class="hd-body hd-vbody">${video(karLine())}${karBar(true, 'hl')}</div>`,
      run: async A => { await A.wait(300); await A.tap('.hd-kwbw'); A.rm('.hd-khl', 'on'); A.add('.hd-kwbw', 'on'); A.add('.hd-kar', 'wbw'); await A.wait(200); A.handAway(); await sayWords(A, 470); await A.wait(700); } },
    { s: 3, html: top('Nytt på nytt', '📺') + `<div class="hd-body hd-vbody">${video(karLine('late'))}<div class="hd-ksh"><small>⏱ Сдвиг слов</small><span class="hd-rb hd-kmin">−</span><b class="hd-kv">0,0 с</b><span class="hd-rb hd-kplus">+</span></div></div>`,
      run: async A => {
        await A.wait(300); await sayWords(A, 400); await A.wait(250);
        await A.tap('.hd-kmin'); A.text('.hd-kv', '−0,1 с'); await A.wait(200); await A.tap('.hd-kmin', { quick: true }); A.text('.hd-kv', '−0,2 с'); A.rm('.hd-kar', 'late'); A.add('.hd-kv', 'ok'); A.text('.hd-knote', '✓ вместе с голосом'); A.add('.hd-knote', 'ok');
        await A.wait(250); A.handAway(); await sayWords(A, 400); await A.wait(600);
      } },
    { s: 4, html: top('Aa Вид субтитров', 'Aa') + `<div class="hd-body"><small class="hd-muted">🎤 Бегущая строка</small><div class="hd-chips c3"><span class="hd-chip hd-koff">Выкл</span><span class="hd-chip hd-khl on">✨ Подсветка</span><span class="hd-chip hd-kwbw">👣 Слово за словом</span></div>${video(karLine())}</div>`,
      run: async A => { await A.wait(350); await A.tap('.hd-kwbw'); A.rm('.hd-khl', 'on'); A.add('.hd-kwbw', 'on'); A.add('.hd-kar', 'wbw'); await A.wait(150); A.handAway(); await sayWords(A, 400); await A.wait(800); } },
  ];

  /* ---------------- the player ---------------- */
  function mount(host, t, o = {}) {
    const steps = Array.isArray(t.steps) ? t.steps : [];
    if (!steps.length) return null;
    const custom = typeof t.demo === 'function' ? t.demo() : Array.isArray(t.demo) ? t.demo : DEMOS[t.id];
    const gen = generic(t);
    let scenes = custom && custom.length ? custom.filter(sc => (sc.s | 0) < steps.length) : gen;
    // a step the script does not show (the topic got a new step) — its generic scene, in its place
    if (scenes !== gen) {
      const has = new Set(scenes.map(sc => sc.s | 0));
      scenes = scenes.concat(gen.filter(sc => !has.has(sc.s))).map((sc, i) => [sc, i]).sort((a, b) => (a[0].s | 0) - (b[0].s | 0) || a[1] - b[1]).map(x => x[0]);
    }
    scenes = scenes.map(sc => Object.assign({}, sc, { s: clamp(sc.s | 0, 0, steps.length - 1) }));
    const still = reduce();
    const [tipX, tipY] = o.tip || [0.43, 0.045];
    const HW = 40, HH = Math.round(HW * (o.ratio || 84 / 64));
    host.classList.add('hd-host');
    host.innerHTML = `<div class="hd ${still ? 'still' : ''}" style="--h:${t.hue || 250}">
        <div class="hd-scr" aria-hidden="true"><div class="hd-stage"></div></div>
        <span class="hd-rip" aria-hidden="true"></span>
        <span class="hd-hand" aria-hidden="true" style="width:${HW}px;height:${HH}px;transform-origin:${tipX * HW}px ${tipY * HH}px"><span class="hd-hand-in" style="transform-origin:${tipX * HW}px ${tipY * HH}px">${o.hand || ''}</span></span>
        <div class="hd-ctl">
          <button type="button" class="hd-b hd-play" data-hd="play" aria-label="Пауза" title="Пауза"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path class="hd-i-pause" d="M4 2.5h2.6v11H4zM9.4 2.5H12v11H9.4z" fill="currentColor"/><path class="hd-i-play" d="M4.5 2.4v11.2L13.6 8z" fill="currentColor"/></svg></button>
          <button type="button" class="hd-b" data-hd="restart" aria-label="Сначала" title="Сначала"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.2 8a4.8 4.8 0 1 0 1.5-3.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M3 1.8v3.6h3.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <span class="hd-dots" aria-hidden="true">${steps.map(() => '<i></i>').join('')}</span>
          <button type="button" class="hd-b hd-speed" data-hd="speed" aria-label="Скорость анимации: обычная" title="Скорость анимации">1×</button>
        </div>
        <div class="hd-cap" aria-live="polite"></div>
      </div>`;
    const root = host.querySelector('.hd'), stage = root.querySelector('.hd-stage'), scr = root.querySelector('.hd-scr');
    const hand = root.querySelector('.hd-hand'), press = root.querySelector('.hd-hand-in'), rip = root.querySelector('.hd-rip');
    const cap = root.querySelector('.hd-cap'), dots = [...root.querySelectorAll('.hd-dots i')];
    const list = o.list || null;
    const S = { user: !still, vis: true, page: !document.hidden, speed: 1, gen: 0, anims: new Set(), cur: null, step: -1, hx: null, hy: null, hd: 0, alive: true, scene: 0 };
    const playing = () => S.user && S.vis && S.page && S.alive;
    const sync = () => {
      root.classList.toggle('paused', !S.user);
      const b = root.querySelector('[data-hd="play"]');
      b.setAttribute('aria-label', S.user ? 'Пауза' : 'Смотреть анимацию'); b.title = S.user ? 'Пауза' : 'Смотреть';
      S.anims.forEach(a => { try { if (playing()) a.play(); else a.pause(); } catch (e) { /* finished */ } });
      root.classList.toggle('frozen', !playing());
    };
    /* time that only runs while playing, at the chosen speed */
    const wait = ms => new Promise((res, rej) => {
      if (S.poster) { res(); return; }
      const g = S.gen; let left = ms, last = performance.now();
      const tick = now => {
        if (g !== S.gen || !S.alive) { rej(STOP); return; }
        const dt = Math.min(100, now - last); last = now;
        if (playing()) left -= dt * S.speed;
        if (left <= 0) res(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const run = async anim => {
      const g = S.gen;
      S.anims.add(anim); anim.playbackRate = S.speed; if (!playing()) anim.pause();
      try { await anim.finished; } catch (e) { /* cancelled */ } finally { S.anims.delete(anim); }
      if (g !== S.gen || !S.alive) throw STOP;
    };
    const anim = (el, frames, opt) => (still ? null : el.animate(frames, Object.assign({ fill: 'none' }, opt)));
    const W = () => root.clientWidth;
    const pos = (el, fx = 0.5, fy = 0.55) => {
      const r = el.getBoundingClientRect(), q = root.getBoundingClientRect();
      return { x: r.left - q.left + r.width * fx, y: r.top - q.top + r.height * fy, w: r.width, h: r.height };
    };
    const tf = (x, y, d) => `translate(${(x - tipX * HW).toFixed(1)}px, ${(y - tipY * HH).toFixed(1)}px) rotate(${d.toFixed(1)}deg)`;
    /** the fingertip to (x, y): from below (a little tilted), or from above near the bottom of the screen; along a soft arc */
    async function handTo(x, y, quick) {
      const sh = scr.offsetHeight, w = W();
      const deg = y + HH * 0.92 > sh ? (x > w * 0.5 ? -152 : 152) : (x > w * 0.58 ? -16 : 12); // no room under it — from above
      hand.classList.add('on');
      if (S.hx == null || still) { // the first time: flies in from the bottom right corner
        if (!still && S.hx == null) { S.hx = w + 30; S.hy = sh + 70; S.hd = deg - 30; }
        else { S.hx = x; S.hy = y; S.hd = deg; hand.style.transform = tf(x, y, deg); return; }
      }
      const x0 = S.hx, y0 = S.hy, d0 = S.hd;
      let dd = deg - d0; dd = ((dd + 540) % 360) - 180;
      S.hx = x; S.hy = y; S.hd = d0 + dd;
      hand.style.transform = tf(x, y, d0 + dd);
      const len = Math.hypot(x - x0, y - y0);
      if (len < 2 && Math.abs(dd) < 1) return;
      let nx = -(y - y0) / (len || 1), ny = (x - x0) / (len || 1); if (ny > 0) { nx = -nx; ny = -ny; }
      const bend = Math.min(60, len * 0.25), cx = (x0 + x) / 2 + nx * bend, cy = (y0 + y) / 2 + ny * bend;
      const fr = [];
      for (let i = 0; i <= 10; i++) { const k = i / 10, u = 1 - k; fr.push({ transform: tf(u * u * x0 + 2 * u * k * cx + k * k * x, u * u * y0 + 2 * u * k * cy + k * k * y, d0 + dd * k) }); }
      await run(hand.animate(fr, { duration: (quick ? 380 : clamp(420 + len * 1.4, 520, 950)), easing: 'cubic-bezier(.45, .05, .25, 1)' }));
    }
    async function tapAt(p, el) {
      if (still) { if (el) { el.classList.add('hd-hit'); } return; }
      const a = press.animate([{ transform: 'translateY(9px) scale(1)' }, { transform: 'translateY(0) scale(.9)', offset: 0.45 }, { transform: 'translateY(0) scale(.9)', offset: 0.6 }, { transform: 'translateY(9px) scale(1)' }], { duration: 520, easing: 'ease-in-out' });
      setTimeout(() => {
        if (!S.alive) return;
        rip.style.left = p.x + 'px'; rip.style.top = p.y + 'px';
        const r = rip.animate([{ transform: 'translate(-50%, -50%) scale(.25)', opacity: 0.95 }, { transform: 'translate(-50%, -50%) scale(2.4)', opacity: 0 }], { duration: 620, easing: 'ease-out' });
        S.anims.add(r); r.playbackRate = S.speed; r.onfinish = () => S.anims.delete(r);
        if (el) { el.classList.remove('hd-hit'); void el.offsetWidth; el.classList.add('hd-hit'); }
      }, 230 / S.speed);
      await run(a);
    }
    /* the scene API */
    const mk = panel => {
      const $ = sel => panel.querySelector(sel);
      const need = sel => { const el = $(sel); if (!el) throw STOP; return el; };
      return {
        $, wait,
        add: (sel, c) => { panel.querySelectorAll(sel).forEach(e => e.classList.add(c)); },
        rm: (sel, c) => { panel.querySelectorAll(sel).forEach(e => e.classList.remove(c)); },
        text: (sel, s) => { const e = $(sel); if (e) e.textContent = s; },
        async point(sel, q = {}) { const el = need(sel); const p = pos(el, q.dx == null ? 0.5 : q.dx, q.dy == null ? 0.6 : q.dy); await handTo(p.x, p.y, q.quick); },
        async tap(sel, q = {}) { const el = need(sel); const p = pos(el, q.dx == null ? 0.5 : q.dx, q.dy == null ? 0.58 : q.dy); await handTo(p.x, p.y, q.quick); await tapAt(p, el); },
        async type(sel, s, per = 65) { const el = need(sel); el.textContent = ''; el.classList.add('typing'); for (const ch of s) { el.textContent += ch; await wait(per); } el.classList.remove('typing'); },
        handAway() { hand.classList.remove('on'); },
      };
    };
    /** a scene: its panel slides in, the step row lights up, the script plays */
    async function scene(i) {
      const sc = scenes[i]; S.scene = i;
      const k = sc.s;
      if (k !== S.step) {
        S.step = k;
        dots.forEach((d, j) => { d.className = j === k ? 'on' : j < k ? 'done' : ''; });
        cap.innerHTML = `<b>${k + 1} из ${steps.length}</b> ${esc(plain(steps[k][1]))}`;
        if (list) [...list.children].forEach((li, j) => { li.classList.toggle('now', j === k); li.classList.toggle('done', j < k); });
      }
      const old = S.cur;
      const p = document.createElement('div');
      p.className = 'hd-p';
      p.innerHTML = String(sc.html).replace(/🤖/g, () => BOT()).replace(/📊/g, SIC); // 📊 → the drawn bars (scenes are built before js/app.js loads)
      stage.appendChild(p);
      S.cur = p;
      hand.classList.add('on');
      if (old) {
        if (still) old.remove();
        else {
          const a1 = old.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-30%)', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
          const a2 = p.animate([{ transform: 'translateX(100%)', opacity: 0.4 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 460, easing: 'cubic-bezier(.2, .8, .2, 1)' });
          a1.onfinish = () => old.remove(); a1.oncancel = () => old.remove();
          S.anims.add(a1); a1.playbackRate = S.speed;
          await run(a2);
        }
      }
      await sc.run(mk(p));
    }
    async function loop(from) {
      const g = ++S.gen;
      S.poster = false; S.looping = true;
      S.anims.forEach(a => { try { a.cancel(); } catch (e) { /* ignore */ } }); S.anims.clear();
      stage.querySelectorAll('.hd-p').forEach(x => { if (x !== S.cur) x.remove(); });
      try {
        for (let i = from; S.alive && g === S.gen; i = (i + 1) % scenes.length) {
          await scene(i);
          if (i === scenes.length - 1) { await wait(1500); hand.classList.remove('on'); S.hx = null; await wait(500); }
        }
      } catch (e) { if (e !== STOP) console.warn('help demo', e); }
      if (g === S.gen) S.looping = false;
    }
    /* reduced motion: the first scene stands still, the hand on its button; ▶ plays without glides */
    const first = k => Math.max(0, scenes.findIndex(sc => sc.s >= k));
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-hd]'); if (!b) return;
      const a = b.dataset.hd;
      if (a === 'play') { S.user = !S.user; sync(); if (S.user && !S.looping) loop(S.poster ? 0 : S.scene); }
      else if (a === 'restart') { S.user = true; sync(); loop(0); }
      else if (a === 'speed') {
        S.speed = S.speed === 1 ? 1.5 : S.speed === 1.5 ? 0.75 : 1;
        b.textContent = S.speed === 1 ? '1×' : S.speed === 1.5 ? '1,5×' : '0,75×';
        b.setAttribute('aria-label', `Скорость анимации: ${S.speed === 1 ? 'обычная' : S.speed > 1 ? 'быстрее' : 'медленнее'}`);
        S.anims.forEach(x => { x.playbackRate = S.speed; });
      }
    });
    const io = window.IntersectionObserver ? new IntersectionObserver(es => { es.forEach(en => { S.vis = en.isIntersecting; }); sync(); }, { threshold: 0.25 }) : null;
    if (io) io.observe(root);
    const onVis = () => { S.page = !document.hidden; sync(); };
    document.addEventListener('visibilitychange', onVis);
    sync();
    if (still) { // a still picture: the first scene played at once, the hand resting on its button; ▶ plays it step by step
      S.poster = true;
      (async () => { try { await scene(0); } catch (e) { /* stopped */ } })();
    } else loop(0);
    // the demo stops by itself when its page is gone
    const gone = setInterval(() => { if (!root.isConnected) ctl.destroy(); }, 1000);
    const ctl = {
      jump(k) { S.user = true; sync(); loop(first(clamp(k | 0, 0, steps.length - 1))); },
      play() { S.user = true; sync(); },
      pause() { S.user = false; sync(); },
      now: () => ({ step: S.step, scene: S.scene, playing: playing(), speed: S.speed }),
      destroy() {
        if (!S.alive) return; S.alive = false; S.gen++;
        clearInterval(gone); if (io) io.disconnect(); document.removeEventListener('visibilitychange', onVis);
        S.anims.forEach(a => { try { a.cancel(); } catch (e) { /* ignore */ } });
        if (list) [...list.children].forEach(li => li.classList.remove('now', 'done'));
      },
    };
    return ctl;
  }

  window.HelpAnim = { mount, DEMOS, generic };
})();
