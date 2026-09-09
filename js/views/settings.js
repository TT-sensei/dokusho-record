/* ============================================================
 * views/settings.js
 * 年間/月間目標の設定と、JSONバックアップ・復元。
 * ============================================================ */
(function (global) {
  'use strict';
  var U = global.RR.UICommon;

  function render(data) {
    return (
      '<section class="rr-view rr-settings">' +
        '<div class="rr-card">' +
          '<p class="rr-card__label">目標設定</p>' +
          '<label class="rr-field">' +
            '<span>年間目標(冊)</span>' +
            '<input type="number" id="rr-set-annual" min="1" max="9999" value="' + data.settings.annualTarget + '">' +
          '</label>' +
          '<label class="rr-field">' +
            '<span>月間目標(冊)</span>' +
            '<input type="number" id="rr-set-monthly" min="1" max="999" value="' + data.settings.monthlyTarget + '">' +
          '</label>' +
          '<button type="button" class="rr-btn rr-btn--primary" data-action="save-settings">保存する</button>' +
          '<p class="rr-hint">目標を変更しても、過去の読書記録は変わりません。</p>' +
        '</div>' +

        '<div class="rr-card">' +
          '<p class="rr-card__label">データのバックアップ</p>' +
          '<p class="rr-hint">この端末・このブラウザだけに記録が保存されています。機種変更やデータ消去に備えて、ときどきバックアップを保存しておこう。</p>' +
          '<button type="button" class="rr-btn rr-btn--secondary" data-action="export">💾 データを保存</button>' +
          '<button type="button" class="rr-btn rr-btn--secondary" data-action="import-trigger">📂 データを復元</button>' +
          '<input type="file" id="rr-import-file" accept="application/json" hidden>' +
        '</div>' +

        '<div class="rr-card rr-card--muted">' +
          '<p class="rr-hint">📚 現在の記録: ' + data.books.length + '件(うち再読 ' + data.books.filter(function (b) { return b.isReread; }).length + '件)</p>' +
        '</div>' +
      '</section>'
    );
  }

  function bind(container, data, ctx) {
    var saveBtn = container.querySelector('[data-action="save-settings"]');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      var annual = parseInt(document.getElementById('rr-set-annual').value, 10);
      var monthly = parseInt(document.getElementById('rr-set-monthly').value, 10);
      if (!isFinite(annual) || annual < 1 || !isFinite(monthly) || monthly < 1) {
        U.showToast('1以上の数字を入力してね');
        return;
      }
      ctx.actions.saveSettings({ annualTarget: annual, monthlyTarget: monthly });
      U.showToast('目標を更新したよ');
    });

    var exportBtn = container.querySelector('[data-action="export"]');
    if (exportBtn) exportBtn.addEventListener('click', function () {
      ctx.actions.exportData();
    });

    var importTrigger = container.querySelector('[data-action="import-trigger"]');
    var fileInput = container.querySelector('#rr-import-file');
    if (importTrigger && fileInput) {
      importTrigger.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        U.confirmDialog('現在のデータをファイルの内容で置き換えます。よろしいですか?', function () {
          ctx.actions.importData(file);
        }, { okLabel: '復元する', okClass: 'rr-btn--primary' });
        fileInput.value = '';
      });
    }
  }

  global.RR = global.RR || {};
  global.RR.Views = global.RR.Views || {};
  global.RR.Views.settings = { render: render, bind: bind };
})(window);
