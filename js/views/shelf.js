/* ============================================================
 * views/shelf.js
 * 本棚画面。表紙表示 / 背表紙表示を切り替えられる。
 * 本ごとの簡単な感想を記録し、感想に応じた色で表示する。
 * ============================================================ */
(function (global) {
  'use strict';
  var U = global.RR.UICommon;
  var S = global.RR.Stats;
  var Books = global.RR.Books;
  var Camera = global.RR.Camera;
  var ImageStore = global.RR.ImageStore;
  var Storage = global.RR.Storage;

  var searchText = '';
  var activeFilter = 'all';
  var pendingHighlightId = null;
  var viewMode = loadViewMode();

  function loadViewMode() {
    try { return localStorage.getItem('rr-shelf-view') === 'spine' ? 'spine' : 'cover'; }
    catch (e) { return 'cover'; }
  }

  function saveViewMode(mode) {
    viewMode = mode === 'spine' ? 'spine' : 'cover';
    try { localStorage.setItem('rr-shelf-view', viewMode); } catch (e) {}
  }

  function setHighlight(id) { pendingHighlightId = id; }

  var FILTERS = [
    { key: 'all', label: 'すべて' },
    { key: 'favorite', label: 'お気に入り' },
    { key: 'thisMonth', label: '今月' },
    { key: 'thisYear', label: '今年' }
  ];

  function render(data) {
    var now = new Date();
    var monthCount = S.countInMonth(data.books, now.getFullYear(), now.getMonth());
    var yearCount = S.countInYear(data.books, now.getFullYear());
    var filtered = Books.searchBooks(Books.filterBooks(data.books, activeFilter), searchText);
    var books = Books.sortedNewestFirst(filtered);
    return (
      '<section class="rr-view rr-shelf">' +
        '<div class="rr-shelf-heading">' +
          '<div><p class="rr-shelf-eyebrow">MY READING SHELF</p><h1 class="rr-shelf-title">読んだ本を、ここに。</h1>' +
          '<p class="rr-shelf-subtitle">一冊ずつ、読書の記録を積み重ねよう。</p></div>' +
          '<div class="rr-shelf-total" aria-label="登録した本 ' + data.books.length + '冊"><strong>' + data.books.length + '</strong><span>冊</span></div>' +
        '</div>' +
        '<div class="rr-shelf-toolbar">' +
          '<input type="search" id="rr-shelf-search" class="rr-search-input" placeholder="タイトル・著者・ISBNで検索" aria-label="本棚を検索" value="' + U.escapeHtml(searchText) + '">' +
          '<div class="rr-shelf-controls">' +
            '<div class="rr-filter-chips" role="group" aria-label="本棚の絞り込み">' +
              FILTERS.map(function (f) {
                return '<button type="button" class="rr-chip' + (activeFilter === f.key ? ' is-active' : '') + '" data-filter="' + f.key + '">' + f.label + '</button>';
              }).join('') +
            '</div>' +
            '<div class="rr-shelf-view-toggle" role="group" aria-label="本棚の表示方法">' +
              '<button type="button" class="rr-chip' + (viewMode === 'cover' ? ' is-active' : '') + '" data-view-mode="cover" aria-pressed="' + (viewMode === 'cover') + '">表紙</button>' +
              '<button type="button" class="rr-chip' + (viewMode === 'spine' ? ' is-active' : '') + '" data-view-mode="spine" aria-pressed="' + (viewMode === 'spine') + '">背表紙</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="rr-shelf-stats" aria-live="polite"><span>今月 <strong>' + monthCount + '</strong>冊</span><span>今年 <strong>' + yearCount + '</strong>冊</span><span class="rr-shelf-stats__target">年間目標 ' + data.settings.annualTarget + '冊</span></div>' +
        (books.length === 0 ? renderEmpty(data) : renderGrid(books)) +
      '</section>'
    );
  }

  function renderEmpty(data) {
    var hasAnyBooks = data.books.length > 0;
    return '<p class="rr-empty">' + (hasAnyBooks ? '見つからなかったよ。検索条件を変えてみてね。' : 'まだ本が並んでいないよ。最初の1冊を登録してみよう!') + '</p>';
  }

  function renderGrid(books) {
    if (viewMode === 'spine') {
      return '<div class="rr-shelf-grid rr-shelf-grid--spine">' + books.map(renderSpineCard).join('') + '</div>';
    }
    return '<div class="rr-shelf-grid">' + books.map(renderCard).join('') + '</div>';
  }

  function renderCard(book) {
    var highlight = (book.id === pendingHighlightId) ? ' rr-book-card--new' : '';
    var fallback = (!book.coverUrl || book.coverSource === 'none') && book.coverSource !== 'user';
    return '<button type="button" class="rr-book-card' + highlight + (fallback ? ' rr-book-card--fallback' : '') + '" data-id="' + book.id + '">' + U.coverHtml(book) + '<span class="rr-book-card__title">' + U.escapeHtml(book.title) + '</span></button>';
  }

  function renderSpineCard(book) {
    var color = U.fallbackColor(book);
    var mood = U.moodLabel(book.mood);
    var highlight = (book.id === pendingHighlightId) ? ' rr-spine-book--new' : '';
    var fav = book.isFavorite ? '<span class="rr-spine-favorite" aria-hidden="true">★</span>' : '';
    var style = '--spine-bg:' + color.bg + ';--spine-ink:' + color.ink + ';';
    return '<button type="button" class="rr-spine-book' + highlight + '" data-id="' + book.id + '" title="' + U.escapeHtml((book.title || '') + (mood ? ' / ' + mood : '')) + '" style="' + style + '">' +
      fav + '<span class="rr-spine-title">' + U.escapeHtml(book.title || 'タイトルなし') + '</span>' +
      '<span class="rr-spine-date">' + U.escapeHtml((book.readDate || '').slice(5).replace('-', '/')) + '</span>' +
    '</button>';
  }

  function renderMoodSection(book) {
    return '<section class="rr-mood-section" style="margin:20px 0 10px;">' +
      '<p style="margin:0 0 10px;font-weight:800;">この本、どんな感じだった？</p>' +
      U.moodChoicesHtml(book.mood) +
      '<p style="margin:8px 0 0;font-size:.82rem;opacity:.7;">' + (book.mood ? U.moodLabel(book.mood) + ' を選択中' : 'まだ選んでいないよ') + '</p>' +
    '</section>';
  }

  function renderDetail(book) {
    return (
      '<div class="rr-detail">' +
        '<div class="rr-detail__cover">' + U.coverHtml(book, { sizeClass: 'rr-cover--lg' }) + '</div>' +
        '<h2 class="rr-detail__title">' + U.escapeHtml(book.title) + '</h2>' +
        (book.author ? '<p class="rr-detail__row">' + U.escapeHtml(book.author) + '</p>' : '') +
        '<p class="rr-detail__row">登録日: ' + S.formatDateJp(book.registeredDate) + '</p>' +
        '<p class="rr-detail__row">読了日: ' + S.formatDateJp(book.readDate) + '</p>' +
        renderMoodSection(book) +
        (book.memo ? '<p class="rr-detail__memo">「' + U.escapeHtml(book.memo) + '」</p>' : '<p class="rr-detail__memo rr-detail__memo--empty">ひとこと感想はまだ書いていません</p>') +
        '<div class="rr-detail__actions">' +
          '<button type="button" class="rr-btn rr-btn--favorite' + (book.isFavorite ? ' is-active' : '') + '" data-action="toggle-fav" data-id="' + book.id + '">' + (book.isFavorite ? '★ お気に入り済み' : '☆ お気に入りにする') + '</button>' +
          '<button type="button" class="rr-btn rr-btn--secondary" data-action="change-cover" data-id="' + book.id + '">📷 表紙を追加・変更</button>' +
          '<button type="button" class="rr-btn rr-btn--ghost" data-action="edit-book" data-id="' + book.id + '">編集する</button>' +
          '<button type="button" class="rr-btn rr-btn--ghost" data-action="detail-close">閉じる</button>' +
          '<button type="button" class="rr-btn rr-btn--danger" data-action="delete-book" data-id="' + book.id + '">この本を削除</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderEditForm(book) {
    return (
      '<div class="rr-detail">' +
        '<h2 class="rr-detail__title">編集</h2>' +
        '<label class="rr-field"><span>タイトル</span><input type="text" id="rr-edit-title" value="' + U.escapeHtml(book.title) + '"></label>' +
        '<label class="rr-field"><span>著者</span><input type="text" id="rr-edit-author" value="' + U.escapeHtml(book.author) + '"></label>' +
        '<label class="rr-field"><span>読了日</span><input type="date" id="rr-edit-date" value="' + book.readDate + '" max="' + S.todayStr() + '"></label>' +
        '<label class="rr-field"><span>ひとこと感想</span><textarea id="rr-edit-memo" maxlength="300">' + U.escapeHtml(book.memo) + '</textarea></label>' +
        '<div class="rr-detail__actions"><button type="button" class="rr-btn rr-btn--primary" data-action="save-edit" data-id="' + book.id + '">保存する</button><button type="button" class="rr-btn rr-btn--ghost" data-action="detail-close">キャンセル</button></div>' +
      '</div>'
    );
  }

  function changeCover(data, id, useCamera) {
    var book = data.books.find(function (b) { return b.id === id; });
    if (!book) return;
    Camera.pickImage(useCamera).then(function (file) {
      if (!file) return;
      return ImageStore.fileToCompressedDataUrl(file).then(function (dataUrl) {
        var imageId = Storage.generateId((book.isbn || 'photo') + '-cover');
        return ImageStore.saveImage(imageId, dataUrl).then(function () {
          var oldImageId = book.coverSource === 'user' ? book.coverImageId : '';
          Books.updateBook(data, id, { coverSource: 'user', coverImageId: imageId, coverUrl: '' });
          if (oldImageId && oldImageId !== imageId) ImageStore.deleteImage(oldImageId);
          U.closeModal();
          if (lastCtx) lastCtx.rerenderCurrentView();
          U.showToast('表紙を更新したよ');
        });
      });
    }).catch(function (err) {
      U.showToast('表紙の保存に失敗したよ: ' + (err && err.message ? err.message : ''));
    });
  }

  var lastCtx = null;

  function openDetail(data, ctx, id) {
    var book = data.books.find(function (b) { return b.id === id; });
    if (!book) return;
    lastCtx = ctx;
    var modalEl = U.openModal(renderDetail(book), { wide: true });
    U.hydrateCovers(modalEl);
    var close = modalEl.querySelector('[data-action="detail-close"]');
    if (close) close.addEventListener('click', U.closeModal);
    modalEl.querySelectorAll('[data-mood]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var saved = ctx.actions.setMood(id, btn.getAttribute('data-mood'));
        U.closeModal();
        openDetail(data, ctx, id);
        ctx.rerenderCurrentView();
        if (saved) U.showToast('感想を記録したよ');
      });
    });
    var fav = modalEl.querySelector('[data-action="toggle-fav"]');
    if (fav) fav.addEventListener('click', function () { ctx.actions.toggleFavorite(id); U.closeModal(); openDetail(data, ctx, id); });
    var coverBtn = modalEl.querySelector('[data-action="change-cover"]');
    if (coverBtn) coverBtn.addEventListener('click', function () {
      var choiceModal = U.openModal(
        '<div class="rr-detail"><h2 class="rr-detail__title">表紙を追加・変更</h2>' +
        '<p class="rr-hint">表紙はいつでも追加できます。</p>' +
        '<div class="rr-detail__actions">' +
        '<button type="button" class="rr-btn rr-btn--primary" data-cover-choice="camera">📷 カメラで撮る</button>' +
        '<button type="button" class="rr-btn rr-btn--secondary" data-cover-choice="library">🖼 写真から選ぶ</button>' +
        '<button type="button" class="rr-btn rr-btn--ghost" data-action="detail-close">キャンセル</button>' +
        '</div></div>'
      );
      if (!choiceModal) return;
      choiceModal.querySelectorAll('[data-cover-choice]').forEach(function (choice) {
        choice.addEventListener('click', function () {
          var useCamera = choice.getAttribute('data-cover-choice') === 'camera';
          U.closeModal();
          changeCover(data, id, useCamera);
        });
      });
      var cancel = choiceModal.querySelector('[data-action="detail-close"]');
      if (cancel) cancel.addEventListener('click', U.closeModal);
    });
    var editBtn = modalEl.querySelector('[data-action="edit-book"]');
    if (editBtn) editBtn.addEventListener('click', function () {
      U.closeModal();
      var editModal = U.openModal(renderEditForm(book));
      var editClose = editModal.querySelector('[data-action="detail-close"]');
      if (editClose) editClose.addEventListener('click', U.closeModal);
      var save = editModal.querySelector('[data-action="save-edit"]');
      if (save) save.addEventListener('click', function () {
        var saved = ctx.actions.updateBook(id, {
          title: document.getElementById('rr-edit-title').value.trim() || book.title,
          author: document.getElementById('rr-edit-author').value.trim(),
          readDate: document.getElementById('rr-edit-date').value || book.readDate,
          memo: document.getElementById('rr-edit-memo').value.trim()
        });
        U.closeModal();
        if (saved) U.showToast('編集を保存したよ');
      });
    });
    var del = modalEl.querySelector('[data-action="delete-book"]');
    if (del) del.addEventListener('click', function () {
      U.closeModal();
      U.confirmDialog('「' + book.title + '」を本棚から削除しますか?', function () { ctx.actions.deleteBook(id); });
    });
  }

  function bind(container, data, ctx) {
    lastCtx = ctx;
    var searchInput = container.querySelector('#rr-shelf-search');
    if (searchInput) searchInput.addEventListener('input', function () {
      searchText = searchInput.value;
      ctx.rerenderCurrentView();
      var again = document.getElementById('rr-shelf-search');
      if (again) { again.focus(); again.selectionStart = again.selectionEnd = again.value.length; }
    });
    container.querySelectorAll('[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () { activeFilter = btn.getAttribute('data-filter'); ctx.rerenderCurrentView(); });
    });
    container.querySelectorAll('[data-view-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        saveViewMode(btn.getAttribute('data-view-mode'));
        ctx.rerenderCurrentView();
      });
    });
    container.querySelectorAll('.rr-book-card, .rr-spine-book').forEach(function (card) {
      card.addEventListener('click', function () { openDetail(data, ctx, card.getAttribute('data-id')); });
    });
    U.hydrateCovers(container);
    if (pendingHighlightId) {
      var justAdded = pendingHighlightId;
      pendingHighlightId = null;
      setTimeout(function () {
        var cardEl = container.querySelector('[data-id="' + justAdded + '"]');
        if (cardEl) cardEl.classList.remove('rr-book-card--new', 'rr-spine-book--new');
      }, 700);
    }
  }

  global.RR.Shelf = {
    render: render,
    bind: bind,
    setHighlight: setHighlight
  };
})(window);
