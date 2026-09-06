/* =========================================================
   昆布在庫管理 v165.8 UI patch
   1) 新規出荷依頼「④出荷明細」
      昆布の種類 → 生産年度 → 漁協 → 区分 → 等級 の順に左寄せ
   2) 送り状確認
      - 要確認/不一致PDFに削除ボタン
      - 削除前PDFプレビュー + 本当に削除しますか？
      - 削除済PDFの閲覧欄
      - FAX受信月ごとの折りたたみ
   ========================================================= */
(function(){
  'use strict';

  const TABLE_NAME = 'shipment_waybill_inbox';
  const BUCKET_NAME = 'shipment-waybill-inbox';

  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  function sb(){
    return window.kombuSupabase || null;
  }

  /* ---------- ④出荷明細 レイアウト ---------- */

  const style = document.createElement('style');
  style.textContent = `
    /* v165.8 ④出荷明細 */
    [data-v114-line] .v118-row1,
    [data-v114-line] .v118-row2{
      display:flex !important;
      justify-content:flex-start !important;
      align-items:flex-end !important;
      gap:12px !important;
      flex-wrap:wrap !important;
    }
    [data-v114-line] .v118-line-no{
      flex:0 0 100% !important;
      text-align:left !important;
      margin-bottom:2px !important;
    }
    [data-v114-line] .v1658-fields{
      display:flex;
      justify-content:flex-start;
      align-items:flex-end;
      gap:12px;
      flex-wrap:wrap;
      width:100%;
    }
    [data-v114-line] .v1658-fields label{
      margin:0 !important;
      text-align:left !important;
      flex:0 1 180px;
      min-width:140px;
      max-width:220px;
    }
    [data-v114-line] .v1658-fields label select{
      width:100% !important;
      min-width:0 !important;
    }
    [data-v114-line] .v1658-fields label.v1658-product{
      flex-basis:160px;
    }
    [data-v114-line] .v1658-fields label.v1658-year{
      flex-basis:120px;
      max-width:140px;
    }
    [data-v114-line] .v1658-fields label.v1658-coop{
      flex-basis:190px;
    }
    [data-v114-line] .v1658-fields label.v1658-section{
      flex-basis:150px;
    }
    [data-v114-line] .v1658-fields label.v1658-grade{
      flex-basis:180px;
    }

    /* 送り状確認 */
    .v1658-delete{
      margin-left:6px !important;
      border-color:#c0392b !important;
      color:#a9271a !important;
      background:#fff7f6 !important;
    }
    .v1658-month{
      margin:10px 0;
      border:1px solid #dbe3ec;
      border-radius:10px;
      overflow:hidden;
      background:#fff;
    }
    .v1658-month > summary{
      cursor:pointer;
      padding:10px 12px;
      font-weight:800;
      background:#f7f9fc;
    }
    .v1658-month-body{
      padding:8px;
    }
    .v1658-deleted-wrap{
      margin-top:12px;
      border-top:1px solid #e5eaf0;
      padding-top:12px;
    }
    .v1658-deleted-wrap summary{
      cursor:pointer;
      font-weight:800;
    }
    .v1658-preview-overlay{
      position:fixed;
      inset:0;
      z-index:999999;
      background:rgba(0,0,0,.48);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:14px;
    }
    .v1658-preview-panel{
      width:min(1000px,96vw);
      height:min(820px,94vh);
      background:#fff;
      border-radius:14px;
      box-shadow:0 18px 60px rgba(0,0,0,.3);
      display:flex;
      flex-direction:column;
      overflow:hidden;
    }
    .v1658-preview-head{
      display:flex;
      align-items:center;
      gap:10px;
      padding:12px 14px;
      border-bottom:1px solid #e5eaf0;
    }
    .v1658-preview-head strong{ margin-right:auto; }
    .v1658-preview-frame{
      flex:1;
      width:100%;
      border:0;
      background:#f3f5f7;
    }
    .v1658-preview-foot{
      display:flex;
      justify-content:flex-end;
      gap:8px;
      padding:12px 14px;
      border-top:1px solid #e5eaf0;
    }
    @media(max-width:700px){
      [data-v114-line] .v1658-fields label{
        flex:1 1 calc(50% - 8px);
        max-width:none;
      }
      [data-v114-line] .v1658-fields label.v1658-product,
      [data-v114-line] .v1658-fields label.v1658-year,
      [data-v114-line] .v1658-fields label.v1658-coop,
      [data-v114-line] .v1658-fields label.v1658-section,
      [data-v114-line] .v1658-fields label.v1658-grade{
        flex-basis:calc(50% - 8px);
        max-width:none;
      }
    }
  `;
  document.head.appendChild(style);

  function labelForField(box, field){
    const el = box.querySelector('[data-f="'+field+'"]');
    return el ? el.closest('label') : null;
  }

  function arrangeShipmentLine(box){
    if(!box || box.dataset.v1658Arranged === '1') return;

    const productSel = box.querySelector('[data-v114-product]');
    const productLabel = productSel ? productSel.closest('label') : null;
    const yearLabel = labelForField(box, 'year');
    const coopLabel = labelForField(box, 'coop') || labelForField(box, 'location');
    const sectionLabel =
      labelForField(box, 'season') ||
      labelForField(box, 'section');
    const gradeLabel =
      labelForField(box, 'gi') ||
      labelForField(box, 'grade');

    if(!productLabel || !yearLabel || !coopLabel || !sectionLabel || !gradeLabel) return;

    const row1 = box.querySelector('.v118-row1');
    if(!row1) return;

    let holder = box.querySelector('.v1658-fields');
    if(!holder){
      holder = document.createElement('div');
      holder.className = 'v1658-fields';
      row1.appendChild(holder);
    }

    productLabel.classList.add('v1658-product');
    yearLabel.classList.add('v1658-year');
    coopLabel.classList.add('v1658-coop');
    sectionLabel.classList.add('v1658-section');
    gradeLabel.classList.add('v1658-grade');

    [
      productLabel,
      yearLabel,
      coopLabel,
      sectionLabel,
      gradeLabel
    ].forEach(function(label){
      holder.appendChild(label);
    });

    const row2 = box.querySelector('.v118-row2');
    if(row2) row2.style.display = 'none';

    box.dataset.v1658Arranged = '1';
  }

  function arrangeAllShipmentLines(){
    document.querySelectorAll('[data-v114-line]').forEach(arrangeShipmentLine);
  }

  /* ---------- 送り状 削除/削除済/年月折りたたみ ---------- */

  async function fetchWaybill(id){
    const c = sb();
    if(!c) throw new Error('Supabaseへ接続できません。');

    const r = await c
      .from(TABLE_NAME)
      .select('id,storage_path,original_filename,match_status,received_at,shipping_date,parsed_data')
      .eq('id', id)
      .single();

    if(r.error) throw r.error;
    return r.data;
  }

  async function signedUrl(path){
    const c = sb();
    if(!c || !path) return '';
    const r = await c.storage.from(BUCKET_NAME).createSignedUrl(path, 300);
    if(r.error) throw r.error;
    return r.data && r.data.signedUrl ? r.data.signedUrl : '';
  }

  function deletedMarker(data){
    return !!(
      data &&
      data.parsed_data &&
      data.parsed_data.deleted_pdf &&
      data.parsed_data.deleted_pdf.deleted === true
    );
  }

  async function softDeleteWaybill(w){
    const c = sb();
    if(!c) throw new Error('Supabaseへ接続できません。');

    const parsed = Object.assign({}, w.parsed_data || {});
    parsed.deleted_pdf = {
      deleted:true,
      deleted_at:new Date().toISOString(),
      previous_match_status:w.match_status || ''
    };

    const r = await c
      .from(TABLE_NAME)
      .update({
        match_status:'ignored',
        parsed_data:parsed
      })
      .eq('id', w.id);

    if(r.error) throw r.error;
  }

  async function showDeletePreview(id, sourceRow){
    let w;
    try{
      w = await fetchWaybill(id);
    }catch(e){
      console.error('[v165.8] PDF取得:', e);
      alert('PDF情報を取得できませんでした。');
      return;
    }

    let url = '';
    try{
      url = await signedUrl(w.storage_path);
    }catch(e){
      console.error('[v165.8] PDF URL取得:', e);
    }

    const old = document.querySelector('.v1658-preview-overlay');
    if(old) old.remove();

    const overlay = document.createElement('div');
    overlay.className = 'v1658-preview-overlay';
    overlay.innerHTML =
      '<div class="v1658-preview-panel">' +
        '<div class="v1658-preview-head">' +
          '<strong>削除するPDFを確認</strong>' +
          '<span style="font-size:12px;color:#627d98">'+esc(w.original_filename || '')+'</span>' +
        '</div>' +
        (url
          ? '<iframe class="v1658-preview-frame" src="'+esc(url)+'"></iframe>'
          : '<div class="v1658-preview-frame" style="display:flex;align-items:center;justify-content:center">PDFを表示できませんでした。</div>') +
        '<div class="v1658-preview-foot">' +
          '<button class="btn secondary" id="v1658DeleteCancel">戻る</button>' +
          '<button class="btn danger" id="v1658DeleteConfirm">削除</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    document.getElementById('v1658DeleteCancel').onclick = function(){
      overlay.remove();
    };

    document.getElementById('v1658DeleteConfirm').onclick = async function(){
      if(!window.confirm('本当に削除しますか？')) return;

      const btn = this;
      btn.disabled = true;
      btn.textContent = '削除中…';

      try{
        await softDeleteWaybill(w);
        overlay.remove();
        if(sourceRow) sourceRow.remove();
        await ensureDeletedSection();
        updateReviewMonthGroups();
      }catch(e){
        console.error('[v165.8] PDF削除:', e);
        alert('削除できませんでした。');
        btn.disabled = false;
        btn.textContent = '削除';
      }
    };
  }

  function waybillIdFromRow(tr){
    if(!tr) return '';
    const el = tr.querySelector(
      '[data-waybill-id].v159-waybill-pdf,' +
      '[data-waybill-id].v159-waybill-manual-link,' +
      '[data-waybill-id].v159-waybill-unlink'
    );
    return el ? String(el.dataset.waybillId || '') : '';
  }

  function addDeleteButtons(){
    const close = document.getElementById('v159WaybillReviewClose');
    if(!close) return;

    const panel = close.closest('div[style*="box-shadow"]') || close.parentElement?.parentElement;
    if(!panel) return;

    panel.querySelectorAll('table tr').forEach(function(tr){
      if(tr.querySelector('th')) return;
      if(tr.querySelector('.v1658-delete')) return;

      const id = waybillIdFromRow(tr);
      if(!id) return;

      const cells = tr.querySelectorAll('td');
      if(!cells.length) return;

      const status = String(cells[0]?.innerText || '');
      if(!/要確認|不一致|未判定/.test(status)) return;

      const actionCell = cells[cells.length - 1];
      const b = document.createElement('button');
      b.className = 'mini v1658-delete';
      b.textContent = '削除';
      b.dataset.waybillId = id;
      b.onclick = function(){
        showDeletePreview(id, tr);
      };
      actionCell.appendChild(b);
    });
  }

  async function loadDeleted(){
    const c = sb();
    if(!c) return [];
    const r = await c
      .from(TABLE_NAME)
      .select('id,storage_path,original_filename,match_status,received_at,shipping_date,parsed_data')
      .eq('match_status','ignored')
      .order('received_at',{ascending:false});

    if(r.error){
      console.warn('[v165.8] 削除済一覧取得:', r.error);
      return [];
    }
    return (r.data || []).filter(deletedMarker);
  }

  async function openDeletedPdf(id){
    try{
      const w = await fetchWaybill(id);
      const url = await signedUrl(w.storage_path);
      if(!url) throw new Error('URLなし');
      window.open(url,'_blank','noopener');
    }catch(e){
      console.error('[v165.8] 削除済PDF:', e);
      alert('PDFを開けませんでした。');
    }
  }

  async function ensureDeletedSection(){
    const close = document.getElementById('v159WaybillReviewClose');
    if(!close) return;

    const panel = close.closest('div[style*="box-shadow"]') || close.parentElement?.parentElement;
    if(!panel) return;

    let wrap = panel.querySelector('.v1658-deleted-wrap');
    if(!wrap){
      wrap = document.createElement('details');
      wrap.className = 'v1658-deleted-wrap';
      panel.appendChild(wrap);
    }

    const deleted = await loadDeleted();

    wrap.innerHTML =
      '<summary>🗑 削除済のPDF（'+deleted.length+'件）</summary>' +
      '<div style="margin-top:10px">' +
        (deleted.length
          ? '<div class="tablewrap"><table style="min-width:620px">' +
              '<tr><th>FAX受信日</th><th>PDF名</th><th>操作</th></tr>' +
              deleted.map(function(w){
                const d = w.received_at ? new Date(w.received_at).toLocaleDateString('ja-JP') : '';
                return '<tr>' +
                  '<td>'+esc(d)+'</td>' +
                  '<td>'+esc(w.original_filename || '')+'</td>' +
                  '<td><button class="mini v1658-open-deleted" data-waybill-id="'+esc(w.id)+'">PDF</button></td>' +
                '</tr>';
              }).join('') +
            '</table></div>'
          : '<div class="muted">削除済みPDFはありません。</div>') +
      '</div>';

    wrap.querySelectorAll('.v1658-open-deleted').forEach(function(b){
      b.onclick = function(){ openDeletedPdf(b.dataset.waybillId); };
    });
  }

  async function buildDateMap(){
    const c = sb();
    if(!c) return new Map();

    const r = await c
      .from(TABLE_NAME)
      .select('id,received_at,shipping_date,parsed_data');

    if(r.error) return new Map();

    const m = new Map();
    (r.data || []).forEach(function(w){
      if(deletedMarker(w)) return;
      const raw = w.received_at || w.shipping_date || '';
      let key = '日付不明';
      if(raw){
        const d = new Date(raw);
        if(!Number.isNaN(d.getTime())){
          key = d.getFullYear() + '年' + String(d.getMonth()+1) + '月';
        }
      }
      m.set(String(w.id), key);
    });
    return m;
  }

  async function updateReviewMonthGroups(){
    const close = document.getElementById('v159WaybillReviewClose');
    if(!close) return;

    const panel = close.closest('div[style*="box-shadow"]') || close.parentElement?.parentElement;
    if(!panel) return;

    const dateMap = await buildDateMap();

    panel.querySelectorAll('table').forEach(function(table){
      if(table.closest('.v1658-deleted-wrap')) return;
      if(table.closest('.v1658-month')) return;

      const rows = Array.from(table.querySelectorAll('tr')).filter(function(tr){
        return !tr.querySelector('th') && !!waybillIdFromRow(tr);
      });
      if(rows.length < 2) return;

      const parent = table.parentElement;
      if(!parent || parent.dataset.v1658MonthDone === '1') return;

      const header = table.querySelector('tr:has(th)');
      const groups = {};
      rows.forEach(function(tr){
        const id = waybillIdFromRow(tr);
        const month = dateMap.get(id) || '日付不明';
        (groups[month] ||= []).push(tr);
      });

      const keys = Object.keys(groups).sort(function(a,b){
        if(a === '日付不明') return 1;
        if(b === '日付不明') return -1;
        return b.localeCompare(a,'ja');
      });
      if(keys.length <= 1) return;

      const holder = document.createElement('div');
      holder.className = 'v1658-month-holder';

      keys.forEach(function(month, index){
        const det = document.createElement('details');
        det.className = 'v1658-month';
        // 最新月だけ最初から開く
        if(index === 0) det.open = true;

        const body = document.createElement('div');
        body.className = 'v1658-month-body';

        const t = document.createElement('table');
        t.style.minWidth = table.style.minWidth || '760px';

        if(header){
          const hr = header.cloneNode(true);
          t.appendChild(hr);
        }
        groups[month].forEach(function(tr){ t.appendChild(tr); });

        body.appendChild(t);
        det.innerHTML = '<summary>'+esc(month)+'（'+groups[month].length+'件）</summary>';
        det.appendChild(body);
        holder.appendChild(det);
      });

      parent.insertBefore(holder, table);
      table.remove();
      parent.dataset.v1658MonthDone = '1';
    });
  }

  async function patchReview(){
    if(!document.getElementById('v159WaybillReviewClose')) return;
    addDeleteButtons();
    await updateReviewMonthGroups();
    await ensureDeletedSection();
  }

  let reviewTimer = null;
  const obs = new MutationObserver(function(){
    arrangeAllShipmentLines();

    if(document.getElementById('v159WaybillReviewClose')){
      clearTimeout(reviewTimer);
      reviewTimer = setTimeout(patchReview, 80);
    }
  });
  obs.observe(document.documentElement,{subtree:true,childList:true});

  arrangeAllShipmentLines();
  patchReview();
  console.log('[KOMBU v165.8] shipment detail + waybill review patch ready');
})();
