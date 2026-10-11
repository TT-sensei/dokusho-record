/* ============================================================
 * backup.js
 * JSON形式でのバックアップ書き出し・復元。
 * 画像(IndexedDB)を含めるかは任意選択とする
 * (含めるとファイルが大きくなるため、既定では含めない)。
 * ============================================================ */
(function (global) {
  'use strict';

  function pad2(n) { return String(n).padStart(2, '0'); }

  /**
   * @param {object} data ストレージ全体のデータ
   * @param {boolean} includeImages trueならIndexedDBの画像もdataURLで同梱する
   */
  function exportData(data, includeImages) {
    var proceed = includeImages
      ? global.RR.ImageStore.getAllImages()
      : Promise.resolve(null);

    return proceed.then(function (images) {
      var payload = {
        exportedAt: new Date().toISOString(),
        data: data,
        images: images || undefined
      };
      var now = new Date();
      var filename = 'magazine-rack-backup-' + now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate()) + '.json';
      var json = JSON.stringify(payload, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      return filename;
    });
  }

  /**
   * JSONファイルを読み込み、{data, images} を返す。
   * 壊れたJSON・想定外の形式でも例外で落ちず、rejectで通知する。
   */
  function importData(file) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error('ファイルが選択されていません')); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('ファイルの読み込みに失敗しました')); };
      reader.onload = function () {
        var parsed;
        try {
          parsed = JSON.parse(String(reader.result));
        } catch (e) {
          reject(new Error('JSONの形式が正しくありません'));
          return;
        }
        try {
          // 旧形式(dataキーを持たない = data自体がトップレベル)にも対応する。
          // books配列がないJSONをバックアップと誤認して本棚を空にしない。
          var rawData = (parsed && typeof parsed === 'object' && parsed.data) ? parsed.data : parsed;
          if (!rawData || typeof rawData !== 'object' || !Array.isArray(rawData.books)) {
            reject(new Error('本棚データが見つかりません。正しいバックアップファイルを選んでください'));
            return;
          }
          var images = null;
          if (parsed && typeof parsed === 'object' && parsed.images !== undefined) {
            if (!parsed.images || typeof parsed.images !== 'object' || Array.isArray(parsed.images)) {
              reject(new Error('表紙画像データの形式が正しくありません'));
              return;
            }
            images = parsed.images;
            var imageIds = Object.keys(images);
            for (var i = 0; i < imageIds.length; i++) {
              if (typeof images[imageIds[i]] !== 'string' || images[imageIds[i]].indexOf('data:image/') !== 0) {
                reject(new Error('表紙画像データの形式が正しくありません'));
                return;
              }
            }
          }
          var normalized = global.RR.Storage.migrate(rawData);
          resolve({ data: normalized, images: images });
        } catch (e) {
          reject(new Error('データの復元処理に失敗しました'));
        }
      };
      reader.readAsText(file, 'utf-8');
    });
  }

  global.RR = global.RR || {};
  global.RR.Backup = { exportData: exportData, importData: importData };
})(window);
