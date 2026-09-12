/* ============================================================
 * imagestore.js
 * ユーザーが撮影・選択した表紙画像だけをIndexedDBへ保存する。
 * ISBN検索で取得した表紙は「URLのみ」をlocalStorageに保存するため
 * ここでは扱わない(→ storage.js の coverUrl)。
 *
 * 保存前に縮小・圧縮してから保存することで、端末のストレージ消費を
 * 抑える(長辺 MAX_DIMENSION px・JPEG品質 QUALITY)。
 * ============================================================ */
(function (global) {
  'use strict';

  var DB_NAME = 'magazine-rack-images';
  var DB_VERSION = 1;
  var STORE_NAME = 'covers';
  var MAX_DIMENSION = 900;
  var QUALITY = 0.75;

  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!('indexedDB' in global)) {
        reject(new Error('この端末はIndexedDBに対応していません'));
        return;
      }
      var req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('IndexedDBを開けませんでした')); };
    });
    return dbPromise;
  }

  /** Fileオブジェクト(撮影・選択した画像)を、縮小・圧縮したdataURLに変換する */
  function fileToCompressedDataUrl(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('画像ファイルを選んでね'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('画像の読み込みに失敗しました')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('画像の読み込みに失敗しました')); };
        img.onload = function () {
          try {
            resolve(drawToCompressedDataUrl(img));
          } catch (e) {
            reject(e);
          }
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function drawToCompressedDataUrl(img) {
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    var scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
    var outW = Math.max(1, Math.round(w * scale));
    var outH = Math.max(1, Math.round(h * scale));
    var canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, outW, outH);
    return canvas.toDataURL('image/jpeg', QUALITY);
  }

  function saveImage(id, dataUrl) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put({ id: id, dataUrl: dataUrl });
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error || new Error('画像の保存に失敗しました')); };
      });
    });
  }

  function getImage(id) {
    if (!id) return Promise.resolve(null);
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = function () { resolve(req.result ? req.result.dataUrl : null); };
        req.onerror = function () { resolve(null); };
      });
    }).catch(function () { return null; });
  }

  function deleteImage(id) {
    if (!id) return Promise.resolve(true);
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      });
    }).catch(function () { return false; });
  }

  function getAllImages() {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var result = {};
        var tx = db.transaction(STORE_NAME, 'readonly');
        var req = tx.objectStore(STORE_NAME).openCursor();
        req.onsuccess = function (ev) {
          var cursor = ev.target.result;
          if (cursor) {
            result[cursor.value.id] = cursor.value.dataUrl;
            cursor.continue();
          } else {
            resolve(result);
          }
        };
        req.onerror = function () { resolve(result); };
      });
    }).catch(function () { return {}; });
  }

  global.RR = global.RR || {};
  global.RR.ImageStore = {
    fileToCompressedDataUrl: fileToCompressedDataUrl,
    saveImage: saveImage,
    getImage: getImage,
    deleteImage: deleteImage,
    getAllImages: getAllImages
  };
})(window);
