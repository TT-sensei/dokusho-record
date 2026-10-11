/* ============================================================
 * storage.js
 * localStorageへの読み書き(書誌情報・記録・設定)を担当する。
 * 画像本体はここでは扱わない(→ imagestore.js / IndexedDB)。
 * ============================================================ */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'magazine-rack:v2';
  var CURRENT_VERSION = '2.0';
  var loadError = false;

  function createDefaultData() {
    return {
      version: CURRENT_VERSION,
      settings: {
        annualTarget: 50,
        monthlyTarget: 5
      },
      books: []
    };
  }

  function toPositiveInt(v, fallback) {
    var n = parseInt(v, 10);
    return (isFinite(n) && n > 0) ? n : fallback;
  }

  function normalizeBookRecord(b) {
    var today = (global.RR.Stats ? global.RR.Stats.todayStr() : '');
    return {
      id: typeof b.id === 'string' && b.id ? b.id : generateId(b.isbn),
      isbn: typeof b.isbn === 'string' ? b.isbn : '',
      title: String(b.title || ''),
      author: typeof b.author === 'string' ? b.author : '',
      pageCount: (typeof b.pageCount === 'number' && b.pageCount > 0) ? b.pageCount : (parseInt(b.pageCount, 10) || 0),
      price: (typeof b.price === 'number' && b.price > 0) ? b.price : (parseInt(b.price, 10) || 0),
      coverSource: (b.coverSource === 'api' || b.coverSource === 'user') ? b.coverSource : 'none',
      coverUrl: typeof b.coverUrl === 'string' ? b.coverUrl : '',
      coverImageId: typeof b.coverImageId === 'string' ? b.coverImageId : '',
      registeredDate: typeof b.registeredDate === 'string' && b.registeredDate ? b.registeredDate : today,
      readDate: typeof b.readDate === 'string' && b.readDate ? b.readDate : today,
      memo: typeof b.memo === 'string' ? b.memo : '',
      mood: typeof b.mood === 'string' ? b.mood : '',
      isFavorite: !!b.isFavorite,
      entryMethod: (b.entryMethod === 'isbn' || b.entryMethod === 'photo' || b.entryMethod === 'library') ? b.entryMethod : 'manual',
      createdAt: typeof b.createdAt === 'string' ? b.createdAt : new Date().toISOString()
    };
  }

  function migrate(raw) {
    var base = createDefaultData();
    if (!raw || typeof raw !== 'object') return base;

    if (raw.settings && typeof raw.settings === 'object') {
      base.settings.annualTarget = toPositiveInt(raw.settings.annualTarget, base.settings.annualTarget);
      base.settings.monthlyTarget = toPositiveInt(raw.settings.monthlyTarget, base.settings.monthlyTarget);
    }
    if (Array.isArray(raw.books)) {
      base.books = raw.books
        .filter(function (b) { return b && typeof b === 'object' && typeof b.title === 'string' && b.title.trim().length > 0; })
        .map(normalizeBookRecord);
    }
    base.version = CURRENT_VERSION;
    return base;
  }

  function generateId(isbn) {
    var prefix = isbn ? String(isbn).replace(/[^0-9Xx]/g, '') : 'm';
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function load() {
    var raw;
    loadError = false;
    try {
      var text = global.localStorage.getItem(STORAGE_KEY);
      if (text === null) return createDefaultData();
      raw = JSON.parse(text);
      if (!raw || typeof raw !== 'object' || !Array.isArray(raw.books)) {
        throw new Error('保存データの形式が正しくありません');
      }
      if (raw.books.some(function (book) {
        return !book || typeof book !== 'object' || Array.isArray(book) ||
          typeof book.title !== 'string' || !book.title.trim();
      })) {
        throw new Error('本の記録に不備があるため、元データを保護します');
      }
    } catch (err) {
      loadError = true;
      console.error('[magazine-rack] 保存データを読み込めません。元データを保護します。', err);
      return createDefaultData();
    }
    return migrate(raw);
  }

  function hasLoadError() { return loadError; }

  function save(data, options) {
    options = options || {};
    if (loadError && options.force !== true) {
      console.warn('[magazine-rack] 読み込みに失敗した元データを保護するため保存を停止しました');
      return false;
    }
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      loadError = false;
      return true;
    } catch (err) {
      console.warn('[magazine-rack] データの保存に失敗しました', err);
      return false;
    }
  }

  global.RR = global.RR || {};
  global.RR.Storage = {
    STORAGE_KEY: STORAGE_KEY,
    CURRENT_VERSION: CURRENT_VERSION,
    createDefaultData: createDefaultData,
    migrate: migrate,
    normalizeBookRecord: normalizeBookRecord,
    generateId: generateId,
    load: load,
    hasLoadError: hasLoadError,
    save: save
  };
})(window);
