/* =========================================================
   昆布在庫管理
   送り状PDF連携 v159.3
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

  function classifyWaybill(waybill) {
    const score = getScore(waybill);

    if (score !== null) {
      if (score >= 90) {
        return {
          key: 'matched',
          label: '自動添付',
          icon: '✅',
          score: score
        };
      }

      if (score >= 70) {
        return {
          key: 'review',
          label: '要確認',
          icon: '⚠️',
          score: score
        };
      }

      return {
        key: 'unmatched',
        label: '不一致',
        icon: '✕',
        score: score
      };
    }

    if (
      waybill &&
      (waybill.match_status === 'matched' ||
       waybill.match_status === 'auto_attached')
    ) {
      return {
        key: 'matched',
        label: '自動添付',
        icon: '✅',
        score: null
      };
    }

    if (waybill && waybill.match_status === 'review') {
      return {
        key: 'review',
        label: '要確認',
        icon: '⚠️',
        score: null
      };
    }

    if (waybill && waybill.match_status === 'unmatched') {
      return {
        key: 'unmatched',
        label: '不一致',
        icon: '✕',
        score: null
      };
    }

    return {
      key: 'pending',
      label: '未判定',
      icon: '…',
      score: null
    };
  }

  function statusBadgeHtml(info) {
    const bg = {
      matched: '#e7f6ec',
      review: '#fff4d6',
      unmatched: '#fdeaea',
      pending: '#eef2f6'
    }[info.key] || '#eef2f6';

    const fg = {
      matched: '#126b34',
      review: '#8a5a00',
      unmatched: '#9a1f1f',
      pending: '#53657a'
    }[info.key] || '#53657a';

    return (
      '<span style="' +
      'display:inline-block;' +
      'padding:4px 8px;' +
      'border-radius:999px;' +
      'background:' + bg + ';' +
      'color:' + fg + ';' +
      'font-size:12px;' +
      'font-weight:700' +
      '">' +
      info.icon + ' ' + info.label +
      (info.score !== null ? ' ' + info.score + '点' : '') +
      '</span>'
    );
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

    const info = classifyWaybill(waybill);

    if (
      info.key === 'matched' &&
      waybill.storage_path
    ) {
      return (
        statusBadgeHtml(info) +
        ' <button class="mini v159-waybill-pdf" ' +
        'data-waybill-id="' + esc(waybill.id) + '">' +
        '📎 PDF</button>'
      );
    }

    return statusBadgeHtml(info);
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

    const info = classifyWaybill(waybill);
    const score = info.score;
    const attached =
      info.key === 'matched' &&
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


  function closeReviewModal() {
    const old = document.getElementById('v159WaybillReviewModal');
    if (old) old.remove();
  }

  function openReviewModal() {
    closeReviewModal();

    const counts = {
      matched: 0,
      review: 0,
      unmatched: 0,
      pending: 0
    };

    waybillCache.forEach(function (w) {
      const info = classifyWaybill(w);
      counts[info.key] = (counts[info.key] || 0) + 1;
    });

    const rows = waybillCache
      .slice()
      .sort(function (a, b) {
        const ad = String(a.received_at || '');
        const bd = String(b.received_at || '');
        return bd.localeCompare(ad);
      })
      .map(function (w) {
        const info = classifyWaybill(w);
        const pdfButton = w.storage_path
          ? (
              '<button class="mini v159-waybill-pdf" ' +
              'data-waybill-id="' + esc(w.id) + '">' +
              'PDF</button>'
            )
          : '';

        return (
          '<tr>' +
            '<td>' + statusBadgeHtml(info) + '</td>' +
            '<td>' + esc(w.matched_shipment_id || '—') + '</td>' +
            '<td>' + esc(w.matched_product || '—') + '</td>' +
            '<td>' + esc(w.original_filename || '') + '</td>' +
            '<td>' + pdfButton + '</td>' +
          '</tr>'
        );
      })
      .join('');

    const wrap = document.createElement('div');
    wrap.id = 'v159WaybillReviewModal';
    wrap.style.position = 'fixed';
    wrap.style.inset = '0';
    wrap.style.zIndex = '99999';
    wrap.style.background = 'rgba(15,23,42,.45)';
    wrap.style.padding = '20px';
    wrap.style.overflow = 'auto';

    wrap.innerHTML =
      '<div style="' +
        'max-width:980px;' +
        'margin:20px auto;' +
        'background:#fff;' +
        'border-radius:16px;' +
        'padding:18px;' +
        'box-shadow:0 18px 50px rgba(0,0,0,.2)' +
      '">' +
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:center">' +
          '<h2 style="margin:0">📎 浜中運輸送り状 照合状況</h2>' +
          '<button class="btn secondary" id="v159WaybillReviewClose">閉じる</button>' +
        '</div>' +

        '<div style="display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px;margin:14px 0">' +
          '<div class="card" style="padding:12px"><b>✅ 自動添付</b><div style="font-size:24px;font-weight:700">' + counts.matched + '</div><small>90点以上</small></div>' +
          '<div class="card" style="padding:12px"><b>⚠️ 要確認</b><div style="font-size:24px;font-weight:700">' + counts.review + '</div><small>70〜89点</small></div>' +
          '<div class="card" style="padding:12px"><b>✕ 不一致</b><div style="font-size:24px;font-weight:700">' + counts.unmatched + '</div><small>69点以下</small></div>' +
          '<div class="card" style="padding:12px"><b>… 未判定</b><div style="font-size:24px;font-weight:700">' + counts.pending + '</div><small>解析・照合待ち</small></div>' +
        '</div>' +

        '<div class="tablewrap">' +
          '<table style="min-width:900px">' +
            '<tr>' +
              '<th>判定</th>' +
              '<th>出荷指示</th>' +
              '<th>昆布</th>' +
              '<th>FAX PDF</th>' +
              '<th>開く</th>' +
            '</tr>' +
            (rows || '<tr><td colspan="5" class="empty">送り状はありません</td></tr>') +
          '</table>' +
        '</div>' +
      '</div>';

    document.body.appendChild(wrap);

    const close = document.getElementById('v159WaybillReviewClose');
    if (close) close.onclick = closeReviewModal;

    wrap.addEventListener('click', function (e) {
      if (e.target === wrap) closeReviewModal();
    });

    bindWaybillButtons(wrap);
  }

  function patchReviewButton() {
    const headings = Array.from(document.querySelectorAll('h2'));

    const target = headings.find(function (h) {
      const text = String(h.textContent || '');
      return text.includes('出荷指示') || text.includes('出荷依頼');
    });

    if (!target) return;

    const card = target.closest('.card');
    if (!card) return;

    if (card.querySelector('.v159-waybill-review-open')) return;

    const btn = document.createElement('button');
    btn.className = 'mini v159-waybill-review-open';
    btn.textContent = '📎 送り状照合';
    btn.style.marginLeft = '8px';
    btn.onclick = async function () {
      await loadWaybills();
      openReviewModal();
    };

    const row = target.closest('.row');
    if (row) {
      row.appendChild(btn);
    } else {
      target.insertAdjacentElement('afterend', btn);
    }
  }

  async function refreshWaybills() {
    if (refreshing) return;
    refreshing = true;

    try {
      await loadWaybills();
      patchHistoryTable();
      patchShipmentDetail();
      patchReviewButton();
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
  window.kombuWaybillReviewOpen = async function () {
    await loadWaybills();
    openReviewModal();
  };

})();
