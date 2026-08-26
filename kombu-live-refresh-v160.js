/* =========================================================
   昆布在庫管理 ライブ画面反映 v160.8
   ---------------------------------------------------------
   ・「最新データを反映」後も現在画面をできるだけ維持
   ・新規出荷依頼画面を会社マスターと誤判定しない
   ・入力中画面は再描画せず、入力内容を保護
   ========================================================= */
(function () {
  'use strict';

  function tryGlobalEval(code) {
    try { return (0, eval)(code); }
    catch (e) { return null; }
  }

  function reloadRuntimeStates() {
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
      `if (typeof smState !== 'undefined') {
         smState = JSON.parse(localStorage.getItem('kombu_kushiro_sanmae_local_v1') || 'null') || smState;
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
      if (typeof window[name] === 'function') return window[name];
    }
    return null;
  }

  function detectProductPrefix() {
    const header = String(document.querySelector('header')?.textContent || '');
    const title = String(document.querySelector('#app h2')?.textContent || '');
    const text = header + ' ' + title;
    if (text.includes('日高')) return 'hidaka';
    if (text.includes('根室')) return 'nemuro';
    if (text.includes('棹前')) return 'sanmae';
    return 'kushiro';
  }

  function detectView() {
    const app = document.getElementById('app');
    const text = String(app?.textContent || '');

    /*
     * v2.5以降の新規出荷依頼フォーム。
     * 画面内に「会社マスター」の説明文があっても masters と判定しない。
     */
    if (
      document.getElementById('v114ShipDate') ||
      document.getElementById('v114PdfFlow') ||
      app?.querySelector('[data-v114-line]')
    ) return 'editing';

    /* 帳票プレビュー中も画面を維持 */
    if (
      document.getElementById('kombuShipmentPreviewOverlay') ||
      document.getElementById('v161ShipmentPreviewOverlay')
    ) return 'editing';

    /* その他の入力・修正画面 */
    if (
      document.getElementById('saveBtn') ||
      (
        app?.querySelector('input,textarea,select') &&
        (
          text.includes('入庫登録') ||
          text.includes('出庫登録') ||
          text.includes('修正')
        )
      )
    ) return 'editing';

    if (text.includes('入出庫履歴')) return 'logs';
    if (text.includes('出荷依頼履歴')) return 'shipHistory';
    if (
      text.includes('出荷依頼一覧') ||
      text.includes('出荷指示一覧')
    ) return 'shipments';

    /*
     * 詳細画面は安全のため強制再描画しない。
     * stateだけ最新化し、次の画面遷移時に反映する。
     */
    if (
      text.includes('出荷依頼') ||
      text.includes('出荷指示')
    ) return 'hold';

    if (text.includes('在庫表') || text.includes('在庫集計表')) return 'stock';

    /* masters は最後に判定する */
    if (
      text.includes('会社マスター') ||
      text.includes('マスター設定')
    ) return 'masters';

    return 'home';
  }

  function functionCandidates(product, view) {
    const map = {
      kushiro: {
        home: ['home', 'productLanding'],
        stock: ['stock'],
        logs: ['logs'],
        shipments: ['v136ShipmentHistory'],
        shipHistory: ['shipmentHistory', 'shipHistory'],
        masters: ['masters']
      },
      hidaka: {
        home: ['hHome', 'hidakaHome', 'home'],
        stock: ['hStock', 'hidakaStock', 'stock'],
        logs: ['hLogs', 'hidakaLogs', 'logs'],
        shipments: ['v136ShipmentHistory'],
        shipHistory: ['hShipmentHistory', 'hShipHistory', 'shipmentHistory'],
        masters: ['hMasters', 'hidakaMasters', 'masters']
      },
      nemuro: {
        home: ['nHome', 'nemuroHome', 'home'],
        stock: ['nStock', 'nemuroStock', 'stock'],
        logs: ['nLogs', 'nemuroLogs', 'logs'],
        shipments: ['v136ShipmentHistory'],
        shipHistory: ['nShipmentHistory', 'nShipHistory', 'shipmentHistory'],
        masters: ['nMasters', 'nemuroMasters', 'masters']
      },
      sanmae: {
        home: ['smHome', 'ksHome', 'sHome', 'sanmaeHome', 'home'],
        stock: ['smStock', 'ksStock', 'sStock', 'sanmaeStock', 'stock'],
        logs: ['smLogs', 'ksLogs', 'sLogs', 'sanmaeLogs', 'logs'],
        shipments: ['v136ShipmentHistory'],
        shipHistory: ['smShipmentHistory', 'ksShipmentHistory', 'sShipmentHistory', 'shipmentHistory'],
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
      toast.style.bottom = 'calc(78px + env(safe-area-inset-bottom))';
      toast.style.transform = 'translateX(-50%)';
      toast.style.zIndex = '100300';
      toast.style.background = '#0b2b55';
      toast.style.color = '#fff';
      toast.style.padding = '10px 14px';
      toast.style.borderRadius = '999px';
      toast.style.fontSize = '13px';
      toast.style.fontWeight = '700';
      toast.style.boxShadow = '0 4px 18px rgba(0,0,0,.22)';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = 'block';
    clearTimeout(window.__kombuLiveToastTimer);
    window.__kombuLiveToastTimer = setTimeout(function () {
      toast.style.display = 'none';
    }, 1800);
  }

  function applyLatestToCurrentView() {
    reloadRuntimeStates();
    const view = detectView();

    if (view === 'editing' || view === 'hold') {
      showAppliedToast('最新データを取得しました。現在の画面は維持しています。');
      console.info('[KOMBU v160.8] 再描画を保留:', view);
      return true;
    }

    const product = detectProductPrefix();
    const fn = firstGlobalFunction(functionCandidates(product, view));

    if (fn) {
      try {
        fn();
        showAppliedToast('最新データを画面に反映しました');
        console.info('[KOMBU v160.8] 現在画面へライブ反映:', product, view);
        return true;
      } catch (error) {
        console.warn('[KOMBU v160.8] 画面再描画に失敗:', error);
      }
    }

    showAppliedToast('最新データを取得しました');
    console.info('[KOMBU v160.8] state更新済み。現在画面は維持:', product, view);
    return false;
  }

  window.kombuV160ApplyLatestToView = applyLatestToCurrentView;

  window.addEventListener('kombu:v160-latest-applied', function () {
    applyLatestToCurrentView();
  });

  console.info('[KOMBU v160.8] ライブ画面反映モジュール ready');
})();
