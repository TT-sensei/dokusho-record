/* ============================================================
 * views/add.js
 * 本の登録。3方式(ISBNで探す/表紙を撮る/写真から選ぶ)を明確に
 * 分け、どれかが使えなくても他の方式で必ず登録できるようにする。
 * ============================================================ */
(function (global) {
  'use strict';
  var U = global.RR.UICommon;
  var S = global.RR.Stats;
  var Books = global.RR.Books;
  var Barcode = global.RR.Barcode;
  var Camera = global.RR.Camera;
  var ImageStore = global.RR.ImageStore;
  var ISBNSearch = global.RR.ISBNSearch;

  var vs = null;
  var lastContainer = null, lastData = null, lastCtx = null;

  function freshState() {
    return {
      mode: 'menu', // menu | isbn | photo
      // ISBNで探す
      scanStatus: 'idle', // idle | scanning | invalid | error
      scanErrorMessage: '',
      scannedCode: '',
      isbnInput: '',
      lookupStatus: 'idle', // idle | loading | done
      result: null,
      // 表紙を撮る/写真から選ぶ
      photoBusy: false,
      previewDataUrl: '',
      // 登録フォーム共通
      form: null
    };
  }

  function onEnter() { vs = freshState(); }
  function onLeave() { Barcode.stop(); }

  function rerenderSelf() {
    if (!lastContainer) return;
    lastContainer.innerHTML = render(lastData);
    bind(lastContainer, lastData, lastCtx);
  }

  function defaultForm(overrides) {
    return Object.assign({
      title: '', author: '', isbn: '', pageCount: '', price: '',
      readDate: S.todayStr(), memo: '', isFavorite: false
    }, overrides || {});
  }

  /* ---------------- render ---------------- */

  function render() {
    if (!vs) vs = freshState();
    if (vs.mode === 'isbn') return renderIsbnMode();
    if (vs.mode === 'photo') return renderPhotoMode();
    return renderMenu();
  }

  function renderMenu() {
    return (
      '<section class="rr-view rr-add">' +
        '<p class="rr-add-lead">どうやって登録する?</p>' +
        '<div class="rr-method-grid">' +
          '<button type="button" class="rr-method-card" data-mode="isbn">' +
            '<span class="rr-method-card__icon" aria-hidden="true">🔍</span>' +
            '<span class="rr-method-card__title">ISBNで探す</span>' +
            '<span class="rr-method-card__desc">バーコードを読み取る、または数字を入力する</span>' +
          '</button>' +
          '<button type="button" class="rr-method-card" data-mode="photo" data-photo-mode="camera">' +
            '<span class="rr-method-card__icon" aria-hidden="true">📷</span>' +
            '<span class="rr-method-card__title">表紙を撮る</span>' +
            '<span class="rr-method-card__desc">カメラで表紙を撮影する</span>' +
          '</button>' +
          '<button type="button" class="rr-method-card" data-mode="photo" data-photo-mode="library">' +
            '<span class="rr-method-card__icon" aria-hidden="true">🖼</span>' +
            '<span class="rr-method-card__title">写真から選ぶ</span>' +
            '<span class="rr-method-card__desc">端末に保存済みの写真を選ぶ</span>' +
          '</button>' +
        '</div>' +
      '</section>'
    );
  }

  /* ---------- ISBNで探す ---------- */

  function renderIsbnMode() {
    return (
      '<section class="rr-view rr-add">' +
        backLink() +
        '<h2 class="rr-add-heading">🔍 ISBNで探す</h2>' +
        (vs.lookupStatus === 'loading' ? renderLoading() :
          vs.lookupStatus === 'done' ? renderIsbnResultForm() :
          renderIsbnInput()) +
      '</section>'
    );
  }

  function renderLoading() {
    return '<div class="rr-card rr-card--center"><div class="rr-spinner" aria-hidden="true"></div><p>しらべています...</p></div>';
  }

  function renderScannedCode() {
    if (!vs.scannedCode) return '';
    var valid = vs.scanStatus !== 'invalid';
    return (
      '<div class="rr-card rr-scan-result ' + (valid ? 'rr-scan-result--valid' : 'rr-scan-result--invalid') + '">' +
        '<p class="rr-scan-result__label">読み取ったコード</p>' +
        '<p class="rr-scan-result__code">' + U.escapeHtml(vs.scannedCode) + '</p>' +
        (valid
          ? '<p class="rr-scan-result__message">ISBN-13として認識しました。書籍情報を調べます。</p>'
          : '<p class="rr-scan-result__message">これはISBNのバーコードではないようです。<br>本のISBNバーコードを読み取ってください。</p>'
        ) +
        (valid ? '' : '<button type="button" class="rr-btn rr-btn--cta" data-action="scan-retry">もう一度読み取る</button>') +
      '</div>'
    );
  }

  function renderIsbnInput() {
    return (
      '<div class="rr-card">' +
        (vs.scanStatus === 'scanning'
          ? '<div class="rr-scan-frame"><div id="rr-scanner-target" class="rr-scanner-target"></div><div class="rr-scan-guide"></div></div>' +
            '<button type="button" class="rr-btn rr-btn--ghost" data-action="scan-stop">スキャンをやめる</button>'
          : renderScannedCode() +
            '<button type="button" class="rr-btn rr-btn--cta" data-action="scan-start">📷 カメラでバーコードをよむ</button>'
        ) +
        (vs.scanStatus === 'error' ? '<p class="rr-error-text">⚠️ ' + U.escapeHtml(vs.scanErrorMessage) + '</p>' : '') +
        '<p class="rr-or-divider">または</p>' +
        '<label class="rr-field">' +
          '<span>本のうらにある13桁くらいの数字を入力</span>' +
          '<input type="text" id="rr-isbn-manual" inputmode="numeric" placeholder="978XXXXXXXXXX" value="' + U.escapeHtml(vs.isbnInput) + '">' +
        '</label>' +
        '<button type="button" class="rr-btn rr-btn--primary" data-action="isbn-search">さがす</button>' +
        '<button type="button" class="rr-btn rr-btn--ghost" data-action="isbn-skip">ISBNが分からない(手入力で登録する)</button>' +
      '</div>'
    );
  }

  function renderIsbnResultForm() {
    var r = vs.result;
    var notFound = !r.title;
    return (
      '<div class="rr-card">' +
        (notFound
          ? '<p class="rr-hint">本の情報が見つからなかったよ。タイトルだけでも入力して登録できます。</p>'
          : '<div class="rr-result-cover">' +
              (r.coverUrl
                ? '<img src="' + U.escapeHtml(r.coverUrl) + '" alt="" onerror="this.parentElement.classList.add(\'rr-result-cover--missing\');this.remove();">'
                : '') +
              (!r.coverUrl ? '<p class="rr-hint">表紙が見つからなかったよ。登録後に「表紙を撮る」で追加できます。</p>' : '') +
            '</div>'
        ) +
        '<label class="rr-field"><span>タイトル' + (notFound ? '<em class="rr-required">必須</em>' : '') + '</span><input type="text" id="rr-r-title" value="' + U.escapeHtml(r.title) + '"></label>' +
        '<label class="rr-field"><span>著者</span><input type="text" id="rr-r-author" value="' + U.escapeHtml(r.author) + '"></label>' +
        '<div class="rr-field-row">' +
          '<label class="rr-field"><span>ページ数</span><input type="number" id="rr-r-pages" class="' + (r.pageCount ? '' : 'rr-field--missing') + '" value="' + (r.pageCount || '') + '"></label>' +
          '<label class="rr-field"><span>価格(円)</span><input type="number" id="rr-r-price" class="' + (r.price ? '' : 'rr-field--missing') + '" value="' + (r.price || '') + '"></label>' +
        '</div>' +
        commonFieldsHtml() +
        '<button type="button" class="rr-btn rr-btn--cta" data-action="isbn-register">本棚に追加する</button>' +
        '<button type="button" class="rr-btn rr-btn--ghost" data-action="isbn-retry">別のISBNを試す</button>' +
      '</div>'
    );
  }

  /* ---------- 表紙を撮る / 写真から選ぶ ---------- */

  function renderPhotoMode() {
    return (
      '<section class="rr-view rr-add">' +
        backLink() +
        '<h2 class="rr-add-heading">📷 表紙を登録</h2>' +
        (vs.photoBusy ? renderLoading() :
          vs.previewDataUrl ? renderPhotoConfirm() :
          '<div class="rr-card rr-card--center"><p class="rr-hint">写真を選んでね</p></div>'
        ) +
      '</section>'
    );
  }

  function renderPhotoConfirm() {
    var f = vs.form;
    return (
      '<div class="rr-card">' +
        '<div class="rr-photo-preview"><img src="' + vs.previewDataUrl + '" alt=""></div>' +
        '<label class="rr-field"><span>タイトル<em class="rr-required">必須</em></span><input type="text" id="rr-p-title" value="' + U.escapeHtml(f.title) + '" placeholder="ももたろう"></label>' +
        '<label class="rr-field"><span>著者(任意)</span><input type="text" id="rr-p-author" value="' + U.escapeHtml(f.author) + '"></label>' +
        '<label class="rr-field"><span>ISBN(任意・分かれば情報を自動入力できます)</span>' +
          '<div class="rr-field-inline">' +
            '<input type="text" id="rr-p-isbn" inputmode="numeric" value="' + U.escapeHtml(f.isbn) + '">' +
            '<button type="button" class="rr-btn-inline" data-action="photo-lookup">検索</button>' +
          '</div>' +
        '</label>' +
        commonFieldsHtml() +
        '<button type="button" class="rr-btn rr-btn--cta" data-action="photo-register">本棚に追加する</button>' +
        '<button type="button" class="rr-btn rr-btn--ghost" data-action="photo-retake">写真を選び直す</button>' +
      '</div>'
    );
  }

  function commonFieldsHtml() {
    var f = vs.form || defaultForm();
    return (
      '<label class="rr-field"><span>読んだ日</span><input type="date" id="rr-c-date" value="' + f.readDate + '" max="' + S.todayStr() + '"></label>' +
      '<label class="rr-field"><span>ひとこと感想(任意)</span><textarea id="rr-c-memo" maxlength="300" placeholder="おもしろかった! など">' + U.escapeHtml(f.memo) + '</textarea></label>' +
      '<label class="rr-field rr-field--checkbox"><input type="checkbox" id="rr-c-fav" ' + (f.isFavorite ? 'checked' : '') + '><span>お気に入りに登録する</span></label>'
    );
  }

  function backLink() {
    return '<button type="button" class="rr-back-link" data-action="back-to-menu">← 登録方法を選び直す</button>';
  }

  /* ---------------- bind ---------------- */

  function bind(container, data, ctx) {
    lastContainer = container; lastData = data; lastCtx = ctx;

    container.querySelectorAll('[data-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.getAttribute('data-mode');
        if (mode === 'isbn') {
          vs.mode = 'isbn';
          rerenderSelf();
        } else if (mode === 'photo') {
          var useCamera = btn.getAttribute('data-photo-mode') === 'camera';
          startPhotoFlow(useCamera);
        }
      });
    });

    var backBtn = container.querySelector('[data-action="back-to-menu"]');
    if (backBtn) backBtn.addEventListener('click', function () {
      Barcode.stop();
      vs = freshState();
      rerenderSelf();
    });

    bindIsbnHandlers(container, ctx);
    bindPhotoHandlers(container, ctx);
  }

  function bindIsbnHandlers(container, ctx) {
    var scanStartBtn = container.querySelector('[data-action="scan-start"]');
    if (scanStartBtn) scanStartBtn.addEventListener('click', function () {
      vs.scanStatus = 'scanning';
      vs.scanErrorMessage = '';
      vs.scannedCode = '';
      rerenderSelf();
      var target = document.getElementById('rr-scanner-target');
      if (target) {
        Barcode.start(target, function (code, isValidIsbn) {
          vs.scannedCode = code;
          if (!isValidIsbn) {
            vs.scanStatus = 'invalid';
            vs.lookupStatus = 'idle';
            rerenderSelf();
            return;
          }
          vs.scanStatus = 'idle';
          runIsbnLookup(code);
        }, function (err) {
          vs.scanStatus = 'error';
          vs.scanErrorMessage = Barcode.isSupported()
            ? 'カメラを起動できませんでした。カメラの使用を許可しているか確認してね。'
            : 'バーコード読み取り機能を読み込めませんでした。数字を入力して探してみてね。';
          rerenderSelf();
        });
      }
    });

    var scanRetryBtn = container.querySelector('[data-action="scan-retry"]');
    if (scanRetryBtn) scanRetryBtn.addEventListener('click', function () {
      vs.scanStatus = 'scanning';
      vs.scannedCode = '';
      vs.scanErrorMessage = '';
      rerenderSelf();
      var target = document.getElementById('rr-scanner-target');
      if (target) {
        Barcode.start(target, function (code, isValidIsbn) {
          vs.scannedCode = code;
          if (!isValidIsbn) {
            vs.scanStatus = 'invalid';
            vs.lookupStatus = 'idle';
            rerenderSelf();
            return;
          }
          vs.scanStatus = 'idle';
          runIsbnLookup(code);
        }, function () {
          vs.scanStatus = 'error';
          vs.scanErrorMessage = 'カメラを起動できませんでした。カメラの使用を許可しているか確認してね。';
          rerenderSelf();
        });
      }
    });

    var scanStopBtn = container.querySelector('[data-action="scan-stop"]');
    if (scanStopBtn) scanStopBtn.addEventListener('click', function () {
      Barcode.stop();
      vs.scanStatus = 'idle';
      rerenderSelf();
    });

    var manualInput = document.getElementById('rr-isbn-manual');
    if (manualInput) manualInput.addEventListener('input', function () { vs.isbnInput = manualInput.value; });

    var searchBtn = container.querySelector('[data-action="isbn-search"]');
    if (searchBtn) searchBtn.addEventListener('click', function () {
      var digits = (vs.isbnInput || '').replace(/[^0-9Xx]/g, '');
      if (digits.length < 9) { U.showToast('数字が短すぎるみたい。もう一度確認してね'); return; }
      runIsbnLookup(digits);
    });

    var skipBtn = container.querySelector('[data-action="isbn-skip"]');
    if (skipBtn) skipBtn.addEventListener('click', function () {
      vs.result = { title: '', author: '', coverUrl: '', pageCount: 0, price: 0, isbn: '' };
      vs.form = defaultForm();
      vs.lookupStatus = 'done';
      rerenderSelf();
    });

    var registerBtn = container.querySelector('[data-action="isbn-register"]');
    if (registerBtn) registerBtn.addEventListener('click', function () {
      var title = document.getElementById('rr-r-title').value.trim();
      if (!title) { U.showToast('タイトルを入力してね'); return; }
      var input = {
        title: title,
        author: document.getElementById('rr-r-author').value.trim(),
        isbn: vs.result.isbn,
        pageCount: document.getElementById('rr-r-pages').value,
        price: document.getElementById('rr-r-price').value,
        coverSource: vs.result.coverUrl ? 'api' : 'none',
        coverUrl: vs.result.coverUrl || '',
        readDate: document.getElementById('rr-c-date').value,
        memo: document.getElementById('rr-c-memo').value.trim(),
        isFavorite: document.getElementById('rr-c-fav').checked,
        entryMethod: 'isbn'
      };
      ctx.actions.registerBook(input);
    });

    var retryBtn = container.querySelector('[data-action="isbn-retry"]');
    if (retryBtn) retryBtn.addEventListener('click', function () {
      vs.lookupStatus = 'idle';
      vs.result = null;
      vs.isbnInput = '';
      vs.scannedCode = '';
      vs.scanStatus = 'idle';
      rerenderSelf();
    });
  }

  function runIsbnLookup(rawIsbn) {
    var isbn13 = Books.toCanonicalIsbn(rawIsbn);
    vs.lookupStatus = 'loading';
    rerenderSelf();
    ISBNSearch.lookupIsbn(isbn13).then(function (result) {
      vs.result = result;
      vs.form = defaultForm({ isbn: result.isbn });
      vs.lookupStatus = 'done';
      rerenderSelf();
    });
  }

  function bindPhotoHandlers(container, ctx) {
    var lookupBtn = container.querySelector('[data-action="photo-lookup"]');
    if (lookupBtn) lookupBtn.addEventListener('click', function () {
      var isbnVal = document.getElementById('rr-p-isbn').value.replace(/[^0-9Xx]/g, '');
      if (isbnVal.length < 9) { U.showToast('数字が短すぎるみたい'); return; }
      // 現在入力中の値をフォームへ退避してから検索へ
      vs.form.title = document.getElementById('rr-p-title').value;
      vs.form.author = document.getElementById('rr-p-author').value;
      vs.form.readDate = document.getElementById('rr-c-date').value;
      vs.form.memo = document.getElementById('rr-c-memo').value;
      vs.form.isFavorite = document.getElementById('rr-c-fav').checked;

      var isbn13 = Books.toCanonicalIsbn(isbnVal);
      vs.photoBusy = true;
      rerenderSelf();
      ISBNSearch.lookupIsbn(isbn13).then(function (result) {
        vs.photoBusy = false;
        vs.form.isbn = isbn13;
        if (result.title) vs.form.title = result.title;
        if (result.author) vs.form.author = result.author;
        U.showToast(result.title ? '情報を入力したよ' : '情報が見つからなかったよ');
        rerenderSelf();
      });
    });

    var retakeBtn = container.querySelector('[data-action="photo-retake"]');
    if (retakeBtn) retakeBtn.addEventListener('click', function () {
      vs.previewDataUrl = '';
      vs.pickedFile = null;
      rerenderSelf();
    });

    var registerBtn = container.querySelector('[data-action="photo-register"]');
    if (registerBtn) registerBtn.addEventListener('click', function () {
      var title = document.getElementById('rr-p-title').value.trim();
      if (!title) { U.showToast('タイトルを入力してね'); return; }
      var input = {
        title: title,
        author: document.getElementById('rr-p-author').value.trim(),
        isbn: document.getElementById('rr-p-isbn').value.trim(),
        readDate: document.getElementById('rr-c-date').value,
        memo: document.getElementById('rr-c-memo').value.trim(),
        isFavorite: document.getElementById('rr-c-fav').checked,
        entryMethod: vs.entryMethodForPhoto || 'photo',
        _previewDataUrl: vs.previewDataUrl
      };
      ctx.actions.registerBook(input);
    });
  }

  function startPhotoFlow(useCamera) {
    vs.mode = 'photo';
    vs.photoBusy = true;
    vs.previewDataUrl = '';
    vs.form = defaultForm();
    rerenderSelf();
    if (useCamera) {
      Camera.pickPhoto(function (dataUrl) {
        vs.photoBusy = false;
        vs.previewDataUrl = dataUrl;
        vs.entryMethodForPhoto = 'camera';
        rerenderSelf();
      }, function () {
        vs.photoBusy = false;
        rerenderSelf();
        U.showToast('写真を撮れませんでした');
      });
    } else {
      Camera.pickFromLibrary(function (dataUrl) {
        vs.photoBusy = false;
        vs.previewDataUrl = dataUrl;
        vs.entryMethodForPhoto = 'library';
        rerenderSelf();
      }, function () {
        vs.photoBusy = false;
        rerenderSelf();
        U.showToast('写真を選べませんでした');
      });
    }
  }

  global.RR = global.RR || {};
  global.RR.Views = global.RR.Views || {};
  global.RR.Views.add = { onEnter: onEnter, onLeave: onLeave, render: render, bind: bind };
})(window);
