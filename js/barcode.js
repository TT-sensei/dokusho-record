/* ============================================================
 * barcode.js
 * QuaggaJSでカメラ映像からISBN(EAN-13)バーコードを検出する。
 * ネイティブのBarcodeDetectorは環境によって未対応のため、
 * 互換性を優先してQuaggaJSを採用する(index.htmlでCDN読み込み)。
 *
 * 「表紙を撮る」(camera.js)とは目的も実装も異なるため、
 * このファイルはバーコード検出専用にする。
 * ============================================================ */
(function (global) {
  'use strict';

  var running = false;
  var onDetectedCallback = null;
  var processing = false;

  function isSupported() {
    return typeof global.Quagga !== 'undefined';
  }

  /**
   * @param {HTMLElement} targetEl QuaggaJSがvideo/canvasを差し込むコンテナ要素
   * @param {(code:string,isValidIsbn:boolean)=>void} onDetected 検出したコードを1回だけ返す
   * @param {(err:Error)=>void} onError
   */
  function start(targetEl, onDetected, onError) {
    stop();
    if (!isSupported()) {
      onError(new Error('バーコード読み取り機能を読み込めませんでした'));
      return;
    }
    processing = false;
    onDetectedCallback = onDetected;

    global.Quagga.init({
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: targetEl,
        constraints: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        area: { top: '10%', bottom: '10%' }
      },
      decoder: { readers: ['ean_reader'] },
      frequency: 10,
      numOfWorkers: 2,
      locator: { patchSize: 'medium', halfSample: true }
    }, function (err) {
      if (err) {
        onError(err);
        return;
      }
      global.Quagga.start();
      running = true;
    });

    global.Quagga.onDetected(handleDetected);
  }

  function isValidIsbn13Barcode(code) {
    if (!/^\d{13}$/.test(code)) return false;
    // ISBN-13のバーコードは978または979で始まる。
    if (code.indexOf('978') !== 0 && code.indexOf('979') !== 0) return false;
    var sum = 0;
    for (var i = 0; i < 12; i++) {
      sum += Number(code.charAt(i)) * (i % 2 === 0 ? 1 : 3);
    }
    return (10 - (sum % 10)) % 10 === Number(code.charAt(12));
  }

  function handleDetected(data) {
    if (!running || processing) return;
    var code = data && data.codeResult && data.codeResult.code;
    if (!code || !/^\d{13}$/.test(code)) return;

    // 正しいISBNでなくても、読み取った番号そのものを画面へ返す。
    // これで「別のバーコードを読んでしまった」と利用者が判断できる。
    processing = true;
    var cb = onDetectedCallback;
    var valid = isValidIsbn13Barcode(code);
    stop();
    if (cb) cb(code, valid);
  }

  function stop() {
    running = false;
    processing = false;
    if (isSupported()) {
      try { global.Quagga.offDetected(handleDetected); } catch (e) { /* noop */ }
      try { global.Quagga.stop(); } catch (e) { /* noop */ }
    }
  }

  global.RR = global.RR || {};
  global.RR.Barcode = {
    isSupported: isSupported,
    start: start,
    stop: stop,
    isValidIsbn13Barcode: isValidIsbn13Barcode
  };
})(window);
