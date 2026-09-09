/* ============================================================
 * stats.js
 * 日付の扱い、連続読書日数、年間/月間の集計を計算する。
 * ============================================================ */
(function (global) {
  'use strict';

  function pad2(n) { return String(n).padStart(2, '0'); }

  /** ローカルタイムでの YYYY-MM-DD を返す(タイムゾーンずれ防止のためUTC変換を使わない) */
  function toDateStr(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayStr() {
    return toDateStr(new Date());
  }

  /** "YYYY-MM-DD" を安全にDate(ローカル深夜0時)へ変換する */
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

  function formatDateShort(s) {
    var d = parseDateStr(s);
    if (!d) return '';
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function diffInDays(a, b) {
    var MS = 24 * 60 * 60 * 1000;
    var da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    var db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((db - da) / MS);
  }

  /**
   * 読書した日付の配列(重複・順不同可)から、連続読書日数を計算する。
   * 同じ日に複数冊読んでも1日として扱う。
   * @param {string[]} dateStrings
   * @returns {{currentStreak:number, longestStreak:number, lastReadDate:string|null}}
   */
  function computeStreak(dateStrings) {
    var uniqueDates = Array.from(new Set((dateStrings || []).filter(Boolean)));
    if (uniqueDates.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastReadDate: null };
    }
    var dates = uniqueDates
      .map(parseDateStr)
      .filter(Boolean)
      .sort(function (a, b) { return a - b; });

    if (dates.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastReadDate: null };
    }

    var longest = 1;
    var run = 1;
    for (var i = 1; i < dates.length; i++) {
      var gap = diffInDays(dates[i - 1], dates[i]);
      if (gap === 0) {
        continue; // 念のため(重複除去済みだが保険)
      } else if (gap === 1) {
        run += 1;
      } else {
        run = 1;
      }
      if (run > longest) longest = run;
    }

    var lastDate = dates[dates.length - 1];
    var today = new Date();
    var gapFromToday = diffInDays(lastDate, today);

    // 最後に読んだ日が今日 or 昨日なら、現在も連続記録が生きているとみなす
    var currentStreak = 0;
    if (gapFromToday <= 1) {
      // 直近の連続ランの長さを数え直す
      currentStreak = 1;
      for (var j = dates.length - 1; j > 0; j--) {
        var g = diffInDays(dates[j - 1], dates[j]);
        if (g === 1) {
          currentStreak += 1;
        } else {
          break;
        }
      }
    }

    return {
      currentStreak: currentStreak,
      longestStreak: Math.max(longest, currentStreak),
      lastReadDate: toDateStr(lastDate)
    };
  }

  /** 指定年の月別冊数(1〜12月の配列)を計算する。再読は含めない。 */
  function monthlyCounts(countedBooks, year) {
    var counts = new Array(12).fill(0);
    countedBooks.forEach(function (b) {
      var d = parseDateStr(b.readDate);
      if (d && d.getFullYear() === year) {
        counts[d.getMonth()] += 1;
      }
    });
    return counts;
  }

  /** 指定年の年間冊数を計算する。再読は含めない。 */
  function annualCount(countedBooks, year) {
    return countedBooks.reduce(function (sum, b) {
      var d = parseDateStr(b.readDate);
      return (d && d.getFullYear() === year) ? sum + 1 : sum;
    }, 0);
  }

  /** データ中に登場する年の一覧(降順、当年は必ず含む)を返す */
  function availableYears(countedBooks) {
    var years = new Set([new Date().getFullYear()]);
    countedBooks.forEach(function (b) {
      var d = parseDateStr(b.readDate);
      if (d) years.add(d.getFullYear());
    });
    return Array.from(years).sort(function (a, b) { return b - a; });
  }

  global.RR = global.RR || {};
  global.RR.Stats = {
    todayStr: todayStr,
    toDateStr: toDateStr,
    parseDateStr: parseDateStr,
    formatDateJp: formatDateJp,
    formatDateShort: formatDateShort,
    computeStreak: computeStreak,
    monthlyCounts: monthlyCounts,
    annualCount: annualCount,
    availableYears: availableYears
  };
})(window);
