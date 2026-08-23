/* =========================================================
   昆布在庫管理 ライブ画面反映 v160.6
   ---------------------------------------------------------
   v160.5 の「最新データを反映」後、
   localStorageだけでなく実行中アプリのstateも更新し、
   現在の画面をできるだけ維持したまま再描画する。
   ========================================================= */

(function () {
  'use strict';

  function tryGlobalEval(code) {
    try {
      return (0, eval)(code);
    } catch (e) {
      return null;
    }
  }

  function reloadRuntimeStates() {
    /*
     * app-v159.js 内の各商品stateを、Supabase同期済みlocalStorageから再読込。
     * 存在しない変数名はそのまま無視する。
     */
    const assignments = [
      `if (typeof state !== 'undefined') {
         state = JSON.parse(localStorage.getItem('kombu_local_only_v3') || 'null') || state;
       }`,
      `if (typeof hState !== 'undefined') {
         hState = JSON.parse(localStorage.getItem('kombu_hidaka_local_v1') || 'null') || hState;
       }`,
      `if (typeof nState !== 'undefined') {
         nState = JSON.parse(localStorage.getItem('kombu_nemuro_local_v1') || 'null') || nState;
       }`,
      `if (typeof ksState !== 'undefined') {
         ksState = JSON.parse(localStorage.getItem('kombu_kushiro_sanmae_local_v1') || 'null') || ksState;
       }`,
      `if (typeof sState !== 'undefined') {
         sState = JSON.parse(localStorage.getItem('kombu_kushiro_sanmae_local_v1') || 'null') || sState;
       }`
    ];

    assignments.forEach(tryGlobalEval);
  }

  function firstGlobalFunction(names) {
    for (const name of names) {
      if (typeof window[name] === 'function') {
        return window[name];
      }
    }
    return null;
  }

  function detectProductPrefix() {
    const header =
      String(document.querySelector('header')?.textContent || '');
    const title =
      String(document.querySelector('#app h2')?.textContent || '');
    const text = header + ' ' + title;

    if (text.includes('日高')) return 'hidaka';
    if (text.includes('根室')) return 'nemuro';
    if (text.includes('棹前')) return 'sanmae';
    return 'kushiro';
  }

  function detectView() {
    const app = document.getElementById('app');
    const text = String(app?.textContent || '');

    if (
      document.getElementById('saveBtn') ||
      app?.querySelector('input,textarea,select')
    ) {
      if (
        text.includes('入庫登録') ||
        text.includes('出庫登録') ||
        text.includes('修正')
      ) {
        return 'editing';
      }
    }

    if (text.includes('入出庫履歴')) return 'logs';
    if (text.includes('出荷依頼履歴')) return 'shipHistory';
    if (text.includes('出荷指示一覧')) return 'shipments';
    if (text.includes('出荷指示')) return 'shipments';
    if (text.includes('在庫表')) return 'stock';
    if (text.includes('マスター')) return 'masters';
    return 'home';
  }

  function functionCandidates(product, view) {
    const map = {
      kushiro: {
        home: ['home'],
        stock: ['stock'],
        logs: ['logs'],
        shipments: ['shipments'],
        shipHistory: ['shipmentHistory', 'shipHistory'],
        masters: ['masters']
      },
      hidaka: {
        home: ['hHome', 'hidakaHome', 'home'],
        stock: ['hStock', 'hidakaStock', 'stock'],
        logs: ['hLogs', 'hidakaLogs', 'logs'],
        shipments: ['hShipments', 'hidakaShipments', 'shipments'],
        shipHistory: ['hShipmentHistory', 'hShipHistory', 'shipmentHistory'],
        masters: ['hMasters', 'hidakaMasters', 'masters']
      },
      nemuro: {
        home: ['nHome', 'nemuroHome', 'home'],
        stock: ['nStock', 'nemuroStock', 'stock'],
        logs: ['nLogs', 'nemuroLogs', 'logs'],
        shipments: ['nShipments', 'nemuroShipments', 'shipments'],
        shipHistory: ['nShipmentHistory', 'nShipHistory', 'shipmentHistory'],
        masters: ['nMasters', 'nemuroMasters', 'masters']
      },
      sanmae: {
        home: ['ksHome', 'sHome', 'sanmaeHome', 'home'],
        stock: ['ksStock', 'sStock', 'sanmaeStock', 'stock'],
        logs: ['ksLogs', 'sLogs', 'sanmaeLogs', 'logs'],
        shipments: ['ksShipments', 'sShipments', 'sanmaeShipments', 'shipments'],
        shipHistory: ['ksShipmentHistory', 'sShipmentHistory', 'shipmentHistory'],
        masters: ['ksMasters', 'sMasters', 'sanmaeMasters', 'masters']
      }
    };

    return map[product]?.[view] || [];
  }

  function showAppliedToast(message) {
    let toast = document.getElementById('kombuV160LiveToast');

    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'kombuV160LiveToast';
      toast.style.position = 'fixed';
      toast.style.left = '50%';
      toast.style.bottom =
        'calc(78px + env(safe-area-inset-bottom))';
      toast.style.transform = 'translateX(-50%)';
      toast.style.zIndex = '100001';
      toast.style.background = '#0b2b55';
      toast.style.color = '#fff';
      toast.style.padding = '10px 14px';
      toast.style.borderRadius = '999px';
      toast.style.fontSize = '13px';
      toast.style.fontWeight = '700';
      toast.style.boxShadow =
        '0 4px 18px rgba(0,0,0,.22)';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.display = 'block';

    clearTimeout(window.__kombuLiveToastTimer);
    window.__kombuLiveToastTimer =
      setTimeout(function () {
        toast.style.display = 'none';
      }, 1800);
  }

  function applyLatestToCurrentView() {
    reloadRuntimeStates();

    const view = detectView();

    /*
     * 入力途中はユーザーが入力している値を消さない。
     * Supabase/localStorageは最新化済みなので、
     * 登録後または画面移動時に最新値を利用できる。
     */
    if (view === 'editing') {
      showAppliedToast(
        '最新データを取得しました。入力中の画面は維持しています。'
      );
      console.info(
        '[KOMBU v160.6] 入力中のため再描画を保留'
      );
      return true;
    }

    const product = detectProductPrefix();
    const fn = firstGlobalFunction(
      functionCandidates(product, view)
    );

    if (fn) {
      try {
        fn();
        showAppliedToast(
          '最新データを画面に反映しました'
        );
        console.info(
          '[KOMBU v160.6] 現在画面へライブ反映:',
          product,
          view
        );
        return true;
      } catch (error) {
        console.warn(
          '[KOMBU v160.6] 画面再描画に失敗:',
          error
        );
      }
    }

    /*
     * 描画関数が特定できない画面でも、
     * 強制reloadはしない。
     */
    showAppliedToast(
      '最新データを取得しました'
    );

    console.info(
      '[KOMBU v160.6] state更新済み。現在画面は維持:',
      product,
      view
    );

    return false;
  }

  window.kombuV160ApplyLatestToView =
    applyLatestToCurrentView;

  window.addEventListener(
    'kombu:v160-latest-applied',
    function () {
      applyLatestToCurrentView();
    }
  );

  console.info(
    '[KOMBU v160.6] ライブ画面反映モジュール ready'
  );

})();
