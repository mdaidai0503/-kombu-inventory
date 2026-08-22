/* =========================================================
   昆布在庫管理
   送り状PDF連携 v159.1
   shipment_waybill_inbox 専用
   ========================================================= */

(function () {
  'use strict';

  const TABLE_NAME = 'shipment_waybill_inbox';
  const BUCKET_NAME = 'shipment-waybill-inbox';

  let waybillCache = [];
  let refreshTimer = null;
  let refreshing = false;

  function client() {
    return window.kombuSupabase || null;
  }

  async function loadWaybills() {
    const sb = client();
    if (!sb) return [];

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
    return waybillCache.find(function (w) {
      return (
        String(w.matched_product || '') === String(product || '') &&
        String(w.matched_shipment_id || '') === String(shipmentId || '')
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
      return '<span class="muted">未着</span>';
    }

    if (
      waybill.match_status === 'matched' &&
      waybill.storage_path
    ) {
      return (
        '<button class="mini v159-waybill-pdf" ' +
        'data-waybill-id="' + String(waybill.id) + '">' +
        '📎 PDF</button>'
      );
    }

    return '<span class="v159-waybill-review">⚠ 要確認</span>';
  }

  function patchHistoryTable() {
    const body = document.getElementById('v136HistBody');
    if (!body) return;

    body.querySelectorAll('tr[data-hid]').forEach(function (tr) {
      const product = tr.dataset.hprod || '';
      const shipmentId = tr.dataset.hid || '';
      const cells = tr.querySelectorAll('td');

      if (cells.length !== 8) return;

      cells[5].innerHTML = makeWaybillCell(product, shipmentId);
    });

    document.querySelectorAll('.v159-waybill-pdf').forEach(function (button) {
      button.onclick = function () {
        const waybill = waybillCache.find(function (w) {
          return String(w.id) === String(button.dataset.waybillId);
        });

        openWaybillPdf(waybill);
      };
    });
  }

  async function refreshHistoryWaybills() {
    if (refreshing) return;

    refreshing = true;

    try {
      await loadWaybills();
      patchHistoryTable();
    } finally {
      refreshing = false;
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);

    refreshTimer = setTimeout(function () {
      if (document.getElementById('v136HistBody')) {
        refreshHistoryWaybills();
      }
    }, 150);
  }

  const observer = new MutationObserver(function (mutations) {
    const relevant = mutations.some(function (m) {
      return Array.from(m.addedNodes || []).some(function (node) {
        if (!node || node.nodeType !== 1) return false;

        return (
          node.id === 'v136HistBody' ||
          (node.querySelector && node.querySelector('#v136HistBody'))
        );
      });
    });

    if (relevant) scheduleRefresh();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener('kombu:supabase-login', scheduleRefresh);

  window.kombuWaybillInboxRefresh = refreshHistoryWaybills;

})();
