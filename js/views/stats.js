/* ============================================================
 * views/stats.js
 * 年間集計・月別集計。情報を絞り、「今月/今年どれだけ読んだか」が
 * すぐ分かることを優先する。
 * ============================================================ */
(function (global) {
  'use strict';
  var U = global.RR.UICommon;
  var S = global.RR.Stats;

  var selectedYear = null;

  function onEnter() {
    if (selectedYear === null) selectedYear = new Date().getFullYear();
  }

  var MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  function render(data) {
    if (selectedYear === null) selectedYear = new Date().getFullYear();
    var counted = global.RR.Books.countedBooks(data);
    var years = S.availableYears(counted);
    var annual = S.annualCount(counted, selectedYear);
    var target = data.settings.annualTarget;
    var rate = target > 0 ? Math.min(100, Math.round((annual / target) * 100)) : 0;
    var monthly = S.monthlyCounts(counted, selectedYear);
    var maxMonthly = Math.max(1, Math.max.apply(null, monthly));
    var idx = years.indexOf(selectedYear);
    var hasPrev = idx < years.length - 1;
    var hasNext = idx > 0;

    return (
      '<section class="rr-view rr-stats">' +
        '<div class="rr-year-switch">' +
          '<button type="button" class="rr-icon-btn" data-action="year-prev" ' + (hasPrev ? '' : 'disabled') + '>◀</button>' +
          '<span class="rr-year-switch__label">' + selectedYear + '年</span>' +
          '<button type="button" class="rr-icon-btn" data-action="year-next" ' + (hasNext ? '' : 'disabled') + '>▶</button>' +
        '</div>' +

        '<div class="rr-card">' +
          '<p class="rr-card__label">年間集計</p>' +
          '<p class="rr-hero-number">' + annual + '<span>冊</span></p>' +
          '<p class="rr-stats-sub">年間目標 ' + target + '冊・達成率 ' + rate + '%</p>' +
          U.progressBarHtml(annual, target) +
        '</div>' +

        '<div class="rr-card">' +
          '<p class="rr-card__label">月別集計</p>' +
          '<div class="rr-bar-chart">' +
            monthly.map(function (count, i) {
              var h = Math.round((count / maxMonthly) * 100);
              return (
                '<div class="rr-bar-chart__col">' +
                  '<div class="rr-bar-chart__value">' + (count > 0 ? count : '') + '</div>' +
                  '<div class="rr-bar-chart__bar" style="height:' + Math.max(4, h) + '%"></div>' +
                  '<div class="rr-bar-chart__label">' + MONTH_LABELS[i] + '</div>' +
                '</div>'
              );
            }).join('') +
          '</div>' +
        '</div>' +
      '</section>'
    );
  }

  function bind(container, data, ctx) {
    var prev = container.querySelector('[data-action="year-prev"]');
    var next = container.querySelector('[data-action="year-next"]');
    var counted = global.RR.Books.countedBooks(data);
    var years = S.availableYears(counted);

    if (prev) prev.addEventListener('click', function () {
      var idx = years.indexOf(selectedYear);
      if (idx < years.length - 1) { selectedYear = years[idx + 1]; ctx.rerenderCurrentView(); }
    });
    if (next) next.addEventListener('click', function () {
      var idx = years.indexOf(selectedYear);
      if (idx > 0) { selectedYear = years[idx - 1]; ctx.rerenderCurrentView(); }
    });
  }

  global.RR = global.RR || {};
  global.RR.Views = global.RR.Views || {};
  global.RR.Views.stats = { render: render, bind: bind, onEnter: onEnter };
})(window);
