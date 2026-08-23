/* =========================================================
   昆布在庫管理
   送り状PDF連携 v159.2
   shipment_waybill_inbox 専用
   - 出荷履歴のPDF表示
   - 出荷指示詳細画面への浜中運輸送り状表示
   - match_status: matched / auto_attached 両対応
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

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[m];
    });
  }

  function isAttachedStatus(status) {
    return status === 'matched' || status === 'auto_attached';
  }

  function getScore(waybill) {
    const p = waybill && waybill.parsed_data;
    const score =
      p && p.match && p.match.best
        ? Number(p.match.best.score)
        : NaN;

    return Number.isFinite(score) ? score : null;
  }

  async function loadWaybills() {
    const sb = client();
    if (!sb) return [];

    const result = await sb
      .from(TABLE_NAME)
      .select(
        'id,storage_path,original_filename,match_status,matched_product,matched_shipment_id,received_at,shipping_date,parsed_data'
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
      const sameId =
        String(w.matched_shipment_id || '') === String(shipmentId || '');

      if (!sameId) return false;

      // 商品名が一致すれば優先。
      if (
        product &&
        w.matched_product &&
        String(w.matched_product) === String(product)
      ) {
        return true;
      }

      // shipment ID は一意なので、商品名表記に揺れがあっても拾う。
      return true;
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
      isAttachedStatus(waybill.match_status) &&
      waybill.storage_path
    ) {
      return (
        '<button class="mini v159-waybill-pdf" ' +
        'data-waybill-id="' + esc(waybill.id) + '">' +
        '📎 PDF</button>'
      );
    }

    return '<span class="v159-waybill-review">⚠ 要確認</span>';
  }

  function bindWaybillButtons(root) {
    (root || document)
      .querySelectorAll('.v159-waybill-pdf')
      .forEach(function (button) {
        button.onclick = function () {
          const waybill = waybillCache.find(function (w) {
            return String(w.id) === String(button.dataset.waybillId);
          });

          openWaybillPdf(waybill);
        };
      });
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

    bindWaybillButtons(body);
  }

  function detectShipmentIdFromDetail() {
    const headings = Array.from(document.querySelectorAll('h2'));

    for (const h of headings) {
      const text = String(h.textContent || '').trim();
      const m = text.match(/出荷指示\s+([A-Za-z]\d{3,})/);

      if (m) {
        return {
          shipmentId: m[1],
          heading: h
        };
      }
    }

    return null;
  }

  function patchShipmentDetail() {
    const hit = detectShipmentIdFromDetail();
    if (!hit) return;

    const shipmentId = hit.shipmentId;
    const card = hit.heading.closest('.card');
    if (!card) return;

    const old = card.querySelector('.v159-waybill-detail');
    if (old) old.remove();

    const waybill = findWaybill('', shipmentId);

    if (!waybill) {
      return;
    }

    const score = getScore(waybill);
    const attached =
      isAttachedStatus(waybill.match_status) &&
      !!waybill.storage_path;

    const box = document.createElement('div');
    box.className = 'v159-waybill-detail';
    box.style.marginTop = '14px';
    box.style.padding = '12px 14px';
    box.style.border = '1px solid #cfd8e3';
    box.style.borderRadius = '10px';
    box.style.background = '#f8fafc';

    if (attached) {
      box.innerHTML =
        '<div style="font-weight:700;margin-bottom:8px">' +
          '📎 浜中運輸送り状 PDF' +
        '</div>' +
        '<div style="margin-bottom:10px">' +
          (score !== null
            ? '照合スコア：<b>' + score + '点</b>'
            : '自動照合済み') +
        '</div>' +
        '<button class="btn secondary v159-waybill-pdf" ' +
          'data-waybill-id="' + esc(waybill.id) + '">' +
          'PDFを開く' +
        '</button>';
    } else {
      box.innerHTML =
        '<div style="font-weight:700">⚠ 浜中運輸送り状 要確認</div>' +
        (score !== null
          ? '<div style="margin-top:6px">照合スコア：<b>' +
            score + '点</b></div>'
          : '');
    }

    const toolbar = card.querySelector('.toolbar');
    if (toolbar) {
      card.insertBefore(box, toolbar);
    } else {
      card.appendChild(box);
    }

    bindWaybillButtons(box);
  }

  async function refreshWaybills() {
    if (refreshing) return;
    refreshing = true;

    try {
      await loadWaybills();
      patchHistoryTable();
      patchShipmentDetail();
    } finally {
      refreshing = false;
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);

    refreshTimer = setTimeout(function () {
      refreshWaybills();
    }, 150);
  }

  const observer = new MutationObserver(function (mutations) {
    const relevant = mutations.some(function (m) {
      return Array.from(m.addedNodes || []).some(function (node) {
        if (!node || node.nodeType !== 1) return false;

        if (
          node.id === 'v136HistBody' ||
          (node.querySelector && node.querySelector('#v136HistBody'))
        ) {
          return true;
        }

        const text = String(node.textContent || '');
        return text.includes('出荷指示');
      });
    });

    if (relevant) scheduleRefresh();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener('kombu:supabase-login', scheduleRefresh);
  window.addEventListener('load', scheduleRefresh);

  window.kombuWaybillInboxRefresh = refreshWaybills;

})();
