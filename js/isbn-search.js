/* ============================================================
 * isbn-search.js
 * 日本の学校利用を前提に、openBDを正として書誌情報を取得する。
 * 表紙だけはopenBDに無い場合、またはopenBD画像が利用できない場合に
 * Google Booksをフォールバックとして利用する。
 * ============================================================ */
(function (global) {
  'use strict';

  var TIMEOUT_MS = 8000;

  function fetchWithTimeout(url, options) {
    if (typeof AbortController === 'undefined') return fetch(url, options);
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    return fetch(url, Object.assign({}, options, { signal: controller.signal }))
      .finally(function () { clearTimeout(timer); });
  }

  function toHalfWidthDigits(s) {
    return String(s || '').replace(/[０-９]/g, function (m) {
      return String.fromCharCode(m.charCodeAt(0) - 0xFEE0);
    });
  }

  function extractCleanNum(v) {
    if (!v) return 0;
    var s = toHalfWidthDigits(v).replace(/[^0-9]/g, '');
    var n = parseInt(s, 10);
    return isNaN(n) ? 0 : n;
  }

  function cleanAuthorName(s) {
    if (!s) return '';
    var c = s
      .replace(/(\d{4}\s*-\s*\d{4}|\d{4}\s*-\s*|\s*-\s*\d{4})/g, '')
      .replace(/[著編訳]|監修|ほか|イラスト/g, '')
      .replace(/[／/,，、．.\[\]()（）]/g, ' ')
      .trim();
    var parts = Array.from(new Set(c.split(/\s+/).filter(function (x) { return x.length > 0; })));
    return parts.filter(function (x) {
      return !parts.some(function (o) { return o !== x && o.indexOf(x) !== -1; });
    }).join(' ').trim();
  }

  function toHttps(url) {
    return url ? url.replace(/^http:\/\//, 'https://') : url;
  }

  function createResult(isbn13) {
    return {
      title: '',
      author: '',
      coverUrl: '',
      pageCandidates: [],
      priceCandidates: [],
      isbn: isbn13,
      source: ''
    };
  }

  function fromOpenBD(isbn13, result) {
    var url = 'https://api.openbd.jp/v1/get?isbn=' + encodeURIComponent(isbn13);
    return fetchWithTimeout(url).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (data) {
      if (!data || !data[0]) return false;

      var summary = data[0].summary || {};
      var onix = data[0].onix || {};

      // 書誌情報はopenBDを正とする。Google Booksで上書きしない。
      if (summary.title) result.title = summary.title;
      if (summary.author) result.author = cleanAuthorName(summary.author);
      if (summary.cover) result.coverUrl = toHttps(summary.cover);
      if (summary.pages) result.pageCandidates.push(extractCleanNum(summary.pages));

      try {
        var exts = onix.DescriptiveDetail && onix.DescriptiveDetail.Extent;
        if (Array.isArray(exts)) {
          exts.forEach(function (e) {
            if (['00', '05', '06', '07', '08', '11'].indexOf(e.ExtentType) !== -1) {
              result.pageCandidates.push(extractCleanNum(e.ExtentValue));
            }
          });
        }
      } catch (e) {}

      try {
        var prices = onix.ProductSupply && onix.ProductSupply.SupplyDetail && onix.ProductSupply.SupplyDetail.Price;
        if (Array.isArray(prices)) {
          prices.forEach(function (p) {
            if (p.PriceAmount) result.priceCandidates.push(extractCleanNum(p.PriceAmount));
          });
        }
      } catch (e) {}

      result.source = 'openBD';
      return true;
    }).catch(function () {
      return false;
    });
  }

  // Google BooksはopenBDに本自体が無い場合の完全フォールバック、
  // またはopenBDに表紙画像だけが無い場合の表紙フォールバックとして使う。
  function fromGoogleBooks(isbn13, result, coverOnly) {
    var url = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + encodeURIComponent(isbn13);
    return fetchWithTimeout(url).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (data) {
      if (!data || !Array.isArray(data.items) || !data.items[0]) return false;

      var item = data.items[0];
      var info = item.volumeInfo || {};
      var googleCover = info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail);

      if (coverOnly) {
        if (!result.coverUrl && googleCover) {
          result.coverUrl = toHttps(googleCover);
          result.source = 'openBD+googleBooks-cover';
          return true;
        }
        return false;
      }

      // openBDに本が無い場合だけ、Google Booksを書誌情報として採用する。
      if (info.title) result.title = info.title;
      if (Array.isArray(info.authors)) result.author = cleanAuthorName(info.authors.join(' '));
      if (googleCover) result.coverUrl = toHttps(googleCover);
      if (info.pageCount) result.pageCandidates.push(parseInt(info.pageCount, 10));
      if (item.saleInfo && item.saleInfo.listPrice) {
        result.priceCandidates.push(extractCleanNum(item.saleInfo.listPrice.amount));
      }
      result.source = 'googleBooks';
      return true;
    }).catch(function () {
      return false;
    });
  }

  function lookupIsbn(isbn13) {
    var result = createResult(isbn13);

    return fromOpenBD(isbn13, result).then(function (openBdFound) {
      if (!openBdFound) {
        // openBDに無い本だけGoogle Booksを完全フォールバック。
        return fromGoogleBooks(isbn13, result, false);
      }

      if (!result.coverUrl) {
        // 書誌情報はopenBDのまま。表紙だけGoogle Booksから補完。
        return fromGoogleBooks(isbn13, result, true);
      }

      return false;
    }).then(function () {
      var pages = result.pageCandidates
        .filter(function (n) { return !isNaN(n) && n > 0; })
        .sort(function (a, b) { return b - a; });
      var prices = result.priceCandidates
        .filter(function (n) { return !isNaN(n) && n > 0; })
        .sort(function (a, b) { return b - a; });

      return {
        title: result.title || '',
        author: result.author || '',
        coverUrl: result.coverUrl || '',
        pageCount: pages.length > 0 ? pages[0] : 0,
        price: prices.length > 0 ? prices[0] : 0,
        isbn: isbn13,
        source: result.source || ''
      };
    });
  }

  global.RR = global.RR || {};
  global.RR.ISBNSearch = { lookupIsbn: lookupIsbn };
})(window);
