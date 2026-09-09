/* ============================================================
 * ui-common.js
 * モーダル、トースト、バッジ獲得演出(紙吹雪込み)など、
 * 複数の画面で共通して使うUI部品をまとめる。
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
  function showToast(message, opts) {
    opts = opts || {};
    var root = el('toast-root');
    if (!root) return;
    root.innerHTML =
      '<div class="rr-toast">' +
        (opts.naviHtml || '') +
        '<div class="rr-toast__text">' + escapeHtml(message) + '</div>' +
      '</div>';
    var toastEl = root.querySelector('.rr-toast');
    requestAnimationFrame(function () { toastEl.classList.add('is-visible'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
      setTimeout(function () { root.innerHTML = ''; }, 250);
    }, opts.duration || 3200);
  }

  /* ---------------- モーダル ---------------- */
  function openModal(innerHtml, opts) {
    opts = opts || {};
    var root = el('modal-root');
    if (!root) return;
    root.innerHTML =
      '<div class="rr-modal-overlay" data-close="' + (opts.dismissible === false ? 'false' : 'true') + '">' +
        '<div class="rr-modal" role="dialog" aria-modal="true">' + innerHtml + '</div>' +
      '</div>';
    root.classList.add('is-open');
    var overlay = root.querySelector('.rr-modal-overlay');
    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay && overlay.getAttribute('data-close') === 'true') {
        closeModal();
      }
    });
    return root.querySelector('.rr-modal');
  }

  function closeModal() {
    var root = el('modal-root');
    if (!root) return;
    root.classList.remove('is-open');
    root.innerHTML = '';
  }

  /* ---------------- 簡易紙吹雪(外部ライブラリが読めればそちらを優先) ---------------- */
  function fireConfetti() {
    try {
      if (typeof global.confetti === 'function') {
        global.confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
        return;
      }
    } catch (e) { /* 外部ライブラリ失敗時はフォールバックへ */ }
    fireConfettiFallback();
  }

  function fireConfettiFallback() {
    var canvas = document.createElement('canvas');
    canvas.className = 'rr-confetti-canvas';
    canvas.width = global.innerWidth;
    canvas.height = global.innerHeight;
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var colors = ['#e7a72d', '#ee6a52', '#2f8b68', '#2762d4', '#8558c7'];
    var particles = [];
    for (var i = 0; i < 70; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.3,
        r: 4 + Math.random() * 5,
        c: colors[i % colors.length],
        vy: 2 + Math.random() * 3,
        vx: -1.5 + Math.random() * 3,
        rot: Math.random() * Math.PI,
        vrot: -0.2 + Math.random() * 0.4
      });
    }
    var frames = 0;
    var maxFrames = 130;
    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(function (p) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
        ctx.restore();
      });
      frames++;
      if (frames < maxFrames) {
        requestAnimationFrame(tick);
      } else {
        canvas.remove();
      }
    }
    requestAnimationFrame(tick);
  }

  /* ---------------- 獲得演出キュー(バッジ・目標達成をまとめて順番に見せる) ---------------- */
  /**
   * @param {Array<{type:'badge'|'goal', naviScene:string, title:string, subtitle?:string}>} items
   * @param {Function} onAllDone
   */
  function showCelebrationQueue(items, onAllDone) {
    if (!items || items.length === 0) {
      if (onAllDone) onAllDone();
      return;
    }
    var index = 0;
    function showNext() {
      if (index >= items.length) {
        closeModal();
        if (onAllDone) onAllDone();
        return;
      }
      var item = items[index];
      index++;
      var naviHtml = global.RR.Navi.bubbleHtml(item.naviScene);
      openModal(
        '<div class="rr-celebration">' +
          '<div class="rr-celebration__badgeicon">' + (item.iconHtml || '🎉') + '</div>' +
          '<h2 class="rr-celebration__title">' + escapeHtml(item.title) + '</h2>' +
          (item.subtitle ? '<p class="rr-celebration__subtitle">' + escapeHtml(item.subtitle) + '</p>' : '') +
          naviHtml +
          '<button type="button" class="rr-btn rr-btn--primary" data-action="celebration-next">つぎへ</button>' +
        '</div>',
        { dismissible: false }
      );
      fireConfetti();
      var btn = document.querySelector('[data-action="celebration-next"]');
      if (btn) btn.addEventListener('click', showNext);
    }
    showNext();
  }

  /* ---------------- 汎用: 確認ダイアログ ---------------- */
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

  /* ---------------- 進捗バー(共通パーツ) ---------------- */
  function progressBarHtml(current, target, opts) {
    opts = opts || {};
    var pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return (
      '<div class="rr-progress' + (opts.className ? ' ' + opts.className : '') + '">' +
        '<div class="rr-progress__track"><div class="rr-progress__bar" style="width:' + pct + '%"></div></div>' +
      '</div>'
    );
  }

  /** 表紙画像 or プレースホルダーを表示するimg要素のHTML */
  function coverHtml(coverUrl, title, sizeClass) {
    var cls = 'rr-cover' + (sizeClass ? ' ' + sizeClass : '');
    if (coverUrl) {
      return (
        '<div class="' + cls + '">' +
          '<img src="' + escapeHtml(coverUrl) + '" alt="" loading="lazy" ' +
            'onerror="this.parentElement.classList.add(\'rr-cover--placeholder\');this.remove();">' +
        '</div>'
      );
    }
    return '<div class="' + cls + ' rr-cover--placeholder"><span aria-hidden="true">📕</span></div>';
  }

  global.RR = global.RR || {};
  global.RR.UICommon = {
    el: el,
    escapeHtml: escapeHtml,
    showToast: showToast,
    openModal: openModal,
    closeModal: closeModal,
    fireConfetti: fireConfetti,
    showCelebrationQueue: showCelebrationQueue,
    confirmDialog: confirmDialog,
    progressBarHtml: progressBarHtml,
    coverHtml: coverHtml
  };
})(window);
