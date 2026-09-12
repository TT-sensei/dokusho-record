/* ============================================================
 * books.js
 * 本棚データ(books配列)のCRUD、お気に入り、検索・絞り込み、
 * ISBN関連のユーティリティを担当する。
 *
 * 同じ本を何度も登録すること(再読など)を妨げない設計とする
 * (「本棚に並んでいく」というコンセプト上、重複エラーは出さない)。
 * ============================================================ */
(function (global) {
  'use strict';

  function normalizeIsbn(isbn) {
    if (!isbn) return '';
    return String(isbn).replace(/[^0-9Xx]/g, '').toUpperCase();
  }

  function isbn10to13(isbn10raw) {
    var isbn10 = normalizeIsbn(isbn10raw);
    if (isbn10.length !== 10) return isbn10raw;
    var core = '978' + isbn10.substring(0, 9);
    var sum = 0;
    for (var i = 0; i < 12; i++) {
      var d = Number(core[i]);
      sum += (i % 2 === 0) ? d : d * 3;
    }
    var check = (10 - (sum % 10)) % 10;
    return core + String(check);
  }

  function isValidIsbn13(isbnRaw) {
    var isbn = normalizeIsbn(isbnRaw);
    if (!/^\d{13}$/.test(isbn)) return false;
    var sum = 0;
    for (var i = 0; i < 12; i++) {
      sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
    }
    var check = (10 - (sum % 10)) % 10;
    return check === Number(isbn[12]);
  }

  function toCanonicalIsbn(isbnRaw) {
    var isbn = normalizeIsbn(isbnRaw);
    if (!isbn) return '';
    if (isbn.length === 10) return isbn10to13(isbn);
    return isbn;
  }

  /**
   * 本を1冊登録する。
   * @param {object} data ストレージ全体のデータ
   * @param {object} input 登録内容
   * @returns {object} 追加された本のレコード
   */
  function addBook(data, input) {
    var S = global.RR.Stats;
    var book = {
      id: global.RR.Storage.generateId(input.isbn),
      isbn: toCanonicalIsbn(input.isbn || ''),
      title: (input.title || '').trim(),
      author: (input.author || '').trim(),
      pageCount: parseInt(input.pageCount, 10) || 0,
      price: parseInt(input.price, 10) || 0,
      coverSource: input.coverSource || 'none',
      coverUrl: input.coverUrl || '',
      coverImageId: input.coverImageId || '',
      registeredDate: S.todayStr(),
      readDate: input.readDate && S.parseDateStr(input.readDate) ? input.readDate : S.todayStr(),
      memo: (input.memo || '').trim(),
      isFavorite: !!input.isFavorite,
      entryMethod: input.entryMethod || 'manual',
      createdAt: new Date().toISOString()
    };
    data.books.unshift(book);
    global.RR.Storage.save(data);
    return book;
  }

  function updateBook(data, id, changes) {
    var book = data.books.find(function (b) { return b.id === id; });
    if (!book) return null;
    Object.keys(changes).forEach(function (key) {
      if (key === 'id' || key === 'createdAt') return;
      book[key] = changes[key];
    });
    global.RR.Storage.save(data);
    return book;
  }

  function toggleFavorite(data, id) {
    var book = data.books.find(function (b) { return b.id === id; });
    if (!book) return null;
    book.isFavorite = !book.isFavorite;
    global.RR.Storage.save(data);
    return book;
  }

  function deleteBook(data, id) {
    var book = data.books.find(function (b) { return b.id === id; });
    data.books = data.books.filter(function (b) { return b.id !== id; });
    global.RR.Storage.save(data);
    return book || null;
  }

  /** filter: 'all' | 'favorite' | 'thisMonth' | 'thisYear' */
  function filterBooks(books, filter) {
    if (filter === 'favorite') return books.filter(function (b) { return b.isFavorite; });
    if (filter === 'thisMonth' || filter === 'thisYear') {
      var now = new Date();
      var S = global.RR.Stats;
      return books.filter(function (b) {
        var d = S.parseDateStr(b.readDate);
        if (!d) return false;
        if (filter === 'thisYear') return d.getFullYear() === now.getFullYear();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      });
    }
    return books;
  }

  function searchBooks(books, keyword) {
    if (!keyword) return books;
    var k = keyword.trim().toLowerCase();
    if (!k) return books;
    return books.filter(function (b) {
      return (b.title || '').toLowerCase().indexOf(k) !== -1 ||
        (b.author || '').toLowerCase().indexOf(k) !== -1 ||
        (b.isbn || '').indexOf(k) !== -1;
    });
  }

  function sortedNewestFirst(books) {
    return books.slice().sort(function (a, b) {
      return (b.readDate || '').localeCompare(a.readDate || '') ||
        (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }

  global.RR = global.RR || {};
  global.RR.Books = {
    normalizeIsbn: normalizeIsbn,
    isbn10to13: isbn10to13,
    isValidIsbn13: isValidIsbn13,
    toCanonicalIsbn: toCanonicalIsbn,
    addBook: addBook,
    updateBook: updateBook,
    toggleFavorite: toggleFavorite,
    deleteBook: deleteBook,
    filterBooks: filterBooks,
    searchBooks: searchBooks,
    sortedNewestFirst: sortedNewestFirst
  };
})(window);
