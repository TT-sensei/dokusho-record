/* ============================================================
 * app.js
 * SPAのルーティング、状態(data)の保持、各画面からのアクションの
 * 受け口(orchestration)を担当する。個々の描画ロジックは
 * js/views/*.js に、データ操作ロジックは storage/books/stats/badges
 * に委譲する。
 * ============================================================ */
(function (global) {
  'use strict';

  var ROUTES = ['home', 'add', 'records', 'stats', 'badges', 'settings'];

  var Storage, Books, Badges, Navi, Backup, U, Views, RRStats;

  var state = {
    data: null,
    route: 'home'
  };

  function currentRouteFromHash() {
    var h = location.hash.replace(/^#\/?/, '');
    return ROUTES.indexOf(h) !== -1 ? h : 'home';
  }

  function onHashChange() {
    var newRoute = currentRouteFromHash();
    var prevView = Views[state.route];
    if (prevView && state.route !== newRoute && typeof prevView.onLeave === 'function') {
      prevView.onLeave();
    }
    state.route = newRoute;
    var nextView = Views[state.route];
    if (nextView && typeof nextView.onEnter === 'function') {
      nextView.onEnter();
    }
    renderCurrentView();
    updateNavActive();
  }

  function navigate(route) {
    var target = '#/' + route;
    if (location.hash === target) {
      onHashChange();
    } else {
      location.hash = target;
    }
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

  /* ---------------- アクション(データを変更する処理) ---------------- */

  function submitBook(input) {
    var result = Books.addBook(state.data, input);
    if (result.status === 'error') {
      U.showToast(result.message);
      return;
    }
    if (result.status === 'duplicate') {
      showDuplicateModal(input, result.existing);
      return;
    }
    handleAddedResult(result, { isReread: false });
  }

  function showDuplicateModal(input, existing) {
    var html =
      '<div class="rr-duplicate">' +
        Navi.bubbleHtml('duplicate') +
        '<p class="rr-duplicate__existing">「' + U.escapeHtml(existing.title) + '」(' + RRStats.formatDateJp(existing.readDate) + ')</p>' +
        '<div class="rr-duplicate__actions">' +
          '<button type="button" class="rr-btn rr-btn--ghost" data-action="dup-cancel">別の本を探す</button>' +
          '<button type="button" class="rr-btn rr-btn--primary" data-action="dup-reread">もう一度読んだ</button>' +
        '</div>' +
      '</div>';
    U.openModal(html, { dismissible: true });
    document.querySelector('[data-action="dup-cancel"]').addEventListener('click', U.closeModal);
    document.querySelector('[data-action="dup-reread"]').addEventListener('click', function () {
      U.closeModal();
      var rereadInput = Object.assign({}, input, { forceAsReread: true });
      var result2 = Books.addBook(state.data, rereadInput);
      if (result2.status === 'added') handleAddedResult(result2, { isReread: true });
    });
  }

  function handleAddedResult(result, opts) {
    var sceneKey = opts.isReread ? 'reread' : 'register';
    U.showToast(Navi.SCENES[sceneKey].line.replace(/\n/g, ' '), { naviHtml: Navi.bubbleHtml(sceneKey) });
    navigate('home');

    var items = [];
    (result.newlyEarnedIds || []).forEach(function (id) {
      var def = Badges.byId(id);
      if (!def) return;
      items.push({
        naviScene: 'badge',
        title: '🎉 ' + def.count + '冊達成!',
        subtitle: def.name + ' GET!',
        iconHtml: '<img src="' + Badges.badgeIconUrl(def.icon) + '" alt="" style="width:96px;height:96px;object-fit:contain" onerror="this.style.display=\'none\'">'
      });
    });
    if (result.goal && result.goal.annualJustReached) {
      items.push({ naviScene: 'goalAnnual', title: '🎉 年間目標クリア!', subtitle: '今年の目標を達成しました' });
    }
    if (result.goal && result.goal.monthlyJustReached) {
      items.push({ naviScene: 'goalMonthly', title: '🎉 今月の目標クリア!' });
    }
    if (items.length > 0) {
      setTimeout(function () {
        U.showCelebrationQueue(items, function () { renderCurrentView(); });
      }, 450);
    }
  }

  function deleteBookAction(id) {
    Books.deleteBook(state.data, id);
    U.closeModal();
    renderCurrentView();
    U.showToast('記録を削除したよ');
  }

  function saveSettingsAction(settings) {
    state.data.settings.annualTarget = settings.annualTarget;
    state.data.settings.monthlyTarget = settings.monthlyTarget;
    Storage.save(state.data);
  }

  function exportDataAction() {
    Backup.exportData(state.data);
    U.showToast('バックアップを保存したよ');
  }

  function importDataAction(file) {
    Backup.importData(file).then(function (newData) {
      state.data = newData;
      Books.recomputeDerivedState(state.data);
      Storage.save(state.data);
      navigate('home');
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
      submitBook: submitBook,
      deleteBook: deleteBookAction,
      saveSettings: saveSettingsAction,
      exportData: exportDataAction,
      importData: importDataAction
    }
  };

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('./sw.js').catch(function () {
          // Service Worker非対応/失敗でも通常のWebアプリとして利用を継続する
        });
      });
    }
  }

  function init() {
    Storage = global.RR.Storage;
    Books = global.RR.Books;
    Badges = global.RR.Badges;
    Navi = global.RR.Navi;
    Backup = global.RR.Backup;
    U = global.RR.UICommon;
    Views = global.RR.Views;
    RRStats = global.RR.Stats;

    state.data = Storage.load();
    Books.recomputeDerivedState(state.data); // 復元直後のバッジ/連続記録のズレを補正
    Storage.save(state.data);

    bindNav();
    window.addEventListener('hashchange', onHashChange);
    onHashChange();
    registerServiceWorker();
  }

  document.addEventListener('DOMContentLoaded', init);

  global.RR = global.RR || {};
  global.RR.App = { navigate: navigate };
})(window);
