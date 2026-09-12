/* ============================================================
 * views/badges.js
 * 読書冊数バッジと行動アチーブメントを表示する。
 * ============================================================ */
(function (global) {
  'use strict';
  var U = global.RR.UICommon;
  var Badges = global.RR.Badges;

  function render(data) {
    var c = Badges.counts(data);
    var milestones = Badges.MILESTONES;
    var earned = Badges.earnedMilestones(data);
    var achievementList = Badges.ACHIEVEMENTS;
    var earnedAchievements = Badges.earnedAchievements(data);
    var earnedIds = {};
    earnedAchievements.forEach(function (item) { earnedIds[item.id] = true; });
    var next = Badges.nextTarget(c.totalBooks);
    var monthlyTarget = Number((data.settings || {}).monthlyTarget || 0);
    var monthlyRemain = monthlyTarget > 0 ? Math.max(0, monthlyTarget - c.monthlyBooks) : 0;

    return '<section class="rr-view rr-badges">' +
      '<div class="rr-badges__head">' +
        '<div><h2>バッジ</h2><p>読んだ本や、読書の記録を続けることでバッジが増えていくよ。</p></div>' +
      '</div>' +
      '<section class="rr-badge-section">' +
        '<div class="rr-badge-section__head"><h3>読書の記録</h3><p>' + c.totalBooks + '冊 ・ 次のバッジまで' + (c.totalBooks >= 100 ? '達成！' : (next.count - c.totalBooks) + '冊') + '</p></div>' +
        '<div class="rr-badge-milestones">' + milestones.map(function (badge) {
          var isEarned = c.totalBooks >= badge.count;
          return '<article class="rr-badge-tile ' + (isEarned ? 'is-earned' : 'is-locked') + '">' +
            '<img src="' + badge.image + '" alt="" loading="lazy">' +
            '<strong>' + badge.count + '冊</strong>' +
            '<span>' + U.escapeHtml(badge.name) + '</span>' +
          '</article>';
        }).join('') + '</div>' +
      '</section>' +
      '<section class="rr-badge-section">' +
        '<div class="rr-badge-section__head"><h3>読書を続ける</h3><p>' + (monthlyTarget > 0 ? '今月 ' + c.monthlyBooks + '冊 ・ 月目標まであと' + monthlyRemain + '冊' : '目標を設定すると、達成バッジも集められるよ。') + '</p></div>' +
        '<div class="rr-badge-achievements">' + achievementList.map(function (item) {
          var isEarned = !!earnedIds[item.id];
          var image = 'https://tt-sensei.github.io/edu-assets/assets/web/badges/common/' + item.image + '/badge.webp';
          return '<article class="rr-badge-achievement ' + (isEarned ? 'is-earned' : 'is-locked') + '">' +
            '<img src="' + image + '" alt="" loading="lazy">' +
            '<div><h4>' + U.escapeHtml(item.name) + '</h4><p>' + U.escapeHtml(item.description) + '</p></div>' +
          '</article>';
        }).join('') + '</div>' +
      '</section>' +
    '</section>';
  }

  function bind() {}

  global.RR = global.RR || {};
  global.RR.Views = global.RR.Views || {};
  global.RR.Views.badges = { render: render, bind: bind };
})(window);
