/* ============================================================
 * badges.js
 * 冊数バッジの定義と獲得判定。
 * アイコンは edu-assets の共有バッジ素材(軽量WebP)を使用し、
 * 読み込みに失敗してもUIが壊れないようにする(ui.js側でonerror処理)。
 * ============================================================ */
(function (global) {
  'use strict';

  var EDU_ASSETS_BADGE_BASE = 'https://tt-sensei.github.io/edu-assets/assets/web/badges/common';

  function badgeIconUrl(iconName) {
    return EDU_ASSETS_BADGE_BASE + '/' + iconName + '/badge.webp';
  }

  // count: 通常冊数(再読を除く)がこの数に達すると獲得
  var DEFINITIONS = [
    { id: 'step1', count: 1, name: 'はじめの一歩', icon: 'first-step' },
    { id: 'beginner', count: 5, name: '読書ビギナー', icon: 'growth' },
    { id: 'challenger', count: 10, name: '読書チャレンジャー', icon: 'challenger' },
    { id: 'master', count: 20, name: '読書マスター', icon: 'mastery' },
    { id: 'hunter', count: 30, name: '読書ハンター', icon: 'explorer' },
    { id: 'clear50', count: 50, name: '50冊達成!', icon: 'clear' },
    { id: 'legend', count: 100, name: '読書レジェンド', icon: 'champion' }
  ];

  function byId(id) {
    return DEFINITIONS.find(function (d) { return d.id === id; }) || null;
  }

  /** 現在の冊数から「本来獲得できているはずの」バッジ定義一覧を返す */
  function computeEarned(countedBookCount) {
    return DEFINITIONS.filter(function (d) { return countedBookCount >= d.count; });
  }

  /** oldIds になく newIds にある id(=新規獲得分)を返す */
  function diffNew(oldIds, newIds) {
    var oldSet = new Set(oldIds || []);
    return (newIds || []).filter(function (id) { return !oldSet.has(id); });
  }

  /** 次に狙うべきバッジ(未獲得のうち最も冊数が近いもの) */
  function nextTarget(countedBookCount) {
    var remaining = DEFINITIONS.filter(function (d) { return countedBookCount < d.count; });
    if (remaining.length === 0) return null;
    remaining.sort(function (a, b) { return a.count - b.count; });
    return remaining[0];
  }

  global.RR = global.RR || {};
  global.RR.Badges = {
    DEFINITIONS: DEFINITIONS,
    badgeIconUrl: badgeIconUrl,
    byId: byId,
    computeEarned: computeEarned,
    diffNew: diffNew,
    nextTarget: nextTarget
  };
})(window);
