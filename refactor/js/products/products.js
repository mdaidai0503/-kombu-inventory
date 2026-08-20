'use strict';

/*
 * 昆布在庫管理 整理版 v1
 * 商品設定の共通入口
 *
 * 現段階では現行 app-v159.js の処理には接続しない。
 * PDF・FAX帳票の仕様にも影響しない。
 */

window.KombuRefactor = window.KombuRefactor || {};

window.KombuRefactor.products = Object.freeze({

  kushiro: {
    id: 'kushiro',
    name: '釧路産昆布'
  },

  hidaka: {
    id: 'hidaka',
    name: '日高昆布'
  },

  nemuro: {
    id: 'nemuro',
    name: '根室産昆布'
  },

  sanmae: {
    id: 'sanmae',
    name: '釧路産棹前昆布'
  }

});
