/* ============================================================
 * sw.js
 * 読書レコードのアプリ本体をキャッシュし、オフラインでも
 * 本棚の閲覧・お気に入り・削除・設定・バックアップ書き出しが
 * 使えるようにする。
 * ============================================================ */

var CACHE_NAME = 'reading-record-cache-v5';

var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/responsive.css',
  './js/stats.js',
  './js/storage.js',
  './js/books.js',
  './js/imagestore.js',
  './js/isbn-search.js',
  './js/barcode.js',
  './js/camera.js',
  './js/backup.js',
  './js/ui-common.js',
  './js/views/shelf.js',
  './js/views/add.js',
  './js/views/settings.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .catch(function () {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
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
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
