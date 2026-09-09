/* ============================================================
 * barcode.js
 * カメラ映像からISBN(EAN-13)バーコードを読み取る。
 * QuaggaJSを使用。学校のiPad/スマートフォン等での
 * ブラウザ依存を減らすため、BarcodeDetector APIは使用しない。
 * ============================================================ */
(function (global) {
  'use strict';

  var stream = null;
  var stopped = true;
  var target = null;
  var onDetectCallback = null;
  var onErrorCallback = null;
  var lastValue = null;
  var lastDetectedAt = 0;

  function isSupported() {
    return !!(global.Quagga && global.navigator && global.navigator.mediaDevices && global.navigator.mediaDevices.getUserMedia);
  }

  function start(videoEl, onDetect, onError) {
    stop();
    target = videoEl;
    onDetectCallback = onDetect;
    onErrorCallback = onError;
    lastValue = null;
    lastDetectedAt = 0;
    stopped = false;

    if (!global.Quagga) {
      onError(new Error('QuaggaJSを読み込めませんでした'));
      return;
    }
    if (!global.navigator.mediaDevices || !global.navigator.mediaDevices.getUserMedia) {
      onError(new Error('このブラウザではカメラを利用できません'));
      return;
    }

    var container = videoEl.parentElement || videoEl;
    container.classList.add('barcode-scanner-container');

    // Quaggaが生成するvideo/canvasを既存の表示領域に配置する。
    // 既存video要素は残してもよいが、Quaggaのvideoを優先して表示する。
    var reader = document.createElement('div');
    reader.id = 'quagga-reader';
    reader.style.width = '100%';
    reader.style.height = '100%';
    reader.style.position = 'relative';
    reader.style.overflow = 'hidden';
    videoEl.style.display = 'none';
    container.appendChild(reader);

    global.Quagga.init({
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: reader,
        constraints: {
          facingMode: { ideal: 'environment' },
          width: { min: 640 },
          height: { min: 480 },
          aspectRatio: { min: 1, max: 2 }
        },
        area: {
          top: '20%',
          right: '10%',
          left: '10%',
          bottom: '20%'
        }
      },
      locator: {
        patchSize: 'medium',
        halfSample: true
      },
      numOfWorkers: 2,
      frequency: 10,
      decoder: {
        readers: ['ean_reader']
      },
      locate: true
    }, function (err) {
      if (err) {
        cleanupReader();
        stopped = true;
        onErrorCallback && onErrorCallback(err);
        return;
      }
      if (stopped) {
        global.Quagga.stop();
        cleanupReader();
        return;
      }
      global.Quagga.start();
      bindDetected();
    });
  }

  function bindDetected() {
    global.Quagga.offDetected(handleDetected);
    global.Quagga.onDetected(handleDetected);
  }

  function handleDetected(result) {
    if (stopped || !result || !result.codeResult) return;

    var value = result.codeResult.code || '';
    // ISBN-13として扱える13桁だけを受け付ける。
    value = value.replace(/[^0-9]/g, '');
    if (value.length !== 13) return;

    // 同じバーコードの連続検出による多重処理を防止。
    var now = Date.now();
    if (value === lastValue && now - lastDetectedAt < 1500) return;
    lastValue = value;
    lastDetectedAt = now;

    var callback = onDetectCallback;
    stop();
    if (callback) callback({ rawValue: value });
  }

  function cleanupReader() {
    var reader = document.getElementById('quagga-reader');
    if (reader && reader.parentNode) reader.parentNode.removeChild(reader);
    if (target) target.style.display = '';
  }

  function stop() {
    stopped = true;
    if (global.Quagga) {
      try { global.Quagga.offDetected(handleDetected); } catch (e) {}
      try { global.Quagga.stop(); } catch (e) {}
    }
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    cleanupReader();
    target = null;
    onDetectCallback = null;
    onErrorCallback = null;
  }

  global.RR = global.RR || {};
  global.RR.Barcode = {
    isSupported: isSupported,
    start: start,
    stop: stop
  };
})(window);
