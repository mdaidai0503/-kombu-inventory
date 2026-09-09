/* =========================================================
   昆布在庫管理 送り状要確認候補表示 v1.0
   ---------------------------------------------------------
   - Supabaseサーバー再照合で得た review_candidates を
     「送り状確認」の出荷指示 / 昆布 列へ表示する。
   - 既存の手動紐付け処理には干渉しない。
   ========================================================= */
(function () {
  'use strict';

  const PRODUCT_LABEL = {
    kushiro: '釧路',
    hidaka: '日高',
    nemuro: '根室',
    sanmae: '釧棹'
  };

  let applying = false;
  let lastRun = 0;

  function client() {
    return window.kombuSupabase || null;
  }

  function candidatesOf(row) {
    const parsed = row && row.parsed_data && typeof row.parsed_data === 'object'
      ? row.parsed_data
      : {};
    const match = parsed && matchObject(parsed.match);
    const xs = Array.isArray(match.review_candidates)
      ? match.review_candidates
      : [];
    return xs.filter(function (x) {
      return x && x.app_shipment_id && x.kombu_type;
    });
  }

  function matchObject(v) {
    return v && typeof v === 'object' ? v : {};
  }

  function unique(values) {
    return values.filter(function (v, i, a) {
      return v && a.indexOf(v) === i;
    });
  }

  function compactCandidateText(xs, field, formatter) {
    const vals = unique(xs.map(function (x) {
      const v = x[field];
      return formatter ? formatter(v) : String(v || '');
    }));

    if (!vals.length) return '—';
    if (vals.length <= 3) return '候補: ' + vals.join(' / ');
    return '候補: ' + vals.slice(0, 3).join(' / ') + ' ほか' + (vals.length - 3) + '件';
  }

  function filenameFromCell(cell) {
    if (!cell) return '';
    const text = String(cell.textContent || '').trim();
    const m = text.match(/FAX_[^\s]+\.pdf/i);
    return m ? m[0] : '';
  }

  async function applyCandidateDisplay(force) {
    const modal = document.getElementById('v159WaybillReviewModal');
    const sb = client();
    if (!modal || !sb || applying) return;

    const now = Date.now();
    if (!force && now - lastRun < 800) return;
    lastRun = now;
    applying = true;

    try {
      const result = await sb
        .from('shipment_waybill_inbox')
        .select('id,original_filename,match_status,matched_shipment_id,matched_product,parsed_data')
        .in('match_status', ['needs_review', 'review', 'unmatched'])
        .order('received_at', { ascending: false })
        .limit(300);

      if (result.error) {
        console.warn('[KOMBU candidate display] 取得失敗', result.error);
        return;
      }

      const map = new Map();
      (result.data || []).forEach(function (row) {
        if (row && row.original_filename) {
          map.set(String(row.original_filename), row);
        }
      });

      modal.querySelectorAll('table tr').forEach(function (tr) {
        const cells = tr.querySelectorAll('td');
        if (cells.length < 5) return;

        const filename = filenameFromCell(cells[3]);
        if (!filename) return;

        const row = map.get(filename);
        if (!row) return;

        const xs = candidatesOf(row);
        if (!xs.length) return;

        cells[1].textContent = compactCandidateText(xs, 'app_shipment_id');
        cells[2].textContent = compactCandidateText(xs, 'kombu_type', function (v) {
          return PRODUCT_LABEL[String(v || '')] || String(v || '');
        });

        cells[1].title = xs.map(function (x) {
          return [x.app_shipment_id, PRODUCT_LABEL[x.kombu_type] || x.kombu_type, '数量' + (x.qty == null ? '' : x.qty), x.ship_date || ''].join(' / ');
        }).join('\n');
        cells[2].title = cells[1].title;
      });
    } catch (e) {
      console.warn('[KOMBU candidate display] 反映失敗', e);
    } finally {
      applying = false;
    }
  }

  const observer = new MutationObserver(function () {
    if (document.getElementById('v159WaybillReviewModal')) {
      setTimeout(function () { applyCandidateDisplay(false); }, 80);
    }
  });

  function start() {
    if (!document.body) return;
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(function () {
      if (document.getElementById('v159WaybillReviewModal')) {
        applyCandidateDisplay(false);
      }
    }, 2000);
  }

  window.addEventListener('kombu:waybill-rematch-complete', function () {
    setTimeout(function () { applyCandidateDisplay(true); }, 200);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.kombuRefreshWaybillCandidateDisplay = function () {
    return applyCandidateDisplay(true);
  };
})();
