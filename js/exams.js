/* ============ 🎓 Exams: Norskprøven A1–B2, Statsborgerprøven, Samfunnskunnskapsprøven ============
 * Official practice material from HK-dir (Direktoratet for høyere utdanning og kompetanse) and the study base
 * samfunnskunnskap.no — LINKED only (their rights forbid copying), opened on their sites.
 * Plus what in the app helps for each part of the exam.
 */
(function () {
  const L = (title, url, note) => ({ title, url, note });
  const SECTIONS = [
    {
      icon: '🗣', title: 'Norskprøven A1–B2 — экзамен по норвежскому',
      text: 'Четыре части: чтение, аудирование, письмо и устная часть. Письменные части сдаются на компьютере. Для гражданства и ПМЖ обычно нужен устный уровень A2/B1.',
      links: [
        L('Официальные пробные задания: аудирование A1–B2', 'https://prove.hkdir.no/en/norwegian-language-test-a1-b2/practice-for-test-norwegian-language-a1-b2/practice-for-the-listening-test', 'HK-dir — настоящий формат экзамена, с демо-входом прямо по ссылке'),
        L('Все пробные задания: чтение, письмо, устная часть', 'https://prove.hkdir.no/en/norwegian-language-test-a1-b2/practice-for-test-norwegian-language-a1-b2', 'HK-dir'),
        L('Что значит A1, A2, B1, B2 — описание уровней', 'https://prove.hkdir.no/en/language-levels', 'HK-dir'),
      ],
      app: ['🎯 «Следующие 20 слов» по уровням A1–B2', '✍️ «Вставь слово» — слова в контексте', '🗣 Проверка произношения и ✍️ диктант', '📰 Новости простым языком — чтение и аудирование', '📺 YouTube: Preben, NTN Skole, Courses Norwegian, Norskdrypp — подготовка к Norskprøve'],
    },
    {
      icon: '🏛', title: 'Statsborgerprøven — тест на гражданство',
      text: 'Тест о норвежском обществе (история, политика, права и обязанности) — на норвежском или английском.',
      links: [L('Официальный пробный тест', 'https://prove.hkdir.no/en/norwegian-citizenship-test/practice-for-the-test-citizenship-test', 'HK-dir')],
      app: ['📺 YouTube: Nick i Norge — вопросы с разбором (по-украински)'],
    },
    {
      icon: '📚', title: 'Samfunnskunnskapsprøven — обществознание',
      text: 'Экзамен по курсу обществознания (50 часов). Его можно сдавать на родном языке — есть русский и украинский.',
      links: [
        L('Программа и пробные задания', 'https://prove.hkdir.no/en/social-studies-test/read-the-curriculum-and-practice-for-the-test-social-studies', 'HK-dir'),
        L('Учебник samfunnskunnskap.no — на русском и украинском', 'https://samfunnskunnskap.no/', 'бесплатно, официальная учебная база (© Cappelen Damm)'),
        L('NDLA: материалы по обществознанию на украинском', 'https://ndla.no/en/f/ukrainske-ressurser-i-samfunnskunnskap/1022072a8411', 'NDLA'),
      ],
      app: ['🔤 Выделите незнакомое слово в любом тексте приложения — сразу перевод и карточка'],
    },
  ];

  const Exams = {
    SECTIONS,
    open() {
      UI.modal({
        title: '🎓 Экзамены: Norskprøven, гражданство, обществознание', cls: 'wide exams-modal',
        body: `<div class="lib-intro">🎓 <span>Официальные пробные задания открываются на сайтах HK-dir и samfunnskunnskap.no — так разрешено их правилами (копировать их в приложение нельзя). Ниже — что в Norsk Kort помогает к каждой части экзамена.</span></div>
          ${SECTIONS.map(s => `<section class="ex-sec panel">
            <h3>${s.icon} ${U.esc(s.title)}</h3>
            <p class="small muted">${U.esc(s.text)}</p>
            <div class="ex-links">${s.links.map(l => `<a class="ex-link" href="${U.esc(l.url)}" target="_blank" rel="noopener"><b>↗ ${U.esc(l.title)}</b><small>${U.esc(l.note)}</small></a>`).join('')}</div>
            ${s.app.length ? `<div class="small"><b>В приложении:</b></div><ul class="ex-app">${s.app.map(a => `<li>${U.esc(a)}</li>`).join('')}</ul>` : ''}
          </section>`).join('')}
          <div class="tiny muted">Ссылки ведут на официальные сайты; приложение не связано с HK-dir. Требования к экзаменам меняются — сверяйтесь с сайтом HK-dir и вашей коммуной.</div>`,
      });
    },
  };
  window.Exams = Exams;
})();
