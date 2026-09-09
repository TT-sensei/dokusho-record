/* ============================================================
 * sw.js
 * アプリ本体(HTML/CSS/JS/アイコン)をキャッシュし、オフラインでも
 * 閲覧・記録・集計・バッジ・設定が使えるようにする。
 *
 * ISBN検索(openBD/Google Books)やバッジ・ナビキャラの画像など
 * 外部ドメインへのリクエストはこのSWで横取りしない
 * (通常のネットワーク動作に任せ、失敗時はアプリ側のJSで
 *  ハンドリングする)。
 * ============================================================ */

var CACHE_NAME = 'reading-record-cache-v1';

var APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/responsive.css',
  './js/stats.js',
  './js/storage.js',
  './js/books.js',
  './js/badges.js',
  './js/navi.js',
  './js/api.js',
  './js/barcode.js',
  './js/backup.js',
  './js/ui-common.js',
  './js/views/home.js',
  './js/views/add.js',
  './js/views/records.js',
  './js/views/stats.js',
  './js/views/badges.js',
  './js/views/settings.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .catch(function () { /* 一部キャッシュに失敗してもインストール自体は続行する */ })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  // 同一オリジン以外(外部API・外部画像)はSWで扱わず、通常のネットワーク動作に任せる
  if (url.origin !== self.location.origin) {
    return;
  }
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        if (response && response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, clone); });
        }
        return response;
      }).catch(function () {
        // オフラインでキャッシュにも無い場合はトップページを返す(SPAのフォールバック)
        return caches.match('./index.html');
      });
    })
  );
});
