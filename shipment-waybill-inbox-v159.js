/* =========================================================
   昆布在庫管理
   送り状PDF連携 v159.4
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
    const scoreText = info.score !== null ? info.score + '点' : '';

    if (info.key === 'matched' && waybill.storage_path) {
      return (
        '<button class="mini v159-waybill-pdf" ' +
        'data-waybill-id="' + esc(waybill.id) + '" ' +
        'style="white-space:nowrap">' +
        '✅ ' + scoreText + ' PDF' +
        '</button>'
      );
    }

    if (info.key === 'review') {
      return (
        '<span style="white-space:nowrap;font-weight:700;color:#8a5a00">' +
        '⚠ ' + (scoreText || '要確認') +
        '</span>'
      );
    }

    if (info.key === 'unmatched') {
      return (
        '<span style="white-space:nowrap;font-weight:700;color:#9a1f1f">' +
        '✕ ' + (scoreText || '不一致') +
        '</span>'
      );
    }

    return '<span class="muted">未判定</span>';
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
    if (!waybill) return;

    const info = classifyWaybill(waybill);
    const scoreText =
      info.score !== null ? info.score + '点' : '';

    const box = document.createElement('div');
    box.className = 'v159-waybill-detail';
    box.style.marginTop = '10px';
    box.style.padding = '9px 12px';
    box.style.border = '1px solid #d6dee8';
    box.style.borderRadius = '9px';
    box.style.background = '#f8fafc';
    box.style.display = 'flex';
    box.style.alignItems = 'center';
    box.style.justifyContent = 'space-between';
    box.style.gap = '10px';
    box.style.flexWrap = 'wrap';

    let stateText = '';
    if (info.key === 'matched') {
      stateText =
        '<span style="font-weight:700;color:#126b34">✅ 自動照合' +
        (scoreText ? ' ' + scoreText : '') +
        '</span>';
    } else if (info.key === 'review') {
      stateText =
        '<span style="font-weight:700;color:#8a5a00">⚠ 要確認' +
        (scoreText ? ' ' + scoreText : '') +
        '</span>';
    } else if (info.key === 'unmatched') {
      stateText =
        '<span style="font-weight:700;color:#9a1f1f">✕ 不一致' +
        (scoreText ? ' ' + scoreText : '') +
        '</span>';
    } else {
      stateText =
        '<span style="font-weight:700;color:#53657a">… 未判定</span>';
    }

    const pdfButton = waybill.storage_path
      ? (
          '<button class="mini v159-waybill-pdf" ' +
          'data-waybill-id="' + esc(waybill.id) + '">' +
          'PDFを開く</button>'
        )
      : '';

    box.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
        '<b>📎 浜中運輸送り状</b>' +
        stateText +
      '</div>' +
      pdfButton;

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

  function makeReviewRow(w) {
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
  }

  function tableHtml(items, emptyText) {
    return (
      '<div class="tablewrap">' +
        '<table style="min-width:760px">' +
          '<tr>' +
            '<th>判定</th>' +
            '<th>出荷指示</th>' +
            '<th>昆布</th>' +
            '<th>FAX PDF</th>' +
            '<th>開く</th>' +
          '</tr>' +
          (
            items.length
              ? items.map(makeReviewRow).join('')
              : '<tr><td colspan="5" class="empty">' +
                esc(emptyText) +
                '</td></tr>'
          ) +
        '</table>' +
      '</div>'
    );
  }

  function openReviewModal() {
    closeReviewModal();

    const sorted = waybillCache
      .slice()
      .sort(function (a, b) {
        return String(b.received_at || '')
          .localeCompare(String(a.received_at || ''));
      });

    const groups = {
      matched: [],
      review: [],
      unmatched: [],
      pending: []
    };

    sorted.forEach(function (w) {
      const info = classifyWaybill(w);
      (groups[info.key] || groups.pending).push(w);
    });

    const exceptionItems =
      groups.review.concat(groups.unmatched);

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
          '<div>' +
            '<h2 style="margin:0">⚠ 送り状確認</h2>' +
            '<div style="font-size:12px;color:#627d98;margin-top:4px">' +
              '通常は確認が必要なFAXだけを表示します。' +
            '</div>' +
          '</div>' +
          '<button class="btn secondary" id="v159WaybillReviewClose">閉じる</button>' +
        '</div>' +

        '<div style="display:grid;grid-template-columns:repeat(2,minmax(150px,1fr));gap:10px;margin:14px 0">' +
          '<div class="card" style="padding:14px;border:1px solid #f0c96a">' +
            '<b>⚠ 要確認</b>' +
            '<div style="font-size:28px;font-weight:700;color:#8a5a00">' +
              groups.review.length +
            '</div>' +
            '<small>70〜89点</small>' +
          '</div>' +
          '<div class="card" style="padding:14px;border:1px solid #efb0b0">' +
            '<b>✕ 不一致</b>' +
            '<div style="font-size:28px;font-weight:700;color:#9a1f1f">' +
              groups.unmatched.length +
            '</div>' +
            '<small>69点以下</small>' +
          '</div>' +
        '</div>' +

        '<section style="margin-top:14px">' +
          '<h3 style="margin:0 0 8px">確認が必要なFAX</h3>' +
          tableHtml(
            exceptionItems,
            '現在、確認が必要な送り状はありません。'
          ) +
        '</section>' +

        '<details style="margin-top:16px;border-top:1px solid #e5eaf0;padding-top:12px">' +
          '<summary style="cursor:pointer;font-weight:700">' +
            '✅ 自動添付済みを表示（' + groups.matched.length + '件）' +
          '</summary>' +
          '<div style="margin-top:10px">' +
            tableHtml(groups.matched, '自動添付済みはありません。') +
          '</div>' +
        '</details>' +

        '<details style="margin-top:12px;border-top:1px solid #e5eaf0;padding-top:12px">' +
          '<summary style="cursor:pointer;font-weight:700;color:#627d98">' +
            '… 過去の未判定を表示（' + groups.pending.length + '件）' +
          '</summary>' +
          '<div style="margin-top:10px">' +
            '<div style="font-size:12px;color:#627d98;margin-bottom:8px">' +
              '過去取込分です。通常運用では開く必要はありません。' +
            '</div>' +
            tableHtml(groups.pending, '未判定はありません。') +
          '</div>' +
        '</details>' +

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

    const existing = card.querySelector('.v159-waybill-review-open');
    if (existing) existing.remove();

    let exceptionCount = 0;
    waybillCache.forEach(function (w) {
      const key = classifyWaybill(w).key;
      if (key === 'review' || key === 'unmatched') {
        exceptionCount++;
      }
    });

    const btn = document.createElement('button');
    btn.className = 'mini v159-waybill-review-open';
    btn.textContent =
      exceptionCount > 0
        ? '⚠ 送り状確認 (' + exceptionCount + ')'
        : '📎 送り状確認';

    if (exceptionCount > 0) {
      btn.style.fontWeight = '700';
    }

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
