'use strict';

/*
 * 昆布在庫管理 整理版 v1
 * データ保存処理の共通入口
 *
 * 現段階では既存のlocalStorageキーや
 * app-v159.jsの保存方式は変更しない。
 */

window.KombuRefactor = window.KombuRefactor || {};

window.KombuRefactor.Storage = {
  init() {
    console.log('[KombuRefactor] Storage module ready');
  },
  read(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);

      if (raw === null) {
        return fallback;
      }

      return JSON.parse(raw);

    } catch (error) {
      console.warn('storage.read failed:', key, error);
      return fallback;
    }
  },

  write(key, value) {
    try {
      localStorage.setItem(
        key,
        JSON.stringify(value)
      );

      return true;

    } catch (error) {
      console.error('storage.write failed:', key, error);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;

    } catch (error) {
      console.error('storage.remove failed:', key, error);
      return false;
    }
  }

};
