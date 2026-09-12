/* ============================================================
 * stats.js
 * 日付ユーティリティと、月間/年間の冊数集計(控えめな表示用)。
 * ============================================================ */
(function (global) {
  'use strict';

  function pad2(n) { return String(n).padStart(2, '0'); }

  function toDateStr(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayStr() { return toDateStr(new Date()); }

  function parseDateStr(s) {
    if (!s || typeof s !== 'string') return null;
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDateJp(s) {
    var d = parseDateStr(s);
    if (!d) return '';
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function countInMonth(books, year, month) {
    return books.reduce(function (sum, b) {
      var d = parseDateStr(b.readDate);
      return (d && d.getFullYear() === year && d.getMonth() === month) ? sum + 1 : sum;
    }, 0);
  }

  function countInYear(books, year) {
    return books.reduce(function (sum, b) {
      var d = parseDateStr(b.readDate);
      return (d && d.getFullYear() === year) ? sum + 1 : sum;
    }, 0);
  }

  global.RR = global.RR || {};
  global.RR.Stats = {
    todayStr: todayStr,
    toDateStr: toDateStr,
    parseDateStr: parseDateStr,
    formatDateJp: formatDateJp,
    countInMonth: countInMonth,
    countInYear: countInYear
  };
})(window);
