/* ============================================================
 * barcode.js
 * カメラ映像からISBNバーコードを読み取る。
 * QuaggaJSを使用。カメラを選択してスキャンできる。
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
  var selectedDeviceId = '';

  function isSupported() {
    return !!(global.Quagga && global.navigator && global.navigator.mediaDevices && global.navigator.mediaDevices.getUserMedia);
  }

  function getCameras() {
    if (!isSupported()) return Promise.resolve([]);
    return global.navigator.mediaDevices.enumerateDevices().then(function (devices) {
      return devices.filter(function (d) { return d.kind === 'videoinput'; }).map(function (d, index) {
        var label = d.label || ('カメラ ' + (index + 1));
        return { deviceId: d.deviceId, label: label, index: index };
      });
    });
  }

  function setCamera(deviceId) {
    selectedDeviceId = deviceId || '';
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

    var reader = document.createElement('div');
    reader.id = 'quagga-reader';
    reader.style.width = '100%';
    reader.style.height = '100%';
    reader.style.position = 'relative';
    reader.style.overflow = 'hidden';
    videoEl.style.display = 'none';
    container.appendChild(reader);

    var cameraConstraints = {
      width: { min: 640 },
      height: { min: 480 },
      aspectRatio: { min: 1, max: 2 }
    };

    if (selectedDeviceId) {
      cameraConstraints.deviceId = { exact: selectedDeviceId };
    } else {
      cameraConstraints.facingMode = { ideal: 'environment' };
    }

    global.Quagga.init({
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: reader,
        constraints: cameraConstraints,
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
      decoder: { readers: ['ean_reader'] },
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
    var value = (result.codeResult.code || '').replace(/[^0-9]/g, '');
    if (value.length !== 13) return;

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
    getCameras: getCameras,
    setCamera: setCamera,
    start: start,
    stop: stop
  };
})(window);
