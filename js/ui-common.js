/* ============================================================
 * ui-common.js
 * モーダル、トースト、確認ダイアログ、表紙画像、感想カラーなど
 * 複数の画面で共通して使うUI部品をまとめる。
 * ============================================================ */
(function (global) {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var toastTimer = null;
  function showToast(message) {
    var root = el('toast-root');
    if (!root) return;
    root.innerHTML = '<div class="rr-toast"><div class="rr-toast__text">' + escapeHtml(message) + '</div></div>';
    var toastEl = root.querySelector('.rr-toast');
    requestAnimationFrame(function () { toastEl.classList.add('is-visible'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); setTimeout(function () { root.innerHTML = ''; }, 250); }, 2600);
  }

  function openModal(innerHtml, opts) {
    opts = opts || {};
    var root = el('modal-root');
    if (!root) return;
    root.innerHTML = '<div class="rr-modal-overlay" data-close="' + (opts.dismissible === false ? 'false' : 'true') + '"><div class="rr-modal ' + (opts.wide ? 'rr-modal--wide' : '') + '" role="dialog" aria-modal="true">' + innerHtml + '</div></div>';
    root.classList.add('is-open');
    var overlay = root.querySelector('.rr-modal-overlay');
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay && overlay.getAttribute('data-close') === 'true') closeModal(); });
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
    openModal('<div class="rr-confirm"><p class="rr-confirm__message">' + escapeHtml(message) + '</p><div class="rr-confirm__actions"><button type="button" class="rr-btn rr-btn--ghost" data-action="confirm-cancel">キャンセル</button><button type="button" class="rr-btn ' + okClass + '" data-action="confirm-ok">' + escapeHtml(okLabel) + '</button></div></div>');
    document.querySelector('[data-action="confirm-cancel"]').addEventListener('click', closeModal);
    document.querySelector('[data-action="confirm-ok"]').addEventListener('click', function () { closeModal(); onConfirm(); });
  }

  function showAchievement(message) {
    var root = el('toast-root');
    if (!root) return;
    root.innerHTML = '<div class="rr-toast rr-toast--achievement"><span aria-hidden="true">✨</span><div class="rr-toast__text">' + escapeHtml(message) + '</div></div>';
    var toastEl = root.querySelector('.rr-toast');
    requestAnimationFrame(function () { toastEl.classList.add('is-visible'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); setTimeout(function () { root.innerHTML = ''; }, 250); }, 3400);
  }

  var MOODS = [
    { key: 'excited', label: 'わくわく', emoji: '😊', bg: '#dcae2b', ink: '#2b2118' },
    { key: 'thrill', label: 'ドキドキ', emoji: '😳', bg: '#d85d62', ink: '#fff' },
    { key: 'funny', label: 'おもしろい', emoji: '😂', bg: '#e58a37', ink: '#fff' },
    { key: 'moving', label: 'しんみり', emoji: '🥹', bg: '#5f83b5', ink: '#fff' },
    { key: 'surprised', label: 'びっくり', emoji: '😮', bg: '#4ca1b5', ink: '#fff' },
    { key: 'understood', label: 'なるほど', emoji: '🤔', bg: '#5e9a72', ink: '#fff' },
    { key: 'liked', label: 'すき', emoji: '😍', bg: '#8268a8', ink: '#fff' },
    { key: 'difficult', label: 'ちょっとむずかしい', emoji: '🧐', bg: '#78818b', ink: '#fff' }
  ];

  var FALLBACK_COLORS = [
    { bg: '#d95f59', ink: '#fff' }, { bg: '#4f83b8', ink: '#fff' },
    { bg: '#5c9b72', ink: '#fff' }, { bg: '#d5a83d', ink: '#2b2118' },
    { bg: '#8267a8', ink: '#fff' }, { bg: '#d47b43', ink: '#fff' },
    { bg: '#3f8f88', ink: '#fff' }
  ];

  function getMood(key) {
    return MOODS.find(function (m) { return m.key === key; }) || null;
  }

  function fallbackColor(book) {
    var mood = getMood(book && book.mood);
    if (mood) return mood;
    var source = String((book && (book.id || book.title)) || 'book');
    var hash = 0;
    for (var i = 0; i < source.length; i++) hash = ((hash << 5) - hash) + source.charCodeAt(i) | 0;
    return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
  }

  function moodLabel(key) {
    var mood = getMood(key);
    return mood ? mood.emoji + ' ' + mood.label : '';
  }

  function moodChoicesHtml(selected) {
    return '<div class="rr-mood-choices" role="group" aria-label="この本の感想">' +
      MOODS.map(function (m) {
        var active = selected === m.key ? ' is-selected' : '';
        return '<button type="button" class="rr-mood-choice' + active + '" data-mood="' + m.key + '" style="--mood-bg:' + m.bg + ';--mood-ink:' + m.ink + ';">' +
          '<span class="rr-mood-choice__emoji" aria-hidden="true">' + m.emoji + '</span>' +
          '<span class="rr-mood-choice__label">' + escapeHtml(m.label) + '</span>' +
        '</button>';
      }).join('') +
    '</div>';
  }

  function fallbackTitleHtml(book, hidden) {
    var display = hidden ? 'none' : 'block';
    return '<span class="rr-cover__fallback-title" style="display:' + display + ';width:100%;padding:18px 10px 10px;text-align:center;font-size:.78rem;font-weight:800;line-height:1.45;max-height:6.3em;overflow:hidden;word-break:break-word;">' + escapeHtml(book && book.title ? book.title : 'タイトルなし') + '</span>';
  }

  function fallbackCoverHtml(book, sizeClass, favMark) {
    var color = fallbackColor(book);
    return '<div class="rr-cover rr-cover--fallback ' + sizeClass + '" style="background:' + color.bg + ';color:' + color.ink + ';">' + favMark + fallbackTitleHtml(book, false) + '</div>';
  }

  function coverHtml(book, opts) {
    opts = opts || {};
    var sizeClass = opts.sizeClass || '';
    var favMark = book.isFavorite ? '<span class="rr-cover__fav" aria-hidden="true">★</span>' : '';
    var color = fallbackColor(book);

    if (book.coverSource === 'api' && book.coverUrl) {
      return '<div class="rr-cover ' + sizeClass + ' rr-cover--has-image">' + favMark +
        '<img src="' + escapeHtml(book.coverUrl) + '" alt="" loading="lazy" ' +
        'onerror="var c=this.parentElement;c.style.background=\'' + color.bg + '\';c.style.color=\'' + color.ink + '\';c.classList.add(\'rr-cover--fallback\');var t=c.parentElement&&c.parentElement.querySelector(\'.rr-book-card__title\');if(t)t.style.display=\'none\';this.style.display=\'none\';this.nextElementSibling.style.display=\'block\';">' +
        fallbackTitleHtml(book, true) +
      '</div>';
    }

    if (book.coverSource === 'user' && book.coverImageId) {
      return '<div class="rr-cover ' + sizeClass + ' rr-cover--pending" data-cover-source="user" data-cover-image-id="' + escapeHtml(book.coverImageId) +
        '" data-cover-title="' + escapeHtml(book.title || 'タイトルなし') + '" style="background:' + color.bg + ';color:' + color.ink + ';">' + favMark +
        '<span class="rr-cover__spinner" aria-hidden="true"></span></div>';
    }

    return fallbackCoverHtml(book, sizeClass, favMark);
  }

  function hydrateCovers(container) {
    if (!container) return;
    var pending = container.querySelectorAll('[data-cover-source="user"]');
    pending.forEach(function (elm) {
      var imageId = elm.getAttribute('data-cover-image-id');
      var title = elm.getAttribute('data-cover-title') || 'タイトルなし';
      global.RR.ImageStore.getImage(imageId).then(function (dataUrl) {
        if (!elm.isConnected) return;
        if (dataUrl) {
          var img = document.createElement('img');
          img.src = dataUrl;
          img.alt = '';
          elm.classList.remove('rr-cover--pending');
          var spinner = elm.querySelector('.rr-cover__spinner');
          if (spinner) spinner.remove();
          elm.insertBefore(img, elm.firstChild);
        } else {
          elm.classList.remove('rr-cover--pending');
          elm.classList.add('rr-cover--fallback');
          var color = fallbackColor({ id: elm.closest('.rr-book-card') ? elm.closest('.rr-book-card').getAttribute('data-id') : '', title: title });
          elm.style.background = color.bg;
          elm.style.color = color.ink;
          var spinner = elm.querySelector('.rr-cover__spinner');
          if (spinner) spinner.outerHTML = '<span class="rr-cover__fallback-title" style="display:block;width:100%;padding:18px 10px 10px;text-align:center;font-size:.78rem;font-weight:800;line-height:1.45;max-height:6.3em;overflow:hidden;word-break:break-word;">' + escapeHtml(title) + '</span>';
          var cardTitle = elm.parentElement && elm.parentElement.querySelector('.rr-book-card__title');
          if (cardTitle) cardTitle.style.display = 'none';
        }
      });
    });
  }

  global.RR = global.RR || {};
  global.RR.UICommon = {
    el: el, escapeHtml: escapeHtml, showToast: showToast, showAchievement: showAchievement,
    openModal: openModal, closeModal: closeModal, confirmDialog: confirmDialog,
    coverHtml: coverHtml, hydrateCovers: hydrateCovers, MOODS: MOODS, getMood: getMood,
    moodLabel: moodLabel, moodChoicesHtml: moodChoicesHtml, fallbackColor: fallbackColor
  };
})(window);
