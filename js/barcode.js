/* ============================================================
 * barcode.js
 * カメラ映像からISBN(EAN-13)バーコードを読み取る。
 * ブラウザ標準の BarcodeDetector API を使用する。
 * 非対応環境では isSupported() が false を返すので、
 * 呼び出し側は必ず手入力へ誘導すること。
 * ============================================================ */
(function (global) {
  'use strict';

  var stream = null;
  var rafId = null;
  var detector = null;
  var stopped = true;

  function isSupported() {
    return typeof global.BarcodeDetector !== 'undefined';
  }

  /**
   * カメラを起動し、videoEl に映像を流しながらバーコード検出を続ける。
   * @param {HTMLVideoElement} videoEl
   * @param {(result:{rawValue:string})=>void} onDetect 検出成功時(1回のみ呼ばれ、以後は自動停止)
   * @param {(err:Error)=>void} onError カメラ起動失敗などのエラー
   */
  function start(videoEl, onDetect, onError) {
    stop(); // 念のため既存のスキャンを止める
    stopped = false;

    if (!isSupported()) {
      onError(new Error('BarcodeDetector未対応'));
      return;
    }

    try {
      detector = new global.BarcodeDetector({ formats: ['ean_13'] });
    } catch (e) {
      onError(e);
      return;
    }

    var constraints = { video: { facingMode: { ideal: 'environment' } }, audio: false };
    global.navigator.mediaDevices.getUserMedia(constraints)
      .then(function (mediaStream) {
        if (stopped) {
          mediaStream.getTracks().forEach(function (t) { t.stop(); });
          return;
        }
        stream = mediaStream;
        videoEl.srcObject = stream;
        return videoEl.play();
      })
      .then(function () {
        if (!stopped) scanLoop(videoEl, onDetect, onError);
      })
      .catch(function (err) {
        onError(err);
      });
  }

  function scanLoop(videoEl, onDetect, onError) {
    if (stopped || !detector) return;
    detector.detect(videoEl)
      .then(function (barcodes) {
        if (stopped) return;
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          var value = barcodes[0].rawValue;
          stop();
          onDetect({ rawValue: value });
          return;
        }
        rafId = global.requestAnimationFrame(function () { scanLoop(videoEl, onDetect, onError); });
      })
      .catch(function (err) {
        // 検出処理自体の失敗はスキャン継続を試みる(1回の失敗で止めない)
        if (!stopped) {
          rafId = global.requestAnimationFrame(function () { scanLoop(videoEl, onDetect, onError); });
        }
      });
  }

  function stop() {
    stopped = true;
    if (rafId) {
      global.cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    detector = null;
  }

  global.RR = global.RR || {};
  global.RR.Barcode = {
    isSupported: isSupported,
    start: start,
    stop: stop
  };
})(window);
