/* ============================================================
 * isbn-search.js
 * ISBNから書誌情報を検索する。1つのAPIに依存せず、
 * Google Books / openBD / NDLサーチ を Promise.allSettled で
 * 並行取得し、互いの欠けを補い合う。
 *
 * マージ方針:
 *   - タイトル・著者・表紙URL: 最初に見つかった値を採用
 *   - ページ数・価格: 全ソースの候補から最大値を採用
 *     (本文+あとがき等を含む値が反映されやすいため)
 *
 * どのソースが失敗してもアプリは落とさず、取得できた範囲の
 * 情報だけを返す(全滅時はtitleが空のオブジェクトを返す)。
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
    return String(s || '').replace(/[０-９]/g, function (m) { return String.fromCharCode(m.charCodeAt(0) - 0xFEE0); });
  }

  function extractCleanNum(v) {
    if (!v) return 0;
    var s = toHalfWidthDigits(v).replace(/[^0-9]/g, '');
    var n = parseInt(s, 10);
    return isNaN(n) ? 0 : n;
  }

  /** 説明文・extentなどの文字列から「ページ数らしき数値」を可能な限り拾う */
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

  /** 著者名から年号や「著/編/訳/監修」等の付随語を取り除いて整形する */
  function cleanAuthorName(s) {
    if (!s) return '';
    var c = s
      .replace(/(\d{4}\s*-\s*\d{4}|\d{4}\s*-\s*|\s*-\s*\d{4})/g, '')
      .replace(/[著編訳]|監修|ほか|イラスト/g, '')
      .replace(/[／/,，、．.\[\]()（）]/g, ' ')
      .trim();
    var parts = Array.from(new Set(c.split(/\s+/).filter(function (x) { return x.length > 0; })));
    // 他の候補に完全に含まれてしまう短い断片(表記ゆれの残骸)は除く
    return parts.filter(function (x) { return !parts.some(function (o) { return o !== x && o.indexOf(x) !== -1; }); }).join(' ').trim();
  }

  function toHttps(url) {
    return url ? url.replace(/^http:\/\//, 'https://') : url;
  }

  function fromGoogleBooks(isbn13, ctx) {
    var url = 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + encodeURIComponent(isbn13);
    return fetchWithTimeout(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
      if (!data || !Array.isArray(data.items) || !data.items[0]) return;
      var item = data.items[0];
      var info = item.volumeInfo || {};
      if (!ctx.title && info.title) ctx.title = info.title;
      if (!ctx.author && Array.isArray(info.authors)) ctx.author = cleanAuthorName(info.authors.join(' '));
      if (!ctx.coverUrl && info.imageLinks) {
        ctx.coverUrl = toHttps(info.imageLinks.thumbnail || info.imageLinks.smallThumbnail || '');
      }
      if (info.pageCount) ctx.pageCandidates.push(parseInt(info.pageCount, 10));
      if (info.description) ctx.pageCandidates = ctx.pageCandidates.concat(scanPageNumsDeeply(info.description));
      if (item.saleInfo && item.saleInfo.listPrice) {
        ctx.priceCandidates.push(extractCleanNum(item.saleInfo.listPrice.amount));
      }
    }).catch(function () { /* このソースだけ諦めて続行 */ });
  }

  function fromOpenBD(isbn13, ctx) {
    var url = 'https://api.openbd.jp/v1/get?isbn=' + encodeURIComponent(isbn13);
    return fetchWithTimeout(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
      if (!data || !data[0]) return;
      var summary = data[0].summary || {};
      var onix = data[0].onix || {};
      if (!ctx.title && summary.title) ctx.title = summary.title;
      if (!ctx.author && summary.author) ctx.author = cleanAuthorName(summary.author);
      if (!ctx.coverUrl && summary.cover) ctx.coverUrl = toHttps(summary.cover);
      if (summary.pages) ctx.pageCandidates.push(extractCleanNum(summary.pages));
      try {
        var exts = onix.DescriptiveDetail && onix.DescriptiveDetail.Extent;
        if (Array.isArray(exts)) {
          exts.forEach(function (e) {
            if (['00', '05', '06', '07', '08', '11'].indexOf(e.ExtentType) !== -1) {
              ctx.pageCandidates.push(extractCleanNum(e.ExtentValue));
            }
          });
        }
      } catch (e) { /* ONIX構造は書籍によって差があるため無視して続行 */ }
      try {
        var prices = onix.ProductSupply && onix.ProductSupply.SupplyDetail && onix.ProductSupply.SupplyDetail.Price;
        if (Array.isArray(prices)) {
          prices.forEach(function (p) { if (p.PriceAmount) ctx.priceCandidates.push(extractCleanNum(p.PriceAmount)); });
        }
      } catch (e) { /* 同上 */ }
    }).catch(function () { /* このソースだけ諦めて続行 */ });
  }

  function fromNDL(isbn13, ctx) {
    var url = 'https://ndlsearch.ndl.go.jp/api/opensearch?isbn=' + encodeURIComponent(isbn13);
    return fetchWithTimeout(url).then(function (r) { return r.text(); }).then(function (text) {
      var xml = new DOMParser().parseFromString(text, 'text/xml');
      var item = xml.querySelector('item') || xml.getElementsByTagName('item')[0];
      if (!item) return;
      function getVal(tag) {
        var el = item.getElementsByTagName(tag)[0] || item.getElementsByTagName('dc:' + tag)[0] || item.getElementsByTagName('dcterms:' + tag)[0];
        return el ? el.textContent : '';
      }
      if (!ctx.title) ctx.title = getVal('title');
      var desc = getVal('description');
      if (desc) ctx.pageCandidates = ctx.pageCandidates.concat(scanPageNumsDeeply(desc));
      var extent = getVal('extent');
      if (extent) ctx.pageCandidates = ctx.pageCandidates.concat(scanPageNumsDeeply(extent));
      var priceText = getVal('price');
      if (priceText) ctx.priceCandidates.push(extractCleanNum(priceText));
    }).catch(function () { /* NDLはCORS等の事情で失敗しうるため諦めて続行 */ });
  }

  /**
   * ISBN(13桁)から書誌情報を検索する。
   * @returns {Promise<{title:string, author:string, coverUrl:string, pageCount:number, price:number, isbn:string}>}
   */
  function lookupIsbn(isbn13) {
    var ctx = { title: '', author: '', coverUrl: '', pageCandidates: [], priceCandidates: [] };
    return Promise.allSettled([
      fromGoogleBooks(isbn13, ctx),
      fromOpenBD(isbn13, ctx),
      fromNDL(isbn13, ctx)
    ]).then(function () {
      var pages = ctx.pageCandidates.filter(function (n) { return !isNaN(n) && n > 0; }).sort(function (a, b) { return b - a; });
      var prices = ctx.priceCandidates.filter(function (n) { return !isNaN(n) && n > 0; }).sort(function (a, b) { return b - a; });
      return {
        title: ctx.title || '',
        author: ctx.author || '',
        coverUrl: ctx.coverUrl || '',
        pageCount: pages.length > 0 ? pages[0] : 0,
        price: prices.length > 0 ? prices[0] : 0,
        isbn: isbn13
      };
    });
  }

  global.RR = global.RR || {};
  global.RR.ISBNSearch = { lookupIsbn: lookupIsbn };
})(window);
