/* =========================================================
   昆布在庫管理
   送り状PDF連携 v159
   shipment_waybill_inbox 専用
   ========================================================= */

(function () {
  'use strict';

  const TABLE_NAME = 'shipment_waybill_inbox';
  const BUCKET_NAME = 'shipment-waybill-inbox';

  let waybillCache = [];

  function client() {
    return window.kombuSupabase || null;
  }

  async function loadWaybills() {
    const sb = client();
    if (!sb) {
      console.warn('Supabase client not ready');
      return [];
    }

    const result = await sb
      .from(TABLE_NAME)
      .select(
        'id,storage_path,original_filename,match_status,matched_product,matched_shipment_id,received_at,shipping_date'
      )
      .order('received_at', { ascending: false });

    if (result.error) {
      console.error('送り状一覧取得エラー:', result.error);
      return [];
    }

    waybillCache = Array.isArray(result.data) ? result.data : [];
    return waybillCache;
  }

  function findWaybill(product, shipmentId) {
    product = String(product || '');
    shipmentId = String(shipmentId || '');

    return waybillCache.find(function (w) {
      return (
        String(w.matched_product || '') === product &&
        String(w.matched_shipment_id || '') === shipmentId
      );
    }) || null;
  }

  async function openWaybillPdf(waybill) {
    if (!waybill || !waybill.storage_path) {
      alert('送り状PDFが見つかりません。');
      return;
    }

    const sb = client();
    if (!sb) {
      alert('Supabaseへ接続できません。');
      return;
    }

    const result = await sb.storage
      .from(BUCKET_NAME)
      .createSignedUrl(waybill.storage_path, 60);

    if (result.error || !result.data || !result.data.signedUrl) {
      console.error('送り状PDF URL取得エラー:', result.error);
      alert('送り状PDFを開けませんでした。');
      return;
    }

    window.open(result.data.signedUrl, '_blank', 'noopener');
  }

  function makeWaybillCell(product, shipmentId) {
    const waybill = findWaybill(product, shipmentId);

    if (!waybill) {
      return '<span class="v159-waybill-status v159-waybill-missing">未着</span>';
    }

    if (waybill.match_status === 'matched' && waybill.storage_path) {
      return (
        '<button class="mini v159-waybill-pdf" ' +
        'data-waybill-id="' + String(waybill.id) + '">' +
        '📎 PDF</button>'
      );
    }

    return '<span class="v159-waybill-status v159-waybill-review">⚠ 要確認</span>';
  }

  function attachPdfButtons() {
    document
      .querySelectorAll('.v159-waybill-pdf')
      .forEach(function (button) {
        button.onclick = function () {
          const id = button.dataset.waybillId;
          const waybill = waybillCache.find(function (w) {
            return String(w.id) === String(id);
          });

          openWaybillPdf(waybill);
        };
      });
  }

  function patchHistoryTable() {
    const body = document.getElementById('v136HistBody');
    if (!body) return;

    body.querySelectorAll('tr').forEach(function (tr) {
      const product = tr.dataset.product || tr.dataset.gprod || '';
      const shipmentId = tr.dataset.id || tr.dataset.gid || '';

      const cells = tr.querySelectorAll('td');
      if (cells.length < 8) return;

      /* 6列目 = 送り状 */
      cells[5].innerHTML = makeWaybillCell(product, shipmentId);
    });

    attachPdfButtons();
  }

  async function refreshHistoryWaybills() {
    await loadWaybills();
    patchHistoryTable();
  }

  /*
   * shipmentHistory() が既に存在する場合、
   * 元の処理を実行した後に送り状列だけ更新する。
   */
  const originalShipmentHistory = window.shipmentHistory;

  if (typeof originalShipmentHistory === 'function') {
    window.shipmentHistory = function () {
      const result = originalShipmentHistory.apply(this, arguments);

      Promise.resolve(result).finally(function () {
        setTimeout(refreshHistoryWaybills, 0);
      });

      return result;
    };
  }

  /*
   * shipmentHistory() がグローバルに公開されていない場合でも、
   * 履歴画面描画後に追従するためMutationObserverを使う。
   */
  const observer = new MutationObserver(function () {
    if (document.getElementById('v136HistBody')) {
      refreshHistoryWaybills();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.addEventListener('kombu:supabase-login', function () {
    refreshHistoryWaybills();
  });

  window.kombuWaybillInboxRefresh = refreshHistoryWaybills;

})();
