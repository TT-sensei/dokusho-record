/* ============================================================
 * views/records.js
 * 登録した本の一覧。新しい記録を上に表示し、タップで詳細確認、
 * 削除もここから行う。
 * ============================================================ */
(function (global) {
  'use strict';
  var U = global.RR.UICommon;
  var S = global.RR.Stats;

  var searchText = '';

  function onEnter() { /* 検索文字は画面を離れてもそのまま保持してよい */ }

  function render(data) {
    var books = data.books.slice().sort(function (a, b) {
      return (b.readDate || '').localeCompare(a.readDate || '') || (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    var filtered = searchText
      ? books.filter(function (b) { return (b.title + b.author).toLowerCase().indexOf(searchText.toLowerCase()) !== -1; })
      : books;

    return (
      '<section class="rr-view rr-records">' +
        '<div class="rr-search">' +
          '<input type="search" id="rr-record-search" placeholder="🔍 タイトル・著者で検索" value="' + U.escapeHtml(searchText) + '">' +
        '</div>' +
        (filtered.length === 0
          ? '<p class="rr-empty">' + (books.length === 0 ? 'まだ記録がないよ。本を登録してみよう!' : '見つからなかったよ。') + '</p>'
          : '<div class="rr-record-list">' + filtered.map(renderCard).join('') + '</div>'
        ) +
      '</section>'
    );
  }

  function renderCard(book) {
    return (
      '<button type="button" class="rr-record-card" data-id="' + book.id + '">' +
        U.coverHtml(book.coverUrl, book.title, 'rr-cover--sm') +
        '<div class="rr-record-card__body">' +
          '<p class="rr-record-card__title">' + U.escapeHtml(book.title) + (book.isReread ? '<span class="rr-tag">再読</span>' : '') + '</p>' +
          (book.author ? '<p class="rr-record-card__author">' + U.escapeHtml(book.author) + '</p>' : '') +
          '<p class="rr-record-card__date">' + S.formatDateJp(book.readDate) + '</p>' +
          (book.memo ? '<p class="rr-record-card__memo">' + U.escapeHtml(book.memo) + '</p>' : '') +
        '</div>' +
      '</button>'
    );
  }

  function renderDetailModal(book) {
    return (
      '<div class="rr-detail">' +
        U.coverHtml(book.coverUrl, book.title, 'rr-cover--lg') +
        '<h2 class="rr-detail__title">' + U.escapeHtml(book.title) + (book.isReread ? '<span class="rr-tag">再読</span>' : '') + '</h2>' +
        (book.author ? '<p class="rr-detail__row">著者: ' + U.escapeHtml(book.author) + '</p>' : '') +
        (book.publisher ? '<p class="rr-detail__row">出版社: ' + U.escapeHtml(book.publisher) + '</p>' : '') +
        (book.isbn ? '<p class="rr-detail__row">ISBN: ' + U.escapeHtml(book.isbn) + '</p>' : '') +
        '<p class="rr-detail__row">読んだ日: ' + S.formatDateJp(book.readDate) + '</p>' +
        (book.memo ? '<p class="rr-detail__memo">「' + U.escapeHtml(book.memo) + '」</p>' : '<p class="rr-detail__memo rr-detail__memo--empty">感想は記録されていません</p>') +
        '<div class="rr-detail__actions">' +
          '<button type="button" class="rr-btn rr-btn--ghost" data-action="detail-close">閉じる</button>' +
          '<button type="button" class="rr-btn rr-btn--danger" data-action="detail-delete" data-id="' + book.id + '">この記録を削除</button>' +
        '</div>' +
      '</div>'
    );
  }

  function bind(container, data, ctx) {
    var searchInput = container.querySelector('#rr-record-search');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        searchText = searchInput.value;
        ctx.rerenderCurrentView();
      });
    }

    container.querySelectorAll('.rr-record-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var id = card.getAttribute('data-id');
        var book = data.books.find(function (b) { return b.id === id; });
        if (!book) return;
        U.openModal(renderDetailModal(book));
        document.querySelector('[data-action="detail-close"]').addEventListener('click', U.closeModal);
        document.querySelector('[data-action="detail-delete"]').addEventListener('click', function () {
          U.closeModal();
          U.confirmDialog('この記録を削除しますか?', function () {
            ctx.actions.deleteBook(id);
          });
        });
      });
    });
  }

  global.RR = global.RR || {};
  global.RR.Views = global.RR.Views || {};
  global.RR.Views.records = { render: render, bind: bind, onEnter: onEnter };
})(window);
