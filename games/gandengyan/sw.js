/* Service Worker：静态资源网络优先 + 离线兜底。
 * 注意：不拦截 /socket.io（WebSocket/轮询必须走网络）。 */
'use strict';
var CACHE_PREFIX = 'games-gandengyan-';
var CACHE = CACHE_PREFIX + 'v1';
var BASE = '/games/gandengyan';
var PRECACHE = [
  '/', '/index.html',
  '/css/style.css',
  '/css/battle-v2.css',
  '/css/result-v2.css',
  '/css/waiting-v2.css',
  '/css/buttons-cylinder-v1.css', '/assets/layers/buttons-cylinder-v1/cylinder.png',
  '/css/settings-v2.css', '/assets/layers/settings-v2/title.png',
  '/css/leaderboard-v2.css',
  '/css/missions-v2.css',
  '/css/topbar-icons-v2.css',
  '/css/menu-icons-v2.css',
  '/css/exit-dialog-v2.css',
  '/assets/audio/stargate-loop.mp3',
  '/assets/layers/menu-icons-v2/auto.png',
  '/assets/layers/menu-icons-v2/counter.png',
  '/assets/layers/menu-icons-v2/settings.png',
  '/assets/layers/menu-icons-v2/feedback.png',
  '/assets/layers/menu-icons-v2/switch.png',
  '/assets/layers/hud-icons-v2/tutorial.png', '/assets/layers/hud-icons-v2/help.png',
  '/assets/layers/waiting-v2/counter.png', '/assets/layers/waiting-v2/change.png',
  '/assets/layers/waiting-v2/podium.png',
  '/assets/layers/result-v2/tl.png', '/assets/layers/result-v2/tr.png',
  '/assets/layers/result-v2/bl.png', '/assets/layers/result-v2/br.png',
  '/assets/layers/result-v2/crest-win.png', '/assets/layers/result-v2/crest-lose.png',
  '/assets/layers/result-v2/bomb.png', '/assets/layers/result-v2/hbomb.png',
  '/assets/layers/result-v2/rocket.png', '/assets/layers/result-v2/button.png',
  '/assets/layers/battle-v2/hud-rail.png',
  '/assets/layers/battle-v2/hud-rail-wide.svg',
  '/assets/layers/battle-v2/dealer-badge.svg',
  '/assets/layers/battle-v2/button-pass.png', '/assets/layers/battle-v2/button-hint.png',
  '/assets/layers/battle-v2/button-clear.png', '/assets/layers/battle-v2/button-play.png',
  '/assets/layers/battle-v2/timer.png', '/assets/layers/battle-v2/count-badge.png',
  '/assets/layers/battle-v2/timer-housing-v2.png',
  '/assets/layers/battle-v2/player-module.png', '/assets/layers/battle-v2/card-face-v4.png',
  '/assets/layers/battle-v2/joker-crown.png', '/assets/layers/battle-v2/pass-bubble.png',
  '/js/main.js', '/js/ui.js', '/js/sound.js', '/js/game-shared.js',
  '/logo.png', '/manifest.webmanifest',
  '/assets/battle-bg.png', '/assets/robot-avatar.png',
  '/assets/layers/avatar-v3/head-1.png', '/assets/layers/avatar-v3/head-2.png',
  '/assets/layers/avatar-v3/head-3.png', '/assets/layers/avatar-v3/head-4.png', '/assets/layers/avatar-v3/head-5.png',
  '/assets/layers/avatar-v3/eyes-1.png', '/assets/layers/avatar-v3/eyes-2.png',
  '/assets/layers/avatar-v3/eyes-3.png', '/assets/layers/avatar-v3/eyes-4.png', '/assets/layers/avatar-v3/eyes-5.png',
  '/assets/layers/avatar-v3/mouth-1.png', '/assets/layers/avatar-v3/mouth-2.png',
  '/assets/layers/avatar-v3/mouth-3.png', '/assets/layers/avatar-v3/mouth-4.png', '/assets/layers/avatar-v3/mouth-5.png',
  '/assets/layers/profile-selection-frame-v2.png', '/assets/layers/profile-corner-v2.png',
  '/assets/layers/profile-action-v2.png', '/assets/layers/profile-preview-ring.svg',
  '/assets/layers/home-user-pedestal-v2.png', '/assets/layers/home-profile-gear-v2.png',
  '/assets/layers/home-missions-emblem-v2.png', '/assets/layers/home-leaderboard-emblem-v2.png',
  '/assets/loading-nebula-v3.png', '/assets/loading-panel-v3.png',
  '/assets/layers/mode-frame.png', '/assets/layers/hud-rail.png',
  '/assets/layers/hud-rail-v3.png',
  '/assets/layers/hud-rail-v4.png',
  '/assets/layers/hud-rail-v5.png',
  '/assets/layers/hud-rail-v6.png',
  '/assets/layers/hud-rail-v7.png',
  '/assets/layers/hud-rail-v9.png',
  '/assets/layers/login-cockpit.png',
  '/assets/layers/login-brand-plaque.png',
  '/assets/layers/login-wing-emblem.png',
  '/assets/layers/login-title-art.png',
  '/assets/layers/login-platform-v2.png',
  '/assets/layers/login-energy-orb-v2.png',
  '/assets/layers/login-fragments-layer-v2.png',
  '/assets/layers/login-play-pieces-v2/fragment-01.png',
  '/assets/layers/login-play-pieces-v2/fragment-02.png',
  '/assets/layers/login-play-pieces-v2/fragment-03.png',
  '/assets/layers/login-play-pieces-v2/fragment-04.png',
  '/assets/layers/login-play-pieces-v2/fragment-05.png',
  '/assets/layers/login-play-pieces-v2/fragment-06.png',
  '/assets/layers/login-play-pieces-v2/fragment-07.png',
  '/assets/layers/login-play-pieces-v2/fragment-08.png',
  '/assets/layers/login-play-auth.png',
  '/assets/layers/login-input-frames.png',
  '/assets/layers/splash-logo.png'
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

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var clone = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, clone); });
      }
      return res;
    }).catch(function () {
      // 离线：静态资源走缓存；页面导航兜底到 /
      return caches.match(req).then(function (m) {
        if (m) return m;
        if (req.mode === 'navigate') return caches.match(BASE + '/');
        return Response.error();
      });
    })
  );
});
