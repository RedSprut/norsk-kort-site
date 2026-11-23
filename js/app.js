/* ============ App bootstrap & routing ============ */
(function () {
  /* 🤖 the AI button (updateBadge): own little logos of the AI services — a glyph on the service's colour,
     drawn here so they are crisp, offline and never grey (no network favicons). [background, glyph in a 24×24 box] */
  const aibRays = (n, lens, w) => `<path d="${Array.from({ length: n }, (_, i) => {
    const a = i * Math.PI * 2 / n - Math.PI / 2, r = lens[i % lens.length], c = Math.cos(a), s = Math.sin(a);
    return `M${(12 + 2.1 * c).toFixed(2)} ${(12 + 2.1 * s).toFixed(2)}L${(12 + r * c).toFixed(2)} ${(12 + r * s).toFixed(2)}`;
  }).join('')}" stroke="#fff" stroke-width="${w}" stroke-linecap="round"/>`;
  const AIB_W = 'fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"';
  const AIB_LOGO = {
    // Claude: the real filled spark (path: Simple Icons «claude», CC0), a little smaller in the coin and slightly thickened for small sizes
    claude: ['#d97757', '<path transform="translate(12 12) scale(.68) translate(-12 -12)" fill="#fff" stroke="#fff" stroke-width=".4" stroke-linejoin="round" d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/>'],
    // ChatGPT: the black «knot» on white (own drawing — six strands along a hexagon, woven by a white halo; the same as design/logo-variants.html)
    openai: ['#fff', (() => {
      const R = 4.3, ext = 3, back = 0.7, P = k => { const a = (-90 + 60 * k) * Math.PI / 180; return [12 + R * Math.cos(a), 12 + R * Math.sin(a)]; };
      let o = '';
      for (let k = 0; k < 6; k++) {
        const [ax, ay] = P(k), [bx, by] = P(k + 1), dx = (bx - ax) / R, dy = (by - ay) / R;
        const d = `M${(ax - dx * back).toFixed(2)} ${(ay - dy * back).toFixed(2)}L${(bx + dx * ext).toFixed(2)} ${(by + dy * ext).toFixed(2)}`;
        o += `<path d="${d}" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="${d}" stroke="#0b0b0f" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
      }
      return o;
    })()],
    gemini: ['linear-gradient(135deg, #4b8dff, #8e6cf0 60%, #c86fd6)', '<path d="M12 3.6c.55 4.5 3.9 7.85 8.4 8.4-4.5.55-7.85 3.9-8.4 8.4-.55-4.5-3.9-7.85-8.4-8.4 4.5-.55 7.85-3.9 8.4-8.4z" fill="#fff"/>'],
    deepseek: ['#4d6bfe', '<path d="M3.9 13.1c0-3.3 3.1-5.5 6.9-5.5 2.6 0 4.7 1.1 5.8 2.9.7-1.4 2-2.4 3.6-2.7-.5 1.5-.5 2.9.2 4.1-1.1.3-2.1.1-3-.4-.6 3.3-3.6 5.6-7.5 5.6-3.5 0-6-1.6-6-4z" fill="#fff"/><circle cx="8.3" cy="11.7" r="1" fill="#4d6bfe"/><path d="M6.6 14.6c1.6.9 3.8 1.1 5.6.4" stroke="#4d6bfe" stroke-width="1" stroke-linecap="round" fill="none"/>'],
    groq: ['#f55036', `<g ${AIB_W} stroke-width="2.2"><circle cx="12" cy="10.4" r="3.7"/><path d="M15.7 10.4v4.1a3.7 3.7 0 0 1-6.6 2.3"/></g>`],
    openrouter: ['#6467f2', `<g ${AIB_W} stroke-width="1.8"><path d="M4.2 12h3.4c2.6 0 3-4.6 5.6-4.6h5.2M7.6 12c2.6 0 3 4.6 5.6 4.6h5.2M16.3 5.2l2.2 2.2-2.2 2.2M16.3 14.4l2.2 2.2-2.2 2.2"/></g>`],
    mistral: ['linear-gradient(160deg, #ffb000, #fa520f 55%, #e10500)', '<path fill="#fff" d="M5.5 5.5h2.6v2.6h-2.6zM15.9 5.5h2.6v2.6h-2.6zM5.5 8.1h2.6v2.6h-2.6zM8.1 8.1h2.6v2.6h-2.6zM13.3 8.1h2.6v2.6h-2.6zM15.9 8.1h2.6v2.6h-2.6zM5.5 10.7h2.6v2.6h-2.6zM8.1 10.7h2.6v2.6h-2.6zM10.7 10.7h2.6v2.6h-2.6zM13.3 10.7h2.6v2.6h-2.6zM15.9 10.7h2.6v2.6h-2.6zM5.5 13.3h2.6v2.6h-2.6zM10.7 13.3h2.6v2.6h-2.6zM15.9 13.3h2.6v2.6h-2.6zM5.5 15.9h2.6v2.6h-2.6zM15.9 15.9h2.6v2.6h-2.6z"/>'],
    cohere: ['#39594d', '<path d="M9.4 12.6c2.3 0 6.6-.2 7.9-3 1.1-2.4-.9-4.1-3.4-4.1-3.2 0-8.3 1.6-8.3 4.6 0 1.6 1.4 2.5 3.8 2.5z" fill="#ff9f84"/><circle cx="8.4" cy="16.6" r="2.6" fill="#fff"/><path d="M13.1 18.6c0-2.3 1.7-4 4.2-4.6" stroke="#d6c8ff" stroke-width="2.1" stroke-linecap="round" fill="none"/>'],
    nvidia: ['#76b900', `<g ${AIB_W} stroke-width="1.7"><path d="M3.6 12.2c2.4-3.7 5.2-5.4 8.4-5.4s6 1.7 8.4 5.4c-2.4 3.6-5.2 5.3-8.4 5.3s-6-1.7-8.4-5.3z"/><path d="M12 9.3a2.9 2.9 0 1 1-2.9 2.9"/></g>`],
    zai: ['#26283a', `<path d="M7.2 7.2h9.6L7.2 16.8h9.6" ${AIB_W} stroke-width="2.3"/>`],
    xai: ['#0b0b0f', `<g ${AIB_W} stroke-width="1.9"><path d="M17.9 5.2 6.1 18.8"/><path d="M15.9 9.4a5.3 5.3 0 0 1-7 7M8.1 14.6a5.3 5.3 0 0 1 6.1-8.4"/></g>`],
    pollinations: ['#1f5b3a', `<g fill="#e9f86a">${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="${(12 + 4.6 * Math.cos(i * Math.PI / 3)).toFixed(2)}" cy="${(12 + 4.6 * Math.sin(i * Math.PI / 3)).toFixed(2)}" r="2.1"/>`).join('')}</g><circle cx="12" cy="12" r="2" fill="#fff"/>`],
    ollama: ['#fff', '<g fill="none" stroke="#1c1c22" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.2 10.4V6.6c0-1.3.6-2.2 1.4-2.2s1.4.9 1.4 2.2v2.1h2V6.6c0-1.3.6-2.2 1.4-2.2s1.4.9 1.4 2.2v3.8c1.2.9 1.9 2.3 1.9 3.9v.9c0 2.6-2.1 4.5-4.8 4.5h-2.6c-2.7 0-4.8-1.9-4.8-4.5v-.9c0-1.6.7-3 1.7-3.9z"/><ellipse cx="12" cy="15.3" rx="2.1" ry="1.5"/></g><circle cx="9.6" cy="12.6" r=".85" fill="#1c1c22"/><circle cx="14.4" cy="12.6" r=".85" fill="#1c1c22"/>'],
    custom: ['linear-gradient(135deg, #8b80ff, #29c7ff)', '<path d="M10.5 5.2c.4 3 2.6 5.2 5.6 5.6-3 .4-5.2 2.6-5.6 5.6-.4-3-2.6-5.2-5.6-5.6 3-.4 5.2-2.6 5.6-5.6zM17.2 13.6c.2 1.5 1.3 2.6 2.8 2.8-1.5.2-2.6 1.3-2.8 2.8-.2-1.5-1.3-2.6-2.8-2.8 1.5-.2 2.6-1.3 2.8-2.8z" fill="#fff"/>'],
  };
  AIB_LOGO.anthropic = AIB_LOGO.claude;
  /** a round logo coin of an AI service: <span class="aib-i …"> */
  const aibLogo = (k, cls = '', attrs = '') => {
    const [bg, g] = AIB_LOGO[k] || AIB_LOGO.custom;
    return `<span class="aib-i${cls}" style="--c:${bg}"${attrs}><svg viewBox="0 0 24 24" aria-hidden="true">${g}</svg></span>`;
  };
  /** the mascot: a friendly round robot — glowing eyes when an AI is connected, asleep (and an amber antenna) when not */
  const aibBot = on => `<svg class="aib-g" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><defs>`
    + `<linearGradient id="aibHead" x1="4" y1="4" x2="20" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#a99dff"/><stop offset=".5" stop-color="#7d86ff"/><stop offset="1" stop-color="#2fc4ff"/></linearGradient>`
    + `<linearGradient id="aibEye" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8fdff"/><stop offset="1" stop-color="#3fd2ff"/></linearGradient>`
    + `<radialGradient id="aibVisor" cx=".35" cy=".25" r="1"><stop offset="0" stop-color="#2a2d63"/><stop offset="1" stop-color="#0f1130"/></radialGradient>`
    + `<filter id="aibGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation=".7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
    + `<path d="M12 6.4V4.3" stroke="url(#aibHead)" stroke-width="1.7" stroke-linecap="round"/>`
    + `<circle class="aib-tip" cx="12" cy="3.1" r="1.9" filter="url(#aibGlow)"/>`
    + `<rect x="1.3" y="11.4" width="3" height="5.4" rx="1.5" fill="url(#aibHead)"/><rect x="19.7" y="11.4" width="3" height="5.4" rx="1.5" fill="url(#aibHead)"/>`
    + `<rect x="3.1" y="5.9" width="17.8" height="16.2" rx="6.8" fill="url(#aibHead)"/>`
    + `<path d="M6.3 9.1c1.1-1.3 2.8-1.95 4.7-1.95" stroke="#fff" stroke-opacity=".6" stroke-width="1.25" stroke-linecap="round" fill="none"/>`
    + `<rect x="5.3" y="9.9" width="13.4" height="9.3" rx="4.65" fill="url(#aibVisor)"/>`
    + (on
      ? `<g class="aib-eyes" filter="url(#aibGlow)"><ellipse cx="9.55" cy="14" rx="1.5" ry="1.95" fill="url(#aibEye)"/><ellipse cx="14.45" cy="14" rx="1.5" ry="1.95" fill="url(#aibEye)"/></g>`
        + `<path d="M10.8 17q1.2.75 2.4 0" stroke="#7fe9ff" stroke-width=".9" stroke-linecap="round" fill="none"/>`
      : `<path class="aib-zz" d="M8.2 14.2q1.35 1.15 2.7 0M13.1 14.2q1.35 1.15 2.7 0" stroke="#a9b2ec" stroke-width="1.3" stroke-linecap="round" fill="none"/>`)
    + `</svg>`;

  /** 🤖 v212: ONE brand robot for every AI / neural-network icon in the app — the top-bar mascot (aibBot) drawn small, with the
   *  shared gradients of index.html (#nkr-head / #nkr-eye / #nkr-visor), so a hundred of them on a screen stay light.
   *  size: px (default 1.15em — the size of the text around it); it tilts its head when its button is hovered (css/styles.css .nk-bot) */
  const robotSvg = (size, o = {}) => {
    const sz = size ? `width="${+size}" height="${+size}"` : 'width="1.15em" height="1.15em"';
    const on = o.on !== false;
    return `<svg class="nk-bot${o.cls ? ' ' + o.cls : ''}" ${sz} viewBox="0 0 24 24" aria-hidden="true" focusable="false">`
      + `<path d="M12 6.4V4.3" stroke="url(#nkr-head)" stroke-width="1.7" stroke-linecap="round"/>`
      + `<circle class="nk-bot-tip" cx="12" cy="3.1" r="1.9"/>`
      + `<rect x="1.3" y="11.4" width="3" height="5.4" rx="1.5" fill="url(#nkr-head)"/><rect x="19.7" y="11.4" width="3" height="5.4" rx="1.5" fill="url(#nkr-head)"/>`
      + `<rect x="3.1" y="5.9" width="17.8" height="16.2" rx="6.8" fill="url(#nkr-head)"/>`
      + `<path d="M6.3 9.1c1.1-1.3 2.8-1.95 4.7-1.95" stroke="#fff" stroke-opacity=".6" stroke-width="1.25" stroke-linecap="round" fill="none"/>`
      + `<rect x="5.3" y="9.9" width="13.4" height="9.3" rx="4.65" fill="url(#nkr-visor)"/>`
      + (on
        ? `<g class="nk-bot-eyes"><ellipse cx="9.55" cy="14" rx="1.5" ry="1.95" fill="url(#nkr-eye)"/><ellipse cx="14.45" cy="14" rx="1.5" ry="1.95" fill="url(#nkr-eye)"/></g>`
          + `<path d="M10.8 17q1.2.75 2.4 0" stroke="#7fe9ff" stroke-width=".9" stroke-linecap="round" fill="none"/>`
        : `<path d="M8.2 14.2q1.35 1.15 2.7 0M13.1 14.2q1.35 1.15 2.7 0" stroke="#a9b2ec" stroke-width="1.3" stroke-linecap="round" fill="none"/>`)
      + `</svg>`;
  };

  /* 🧭 the top-bar / tab-bar icons (design/declutter.html, section 2): drawn in the style of 🎧 and 🎙 — a thin line,
     round ends, the colour of the text; the open section gets the violet→blue of the headphones (gradient #nkg-nav, index.html).
     The owner has not picked yet: every variant from the mock is here — to swap one, change a letter in NAV_PICK.
     ('e' = keep the emoji) */
  const NAV_SVG = {
    stats: {
      a: '<rect class="f" x="3.5" y="12" width="4" height="8.5" rx="1.4"/><rect class="f" x="10" y="7.5" width="4" height="13" rx="1.4"/><rect class="f" x="16.5" y="3.5" width="4" height="17" rx="1.4"/>', // А. Столбики
      b: '<path d="M3.5 3.8v14.7c0 1.1.9 2 2 2h15"/><path d="M7.5 15.2l3.7-4.1 3 2.7 4.3-4.9"/><circle class="dot" cx="19.3" cy="8" r="2"/>', // Б. Линия роста
      c: '<circle class="soft" cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="8.6" stroke-dasharray="38 60" transform="rotate(-90 12 12)"/><path d="M8.4 13.8l2.3-2.3 1.9 1.7 2.9-3.3"/>', // В. Кольцо знания
    },
    decks: {
      a: '<rect class="f" x="3.5" y="7" width="13" height="13.5" rx="2.4"/><path d="M7.5 3.5h10.2c1.6 0 2.8 1.2 2.8 2.8v10.2"/>', // А. Стопка карточек
      b: '<rect class="soft" x="3.8" y="5.6" width="10.5" height="14" rx="2.2" transform="rotate(-12 9 12.6)"/><rect class="f" x="9.4" y="4.4" width="10.5" height="14" rx="2.2" transform="rotate(9 14.6 11.4)"/>', // Б. Веер
    },
    settings: {
      a: '<circle cx="12" cy="12" r="8.1" stroke-width="3.2" stroke-dasharray="3.2 3.16" stroke-linecap="butt"/><circle class="f" cx="12" cy="12" r="5.9"/><circle cx="12" cy="12" r="2.2"/>', // А. Шестерёнка
      b: '<path d="M4 7h8.5M16.5 7H20M4 12h2.5M10.5 12H20M4 17h10.5M18.5 17H20"/><circle class="f" cx="14.5" cy="7" r="2"/><circle class="f" cx="8.5" cy="12" r="2"/><circle class="f" cx="16.5" cy="17" r="2"/>', // Б. Ползунки
    },
  };
  /* v229: the same family for the UI chrome — «О приложении», «Мой кабинет» (sync), the sign-in sheet, the first-sync choice.
     24×24, a 1.9 line in the colour of the text, round ends; `f` = a part lightly filled, `dot` = a solid dot. No colours of
     their own: white on accent buttons, muted where the text is muted. Optically centred in the 24 box (4…20). */
  const UI_ICO = {
    info: '<circle class="f" cx="12" cy="12" r="8.6"/><path d="M12 11.2v5"/><circle class="dot" cx="12" cy="7.9" r="1.2"/>',
    copy: '<rect class="f" x="9" y="9" width="11" height="11" rx="2.3"/><path d="M15 6.4v-.1C15 5 14 4 12.7 4H6.3C5 4 4 5 4 6.3v6.4C4 14 5 15 6.3 15h.1"/>',
    refresh: '<path d="M19.6 12a7.6 7.6 0 1 1-7.6-7.6c2.13 0 4.16.84 5.69 2.31L19.6 8.6"/><path d="M19.6 3.8v4.8h-4.8"/>',
    report: '<path class="f" d="M6.2 4.2h11.6c1.2 0 2.2 1 2.2 2.2v8.4c0 1.2-1 2.2-2.2 2.2h-5.6l-4.1 3.1c-.45.34-1.1.02-1.1-.54V17h-.8C5 17 4 16 4 14.8V6.4c0-1.2 1-2.2 2.2-2.2z"/><path d="M12 7.4v3.6"/><circle class="dot" cx="12" cy="13.9" r="1.15"/>',
    sparkle: '<path class="f" d="M12 3.6c.7 4.9 3.5 7.7 8.4 8.4-4.9.7-7.7 3.5-8.4 8.4-.7-4.9-3.5-7.7-8.4-8.4 4.9-.7 7.7-3.5 8.4-8.4z"/>',
    licence: '<path d="M11.4 20.2H7.2c-1.2 0-2.2-1-2.2-2.2V6c0-1.2 1-2.2 2.2-2.2h9.4c1.2 0 2.2 1 2.2 2.2v4.1"/><path d="M8.4 8h6.8M8.4 11.3h3.6"/><circle class="f" cx="16" cy="14.6" r="3.1"/><path d="M14.3 17.2l-.7 3.4 2.4-1.2 2.4 1.2-.7-3.4"/>',
    cloud: '<path class="f" d="M7.2 19h10a4.3 4.3 0 0 0 .62-8.56A6 6 0 0 0 6.5 9.7 4.7 4.7 0 0 0 7.2 19z"/>',
    'cloud-check': '<path class="f" d="M7.2 19h10a4.3 4.3 0 0 0 .62-8.56A6 6 0 0 0 6.5 9.7 4.7 4.7 0 0 0 7.2 19z"/><path d="M9.4 14.2l1.9 1.9 3.6-3.7"/>',
    'cloud-off': '<path class="f" d="M7.2 19h10a4.3 4.3 0 0 0 .62-8.56A6 6 0 0 0 6.5 9.7 4.7 4.7 0 0 0 7.2 19z"/><path d="M4 4.2l16 16"/>',
    lock: '<rect class="f" x="5" y="10.3" width="14" height="9.9" rx="2.4"/><path d="M8.3 10.3V7.6a3.7 3.7 0 0 1 7.4 0v2.7"/><circle class="dot" cx="12" cy="15.2" r="1.2"/>',
    check: '<path d="M5 12.6l4.4 4.4L19 7.4"/>',
    sync: '<path d="M4.4 12A7.6 7.6 0 0 1 12 4.4a8.23 8.23 0 0 1 5.69 2.31L19.6 8.6"/><path d="M19.6 3.8v4.8h-4.8"/><path d="M19.6 12a7.6 7.6 0 0 1-7.6 7.6 8.23 8.23 0 0 1-5.69-2.31L4.4 15.4"/><path d="M9.2 15.4H4.4v4.8"/>',
    signout: '<path d="M10.4 4.4H7.1c-1.2 0-2.2 1-2.2 2.2v10.8c0 1.2 1 2.2 2.2 2.2h3.3"/><path d="M15.3 7.9l4.1 4.1-4.1 4.1"/><path d="M19.2 12H10"/>',
    trash: '<path class="f" d="M6.4 7.2l.86 11.1c.09 1.07.98 1.9 2.05 1.9h5.38c1.07 0 1.96-.83 2.05-1.9l.86-11.1z"/><path d="M4.6 7.2h14.8"/><path d="M9.4 7.2V5.6c0-.88.72-1.6 1.6-1.6h2c.88 0 1.6.72 1.6 1.6v1.6"/><path d="M10.4 11v5.2M13.6 11v5.2"/>',
    download: '<path d="M12 4v10.4"/><path d="M7.8 10.4 12 14.6l4.2-4.2"/><path d="M4.5 15.6v1.7c0 1.5 1.2 2.7 2.7 2.7h9.6c1.5 0 2.7-1.2 2.7-2.7v-1.7"/>',
    upload: '<path d="M12 14.6V4.2"/><path d="M7.8 8.4 12 4.2l4.2 4.2"/><path d="M4.5 15.6v1.7c0 1.5 1.2 2.7 2.7 2.7h9.6c1.5 0 2.7-1.2 2.7-2.7v-1.7"/>',
    alert: '<path class="f" d="M10.27 5 3.6 16.6c-.77 1.33.19 3 1.73 3h13.34c1.54 0 2.5-1.67 1.73-3L13.73 5c-.77-1.33-2.69-1.33-3.46 0z"/><path d="M12 9.6v3.9"/><circle class="dot" cx="12" cy="16.4" r="1.15"/>',
    close: '<path d="M6.6 6.6l10.8 10.8M17.4 6.6 6.6 17.4"/>',
    mail: '<rect class="f" x="3.6" y="5.6" width="16.8" height="12.8" rx="2.5"/><path d="m4.6 7.6 7.4 5.3 7.4-5.3"/>',
    /* W7: the drawn icons that lived in js/voices.js (Voices.icon still answers with them — it asks NavIcons first) */
    speaker: '<path class="f" d="M4.5 9.4h2.9l4.3-3.6c.55-.46 1.3-.07 1.3.64v11.12c0 .71-.75 1.1-1.3.64L7.4 14.6H4.5c-.6 0-1-.4-1-1V10.4c0-.6.4-1 1-1z"/><path d="M16.2 9.2a4 4 0 0 1 0 5.6"/><path d="M18.8 6.6a7.6 7.6 0 0 1 0 10.8"/>',
    play: '<path class="f" d="M8 5.7v12.6c0 .8.88 1.28 1.55.85l9.8-6.3c.62-.4.62-1.3 0-1.7l-9.8-6.3C8.88 4.42 8 4.9 8 5.7z"/>',
    stop: '<rect class="f" x="6.6" y="6.6" width="10.8" height="10.8" rx="2.4"/>',
    key: '<circle class="f" cx="8.2" cy="15.6" r="4"/><path d="M11.1 12.7 19.6 4.2"/><path d="M16.7 7.1l2.3 2.3M14.5 9.3l1.7 1.7"/>',
    phone: '<rect class="f" x="6.6" y="3.4" width="10.8" height="17.2" rx="2.6"/><path d="M10.6 17.4h2.8"/>',
    globe: '<circle class="f" cx="12" cy="12" r="8.4"/><path d="M3.8 12h16.4"/><path d="M12 3.6c2.3 2.4 3.4 5.2 3.4 8.4s-1.1 6-3.4 8.4c-2.3-2.4-3.4-5.2-3.4-8.4S9.7 6 12 3.6z"/>',
    laptop: '<rect class="f" x="5" y="5.2" width="14" height="10.2" rx="1.8"/><path d="M3 18.8h18"/>',
    star: '<path class="f" d="M12 3.9l2.47 5.02 5.53.8-4 3.9.94 5.5L12 16.53 7.06 19.12 8 13.62l-4-3.9 5.53-.8z"/>',
    crown: '<path class="f" d="M4.4 8.2l3.7 3.3L12 5.6l3.9 5.9 3.7-3.3-1.5 9.3H5.9z"/><path d="M6 20.2h12"/>',
    pin: '<path class="f" d="M12 20.6s6.4-5.6 6.4-10.6a6.4 6.4 0 0 0-12.8 0c0 5 6.4 10.6 6.4 10.6z"/><circle cx="12" cy="10" r="2.3"/>',
    fallback: '<path d="M4.6 7.6h9.2a5.6 5.6 0 0 1 0 11.2H9"/><path d="M8.1 4.1 4.6 7.6l3.5 3.5"/>',
    clock: '<circle class="f" cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 2"/>',
    edit: '<path class="f" d="M4.6 19.4l.9-4L15.8 5.1a2 2 0 0 1 2.8 0l.3.3a2 2 0 0 1 0 2.8L8.6 18.5z"/><path d="M13.8 7.1l3.1 3.1"/>',
    user: '<circle class="f" cx="12" cy="8.4" r="3.8"/><path d="M4.8 20c.8-3.6 3.6-5.6 7.2-5.6s6.4 2 7.2 5.6"/>',
    sort: '<path d="M8 4.6v14.8M4.8 7.8 8 4.6l3.2 3.2"/><path d="M16 19.4V4.6M12.8 16.2l3.2 3.2 3.2-3.2"/>',
    back: '<path d="M19.4 12H5"/><path d="M10.5 6.5 5 12l5.5 5.5"/>',
    up: '<path d="M12 19.4V5"/><path d="M6.5 10.5 12 5l5.5 5.5"/>',
    down: '<path d="M12 4.6V19"/><path d="M6.5 13.5 12 19l5.5-5.5"/>',
    disk: '<path class="f" d="M5.6 4.4h10.2l3.8 3.8v10.4c0 .55-.45 1-1 1H5.6c-.55 0-1-.45-1-1V5.4c0-.55.45-1 1-1z"/><path d="M8.2 4.4v4.4h6.6V4.4"/><rect x="8" y="13.2" width="8" height="6.2" rx="1"/>',
    chevron: '<path d="M6.5 9.5 12 15l5.5-5.5"/>',
    dialogue: '<path class="f" d="M4 6.2C4 5 5 4 6.2 4h7.6C15 4 16 5 16 6.2v4.6c0 1.2-1 2.2-2.2 2.2H9l-3.4 2.6c-.4.3-.9 0-.9-.4V13h-.5C4 13 4 12 4 10.8z"/><path d="M18.6 9.4h.2c.66 0 1.2.54 1.2 1.2v5.2c0 .66-.54 1.2-1.2 1.2H18v1.8c0 .4-.47.63-.79.38L14.6 17.2H11c-.66 0-1.2-.54-1.2-1.2v-.6"/>',
    cards: '<rect class="f" x="3.5" y="7" width="13" height="13.5" rx="2.4"/><path d="M7.5 3.5h10.2c1.6 0 2.8 1.2 2.8 2.8v10.2"/>',
    book: '<path class="f" d="M4 5.6c2.7-1 5.3-1 8 .8v13c-2.7-1.8-5.3-1.8-8-.8z"/><path d="M20 5.6c-2.7-1-5.3-1-8 .8v13c2.7-1.8 5.3-1.8 8-.8z"/>',
    headphones: '<path d="M4.5 15v-2.5a7.5 7.5 0 0 1 15 0V15"/><rect class="f" x="3.5" y="13.4" width="4.6" height="6.6" rx="1.8"/><rect class="f" x="15.9" y="13.4" width="4.6" height="6.6" rx="1.8"/>',
    tv: '<rect class="f" x="3.5" y="5.4" width="17" height="11.6" rx="2.2"/><path d="M8.5 20.2h7"/><path d="M10.7 9.1v4.3l3.7-2.15z"/>',
    news: '<path class="f" d="M5.5 4.5h10c.55 0 1 .45 1 1v13c0 .83.67 1.5 1.5 1.5H6.5a2 2 0 0 1-2-2V5.5c0-.55.45-1 1-1z"/><path d="M16.5 9H19c.55 0 1 .45 1 1v8.5a1.5 1.5 0 0 1-3 0"/><path d="M7.8 8.6h5.4M7.8 12h5.4M7.8 15.4h3.4"/>',
    translate: '<path d="M4 6h8.2M8.1 4v2M10.6 6c-.6 3.4-2.9 6.2-6.3 7.8"/><path d="M6.2 9.3c1 1.8 2.6 3.3 4.6 4.3"/><path d="M12.6 20.2 16.1 11.6l3.5 8.6M13.9 17.1h4.4"/>',
    mic: '<rect class="f" x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.8 11.5a6.2 6.2 0 0 0 12.4 0"/><path d="M12 17.7v2.8"/>',
    send: '<path class="f" d="M20.1 4.3 3.9 10.6c-.72.28-.68 1.31.06 1.53l4.3 1.3 1.6 5c.22.7 1.12.88 1.6.32l2.3-2.5 4.2 3.1c.6.44 1.45.1 1.57-.63L21.6 5.5c.12-.8-.7-1.43-1.5-1.2z"/><path d="m8.3 13.4 8.4-5.6"/>',
    plug: '<path d="M9 3.8v4M15 3.8v4"/><path class="f" d="M6.6 7.8h10.8v3.4a5.4 5.4 0 0 1-10.8 0z"/><path d="M12 16.6v3.6"/>',
    /* W7: Settings, the AI hub, guides */
    gear: '<circle cx="12" cy="12" r="7.6" stroke-width="3" stroke-dasharray="3 2.97" stroke-linecap="butt"/><circle class="f" cx="12" cy="12" r="5.4"/><circle cx="12" cy="12" r="2"/>',
    shield: '<path class="f" d="M12 3.6 5.2 6.2v5.3c0 4.3 2.9 7.6 6.8 8.9 3.9-1.3 6.8-4.6 6.8-8.9V6.2z"/><path d="M9 12.2l2.2 2.2 3.9-4"/>',
    flag: '<path d="M5.6 20.4V4.4"/><path class="f" d="M5.6 4.8h10.6l-2.2 3.8 2.2 3.8H5.6"/>',
    help: '<circle class="f" cx="12" cy="12" r="8.6"/><path d="M9.6 9.6a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.1-2.5 3.6"/><circle class="dot" cx="12" cy="16.6" r="1.15"/>',
    bulb: '<path class="f" d="M12 3.8a5.6 5.6 0 0 0-3.4 10c.7.6 1.1 1.4 1.1 2.3v.5h4.6v-.5c0-.9.4-1.7 1.1-2.3A5.6 5.6 0 0 0 12 3.8z"/><path d="M9.8 19.8h4.4"/>',
    target: '<circle class="f" cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.6"/><circle class="dot" cx="12" cy="12" r="1.5"/>',
    calendar: '<rect class="f" x="4" y="5.4" width="16" height="14.6" rx="2.6"/><path d="M4 9.8h16M8.4 3.6v3.4M15.6 3.6v3.4"/><circle class="dot" cx="9" cy="14.2" r="1.1"/><circle class="dot" cx="13.6" cy="14.2" r="1.1"/>',
    image: '<rect class="f" x="3.8" y="4.8" width="16.4" height="14.4" rx="2.6"/><circle cx="9" cy="9.8" r="1.7"/><path d="m4.6 17.6 4.8-4.6 3.4 3.1 2.6-2.4 4 3.7"/>',
    palette: '<path class="f" d="M12 3.8a8.2 8.2 0 0 0 0 16.4c1.2 0 1.8-.8 1.8-1.7 0-1.1-.9-1.5-.9-2.5 0-.9.7-1.6 1.6-1.6h2.1a3.6 3.6 0 0 0 3.6-3.6c0-3.9-3.7-7-8.2-7z"/><circle class="dot" cx="8" cy="11" r="1.2"/><circle class="dot" cx="10.6" cy="7.6" r="1.2"/><circle class="dot" cx="14.8" cy="7.9" r="1.2"/>',
    hand: '<path class="f" d="M8.4 12.6V6.2a1.5 1.5 0 0 1 3 0v5.2-6.6a1.5 1.5 0 0 1 3 0v6.6-5a1.5 1.5 0 0 1 3 0v7.8c0 3.6-2.5 6-5.8 6-2.3 0-3.7-.9-5-2.8l-2.3-3.4a1.4 1.4 0 0 1 2.2-1.7z"/>',
    compass: '<circle class="f" cx="12" cy="12" r="8.4"/><path class="f" d="m15.4 8.6-2 4.8-4.8 2 2-4.8z"/>',
    terminal: '<rect class="f" x="3.6" y="5" width="16.8" height="14" rx="2.4"/><path d="m7.4 10 2.6 2.2-2.6 2.2M12.4 14.8h4"/>',
    'wifi-off': '<path d="M4.2 9.6a11.4 11.4 0 0 1 15.6 0M7 12.6a7.4 7.4 0 0 1 10 0M9.8 15.6a3.4 3.4 0 0 1 4.4 0"/><circle class="dot" cx="12" cy="18.6" r="1.2"/><path d="M4.4 4.4l15.2 15.2"/>',
    hourglass: '<path d="M7 4h10M7 20h10"/><path class="f" d="M8 4c0 3.6 4 5 4 8s-4 4.4-4 8h8c0-3.6-4-5-4-8s4-4.4 4-8z"/>',
    link: '<path d="M10.2 13.8a3.6 3.6 0 0 0 5.1 0l3-3a3.6 3.6 0 0 0-5.1-5.1l-1 1"/><path d="M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-3 3a3.6 3.6 0 0 0 5.1 5.1l1-1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sliders: '<path d="M4 7h8.5M16.5 7H20M4 12h2.5M10.5 12H20M4 17h10.5M18.5 17H20"/><circle class="f" cx="14.5" cy="7" r="2"/><circle class="f" cx="8.5" cy="12" r="2"/><circle class="f" cx="16.5" cy="17" r="2"/>',
    search: '<circle class="f" cx="10.6" cy="10.6" r="6.2"/><path d="m15.2 15.2 4.6 4.6"/>',
    // 📖 the reader (v232): bookmark, highlight, note, search, contents, theme, zoom
    bookmark: '<path class="f" d="M7 4.2h10c.66 0 1.2.54 1.2 1.2v14.1c0 .49-.56.77-.95.48L12 16.1l-5.25 3.88c-.39.29-.95.01-.95-.48V5.4c0-.66.54-1.2 1.2-1.2z"/>',
    highlight: '<path class="f" d="M14.3 4.3l5.4 5.4-7.6 7.6-5.4-5.4z"/><path d="M6.7 11.9 4.4 17l2.6 2.6 5.1-2.3"/><path d="M13 20h7"/>',
    note: '<path class="f" d="M5.6 4h9.2l4.6 4.6v9.8c0 .88-.72 1.6-1.6 1.6H5.6c-.88 0-1.6-.72-1.6-1.6V5.6C4 4.72 4.72 4 5.6 4z"/><path d="M14.6 4v4.8h4.8"/><path d="M7.6 12.4h8.4M7.6 15.6h5.6"/>',
    toc: '<path d="M9.2 6.4h10.6M9.2 12h10.6M9.2 17.6h10.6"/><circle class="dot" cx="4.9" cy="6.4" r="1.25"/><circle class="dot" cx="4.9" cy="12" r="1.25"/><circle class="dot" cx="4.9" cy="17.6" r="1.25"/>',
    theme: '<circle cx="12" cy="12" r="8.2"/><path class="f" d="M12 3.8a8.2 8.2 0 0 1 0 16.4z"/>',
    'zoom-in': '<circle class="f" cx="10.6" cy="10.6" r="6.2"/><path d="M15.3 15.3l4.5 4.5M8 10.6h5.2M10.6 8v5.2"/>',
    'zoom-out': '<circle class="f" cx="10.6" cy="10.6" r="6.2"/><path d="M15.3 15.3l4.5 4.5M8 10.6h5.2"/>',
    goto: '<path class="f" d="M6.2 3.8h7.6l4.4 4.4v10.6c0 .77-.63 1.4-1.4 1.4H6.2c-.77 0-1.4-.63-1.4-1.4V5.2c0-.77.63-1.4 1.4-1.4z"/><path d="M13.8 3.8v4.4h4.4"/><path d="M8.6 13.6h6.2M12.6 11.2l2.4 2.4-2.4 2.4"/>',
    shelf: '<path d="M3.8 20.2h16.4"/><rect class="f" x="5" y="5" width="3.6" height="15.2" rx=".8"/><rect class="f" x="10.2" y="7.4" width="3.4" height="12.8" rx=".8"/><path class="f" d="M15.6 8.6l2.9-.9 2.4 11.7-2.9.8z"/>',
    /* the leftovers after the reader merge: «Мой кабинет», toasts, «Лестница уровней», the holiday dress-up (js/apptheme.js) */
    camera: '<path class="f" d="M4.6 8.2c0-.77.63-1.4 1.4-1.4h2.2l1.5-2.2h4.6l1.5 2.2H18c.77 0 1.4.63 1.4 1.4v9.4c0 .77-.63 1.4-1.4 1.4H6c-.77 0-1.4-.63-1.4-1.4z"/><circle cx="12" cy="12.8" r="3.3"/>',
    crop: '<path d="M7 3.6V17h13.4"/><path d="M3.6 7H17v13.4"/>',
    ban: '<circle class="f" cx="12" cy="12" r="8.4"/><path d="M6.1 6.1l11.8 11.8"/>',
    ladder: '<path d="M7.4 3.6v16.8M16.6 3.6v16.8"/><path d="M7.4 7.6h9.2M7.4 12h9.2M7.4 16.4h9.2"/>',
    party: '<path class="f" d="M4.2 19.8 8.4 8.6l7 7z"/><path d="M13.6 4.4c.4 1.4-.2 2.4-1.4 2.9M19.6 10.4c-1.4-.4-2.4.2-2.9 1.4M16.4 4.6l-.6 2M19.4 7.6l-2 .6"/><circle class="dot" cx="18.4" cy="4.4" r="1"/><circle class="dot" cx="20" cy="14.2" r="1"/>',
    fireworks: '<path d="M12 3.6v4M12 16.4v4M3.6 12h4M16.4 12h4M6.1 6.1l2.8 2.8M15.1 15.1l2.8 2.8M17.9 6.1l-2.8 2.8M8.9 15.1l-2.8 2.8"/><circle class="dot" cx="12" cy="12" r="1.5"/>',
    sun: '<circle class="f" cx="12" cy="12" r="4"/><path d="M12 3.4v2.2M12 18.4v2.2M3.4 12h2.2M18.4 12h2.2M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6"/>',
    heart: '<path class="f" d="M12 19.6s-7.6-4.6-7.6-10a4.2 4.2 0 0 1 7.6-2.5 4.2 4.2 0 0 1 7.6 2.5c0 5.4-7.6 10-7.6 10z"/>',
    feather: '<path class="f" d="M19.4 4.6c-6.6 0-11.4 4.6-11.4 11.2v1.6h1.6c6.6 0 9.8-6.2 9.8-12.8z"/><path d="M4.6 19.4 14.6 9.4"/>',
    egg: '<path class="f" d="M12 3.8c3.3 0 6 5 6 9.2a6 6 0 0 1-12 0c0-4.2 2.7-9.2 6-9.2z"/><path d="M6.6 13.2l2.2-1.6 2.2 1.6 2-1.6 2.2 1.6 2.2-1.6"/>',
    fire: '<path class="f" d="M12 20.4a6 6 0 0 0 6-6c0-3.8-3.2-5.8-4-10-2.4 1.6-3.6 4-3.4 6.4-1-.6-1.6-1.6-1.8-2.8C7 9.6 6 11.8 6 14.4a6 6 0 0 0 6 6z"/><path d="M12 20.4a2.4 2.4 0 0 1-2.4-2.4c0-1.6 1.4-2.4 2.4-4 1 1.6 2.4 2.4 2.4 4a2.4 2.4 0 0 1-2.4 2.4z"/>',
    pumpkin: '<path class="f" d="M12 7.6c-1.4-1-6.8-1.2-7.6 4.6-.6 4.8 3.4 7.6 7.6 6.6 4.2 1 8.2-1.8 7.6-6.6-.8-5.8-6.2-5.6-7.6-4.6z"/><path d="M12 7.6c-1.6 2.6-1.6 8.4 0 11.2M12 7.6c1.6 2.6 1.6 8.4 0 11.2M12 7.6c0-1.6.6-2.8 2-3.6"/>',
    candle: '<rect class="f" x="8.8" y="10" width="6.4" height="10.4" rx="1.2"/><path d="M12 10V8.4"/><path class="f" d="M12 3.4c1.2 1.4 1.8 2.4 1.8 3.2a1.8 1.8 0 0 1-3.6 0c0-.8.6-1.8 1.8-3.2z"/>',
    tree: '<path class="f" d="M12 3.4 6.6 10h2.6l-3.6 4.6h3l-3.4 4.2h13.6l-3.4-4.2h3L14.8 10h2.6z"/><path d="M12 18.8v2"/>',
    radio: '<rect class="f" x="3.6" y="8.4" width="16.8" height="11.6" rx="2.4"/><path d="M7 8.4 16.6 4"/><circle cx="15.6" cy="14.2" r="2.6"/><path d="M6.8 12.4h3.4M6.8 15.8h3.4"/>',
    snow: '<path d="M12 3.4v17.2M4.6 7.7l14.8 8.6M19.4 7.7 4.6 16.3"/><path d="M9.8 4.8 12 6.6l2.2-1.8M9.8 19.2 12 17.4l2.2 1.8"/>',
  };
  // the fill / dot are written into the markup, so an icon looks the same wherever it lands (no CSS needed)
  const uiPaint = s => s.replace(/class="f"/g, 'class="f" fill="currentColor" fill-opacity=".22"').replace(/class="dot"/g, 'class="dot" fill="currentColor" stroke="none"');
  const NAV_PICK = { stats: 'a', decks: 'a', settings: 'a' };
  const NAV_EMO = { stats: '📊', decks: '📚', settings: '⚙️' };
  const NavIcons = {
    SVG: NAV_SVG, PICK: NAV_PICK,
    html(name, v) {
      v = v || NAV_PICK[name];
      if (v === 'e' || !NAV_SVG[name] || !NAV_SVG[name][v]) return `<span class="nav-emo">${NAV_EMO[name] || ''}</span>`;
      return `<svg class="ico nav-svg" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${NAV_SVG[name][v]}</svg>`;
    },
    /** 📊 → the drawn «Статистика» bars of the top bar (v219: the 📊 emoji is gone from the app). Sized like the emoji it
     *  replaces (1.15em — follows the font-size of the text around it), the colour of the text, lightly filled bars (css .stats-ico) */
    statsIco(cls) { return `<i class="nav-ico stats-ico${cls ? ' ' + cls : ''}" aria-hidden="true">${NavIcons.html('stats')}</i>`; },
    /** static (our own, trusted) HTML: every 📊 → statsIco(). Never for user text or for TTS — speak the original string */
    swap(html) { return String(html == null ? '' : html).replace(/📊/g, () => NavIcons.statsIco()); },
    /** a drawn UI icon of the same family (UI_ICO above): NavIcons.icon('copy') → <svg class="ico ui-ico ui-ico-copy">.
     *  size in px (default 18; CSS may set 1em etc.); the colour is the text's (currentColor). Unknown name → '' */
    icon(name, size, cls) {
      const p = UI_ICO[name]; if (!p) return '';
      const s = size || 18;
      return `<svg class="ico ui-ico ui-ico-${name}${cls ? ' ' + cls : ''}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${uiPaint(p)}</svg>`;
    },
    ICONS: Object.keys(UI_ICO),
    /** every <i data-nav-ico="stats|decks|settings"> (top bar, tab bar) */
    paint(root) { (root || document).querySelectorAll('[data-nav-ico]').forEach(el => { el.innerHTML = NavIcons.html(el.dataset.navIco); }); },
  };
  window.NavIcons = NavIcons;

  const App = {
    /** 🤖 the same crisp logos / robot for other windows (js/aihub.js «Центр нейросети») */
    aiLogo: aibLogo, aiBot: aibBot, robotSvg,
    view: { name: 'home', params: {} },
    prev: null,
    _pickDeck: null,

    /**
     * «Поделиться → Norsk Kort» (installed app on Android / Chrome): text or a link shared from another app opens as a
     * text in «📘 Мой учебник» — translation views, select → card, new words → cards, page → cards, listening.
     * Also works with a link like ./?share-target=1&text=…
     */
    sharedIn() {
      const p = new URLSearchParams(location.search);
      if (!p.has('share-target')) return;
      const title = (p.get('title') || '').trim(), text = (p.get('text') || '').trim(), url = (p.get('url') || '').trim();
      history.replaceState(history.state, '', location.pathname + location.hash); // a reload does not open it again (the screen's history entry stays)
      const body = [title, text, url && !text.includes(url) ? url : ''].filter(Boolean).join('\n\n');
      if (!/\p{L}{2}/u.test(body)) { UI.toast('Получена пустая ссылка — откройте её и поделитесь текстом', 'warn'); return; }
      const name = (title || text.split(/\s+/).slice(0, 6).join(' ') || 'Текст').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80);
      setTimeout(() => Textbook.openWith(new File([body], `${name}.txt`, { type: 'text/plain' }), `📤 ${name}`), 300);
    },
    async init() {
      await Store.load();
      try { Progress.checkVacation(); } catch (e) { /* ignore */ }
      try { if (window.Genders && Genders.migrateNames()) Store.save(); } catch (e) { /* ignore */ } // ⚪🔵🔴 → 🌳👦👧
      // cards made from subtitles before v131 kept the subtitle dashes («…mange år, -», «- men…»): tidy them once
      try {
        const dash = s => String(s || '').replace(/^\s*[-–—]\s+/, '').replace(/\s+[-–—]\s*$/, '').trim();
        let n = 0;
        Store.cards().forEach(c => {
          if (!(c.tags || []).includes('subtitles')) return;
          const no = dash(c.no), ru = dash(c.ru), ex = dash(c.example), exRu = dash(c.exampleRu);
          if (no !== c.no || ru !== c.ru || ex !== (c.example || '') || exRu !== (c.exampleRu || '')) { c.no = no; c.ru = ru; if (c.example) c.example = ex; if (c.exampleRu) c.exampleRu = exRu; n++; }
        });
        if (n) Store.save();
      } catch (e) { /* ignore */ }
      this.applyTheme();
      NavIcons.paint();
      try { if (window.AppThemes) AppThemes.apply('app'); } catch (e) { console.warn('apptheme', e); } // 🎨 theme / holiday dress-up (js/apptheme.js) — now that Store.settings (artMotion) is loaded
      TTS.init();
      await AI.detectBridge();
      if (!Store.decks().length && !Store.state.sampleAdded) {
        this.addSampleDeck();
        Store.state.sampleAdded = true; Store.save();
      }
      // W7 — one guide at a time: a brand-new user never needs «Всё на месте — просто разложено по разделам» (a hint for
      // people who knew the old screens); it would sit under the showcase and the welcome on the first start
      if (!Store.settings.userName && !Store.state.askedName && Views.declutterHintSkip) { try { Views.declutterHintSkip(); } catch (e) { /* private mode */ } }
      this.updateBadge();
      this.bindGlobal();
      this.render();
      try { Account.init(); } catch (e) { console.warn('account', e); }
      this.setupPWA();
      this.sharedIn();
      // 🧠 personalise FSRS in the background when there are enough answers (checks only; runs rarely, in a Web Worker)
      try { FSRSOpt.schedule(10000); } catch (e) { console.warn('fsrs-opt', e); }
      if (!Store.settings.userName && !Store.state.askedName) {
        // ✨ the first start: «Знакомство» (js/showcase.js) — its last scene asks the name itself
        let n = '', seen = false;
        if (window.Showcase && Showcase.shouldAuto()) {
          try { const r = await Showcase.open({ askName: true }); n = (r && r.name) || ''; seen = !!(r && r.finished); } catch (e) { console.warn('showcase', e); }
        }
        Store.state.askedName = true; Store.save();
        if (!n && !seen) n = await UI.prompt('Как вас зовут?', '', 'Alex');
        if (n) { Store.setSetting('userName', n); this.updateBadge(); this.render(); Account.paintTop(); }
      }
    },

    /** ✕ of the reading pill: a long text read half-way asks first (the place is not kept); a short one stops at once */
    async ttsStopAsk() {
      const p = TTS.player;
      if (!p || !p.segs || p.segs.length < 4 || p.i < 1) { TTS.stop(); return; }
      if (this._ttsAsking) return;
      this._ttsAsking = true;
      try {
        const r = await UI.askClose({ title: 'Остановить чтение?', line: `Прочитано ${Math.min(p.i + 1, p.segs.length)} из ${p.segs.length} — в следующий раз чтение начнётся сначала.`,
          actions: [{ label: '⏹ Остановить', value: 'stop', cls: 'bad' }], cancel: 'Читать дальше' });
        if (r === 'stop' && TTS.player === p) TTS.stop();
      } finally { this._ttsAsking = false; }
    },
    /** a tap on the navigation: a card session in progress asks «Закончить занятие?» first */
    goAsk(name, params = {}) {
      if (this.view.name === 'study' && name !== 'study' && window.Study && Study.inProgress && Study.inProgress()) {
        Study.leaveAsk('home').then(ok => { if (ok) this.go(name, params); });
        return;
      }
      this.go(name, params);
    },
    go(name, params = {}) {
      // 👀 the AI is checking this deck before the person's eyes (js/aihub.js): leaving asks first
      if (window.AIHub && AIHub.leaving && AIHub.leaving(name, params)) return;
      if (this.view.name === 'study' && name !== 'study') {
        Study.end(); TTS.stop();
        // a new build arrived during the session (setupPWA): it is applied now that the card screen is left
        if (this._updPending && !this._reloaded) { this._reloaded = true; location.reload(); return; }
      }
      if (name !== 'deck' || (params.id !== this.view.params.id)) { Views.sel.clear(); Views.selecting = false; Views.deckFilter = 'all'; Views.deckSearch = ''; Views.deckLimit = 120; }
      if (this.view.name !== 'study') this.prev = this.view;
      // 🕘 decks in work go up in the deck lists: the opened deck; a card session of one deck (and each answer in it — Store.logReview)
      try {
        if (name === 'deck' && params.id) Store.touchDeck(params.id);
        if (name === 'study') Store.studyDeck(window.Study && Study.session ? Study.session.deckId || null : null);
        else if (this.view.name === 'study') Store.studyDeck(undefined);
      } catch (e) { /* ordering only */ }
      this.view = { name, params };
      this.render(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    /** wide screens (MacBook): a sidebar with the main places and ALL decks, like Space */
    renderSidebar() {
      let sb = document.getElementById('sidebar');
      if (!sb) {
        sb = document.createElement('aside'); sb.id = 'sidebar'; sb.className = 'sidebar';
        document.body.appendChild(sb);
        window.addEventListener('resize', () => { const t = document.querySelector('.topbar'); if (t) document.documentElement.style.setProperty('--topbar-h', Math.round(t.getBoundingClientRect().bottom) + 'px'); });
        sb.addEventListener('click', e => {
          const a = e.target.closest('[data-sb]'); if (!a) return;
          const v = a.dataset.sb;
          if (v === 'deck-del') { e.stopPropagation(); Views.deleteDeck(a.dataset.id); return; }
          if (v === 'deck') this.goAsk('deck', { id: a.dataset.id });
          // v210: the side menu = the sections of home; the former items still open the same places (old links, tours)
          else if (['video', 'read', 'drills', 'radio', 'telegram', 'decks', 'looks'].includes(v)) Views.section(v);
          else if (v === 'create') Create.open();
          else if (v === 'library') Library.open();
          else if (v === 'bookshelf') { if (Views.openLibrary) Views.openLibrary(); else Books.open(); }
          else if (v === 'books') Books.open();
          else if (v === 'textbook') Textbook.open();
          else if (v === 'youtube') YouTube.open();
          else if (v === 'nrk') NrkTV.open();
          else if (v === 'nrkradio') NrkRadio.open();
          else if (v === 'exams') Exams.open();
          else if (v === 'news') News.open();
          else if (v === 'subs') Subs.open();
          else if (v === 'nav' && window.AppNav) AppNav.open();
          else if (v === 'help') Help.open();
          else if (v === 'showcase' && window.Showcase) Showcase.open();
          else if (v === 'speech') Speech.open();
          else if (v === 'new') Views.deckEditor(null, d => this.go('deck', { id: d.id }));
          else this.goAsk(v);
        });
      }
      // the sidebar starts right under the top bar, whatever its height
      const tb = document.querySelector('.topbar');
      if (tb) document.documentElement.style.setProperty('--topbar-h', Math.round(tb.getBoundingClientRect().bottom) + 'px');
      const v = this.view;
      const item = (key, icon, label, active, cls = '') => `<button class="sb-item ${cls} ${active ? 'active' : ''}" data-sb="${key}"${active ? ' aria-current="page"' : ''}><span class="sb-i" aria-hidden="true">${icon}</span><span>${label}</span></button>`;
      const S = Views.SEC_SVG || {};
      // v210 (design/declutter.html): the main places only — Статистика and Настройки are in the top bar (and the profile)
      // v211: «🧭 Навигатор» (tour of this screen + help + quick paths + «Знакомство») right under «Главная»; «🎨 Оформление» beside «Упражнения»
      sb.innerHTML = `${item('home', '🏠', 'Главная', v.name === 'home')}${window.AppNav ? item('nav', '🧭', 'Навигатор по приложению', false, 'sb-nav') : ''}${item('decks', NavIcons.html('decks'), 'Колоды', false, 'sb-decks-i')}${Views.progress ? item('progress', '📈', 'Мой прогресс', v.name === 'progress') : ''}
        ${item('video', S.video ? S.video() : '▶️', 'Смотреть видео')}${Views.learn ? item('learn', '🎓', 'Учить по материалам', v.name === 'learn', 'sb-learn') : ''}${item('radio', '📻', 'Радио')}${item('read', '📖', 'Читать')}
        ${item('telegram', Telegram.TG_SVG(20), 'Telegram')}${item('drills', '🏋️', 'Упражнения')}${window.AppThemes || window.ArtCards ? item('looks', '🎨', 'Оформление') : ''}
        <div class="sb-title">Мои колоды <button class="sb-add" data-sb="new" title="Новая колода" aria-label="Новая колода">＋</button></div>
        <div class="sb-decks">${this.sidebarDecks(sb).map(d => `<div class="sb-row"><button class="sb-item sb-deck ${v.name === 'deck' && v.params.id === d.id ? 'active' : ''}" data-sb="deck" data-id="${d.id}">
          ${d.cover ? `<i class="sb-thumb" style="background-image:url('${U.esc(d.cover)}')"></i>` : '<i class="sb-thumb">🗂</i>'}<span>${d.pinned ? '<span class="sb-pin" title="Закреплена наверху" aria-label="Закреплена наверху">📌</span> ' : ''}${U.esc(d.name)}</span></button></div>`).join('')}</div>
`;
    },
    /** 🕘 «Мои колоды» in the sidebar: decks in work first (Store.decksByUse). Nothing moves under the mouse: while the
     * pointer is over the sidebar (or a deck row has focus) the order stays as it was — the new one comes with the next screen. */
    sidebarDecks(sb) {
      const order = Store.decksByUse ? Store.decksByUse() : Store.decks();
      let list = order;
      const still = this._sbOrder && sb && (sb.matches(':hover') || sb.contains(document.activeElement));
      if (still) {
        const was = new Map(this._sbOrder.map((id, i) => [id, i]));
        list = order.slice().sort((a, b) => (was.has(a.id) ? was.get(a.id) : 1e9) - (was.has(b.id) ? was.get(b.id) : 1e9));
      }
      this._sbOrder = list.map(d => d.id);
      return list;
    },
    back() {
      const p = this.prev && this.prev.name !== 'study' ? this.prev : { name: 'home', params: {} };
      this.go(p.name, p.params);
    },
    render(animate) {
      const root = document.getElementById('view');
      root.onclick = null; root.onchange = null; root.oninput = null;
      if (animate) { root.style.animation = 'none'; void root.offsetWidth; root.style.animation = ''; }
      document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === this.view.name || (b.dataset.nav === 'home' && this.view.name === 'deck')));
      const v = this.view;
      document.body.dataset.view = v.name;
      try {
        if (v.name === 'study') Study.render(root);
        else if (Views[v.name]) Views[v.name](root, v.params);
        else Views.home(root);
        try { if (window.AppThemes) AppThemes.afterRender(v.name, root); } catch (e) { console.warn('apptheme', e); } // 🎨 «Тема приложения» block in Settings → Внешний вид
        try { if (Views.mountFoot) Views.mountFoot(root, v.name); } catch (e) { console.warn('footer', e); } // 🦶 the same footer under every screen
        TTS.emit();
        this.renderSidebar();
        // every deck without a picture gets a Norwegian photo — wherever it was created (library, Telegram, import…)
        // a cover that arrives later is put in place — the screen is NOT redrawn (typing, search and focus are kept)
        try {
          Photos.fillCovers(Store.decks(), () => {
            this.renderSidebar();
            Store.decks().forEach(d => {
              if (!d.cover) return;
              document.querySelectorAll(`.deck-cover[data-id="${d.id}"]`).forEach(el => {
                if (!el.classList.contains('empty')) return;
                el.style.backgroundImage = `url('${String(d.cover).replace(/'/g, '%27')}')`;
                el.classList.remove('empty');
                const hint = el.querySelector('.deck-cover-hint'); if (hint) hint.remove();
              });
            });
          });
        } catch (e) { /* offline */ }
      } catch (e) {
        console.warn('render', v.name, e); // the technical detail: console only
        root.innerHTML = `<div class="panel empty app-oops" role="alert"><div class="big">😵</div>
          <p><b>Этот экран не открылся.</b><br>${v.name === 'home' ? 'Попробуйте обновить страницу — ваши карточки и колоды на месте.' : 'Ваши карточки и колоды на месте — вернитесь на главную и попробуйте ещё раз.'}</p>
          <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap"><button class="btn primary" type="button" data-action="nav" data-view="home">🏠 На главную</button>
          <button class="btn" type="button" onclick="location.reload()">🔄 Обновить страницу</button></div></div>`;
      }
    },

    applyTheme() {
      const t = Store.settings.theme;
      const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      const tb = document.getElementById('theme-btn');
      if (tb) { tb.textContent = dark ? '🌞' : '🌓'; tb.title = dark ? 'Включить светлую тему' : 'Включить тёмную тему'; }
      document.documentElement.dataset.ru = Store.settings.highlightRu === false ? 'off' : 'on';
      document.querySelector('meta[name="theme-color"]').content = dark ? '#0f1222' : '#f3f4fb';
    },
    /** 🤖 «Нейросети» in the top bar: the robot mascot (aibBot) + the logo and name of the current AI (or «Подключить ИИ»);
     *  hover / keyboard focus fans out every service the app supports; a tap / click opens the chooser of all of them
     *  (data-action="ai-menu" → js/aichooser.js: a dropdown, a bottom sheet on phones).
     *  Its size is picked to fit the free room in the bar (data-fit: l → m → s → xs) — it never pushes the other buttons. */
    updateBadge() {
      const b = document.getElementById('claude-badge');
      if (!b) return;
      const P = AI.PROVIDERS, on = AI.available(), id = AI.current();
      const cur = on && P[id] ? id : null;
      const conf = k => AI.configured(k) || (k === 'claude' && AI.configured('anthropic'));
      // one icon per service (the Claude subscription and Claude API share a logo); the current one first, then the connected ones
      const seen = new Set(), all = [];
      [cur, ...Object.keys(P).filter(conf), ...Object.keys(P)].forEach(k => {
        const p = P[k]; if (!k || !p || seen.has(k) || (!p.domain && k !== cur)) return;
        if (p.domain && seen.has(p.domain)) return;
        seen.add(k); if (p.domain) seen.add(p.domain); all.push(k);
      });
      const label = k => (k === 'claude' ? `Claude ${Store.settings.plan || ''}`.trim() : k === 'anthropic' ? 'Claude API' : P[k].short);
      b.classList.toggle('on', on);
      b.classList.toggle('aib-off', !on);
      b.innerHTML = `<span class="aib-glyph">${aibBot(on)}${cur ? aibLogo(cur, ' aib-corner') : ''}</span>`
        + (cur ? `<span class="aib-stack">${aibLogo(cur, ' cur')}</span>` : '') // collapsed: just the current one — the rest are in the fan / menu
        + `<span class="aib-txt"><small>${on ? 'Нейросеть' : 'Нейросети'}</small><b>${on ? U.esc(label(cur)) : 'Подключить ИИ'}</b></span>`
        + `<span class="aib-cap">ИИ</span>`
        // the fan (desktop hover / keyboard focus); title="" keeps the button tooltip off it
        + `<span class="aib-fan" title="" aria-hidden="true"><span class="aib-fan-h">Нейросети в приложении · ${all.length}</span>`
        + `<span class="aib-fan-row">${all.map((k, i) => aibLogo(k, (k === cur ? ' cur' : '') + (conf(k) ? ' ok' : ' no'),
          ` data-n="${U.esc(P[k].name)}${k === cur ? ' — сейчас' : conf(k) ? ' — подключена' : ''}"`).replace('style="', `style="--i:${i};`)).join('')}</span>`
        + `<span class="aib-fan-f">${on ? `Сейчас работает <b>${U.esc(label(cur))}</b> · нажмите, чтобы сменить` : 'Ни одна не подключена · нажмите — <b>Gemini и Groq бесплатно</b>'}</span></span>`;
      b.setAttribute('aria-label', on ? `Нейросети: подключено — ${P[cur].short}` : 'Нейросети: не подключено — нажмите, чтобы подключить');
      // 🤖 Центр нейросети (js/aihub.js): opens itself once right after the first AI is connected; resumes an unfinished check
      if (window.AIHub && AIHub.onBadge) { try { AIHub.onBadge(on); } catch (e) { console.warn('aihub', e); } }
      b.title = on ? `🤖 Нейросеть: ${P[cur].name}${cur === 'claude' ? ' (ваша подписка через Claude Code)' : ''} — проверяет карточки и переводит. Нажмите, чтобы сменить`
        : '🤖 Нейросеть не подключена — нажмите, чтобы выбрать (Gemini и Groq — бесплатно)';
      this.fitBadge();
      if (!this._badgeRO && window.ResizeObserver) {
        // refit when the window or a neighbour button changes size (fonts loaded, «Слушать» relabelled…)
        let raf = 0;
        const again = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => this.fitBadge()); };
        this._badgeRO = new ResizeObserver(again);
        const tb = b.closest('.topbar');
        if (tb) [tb, ...tb.querySelectorAll('.logo, .top-icons, .nav, .top-actions > :not(#claude-badge), .top-user > *')].forEach(el => this._badgeRO.observe(el));
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
      }
    },
    /** the top bar never wraps: when the room runs out the labels fold into icons, always in the same order —
     *  a little less air → 🤖 the AI button's text → «Слушать» / «Переводчик» captions → 🤖 just the robot → the «Norsk Kort» text → the section
     *  names (last) → ⤴ share and the theme move into «⋯». Phones (html.m-phone) have their own bar: nothing to do there. */
    fitBadge() {
      const b = document.getElementById('claude-badge'), tb = b && b.closest('.topbar');
      if (!tb) return;
      const FOLD = ['tb-tight', 'tb-ico', 'tb-nologo', 'tb-navico', 'tb-more'];
      tb.classList.remove(...FOLD);
      b.dataset.fit = 'l';
      if (!b.offsetParent || document.documentElement.classList.contains('m-phone')) return;
      const cs = getComputedStyle(tb), edge = tb.getBoundingClientRect().right - parseFloat(cs.paddingRight);
      const user = tb.querySelector('.top-user'), nav = tb.querySelector('.nav'), act = tb.querySelector('.top-actions');
      const gap = parseFloat(getComputedStyle(tb.querySelector('.topbar-right')).columnGap) || 0;
      // too full: the last group sticks out, or the actions come closer to the sections than one group gap
      const full = () => (user && user.getBoundingClientRect().right > edge + .5)
        || (nav && act && nav.offsetParent && act.getBoundingClientRect().left - nav.getBoundingClientRect().right < gap - .5);
      const steps = [() => tb.classList.add('tb-tight'), () => { b.dataset.fit = 'm'; }, () => tb.classList.add('tb-ico'), () => { b.dataset.fit = 's'; },
        () => tb.classList.add('tb-nologo'), () => tb.classList.add('tb-navico'), () => tb.classList.add('tb-more')];
      for (const step of steps) { if (!full()) return; step(); }
    },

    /** offline cache (service worker) + ask the browser to keep our data (Safari wipes idle sites after 7 days) */
    setupPWA() {
      const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
      if ('serviceWorker' in navigator && secure) {
        const hadController = !!navigator.serviceWorker.controller;
        // GitHub Pages caches every file for 10 min — bypass the HTTP cache for sw.js so updates arrive at once
        navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).catch(e => console.warn('SW', e));
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!hadController || this._reloaded) return;
          // never interrupt a study session — but never stay silently on the old build either (v231: a tab left on the
          // study screen kept pre-v226 code for days): a small offer «Готово обновление — обновить сейчас?»; leaving the
          // study screen applies it (App.go)
          if (this.view.name === 'study') { this._updPending = true; this.updateBanner(); return; }
          this.applyUpdate();
        });
      }
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    },

    /** reload into the new build (once) */
    applyUpdate() {
      if (this._reloaded) return;
      this._reloaded = true;
      try { if (this.view.name === 'study' && window.Study) Study.end(); } catch (e) { /* the session is saved as it goes */ }
      location.reload();
    },
    /** the small non-blocking offer while the study screen is open: «Обновить» now, × later (then: when leaving the screen) */
    updateBanner() {
      if (document.querySelector('.upd-banner')) return;
      const el = document.createElement('div');
      el.className = 'upd-banner'; el.setAttribute('role', 'status');
      el.innerHTML = `<span class="upd-i">${NavIcons.icon('refresh', 18)}</span><span class="upd-t">Готово обновление — обновить сейчас?</span>
        <button type="button" class="btn sm primary" data-upd-go>Обновить</button>
        <button type="button" class="upd-x" data-upd-x title="Позже — обновится, когда вы выйдете из карточек" aria-label="Позже">${NavIcons.icon('close', 16)}</button>`;
      el.querySelector('[data-upd-go]').onclick = () => this.applyUpdate();
      el.querySelector('[data-upd-x]').onclick = () => el.remove();
      document.body.appendChild(el);
    },

    pickFiles(deckId) {
      this._pickDeck = deckId || null;
      const inp = document.getElementById('file-input');
      inp.value = '';
      inp.click();
    },

    addSampleDeck() {
      const sd = window.SAMPLE_DECK;
      const d = Store.addDeck(sd.name, sd.description, { sample: true });
      sd.cards.forEach(([no, ru, en, description, example, exampleRu]) => {
        Store.addCard(d.id, { no, ru, en, description, example, exampleRu, wordClass: (description.match(/^(substantiv|verb|adjektiv|adverb|interjeksjon)/) || [])[1] || '',
          history: [{ t: Date.now(), by: 'import', a: 'import', n: 'стартовая колода Norsk Kort' }] });
      });
      return d;
    },

    bindGlobal() {
      document.addEventListener('click', e => {
        UI.ripple(e);
        const a = e.target.closest('[data-action]');
        if (!a) return;
        if (a.dataset.action === 'nav') this.goAsk(a.dataset.view);
        if (a.dataset.action === 'study-all') {
          if (this.view.name === 'deck' && this.view.params.id) Study.start({ deckId: this.view.params.id });
          else Study.start({ deckId: null });
        }
        if (a.dataset.action === 'ai-menu') {
          e.stopPropagation();
          // 🤖 every AI the app supports: a dropdown under the button / a bottom sheet on phones (js/aichooser.js)
          if (window.AIChooser) { AIChooser.open(a); return; }
          const items = Object.entries(AI.PROVIDERS).filter(([id]) => AI.configured(id)).map(([id, p]) => ({
            label: `${AI.current() === id ? '★ ' : ''}${p.name}`,
            html: `${aibLogo(id, ' aib-m')} ${U.esc(p.name)}${AI.current() === id ? ' <b style="color:var(--good)">✓</b>' : ''}`, // the same logos as on the 🤖 button
            action: () => { Store.setSetting('aiProvider', id); this.updateBadge(); this.render(); UI.toast('Теперь карточки проверяет: ' + p.name, 'good'); },
          }));
          items.push({ label: '⚙️ Подключить другие нейросети…', action: () => this.go('settings') });
          // 🤖 «Что умеет нейросеть» — the AI hub (js/aihub.js) first: what to do after connecting; a running check right under it
          if (window.AIHub) {
            const st = AIHub.state();
            if (st.run) items.unshift({ html: `<span class="aih-menu-run">${st.live ? '⏳' : '⏸'} Проверка нейросетью: ${st.total ? Math.round(st.done / st.total * 100) : 0}% — открыть</span>`, action: () => AIHub.showRun() });
            items.unshift({ html: `<span class="aih-menu-hub">${robotSvg()} <b>Что умеет нейросеть</b> <small>Центр нейросети</small></span>`, action: () => AIHub.open() });
          }
          UI.menu(a, items);
        }
        if (a.dataset.action === 'more-menu') {
          // phones: the buttons that don't fit in the top bar
          e.stopPropagation();
          const dark = document.documentElement.dataset.theme === 'dark';
          UI.menu(a, [
            { label: '🎧 Слушать — колоды, книги, новости', action: () => (window.ListenUI ? ListenUI.chooser() : Listen.open('')) },
            ...(window.Views && Views.openLibrary ? [{ label: '📚 Библиотека — читать и слушать', action: () => Views.openLibrary() }] : []),
            { label: '🗣 Переводчик в наушниках', action: () => Interp.toggle() },
            { label: '🔗 Поделиться приложением', action: () => ShareApp.open() },
            ...(window.AppNav ? [{ label: '🧭 Навигатор по приложению', action: () => AppNav.open() }] : window.Help ? [{ label: '❓ Как пользоваться — подсказки', action: () => Help.open() }] : []),
            ...(window.AppThemes ? [{ label: '🎨 Оформление', action: () => Views.looksSheet(App.view.name === 'deck' ? App.view.params.id : null) }] : []),
            ...(window.About ? [{ label: 'ℹ️ О приложении', action: () => About.open() }] : []),
            { html: `${robotSvg()} Нейросеть: ${AI.available() ? U.esc(AI.PROVIDERS[AI.current()].name) : 'не подключена'}`, action: () => (window.AIChooser ? AIChooser.open(a) : this.go('settings')) },
            { label: dark ? '🌞 Светлая тема' : '🌙 Тёмная тема', action: () => { Store.setSetting('theme', dark ? 'light' : 'dark'); this.applyTheme(); if (this.view.name === 'settings') this.render(); } },
          ]);
        }
        if (a.dataset.action === 'interp') Interp.toggle();
        if (a.dataset.action === 'share-app') ShareApp.open();
        if (a.dataset.action === 'account') this.go('account');
        if (a.dataset.action === 'listen') {
          // 🎧 playing → the «Сейчас играет» player; in a deck / study → that deck; elsewhere → «Что послушать?»
          if (window.ListenUI) ListenUI.top();
          else if (Listen.p) Listen.toggle();
          else Listen.open(this.view.name === 'deck' ? this.view.params.id : (this.view.name === 'study' && Study.current() ? Study.current().card.deckId : ''));
        }
        if (a.dataset.action === 'toggle-theme') {
          const cur = document.documentElement.dataset.theme;
          Store.setSetting('theme', cur === 'dark' ? 'light' : 'dark');
          this.applyTheme();
          if (this.view.name === 'settings') this.render();
        }
      });
      document.getElementById('file-input').addEventListener('change', e => {
        const files = [...e.target.files];
        if (files.length) Views.importFiles(files, this._pickDeck || (this.view.name === 'deck' ? this.view.params.id : null));
      });
      document.addEventListener('keydown', e => Study.onKey(e));
      // 📚 library hover card: a button near the right edge opens it to the left, so it is never cut off
      document.addEventListener('pointerover', e => {
        const w = e.target.closest && e.target.closest('.lib-btn-wrap'); if (!w) return;
        const r = w.getBoundingClientRect(), half = Math.min(360, innerWidth * 0.86) / 2;
        w.classList.toggle('lib-right', r.left + r.width / 2 + half > innerWidth - 8);
      });
      // provenance badges (✍️ 📥 DeepL Claude…) — open the card's history; capture phase so the card itself doesn't open/flip
      document.addEventListener('click', e => {
        const b = e.target.closest('[data-prov]');
        if (!b) return;
        e.stopPropagation(); e.preventDefault();
        Prov.historyDialog(b.dataset.card, b.dataset.prov);
      }, true);

      // reading player: inline controls (study) + floating pill (all other screens, modals)
      const pill = document.getElementById('tts-player');
      pill.addEventListener('click', e => {
        const b = e.target.closest('[data-tts]'); if (!b) return;
        ({ toggle: () => TTS.toggle(), restart: () => TTS.restart(), stop: () => this.ttsStopAsk() })[b.dataset.tts]();
      });
      document.addEventListener('tts-state', e => {
        const st = e.detail.state;
        const p = e.detail.player;
        document.querySelectorAll('[data-tts-ctl]').forEach(box => {
          const t = box.querySelector('[data-act="tts-toggle"]');
          if (t) {
            t.innerHTML = UI.icon(st === 'playing' ? 'pause' : 'play', 22);
            t.title = st === 'playing' ? 'Пауза (P)' : st === 'paused' ? 'Продолжить с того же места (P)' : 'Читать (P)';
            t.classList.toggle('playing', st === 'playing'); t.classList.toggle('paused', st === 'paused');
          }
          const s = box.querySelector('[data-act="tts-stop"]'); if (s) s.disabled = st === 'idle';
          const r = box.querySelector('[data-act="tts-restart"]'); if (r) r.disabled = !TTS.last;
        });
        const showPill = st !== 'idle' && (this.view.name !== 'study' || document.querySelector('.modal-backdrop'));
        pill.hidden = !showPill;
        pill.classList.toggle('paused', st === 'paused');
        pill.querySelector('[data-tts="toggle"]').innerHTML = UI.icon(st === 'paused' ? 'play' : 'pause', 18);
        pill.querySelector('.tts-label').textContent = st === 'paused' ? 'Пауза' : p ? `Читаю ${Math.min(p.i + 1, p.segs.length)}/${p.segs.length}` : 'Читаю…';
        placePill();
      });
      // in study the pill sits just above the grade buttons (not over them, not over the top bar)
      const placePill = () => {
        const ar = !pill.hidden && document.body.dataset.view === 'study' && !document.querySelector('#modal-root .modal-backdrop') && document.querySelector('.answer-row');
        if (ar) { pill.style.top = Math.max(8, ar.getBoundingClientRect().top - pill.offsetHeight - 8) + 'px'; pill.style.bottom = 'auto'; }
        else { pill.style.top = ''; pill.style.bottom = ''; }
      };
      window.addEventListener('resize', placePill);
      // a window opened / closed while reading: show or hide the pill now, not at the next sentence
      new MutationObserver(() => {
        if (TTS.state() === 'idle') return;
        pill.hidden = !(this.view.name !== 'study' || document.querySelector('#modal-root .modal-backdrop:not(.closing)'));
        placePill();
      }).observe(document.getElementById('modal-root'), { childList: true });
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applyTheme());

      // drag & drop files anywhere
      const ov = document.getElementById('drop-overlay');
      let depth = 0;
      // the photo picker takes dropped pictures itself — no "import cards" overlay over it
      // windows with their own drop zone (photo picker, 📘 textbook) take the files themselves
      const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files') && !document.querySelector('.photo-modal, .tb-modal, .subs-modal, .ac-modal');
      window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); depth++; ov.classList.add('show'); });
      window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) ov.classList.remove('show'); });
      window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
      window.addEventListener('drop', e => {
        if (!hasFiles(e)) return;
        e.preventDefault(); depth = 0; ov.classList.remove('show');
        const files = [...e.dataTransfer.files];
        if (files.length) Views.importFiles(files, this.view.name === 'deck' ? this.view.params.id : null);
      });
      window.addEventListener('beforeunload', () => Store.saveNow());
    },
  };

  window.App = App;
  window.addEventListener('DOMContentLoaded', () => App.init().catch(e => {
    console.warn('start', e); // the technical detail: console only
    document.getElementById('view').innerHTML = `<div class="panel empty app-oops" role="alert"><div class="big">😵</div>
      <p><b>Приложение не запустилось.</b><br>Обновите страницу — ваши карточки и колоды на месте.</p>
      <button class="btn primary" type="button" onclick="location.reload()">🔄 Обновить страницу</button></div>`;
  }));
})();
