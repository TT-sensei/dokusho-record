/* ============================================================
 * views/add.js
 * 本の登録画面。「バーコード」「手入力」の2方式を明確に分ける。
 * ============================================================ */
(function (global) {
  'use strict';
  var U = global.RR.UICommon;
  var S = global.RR.Stats;
  var Barcode = global.RR.Barcode;
  var API = global.RR.API;
  var Books = global.RR.Books;
  var Navi = global.RR.Navi;
  var vs = null;
  var lastContainer = null;
  var lastData = null;
  var lastCtx = null;

  function freshState() {
    return {
      tab: Barcode.isSupported() ? 'barcode' : 'manual',
      scanStatus: 'idle',
      scanErrorMessage: '',
      lookupStatus: 'idle',
      foundBook: null,
      readDate: S.todayStr(),
      memo: '',
      cameras: [],
      cameraStatus: 'idle',
      selectedCameraId: '',
      manual: { title: '', author: '', isbn: '', readDate: S.todayStr(), memo: '' }
    };
  }

  function onEnter() { vs = freshState(); }
  function onLeave() { Barcode.stop(); }

  function rerenderSelf() {
    if (!lastContainer || !lastData || !lastCtx) return;
    lastContainer.innerHTML = render(lastData);
    bind(lastContainer, lastData, lastCtx);
  }

  function render(data) {
    if (!vs) vs = freshState();
    return '<section class="rr-view rr-add">' +
      '<div class="rr-tabbar" role="tablist">' +
        '<button type="button" class="rr-tab' + (vs.tab === 'barcode' ? ' is-active' : '') + '" data-tab="barcode">📷 バーコードで登録</button>' +
        '<button type="button" class="rr-tab' + (vs.tab === 'manual' ? ' is-active' : '') + '" data-tab="manual">✍️ 手入力で登録</button>' +
      '</div>' +
      (vs.tab === 'barcode' ? renderBarcodeTab(Barcode.isSupported()) : renderManualTab()) +
    '</section>';
  }

  function renderBarcodeTab(supported) {
    if (!supported) return '<div class="rr-card">' + Navi.bubbleHtml('notFound', 'お使いの端末ではバーコード読み取りに対応していないみたい。手入力で登録してみよう!') + '<button type="button" class="rr-btn rr-btn--primary" data-action="switch-manual">✍️ 手入力で登録する</button></div>';
    if (vs.lookupStatus === 'loading') return '<div class="rr-card rr-card--center"><div class="rr-spinner" aria-hidden="true"></div><p>書籍情報を検索中...</p></div>';
    if (vs.lookupStatus === 'found' && vs.foundBook) return renderFoundBookConfirm(vs.foundBook);
    if (vs.lookupStatus === 'notfound') return '<div class="rr-card">' + Navi.bubbleHtml('notFound') + '<button type="button" class="rr-btn rr-btn--primary" data-action="switch-manual">✍️ 手入力で登録する</button><button type="button" class="rr-btn rr-btn--ghost" data-action="scan-retry">もう一度スキャンする</button></div>';
    if (vs.scanStatus === 'error') return '<div class="rr-card">' + cameraSelectorHtml() + '<p class="rr-error-text">⚠️ ' + U.escapeHtml(vs.scanErrorMessage || 'カメラを使用できませんでした。') + '</p><button type="button" class="rr-btn rr-btn--primary" data-action="switch-manual">✍️ 手入力で登録する</button><button type="button" class="rr-btn rr-btn--ghost" data-action="scan-retry">もう一度試す</button></div>';
    if (vs.scanStatus === 'scanning' || vs.scanStatus === 'requesting') return '<div class="rr-card rr-card--scan">' + cameraSelectorHtml() + '<div class="rr-scan-frame"><video id="rr-scan-video" class="rr-scan-video" playsinline muted></video></div><p class="rr-scan-hint">' + (vs.scanStatus === 'requesting' ? 'カメラを起動しています...' : '本の裏表紙などにあるバーコードを枠内に映してね') + '</p><button type="button" class="rr-btn rr-btn--ghost" data-action="scan-cancel">キャンセル</button></div>';
    return '<div class="rr-card rr-card--center">' + Navi.bubbleHtml('scanHint') + cameraSelectorHtml() + '<button type="button" class="rr-btn rr-btn--cta" data-action="scan-start">📷 スキャン開始</button></div>';
  }

  function cameraSelectorHtml() {
    var html = '<label class="rr-field"><span>📷 カメラを選ぶ</span><select id="rr-camera-select"><option value="">自動（背面カメラ）</option>';
    vs.cameras.forEach(function (camera, index) {
      var label = friendlyCameraName(camera, index);
      html += '<option value="' + U.escapeHtml(camera.deviceId) + '"' + (camera.deviceId === vs.selectedCameraId ? ' selected' : '') + '>' + U.escapeHtml(label) + '</option>';
    });
    html += '</select>';
    if (vs.cameraStatus === 'loading') html += '<small>カメラを調べています...</small>';
    else if (vs.cameras.length === 0) html += '<small>「スキャン開始」を押すとカメラを確認できます。</small>';
    html += '</label>';
    return html;
  }

  function friendlyCameraName(camera, index) {
    var label = camera.label || '';
    if (/back|rear|environment|背面|後面/i.test(label)) return '背面カメラ';
    if (/front|user|前面|インカメラ/i.test(label)) return '前面カメラ';
    return 'カメラ ' + (index + 1);
  }

  function renderFoundBookConfirm(book) {
    return '<div class="rr-card"><div class="rr-found-book">' + U.coverHtml(book.coverUrl, book.title, 'rr-cover--md') + '<div class="rr-found-book__meta"><p class="rr-found-book__title">' + U.escapeHtml(book.title) + '</p>' + (book.author ? '<p class="rr-found-book__author">' + U.escapeHtml(book.author) + '</p>' : '') + (book.publisher ? '<p class="rr-found-book__publisher">' + U.escapeHtml(book.publisher) + '</p>' : '') + '</div></div>' + confirmFieldsHtml() + '<button type="button" class="rr-btn rr-btn--cta" data-action="submit-found">この本を登録する</button><button type="button" class="rr-btn rr-btn--ghost" data-action="scan-retry">別の本を探す</button></div>';
  }

  function confirmFieldsHtml() {
    return '<label class="rr-field"><span>読んだ日</span><input type="date" id="rr-confirm-date" value="' + vs.readDate + '" max="' + S.todayStr() + '"></label><label class="rr-field"><span>ひとこと感想(任意)</span><textarea id="rr-confirm-memo" placeholder="おもしろかった! など" maxlength="200">' + U.escapeHtml(vs.memo) + '</textarea></label>';
  }

  function renderManualTab() {
    var m = vs.manual;
    return '<div class="rr-card"><label class="rr-field"><span>本の題名<em class="rr-required">必須</em></span><input type="text" id="rr-m-title" value="' + U.escapeHtml(m.title) + '" placeholder="ももたろう"></label><label class="rr-field"><span>著者(任意)</span><input type="text" id="rr-m-author" value="' + U.escapeHtml(m.author) + '"></label><label class="rr-field"><span>ISBN(任意)</span><input type="text" id="rr-m-isbn" value="' + U.escapeHtml(m.isbn) + '" placeholder="9ではじまる13けたの数字" inputmode="numeric"><small>本の裏表紙にある「9ではじまる13けた」の数字だよ。</small></label><label class="rr-field"><span>読んだ日</span><input type="date" id="rr-m-date" value="' + m.readDate + '" max="' + S.todayStr() + '"></label><label class="rr-field"><span>ひとこと感想(任意)</span><textarea id="rr-m-memo" placeholder="主人公が好き。 など" maxlength="200">' + U.escapeHtml(m.memo) + '</textarea></label><button type="button" class="rr-btn rr-btn--cta" data-action="submit-manual">登録する</button></div>';
  }

  function bind(container, data, ctx) {
    lastContainer = container; lastData = data; lastCtx = ctx;
    container.querySelectorAll('[data-tab]').forEach(function (btn) { btn.addEventListener('click', function () { Barcode.stop(); vs.tab = btn.getAttribute('data-tab'); vs.scanStatus = 'idle'; vs.lookupStatus = 'idle'; rerenderSelf(); }); });
    bindBarcodeHandlers(container, ctx);
    bindManualHandlers(container, ctx);
  }

  function bindBarcodeHandlers(container, ctx) {
    var cameraSelect = container.querySelector('#rr-camera-select');
    if (cameraSelect) cameraSelect.addEventListener('change', function () {
      vs.selectedCameraId = cameraSelect.value;
      if (vs.scanStatus === 'scanning') {
        Barcode.setCamera(vs.selectedCameraId);
        Barcode.stop();
        setTimeout(function () { var v = document.getElementById('rr-scan-video'); if (v) Barcode.start(v, handleDetected, handleScanError); }, 0);
      } else {
        Barcode.setCamera(vs.selectedCameraId);
      }
    });

    var startBtn = container.querySelector('[data-action="scan-start"]');
    if (startBtn) startBtn.addEventListener('click', beginScan);
    var cancelBtn = container.querySelector('[data-action="scan-cancel"]');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { Barcode.stop(); vs.scanStatus = 'idle'; rerenderSelf(); });
    var retryBtn = container.querySelector('[data-action="scan-retry"]');
    if (retryBtn) retryBtn.addEventListener('click', function () { vs.lookupStatus = 'idle'; vs.foundBook = null; vs.scanStatus = 'idle'; rerenderSelf(); });
    var switchManualBtn = container.querySelector('[data-action="switch-manual"]');
    if (switchManualBtn) switchManualBtn.addEventListener('click', function () { Barcode.stop(); vs.tab = 'manual'; vs.scanStatus = 'idle'; vs.lookupStatus = 'idle'; rerenderSelf(); });
    var submitFoundBtn = container.querySelector('[data-action="submit-found"]');
    if (submitFoundBtn) submitFoundBtn.addEventListener('click', function () {
      var dateEl = document.getElementById('rr-confirm-date'); var memoEl = document.getElementById('rr-confirm-memo');
      ctx.actions.submitBook({ title: vs.foundBook.title, author: vs.foundBook.author, publisher: vs.foundBook.publisher, coverUrl: vs.foundBook.coverUrl, isbn: vs.foundBook.isbn, readDate: dateEl ? dateEl.value : vs.readDate, memo: memoEl ? memoEl.value : '', entryMethod: 'barcode' });
    });
    if (vs.scanStatus === 'scanning') {
      var videoEl = document.getElementById('rr-scan-video');
      if (videoEl && !document.getElementById('quagga-reader')) attachScan(videoEl);
    }
  }

  function loadCameras() {
    vs.cameraStatus = 'loading';
    Barcode.getCameras().then(function (cameras) {
      vs.cameras = cameras;
      vs.cameraStatus = 'ready';
      rerenderSelf();
    }).catch(function () { vs.cameraStatus = 'error'; rerenderSelf(); });
  }

  function beginScan() {
    vs.scanStatus = 'requesting';
    rerenderSelf();
    Barcode.setCamera(vs.selectedCameraId);
    var videoEl = document.getElementById('rr-scan-video');
    vs.scanStatus = 'scanning';
    rerenderSelf();
    setTimeout(function () {
      var v = document.getElementById('rr-scan-video');
      if (v) attachScan(v);
      loadCameras();
    }, 0);
  }

  function handleDetected(result) {
    var raw = Books.normalizeIsbn(result.rawValue); var isbn13 = Books.toCanonicalIsbn(raw);
    vs.lookupStatus = 'loading'; rerenderSelf();
    API.lookupIsbn(isbn13).then(function (info) { if (info) { vs.foundBook = info; vs.lookupStatus = 'found'; } else { vs.foundBook = null; vs.lookupStatus = 'notfound'; vs.manual.isbn = isbn13; } rerenderSelf(); });
  }

  function handleScanError(err) {
    vs.scanStatus = 'error';
    vs.scanErrorMessage = 'カメラを起動できませんでした。カメラの使用を許可しているか確認してね。';
    rerenderSelf();
  }

  function attachScan(videoEl) { Barcode.start(videoEl, handleDetected, handleScanError); }

  function bindManualHandlers(container, ctx) {
    var titleEl = document.getElementById('rr-m-title'); var authorEl = document.getElementById('rr-m-author'); var isbnEl = document.getElementById('rr-m-isbn'); var dateEl = document.getElementById('rr-m-date'); var memoEl = document.getElementById('rr-m-memo');
    [titleEl, authorEl, isbnEl, dateEl, memoEl].forEach(function (elm) { if (!elm) return; elm.addEventListener('input', function () { vs.manual.title = titleEl ? titleEl.value : vs.manual.title; vs.manual.author = authorEl ? authorEl.value : vs.manual.author; vs.manual.isbn = isbnEl ? isbnEl.value : vs.manual.isbn; vs.manual.readDate = dateEl ? dateEl.value : vs.manual.readDate; vs.manual.memo = memoEl ? memoEl.value : vs.manual.memo; }); });
    var submitBtn = container.querySelector('[data-action="submit-manual"]');
    if (submitBtn) submitBtn.addEventListener('click', function () { if (!vs.manual.title || !vs.manual.title.trim()) { U.showToast('本の題名を入力してね'); return; } ctx.actions.submitBook({ title: vs.manual.title, author: vs.manual.author, isbn: vs.manual.isbn, readDate: vs.manual.readDate, memo: vs.manual.memo, entryMethod: 'manual' }); });
  }

  global.RR = global.RR || {}; global.RR.Views = global.RR.Views || {};
  global.RR.Views.add = { render: render, bind: bind, onEnter: onEnter, onLeave: onLeave };
})(window);
