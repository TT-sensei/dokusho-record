/* ============================================================
 * storage.js
 * localStorageへの読み書き、初期データ生成、バージョン管理・
 * マイグレーションを担当する。
 * 他のモジュールはこのファイル経由でのみデータを読み書きする。
 * ============================================================ */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'reading-record:v1';
  var CURRENT_VERSION = '1.0';

  /**
   * 初期データ(まっさらな状態)を生成する。
   */
  function createDefaultData() {
    return {
      version: CURRENT_VERSION,
      settings: {
        annualTarget: 50,
        monthlyTarget: 5
      },
      stats: {
        currentStreak: 0,
        longestStreak: 0,
        lastReadDate: null
      },
      badges: [],
      books: []
    };
  }

  /**
   * 読み込んだ生データを、今のアプリが期待する形に近づける。
   * 壊れたデータ・古いバージョンのデータでもアプリが落ちないようにする。
   */
  function migrate(raw) {
    var base = createDefaultData();
    if (!raw || typeof raw !== 'object') {
      return base;
    }

    var data = base;

    if (raw.settings && typeof raw.settings === 'object') {
      data.settings.annualTarget = toPositiveInt(raw.settings.annualTarget, base.settings.annualTarget);
      data.settings.monthlyTarget = toPositiveInt(raw.settings.monthlyTarget, base.settings.monthlyTarget);
    }

    if (raw.stats && typeof raw.stats === 'object') {
      data.stats.currentStreak = toNonNegativeInt(raw.stats.currentStreak, 0);
      data.stats.longestStreak = toNonNegativeInt(raw.stats.longestStreak, 0);
      data.stats.lastReadDate = typeof raw.stats.lastReadDate === 'string' ? raw.stats.lastReadDate : null;
    }

    if (Array.isArray(raw.badges)) {
      data.badges = raw.badges.filter(function (b) { return typeof b === 'string'; });
    }

    if (Array.isArray(raw.books)) {
      data.books = raw.books
        .filter(function (b) { return b && typeof b === 'object' && typeof b.title === 'string' && b.title.length > 0; })
        .map(normalizeBookRecord);
    }

    // 将来のバージョン番号に更新しておく(現状は1.0のみ)
    data.version = CURRENT_VERSION;

    return data;
  }

  function normalizeBookRecord(b) {
    return {
      id: typeof b.id === 'string' && b.id ? b.id : generateId(b.isbn),
      isbn: typeof b.isbn === 'string' ? b.isbn : '',
      title: String(b.title),
      author: typeof b.author === 'string' ? b.author : '',
      publisher: typeof b.publisher === 'string' ? b.publisher : '',
      coverUrl: typeof b.coverUrl === 'string' ? b.coverUrl : '',
      readDate: typeof b.readDate === 'string' && b.readDate ? b.readDate : (RR.Stats ? RR.Stats.todayStr() : ''),
      memo: typeof b.memo === 'string' ? b.memo : '',
      entryMethod: (b.entryMethod === 'barcode' || b.entryMethod === 'manual') ? b.entryMethod : 'manual',
      isFavorite: !!b.isFavorite,
      genre: typeof b.genre === 'string' ? b.genre : '',
      isReread: !!b.isReread,
      createdAt: typeof b.createdAt === 'string' ? b.createdAt : new Date().toISOString()
    };
  }

  function generateId(isbn) {
    var prefix = isbn ? String(isbn).replace(/[^0-9Xx]/g, '') : 'm';
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function toPositiveInt(v, fallback) {
    var n = parseInt(v, 10);
    return (isFinite(n) && n > 0) ? n : fallback;
  }
  function toNonNegativeInt(v, fallback) {
    var n = parseInt(v, 10);
    return (isFinite(n) && n >= 0) ? n : fallback;
  }

  /**
   * localStorageからデータを読み込む。存在しない/壊れている場合は初期データを返す。
   */
  function load() {
    var raw;
    try {
      var text = global.localStorage.getItem(STORAGE_KEY);
      if (!text) {
        return createDefaultData();
      }
      raw = JSON.parse(text);
    } catch (err) {
      console.warn('[reading-record] データの読み込みに失敗したため初期化します', err);
      return createDefaultData();
    }
    return migrate(raw);
  }

  /**
   * データをlocalStorageへ保存する。失敗してもアプリは継続動作させる。
   */
  function save(data) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      console.warn('[reading-record] データの保存に失敗しました', err);
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
    save: save
  };
})(window);
