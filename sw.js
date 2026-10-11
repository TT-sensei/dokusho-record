/* ============================================================
 * sw.js
 * 読書レコードのアプリ本体をキャッシュし、オフラインでも
 * 本棚・登録済みデータ・設定などを利用できるようにする。
 * ============================================================ */

var CACHE_NAME = 'dokusho-record-cache-v22';

var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/responsive.css',
  './css/spine.css',
  './css/badges.css',
  './css/navi.css',
  './css/theme.css',
  './js/stats.js',
  './js/storage.js',
  './js/books.js',
  './js/imagestore.js',
  './js/isbn-search.js',
  './js/barcode.js',
  './js/camera.js',
  './js/backup.js',
  './js/ui-common.js',
  './js/navi.js',
  './js/badges.js',
  './js/views/shelf.js',
  './js/views/add.js',
  './js/views/settings.js',
  './js/views/badges.js',
  './js/compat-shelf.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  // 必要なファイルがそろわない更新は失敗扱いにし、旧バージョンを維持する。
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key.indexOf('dokusho-record-cache-') === 0 && key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        if (response && response.ok) {
          var clone = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then(function (cache) {
              return cache.put(event.request, clone);
            }).catch(function () {})
          );
        }
        return response;
      }).catch(function () {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html').then(function (cachedIndex) {
            return cachedIndex || new Response('オフラインです。接続後にもう一度お試しください。', {
              status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
          });
        }
        return new Response('このファイルはオフラインで利用できません。接続後にもう一度お試しください。', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});
