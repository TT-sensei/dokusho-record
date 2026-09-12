/* ============================================================
 * navi.js
 * 読書レコード共通ナビキャラクター。
 * 基本表示は navi-character- の6人からランダムに1人、
 * 07-encouraging ポーズを使う。
 * ============================================================ */
(function (global) {
  'use strict';

  var NAVI_WEB_BASE = 'https://tt-sensei.github.io/navi-character-/assets/web/characters';
  var CHARACTERS = ['riku', 'sora', 'kai', 'saku', 'tsuki', 'nami'];
  var DEFAULT_POSE = '07-encouraging';

  var ENCOURAGEMENTS = [
    '今日はどんな本を読もう？',
    '1ページからでも、読書は始められるよ。',
    '気になる本を、1冊のぞいてみよう。',
    '読んだ本が増えると、自分の世界も広がるよ。',
    '「読んでみたい！」を大切にしよう。',
    '少しずつで大丈夫。今日も1ページ！',
    '次に読む本、もう決まってる？',
    '本を開くと、まだ知らない世界に出会えるよ。'
  ];

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function characterUrl(id, pose) {
    return NAVI_WEB_BASE + '/' + id + '/expressions/' + (pose || DEFAULT_POSE) + '.webp';
  }

  function randomCharacter() { return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]; }
  function randomEncouragement() { return ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]; }

  function characterHtml(options) {
    options = options || {};
    var id = options.id || randomCharacter();
    var pose = options.pose || DEFAULT_POSE;
    return '<img src="' + characterUrl(id, pose) + '" class="navi-character" alt="" onerror="this.remove();">';
  }

  function bubbleHtml(line, options) {
    options = options || {};
    var id = options.id || randomCharacter();
    var pose = options.pose || DEFAULT_POSE;
    return '<div class="navi-bubble" role="note">' + characterHtml({ id: id, pose: pose }) + '<div class="navi-bubble__text">' + escapeHtml(line || '') + '</div></div>';
  }

  function shelfHtml() {
    return bubbleHtml(randomEncouragement(), { id: randomCharacter() });
  }

  function registeredHtml(title) {
    var safeTitle = escapeHtml(title || 'この本');
    return '<div class="navi-register-bubble">' +
      characterHtml({ id: randomCharacter() }) +
      '<div class="navi-register-bubble__text">「' + safeTitle + '」を本棚に追加したよ！<br>いいね。次はどんな本を読もう？</div>' +
    '</div>';
  }

  global.RR = global.RR || {};
  global.RR.Navi = {
    CHARACTERS: CHARACTERS,
    DEFAULT_POSE: DEFAULT_POSE,
    characterUrl: characterUrl,
    randomCharacter: randomCharacter,
    randomEncouragement: randomEncouragement,
    characterHtml: characterHtml,
    bubbleHtml: bubbleHtml,
    shelfHtml: shelfHtml,
    registeredHtml: registeredHtml
  };
})(window);
