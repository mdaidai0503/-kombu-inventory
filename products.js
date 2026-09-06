'use strict';

/*
 * 昆布在庫管理 整理版 v1
 * 商品基本設定
 *
 * 既存アプリのlocalStorageキーは変更しない。
 * 現在のデータをそのまま引き継ぐ。
 */

window.KombuRefactor = window.KombuRefactor || {};

window.KombuRefactor.Products = {

  init() {
    console.log('[KombuRefactor] Products module ready');
  },

  items: Object.freeze({

    kushiro: {
      id: 'kushiro',
      name: '釧路産昆布',

      storageKey: 'kombu_local_only_v3',

      years: [
        'R3','R4','R5','R6',
        'R7','R8','R9','R10'
      ],

      defaultYear: 'R7'
    },

    hidaka: {
      id: 'hidaka',
      name: '日高昆布',

      storageKey: 'kombu_hidaka_local_v1',

      years: [
        'R2','R3','R4','R5','R6',
        'R7','R8','R9','R10'
      ],

      defaultYear: 'R7'
    },

    nemuro: {
      id: 'nemuro',
      name: '根室産昆布',

      storageKey: 'kombu_nemuro_local_v1',

      years: [
        'R3','R4','R5','R6',
        'R7','R8','R9','R10'
      ],

      defaultYear: 'R7'
    },

    sanmae: {
      id: 'sanmae',
      name: '釧路産棹前昆布',

      storageKey: 'kombu_kushiro_sanmae_local_v1',

      years: [
        'R3','R4','R5','R6',
        'R7','R8','R9','R10'
      ],

      defaultYear: 'R7'
    }

  }),

  get(productId) {
    return this.items[productId] || null;
  },

  getStorageKey(productId) {
    return this.get(productId)?.storageKey || null;
  }

};
