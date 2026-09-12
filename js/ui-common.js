/* ============================================================
 * ui-common.js
 * モーダル、トースト、確認ダイアログ、表紙画像の描画など、
 * 複数の画面で共通して使うUI部品をまとめる。
 *
 * 表紙画像は2種類の由来を持つため描画方法が異なる:
 *   - coverSource: 'api'  → coverUrl をそのまま<img>で表示(失敗時は
 *                            プレースホルダーに切り替え、「表紙を撮る」へ誘導)
 *   - coverSource: 'user' → IndexedDBから非同期取得するため、
 *                            いったんプレースホルダーを描画してから
 *                            hydrateCovers() で差し替える
 * ============================================================ */
(function (global) {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------------- トースト ---------------- */
  var toastTimer = null;
  function showToast(message) {
    var root = el('toast-root');
    if (!root) return;
    root.innerHTML = '<div class="rr-toast"><div class="rr-toast__text">' + escapeHtml(message) + '</div></div>';
    var toastEl = root.querySelector('.rr-toast');
    requestAnimationFrame(function () { toastEl.classList.add('is-visible'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
      setTimeout(function () { root.innerHTML = ''; }, 250);
    }, 2600);
  }

  /* ---------------- モーダル ---------------- */
  function openModal(innerHtml, opts) {
    opts = opts || {};
    var root = el('modal-root');
    if (!root) return;
    root.innerHTML =
      '<div class="rr-modal-overlay" data-close="' + (opts.dismissible === false ? 'false' : 'true') + '">' +
        '<div class="rr-modal ' + (opts.wide ? 'rr-modal--wide' : '') + '" role="dialog" aria-modal="true">' + innerHtml + '</div>' +
      '</div>';
    root.classList.add('is-open');
    var overlay = root.querySelector('.rr-modal-overlay');
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay && overlay.getAttribute('data-close') === 'true') closeModal();
    });
    return root.querySelector('.rr-modal');
  }

  function closeModal() {
    var root = el('modal-root');
    if (!root) return;
    root.classList.remove('is-open');
    root.innerHTML = '';
  }

  function confirmDialog(message, onConfirm, opts) {
    opts = opts || {};
    var okLabel = opts.okLabel || '削除する';
    var okClass = opts.okClass || 'rr-btn--danger';
    openModal(
      '<div class="rr-confirm">' +
        '<p class="rr-confirm__message">' + escapeHtml(message) + '</p>' +
        '<div class="rr-confirm__actions">' +
          '<button type="button" class="rr-btn rr-btn--ghost" data-action="confirm-cancel">キャンセル</button>' +
          '<button type="button" class="rr-btn ' + okClass + '" data-action="confirm-ok">' + escapeHtml(okLabel) + '</button>' +
        '</div>' +
      '</div>'
    );
    document.querySelector('[data-action="confirm-cancel"]').addEventListener('click', closeModal);
    document.querySelector('[data-action="confirm-ok"]').addEventListener('click', function () {
      closeModal();
      onConfirm();
    });
  }

  /** 控えめな達成表示(過度な演出は入れない) */
  function showAchievement(message) {
    var root = el('toast-root');
    if (!root) return;
    root.innerHTML = '<div class="rr-toast rr-toast--achievement"><span aria-hidden="true">✨</span><div class="rr-toast__text">' + escapeHtml(message) + '</div></div>';
    var toastEl = root.querySelector('.rr-toast');
    requestAnimationFrame(function () { toastEl.classList.add('is-visible'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
      setTimeout(function () { root.innerHTML = ''; }, 250);
    }, 3400);
  }

  /* ---------------- 表紙画像 ---------------- */

  /** 一覧・シェルフ用の表紙HTML(未取得の由来ならプレースホルダー) */
  function coverHtml(book, opts) {
    opts = opts || {};
    var sizeClass = opts.sizeClass || '';
    var favMark = book.isFavorite ? '<span class="rr-cover__fav" aria-hidden="true">★</span>' : '';
    if (book.coverSource === 'api' && book.coverUrl) {
      return (
        '<div class="rr-cover ' + sizeClass + '">' + favMark +
          '<img src="' + escapeHtml(book.coverUrl) + '" alt="" loading="lazy" ' +
            'onerror="this.parentElement.classList.add(\'rr-cover--placeholder\');this.remove();">' +
        '</div>'
      );
    }
    if (book.coverSource === 'user' && book.coverImageId) {
      return (
        '<div class="rr-cover ' + sizeClass + ' rr-cover--pending" data-cover-source="user" data-cover-image-id="' + escapeHtml(book.coverImageId) + '">' + favMark +
          '<span class="rr-cover__spinner" aria-hidden="true"></span>' +
        '</div>'
      );
    }
    return '<div class="rr-cover ' + sizeClass + ' rr-cover--placeholder">' + favMark + '<span aria-hidden="true">📕</span></div>';
  }

  /** container内の「IndexedDB由来でまだ読み込んでいない表紙」を非同期で差し替える */
  function hydrateCovers(container) {
    if (!container) return;
    var pending = container.querySelectorAll('[data-cover-source="user"]');
    pending.forEach(function (elm) {
      var imageId = elm.getAttribute('data-cover-image-id');
      global.RR.ImageStore.getImage(imageId).then(function (dataUrl) {
        if (!elm.isConnected) return; // 描画し直されて既にDOMから消えている場合は何もしない
        if (dataUrl) {
          var img = document.createElement('img');
          img.src = dataUrl;
          img.alt = '';
          elm.classList.remove('rr-cover--pending');
          elm.querySelector('.rr-cover__spinner') && elm.querySelector('.rr-cover__spinner').remove();
          elm.insertBefore(img, elm.firstChild);
        } else {
          elm.classList.remove('rr-cover--pending');
          elm.classList.add('rr-cover--placeholder');
          var spinner = elm.querySelector('.rr-cover__spinner');
          if (spinner) spinner.outerHTML = '<span aria-hidden="true">📕</span>';
        }
      });
    });
  }

  global.RR = global.RR || {};
  global.RR.UICommon = {
    el: el,
    escapeHtml: escapeHtml,
    showToast: showToast,
    showAchievement: showAchievement,
    openModal: openModal,
    closeModal: closeModal,
    confirmDialog: confirmDialog,
    coverHtml: coverHtml,
    hydrateCovers: hydrateCovers
  };
})(window);
