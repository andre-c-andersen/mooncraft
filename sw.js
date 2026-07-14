// Offline support: a network-first service worker.
//
// Every request tries the network first, so online players always get the
// latest deployed build — the cache is purely a fallback for when the
// network is gone. On install the whole site is precached into a cache named
// after the version; each push bumps VERSION here (in sync with config.js),
// which changes this file, re-triggers install, and re-downloads a coherent
// snapshot — offline play never mixes files from two builds. activate drops
// the old builds' caches.
//
// All URLs are relative to this script's directory (the site root), so the
// site also works served from a subpath. Adding a site file? Add it to
// PRECACHE — tests/sw-check.mjs fails if this list and the files on disk
// drift apart, or if VERSION here doesn't match config.js.

const VERSION = '1.38';
const CACHE = 'games-v' + VERSION;

const PRECACHE = [
  './',
  'mooncraft/',
  'mooncraft/css/style.css',
  'mooncraft/manifest.json',
  'mooncraft/icons/icon-180.png',
  'mooncraft/icons/icon-192.png',
  'mooncraft/icons/icon-512.png',
  'mooncraft/js/asteroids.js',
  'mooncraft/js/audio.js',
  'mooncraft/js/bombs.js',
  'mooncraft/js/cannons.js',
  'mooncraft/js/canvas.js',
  'mooncraft/js/config.js',
  'mooncraft/js/game.js',
  'mooncraft/js/hiscores.js',
  'mooncraft/js/hud.js',
  'mooncraft/js/input/gamepad.js',
  'mooncraft/js/input/keyboard.js',
  'mooncraft/js/input/touch.js',
  'mooncraft/js/lander.js',
  'mooncraft/js/main.js',
  'mooncraft/js/menu.js',
  'mooncraft/js/particles.js',
  'mooncraft/js/perf.js',
  'mooncraft/js/settings.js',
  'mooncraft/js/shop.js',
  'mooncraft/js/state.js',
  'mooncraft/js/terrain.js',
  'mooncraft/sounds/bomb-explosion.mp3',
  'mooncraft/sounds/bomb-release.mp3',
  'mooncraft/sounds/cannon-fire.mp3',
  'mooncraft/sounds/laser-charge.mp3',
  'mooncraft/sounds/laser-fire-2.mp3',
  'mooncraft/sounds/laser-fire.mp3',
  'mooncraft/sounds/music.mp3',
  'mooncraft/sounds/shield-hit.mp3',
  'mooncraft/sounds/ship-crash.mp3',
  'mooncraft/sounds/thrusters.mp3',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ignoreSearch: an offline navigation to ?level=4 still gets the cached page
async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch (err) {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(networkFirst(req));
});
