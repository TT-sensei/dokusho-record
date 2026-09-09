/* ============================================================
 * backup.js
 * JSON形式でのバックアップ書き出し・復元を担当する。
 * ブラウザデータ削除等によるデータ消失に備える必須機能。
 * ============================================================ */
(function (global) {
  'use strict';

  function pad2(n) { return String(n).padStart(2, '0'); }

  function exportData(data) {
    var now = new Date();
    var filename = 'reading-record-backup-' + now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate()) + '.json';
    var json = JSON.stringify(data, null, 2);
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
  }

  /**
   * JSONファイルを読み込み、正規化したデータを返す。
   * 壊れたJSON・想定外の形式でも例外で落ちず、rejectで通知する。
   * @param {File} file
   * @returns {Promise<object>}
   */
  function importData(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('ファイルが選択されていません'));
        return;
      }
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
          var normalized = global.RR.Storage.migrate(parsed);
          resolve(normalized);
        } catch (e) {
          reject(new Error('データの復元処理に失敗しました'));
        }
      };
      reader.readAsText(file, 'utf-8');
    });
  }

  global.RR = global.RR || {};
  global.RR.Backup = {
    exportData: exportData,
    importData: importData
  };
})(window);
