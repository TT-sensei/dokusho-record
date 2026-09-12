/* ============================================================
 * views/shelf.js
 * 本棚(マガジンラック)。アプリの主役は表紙のグリッドであり、
 * 冊数や目標はあくまで控えめな補足情報として上部に小さく置く。
 * ============================================================ */
(function (global) {
  'use strict';
  var U = global.RR.UICommon;
  var S = global.RR.Stats;
  var Books = global.RR.Books;

  var searchText = '';
  var activeFilter = 'all'; // all | favorite | thisMonth | thisYear
  var pendingHighlightId = null; // 登録直後の1件だけポップインさせる

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
        '<div class="rr-shelf-toolbar">' +
          '<input type="search" id="rr-shelf-search" class="rr-search-input" placeholder="🔍 タイトル・著者・ISBNで検索" value="' + U.escapeHtml(searchText) + '">' +
          '<div class="rr-filter-chips">' +
            FILTERS.map(function (f) {
              return '<button type="button" class="rr-chip' + (activeFilter === f.key ? ' is-active' : '') + '" data-filter="' + f.key + '">' + f.label + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +

        '<p class="rr-shelf-stats">今月 ' + monthCount + '冊・今年 ' + yearCount + '冊<span class="rr-shelf-stats__target"> (目標 ' + data.settings.annualTarget + '冊)</span></p>' +

        (books.length === 0 ? renderEmpty(data) : renderGrid(books)) +
      '</section>'
    );
  }

  function renderEmpty(data) {
    var hasAnyBooks = data.books.length > 0;
    return '<p class="rr-empty">' + (hasAnyBooks ? '見つからなかったよ。検索条件を変えてみてね。' : 'まだ本が並んでいないよ。最初の1冊を登録してみよう!') + '</p>';
  }

  function renderGrid(books) {
    return '<div class="rr-shelf-grid">' + books.map(renderCard).join('') + '</div>';
  }

  function renderCard(book) {
    var highlight = (book.id === pendingHighlightId) ? ' rr-book-card--new' : '';
    return (
      '<button type="button" class="rr-book-card' + highlight + '" data-id="' + book.id + '">' +
        U.coverHtml(book) +
        '<span class="rr-book-card__title">' + U.escapeHtml(book.title) + '</span>' +
      '</button>'
    );
  }

  function renderDetail(book) {
    return (
      '<div class="rr-detail">' +
        '<div class="rr-detail__cover">' + U.coverHtml(book, { sizeClass: 'rr-cover--lg' }) + '</div>' +
        '<h2 class="rr-detail__title">' + U.escapeHtml(book.title) + '</h2>' +
        (book.author ? '<p class="rr-detail__row">' + U.escapeHtml(book.author) + '</p>' : '') +
        '<div class="rr-detail__meta">' +
          (book.isbn ? '<span>ISBN: ' + U.escapeHtml(book.isbn) + '</span>' : '') +
          (book.pageCount ? '<span>' + book.pageCount + 'ページ</span>' : '') +
          (book.price ? '<span>' + book.price + '円</span>' : '') +
        '</div>' +
        '<p class="rr-detail__row">登録日: ' + S.formatDateJp(book.registeredDate) + '</p>' +
        '<p class="rr-detail__row">読了日: ' + S.formatDateJp(book.readDate) + '</p>' +
        (book.memo
          ? '<p class="rr-detail__memo">「' + U.escapeHtml(book.memo) + '」</p>'
          : '<p class="rr-detail__memo rr-detail__memo--empty">感想は記録されていません</p>') +
        '<div class="rr-detail__actions">' +
          '<button type="button" class="rr-btn rr-btn--favorite' + (book.isFavorite ? ' is-active' : '') + '" data-action="toggle-fav" data-id="' + book.id + '">' +
            (book.isFavorite ? '★ お気に入り済み' : '☆ お気に入りにする') +
          '</button>' +
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
        '<div class="rr-detail__actions">' +
          '<button type="button" class="rr-btn rr-btn--primary" data-action="save-edit" data-id="' + book.id + '">保存する</button>' +
          '<button type="button" class="rr-btn rr-btn--ghost" data-action="detail-close">キャンセル</button>' +
        '</div>' +
      '</div>'
    );
  }

  function openDetail(data, ctx, id) {
    var book = data.books.find(function (b) { return b.id === id; });
    if (!book) return;
    var modalEl = U.openModal(renderDetail(book), { wide: true });
    U.hydrateCovers(modalEl);
    document.querySelector('[data-action="detail-close"]').addEventListener('click', U.closeModal);
    document.querySelector('[data-action="toggle-fav"]').addEventListener('click', function () {
      ctx.actions.toggleFavorite(id);
      openDetail(data, ctx, id); // お気に入り状態を反映して開き直す
    });
    document.querySelector('[data-action="edit-book"]').addEventListener('click', function () {
      var editModal = U.openModal(renderEditForm(book));
      document.querySelector('[data-action="detail-close"]').addEventListener('click', U.closeModal);
      document.querySelector('[data-action="save-edit"]').addEventListener('click', function () {
        var changes = {
          title: document.getElementById('rr-edit-title').value.trim() || book.title,
          author: document.getElementById('rr-edit-author').value.trim(),
          readDate: document.getElementById('rr-edit-date').value || book.readDate,
          memo: document.getElementById('rr-edit-memo').value.trim()
        };
        ctx.actions.updateBook(id, changes);
        U.closeModal();
        U.showToast('編集を保存したよ');
      });
    });
    document.querySelector('[data-action="delete-book"]').addEventListener('click', function () {
      U.closeModal();
      U.confirmDialog('「' + book.title + '」を本棚から削除しますか?', function () {
        ctx.actions.deleteBook(id);
      });
    });
  }

  function bind(container, data, ctx) {
    var searchInput = container.querySelector('#rr-shelf-search');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        searchText = searchInput.value;
        ctx.rerenderCurrentView();
        var again = document.getElementById('rr-shelf-search');
        if (again) { again.focus(); again.selectionStart = again.selectionEnd = again.value.length; }
      });
    }

    container.querySelectorAll('[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeFilter = btn.getAttribute('data-filter');
        ctx.rerenderCurrentView();
      });
    });

    container.querySelectorAll('.rr-book-card').forEach(function (card) {
      card.addEventListener('click', function () { openDetail(data, ctx, card.getAttribute('data-id')); });
    });

    U.hydrateCovers(container);

    // ポップイン演出は一度表示したらリセットする(再描画のたびに繰り返さない)
    if (pendingHighlightId) {
      var justAdded = pendingHighlightId;
      pendingHighlightId = null;
      setTimeout(function () {
        var cardEl = container.querySelector('[data-id="' + justAdded + '"]');
        if (cardEl) cardEl.classList.remove('rr-book-card--new');
      }, 700);
    }
  }

  global.RR = global.RR || {};
  global.RR.Views = global.RR.Views || {};
  global.RR.Views.shelf = { render: render, bind: bind, setHighlight: setHighlight };
})(window);
