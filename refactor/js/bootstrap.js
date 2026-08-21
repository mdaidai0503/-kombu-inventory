/**
 * 昆布在庫管理アプリ
 * refactor-v1 bootstrap
 *
 * 分割した各モジュールを安全に初期化するための入口です。
 *
 * 重要：
 * ・現在稼働中の app-v159.js の動作は変更しない
 * ・既存データとの互換性を維持する
 * ・PDF / FAX の既存仕様を変更しない
 */

(function () {
  'use strict';

  window.KombuRefactor = window.KombuRefactor || {};

  const App = window.KombuRefactor;

  function safeInit(name, module) {
    if (!module || typeof module.init !== 'function') {
      console.warn('[KombuRefactor] ' + name + ' module not loaded');
      return;
    }

    try {
      module.init();
      console.log('[KombuRefactor] ' + name + ' initialized');
    } catch (error) {
      console.error('[KombuRefactor] ' + name + ' init failed', error);
    }
  }

  function bootstrap() {
    console.log('[KombuRefactor] bootstrap start');

    safeInit('Core', App.Core);
    safeInit('Storage', App.Storage);
    safeInit('Products', App.Products);
    safeInit('Inventory', App.Inventory);
    safeInit('Shipping', App.Shipping);
    safeInit('PDF', App.PDF);

    console.log('[KombuRefactor] bootstrap complete');
  }

  App.bootstrap = bootstrap;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, {
      once: true
    });
  } else {
    bootstrap();
  }
})();
