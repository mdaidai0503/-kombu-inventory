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
    },
    getQuantity(productId, filters = {}) {
      if (!['kushiro', 'nemuro', 'sanmae'].includes(productId)) {
        return null;
      }

      const records = this.getRecords(productId);
      const shipments = this.getShipments(productId);

      const matches = item =>
        (!filters.year || (item.year || 'R7') === filters.year) &&
        (!filters.coop || item.coop === filters.coop) &&
        (!filters.season || item.season === filters.season) &&
        (!filters.group || item.group === filters.group) &&
        (!filters.item || item.item === filters.item);

      const physical = records
        .filter(matches)
        .reduce((total, record) => {
          const qty = Number(record.qty || 0);
          return total + (record.type === 'out' ? -qty : qty);
        }, 0);

      const reserved = shipments
        .filter(shipment => shipment.status === 'confirmed')
        .flatMap(shipment =>
          Array.isArray(shipment.lines) ? shipment.lines : []
        )
        .filter(matches)
        .reduce(
          (total, line) => total + Number(line.qty || 0),
          0
        );

      return physical - reserved;
    },
getAvailableQuantity(productId, filters = {}, excludeShipmentId = null) {
  if (!['kushiro', 'nemuro', 'sanmae'].includes(productId)) {
    return null;
  }

  const records = this.getRecords(productId);
  const shipments = this.getShipments(productId);

  const matches = item =>
    (!filters.year || (item.year || 'R7') === filters.year) &&
    (!filters.coop || item.coop === filters.coop) &&
    (!filters.season || item.season === filters.season) &&
    (!filters.group || item.group === filters.group) &&
    (!filters.item || item.item === filters.item);

  const physical = records
    .filter(matches)
    .reduce((total, record) => {
      const qty = Number(record.qty || 0);
      return total + (record.type === 'out' ? -qty : qty);
    }, 0);

  const reserved = shipments
    .filter(shipment =>
      shipment.status === 'confirmed' &&
      shipment.id !== excludeShipmentId
    )
    .flatMap(shipment =>
      Array.isArray(shipment.lines) ? shipment.lines : []
    )
    .filter(matches)
    .reduce(
      (total, line) => total + Number(line.qty || 0),
      0
    );

  return physical - reserved;
},
 getHidakaAvailableQuantity(filters = {}, excludeShipmentId = null) {
  const records = this.getRecords('hidaka');
  const shipments = this.getShipments('hidaka');

  const matches = item =>
    (!filters.year || (item.year || 'R7') === filters.year) &&
    (!filters.location || item.location === filters.location) &&
    (!filters.section || item.section === filters.section) &&
    (!filters.grade || item.grade === filters.grade);

  const physical = records
    .filter(matches)
    .reduce((total, record) => {
      const qty = Number(record.qty || 0);
      return total + (record.type === 'out' ? -qty : qty);
    }, 0);

  const reserved = shipments
    .filter(shipment =>
      shipment.status === 'confirmed' &&
      shipment.id !== excludeShipmentId
    )
    .flatMap(shipment =>
      Array.isArray(shipment.lines) ? shipment.lines : []
    )
    .filter(matches)
    .reduce(
      (total, line) => total + Number(line.qty || 0),
      0
    );

  return physical - reserved;
},   
    getHidakaQuantity(filters = {}) {
  const records = this.getRecords('hidaka');
  const shipments = this.getShipments('hidaka');

  const matches = item =>
    (!filters.year || (item.year || 'R7') === filters.year) &&
    (!filters.location || item.location === filters.location) &&
    (!filters.section || item.section === filters.section) &&
    (!filters.grade || item.grade === filters.grade);

  const physical = records
    .filter(matches)
    .reduce((total, record) => {
      const qty = Number(record.qty || 0);
      return total + (record.type === 'out' ? -qty : qty);
    }, 0);

  const reserved = shipments
    .filter(shipment => shipment.status === 'confirmed')
    .flatMap(shipment =>
      Array.isArray(shipment.lines) ? shipment.lines : []
    )
    .filter(matches)
    .reduce(
      (total, line) => total + Number(line.qty || 0),
      0
    );

  return physical - reserved;
} 

  };

  window.KombuRefactor.Inventory = Inventory;

})();
