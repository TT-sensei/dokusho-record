/* ============================================================
 * views/badges.js
 * 冊数バッジの一覧。獲得済みはカラー表示、未獲得はロック表示にする。
 * ============================================================ */
(function (global) {
  'use strict';
  var U = global.RR.UICommon;
  var Badges = global.RR.Badges;

  function render(data) {
    var earnedSet = new Set(data.badges);
    var countedCount = global.RR.Books.countedBooks(data).length;
    var next = Badges.nextTarget(countedCount);

    return (
      '<section class="rr-view rr-badges">' +
        (next
          ? '<p class="rr-badges-next">次は「' + U.escapeHtml(next.name) + '」まであと' + (next.count - countedCount) + '冊!</p>'
          : '<p class="rr-badges-next">🏆 すべてのバッジを獲得したよ!</p>'
        ) +
        '<div class="rr-badge-grid">' +
          Badges.DEFINITIONS.map(function (def) {
            var earned = earnedSet.has(def.id);
            return (
              '<div class="rr-badge-card' + (earned ? ' is-earned' : ' is-locked') + '">' +
                '<div class="rr-badge-card__icon">' +
                  '<img src="' + Badges.badgeIconUrl(def.icon) + '" alt="" ' +
                    'onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{textContent:\'🏅\',className:\'rr-badge-card__fallback\'}));">' +
                '</div>' +
                '<p class="rr-badge-card__name">' + U.escapeHtml(def.name) + '</p>' +
                '<p class="rr-badge-card__req">' + (earned ? '獲得済み' : def.count + '冊で解放') + '</p>' +
              '</div>'
            );
          }).join('') +
        '</div>' +
      '</section>'
    );
  }

  function bind() { /* このビューは操作を持たない */ }

  global.RR = global.RR || {};
  global.RR.Views = global.RR.Views || {};
  global.RR.Views.badges = { render: render, bind: bind };
})(window);
