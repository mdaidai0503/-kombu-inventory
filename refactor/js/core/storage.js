'use strict';

/*
 * 昆布在庫管理 整理版 v1
 * データ保存処理の共通入口
 *
 * 既存のlocalStorageキーは変更しない。
 * 現在のデータをそのまま読み書きする。
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
      console.warn(
        '[KombuRefactor] storage.read failed:',
        key,
        error
      );

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
      console.error(
        '[KombuRefactor] storage.write failed:',
        key,
        error
      );

      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;

    } catch (error) {
      console.error(
        '[KombuRefactor] storage.remove failed:',
        key,
        error
      );

      return false;
    }
  },

  getProductKey(productId) {
    const products = window.KombuRefactor.Products;

    if (!products) {
      console.warn(
        '[KombuRefactor] Products module is not loaded'
      );

      return null;
    }

    return products.getStorageKey(productId);
  },

  readProduct(productId, fallback = null) {
    const key = this.getProductKey(productId);

    if (!key) {
      console.warn(
        '[KombuRefactor] Unknown product:',
        productId
      );

      return fallback;
    }

    return this.read(key, fallback);
  },

  writeProduct(productId, value) {
    const key = this.getProductKey(productId);

    if (!key) {
      console.warn(
        '[KombuRefactor] Unknown product:',
        productId
      );

      return false;
    }

    return this.write(key, value);
  },

  existsProduct(productId) {
    const key = this.getProductKey(productId);

    if (!key) {
      return false;
    }

    return localStorage.getItem(key) !== null;
  }

};
