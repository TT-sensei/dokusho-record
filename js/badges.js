/* ============================================================
 * badges.js
 * 読書レコードのバッジ条件をまとめる。
 * 合計冊数は5冊ごとに100冊まで別バッジ。
 * その他は「記録する」「続ける」行動を条件にする。
 * ============================================================ */
(function (global) {
  'use strict';

  var STEP = 5;
  var MAX_MILESTONE = 100;

  var MILESTONES = [
    ['first-step', 5, 'はじめの一歩'],
    ['explorer', 10, '読書探検家'],
    ['discovery', 15, '発見の読書'],
    ['curiosity', 20, '好奇心の読書'],
    ['adventurer', 25, '読書アドベンチャー'],
    ['challenger', 30, '読書チャレンジャー'],
    ['courage', 35, '読書の勇気'],
    ['creative', 40, '想像力を広げる読書'],
    ['focus', 45, '集中して読む'],
    ['deep-thinker', 50, '深く考える読書'],
    ['connection', 55, '本とつながる'],
    ['explainer', 60, '本を伝える'],
    ['breakthrough', 65, '読書のブレイクスルー'],
    ['comeback', 70, '読書カムバック'],
    ['combo', 75, '読書コンボ'],
    ['accuracy', 80, '確かな読書'],
    ['clear', 85, '読書クリア'],
    ['explorer', 90, 'さらに広がる読書'],
    ['adventurer', 95, '読書アドベンチャー・上級'],
    ['champion', 100, '読書チャンピオン']
  ].map(function (x) {
    return { id:x[0], count:x[1], name:x[2], image:'https://tt-sensei.github.io/edu-assets/assets/web/badges/common/' + x[0] + '/badge.webp' };
  });

  var ACHIEVEMENTS = [
    { id:'first-mood', name:'感想を記録した', description:'はじめて感想を登録した', image:'first-step' },
    { id:'five-moods', name:'読書の気持ち', description:'5冊に感想を登録した', image:'curiosity' },
    { id:'ten-moods', name:'読書の記録者', description:'10冊に感想を登録した', image:'explainer' },
    { id:'first-favorite', name:'お気に入りの一冊', description:'はじめてお気に入りを登録した', image:'connection' },
    { id:'first-cover', name:'表紙を残した', description:'はじめて表紙を登録した', image:'discovery' },
    { id:'monthly-goal', name:'今月の目標達成', description:'今月の読書目標を達成した', image:'clear', repeatable:true },
    { id:'annual-goal', name:'年間目標達成', description:'年間の読書目標を達成した', image:'champion' }
  ];

  function booksOf(data) {
    return Array.isArray(data.books) ? data.books : [];
  }

  function monthCount(data) {
    var books = booksOf(data);
    var now = new Date();
    return global.RR.Stats.countInMonth(books, now.getFullYear(), now.getMonth());
  }

  function moodCount(data) {
    return booksOf(data).filter(function (book) { return !!book.mood; }).length;
  }

  function favoriteCount(data) {
    return booksOf(data).filter(function (book) { return !!book.isFavorite; }).length;
  }

  function coverCount(data) {
    return booksOf(data).filter(function (book) { return book.coverSource === 'user' && book.coverImageId; }).length;
  }

  function counts(data) {
    var books = booksOf(data);
    return {
      totalBooks: books.length,
      monthlyBooks: monthCount(data),
      total: Math.min(Math.floor(books.length / STEP), MILESTONES.length),
      monthly: Math.floor(monthCount(data) / STEP),
      mood: moodCount(data),
      favorite: favoriteCount(data),
      cover: coverCount(data)
    };
  }

  function milestoneAt(count) {
    for (var i = MILESTONES.length - 1; i >= 0; i--) {
      if (count >= MILESTONES[i].count) return MILESTONES[i];
    }
    return null;
  }

  function earnedMilestones(data) {
    var total = booksOf(data).length;
    return MILESTONES.filter(function (badge) { return total >= badge.count; });
  }

  function earnedAchievements(data) {
    var c = counts(data);
    var settings = data.settings || {};
    var result = [];
    if (c.mood >= 1) result.push(ACHIEVEMENTS[0]);
    if (c.mood >= 5) result.push(ACHIEVEMENTS[1]);
    if (c.mood >= 10) result.push(ACHIEVEMENTS[2]);
    if (c.favorite >= 1) result.push(ACHIEVEMENTS[3]);
    if (c.cover >= 1) result.push(ACHIEVEMENTS[4]);
    if (settings.monthlyTarget && c.monthlyBooks >= Number(settings.monthlyTarget)) result.push(ACHIEVEMENTS[5]);
    if (settings.annualTarget && c.totalBooks >= Number(settings.annualTarget)) result.push(ACHIEVEMENTS[6]);
    return result;
  }

  function nextTarget(totalBooks) {
    if (totalBooks >= MAX_MILESTONE) return { count: MAX_MILESTONE, name: '100冊達成' };
    var n = Math.floor(totalBooks / STEP) + 1;
    return { count:n * STEP, name:n * STEP + '冊バッジ' };
  }

  function earnedTotal(data) { return earnedMilestones(data).length; }
  function earnedMonthly(data) { return Math.floor(monthCount(data) / STEP); }

  global.RR = global.RR || {};
  global.RR.Badges = {
    STEP: STEP,
    MAX_MILESTONE: MAX_MILESTONE,
    MILESTONES: MILESTONES,
    ACHIEVEMENTS: ACHIEVEMENTS,
    counts: counts,
    nextTarget: nextTarget,
    milestoneAt: milestoneAt,
    earnedMilestones: earnedMilestones,
    earnedAchievements: earnedAchievements,
    earnedTotal: earnedTotal,
    earnedMonthly: earnedMonthly
  };
})(window);
