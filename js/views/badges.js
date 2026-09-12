/* ============================================================
 * views/badges.js
 * 5冊ごとに増えていく「合計」と「今月」の読書バッジを表示する。
 * ============================================================ */
(function (global) {
  'use strict';
  var U = global.RR.UICommon;
  var Badges = global.RR.Badges;

  function render(data) {
    var c = Badges.counts(data);
    var nextTotal = (Math.floor(c.totalBooks / Badges.STEP) + 1) * Badges.STEP;
    var nextMonthly = (Math.floor(c.monthlyBooks / Badges.STEP) + 1) * Badges.STEP;

    return (
      '<section class="rr-view rr-badges">' +
        '<div class="rr-badges__head">' +
          '<div><h2>バッジ</h2><p>5冊読むごとに、同じバッジが1つ増えていくよ。</p></div>' +
        '</div>' +
        '<div class="rr-badge-grid">' +
          renderCard(Badges.DEFINITIONS[0], c.total, c.totalBooks, nextTotal) +
          renderCard(Badges.DEFINITIONS[1], c.monthly, c.monthlyBooks, nextMonthly) +
        '</div>' +
      '</section>'
    );
  }

  function renderCard(def, copies, books, next) {
    var copyLabel = copies > 0 ? '×' + copies : 'まだ獲得していないよ';
    var progress = books % Badges.STEP;
    var remain = Badges.STEP - progress;
    if (copies > 0 && progress === 0) remain = Badges.STEP;

    return '<article class="rr-badge-card' + (copies > 0 ? ' is-earned' : ' is-locked') + '">' +
      '<div class="rr-badge-medal" aria-hidden="true">🏅</div>' +
      '<div class="rr-badge-card__body">' +
        '<h3>' + U.escapeHtml(def.name) + '</h3>' +
        '<p class="rr-badge-card__copies">' + copyLabel + '</p>' +
        '<p class="rr-badge-card__description">' + U.escapeHtml(def.description) + '</p>' +
        '<p class="rr-badge-card__progress">' + books + '冊 ・ 次まであと' + remain + '冊</p>' +
      '</div>' +
    '</article>';
  }

  function bind() {}

  global.RR = global.RR || {};
  global.RR.Views = global.RR.Views || {};
  global.RR.Views.badges = { render: render, bind: bind };
})(window);
