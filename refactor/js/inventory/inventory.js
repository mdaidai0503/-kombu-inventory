/**
 * 昆布在庫管理 - Inventory Module
 * refactor-v1
 *
 * 在庫管理関連の処理を段階的に整理します。
 *
 * 方針：
 * ・現在稼働中の app-v159.js の動作は変更しない
 * ・PDF / FAX帳票の仕様は変更しない
 * ・既存データとの互換性を維持する
 * ・この段階では既存データを「読むだけ」
 */

(function () {
  'use strict';

  window.KombuRefactor = window.KombuRefactor || {};

  const Inventory = {

    version: '1.1.0',

    init() {
      console.log('[KombuRefactor] Inventory module ready');
    },

    getProductConfig(productId) {
      const products = window.KombuRefactor.Products;

      if (!products) {
        console.warn(
          '[KombuRefactor] Products module is not loaded'
        );

        return null;
      }

      return products.get(productId);
    },

    getState(productId) {
      const storage = window.KombuRefactor.Storage;

      if (!storage) {
        console.warn(
          '[KombuRefactor] Storage module is not loaded'
        );

        return null;
      }

      return storage.readProduct(productId, null);
    },

    hasData(productId) {
      const storage = window.KombuRefactor.Storage;

      if (!storage) {
        return false;
      }

      return storage.existsProduct(productId);
    },

    getRecords(productId) {
      const state = this.getState(productId);

      if (!state || !Array.isArray(state.records)) {
        return [];
      }

      return state.records;
    },

    getShipments(productId) {
      const state = this.getState(productId);

      if (!state || !Array.isArray(state.shipments)) {
        return [];
      }

      return state.shipments;
    },

    getActiveYear(productId) {
      const state = this.getState(productId);
      const config = this.getProductConfig(productId);

      if (
        state &&
        config &&
        config.years.includes(state.activeYear)
      ) {
        return state.activeYear;
      }

      return config?.defaultYear || null;
    },

    summary(productId) {
      const config = this.getProductConfig(productId);
      const state = this.getState(productId);

      return {
        productId,
        name: config?.name || productId,
        storageKey: config?.storageKey || null,
        exists: this.hasData(productId),
        activeYear: this.getActiveYear(productId),
        records: Array.isArray(state?.records)
          ? state.records.length
          : 0,
        shipments: Array.isArray(state?.shipments)
          ? state.shipments.length
          : 0
      };
    }

  };

  window.KombuRefactor.Inventory = Inventory;

})();
