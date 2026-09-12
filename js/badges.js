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
    { id: 'total-reading', name: '読書レコード', description: '合計5冊ごと', icon: 'total', line: '合計で5冊読むごとに1つ' },
    { id: 'monthly-reading', name: '今月の読書', description: '今月5冊ごと', icon: 'monthly', line: '今月5冊読むごとに1つ' }
  ];

  function counts(data) {
    var books = Array.isArray(data.books) ? data.books : [];
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

  function earnedTotal(data) { return counts(data).total; }
  function earnedMonthly(data) { return counts(data).monthly; }

  global.RR = global.RR || {};
  global.RR.Badges = {
    STEP: STEP,
    DEFINITIONS: DEFINITIONS,
    counts: counts,
    nextTarget: nextTarget,
    earnedTotal: earnedTotal,
    earnedMonthly: earnedMonthly
  };
})(window);
