/* ============================================================
 * app.js
 * SPAのルーティング、状態(data)の保持、各画面からのアクションの
 * 受け口を担当する。
 * ============================================================ */
(function (global) {
  'use strict';

  var ROUTES = ['shelf', 'add', 'badges', 'settings'];

  var Storage, Books, Backup, ImageStore, U, Views, RRStats, Badges;
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
    renderCurrentView(); updateNavActive();
  }
  function navigate(route) {
    var target = '#/' + route;
    if (location.hash === target) onHashChange(); else location.hash = target;
  }
  function renderCurrentView() {
    var container = document.getElementById('app');
    var view = Views[state.route];
    if (!container || !view) return;
    container.innerHTML = view.render(state.data, ctx);
    if (typeof view.bind === 'function') view.bind(container, state.data, ctx);
    if (state.route === 'shelf' && global.RR.Navi) {
      var shelf = container.querySelector('.rr-shelf');
      if (shelf && !shelf.querySelector('.rr-navi-corner')) shelf.insertAdjacentHTML('afterbegin', '<div class="rr-navi-corner">' + global.RR.Navi.shelfHtml() + '</div>');
    }
  }
  function updateNavActive() {
    document.querySelectorAll('.rr-nav-btn').forEach(function (btn) { btn.classList.toggle('is-active', btn.getAttribute('data-route') === state.route); });
  }
  function bindNav() {
    document.querySelectorAll('.rr-nav-btn').forEach(function (btn) { btn.addEventListener('click', function () { navigate(btn.getAttribute('data-route')); }); });
  }

  function checkGoalAchievement(beforeBooks, afterBooks) {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    var beforeMonth = RRStats.countInMonth(beforeBooks, y, m), afterMonth = RRStats.countInMonth(afterBooks, y, m);
    var beforeYear = RRStats.countInYear(beforeBooks, y), afterYear = RRStats.countInYear(afterBooks, y);
    if (beforeMonth < state.data.settings.monthlyTarget && afterMonth >= state.data.settings.monthlyTarget) {
      setTimeout(function () { U.showAchievement('今月の目標を達成したよ'); }, 500);
    } else if (beforeYear < state.data.settings.annualTarget && afterYear >= state.data.settings.annualTarget) {
      setTimeout(function () { U.showAchievement('今年の目標を達成したよ'); }, 500);
    }
  }

  function checkBadgeAchievement(beforeBooks, afterBooks) {
    if (!Badges) return;
    var before = { books: beforeBooks }, after = { books: afterBooks };
    var beforeMilestones = Badges.earnedMilestones(before);
    var afterMilestones = Badges.earnedMilestones(after);
    var beforeAchievements = Badges.earnedAchievements(before);
    var afterAchievements = Badges.earnedAchievements(after);
    var beforeIds = {}, newNames = [];
    beforeMilestones.forEach(function (b) { beforeIds['m:' + b.count] = true; });
    beforeAchievements.forEach(function (b) { beforeIds['a:' + b.id] = true; });
    afterMilestones.forEach(function (b) {
      if (!beforeIds['m:' + b.count]) newNames.push(b.count + '冊「' + b.name + '」');
    });
    afterAchievements.forEach(function (b) {
      if (!beforeIds['a:' + b.id]) newNames.push('「' + b.name + '」');
    });
    if (newNames.length) {
      setTimeout(function () { U.showAchievement('🏅 バッジをゲット！ ' + newNames.slice(0, 3).join('・')); }, 650);
    }
  }

  function registerBook(input) {
    var beforeBooks = state.data.books.slice();
    var book = Books.addBook(state.data, input);
    if (!book) { U.showToast('保存できなかったよ。端末の空き容量を確認してね'); return; }
    afterRegister(beforeBooks, book);
  }
  function registerBookWithPhoto(input) {
    var beforeBooks = state.data.books.slice();
    var imageId = Storage.generateId(input.isbn || 'photo');
    ImageStore.saveImageFromDataUrl(imageId, input._previewDataUrl).then(function () {
      var bookInput = Object.assign({}, input, { coverSource: 'user', coverImageId: imageId });
      delete bookInput._previewDataUrl;
      var book = Books.addBook(state.data, bookInput);
      if (!book) {
        ImageStore.deleteImage(imageId);
        U.showToast('本棚に保存できなかったよ。端末の空き容量を確認してね');
        return;
      }
      afterRegister(beforeBooks, book);
    }).catch(function (err) { U.showToast('画像の保存に失敗したよ: ' + (err && err.message ? err.message : '')); });
  }
  function afterRegister(beforeBooks, book) {
    U.showToast('📚 「' + book.title + '」を本棚に追加したよ'); Views.shelf.setHighlight(book.id); showPostRegister(book.id, beforeBooks);
  }
  function showPostRegister(bookId, beforeBooks) {
    var book = state.data.books.find(function (b) { return b.id === bookId; });
    if (!book) { navigate('shelf'); return; }
    var moodHtml = U.moodChoicesHtml(book.mood || '');
    var naviHtml = global.RR.Navi ? global.RR.Navi.registeredHtml(book.title) : '';
    var html = '<div class="rr-post-register">' + naviHtml +
      '<div class="rr-post-register__section"><p class="rr-post-register__label">この本、どんな感じだった？</p>' + moodHtml + '</div>' +
      '<p class="rr-post-register__note">表紙はあとから本の詳細画面で追加できます。</p>' +
      '<button type="button" class="rr-btn rr-btn--cta" data-post-done>本棚を見る</button></div>';
    var modal = U.openModal(html, { wide: true });
    if (!modal) { navigate('shelf'); return; }
    modal.querySelectorAll('[data-mood]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        Books.updateBook(state.data, bookId, { mood: btn.getAttribute('data-mood') });
        modal.querySelectorAll('[data-mood]').forEach(function (b) { b.classList.toggle('is-selected', b === btn); });
        U.showToast('感想を記録したよ');
      });
    });
    modal.querySelector('[data-post-done]').addEventListener('click', function () {
      U.closeModal(); navigate('shelf'); checkGoalAchievement(beforeBooks, state.data.books); checkBadgeAchievement(beforeBooks, state.data.books);
    });
  }
  function toggleFavoriteAction(id) {
    if (!Books.toggleFavorite(state.data, id)) U.showToast('保存できなかったよ。端末の空き容量を確認してね');
  }
  function updateBookAction(id, changes) {
    if (!Books.updateBook(state.data, id, changes)) U.showToast('保存できなかったよ。端末の空き容量を確認してね');
    renderCurrentView();
  }
  function setMoodAction(id, mood) {
    if (!U.getMood(mood)) return false;
    if (!Books.updateBook(state.data, id, { mood: mood })) {
      U.showToast('保存できなかったよ。端末の空き容量を確認してね');
      return false;
    }
    U.showToast('感想を記録したよ');
    return true;
  }
  function deleteBookAction(id) {
    var book = Books.deleteBook(state.data, id);
    if (!book) { U.showToast('削除を保存できなかったよ。端末の空き容量を確認してね'); return; }
    if (book.coverSource === 'user' && book.coverImageId) ImageStore.deleteImage(book.coverImageId);
    renderCurrentView(); U.showToast('本棚から削除したよ');
  }
  function saveSettingsAction(settings) {
    var previous = { annualTarget: state.data.settings.annualTarget, monthlyTarget: state.data.settings.monthlyTarget };
    state.data.settings.annualTarget = settings.annualTarget;
    state.data.settings.monthlyTarget = settings.monthlyTarget;
    if (!Storage.save(state.data)) {
      state.data.settings.annualTarget = previous.annualTarget;
      state.data.settings.monthlyTarget = previous.monthlyTarget;
      U.showToast('設定を保存できなかったよ。端末の空き容量を確認してね');
      return false;
    }
    return true;
  }
  function exportDataAction(includeImages) { Backup.exportData(state.data, includeImages).then(function () { U.showToast('バックアップを保存したよ'); }).catch(function (err) { U.showToast('バックアップに失敗したよ: ' + (err && err.message ? err.message : '')); }); }
  function importDataAction(file) {
    Backup.importData(file).then(function (result) {
      // 画像の復元が完了する前に本棚データを切り替えない。
      var restoreImages = result.images
        ? Promise.all(Object.keys(result.images).map(function (id) { return ImageStore.saveImage(id, result.images[id]); }))
        : Promise.resolve();
      return restoreImages.then(function () {
        if (!Storage.save(result.data)) {
          throw new Error('端末に保存できませんでした。空き容量を確認し、元のデータが残っているか確認してください');
        }
        state.data = result.data;
      });
    }).then(function () {
      navigate('shelf'); renderCurrentView(); U.showToast('データを復元したよ');
    }).catch(function (err) {
      U.showToast('復元に失敗したよ: ' + (err && err.message ? err.message : 'ファイルを確認してね'));
    });
  }
  var ctx = { navigate: navigate, rerenderCurrentView: renderCurrentView, actions: { registerBook: registerBook, registerBookWithPhoto: registerBookWithPhoto, toggleFavorite: toggleFavoriteAction, updateBook: updateBookAction, setMood: setMoodAction, deleteBook: deleteBookAction, saveSettings: saveSettingsAction, exportData: exportDataAction, importData: importDataAction } };
  function registerServiceWorker() { if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function () {}); }); }
  function init() {
    Storage = global.RR.Storage; Books = global.RR.Books; Backup = global.RR.Backup; ImageStore = global.RR.ImageStore; U = global.RR.UICommon; Views = global.RR.Views; RRStats = global.RR.Stats; Badges = global.RR.Badges;
    state.data = Storage.load(); bindNav(); window.addEventListener('hashchange', onHashChange); onHashChange(); registerServiceWorker();
  }
  document.addEventListener('DOMContentLoaded', init);
  global.RR = global.RR || {};
  global.RR.App = { navigate: navigate };
})(window);
