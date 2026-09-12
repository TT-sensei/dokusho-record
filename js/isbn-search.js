/* ============================================================
 * isbn-search.js
 * 日本の学校利用を前提に、openBDを第一候補として書誌情報を取得し、
 * 足りない情報がある場合だけGoogle Booksへフォールバックする。
 *
 * 取得順:
 *   1. openBD
 *   2. openBDで見つからない/不足している場合のみGoogle Books
 *
 * NDLサーチなど別ソースは使わず、取得元を明確にする。
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

  function scanPageNumsDeeply(text) {
    if (!text) return [];
    var t = toHalfWidthDigits(text);
    var regex = /(\d{1,4})\s*(?:p|ページ|頁|枚|p\.)|(?:ページ数|ページ|p|page|Pages)[:：\s]*(\d{1,4})/gi;
    var results = [];
    var match;
    while ((match = regex.exec(t)) !== null) {
      var n = parseInt(match[1] || match[2], 10);
      if (!isNaN(n) && n > 5) results.push(n);
    }
    return results;
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

  /** openBDを最優先で取得する */
  function fromOpenBD(isbn13, result) {
    var url = 'https://api.openbd.jp/v1/get?isbn=' + encodeURIComponent(isbn13);
    return fetchWithTimeout(url).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (data) {
      if (!data || !data[0]) return false;

      var summary = data[0].summary || {};
      var onix = data[0].onix || {};

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
      } catch (e) { /* ONIX構造の差は無視 */ }

      try {
        var prices = onix.ProductSupply && onix.ProductSupply.SupplyDetail && onix.ProductSupply.SupplyDetail.Price;
        if (Array.isArray(prices)) {
          prices.forEach(function (p) {
            if (p.PriceAmount) result.priceCandidates.push(extractCleanNum(p.PriceAmount));
          });
        }
      } catch (e) { /* ONIX構造の差は無視 */ }

      result.source = 'openBD';
      return true;
    }).catch(function () {
      return false;
    });
  }

  /** openBDで不足している場合だけGoogle Booksを取得する */
  function fromGoogleBooks(isbn13, result) {
    var url = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + encodeURIComponent(isbn13);
    return fetchWithTimeout(url).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (data) {
      if (!data || !Array.isArray(data.items) || !data.items[0]) return false;

      var item = data.items[0];
      var info = item.volumeInfo || {};

      if (!result.title && info.title) result.title = info.title;
      if (!result.author && Array.isArray(info.authors)) result.author = cleanAuthorName(info.authors.join(' '));
      if (!result.coverUrl && info.imageLinks) {
        result.coverUrl = toHttps(info.imageLinks.thumbnail || info.imageLinks.smallThumbnail || '');
      }
      if (info.pageCount) result.pageCandidates.push(parseInt(info.pageCount, 10));
      if (info.description) result.pageCandidates = result.pageCandidates.concat(scanPageNumsDeeply(info.description));
      if (item.saleInfo && item.saleInfo.listPrice) {
        result.priceCandidates.push(extractCleanNum(item.saleInfo.listPrice.amount));
      }

      if (result.source !== 'openBD') result.source = 'googleBooks';
      else result.source = 'openBD+googleBooks';
      return true;
    }).catch(function () {
      return false;
    });
  }

  /**
   * ISBN(13桁)から書誌情報を検索する。
   * openBDを先に確認し、不足分だけGoogle Booksで補完する。
   */
  function lookupIsbn(isbn13) {
    var result = createResult(isbn13);

    return fromOpenBD(isbn13, result).then(function (openBdFound) {
      // openBDが本を返していても、タイトルまたは表紙が欠けていればGoogle Booksで補完する。
      if (!openBdFound || !result.title || !result.coverUrl) {
        return fromGoogleBooks(isbn13, result);
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
