/* Service Worker：代码网络优先，图片和音频缓存优先 + 离线兜底。
 * 注意：不拦截 /socket.io（WebSocket/轮询必须走网络）。 */
'use strict';
var CACHE_PREFIX = 'games-gandengyan-';
var CACHE = CACHE_PREFIX + 'v2-webp';
var BASE = '/games/gandengyan';
// 只预缓存页面和代码；图片、音频在使用时下载并缓存。
var PRECACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/battle-v2.css',
  '/css/result-v2.css',
  '/css/waiting-v2.css',
  '/css/buttons-cylinder-v1.css',
  '/css/settings-v2.css',
  '/css/leaderboard-v2.css',
  '/css/missions-v2.css',
  '/css/topbar-icons-v2.css',
  '/css/menu-icons-v2.css',
  '/css/exit-dialog-v2.css',
  '/js/main.js',
  '/js/ui.js',
  '/js/sound.js',
  '/js/game-shared.js',
  '/logo.png',
  '/manifest.webmanifest'
].map(function (url) { return BASE + url; });
PRECACHE.push(BASE + '/js/socket.io.min.js');

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf(CACHE_PREFIX) === 0 && k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.indexOf(BASE + '/') !== 0) return;
  if (url.pathname.indexOf(BASE + '/socket.io') === 0) return;

  var isAsset = url.pathname.indexOf(BASE + '/assets/') === 0;
  e.respondWith(
    (isAsset ? caches.match(req) : Promise.resolve(null)).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.ok) {
          var clone = res.clone();
          e.waitUntil(caches.open(CACHE).then(function (c) { return c.put(req, clone); }));
        }
        return res;
      }).catch(function () {
        // 离线：静态资源走缓存；页面导航兜底到 /
        return caches.match(req).then(function (m) {
          if (m) return m;
          if (req.mode === 'navigate') return caches.match(BASE + '/');
          return Response.error();
        });
      });
    })
  );
});
