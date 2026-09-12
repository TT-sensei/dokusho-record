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
        finish(input.files && input.files[0] ? input.files[0] : null);
      });

      document.body.appendChild(input);
      input.click();
    });
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (!file) { resolve(null); return; }
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 既存の登録画面(add.js)との互換用。
  // 「表紙を撮る」ではカメラを起動し、「写真から選ぶ」ではライブラリを開く。
  function pickPhoto(onSuccess, onError) {
    pickImage(true).then(fileToDataUrl).then(function (dataUrl) {
      if (dataUrl) {
        onSuccess(dataUrl);
      } else if (onError) {
        onError();
      }
    }).catch(function () {
      if (onError) onError();
    });
  }

  function pickFromLibrary(onSuccess, onError) {
    pickImage(false).then(fileToDataUrl).then(function (dataUrl) {
      if (dataUrl) {
        onSuccess(dataUrl);
      } else if (onError) {
        onError();
      }
    }).catch(function () {
      if (onError) onError();
    });
  }

  global.RR = global.RR || {};
  global.RR.Camera = {
    pickImage: pickImage,
    pickPhoto: pickPhoto,
    pickFromLibrary: pickFromLibrary
  };
})(window);
