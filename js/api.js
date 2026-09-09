/* ============================================================
 * api.js
 * ISBNから書籍情報を検索する。
 * 優先順位: openBD → Google Books API
 * どちらも失敗/未取得の場合はnullを返し、呼び出し側で手入力へ
 * 誘導する(このファイルの中で例外を投げっぱなしにしない)。
 * ============================================================ */
(function (global) {
  'use strict';

  var TIMEOUT_MS = 8000;

  function fetchWithTimeout(url, timeoutMs) {
    if (typeof AbortController === 'undefined') {
      return fetch(url);
    }
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    return fetch(url, { signal: controller.signal }).finally(function () {
      clearTimeout(timer);
    });
  }

  /** openBDから書籍情報を取得する。見つからない/失敗時はnull。 */
  function fetchFromOpenBD(isbn13) {
    var url = 'https://api.openbd.jp/v1/get?isbn=' + encodeURIComponent(isbn13);
    return fetchWithTimeout(url, TIMEOUT_MS)
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (json) {
        if (!json || !Array.isArray(json) || !json[0]) return null;
        var item = json[0];
        var summary = item.summary || {};
        if (!summary.title) return null;
        return {
          title: summary.title || '',
          author: summary.author || '',
          publisher: summary.publisher || '',
          coverUrl: summary.cover || '',
          isbn: summary.isbn || isbn13
        };
      })
      .catch(function () { return null; });
  }

  /** Google Books APIから書籍情報を取得する。見つからない/失敗時はnull。 */
  function fetchFromGoogleBooks(isbn13) {
    var url = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + encodeURIComponent(isbn13);
    return fetchWithTimeout(url, TIMEOUT_MS)
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (json) {
        if (!json || !Array.isArray(json.items) || !json.items[0]) return null;
        var info = json.items[0].volumeInfo || {};
        if (!info.title) return null;
        var cover = '';
        if (info.imageLinks) {
          cover = info.imageLinks.thumbnail || info.imageLinks.smallThumbnail || '';
          // httpのままだと混在コンテンツで弾かれることがあるためhttpsへ
          cover = cover.replace(/^http:\/\//, 'https://');
        }
        return {
          title: info.title || '',
          author: Array.isArray(info.authors) ? info.authors.join(', ') : '',
          publisher: info.publisher || '',
          coverUrl: cover,
          isbn: isbn13
        };
      })
      .catch(function () { return null; });
  }

  /**
   * ISBNから書籍情報を検索する。openBDを優先し、取得できない/情報が
   * 不十分な項目はGoogle Booksで補う。両方失敗した場合はnull。
   */
  function lookupIsbn(isbn13) {
    return fetchFromOpenBD(isbn13).then(function (openbdResult) {
      return fetchFromGoogleBooks(isbn13).then(function (googleResult) {
        if (!openbdResult && !googleResult) return null;
        if (openbdResult && !googleResult) return openbdResult;
        if (!openbdResult && googleResult) return googleResult;
        // 両方取得できた場合はopenBDを優先しつつ、欠けている項目をGoogle Booksで補完
        return {
          title: openbdResult.title || googleResult.title || '',
          author: openbdResult.author || googleResult.author || '',
          publisher: openbdResult.publisher || googleResult.publisher || '',
          coverUrl: openbdResult.coverUrl || googleResult.coverUrl || '',
          isbn: openbdResult.isbn || googleResult.isbn || isbn13
        };
      });
    });
  }

  global.RR = global.RR || {};
  global.RR.API = {
    lookupIsbn: lookupIsbn,
    fetchFromOpenBD: fetchFromOpenBD,
    fetchFromGoogleBooks: fetchFromGoogleBooks
  };
})(window);
