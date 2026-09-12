/* ============================================================
 * views/shelf.js
 * 本棚画面。表紙を主役に、検索・絞り込み・お気に入りを扱う。
 * ============================================================ */
(function (global) {
  'use strict';

  var U = global.RR.UICommon;
  var Books = global.RR.Books;
  var S = global.RR.Stats;

  var searchText = '';
  var filter = 'all';
  var highlightId = '';

  function setHighlight(id) {
    highlightId = id || '';
    setTimeout(function () {
      var el = document.querySelector('[data-book-id="' + cssEscape(highlightId) + '"]');
      if (el) {
        el.classList.add('rr-book-card--new');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function () { el.classList.remove('rr-book-card--new'); }, 900);
      }
    }, 50);
  }

  function cssEscape(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function render(data) {
    var books = Books.sortedNewestFirst(data.books || []);
    var filtered = Books.filterBooks(books, filter);
    filtered = Books.searchBooks(filtered, searchText);

    return (
      '<section class="rr-view rr-shelf-view">' +
        '<div class="rr-shelf-toolbar">' +
          '<input class="rr-search-input" id="rr-shelf-search" type="search" ' +
            'placeholder="🔍 タイトル・著者・ISBNで検索" value="' + U.escapeHtml(searchText) + '">' +
          '<div class="rr-filter-chips" role="group" aria-label="本の絞り込み">' +
            chip('all', 'すべて') +
            chip('favorite', 'お気に入り') +
            chip('thisMonth', '今月') +
            chip('thisYear', '今年') +
          '</div>' +
        '</div>' +

        '<p class="rr-shelf-stats">' + filtered.length + '冊' +
          '<span class="rr-shelf-stats__target"> ・ 読んだ本がここに並びます</span>' +
        '</p>' +

        (filtered.length === 0
          ? '<p class="rr-empty">' + emptyMessage(data) + '</p>'
          : '<div class="rr-shelf-grid">' + filtered.map(renderBookCard).join('') + '</div>'
        ) +
      '</section>'
    );
  }

  function chip(value, label) {
    return '<button type="button" class="rr-chip ' + (filter === value ? 'is-active' : '') +
      '" data-filter="' + value + '">' + label + '</button>';
  }

  function emptyMessage(data) {
    if (!(data.books || []).length) return 'まだ本がありません。本を登録してみよう。';
    if (searchText) return '検索に一致する本がありません。';
    return 'この条件に一致する本がありません。';
  }

  function renderBookCard(book) {
    var cardClass = highlightId === book.id ? ' rr-book-card--new' : '';
    return (
      '<button type="button" class="rr-book-card' + cardClass + '" data-book-id="' + U.escapeHtml(book.id) + '">' +
        U.coverHtml(book, { sizeClass: '' }) +
        '<span class="rr-book-card__title">' + U.escapeHtml(book.title || 'タイトル未入力') + '</span>' +
      '</button>'
    );
  }

  function renderDetail(book) {
    return (
      '<div class="rr-detail">' +
        U.coverHtml(book, { sizeClass: 'rr-cover--lg' }) +
        '<h2 class="rr-detail__title">' + U.escapeHtml(book.title || 'タイトル未入力') +
          (book.isFavorite ? '<span class="rr-tag">お気に入り</span>' : '') + '</h2>' +
        (book.author ? '<p class="rr-detail__row">著者: ' + U.escapeHtml(book.author) + '</p>' : '') +
        (book.isbn ? '<p class="rr-detail__row">ISBN: ' + U.escapeHtml(book.isbn) + '</p>' : '') +
        (book.pageCount ? '<p class="rr-detail__row">ページ数: ' + book.pageCount + 'ページ</p>' : '') +
        '<p class="rr-detail__row">読んだ日: ' + S.formatDateJp(book.readDate) + '</p>' +
        (book.memo ? '<p class="rr-detail__memo">「' + U.escapeHtml(book.memo) + '」</p>' : '') +
        '<div class="rr-detail__actions">' +
          '<button type="button" class="rr-btn rr-btn--ghost" data-action="detail-close">閉じる</button>' +
          '<button type="button" class="rr-btn rr-btn--favorite ' + (book.isFavorite ? 'is-active' : '') + '" data-action="detail-favorite">' +
            (book.isFavorite ? '★ お気に入りを外す' : '☆ お気に入りにする') +
          '</button>' +
          '<button type="button" class="rr-btn rr-btn--danger" data-action="detail-delete">この記録を削除</button>' +
        '</div>' +
      '</div>'
    );
  }

  function bind(container, data, ctx) {
    var searchInput = container.querySelector('#rr-shelf-search');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        searchText = searchInput.value;
        ctx.rerenderCurrentView();
        var next = document.getElementById('rr-shelf-search');
        if (next) {
          next.focus();
          try { next.setSelectionRange(next.value.length, next.value.length); } catch (e) {}
        }
      });
    }

    container.querySelectorAll('[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        filter = btn.getAttribute('data-filter') || 'all';
        ctx.rerenderCurrentView();
      });
    });

    container.querySelectorAll('.rr-book-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.getAttribute('data-book-id');
        var book = data.books.find(function (b) { return b.id === id; });
        if (!book) return;
        U.openModal(renderDetail(book), { wide: false });

        var close = document.querySelector('[data-action="detail-close"]');
        if (close) close.addEventListener('click', U.closeModal);

        var favorite = document.querySelector('[data-action="detail-favorite"]');
        if (favorite) favorite.addEventListener('click', function () {
          ctx.actions.toggleFavorite(id);
          U.closeModal();
          ctx.rerenderCurrentView();
        });

        var del = document.querySelector('[data-action="detail-delete"]');
        if (del) del.addEventListener('click', function () {
          U.closeModal();
          U.confirmDialog('この記録を削除しますか?', function () {
            ctx.actions.deleteBook(id);
          });
        });
      });
    });

    U.hydrateCovers(container);

    if (highlightId) {
      var highlighted = container.querySelector('[data-book-id="' + cssEscape(highlightId) + '"]');
      if (highlighted) {
        highlighted.classList.add('rr-book-card--new');
        setTimeout(function () { highlighted.classList.remove('rr-book-card--new'); }, 900);
      }
      highlightId = '';
    }
  }

  global.RR = global.RR || {};
  global.RR.Views = global.RR.Views || {};
  global.RR.Views.shelf = {
    render: render,
    bind: bind,
    setHighlight: setHighlight
  };
})(window);
