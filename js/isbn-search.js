/* ============================================================
 * isbn-search.js
 * Google Books / openBD / NDLサーチからISBN書誌情報を取得する。
 * 無料・APIキー不要の3ソースを並行取得し、欠けを補完する。
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
    return url ? String(url).replace(/^http:\/\//, 'https://') : '';
  }

  function findOpenBDCover(book) {
    if (!book) return '';
    var summary = book.summary || {};
    if (summary.cover) return toHttps(summary.cover);

    try {
      var resources = book.onix && book.onix.CollateralDetail && book.onix.CollateralDetail.SupportingResource;
      if (Array.isArray(resources)) {
        for (var i = 0; i < resources.length; i++) {
          var versions = resources[i] && resources[i].ResourceVersion;
          if (!Array.isArray(versions)) continue;
          for (var j = 0; j < versions.length; j++) {
            var link = versions[j] && versions[j].ResourceLink;
            if (link) return toHttps(link);
          }
        }
      }
    } catch (e) {}

    var isbn = summary.isbn || '';
    if (/^\d{13}$/.test(isbn)) return 'https://cover.openbd.jp/' + isbn + '.jpg';
    return '';
  }

  function createResult(isbn13) {
    return {
      title: '',
      author: '',
      coverUrl: '',
      pageCandidates: [],
      priceCandidates: [],
      isbn: isbn13,
      source: []
    };
  }

  function addSource(result, name) {
    if (result.source.indexOf(name) === -1) result.source.push(name);
  }

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
      result.coverUrl = findOpenBDCover(data[0]);
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

      addSource(result, 'openBD');
      return true;
    }).catch(function () { return false; });
  }

  function fromGoogleBooks(isbn13, result) {
    var url = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + encodeURIComponent(isbn13);
    return fetchWithTimeout(url).then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (data) {
      if (!data || !Array.isArray(data.items) || !data.items[0]) return false;

      var item = data.items[0];
      var info = item.volumeInfo || {};
      var googleCover = info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail);

      if (!result.title && info.title) result.title = info.title;
      if (!result.author && Array.isArray(info.authors)) result.author = cleanAuthorName(info.authors.join(' '));
      if (!result.coverUrl && googleCover) result.coverUrl = toHttps(googleCover);
      if (info.pageCount) result.pageCandidates.push(parseInt(info.pageCount, 10));
      if (item.saleInfo && item.saleInfo.listPrice) {
        result.priceCandidates.push(extractCleanNum(item.saleInfo.listPrice.amount));
      }

      addSource(result, 'googleBooks');
      return true;
    }).catch(function () { return false; });
  }

  function getXmlText(node, localName) {
    if (!node) return '';
    var nodes = node.getElementsByTagNameNS
      ? node.getElementsByTagNameNS('*', localName)
      : node.getElementsByTagName(localName);
    return nodes && nodes.length ? String(nodes[0].textContent || '').trim() : '';
  }

  function getAllXmlText(node, localName) {
    var values = [];
    if (!node) return values;
    var nodes = node.getElementsByTagNameNS
      ? node.getElementsByTagNameNS('*', localName)
      : node.getElementsByTagName(localName);
    for (var i = 0; i < (nodes ? nodes.length : 0); i++) {
      var value = String(nodes[i].textContent || '').trim();
      if (value) values.push(value);
    }
    return values;
  }

  // NDLサーチ OpenSearch はRSS/XMLを返す。ISBNは any 検索で照合する。
  function fromNDL(isbn13, result) {
    var url = 'https://ndlsearch.ndl.go.jp/api/opensearch?cnt=5&mediatype=books&any=' + encodeURIComponent(isbn13);
    return fetchWithTimeout(url, { headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' } }).then(function (r) {
      return r.ok ? r.text() : '';
    }).then(function (xmlText) {
      if (!xmlText || typeof DOMParser === 'undefined') return false;
      var xml = new DOMParser().parseFromString(xmlText, 'application/xml');
      if (!xml || xml.getElementsByTagName('parsererror').length) return false;

      var items = xml.getElementsByTagName('item');
      if (!items.length) return false;
      var item = items[0];
      var title = getXmlText(item, 'title');
      var creators = getAllXmlText(item, 'creator');
      var descriptions = getAllXmlText(item, 'description');
      var extents = getAllXmlText(item, 'extent');
      var identifiers = getAllXmlText(item, 'identifier');

      if (!result.title && title) result.title = title;
      if (!result.author && creators.length) result.author = cleanAuthorName(creators.join(' '));

      extents.concat(descriptions).forEach(function (value) {
        var page = value.match(/(?:全|[Pp\.\s]*)?(\d{2,5})\s*(?:p|頁|ページ)/);
        if (page) result.pageCandidates.push(parseInt(page[1], 10));
      });

      identifiers.forEach(function (value) {
        var price = value.match(/(?:[￥¥]|\bJPY\b)\s*([0-9,]+)/i);
        if (price) result.priceCandidates.push(extractCleanNum(price[1]));
      });

      // NDLの書影APIはISBNから直接参照できるため、他ソースの表紙が無い場合だけ使う。
      if (!result.coverUrl && identifiers.some(function (value) { return value.indexOf(isbn13) !== -1; })) {
        result.coverUrl = 'https://ndlsearch.ndl.go.jp/thumbnail/' + isbn13 + '.jpg';
      }

      addSource(result, 'NDL');
      return true;
    }).catch(function () { return false; });
  }

  function lookupIsbn(isbn13) {
    var result = createResult(isbn13);

    // 3ソースを並行取得。どれか1つが失敗しても残りで続行する。
    return Promise.allSettled([
      fromOpenBD(isbn13, result),
      fromGoogleBooks(isbn13, result),
      fromNDL(isbn13, result)
    ]).then(function () {
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
        source: result.source.join('+')
      };
    });
  }

  global.RR = global.RR || {};
  global.RR.ISBNSearch = { lookupIsbn: lookupIsbn };
})(window);
