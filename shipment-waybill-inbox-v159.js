/* =========================================================
   昆布在庫管理
   送り状PDF連携 v159.8
   shipment_waybill_inbox 専用
   - 出荷履歴のPDF表示
   - 出荷指示詳細画面への浜中運輸送り状表示
   - match_status: matched / auto_attached 両対応
   ========================================================= */

(function () {
  'use strict';

  const TABLE_NAME = 'shipment_waybill_inbox';
  const BUCKET_NAME = 'shipment-waybill-inbox';
  const MANUAL_LINK_URL =
    'https://crltrozxztivkyxtjjxv.supabase.co/functions/v1/waybill-manual-link';
  const ERROR_LOG_URL =
    'https://crltrozxztivkyxtjjxv.supabase.co/functions/v1/waybill-error-log';
  const SYNC_TOKEN_KEY = 'kombu_sync_token_v1';

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

      // v2.16: 8列構成
      // 0依頼日 / 1昆布 / 2出荷人 / 3出荷先 / 4個数 /
      // 5状態 / 6送り状 / 7PDF
      // 状態欄は絶対に上書きしない。
      cells[6].innerHTML = makeWaybillCell(product, shipmentId);
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


  function readSyncToken() {
    return String(
      localStorage.getItem(SYNC_TOKEN_KEY) || ''
    ).trim();
  }

  async function manualLinkApi(action, payload) {
    const token = readSyncToken();

    if (!token) {
      throw new Error(
        '同期トークンが見つかりません。先に昆布在庫管理アプリで同期トークンを設定してください。'
      );
    }

    const res = await fetch(MANUAL_LINK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kombu-sync-token': token
      },
      body: JSON.stringify({
        action: action,
        ...payload
      })
    });

    const data = await res.json().catch(function () {
      return {
        ok: false,
        error: 'HTTP ' + res.status
      };
    });

    if (!res.ok || !data.ok) {
      throw new Error(
        data.error || ('HTTP ' + res.status)
      );
    }

    return data;
  }

  async function loadManualCandidates() {
    const data = await manualLinkApi(
      'candidates',
      {}
    );

    return Array.isArray(data.shipments)
      ? data.shipments
      : [];
  }

  function shipmentOptionLabel(s) {
    return [
      s.app_shipment_id,
      s.kombu_type,
      s.ship_date || '',
      (s.source_name || '') + ' → ' + (s.dest_name || ''),
      '数量 ' + Number(s.total_qty || 0)
    ].filter(Boolean).join('｜');
  }

  async function openManualLinkDialog(waybillId) {
    const waybill = waybillCache.find(function (w) {
      return String(w.id) === String(waybillId);
    });

    if (!waybill) return;

    const candidates = await loadManualCandidates();

    const overlay = document.createElement('div');
    overlay.id = 'v159ManualLinkDialog';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '100000';
    overlay.style.background = 'rgba(15,23,42,.5)';
    overlay.style.padding = '20px';
    overlay.style.overflow = 'auto';

    const options = candidates.map(function (s) {
      return (
        '<option value="' +
        esc(s.app_shipment_id) + '||' +
        esc(s.kombu_type) + '">' +
        esc(shipmentOptionLabel(s)) +
        '</option>'
      );
    }).join('');

    overlay.innerHTML =
      '<div style="' +
        'max-width:720px;' +
        'margin:60px auto;' +
        'background:#fff;' +
        'border-radius:16px;' +
        'padding:18px' +
      '">' +
        '<h2 style="margin-top:0">手動で出荷指示へ紐付け</h2>' +
        '<div style="font-size:13px;color:#627d98;margin-bottom:10px">' +
          esc(waybill.original_filename || '') +
        '</div>' +
        '<label style="display:block;font-weight:700;margin-bottom:6px">' +
          '出荷指示を選択' +
        '</label>' +
        '<select id="v159ManualShipmentSelect" style="' +
          'width:100%;padding:10px;border:1px solid #ccd6e2;border-radius:8px' +
        '">' +
          options +
        '</select>' +
        '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' +
          '<button class="btn" id="v159ManualLinkSave">この出荷指示に添付</button>' +
          '<button class="btn secondary" id="v159ManualLinkCancel">キャンセル</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    const cancel = document.getElementById('v159ManualLinkCancel');
    if (cancel) cancel.onclick = function () {
      overlay.remove();
    };

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    const save = document.getElementById('v159ManualLinkSave');
    if (save) save.onclick = async function () {
      const select = document.getElementById('v159ManualShipmentSelect');
      const value = String(select?.value || '');
      const parts = value.split('||');
      const shipmentId = parts[0] || '';
      const kombuType = parts.slice(1).join('||') || '';

      if (!shipmentId) {
        alert('出荷指示を選択してください。');
        return;
      }

      if (!window.confirm(
        shipmentId + ' にこの送り状PDFを紐付けます。よろしいですか？'
      )) {
        return;
      }

      save.disabled = true;
      save.textContent = '保存中…';

      try {
        await manualLinkApi('link', {
          waybill_inbox_id: waybill.id,
          app_shipment_id: shipmentId,
          kombu_type: kombuType
        });

        overlay.remove();
        await refreshWaybills();
        closeReviewModal();
        openReviewModal();

        alert('手動紐付けしました。');
      } catch (e) {
        alert(
          '手動紐付けに失敗しました。\n' +
          String(e?.message || e)
        );
      } finally {
        save.disabled = false;
        save.textContent = 'この出荷指示に添付';
      }
    };
  }

  async function unlinkWaybill(waybillId) {
    const waybill = waybillCache.find(function (w) {
      return String(w.id) === String(waybillId);
    });

    if (!waybill) return;

    if (!window.confirm(
      'この送り状と出荷指示の紐付けを解除します。よろしいですか？'
    )) {
      return;
    }

    try {
      await manualLinkApi('unlink', {
        waybill_inbox_id: waybill.id
      });

      await refreshWaybills();
      closeReviewModal();
      openReviewModal();

      alert('紐付けを解除しました。');
    } catch (e) {
      alert(
        '紐付け解除に失敗しました。\n' +
        String(e?.message || e)
      );
    }
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

    let actionButton = '';

    if (
      info.key === 'review' ||
      info.key === 'unmatched' ||
      info.key === 'pending'
    ) {
      actionButton =
        '<button class="mini v159-waybill-manual-link" ' +
        'data-waybill-id="' + esc(w.id) + '">' +
        '手動紐付け</button>';
    } else if (info.key === 'matched') {
      actionButton =
        '<button class="mini secondary v159-waybill-unlink" ' +
        'data-waybill-id="' + esc(w.id) + '">' +
        '解除</button>';
    }

    return (
      '<tr>' +
        '<td>' + statusBadgeHtml(info) + '</td>' +
        '<td>' + esc(w.matched_shipment_id || '—') + '</td>' +
        '<td>' + esc(w.matched_product || '—') + '</td>' +
        '<td>' + esc(w.original_filename || '') + '</td>' +
        '<td style="white-space:nowrap">' +
          pdfButton +
          (pdfButton && actionButton ? ' ' : '') +
          actionButton +
        '</td>' +
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
            '<th>操作</th>' +
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

    // 手動紐付けボタン
    wrap.querySelectorAll('.v159-waybill-manual-link')
      .forEach(function (button) {
        button.onclick = async function () {
          try {
            await openManualLinkDialog(
              button.dataset.waybillId
            );
          } catch (e) {
            alert(
              '候補の取得に失敗しました。\n' +
              String(e?.message || e)
            );
          }
        };
      });

    // 紐付け解除ボタン
    wrap.querySelectorAll('.v159-waybill-unlink')
      .forEach(function (button) {
        button.onclick = function () {
          unlinkWaybill(
            button.dataset.waybillId
          );
        };
      });
  }



  async function errorLogApi(action, payload) {
    const token = readSyncToken();

    if (!token) {
      throw new Error(
        '同期トークンが見つかりません。'
      );
    }

    const res = await fetch(ERROR_LOG_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kombu-sync-token': token
      },
      body: JSON.stringify({
        action: action,
        ...payload
      })
    });

    const data = await res.json().catch(function () {
      return {
        ok: false,
        error: 'HTTP ' + res.status
      };
    });

    if (!res.ok || !data.ok) {
      throw new Error(
        data.error || ('HTTP ' + res.status)
      );
    }

    return data;
  }

  function errorSourceLabel(source) {
    return {
      gmail: 'Gmail',
      ingest: '取込',
      ocr: 'AI解析/OCR',
      match: '照合',
      manual: '手動紐付け',
      app: 'アプリ'
    }[source] || source || '不明';
  }

  function formatErrorTime(v) {
    if (!v) return '';
    try {
      return new Date(v).toLocaleString('ja-JP');
    } catch (e) {
      return String(v);
    }
  }

  async function openErrorListModal() {
    const old = document.getElementById('v159ErrorListModal');
    if (old) old.remove();

    // 既存の ai_error / match_error も一度同期
    try {
      await errorLogApi('sync-existing', {});
    } catch (e) {
      console.warn('既存エラー同期スキップ:', e);
    }

    const data = await errorLogApi('list', {
      status: 'open'
    });

    const errors = Array.isArray(data.errors)
      ? data.errors
      : [];

    const rows = errors.map(function (e) {
      return (
        '<tr>' +
          '<td>' + esc(formatErrorTime(e.occurred_at)) + '</td>' +
          '<td><b>' + esc(errorSourceLabel(e.source)) + '</b></td>' +
          '<td>' + esc(e.original_filename || '—') + '</td>' +
          '<td style="max-width:420px;white-space:normal">' +
            esc(e.error_message || '') +
          '</td>' +
          '<td>' +
            '<button class="mini v159-error-resolve" ' +
            'data-error-id="' + esc(e.id) + '">' +
            '解決済みにする' +
            '</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    const overlay = document.createElement('div');
    overlay.id = 'v159ErrorListModal';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '100001';
    overlay.style.background = 'rgba(15,23,42,.5)';
    overlay.style.padding = '20px';
    overlay.style.overflow = 'auto';

    overlay.innerHTML =
      '<div style="' +
        'max-width:1100px;' +
        'margin:30px auto;' +
        'background:#fff;' +
        'border-radius:16px;' +
        'padding:18px' +
      '">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center">' +
          '<div>' +
            '<h2 style="margin:0">🚨 送り状エラー一覧</h2>' +
            '<div style="font-size:12px;color:#627d98;margin-top:4px">' +
              'Gmail・取込・AI解析・照合のエラーだけを表示します。' +
            '</div>' +
          '</div>' +
          '<button class="btn secondary" id="v159ErrorListClose">閉じる</button>' +
        '</div>' +

        '<div style="margin:14px 0;font-weight:700">' +
          '未解決：' + errors.length + '件' +
        '</div>' +

        '<div class="tablewrap">' +
          '<table style="min-width:900px">' +
            '<tr>' +
              '<th>発生日時</th>' +
              '<th>種類</th>' +
              '<th>PDF</th>' +
              '<th>エラー内容</th>' +
              '<th>操作</th>' +
            '</tr>' +
            (
              rows ||
              '<tr><td colspan="5" class="empty">現在、未解決エラーはありません。</td></tr>'
            ) +
          '</table>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    const close = document.getElementById('v159ErrorListClose');
    if (close) close.onclick = function () {
      overlay.remove();
    };

    overlay.addEventListener('click', function (ev) {
      if (ev.target === overlay) overlay.remove();
    });

    overlay.querySelectorAll('.v159-error-resolve')
      .forEach(function (button) {
        button.onclick = async function () {
          if (!window.confirm(
            'このエラーを解決済みにしますか？'
          )) {
            return;
          }

          try {
            await errorLogApi('resolve', {
              id: button.dataset.errorId
            });
            overlay.remove();
            await openErrorListModal();
          } catch (e) {
            alert(
              '更新に失敗しました。\n' +
              String(e?.message || e)
            );
          }
        };
      });
  }

  function makeErrorListButton() {
    const errBtn = document.createElement('button');
    errBtn.className = 'mini v159-error-list-open';
    errBtn.textContent = '🚨 エラー一覧';
    errBtn.style.marginLeft = '8px';

    errBtn.onclick = async function () {
      try {
        await openErrorListModal();
      } catch (e) {
        alert(
          'エラー一覧を取得できませんでした。\n' +
          String(e?.message || e)
        );
      }
    };

    return errBtn;
  }

  function patchReviewButton() {
    const historyCard=document.querySelector('.v159-history-card');
    if(!historyCard)return;

    let tools=document.getElementById('v159HistoryTools');
    if(!tools){
      tools=document.createElement('div');
      tools.id='v159HistoryTools';
      tools.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;align-items:center';

      const review=document.createElement('button');
      review.className='btn secondary v159-waybill-review-open';
      review.style.cssText='width:auto;padding:9px 12px';
      review.onclick=async function(){
        await loadWaybills();
        openReviewModal();
      };

      let exceptionCount=0;
      waybillCache.forEach(function(x){
        const k=classifyWaybill(x).key;
        if(k==='review'||k==='unmatched')exceptionCount++;
      });
      review.textContent=exceptionCount>0
        ? '⚠ 送り状確認 ('+exceptionCount+')'
        : '📎 送り状確認';

      const err=makeErrorListButton();
      err.className='btn secondary v159-error-list-open';
      err.style.cssText='width:auto;padding:9px 12px;margin-left:0';

      tools.appendChild(review);
      tools.appendChild(err);
      historyCard.insertBefore(tools,historyCard.firstChild);
    }else{
      const review=tools.querySelector('.v159-waybill-review-open');
      if(review){
        let exceptionCount=0;
        waybillCache.forEach(function(x){
          const k=classifyWaybill(x).key;
          if(k==='review'||k==='unmatched')exceptionCount++;
        });
        review.textContent=exceptionCount>0
          ? '⚠ 送り状確認 ('+exceptionCount+')'
          : '📎 送り状確認';
      }
    }
  }


  async function refreshWaybills() {
    if (refreshing) return;
    refreshing = true;

    try {
      await loadWaybills();
      patchHistoryTable();
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

        return false;
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

  window.KOMBU_WAYBILL_UI_VERSION = '160.0';
  window.kombuWaybillInboxRefresh = refreshWaybills;
  window.kombuWaybillReviewOpen = async function () {
    await loadWaybills();
    openReviewModal();
  };
  window.kombuWaybillErrorListOpen = async function () {
    await openErrorListModal();
  };

})();
