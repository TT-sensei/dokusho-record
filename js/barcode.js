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
  var startToken = 0;
  var lastCandidate = '';
  var candidateCount = 0;
  var candidateStartedAt = 0;
  var onProgressCallback = null;

  function isSupported() {
    return typeof global.Quagga !== 'undefined';
  }

  /**
   * @param {HTMLElement} targetEl QuaggaJSがvideo/canvasを差し込むコンテナ要素
   * @param {(code:string,isValidIsbn:boolean)=>void} onDetected 検出したコードを1回だけ返す
   * @param {(err:Error)=>void} onError
   * @param {(message:string)=>void} onProgress 任意: 読み取り状況
   */
  function start(targetEl, onDetected, onError, onProgress) {
    stop();
    if (!isSupported()) {
      onError(new Error('バーコード読み取り機能を読み込めませんでした'));
      return;
    }
    processing = false;
    lastCandidate = '';
    candidateCount = 0;
    candidateStartedAt = 0;
    onDetectedCallback = onDetected;
    onProgressCallback = typeof onProgress === 'function' ? onProgress : null;
    var token = ++startToken;

    global.Quagga.init({
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: targetEl,
        constraints: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          focusMode: { ideal: 'continuous' }
        },
        area: { top: '28%', right: '5%', bottom: '28%', left: '5%' }
      },
      decoder: { readers: ['ean_reader'] },
      frequency: 12,
      numOfWorkers: 2,
      locate: true,
      locator: { patchSize: 'large', halfSample: false }
    }, function (err) {
      if (token !== startToken) return;
      if (err) {
        onError(err);
        return;
      }
      global.Quagga.start();
      running = true;
      if (onProgressCallback) onProgressCallback('バーコードを枠に合わせて、端末を少し止めてください。');
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

    // 1フレームだけの誤認識で確定しない。同じ13桁が短時間に
    // 複数回検出され、ISBNの接頭辞とチェックデジットも通った場合だけ成功扱いにする。
    var now = Date.now();
    if (code === lastCandidate && now - candidateStartedAt <= 3000) {
      candidateCount += 1;
    } else {
      lastCandidate = code;
      candidateCount = 1;
      candidateStartedAt = now;
    }
    var valid = isValidIsbn13Barcode(code);
    if (onProgressCallback) {
      onProgressCallback(valid
        ? 'ISBNを確認中… ' + candidateCount + '/2'
        : 'コードを確認中… ' + candidateCount + '/2');
    }
    if (candidateCount < 2) return;

    processing = true;
    var cb = onDetectedCallback;
    stop();
    if (cb) cb(code, valid);
  }

  function stop() {
    startToken += 1;
    running = false;
    processing = false;
    lastCandidate = '';
    candidateCount = 0;
    candidateStartedAt = 0;
    onProgressCallback = null;
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
