/* shelf.js が新しい RR.Shelf API を使っていても、既存のSPAルーターから利用できるようにする */
(function (global) {
  'use strict';
  global.RR = global.RR || {};
  global.RR.Views = global.RR.Views || {};
  if (global.RR.Shelf) global.RR.Views.shelf = global.RR.Shelf;
})(window);
