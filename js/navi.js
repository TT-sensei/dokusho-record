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

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function characterUrl(id, pose) {
    return NAVI_WEB_BASE + '/' + id + '/expressions/' + (pose || DEFAULT_POSE) + '.webp';
  }

  function randomCharacter() {
    return CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
  }

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
    return '<div class="navi-bubble">' + characterHtml({ id: id, pose: pose }) +
      '<div class="navi-bubble__text">' + escapeHtml(line || '') + '</div></div>';
  }

  global.RR = global.RR || {};
  global.RR.Navi = {
    CHARACTERS: CHARACTERS,
    DEFAULT_POSE: DEFAULT_POSE,
    characterUrl: characterUrl,
    randomCharacter: randomCharacter,
    characterHtml: characterHtml,
    bubbleHtml: bubbleHtml
  };
})(window);
