/* ============================================================
 * badges.js
 * 5冊ごとに獲得する読書バッジを管理する。
 * バッジは「合計」と「今月」を別カウントにし、
 * 同じバッジを複数回獲得した場合は x2 / x3 ... と累積する。
 * ============================================================ */
(function (global) {
  'use strict';

  var STEP = 5;

  var DEFINITIONS = [
    { id: 'total-reading', name: '読書レコード', description: '合計5冊ごと', icon: 'total' },
    { id: 'monthly-reading', name: '今月の読書', description: '今月5冊ごと', icon: 'monthly' }
  ];

  function counts(data) {
    var books = global.RR.Books.countedBooks(data);
    var now = new Date();
    var month = global.RR.Stats.countInMonth(books, now.getFullYear(), now.getMonth());
    var total = books.length;
    return {
      total: Math.floor(total / STEP),
      monthly: Math.floor(month / STEP),
      totalBooks: total,
      monthlyBooks: month
    };
  }

  function nextTarget(count) {
    var n = Math.floor(count / STEP) + 1;
    return { count: n * STEP, name: n * STEP + '冊バッジ' };
  }

  function badgeIconUrl(icon) {
    /* バッジ画像がなくても機能するよう、まず絵文字の代替表示を使う。 */
    return './assets/badges/' + icon + '.png';
  }

  function earnedTotal(data) { return counts(data).total; }
  function earnedMonthly(data) { return counts(data).monthly; }

  global.RR = global.RR || {};
  global.RR.Badges = {
    STEP: STEP,
    DEFINITIONS: DEFINITIONS,
    counts: counts,
    nextTarget: nextTarget,
    badgeIconUrl: badgeIconUrl,
    earnedTotal: earnedTotal,
    earnedMonthly: earnedMonthly
  };
})(window);
