/* ============================================================
 * camera.js
 * 「表紙を撮る」「写真から選ぶ」のための画像ファイル取得だけを担当する。
 * ISBNバーコードスキャン(barcode.js)とは目的・実装が異なるため、
 * 意図的にファイルを分けている。
 *
 * 実装は <input type="file" accept="image/*"> を使う方式を採用。
 * capture="environment" を付けると多くのモバイル/タブレット端末で
 * その場でカメラが起動し、外すと端末内の写真から選べる。
 * ============================================================ */
(function (global) {
  'use strict';

  /**
   * @param {boolean} useCamera true: 表紙を撮る(capture=environment) / false: 写真から選ぶ
   * @returns {Promise<File|null>} キャンセル時はnullでresolveする
   */
  function pickImage(useCamera) {
    return new Promise(function (resolve) {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (useCamera) input.setAttribute('capture', 'environment');
      input.style.display = 'none';

      var settled = false;
      function finish(file) {
        if (settled) return;
        settled = true;
        input.remove();
        resolve(file || null);
      }

      input.addEventListener('change', function () {
        var file = input.files && input.files[0] ? input.files[0] : null;
        finish(file);
      });

      // キャンセル検知用(対応ブラウザのみ): フォーカスが戻ってきてもchangeが
      // 発火しない=キャンセルされた可能性が高いが、確実ではないため
      // 呼び出し側は「まだ選ばれていない」状態のUIを保てるようにしておく。
      document.body.appendChild(input);
      input.click();
    });
  }

  global.RR = global.RR || {};
  global.RR.Camera = { pickImage: pickImage };
})(window);
