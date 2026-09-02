/* =========================================================
   8月 浜中運輸送り状 v161.3 条件 一括Dry Run
   - Gmail検索しない
   - PDF再読込しない
   - OpenAI呼び出ししない
   - DB更新しない
   - 現在の出荷依頼履歴DOM + 保存済み shipment_waybill_inbox のみ使用
   ========================================================= */

(function () {
  'use strict';

  function s(v) {
    return String(v == null ? '' : v).trim();
  }

  function norm(v) {
    return s(v)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[ 　\t\r\n]/g, '')
      .replace(/株式会社|㈱|\(株\)|（株）/g, '')
      .replace(/有限会社|㈲|\(有\)|（有）/g, '')
      .replace(/[・･.,，。、\-ー_\/\\()[\]{}「」『』]/g, '')
      .replace(/和泉食品/g, '和気食品')
      .replace(/和氣食品/g, '和気食品');
  }

  function sameCompany(a, b) {
    const x = norm(a);
    const y = norm(b);
    if (!x || !y) return false;
    return x === y || x.includes(y) || y.includes(x);
  }

  function pairMatch(wbSource, wbDest, shipSource, shipDest) {
    const direct =
      sameCompany(wbSource, shipSource) &&
      sameCompany(wbDest, shipDest);

    const swapped =
      sameCompany(wbSource, shipDest) &&
      sameCompany(wbDest, shipSource);

    return direct || swapped;
  }

  function parseShipmentPdfName(text) {
    const x = s(text);
    const m = x.match(
      /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})_(.+?)_出荷指示/
    );

    if (!m) {
      return {
        date: '',
        destination: ''
      };
    }

    return {
      date: [
        m[1],
        String(m[2]).padStart(2, '0'),
        String(m[3]).padStart(2, '0')
      ].join('-'),
      destination: s(m[4])
    };
  }

  function isoDate(v) {
    const x = s(v);
    const m = x.match(
      /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/
    );

    if (!m) return '';

    return [
      m[1],
      String(m[2]).padStart(2, '0'),
      String(m[3]).padStart(2, '0')
    ].join('-');
  }

  function waybillSource(w) {
    const p = w && w.parsed_data && typeof w.parsed_data === 'object'
      ? w.parsed_data
      : {};

    return (
      p.source_name ||
      p.shipper_name ||
      w.source_name ||
      ''
    );
  }

  function waybillDest(w) {
    const p = w && w.parsed_data && typeof w.parsed_data === 'object'
      ? w.parsed_data
      : {};

    return (
      p.dest_name ||
      p.consignee_name ||
      w.destination_name ||
      ''
    );
  }

  function waybillDate(w) {
    const p = w && w.parsed_data && typeof w.parsed_data === 'object'
      ? w.parsed_data
      : {};

    return isoDate(
      p.shipping_date ||
      p.ship_date ||
      w.shipping_date ||
      ''
    );
  }

  function isHamanaka(w) {
    const p = w && w.parsed_data && typeof w.parsed_data === 'object'
      ? w.parsed_data
      : {};

    return (
      p.is_hamanaka_waybill === true ||
      /浜中運輸/.test(s(p.company_name)) ||
      /浜中運輸/.test(s(p.carrier_name)) ||
      /浜中運輸/.test(s(p.document_type))
    );
  }

  function isAugust2026Waybill(w) {
    const filename = s(w && w.original_filename);
    const received = isoDate(w && w.received_at);
    const shipping = waybillDate(w);

    return (
      /^FAX_202608/.test(filename) ||
      /^2026-08-/.test(received) ||
      /^2026-08-/.test(shipping)
    );
  }

  function readHistoryRows() {
    const rows = [];

    document
      .querySelectorAll('#v136HistBody tr[data-hid]')
      .forEach(function (tr) {
        const cells = tr.querySelectorAll('td');
        if (cells.length < 8) return;

        const shipmentId = s(tr.dataset.hid);
        const product = s(tr.dataset.hprod);
        const requestDateText = s(cells[0].textContent);
        const sourceName = s(cells[2].textContent);
        const destName = s(cells[3].textContent);
        const qtyText = s(cells[4].textContent);
        const pdfText = s(cells[7].textContent);
        const parsedPdf = parseShipmentPdfName(pdfText);

        if (!shipmentId) return;

        rows.push({
          shipment_id: shipmentId,
          kombu_type: product,
          request_date: isoDate(requestDateText),
          source_name: sourceName,
          dest_name: destName,
          total_qty: Number(qtyText.replace(/[^\d.]/g, '') || 0),
          shipment_pdf_name: pdfText,
          shipment_pdf_date: parsedPdf.date,
          shipment_pdf_destination: parsedPdf.destination
        });
      });

    return rows;
  }

  function candidatePasses(w, h) {
    const wbSource = waybillSource(w);
    const wbDest = waybillDest(w);
    const wbDate = waybillDate(w);

    // 条件1: 送り状解析の出荷元・出荷先が出荷依頼と一致
    const companyPairOk =
      pairMatch(
        wbSource,
        wbDest,
        h.source_name,
        h.dest_name
      );

    if (!companyPairOk) return false;

    // 条件2: 出荷依頼履歴右端PDF名の出荷先と出荷依頼の出荷先が一致
    if (
      !h.shipment_pdf_destination ||
      !sameCompany(
        h.shipment_pdf_destination,
        h.dest_name
      )
    ) {
      return false;
    }

    // 条件3: 送り状の出荷日がPDF名の日付より前なら除外
    // 日付が双方読める場合のみ厳格適用
    if (
      wbDate &&
      h.shipment_pdf_date &&
      wbDate < h.shipment_pdf_date
    ) {
      return false;
    }

    return true;
  }

  function classify(matches) {
    if (!matches.length) return 'unmatched';
    if (matches.length === 1) return 'auto_attach_candidate';
    return 'manual_selection_required';
  }

  async function run() {
    const sb = window.kombuSupabase;

    if (!sb) {
      throw new Error(
        'window.kombuSupabase が見つかりません。昆布在庫管理アプリ上で実行してください。'
      );
    }

    const history = readHistoryRows();

    if (!history.length) {
      throw new Error(
        '出荷依頼履歴が画面にありません。先に出荷依頼履歴を開いてから実行してください。'
      );
    }

    console.log('[AUGUST v161.3 DRY RUN] 開始');
    console.log(
      '[AUGUST v161.3 DRY RUN] Gmail/PDF/OpenAI/DB更新は使用しません。'
    );
    console.log(
      '[AUGUST v161.3 DRY RUN] 履歴行数 = ' + history.length
    );

    const result = await sb
      .from('shipment_waybill_inbox')
      .select(
        'id,original_filename,received_at,shipping_date,source_name,destination_name,total_qty,parsed_data,match_status,storage_path'
      )
      .order('received_at', { ascending: true });

    if (result.error) {
      throw result.error;
    }

    const all = Array.isArray(result.data)
      ? result.data
      : [];

    const augustHamanaka = all.filter(function (w) {
      return isHamanaka(w) && isAugust2026Waybill(w);
    });

    const report = augustHamanaka.map(function (w) {
      const matches = history.filter(function (h) {
        return candidatePasses(w, h);
      });

      return {
        filename: w.original_filename,
        inbox_id: w.id,
        waybill_date: waybillDate(w),
        waybill_source: waybillSource(w),
        waybill_destination: waybillDest(w),
        saved_match_status: w.match_status,
        candidate_count: matches.length,
        decision: classify(matches),
        candidates: matches.map(function (h) {
          return {
            shipment_id: h.shipment_id,
            kombu_type: h.kombu_type,
            request_date: h.request_date,
            source_name: h.source_name,
            dest_name: h.dest_name,
            shipment_pdf_name: h.shipment_pdf_name,
            shipment_pdf_date: h.shipment_pdf_date,
            shipment_pdf_destination:
              h.shipment_pdf_destination,
            quantity_for_reference_only:
              h.total_qty
          };
        })
      };
    });

    const summary = {
      ok: true,
      dry_run: true,
      gmail_searched: false,
      pdf_loaded: false,
      openai_called: false,
      database_updated: false,
      august_hamanaka_pdf_count:
        augustHamanaka.length,
      auto_attach_candidate_count:
        report.filter(function (x) {
          return x.decision === 'auto_attach_candidate';
        }).length,
      manual_selection_pdf_count:
        report.filter(function (x) {
          return x.decision === 'manual_selection_required';
        }).length,
      unmatched_pdf_count:
        report.filter(function (x) {
          return x.decision === 'unmatched';
        }).length
    };

    console.log(
      '[AUGUST v161.3 DRY RUN] 集計'
    );
    console.log(
      JSON.stringify(summary, null, 2)
    );

    report.forEach(function (x, i) {
      console.log(
        '========== ' +
        (i + 1) +
        ' / ' +
        report.length +
        ' =========='
      );
      console.log(
        JSON.stringify(x, null, 2)
      );
    });

    console.log(
      '[AUGUST v161.3 DRY RUN] 完了'
    );

    window.__AUGUST_HAMANAKA_V1613_REPORT__ = {
      summary: summary,
      report: report
    };

    return {
      summary: summary,
      report: report
    };
  }

  window.testAugustHamanakaWaybillV1613DryRun = run;

  console.log(
    '[AUGUST v161.3 DRY RUN] 準備完了: testAugustHamanakaWaybillV1613DryRun()'
  );
})();
