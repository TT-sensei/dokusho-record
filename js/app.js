/* ============================================================
 * app.js
 * SPAのルーティング、状態(data)の保持、各画面からのアクションの
 * 受け口を担当する。
 * ============================================================ */
(function (global) {
  'use strict';

  var ROUTES = ['shelf', 'add', 'settings'];

  var Storage, Books, Backup, ImageStore, U, Views, RRStats;

  var state = { data: null, route: 'shelf' };

  function currentRouteFromHash() {
    var h = location.hash.replace(/^#\/?/, '');
    return ROUTES.indexOf(h) !== -1 ? h : 'shelf';
  }

  function onHashChange() {
    var newRoute = currentRouteFromHash();
    var prevView = Views[state.route];
    if (prevView && state.route !== newRoute && typeof prevView.onLeave === 'function') prevView.onLeave();
    state.route = newRoute;
    var nextView = Views[state.route];
    if (nextView && typeof nextView.onEnter === 'function') nextView.onEnter();
    renderCurrentView();
    updateNavActive();
  }

  function navigate(route) {
    var target = '#/' + route;
    if (location.hash === target) onHashChange();
    else location.hash = target;
  }

  function renderCurrentView() {
    var container = document.getElementById('app');
    var view = Views[state.route];
    if (!container || !view) return;
    container.innerHTML = view.render(state.data, ctx);
    if (typeof view.bind === 'function') view.bind(container, state.data, ctx);
  }

  function updateNavActive() {
    document.querySelectorAll('.rr-nav-btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-route') === state.route);
    });
  }

  function bindNav() {
    document.querySelectorAll('.rr-nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { navigate(btn.getAttribute('data-route')); });
    });
  }

  function checkGoalAchievement(beforeBooks, afterBooks) {
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth();
    var beforeMonth = RRStats.countInMonth(beforeBooks, y, m);
    var afterMonth = RRStats.countInMonth(afterBooks, y, m);
    var beforeYear = RRStats.countInYear(beforeBooks, y);
    var afterYear = RRStats.countInYear(afterBooks, y);
    if (beforeMonth < state.data.settings.monthlyTarget && afterMonth >= state.data.settings.monthlyTarget) {
      setTimeout(function () { U.showAchievement('今月の目標を達成したよ'); }, 500);
    } else if (beforeYear < state.data.settings.annualTarget && afterYear >= state.data.settings.annualTarget) {
      setTimeout(function () { U.showAchievement('今年の目標を達成したよ'); }, 500);
    }
  }

  function registerBook(input) {
    var beforeBooks = state.data.books.slice();
    var book = Books.addBook(state.data, input);
    afterRegister(beforeBooks, book);
  }

  function registerBookWithPhoto(input) {
    var beforeBooks = state.data.books.slice();
    var imageId = Storage.generateId(input.isbn || 'photo');
    ImageStore.saveImage(imageId, input._previewDataUrl).then(function () {
      var bookInput = Object.assign({}, input, { coverSource: 'user', coverImageId: imageId });
      delete bookInput._previewDataUrl;
      var book = Books.addBook(state.data, bookInput);
      afterRegister(beforeBooks, book);
    }).catch(function (err) {
      U.showToast('画像の保存に失敗したよ: ' + (err && err.message ? err.message : ''));
    });
  }

  function afterRegister(beforeBooks, book) {
    U.showToast('📚 「' + book.title + '」を本棚に追加したよ');
    Views.shelf.setHighlight(book.id);
    navigate('shelf');
    checkGoalAchievement(beforeBooks, state.data.books);
  }

  function toggleFavoriteAction(id) {
    Books.toggleFavorite(state.data, id);
  }

  function updateBookAction(id, changes) {
    Books.updateBook(state.data, id, changes);
    renderCurrentView();
  }

  function setMoodAction(id, mood) {
    if (!U.getMood(mood)) return;
    Books.updateBook(state.data, id, { mood: mood });
    U.showToast('感想を記録したよ');
  }

  function deleteBookAction(id) {
    var book = state.data.books.find(function (b) { return b.id === id; });
    Books.deleteBook(state.data, id);
    if (book && book.coverSource === 'user' && book.coverImageId) {
      ImageStore.deleteImage(book.coverImageId);
    }
    renderCurrentView();
    U.showToast('本棚から削除したよ');
  }

  function saveSettingsAction(settings) {
    state.data.settings.annualTarget = settings.annualTarget;
    state.data.settings.monthlyTarget = settings.monthlyTarget;
    Storage.save(state.data);
  }

  function exportDataAction(includeImages) {
    Backup.exportData(state.data, includeImages).then(function () {
      U.showToast('バックアップを保存したよ');
    }).catch(function (err) {
      U.showToast('バックアップに失敗したよ: ' + (err && err.message ? err.message : ''));
    });
  }

  function importDataAction(file) {
    Backup.importData(file).then(function (result) {
      state.data = result.data;
      Storage.save(state.data);
      var restoreImages = result.images
        ? Promise.all(Object.keys(result.images).map(function (id) { return ImageStore.saveImage(id, result.images[id]); }))
        : Promise.resolve();
      return restoreImages;
    }).then(function () {
      navigate('shelf');
      renderCurrentView();
      U.showToast('データを復元したよ');
    }).catch(function (err) {
      U.showToast('復元に失敗したよ: ' + err.message);
    });
  }

  var ctx = {
    navigate: navigate,
    rerenderCurrentView: renderCurrentView,
    actions: {
      registerBook: registerBook,
      registerBookWithPhoto: registerBookWithPhoto,
      toggleFavorite: toggleFavoriteAction,
      updateBook: updateBookAction,
      setMood: setMoodAction,
      deleteBook: deleteBookAction,
      saveSettings: saveSettingsAction,
      exportData: exportDataAction,
      importData: importDataAction
    }
  };

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').catch(function () {});
      });
    }
  }

  function init() {
    Storage = global.RR.Storage;
    Books = global.RR.Books;
    Backup = global.RR.Backup;
    ImageStore = global.RR.ImageStore;
    U = global.RR.UICommon;
    Views = global.RR.Views;
    RRStats = global.RR.Stats;

    state.data = Storage.load();

    bindNav();
    window.addEventListener('hashchange', onHashChange);
    onHashChange();
    registerServiceWorker();
  }

  document.addEventListener('DOMContentLoaded', init);

  global.RR = global.RR || {};
  global.RR.App = { navigate: navigate };
})(window);
