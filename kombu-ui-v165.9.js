/* =========================================================
   昆布在庫管理 v165.9 UI patch
   ユーザー確認済み画面仕様
   1) 新規出荷依頼 ④出荷明細:
      上段 = 昆布の種類 / 生産年度
      下段 = 漁協 / 区分 / 等級
      左寄せ・バランス調整
      年表示は根室/日高/釧棹を含め「R7年産」等へ統一
      出荷可能在庫は現在DOM選択値から再計算
   2) 在庫管理画面:
      根室/日高/釧棹の年表示を「R7年産」等へ統一
   3) 送り状確認:
      月ごとに折りたたみ（最新月を開く）
      操作欄に削除ボタン
      削除前PDFプレビュー → 「本当に削除しますか？」
      削除済PDF一覧を「自動添付済みを表示」の下に追加
   ========================================================= */
(function(){
  'use strict';

  const VERSION = 'v165.9';
  const TABLE = 'shipment_waybill_inbox';
  const BUCKET = 'shipment-waybill-inbox';

  function sb(){ return window.kombuSupabase || null; }
  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  const style = document.createElement('style');
  style.textContent = `
    [data-v114-line] .v1659-top,
    [data-v114-line] .v1659-bottom{
      display:flex;
      justify-content:flex-start;
      align-items:flex-end;
      gap:14px;
      flex-wrap:wrap;
      width:100%;
    }
    [data-v114-line] .v1659-top{ margin-top:12px; }
    [data-v114-line] .v1659-bottom{ margin-top:12px; }
    [data-v114-line] .v1659-top label,
    [data-v114-line] .v1659-bottom label{
      margin:0 !important;
      text-align:left !important;
    }
    [data-v114-line] .v1659-product{ flex:0 1 240px; }
    [data-v114-line] .v1659-year{ flex:0 1 210px; }
    [data-v114-line] .v1659-coop{ flex:0 1 285px; }
    [data-v114-line] .v1659-section{ flex:0 1 225px; }
    [data-v114-line] .v1659-grade{ flex:0 1 270px; }
    [data-v114-line] .v1659-top select,
    [data-v114-line] .v1659-bottom select{
      width:100% !important;
      min-width:0 !important;
    }

    .v1659-delete{
      margin-left:6px !important;
      background:#fff !important;
      color:#c0392b !important;
      border:1px solid #d64236 !important;
    }
    .v1659-month{
      margin:10px 0;
      border:1px solid #d9e2ec;
      border-radius:10px;
      overflow:hidden;
      background:#fff;
    }
    .v1659-month>summary{
      cursor:pointer;
      padding:10px 12px;
      font-weight:800;
      background:#eef6ff;
      color:#123d6b;
    }
    .v1659-month-body{ padding:8px; }
    .v1659-deleted{
      margin-top:12px;
      border-top:1px solid #e5eaf0;
      padding-top:12px;
    }
    .v1659-deleted summary{
      cursor:pointer;
      font-weight:800;
    }
    .v1659-overlay{
      position:fixed;
      inset:0;
      z-index:999999;
      background:rgba(0,0,0,.48);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:16px;
    }
    .v1659-panel{
      width:min(1000px,96vw);
      height:min(820px,94vh);
      background:#fff;
      border-radius:14px;
      overflow:hidden;
      display:flex;
      flex-direction:column;
      box-shadow:0 18px 60px rgba(0,0,0,.3);
    }
    .v1659-head{
      display:flex;
      gap:10px;
      align-items:center;
      padding:12px 14px;
      border-bottom:1px solid #e5eaf0;
    }
    .v1659-head strong{ margin-right:auto; }
    .v1659-frame{
      flex:1;
      width:100%;
      border:0;
      background:#f2f4f6;
    }
    .v1659-foot{
      display:flex;
      justify-content:flex-end;
      gap:8px;
      padding:12px 14px;
      border-top:1px solid #e5eaf0;
    }

    @media(max-width:700px){
      [data-v114-line] .v1659-product,
      [data-v114-line] .v1659-year,
      [data-v114-line] .v1659-coop,
      [data-v114-line] .v1659-section,
      [data-v114-line] .v1659-grade{
        flex:1 1 calc(50% - 8px);
      }
    }
  `;
  document.head.appendChild(style);

  function labelOf(box, selector){
    const el = box.querySelector(selector);
    return el ? el.closest('label') : null;
  }

  function normalizeYearText(select){
    if(!select) return;
    Array.from(select.options || []).forEach(opt => {
      const t = String(opt.textContent || '').trim();
      if(/^R\d+年$/.test(t)){
        opt.textContent = t.replace(/年$/,'年産');
      }else if(/^R\d+$/.test(t)){
        opt.textContent = t + '年産';
      }
    });
    const next = select.options[select.selectedIndex];
    if(next && next.textContent) next.textContent = next.textContent;
  }

  function arrangeShipmentLine(box){
    if(!box) return;

    const productLabel = labelOf(box, '[data-v114-product]');
    const yearLabel = labelOf(box, '[data-f="year"]');
    const coopLabel = labelOf(box, '[data-f="coop"],[data-f="location"]');
    const sectionLabel = labelOf(box, '[data-f="season"],[data-f="section"]');
    const gradeLabel = labelOf(box, '[data-f="gi"],[data-f="grade"]');

    if(!productLabel || !yearLabel || !coopLabel || !sectionLabel || !gradeLabel) return;

    const row1 = box.querySelector('.v118-row1');
    const row2 = box.querySelector('.v118-row2');
    if(!row1) return;

    let top = box.querySelector('.v1659-top');
    let bottom = box.querySelector('.v1659-bottom');

    if(!top){
      top = document.createElement('div');
      top.className = 'v1659-top';
      row1.appendChild(top);
    }
    if(!bottom){
      bottom = document.createElement('div');
      bottom.className = 'v1659-bottom';
      row1.appendChild(bottom);
    }

    productLabel.classList.add('v1659-product');
    yearLabel.classList.add('v1659-year');
    coopLabel.classList.add('v1659-coop');
    sectionLabel.classList.add('v1659-section');
    gradeLabel.classList.add('v1659-grade');

    top.appendChild(productLabel);
    top.appendChild(yearLabel);
    bottom.appendChild(coopLabel);
    bottom.appendChild(sectionLabel);
    bottom.appendChild(gradeLabel);

    if(row2) row2.style.display='none';

    normalizeYearText(box.querySelector('[data-f="year"]'));
  }

  function currentLineFilters(box){
    const prod = box.querySelector('[data-v114-product]');
    const year = box.querySelector('[data-f="year"]');
    const coop = box.querySelector('[data-f="coop"],[data-f="location"]');
    const season = box.querySelector('[data-f="season"],[data-f="section"]');
    const gi = box.querySelector('[data-f="gi"],[data-f="grade"]');

    const product = prod ? prod.value : '';
    let group='', item='';
    if(gi){
      if(String(gi.value).includes('|')){
        [group,item] = String(gi.value).split('|');
      }else{
        item = gi.value;
      }
    }
    return {
      product,
      filters:{
        year:year?.value || '',
        coop:coop?.value || '',
        season:season?.value || '',
        group,
        item
      }
    };
  }

  function refreshAvailable(box){
    const span = box.querySelector('.v114-avail');
    if(!span) return;
    try{
      const {product,filters} = currentLineFilters(box);
      if(!product) return;
      let value = null;
      if(window.KombuRefactor?.Inventory?.getAvailableQuantity){
        value = window.KombuRefactor.Inventory.getAvailableQuantity(product, filters, null);
      }
      if(Number.isFinite(Number(value))){
        span.textContent = '出荷可能在庫：' + Number(value).toLocaleString('ja-JP');
      }
    }catch(e){
      console.warn('[v165.9] availability refresh', e);
    }
  }

  function patchShipment(){
    document.querySelectorAll('[data-v114-line]').forEach(box => {
      arrangeShipmentLine(box);
      refreshAvailable(box);
    });
  }

  function normalizeInventoryYears(){
    // 在庫管理画面などのR7年/R7表記を年産へ
    document.querySelectorAll('select').forEach(sel => {
      const txt = Array.from(sel.options || []).map(o=>String(o.textContent||'')).join(' ');
      if(/R\d+(年)?/.test(txt)) normalizeYearText(sel);
    });

    document.querySelectorAll('th,td,button,.pill,.badge,span,div').forEach(el => {
      if(el.children.length) return;
      const t = String(el.textContent || '').trim();
      if(/^R\d+年$/.test(t)) el.textContent = t.replace(/年$/,'年産');
      else if(/^R\d+$/.test(t)) el.textContent = t + '年産';
    });
  }

  function idFromRow(tr){
    const el = tr?.querySelector('[data-waybill-id]');
    return el ? String(el.dataset.waybillId || '') : '';
  }

  async function getWaybill(id){
    const c = sb();
    if(!c) throw new Error('Supabaseへ接続できません。');
    const r = await c.from(TABLE)
      .select('id,storage_path,original_filename,match_status,received_at,shipping_date,parsed_data')
      .eq('id',id).single();
    if(r.error) throw r.error;
    return r.data;
  }

  async function makeUrl(path){
    const c = sb();
    const r = await c.storage.from(BUCKET).createSignedUrl(path,300);
    if(r.error) throw r.error;
    return r.data?.signedUrl || '';
  }

  function isDeleted(w){
    return !!(w?.parsed_data?.deleted_pdf?.deleted === true);
  }

  async function markDeleted(w){
    const c = sb();
    const parsed = Object.assign({}, w.parsed_data || {});
    parsed.deleted_pdf = {
      deleted:true,
      deleted_at:new Date().toISOString(),
      previous_match_status:w.match_status || ''
    };
    const r = await c.from(TABLE).update({
      match_status:'ignored',
      parsed_data:parsed
    }).eq('id',w.id);
    if(r.error) throw r.error;
  }

  async function showDeletePreview(id, row){
    let w;
    try{
      w = await getWaybill(id);
    }catch(e){
      alert('PDF情報を取得できませんでした。');
      return;
    }

    let url='';
    try{ url = await makeUrl(w.storage_path); }catch(e){}

    const old = document.querySelector('.v1659-overlay');
    if(old) old.remove();

    const overlay = document.createElement('div');
    overlay.className='v1659-overlay';
    overlay.innerHTML =
      '<div class="v1659-panel">'+
        '<div class="v1659-head">'+
          '<strong>PDFの確認</strong>'+
          '<span style="font-size:12px;color:#627d98">'+esc(w.original_filename||'')+'</span>'+
        '</div>'+
        (url
          ? '<iframe class="v1659-frame" src="'+esc(url)+'"></iframe>'
          : '<div class="v1659-frame" style="display:flex;align-items:center;justify-content:center">PDFを表示できませんでした。</div>')+
        '<div class="v1659-foot">'+
          '<button class="btn secondary" id="v1659Cancel">キャンセル</button>'+
          '<button class="btn danger" id="v1659Delete">削除する</button>'+
        '</div>'+
      '</div>';

    document.body.appendChild(overlay);

    document.getElementById('v1659Cancel').onclick=()=>overlay.remove();
    document.getElementById('v1659Delete').onclick=async function(){
      if(!confirm('本当に削除しますか？')) return;
      this.disabled=true;
      this.textContent='削除中…';
      try{
        await markDeleted(w);
        overlay.remove();
        row?.remove();
        await renderDeletedSection();
        await groupReviewByMonth();
      }catch(e){
        console.error(e);
        alert('削除できませんでした。');
        this.disabled=false;
        this.textContent='削除する';
      }
    };
  }

  function addDeleteButtons(){
    const close = document.getElementById('v159WaybillReviewClose');
    if(!close) return;
    const panel = close.closest('div[style*="box-shadow"]') || close.parentElement?.parentElement;
    if(!panel) return;

    panel.querySelectorAll('table tr').forEach(tr=>{
      if(tr.querySelector('th')) return;
      if(tr.querySelector('.v1659-delete')) return;

      const id = idFromRow(tr);
      if(!id) return;

      const cells = tr.querySelectorAll('td');
      if(!cells.length) return;
      const status = String(cells[0]?.innerText || '');
      if(!/要確認|不一致|未判定/.test(status)) return;

      const action = cells[cells.length-1];
      const btn = document.createElement('button');
      btn.className='mini v1659-delete';
      btn.textContent='削除';
      btn.dataset.waybillId=id;
      btn.onclick=()=>showDeletePreview(id,tr);
      action.appendChild(btn);
    });
  }

  async function fetchAllWaybills(){
    const c = sb();
    if(!c) return [];
    const r = await c.from(TABLE)
      .select('id,storage_path,original_filename,match_status,received_at,shipping_date,parsed_data')
      .order('received_at',{ascending:false});
    if(r.error) return [];
    return r.data || [];
  }

  async function renderDeletedSection(){
    const close = document.getElementById('v159WaybillReviewClose');
    if(!close) return;
    const panel = close.closest('div[style*="box-shadow"]') || close.parentElement?.parentElement;
    if(!panel) return;

    const all = await fetchAllWaybills();
    const deleted = all.filter(isDeleted);

    let wrap = panel.querySelector('.v1659-deleted');
    if(!wrap){
      wrap = document.createElement('details');
      wrap.className='v1659-deleted';

      // 自動添付済み details の直後へ
      const details = Array.from(panel.querySelectorAll('details'));
      const auto = details.find(d=>/自動添付済みを表示/.test(d.querySelector('summary')?.textContent||''));
      if(auto && auto.parentElement){
        auto.insertAdjacentElement('afterend',wrap);
      }else{
        panel.appendChild(wrap);
      }
    }

    wrap.innerHTML =
      '<summary>🗑 削除済のPDF（'+deleted.length+'件）</summary>'+
      '<div style="margin-top:10px">'+
      (deleted.length
        ? '<div class="tablewrap"><table style="min-width:620px">'+
            '<tr><th>FAX受信日</th><th>PDF名</th><th>操作</th></tr>'+
            deleted.map(w=>{
              const d = w.received_at ? new Date(w.received_at).toLocaleDateString('ja-JP') : '';
              return '<tr>'+
                '<td>'+esc(d)+'</td>'+
                '<td>'+esc(w.original_filename||'')+'</td>'+
                '<td><button class="mini v1659-open" data-waybill-id="'+esc(w.id)+'">PDF</button></td>'+
              '</tr>';
            }).join('')+
          '</table></div>'
        : '<div class="muted">削除済みPDFはありません。</div>')+
      '</div>';

    wrap.querySelectorAll('.v1659-open').forEach(btn=>{
      btn.onclick=async()=>{
        try{
          const w=await getWaybill(btn.dataset.waybillId);
          const url=await makeUrl(w.storage_path);
          if(url) window.open(url,'_blank','noopener');
        }catch(e){ alert('PDFを開けませんでした。'); }
      };
    });
  }

  async function groupReviewByMonth(){
    const close = document.getElementById('v159WaybillReviewClose');
    if(!close) return;
    const panel = close.closest('div[style*="box-shadow"]') || close.parentElement?.parentElement;
    if(!panel) return;

    const all = await fetchAllWaybills();
    const monthById = new Map();
    all.filter(w=>!isDeleted(w)).forEach(w=>{
      const raw = w.received_at || w.shipping_date || '';
      let key='日付不明';
      if(raw){
        const d=new Date(raw);
        if(!Number.isNaN(d.getTime())){
          key=d.getFullYear()+'年'+(d.getMonth()+1)+'月';
        }
      }
      monthById.set(String(w.id),key);
    });

    panel.querySelectorAll('.tablewrap').forEach(wrap=>{
      if(wrap.closest('.v1659-deleted')) return;
      if(wrap.dataset.v1659Grouped==='1') return;

      const table = wrap.querySelector(':scope > table');
      if(!table) return;

      const rows = Array.from(table.querySelectorAll('tr')).filter(tr=>!tr.querySelector('th') && idFromRow(tr));
      if(rows.length < 2) return;

      const groups={};
      rows.forEach(tr=>{
        const key=monthById.get(idFromRow(tr)) || '日付不明';
        (groups[key] ||= []).push(tr);
      });
      const keys=Object.keys(groups).sort((a,b)=>{
        if(a==='日付不明') return 1;
        if(b==='日付不明') return -1;
        return b.localeCompare(a,'ja');
      });
      if(keys.length<=1) return;

      const header = table.querySelector('tr:has(th)');
      const holder=document.createElement('div');

      keys.forEach((key,i)=>{
        const det=document.createElement('details');
        det.className='v1659-month';
        if(i===0) det.open=true;
        const body=document.createElement('div');
        body.className='v1659-month-body';
        const t=document.createElement('table');
        t.style.minWidth=table.style.minWidth || '760px';
        if(header) t.appendChild(header.cloneNode(true));
        groups[key].forEach(tr=>t.appendChild(tr));
        det.innerHTML='<summary>'+esc(key)+'（'+groups[key].length+'件）</summary>';
        body.appendChild(t);
        det.appendChild(body);
        holder.appendChild(det);
      });

      wrap.innerHTML='';
      wrap.appendChild(holder);
      wrap.dataset.v1659Grouped='1';
    });
  }

  async function patchReview(){
    if(!document.getElementById('v159WaybillReviewClose')) return;
    addDeleteButtons();
    await groupReviewByMonth();
    await renderDeletedSection();
  }

  function syncVersion(){
    document.querySelectorAll('.v106-version').forEach(el=>el.textContent=VERSION);
  }

  let timer=null;
  const obs=new MutationObserver(()=>{
    patchShipment();
    normalizeInventoryYears();
    syncVersion();

    if(document.getElementById('v159WaybillReviewClose')){
      clearTimeout(timer);
      timer=setTimeout(patchReview,80);
    }
  });
  obs.observe(document.documentElement,{subtree:true,childList:true});

  document.addEventListener('change',e=>{
    const box=e.target.closest?.('[data-v114-line]');
    if(box){
      setTimeout(()=>{
        arrangeShipmentLine(box);
        refreshAvailable(box);
      },0);
    }
    normalizeInventoryYears();
  },true);

  document.addEventListener('input',e=>{
    const box=e.target.closest?.('[data-v114-line]');
    if(box) refreshAvailable(box);
  },true);

  patchShipment();
  normalizeInventoryYears();
  syncVersion();
  patchReview();

  console.log('[KOMBU v165.9] UI specification patch ready');
})();
