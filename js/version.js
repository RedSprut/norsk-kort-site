/* ============ ℹ️ Norsk Kort — product information: the ONE source of truth for the version ============
 *  version  the user-facing semantic version (Norsk Kort is not in the stores yet: 1.0.0)
 *  build    the cache counter — the same N as «?v=N» in index.html and js/printx.js and «norsk-kort-vN» in sw.js
 *  date     the day of this build
 *  author   shown in «ℹ️ О приложении»; empty → «Автор: —» (the owner fills it in)
 *
 *  To release a new build NEVER edit the numbers by hand — run (from the repo folder):
 *      node tools/bump-version.mjs 226 "Что нового — одна строка по-русски для пользователя"
 *  It updates all four places (index.html ?v=, js/printx.js ?v=, sw.js CACHE, this file: build + date)
 *  and regenerates data/changelog.json («Что нового» in «О приложении»). Then `node --check` and commit.
 *  Read by js/about.js («О приложении») — window.APP.
 */
window.APP = Object.freeze({ name: 'Norsk Kort', version: '1.0.0', build: 232, date: '2026-11-23', author: '' });
