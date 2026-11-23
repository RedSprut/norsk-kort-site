/* Norsk Kort service worker — offline support.
 * Network-first for the app's own files (so a new version from GitHub is picked up immediately),
 * cache as offline fallback. CDN libraries and images: cache-first after the first load.
 */
const CACHE = 'norsk-kort-v231';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/preloader.css', './js/preloader.js', './icons/preloader/bryggen.webp', './icons/preloader/fjord.webp', './icons/preloader/hytte.webp', './icons/preloader/lofoten.webp', './icons/preloader/nordlys.webp', './icons/preloader/preikestolen.webp', './icons/preloader/snohytte.webp', './icons/preloader/stavkirke.webp', './icons/preloader/vinterskog.webp', './icons/preloader/video-reine.webp',
  './js/bookshelf.js', './css/bookshelf.css',
  './js/dialogs.js', './css/dialogs.css', './data/dialogues-public.json', './data/phrasebook-decks.json', './data/writing-phrases.json',
  './js/gramref.js', './css/gramref.css', './data/grammar-reference.json',
  './js/artcards.js', './css/artcards.css', './js/artcards-no.js', './css/artcards-no.css','./fonts/art-fonts.css', './fonts/marck/marck-normal-latin.woff2', './fonts/marck/marck-normal-cyrillic.woff2', './fonts/oldstandard/oldstandard-normal-700-latin.woff2', './fonts/oldstandard/oldstandard-normal-700-cyrillic.woff2', './fonts/gotisk/grenzegotisch-normal-latin.woff2', './fonts/gotisk/monomakh-normal-cyrillic.woff2', './fonts/mplusrounded/mplusrounded-normal-800-latin.woff2', './fonts/mplusrounded/mplusrounded-normal-800-cyrillic.woff2', './js/apptheme.js', './css/apptheme.css', './js/aihub.js', './css/aihub.css', './js/aichooser.js', './js/voicepicker.js', './css/voicepicker.css', './js/gallery.js', './css/gallery.css', './css/aichooser.css', './js/showcase.js', './css/showcase.css',
  './js/helpanim.js', './css/helpanim.css', './js/coachmarks.js', './icons/icon.svg', './icons/favicon.svg', './icons/favicon-32.png', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-192.png', './icons/icon-maskable-512.png', './css/styles.css',
  './js/util.js', './js/resume.js', './js/store.js', './js/fsrs.js', './js/fsrs-opt.js', './js/fsrs-opt-worker.js', './js/tts.js', './js/voices.js','./js/ai.js', './js/images.js', './js/anki.js',
  './js/importers.js', './js/exporters.js', './js/translators.js', './js/glossary.js', './js/align.js', './js/glossguard.js', './js/selection.js', './js/ordbok.js', './js/sources.js', './js/library.js', './js/grammar.js','./js/youtube.js', './js/pairguard.js', './js/telegram.js', './js/photos.js', './js/books.js', './js/lexicon.js', './js/textbook.js', './js/reader.js', './css/reader.css', './js/prove.js', './css/prove.css', './data/prove-public.json', './js/mycourse.js','./js/exams.js', './js/news.js', './css/news.css', './js/langid.js', './js/subs.js', './js/nrk.js', './js/nrkradio.js', './css/subs.css', './js/drills.js', './css/drills.css', './js/speech.js', './js/asr-worker.js', './css/speech.css', './data/kelly.json', './data/news-supernytt.json','./js/genders.js', './js/progress.js', './js/create.js', './js/social.js', './js/listen.js', './js/listenx.js', './js/listenui.js', './css/listen.css', './js/interpreter.js', './js/share.js', './js/avatar.js', './js/shareapp.js', './js/account.js', './js/signin.js', './js/cloudsync.js', './css/signin.css','./js/guides.js', './js/tgchan.js', './js/tgvideo.js', './js/tgaudio.js', './css/tgaudio.css', './js/audiocourse.js', './css/audiocourse.css', './js/frameocr.js', './css/tgvideo.css', './js/help.js', './css/help.css', './js/gramterms.js', './css/gramterms.css', './js/ordtrainer.js', './css/ordtrainer.css', './data/ordtrainer.json', './data/forms-decks.json', './data/ordbok-sprut-decks.json', './data/pronunciation-decks.json', './data/prove-muntlig.json','./data/grammar-decks.json', './data/tg-channels.json', './js/provenance.js', './js/cardmaker.js', './js/trnotice.js', './css/trnotice.css','./js/sample.js', './js/ui.js', './js/views.js', './js/study.js', './js/levels.js', './css/levels.css', './js/klokka.js', './css/klokka.css', './js/app.js', './js/mobile.js', './js/nav.js', './css/mobile.css',
  './js/continue.js', './js/learnby.js', './css/learnby.css', './js/navigator.js', './css/navigator.css', './js/photofx.js', './css/photofx.css', './js/bookview.js', './css/bookview.css', './css/studyx.css', './js/mypath.js', './css/mypath.css', './js/examprep.js', './css/examprep.css', './data/examprep-core.json', './data/examprep-topics.json', './data/examprep-listen.json', './data/examprep-phrases.json', './js/xp.js', './js/claudelogin.js', './js/phraseday.js', './js/leveltest.js', './js/examtrainer.js', './css/practice.css', './data/phrase-of-day.json', './data/phrase-of-day-a1.json', './data/phrase-of-day-a2.json', './data/phrase-of-day-b1c1.json', './data/life-decks.json', './data/theme-decks.json', './data/level-test.json', './data/exam-practice.json', './js/compare.js', './css/compare.css', './js/printx.js', './css/printx.css', './js/version.js', './js/about.js', './css/about.css', './data/changelog.json',
];
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|cdn\.sheetjs\.com)\//;
const IMG = /^https:\/\/(image\.pollinations\.ai|upload\.wikimedia\.org|www\.google\.com\/s2\/favicons)/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // only old app versions are removed — the downloaded speech models (cache «norsk-kort-models», ~180 MB) stay
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k.startsWith('norsk-kort-v')).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/api/')) return; // bridge calls: never cache
  // 🎧 deck voices saved for offline live in their own cache («norsk-kort-audio», js/listenx.js) — never stored twice
  if (url.pathname.includes('/__nk_audio/')) return;
  // 🔒 personal course material (private/) is never copied into the cache
  if (url.pathname.includes('/private/')) return;
  if (url.origin === self.location.origin) {
    // network-first, bypassing the browser's HTTP cache (Safari kept serving old files); ignore ?v= when falling back
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    // offline: the page itself falls back to the app; a missing script / style / data file fails plainly (never index.html as code)
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
    return;
  }
  // speech libraries keep their own cache (norsk-kort-models) — not stored twice
  if (/\/npm\/(@huggingface\/transformers|onnxruntime-web|@diffusionstudio\/piper-wasm|@mintplex-labs\/piper-tts-web)@/.test(req.url)) return;
  if (CDN.test(req.url) || IMG.test(req.url)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      // opaque responses are not cached: browsers count each one as several MB of quota
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
