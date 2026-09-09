/* ============================================================
 * views/home.js
 * ホーム画面。「今どれくらい読んでいるか」を一目で見せる。
 * ============================================================ */
(function (global) {
  'use strict';
  var U = global.RR.UICommon;
  var S = global.RR.Stats;

  function render(data) {
    var year = new Date().getFullYear();
    var month = new Date().getMonth();
    var counted = global.RR.Books.countedBooks(data);
    var annual = S.annualCount(counted, year);
    var monthly = S.monthlyCounts(counted, year)[month];
    var annualTarget = data.settings.annualTarget;
    var monthlyTarget = data.settings.monthlyTarget;
    var remain = Math.max(0, annualTarget - annual);
    var achieved = annual >= annualTarget;

    return (
      '<section class="rr-view rr-home">' +
        '<div class="rr-card rr-card--hero">' +
          '<p class="rr-card__label">今年の読書</p>' +
          '<p class="rr-hero-number">' + annual + ' <span>/ ' + annualTarget + '冊</span></p>' +
          U.progressBarHtml(annual, annualTarget) +
          '<p class="rr-hero-sub">' + (achieved ? '🎉 目標達成おめでとう!' : 'あと' + remain + '冊!') + '</p>' +
        '</div>' +

        '<div class="rr-card rr-card--month">' +
          '<p class="rr-card__label">' + (month + 1) + '月</p>' +
          '<p class="rr-month-number">' + monthly + '冊 <span>/ 目標' + monthlyTarget + '冊</span></p>' +
          U.progressBarHtml(monthly, monthlyTarget, { className: 'rr-progress--sm' }) +
        '</div>' +

        '<div class="rr-stat-row">' +
          '<div class="rr-stat-chip">' +
            '<span class="rr-stat-chip__icon" aria-hidden="true">🔥</span>' +
            '<span class="rr-stat-chip__label">連続読書</span>' +
            '<span class="rr-stat-chip__value">' + data.stats.currentStreak + '日</span>' +
          '</div>' +
          '<div class="rr-stat-chip">' +
            '<span class="rr-stat-chip__icon" aria-hidden="true">🏅</span>' +
            '<span class="rr-stat-chip__label">獲得バッジ</span>' +
            '<span class="rr-stat-chip__value">' + data.badges.length + '個</span>' +
          '</div>' +
        '</div>' +

        '<button type="button" class="rr-btn rr-btn--cta" data-action="go-add">📖 本を登録する</button>' +
      '</section>'
    );
  }

  function bind(container, data, ctx) {
    var btn = container.querySelector('[data-action="go-add"]');
    if (btn) btn.addEventListener('click', function () { ctx.navigate('add'); });
  }

  global.RR = global.RR || {};
  global.RR.Views = global.RR.Views || {};
  global.RR.Views.home = { render: render, bind: bind };
})(window);
