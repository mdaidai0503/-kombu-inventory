/* =========================================================
   昆布在庫管理
   送り状PDF連携 v161.0（論理ブロック別・複数PDF/複数依頼候補対応）
   shipment_waybill_inbox 専用
   - 出荷履歴のPDF表示
   - 出荷指示詳細画面への浜中運輸送り状表示
   - match_status: matched / auto_attached 両対応
   ========================================================= */

(function () {
  'use strict';

  const TABLE_NAME = 'shipment_waybill_inbox';
  const LINK_TABLE_NAME = 'shipment_waybill_links';
  const BUCKET_NAME = 'shipment-waybill-inbox';
  const MANUAL_LINK_URL =
    'https://crltrozxztivkyxtjjxv.supabase.co/functions/v1/waybill-manual-link';
  const ERROR_LOG_URL =
    'https://crltrozxztivkyxtjjxv.supabase.co/functions/v1/waybill-error-log';
  const SYNC_TOKEN_KEY = 'kombu_sync_token_v1';

  let waybillCache = [];
  let waybillLinkCache = [];
  let refreshTimer = null;
  let refreshing = false;
  let waybillCacheLoaded = false;

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
    const linkScore =
      waybill &&
      waybill.__waybill_link &&
      Number(waybill.__waybill_link.score);

    if (Number.isFinite(linkScore)) {
      return linkScore;
    }

    const p = waybill && waybill.parsed_data;
    const score =
      p && p.match && p.match.best
        ? Number(p.match.best.score)
        : NaN;

    return Number.isFinite(score) ? score : null;
  }

  function classifyWaybill(waybill) {
    // v160.8:
    // match_status を判定の正本として最優先する。
    //
    // 特に needs_review なのに best.score >= 90 の場合、
    // 以前はスコア判定が先に走って「自動添付」扱いになり、
    // 送り状確認から消えていた。
    //
    // 現在は:
    // matched / auto_attached → 添付済み
    // review / needs_review    → 要確認
    // unmatched               → 不一致
    // それ以外の旧データだけ score で補完判定
    if (waybill) {
      if (
        waybill.match_status === 'matched' ||
        waybill.match_status === 'auto_attached'
      ) {
        const score = getScore(waybill);
        const manualLinked = !!(
          waybill.parsed_data &&
          waybill.parsed_data.manual_link &&
          waybill.parsed_data.manual_link.linked === true
        );

        return {
          key: 'matched',
          label: manualLinked ? '添付済み' : '自動添付',
          icon: '✅',
          score: manualLinked ? null : score
        };
      }

      if (
        waybill.match_status === 'review' ||
        waybill.match_status === 'needs_review'
      ) {
        return {
          key: 'review',
          label: '要確認',
          icon: '⚠️',
          score: getScore(waybill)
        };
      }

      if (waybill.match_status === 'unmatched') {
        return {
          key: 'unmatched',
          label: '不一致',
          icon: '✕',
          score: getScore(waybill)
        };
      }
    }

    // 旧データ互換:
    // match_status が未設定などの場合だけ、保存済みスコアから補完する。
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

    const [waybillResult, linkResult] = await Promise.all([
      sb
        .from(TABLE_NAME)
        .select(
          'id,storage_path,original_filename,match_status,matched_product,matched_shipment_id,received_at,shipping_date,parsed_data'
        )
        .order('received_at', { ascending: false }),

      sb
        .from(LINK_TABLE_NAME)
        .select(
          'id,waybill_inbox_id,app_shipment_id,product_code,score,decision,is_primary,match_detail,created_at,updated_at'
        )
    ]);

    if (waybillResult.error) {
      console.error('送り状一覧取得エラー:', waybillResult.error);
      return [];
    }

    // 新しい複数紐付けテーブルの取得に失敗しても、
    // 既存 matched_shipment_id 方式へフォールバックして画面を壊さない。
    if (linkResult.error) {
      console.warn(
        '複数送り状リンク取得エラー。従来方式で続行します:',
        linkResult.error
      );
      waybillLinkCache = [];
    } else {
      waybillLinkCache =
        Array.isArray(linkResult.data) ? linkResult.data : [];
    }

    waybillCache =
      Array.isArray(waybillResult.data) ? waybillResult.data : [];
    waybillCacheLoaded = true;

    return waybillCache;
  }

  function linksForWaybill(waybillId) {
    return waybillLinkCache.filter(function (link) {
      return String(link.waybill_inbox_id || '') === String(waybillId || '');
    });
  }

  function findLinkForShipment(product, shipmentId) {
    const idText = String(shipmentId || '');
    const productText = String(product || '');

    // v160.5:
    // 出荷指示番号は商品種類をまたいで重複するため、
    // app_shipment_id + product_code の完全一致だけを採用する。
    if (!idText || !productText) return null;

    return waybillLinkCache.find(function (link) {
      return (
        String(link.app_shipment_id || '') === idText &&
        String(link.product_code || '') === productText
      );
    }) || null;
  }

  function findWaybill(product, shipmentId) {
    // v160.4:
    // 新しい shipment_waybill_links を最優先。
    // 1枚の送り状が複数出荷指示へ紐付いていても、
    // 各出荷履歴から同じPDFを参照できる。
    const link = findLinkForShipment(product, shipmentId);

    if (link) {
      const linkedWaybill = waybillCache.find(function (w) {
        return String(w.id || '') === String(link.waybill_inbox_id || '');
      });

      if (linkedWaybill) {
        // 表示用スコアはリンク単位の95点等を優先できるよう、
        // 元レコードを壊さず一時情報だけ付加する。
        return Object.assign({}, linkedWaybill, {
          __waybill_link: link
        });
      }
    }

    // 後方互換:
    // shipment_waybill_links に無い過去データも、
    // matched_shipment_id + matched_product の両方一致時だけ表示する。
    // S00001 のような番号が釧路・釧棹で重複しても取り違えない。
    const idText = String(shipmentId || '');
    const productText = String(product || '');

    if (!idText || !productText) return null;

    return waybillCache.find(function (w) {
      return (
        String(w.matched_shipment_id || '') === idText &&
        String(w.matched_product || '') === productText
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
      // v160.7:
      // Supabaseキャッシュ取得前は既存セルを「未着」で上書きしない。
      // 並び替え直後のPDFボタン消失を防止する。
      if (!waybillCacheLoaded) {
        scheduleRefresh();
        return;
      }

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

  async function loadManualCandidates(waybillId) {
    const data = await manualLinkApi(
      'candidates',
      {
        waybill_inbox_id: waybillId || ''
      }
    );

    return {
      shipments: Array.isArray(data.shipments)
        ? data.shipments
        : [],
      allShipments: Array.isArray(data.all_shipments)
        ? data.all_shipments
        : (
            Array.isArray(data.shipments)
              ? data.shipments
              : []
          ),
      smartCandidatesUsed:
        data.smart_candidates_used === true
    };
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

  function scoredCandidatesFromWaybill(waybill) {
    const parsed = waybill && waybill.parsed_data ? waybill.parsed_data : {};
    const match = parsed.match || {};

    // v161.0:
    // 保存済み解析結果から「論理ブロック別」の候補を優先して読む。
    // Edge Function 側で block_candidates / logical_blocks / type_filter_blocks 等の
    // 名前で保存された場合にも対応する。PDFの再取得・Gmail再検索・OpenAI再解析はしない。
    const blockSources = [
      parsed.block_candidates,
      parsed.logical_blocks,
      parsed.match_blocks,
      parsed.type_filter_blocks,
      match.block_candidates,
      match.logical_blocks,
      match.blocks
    ].filter(Array.isArray);

    const rows = [];

    function pushCandidate(x, block, blockIndex) {
      if (!x || Number(x.score) < 90) return;

      const blockType = String(
        (block && (
          block.detected_kombu_type ||
          block.kombu_type ||
          block.product_code
        )) || ''
      );

      const candidateType = String(
        x.kombu_type || x.product_code || blockType || ''
      );

      // ブロックの昆布種類と候補の昆布種類が食い違う場合は除外。
      if (blockType && candidateType && blockType !== candidateType) return;
      if (!x.app_shipment_id || !candidateType) return;

      rows.push(Object.assign({}, x, {
        kombu_type: candidateType,
        __block_index: Number(
          (block && block.block_index) || blockIndex || 1
        ),
        __block_product_name: String(
          (block && (block.product_name || block.origin)) || ''
        ),
        __block_qty: Number(
          (block && block.total_qty) || x.line_qty || 0
        )
      }));
    }

    blockSources.forEach(function (blocks) {
      blocks.forEach(function (entry, idx) {
        const block = entry.block || entry;
        const candidates =
          Array.isArray(entry.candidates) ? entry.candidates :
          Array.isArray(block.candidates) ? block.candidates : [];

        candidates.forEach(function (x) {
          pushCandidate(x, block, idx + 1);
        });
      });
    });

    // 従来形式も後方互換として利用。
    if (!rows.length) {
      const direct =
        Array.isArray(match.multiple_matches)
          ? match.multiple_matches
          : [];

      const nested =
        match.multiple_match &&
        Array.isArray(match.multiple_match.matches)
          ? match.multiple_match.matches
          : [];

      const src = direct.length ? direct : nested;
      src.forEach(function (x) {
        pushCandidate(x, null, 1);
      });
    }

    const seen = new Set();

    return rows
      .filter(function (x) {
        // 同一PDF内でも、論理ブロックが違えば同じ出荷依頼を候補として保持できる。
        const key =
          String(x.__block_index || 1) + '||' +
          String(x.app_shipment_id || '') + '||' +
          String(x.kombu_type || '');

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort(function (a, b) {
        if (Number(a.__block_index || 0) !== Number(b.__block_index || 0)) {
          return Number(a.__block_index || 0) - Number(b.__block_index || 0);
        }
        return Number(b.score || 0) - Number(a.score || 0);
      });
  }

  function mergeScoredCandidate(scoreRow, shipment) {
    return Object.assign({}, shipment || {}, {
      app_shipment_id: scoreRow.app_shipment_id,
      kombu_type: scoreRow.kombu_type,
      __waybill_score: Number(scoreRow.score || 0),
      __score_breakdown: scoreRow.score_breakdown || {},
      __line_qty: Number(scoreRow.line_qty || 0),
      __block_index: Number(scoreRow.__block_index || 1),
      __block_product_name: scoreRow.__block_product_name || '',
      __block_qty: Number(scoreRow.__block_qty || 0)
    });
  }

  function candidateOptionLabel(s) {
    const score = Number(s && s.__waybill_score);
    const prefix =
      Number.isFinite(score) && score > 0
        ? '【' + score + '点】'
        : '';

    const blockText = s.__block_index
      ? 'ブロック' + s.__block_index +
        (s.__block_product_name ? ' ' + s.__block_product_name : '')
      : '';

    return [
      blockText,
      prefix,
      s.app_shipment_id,
      s.combined_kombu_types || s.kombu_type,
      s.ship_date || '',
      (s.source_name || '') + ' → ' + (s.dest_name || ''),
      '合計 ' + Number(
        s.combined_total_qty ||
        s.total_qty ||
        s.__block_qty ||
        s.__line_qty ||
        0
      )
    ].filter(Boolean).join('｜');
  }

  async function openManualLinkDialog(waybillId) {
    const waybill = waybillCache.find(function (w) {
      return String(w.id) === String(waybillId);
    });

    if (!waybill) return;

    const candidateData = await loadManualCandidates(waybill.id);
    const allCandidates = candidateData.allShipments;
    const smartCandidates = candidateData.smartCandidatesUsed
      ? candidateData.shipments
      : [];

    const scoredRows = smartCandidates.length
      ? []
      : scoredCandidatesFromWaybill(waybill);

    const scoredCandidates = scoredRows.map(function (scoreRow) {
      const full = allCandidates.find(function (s) {
        return (
          String(s.app_shipment_id || '') === String(scoreRow.app_shipment_id || '') &&
          String(s.kombu_type || '') === String(scoreRow.kombu_type || '')
        );
      });

      return mergeScoredCandidate(scoreRow, full);
    });

    let candidates = smartCandidates.length
      ? smartCandidates
      : (scoredCandidates.length ? scoredCandidates : allCandidates);

    const overlay = document.createElement('div');
    overlay.id = 'v159ManualLinkDialog';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '100000';
    overlay.style.background = 'rgba(15,23,42,.5)';
    overlay.style.padding = '20px';
    overlay.style.overflow = 'auto';

    function candidateKey(s, idx) {
      return [
        s.app_shipment_id || '',
        s.kombu_type || '',
        s.__block_index || 0,
        idx
      ].join('||');
    }

    function buildCandidateRows(list) {
      if (!list.length) {
        return '<div class="empty" style="padding:14px">候補がありません。</div>';
      }

      return list.map(function (s, idx) {
        const key = candidateKey(s, idx);
        return (
          '<label style="' +
            'display:flex;gap:10px;align-items:flex-start;' +
            'padding:10px;border:1px solid #dbe3ec;border-radius:9px;' +
            'margin-bottom:8px;cursor:pointer' +
          '">' +
            '<input type="checkbox" class="v161-manual-candidate" ' +
              'data-key="' + esc(key) + '" ' +
              'style="margin-top:3px;transform:scale(1.15)">' +
            '<span style="line-height:1.45">' +
              esc(candidateOptionLabel(s)) +
            '</span>' +
          '</label>'
        );
      }).join('');
    }

    function renderCandidateRows() {
      const box = document.getElementById('v161ManualCandidateList');
      if (box) box.innerHTML = buildCandidateRows(candidates);
    }

    overlay.innerHTML =
      '<div style="' +
        'max-width:820px;' +
        'margin:40px auto;' +
        'background:#fff;' +
        'border-radius:16px;' +
        'padding:18px' +
      '">' +
        '<h2 style="margin-top:0">送り状PDFの添付候補を選択</h2>' +
        '<div style="font-size:13px;color:#627d98;margin-bottom:10px">' +
          esc(waybill.original_filename || '') +
        '</div>' +
        '<div style="padding:10px 12px;background:#eef6ff;border-radius:9px;' +
          'font-size:13px;line-height:1.6;margin-bottom:12px">' +
          '<b>複数選択できます。</b><br>' +
          '1件の送り状PDFに複数の出荷依頼が含まれる場合は、該当する候補をすべて選択してください。' +
          'また、同じ出荷依頼に別の送り状PDFを追加で添付することもできます。' +
        '</div>' +
        '<div style="font-weight:700;margin-bottom:8px">' +
          ((smartCandidates.length || scoredCandidates.length)
            ? '照合候補（90点以上・昆布種類一致）'
            : '出荷指示を選択') +
        '</div>' +
        '<div id="v161ManualCandidateList" style="max-height:430px;overflow:auto">' +
          buildCandidateRows(candidates) +
        '</div>' +
        ((smartCandidates.length || scoredCandidates.length)
          ? '<button type="button" class="mini secondary" id="v159ManualShowAll" ' +
              'style="margin-top:8px">すべての出荷指示から選ぶ</button>'
          : '') +
        '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' +
          '<button class="btn" id="v159ManualLinkSave">選択した候補に添付</button>' +
          '<button class="btn secondary" id="v159ManualLinkCancel">キャンセル</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    const showAll = document.getElementById('v159ManualShowAll');
    if (showAll) showAll.onclick = function () {
      candidates = allCandidates;
      renderCandidateRows();
      showAll.remove();
    };

    const cancel = document.getElementById('v159ManualLinkCancel');
    if (cancel) cancel.onclick = function () {
      overlay.remove();
    };

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    const save = document.getElementById('v159ManualLinkSave');
    if (save) save.onclick = async function () {
      const checked = Array.from(
        overlay.querySelectorAll('.v161-manual-candidate:checked')
      );

      if (!checked.length) {
        alert('添付する候補を1件以上選択してください。');
        return;
      }

      const selected = checked.map(function (input) {
        const key = String(input.dataset.key || '');
        return candidates.find(function (s, idx) {
          return candidateKey(s, idx) === key;
        });
      }).filter(Boolean);

      const confirmText = selected.map(function (s) {
        return '・' + candidateOptionLabel(s);
      }).join('\n');

      if (!window.confirm(
        'この送り状PDFを次の ' + selected.length +
        ' 件へ添付します。\n\n' + confirmText +
        '\n\nよろしいですか？'
      )) {
        return;
      }

      save.disabled = true;
      save.textContent = '保存中…';

      try {
        // 既存APIを1件ずつ呼ぶ。
        // shipment_waybill_links が複数行を保持するため、
        // 1 PDF → 複数出荷依頼を安全に登録できる。
        for (const s of selected) {
          await manualLinkApi('link', {
            waybill_inbox_id: waybill.id,
            app_shipment_id: s.app_shipment_id || '',
            kombu_type: s.kombu_type || s.product_code || ''
          });
        }

        overlay.remove();
        await refreshWaybills();
        closeReviewModal();
        openReviewModal();

        alert(
          selected.length === 1
            ? '送り状PDFを添付しました。'
            : '送り状PDFを ' + selected.length + ' 件の出荷依頼へ添付しました。'
        );
      } catch (e) {
        alert(
          '手動紐付けに失敗しました。\n' +
          String(e?.message || e)
        );
      } finally {
        save.disabled = false;
        save.textContent = '選択した候補に添付';
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
    const multiLinks = linksForWaybill(w.id);

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
      // v161.0:
      // 添付済みでも追加候補を選択できる。
      // これにより 1 PDF → 複数依頼、1依頼 → 複数PDF の双方を許可する。
      actionButton =
        '<button class="mini v159-waybill-manual-link" ' +
        'data-waybill-id="' + esc(w.id) + '">' +
        '追加添付</button>';

      if (multiLinks.length === 1) {
        actionButton +=
          ' <button class="mini secondary v159-waybill-unlink" ' +
          'data-waybill-id="' + esc(w.id) + '">' +
          '解除</button>';
      } else if (multiLinks.length > 1) {
        actionButton +=
          ' <span style="font-size:12px;font-weight:700;color:#126b34">' +
          multiLinks.length + '件紐付け済み</span>';
      }
    }

    const shipmentDisplay =
      multiLinks.length > 0
        ? multiLinks.map(function (x) {
            return x.app_shipment_id;
          }).filter(Boolean).join(' / ')
        : (w.matched_shipment_id || '—');

    const productDisplay =
      multiLinks.length > 0
        ? multiLinks.map(function (x) {
            return x.product_code;
          }).filter(Boolean).join(' / ')
        : (w.matched_product || '—');

    return (
      '<tr>' +
        '<td>' + statusBadgeHtml(info) + '</td>' +
        '<td>' + esc(shipmentDisplay) + '</td>' +
        '<td>' + esc(productDisplay) + '</td>' +
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

  async function deletePendingWaybills() {
    const pendingItems = waybillCache.filter(function (w) {
      return classifyWaybill(w).key === 'pending';
    });

    if (!pendingItems.length) {
      alert('削除する過去の未判定はありません。');
      return;
    }

    if (!window.confirm(
      '過去の未判定 ' + pendingItems.length + '件だけを削除します。\n' +
      '出荷依頼履歴・在庫・入出庫履歴・会社マスターは削除しません。\n\n' +
      'よろしいですか？'
    )) {
      return;
    }

    const sb = client();
    if (!sb) {
      alert('Supabaseへ接続できません。');
      return;
    }

    const ids = pendingItems.map(function (w) {
      return w.id;
    });

    const result = await sb
      .from(TABLE_NAME)
      .delete()
      .in('id', ids);

    if (result.error) {
      console.error('過去の未判定削除エラー:', result.error);
      alert(
        '過去の未判定を削除できませんでした。\n' +
        String(result.error.message || result.error)
      );
      return;
    }

    await refreshWaybills();
    closeReviewModal();
    openReviewModal();

    alert('過去の未判定 ' + pendingItems.length + '件を削除しました。');
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
            '<small>候補複数・要確認判定</small>' +
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
            (
              groups.pending.length
                ? '<div style="margin-bottom:10px">' +
                  '<button class="btn secondary" id="v159DeletePendingWaybills" ' +
                  'style="width:auto;padding:8px 12px">' +
                  '🧹 過去の未判定だけ削除（' + groups.pending.length + '件）' +
                  '</button>' +
                  '</div>'
                : ''
            ) +
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

    const deletePendingButton =
      document.getElementById('v159DeletePendingWaybills');

    if (deletePendingButton) {
      deletePendingButton.onclick = async function () {
        deletePendingButton.disabled = true;
        try {
          await deletePendingWaybills();
        } finally {
          deletePendingButton.disabled = false;
        }
      };
    }

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
      const target = m && m.target;

      if (
        target &&
        target.nodeType === 1 &&
        (
          target.id === 'v136HistBody' ||
          (target.closest && target.closest('#v136HistBody'))
        )
      ) {
        return true;
      }

      return Array.from(m.addedNodes || []).some(function (node) {
        if (!node || node.nodeType !== 1) return false;

        return (
          node.id === 'v136HistBody' ||
          (node.closest && node.closest('#v136HistBody')) ||
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
  window.addEventListener('load', scheduleRefresh);

  window.KOMBU_WAYBILL_UI_VERSION = '161.0';
  window.kombuWaybillInboxRefresh = refreshWaybills;
  window.kombuWaybillPatchHistory = patchHistoryTable;
  window.kombuWaybillReviewOpen = async function () {
    await loadWaybills();
    openReviewModal();
  };
  window.kombuWaybillErrorListOpen = async function () {
    await openErrorListModal();
  };

})();
