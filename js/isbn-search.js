/* ============================================================
 * isbn-search.js
 * NDLサーチ → openBD → Google Books の優先順位で書誌情報を取得。
 * 各APIは並行取得し、結果は固定の優先順位で統合する。
 * ============================================================ */
(function (global) {
  'use strict';

  var TIMEOUT_MS = 8000;

  function fetchWithTimeout(url, options) {
    if (typeof AbortController === 'undefined') return fetch(url, options);
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
    return fetch(url, Object.assign({}, options || {}, { signal: controller.signal }))
      .finally(function () { clearTimeout(timer); });
  }

  function toHalfWidthDigits(value) {
    return String(value || '').replace(/[０-９]/g, function (m) {
      return String.fromCharCode(m.charCodeAt(0) - 0xFEE0);
    });
  }

  function extractCleanNum(value) {
    if (value === null || value === undefined || value === '') return 0;
    var digits = toHalfWidthDigits(value).replace(/[^0-9]/g, '');
    var number = parseInt(digits, 10);
    return isNaN(number) ? 0 : number;
  }

  function cleanAuthorName(value) {
    if (!value) return '';
    var cleaned = String(value)
      .replace(/(\d{4}\s*-\s*\d{4}|\d{4}\s*-\s*|\s*-\s*\d{4})/g, '')
      .replace(/[著編訳]|監修|ほか|イラスト/g, '')
      .replace(/[／/,，、．.\[\]()（）]/g, ' ')
      .trim();
    var parts = Array.from(new Set(cleaned.split(/\s+/).filter(function (part) { return part.length > 0; })));
    return parts.filter(function (part) {
      return !parts.some(function (other) { return other !== part && other.indexOf(part) !== -1; });
    }).join(' ').trim();
  }

  function toHttps(url) {
    return url ? String(url).replace(/^http:\/\//, 'https://') : '';
  }

  function emptyRecord(name) {
    return { name: name, found: false, title: '', author: '', coverUrl: '', pageCount: 0, price: 0 };
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

  function extractPageCount(values) {
    for (var i = 0; i < values.length; i++) {
      var text = toHalfWidthDigits(values[i]);
      var match = text.match(/(?:全\s*)?(\d{1,5})\s*(?:p\.?|頁|ページ)\b?/i);
      if (match) {
        var count = parseInt(match[1], 10);
        if (count > 0) return count;
      }
    }
    return 0;
  }

  function fromNDL(isbn13) {
    var result = emptyRecord('NDL');
    // 最新の外部提供インタフェース仕様（第1.5版）に合わせ、SRUでISBN完全一致検索。
    var query = 'isbn="' + isbn13 + '"';
    var url = 'https://ndlsearch.ndl.go.jp/api/sru?operation=searchRetrieve&version=1.2&maximumRecords=5&recordSchema=dcndl_v3&query=' + encodeURIComponent(query);

    return fetchWithTimeout(url, { headers: { 'Accept': 'application/xml, text/xml' } })
      .then(function (response) { return response.ok ? response.text() : ''; })
      .then(function (xmlText) {
        if (!xmlText || typeof DOMParser === 'undefined') return result;
        var xml = new DOMParser().parseFromString(xmlText, 'application/xml');
        if (!xml || xml.getElementsByTagName('parsererror').length) return result;

        var records = xml.getElementsByTagNameNS
          ? xml.getElementsByTagNameNS('*', 'record')
          : xml.getElementsByTagName('record');
        if (!records.length) return result;

        var recordData = records[0].getElementsByTagNameNS
          ? (records[0].getElementsByTagNameNS('*', 'recordData')[0] || records[0])
          : (records[0].getElementsByTagName('recordData')[0] || records[0]);

        var titles = getAllXmlText(recordData, 'title');
        var creators = getAllXmlText(recordData, 'creator');
        var extents = getAllXmlText(recordData, 'extent');
        var formats = getAllXmlText(recordData, 'format');
        var identifiers = getAllXmlText(recordData, 'identifier');
        var isExactIsbn = identifiers.some(function (identifier) {
          return toHalfWidthDigits(identifier).replace(/[^0-9Xx]/g, '').indexOf(isbn13) !== -1;
        });

        result.title = titles[0] || '';
        result.author = creators.length ? cleanAuthorName(creators[0]) : '';
        result.pageCount = extractPageCount(extents.concat(formats));
        if (isExactIsbn && (result.title || result.author)) {
          result.coverUrl = 'https://ndlsearch.ndl.go.jp/thumbnail/' + isbn13 + '.jpg';
        }
        result.found = Boolean(result.title || result.author || result.coverUrl || result.pageCount);
        return result;
      })
      .catch(function () { return result; });
  }

  function findOpenBDCover(book, isbn13) {
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

    return /^\d{13}$/.test(isbn13) ? 'https://cover.openbd.jp/' + isbn13 + '.jpg' : '';
  }

  function fromOpenBD(isbn13) {
    var result = emptyRecord('openBD');
    var url = 'https://api.openbd.jp/v1/get?isbn=' + encodeURIComponent(isbn13);
    return fetchWithTimeout(url)
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        if (!data || !data[0]) return result;
        var book = data[0];
        var summary = book.summary || {};
        var onix = book.onix || {};
        result.title = summary.title || '';
        result.author = summary.author ? cleanAuthorName(summary.author) : '';
        result.coverUrl = findOpenBDCover(book, isbn13);
        result.pageCount = extractCleanNum(summary.pages);

        try {
          var extents = onix.DescriptiveDetail && onix.DescriptiveDetail.Extent;
          if (!result.pageCount && Array.isArray(extents)) {
            for (var i = 0; i < extents.length; i++) {
              if (['00', '05', '06', '07', '08', '11'].indexOf(extents[i].ExtentType) !== -1) {
                var pages = extractCleanNum(extents[i].ExtentValue);
                if (pages > 0) { result.pageCount = pages; break; }
              }
            }
          }
        } catch (e) {}

        try {
          var supplies = onix.ProductSupply && onix.ProductSupply.SupplyDetail;
          var prices = supplies && supplies.Price;
          if (Array.isArray(prices)) {
            for (var p = 0; p < prices.length; p++) {
              var amount = prices[p] && prices[p].PriceAmount;
              var currency = prices[p] && prices[p].CurrencyCode;
              var price = extractCleanNum(amount);
              if (price > 0 && (!currency || currency === 'JPY')) { result.price = price; break; }
            }
          }
        } catch (e) {}

        result.found = Boolean(result.title || result.author || result.coverUrl || result.pageCount || result.price);
        return result;
      })
      .catch(function () { return result; });
  }

  function fromGoogleBooks(isbn13) {
    var result = emptyRecord('Google Books');
    var url = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + encodeURIComponent(isbn13);
    return fetchWithTimeout(url)
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.items) || !data.items[0]) return result;
        var item = data.items[0];
        var info = item.volumeInfo || {};
        var links = info.imageLinks || {};
        result.title = info.title || '';
        result.author = Array.isArray(info.authors) ? cleanAuthorName(info.authors.join(' ')) : '';
        result.coverUrl = toHttps(links.thumbnail || links.smallThumbnail || '');
        result.pageCount = Number(info.pageCount) > 0 ? Math.round(Number(info.pageCount)) : 0;

        var sale = item.saleInfo && item.saleInfo.listPrice;
        if (sale && (!sale.currencyCode || sale.currencyCode === 'JPY')) {
          var amount = Number(sale.amount);
          result.price = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
        }
        result.found = Boolean(result.title || result.author || result.coverUrl || result.pageCount || result.price);
        return result;
      })
      .catch(function () { return result; });
  }

  function firstValue(records, key) {
    for (var i = 0; i < records.length; i++) {
      if (records[i] && records[i][key]) return records[i][key];
    }
    return '';
  }

  function lookupIsbn(isbn13) {
    // 問い合わせは並行し、統合時は必ず NDL → openBD → Google Books の順に採用する。
    return Promise.all([
      fromNDL(isbn13),
      fromOpenBD(isbn13),
      fromGoogleBooks(isbn13)
    ]).then(function (records) {
      var ndl = records[0];
      var openbd = records[1];
      var google = records[2];
      var priority = [ndl, openbd, google];
      var sources = priority.filter(function (record) { return record.found; }).map(function (record) {
        return record.name === 'Google Books' ? 'googleBooks' : record.name;
      });

      return {
        title: firstValue(priority, 'title'),
        author: firstValue(priority, 'author'),
        coverUrl: firstValue(priority, 'coverUrl'),
        pageCount: firstValue(priority, 'pageCount') || 0,
        price: firstValue(priority, 'price') || 0,
        isbn: isbn13,
        source: sources.join('+')
      };
    });
  }

  global.RR = global.RR || {};
  global.RR.ISBNSearch = { lookupIsbn: lookupIsbn };
})(window);
