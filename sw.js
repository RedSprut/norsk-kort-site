/* Norsk Kort service worker — offline support.
 * Network-first for the app's own files (so a new version from GitHub is picked up immediately),
 * cache as offline fallback. CDN libraries and images: cache-first after the first load.
 */
const CACHE = 'norsk-kort-v184';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/preloader.css', './js/preloader.js', './icons/preloader/bryggen.webp', './icons/preloader/fjord.webp', './icons/preloader/hytte.webp', './icons/preloader/lofoten.webp', './icons/preloader/nordlys.webp', './icons/preloader/preikestolen.webp', './icons/preloader/snohytte.webp', './icons/preloader/stavkirke.webp', './icons/preloader/vinterskog.webp', './icons/preloader/video-reine.webp',
  './js/bookshelf.js', './css/bookshelf.css',
  './js/dialogs.js', './css/dialogs.css', './data/dialogues-public.json', './data/phrasebook-decks.json', './data/writing-phrases.json',
  './js/gramref.js', './css/gramref.css', './data/grammar-reference.json',
  './js/helpanim.js', './css/helpanim.css', './js/coachmarks.js', './icons/icon.svg', './icons/apple-touch-icon.png', './icons/icon-192.png', './css/styles.css',
  './js/util.js', './js/resume.js', './js/store.js', './js/fsrs.js', './js/fsrs-opt.js', './js/fsrs-opt-worker.js', './js/tts.js', './js/voices.js','./js/ai.js', './js/images.js', './js/anki.js',
  './js/importers.js', './js/exporters.js', './js/translators.js', './js/glossary.js', './js/align.js', './js/selection.js', './js/ordbok.js', './js/sources.js', './js/library.js', './js/grammar.js','./js/youtube.js', './js/pairguard.js', './js/telegram.js', './js/photos.js', './js/books.js', './js/lexicon.js', './js/textbook.js', './js/reader.js', './css/reader.css', './js/prove.js', './css/prove.css', './data/prove-public.json', './js/mycourse.js','./js/exams.js', './js/news.js', './css/news.css', './js/langid.js', './js/subs.js', './js/nrk.js', './js/nrkradio.js', './css/subs.css', './js/drills.js', './css/drills.css', './js/speech.js', './js/asr-worker.js', './css/speech.css', './data/kelly.json', './data/news-supernytt.json','./js/genders.js', './js/progress.js', './js/create.js', './js/social.js', './js/listen.js', './js/listenx.js', './js/listenui.js', './css/listen.css', './js/interpreter.js', './js/share.js', './js/avatar.js', './js/shareapp.js', './js/account.js','./js/guides.js', './js/tgchan.js', './js/tgvideo.js', './js/tgaudio.js', './css/tgaudio.css', './js/audiocourse.js', './css/audiocourse.css', './js/frameocr.js', './css/tgvideo.css', './js/help.js', './css/help.css', './js/gramterms.js', './css/gramterms.css', './js/ordtrainer.js', './css/ordtrainer.css', './data/ordtrainer.json', './data/forms-decks.json', './data/ordbok-sprut-decks.json', './data/pronunciation-decks.json', './data/prove-muntlig.json','./data/grammar-decks.json', './data/tg-channels.json', './js/provenance.js', './js/cardmaker.js', './js/trnotice.js', './css/trnotice.css','./js/sample.js', './js/ui.js', './js/views.js', './js/study.js', './js/levels.js', './css/levels.css', './js/klokka.js', './css/klokka.css', './js/app.js',
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
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
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
