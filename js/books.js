/* ============================================================
 * books.js
 * 本の登録・削除、重複判定、タイトル正規化、ISBN変換を担当する。
 * 状態(data)は呼び出し側(app.js)が保持し、この中では副作用として
 * data オブジェクトを直接書き換えて返す(参照透過ではない点に注意)。
 * ============================================================ */
(function (global) {
  'use strict';

  var Stats = null; // 遅延取得(script読み込み順の都合)

  function getStats() {
    if (!Stats) Stats = global.RR.Stats;
    return Stats;
  }

  /**
   * タイトルを比較用に正規化する。
   * - 前後の空白を除去
   * - Unicode正規化(NFKC)で全角/半角の表記ゆれを吸収
   * - 内部の空白をすべて除去(「銀河 鉄道の夜」と「銀河鉄道の夜」を同一視)
   * - 大文字/小文字を統一
   */
  function normalizeTitle(title) {
    if (!title) return '';
    var s = String(title);
    if (typeof s.normalize === 'function') {
      s = s.normalize('NFKC');
    }
    return s.trim().replace(/\s+/g, '').toLowerCase();
  }

  function normalizeIsbn(isbn) {
    if (!isbn) return '';
    return String(isbn).replace(/[^0-9Xx]/g, '').toUpperCase();
  }

  /** ISBN-10 を ISBN-13 に変換する。変換できない場合はそのまま返す。 */
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

  /** 与えられた文字列がISBN-13の形として妥当そうか(チェックディジット検証込み) */
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

  /** ISBN-10/13どちらでも受け取り、可能ならISBN-13に揃える */
  function toCanonicalIsbn(isbnRaw) {
    var isbn = normalizeIsbn(isbnRaw);
    if (!isbn) return '';
    if (isbn.length === 10) return isbn10to13(isbn);
    return isbn;
  }

  function countedBooks(data) {
    return data.books.filter(function (b) { return !b.isReread; });
  }

  /**
   * 重複本を探す。ISBNがあればISBN優先、なければ正規化したタイトルの完全一致で判定する。
   * @returns {object|null} 見つかった既存の本
   */
  function findDuplicate(data, candidate) {
    var isbn = toCanonicalIsbn(candidate.isbn);
    if (isbn) {
      var byIsbn = data.books.find(function (b) { return b.isbn && toCanonicalIsbn(b.isbn) === isbn; });
      if (byIsbn) return byIsbn;
    }
    var normTitle = normalizeTitle(candidate.title);
    if (normTitle) {
      var byTitle = data.books.find(function (b) { return normalizeTitle(b.title) === normTitle; });
      if (byTitle) return byTitle;
    }
    return null;
  }

  function recomputeDerivedState(data) {
    var S = getStats();
    var allDates = data.books.map(function (b) { return b.readDate; }).filter(Boolean);
    var streak = S.computeStreak(allDates);
    data.stats.currentStreak = streak.currentStreak;
    data.stats.longestStreak = streak.longestStreak;
    data.stats.lastReadDate = streak.lastReadDate;

    var earnedNow = global.RR.Badges.computeEarned(countedBooks(data).length).map(function (b) { return b.id; });
    var before = data.badges.slice();
    // 一度獲得したバッジは冊数が減っても取り消さない(union)
    var merged = Array.from(new Set(before.concat(earnedNow)));
    data.badges = merged;
    var newlyEarnedIds = global.RR.Badges.diffNew(before, merged);
    return { newlyEarnedIds: newlyEarnedIds };
  }

  /**
   * 本を1冊登録する。
   * @param {object} data ストレージ全体のデータ
   * @param {object} input {title, author, publisher, coverUrl, isbn, readDate, memo, entryMethod, forceAsReread}
   * @returns {{status:'duplicate', existing:object} | {status:'added', book:object, newlyEarnedIds:string[], goal:object}}
   */
  function addBook(data, input) {
    var S = getStats();
    var title = (input.title || '').trim();
    if (!title) {
      return { status: 'error', message: 'タイトルは必須です' };
    }
    var isbn = toCanonicalIsbn(input.isbn || '');

    if (!input.forceAsReread) {
      var dup = findDuplicate(data, { isbn: isbn, title: title });
      if (dup) {
        return { status: 'duplicate', existing: dup };
      }
    }

    var readDate = input.readDate && S.parseDateStr(input.readDate) ? input.readDate : S.todayStr();

    var book = {
      id: global.RR.Storage.generateId(isbn),
      isbn: isbn,
      title: title,
      author: (input.author || '').trim(),
      publisher: (input.publisher || '').trim(),
      coverUrl: input.coverUrl || '',
      readDate: readDate,
      memo: (input.memo || '').trim(),
      entryMethod: input.entryMethod === 'barcode' ? 'barcode' : 'manual',
      isFavorite: false,
      genre: '',
      isReread: !!input.forceAsReread,
      createdAt: new Date().toISOString()
    };

    // 年間/月間目標が「今回の登録で新たに達成されたか」を判定するため、登録前の集計を取る
    var beforeAnnual = S.annualCount(countedBooks(data), S.parseDateStr(readDate).getFullYear());
    var beforeMonthly = S.monthlyCounts(countedBooks(data), S.parseDateStr(readDate).getFullYear())[S.parseDateStr(readDate).getMonth()];

    data.books.unshift(book);

    var afterAnnual = beforeAnnual + (book.isReread ? 0 : 1);
    var afterMonthly = beforeMonthly + (book.isReread ? 0 : 1);

    var derived = recomputeDerivedState(data);
    global.RR.Storage.save(data);

    var goal = {
      annualJustReached: !book.isReread && beforeAnnual < data.settings.annualTarget && afterAnnual >= data.settings.annualTarget,
      monthlyJustReached: !book.isReread && beforeMonthly < data.settings.monthlyTarget && afterMonthly >= data.settings.monthlyTarget
    };

    return { status: 'added', book: book, newlyEarnedIds: derived.newlyEarnedIds, goal: goal };
  }

  function deleteBook(data, id) {
    data.books = data.books.filter(function (b) { return b.id !== id; });
    recomputeDerivedState(data);
    global.RR.Storage.save(data);
    return data;
  }

  global.RR = global.RR || {};
  global.RR.Books = {
    normalizeTitle: normalizeTitle,
    normalizeIsbn: normalizeIsbn,
    isbn10to13: isbn10to13,
    isValidIsbn13: isValidIsbn13,
    toCanonicalIsbn: toCanonicalIsbn,
    countedBooks: countedBooks,
    findDuplicate: findDuplicate,
    addBook: addBook,
    deleteBook: deleteBook,
    recomputeDerivedState: recomputeDerivedState
  };
})(window);
