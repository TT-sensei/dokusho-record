/* ============================================================
 * navi.js
 * navi-character- のキャラクター素材を使った吹き出し表示。
 * 画像URL・キャラクターIDはすべてこのファイルの1箇所にまとめる
 * (navi-character- の AI-GUIDE.md の指示に従う)。
 *
 * 重要: これは任意の演出機能。画像が読み込めない・オフラインなどの
 * 理由で失敗しても、アプリ本体の動作(登録・記録・集計など)は
 * 一切妨げない。失敗時は吹き出しごと非表示にする。
 * ============================================================ */
(function (global) {
  'use strict';

  var NAVI_WEB_BASE = 'https://tt-sensei.github.io/navi-character-/assets/web/characters';

  function characterUrl(id, pose) {
    return NAVI_WEB_BASE + '/' + id + '/fullbody/' + pose + '.webp';
  }

  // 役割ごとのキャラクター割り当て(navi-character- AI-GUIDE.md の役割表に準拠)
  var SCENES = {
    register: { id: 'sora', pose: 'waving', name: 'そら', line: '📚 読書記録を追加したよ!' },
    duplicate: { id: 'nami', pose: 'retry', name: 'なみ', line: 'この本、前にも読んでいるよ!\n次はまだ読んでいない本にも挑戦してみよう!' },
    reread: { id: 'nami', pose: 'complete', name: 'なみ', line: 'もう一度読んだね。お気に入りの本かな?' },
    goalAnnual: { id: 'tsuki', pose: 'correct', name: 'つき', line: '🎉 年間目標クリア!すごい!' },
    goalMonthly: { id: 'tsuki', pose: 'correct', name: 'つき', line: '🎉 今月の目標クリア!' },
    badge: { id: 'saku', pose: 'complete', name: 'さく', line: '新しいバッジをゲットしたよ!' },
    notFound: { id: 'kai', pose: 'hint', name: 'かい', line: '本の情報を見つけられなかったよ。\n手入力で登録してみよう。' },
    scanHint: { id: 'kai', pose: 'hint', name: 'かい', line: 'ISBNのバーコードをカメラに映してね。' }
  };

  /**
   * 吹き出し用のHTML断片を返す。画像はonerrorで非表示になるので
   * 呼び出し側は常にこの関数を安全に使ってよい。
   */
  function bubbleHtml(sceneKey, overrideLine) {
    var scene = SCENES[sceneKey];
    if (!scene) return '';
    var line = overrideLine || scene.line;
    var lineHtml = String(line).split('\n').map(escapeHtml).join('<br>');
    var imgUrl = characterUrl(scene.id, scene.pose);
    return (
      '<div class="navi-bubble">' +
        '<img class="navi-bubble__img" src="' + imgUrl + '" alt="" ' +
          'onerror="this.closest(\'.navi-bubble\').classList.add(\'navi-bubble--no-image\');this.remove();">' +
        '<div class="navi-bubble__text">' + lineHtml + '</div>' +
      '</div>'
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  global.RR = global.RR || {};
  global.RR.Navi = {
    SCENES: SCENES,
    characterUrl: characterUrl,
    bubbleHtml: bubbleHtml
  };
})(window);
