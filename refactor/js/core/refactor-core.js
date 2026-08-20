'use strict';

/*
 * 昆布在庫管理 整理版 v1
 * 共通コア
 *
 * 現段階では app-v159.js には接続しない。
 * 現行PDF・FAX・在庫データには影響しない。
 */

window.KombuRefactor = window.KombuRefactor || {};

/* =========================
   画面状態
========================= */

window.KombuRefactor.state = {
  currentView: 'home',
  currentProduct: null
};


/* =========================
   画面切替
========================= */

window.KombuRefactor.router = {

  setView(viewId) {
    window.KombuRefactor.state.currentView = viewId;
  },

  getView() {
    return window.KombuRefactor.state.currentView;
  },

  setProduct(productId) {
    window.KombuRefactor.state.currentProduct = productId;
  },

  getProduct() {
    return window.KombuRefactor.state.currentProduct;
  }

};


/* =========================
   在庫管理 共通入口
========================= */

window.KombuRefactor.inventory = {

  enabled: false,

  status() {
    return {
      enabled: this.enabled,
      message:
        '現在はapp-v159.jsの在庫処理を使用しています。'
    };
  }

};


/* =========================
   出荷指示 共通入口
========================= */

window.KombuRefactor.shipment = {

  enabled: false,

  status() {
    return {
      enabled: this.enabled,
      message:
        '現在はapp-v159.jsの出荷処理を使用しています。'
    };
  }

};


/* =========================
   PDF
========================= */

window.KombuRefactor.pdf = {

  locked: true,

  message:
    'PDF・FAX帳票は現行仕様を固定し、整理作業から保護します。'

};


/* =========================
   整理版情報
========================= */

window.KombuRefactor.info = {

  name: '昆布在庫管理 整理版',

  version: 'v1',

  active: false,

  note:
    '現段階では現行アプリには接続されていません。'

};
