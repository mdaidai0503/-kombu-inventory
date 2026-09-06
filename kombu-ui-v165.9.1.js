/* =========================================================
   昆布在庫管理 v165.9.1 安定版UIパッチ
   - v165.9のフリーズ原因を除去
   - 出荷可能在庫の計算ロジックには触れない
     （既存本体 + v165.7の正しい計算をそのまま使用）
   - ④出荷明細レイアウトだけ安全に変更
   - 年度表示を「R7年産」等へ統一
   - 送り状確認に月別折りたたみ / 削除 / 削除済PDFを追加
   ========================================================= */
(function(){
  'use strict';

  const VERSION = 'v165.9.1';
  const TABLE = 'shipment_waybill_inbox';
  const BUCKET = 'shipment-waybill-inbox';

  function sb(){ return window.kombuSupabase || null; }

  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    [data-v114-line] .v16591-top,
    [data-v114-line] .v16591-bottom{
      display:flex;
      justify-content:flex-start;
      align-items:flex-end;
      gap:14px;
      flex-wrap:wrap;
      width:100%;
    }
    [data-v114-line] .v16591-top{ margin-top:12px; }
    [data-v114-line] .v16591-bottom{ margin-top:12px; }

    [data-v114-line] .v16591-top label,
    [data-v114-line] .v16591-bottom label{
      margin:0 !important;
      text-align:left !important;
    }

    [data-v114-line] .v16591-product{ flex:0 1 240px; }
    [data-v114-line] .v16591-year{ flex:0 1 210px; }
    [data-v114-line] .v16591-coop{ flex:0 1 285px; }
    [data-v114-line] .v16591-section{ flex:0 1 225px; }
    [data-v114-line] .v16591-grade{ flex:0 1 270px; }

    [data-v114-line] .v16591-top select,
    [data-v114-line] .v16591-bottom select{
      width:100% !important;
      min-width:0 !important;
    }

    .v16591-delete{
      margin-left:6px !important;
      background:#fff !important;
      color:#c0392b !important;
      border:1px solid #d64236 !important;
    }

    .v16591-month{
      margin:10px 0;
      border:1px solid #d9e2ec;
      border-radius:10px;
      overflow:hidden;
      background:#fff;
    }

    .v16591-month>summary{
      cursor:pointer;
      padding:10px 12px;
      font-weight:800;
      background:#eef6ff;
      color:#123d6b;
    }

    .v16591-month-body{ padding:8px; }

    .v16591-deleted{
      margin-top:12px;
      border-top:1px solid #e5eaf0;
      padding-top:12px;
    }

    .v16591-deleted summary{
      cursor:pointer;
      font-weight:800;
    }

    .v16591-overlay{
      position:fixed;
      inset:0;
      z-index:999999;
      background:rgba(0,0,0,.48);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:16px;
    }

    .v16591-panel{
      width:min(1000px,96vw);
      height:min(820px,94vh);
      background:#fff;
      border-radius:14px;
      overflow:hidden;
      display:flex;
      flex-direction:column;
      box-shadow:0 18px 60px rgba(0,0,0,.3);
    }

    .v16591-head{
      display:flex;
      gap:10px;
      align-items:center;
      padding:12px 14px;
      border-bottom:1px solid #e5eaf0;
    }

    .v16591-head strong{ margin-right:auto; }

    .v16591-frame{
      flex:1;
      width:100%;
      border:0;
      background:#f2f4f6;
    }

    .v16591-foot{
      display:flex;
      justify-content:flex-end;
      gap:8px;
      padding:12px 14px;
      border-top:1px solid #e5eaf0;
    }

    @media(max-width:700px){
      [data-v114-line] .v16591-product,
      [data-v114-line] .v16591-year,
      [data-v114-line] .v16591-coop,
      [data-v114-line] .v16591-section,
      [data-v114-line] .v16591-grade{
        flex:1 1 calc(50% - 8px);
      }
    }
  `;
  document.head.appendChild(style);

  function labelOf(box, selector){
    const el = box.querySelector(selector);
    return el ? el.closest('label') : null;
  }

  function normalizeYearSelect(select){
    if(!select) return;
    Array.from(select.options || []).forEach(function(opt){
      const t = String(opt.textContent || '').trim();
      let next = t;
      if(/^R\d+$/.test(t)) next = t + '年産';
      else if(/^R\d+年$/.test(t)) next = t.replace(/年$/,'年産');
      if(next !== t) opt.textContent = next;
    });
  }

  function arrangeShipmentLine(box){
    if(!box || box.dataset.v16591Arranged === '1') return;

    const productLabel = labelOf(box,'[data-v114-product]');
    const yearLabel = labelOf(box,'[data-f="year"]');
    const coopLabel = labelOf(box,'[data-f="coop"],[data-f="location"]');
    const sectionLabel = labelOf(box,'[data-f="season"],[data-f="section"]');
    const gradeLabel = labelOf(box,'[data-f="gi"],[data-f="grade"]');

    if(!productLabel || !yearLabel || !coopLabel || !sectionLabel || !gradeLabel) return;

    const row1 = box.querySelector('.v118-row1');
    if(!row1) return;

    const top = document.createElement('div');
    top.className = 'v16591-top';

    const bottom = document.createElement('div');
    bottom.className = 'v16591-bottom';

    productLabel.classList.add('v16591-product');
    yearLabel.classList.add('v16591-year');
    coopLabel.classList.add('v16591-coop');
    sectionLabel.classList.add('v16591-section');
    gradeLabel.classList.add('v16591-grade');

    top.appendChild(productLabel);
    top.appendChild(yearLabel);

    bottom.appendChild(coopLabel);
    bottom.appendChild(sectionLabel);
    bottom.appendChild(gradeLabel);

    row1.appendChild(top);
    row1.appendChild(bottom);

    const row2 = box.querySelector('.v118-row2');
    if(row2) row2.style.display='none';

    normalizeYearSelect(box.querySelector('[data-f="year"]'));
    box.dataset.v16591Arranged = '1';
  }

  function patchShipmentLayout(){
    document.querySelectorAll('[data-v114-line]').forEach(arrangeShipmentLine);
  }

  function normalizeInventoryYears(root){
    const scope = root || document;

    scope.querySelectorAll('select').forEach(normalizeYearSelect);

    scope.querySelectorAll('th,td,button,.pill,.badge,span').forEach(function(el){
      if(el.children.length) return;
      const t = String(el.textContent || '').trim();
      let next = t;
      if(/^R\d+$/.test(t)) next = t + '年産';
      else if(/^R\d+年$/.test(t)) next = t.replace(/年$/,'年産');
      if(next !== t) el.textContent = next;
    });
  }

  function idFromRow(tr){
    const el = tr ? tr.querySelector('[data-waybill-id]') : null;
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
    if(!c || !path) return '';
    const r = await c.storage.from(BUCKET).createSignedUrl(path,300);
    if(r.error) throw r.error;
    return r.data && r.data.signedUrl ? r.data.signedUrl : '';
  }

  function isDeleted(w){
    return !!(w && w.parsed_data && w.parsed_data.deleted_pdf && w.parsed_data.deleted_pdf.deleted === true);
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

  async function showDeletePreview(id,row){
    let w;
    try{
      w = await getWaybill(id);
    }catch(e){
      alert('PDF情報を取得できませんでした。');
      return;
    }

    let url='';
    try{ url = await makeUrl(w.storage_path); }catch(e){}

    const old=document.querySelector('.v16591-overlay');
    if(old) old.remove();

    const overlay=document.createElement('div');
    overlay.className='v16591-overlay';
    overlay.innerHTML =
      '<div class="v16591-panel">'+
        '<div class="v16591-head">'+
          '<strong>PDFの確認</strong>'+
          '<span style="font-size:12px;color:#627d98">'+esc(w.original_filename||'')+'</span>'+
        '</div>'+
        (url
          ? '<iframe class="v16591-frame" src="'+esc(url)+'"></iframe>'
          : '<div class="v16591-frame" style="display:flex;align-items:center;justify-content:center">PDFを表示できませんでした。</div>')+
        '<div class="v16591-foot">'+
          '<button class="btn secondary" id="v16591Cancel">キャンセル</button>'+
          '<button class="btn danger" id="v16591Delete">削除する</button>'+
        '</div>'+
      '</div>';

    document.body.appendChild(overlay);

    document.getElementById('v16591Cancel').onclick=function(){ overlay.remove(); };

    document.getElementById('v16591Delete').onclick=async function(){
      if(!window.confirm('本当に削除しますか？')) return;

      const btn=this;
      btn.disabled=true;
      btn.textContent='削除中…';

      try{
        await markDeleted(w);
        overlay.remove();
        if(row) row.remove();
        await renderDeletedSection();
      }catch(e){
        console.error('[v165.9.1] delete error',e);
        alert('削除できませんでした。');
        btn.disabled=false;
        btn.textContent='削除する';
      }
    };
  }

  function getReviewPanel(){
    const close=document.getElementById('v159WaybillReviewClose');
    if(!close) return null;

    let n=close;
    for(let i=0;i<6 && n;i++,n=n.parentElement){
      if(n.querySelector && n.querySelector('table') && /送り状確認/.test(n.textContent || '')){
        return n;
      }
    }
    return close.parentElement && close.parentElement.parentElement
      ? close.parentElement.parentElement
      : null;
  }

  function addDeleteButtons(){
    const panel=getReviewPanel();
    if(!panel) return;

    panel.querySelectorAll('table tr').forEach(function(tr){
      if(tr.querySelector('th')) return;
      if(tr.querySelector('.v16591-delete')) return;

      const id=idFromRow(tr);
      if(!id) return;

      const cells=tr.querySelectorAll('td');
      if(!cells.length) return;

      const status=String(cells[0] ? cells[0].innerText : '');
      if(!/要確認|不一致|未判定/.test(status)) return;

      const action=cells[cells.length-1];
      const btn=document.createElement('button');
      btn.className='mini v16591-delete';
      btn.textContent='削除';
      btn.dataset.waybillId=id;
      btn.onclick=function(){ showDeletePreview(id,tr); };
      action.appendChild(btn);
    });
  }

  async function fetchAllWaybills(){
    const c=sb();
    if(!c) return [];

    const r=await c.from(TABLE)
      .select('id,storage_path,original_filename,match_status,received_at,shipping_date,parsed_data')
      .order('received_at',{ascending:false});

    if(r.error){
      console.warn('[v165.9.1] waybill list error',r.error);
      return [];
    }
    return r.data || [];
  }

  async function renderDeletedSection(){
    const panel=getReviewPanel();
    if(!panel) return;

    const all=await fetchAllWaybills();
    const deleted=all.filter(isDeleted);

    let wrap=panel.querySelector('.v16591-deleted');
    if(!wrap){
      wrap=document.createElement('details');
      wrap.className='v16591-deleted';

      const auto=Array.from(panel.querySelectorAll('details')).find(function(d){
        const s=d.querySelector('summary');
        return s && /自動添付済みを表示/.test(s.textContent || '');
      });

      if(auto) auto.insertAdjacentElement('afterend',wrap);
      else panel.appendChild(wrap);
    }

    const html =
      '<summary>🗑 削除済のPDF（'+deleted.length+'件）</summary>'+
      '<div style="margin-top:10px">'+
      (deleted.length
        ? '<div class="tablewrap"><table style="min-width:620px">'+
            '<tr><th>FAX受信日</th><th>PDF名</th><th>操作</th></tr>'+
            deleted.map(function(w){
              const d=w.received_at ? new Date(w.received_at).toLocaleDateString('ja-JP') : '';
              return '<tr>'+
                '<td>'+esc(d)+'</td>'+
                '<td>'+esc(w.original_filename||'')+'</td>'+
                '<td><button class="mini v16591-open" data-waybill-id="'+esc(w.id)+'">PDF</button></td>'+
              '</tr>';
            }).join('')+
          '</table></div>'
        : '<div class="muted">削除済みPDFはありません。</div>')+
      '</div>';

    if(wrap.dataset.lastHtml !== html){
      wrap.innerHTML=html;
      wrap.dataset.lastHtml=html;

      wrap.querySelectorAll('.v16591-open').forEach(function(btn){
        btn.onclick=async function(){
          try{
            const w=await getWaybill(btn.dataset.waybillId);
            const url=await makeUrl(w.storage_path);
            if(url) window.open(url,'_blank','noopener');
          }catch(e){
            alert('PDFを開けませんでした。');
          }
        };
      });
    }
  }

  async function groupReviewByMonth(){
    const panel=getReviewPanel();
    if(!panel) return;

    const all=await fetchAllWaybills();
    const monthById=new Map();

    all.filter(function(w){ return !isDeleted(w); }).forEach(function(w){
      const raw=w.received_at || w.shipping_date || '';
      let key='日付不明';

      if(raw){
        const d=new Date(raw);
        if(!Number.isNaN(d.getTime())){
          key=d.getFullYear()+'年'+(d.getMonth()+1)+'月';
        }
      }
      monthById.set(String(w.id),key);
    });

    panel.querySelectorAll('.tablewrap').forEach(function(wrap){
      if(wrap.closest('.v16591-deleted')) return;
      if(wrap.dataset.v16591Grouped === '1') return;

      const table=wrap.querySelector(':scope > table');
      if(!table) return;

      const rows=Array.from(table.querySelectorAll('tr')).filter(function(tr){
        return !tr.querySelector('th') && !!idFromRow(tr);
      });

      if(rows.length < 2) return;

      const groups={};

      rows.forEach(function(tr){
        const key=monthById.get(idFromRow(tr)) || '日付不明';
        if(!groups[key]) groups[key]=[];
        groups[key].push(tr);
      });

      const keys=Object.keys(groups).sort(function(a,b){
        if(a==='日付不明') return 1;
        if(b==='日付不明') return -1;
        return b.localeCompare(a,'ja');
      });

      if(keys.length <= 1){
        wrap.dataset.v16591Grouped='1';
        return;
      }

      const header=table.querySelector('tr:has(th)');
      const holder=document.createElement('div');

      keys.forEach(function(key,i){
        const det=document.createElement('details');
        det.className='v16591-month';
        if(i===0) det.open=true;

        const body=document.createElement('div');
        body.className='v16591-month-body';

        const t=document.createElement('table');
        t.style.minWidth=table.style.minWidth || '760px';

        if(header) t.appendChild(header.cloneNode(true));
        groups[key].forEach(function(tr){ t.appendChild(tr); });

        const summary=document.createElement('summary');
        summary.textContent=key+'（'+groups[key].length+'件）';

        det.appendChild(summary);
        body.appendChild(t);
        det.appendChild(body);
        holder.appendChild(det);
      });

      wrap.innerHTML='';
      wrap.appendChild(holder);
      wrap.dataset.v16591Grouped='1';
    });
  }

  let reviewBusy=false;
  async function patchReview(){
    if(reviewBusy) return;
    if(!document.getElementById('v159WaybillReviewClose')) return;

    reviewBusy=true;
    try{
      addDeleteButtons();
      await groupReviewByMonth();
      await renderDeletedSection();
    }finally{
      reviewBusy=false;
    }
  }

  function syncVersion(){
    document.querySelectorAll('.v106-version').forEach(function(el){
      if(el.textContent !== VERSION) el.textContent=VERSION;
    });
  }

  let scheduled=false;

  function schedulePatch(){
    if(scheduled) return;
    scheduled=true;

    window.setTimeout(function(){
      scheduled=false;
      patchShipmentLayout();
      normalizeInventoryYears(document);
      syncVersion();
      patchReview();
    },80);
  }

  const observer=new MutationObserver(function(){
    schedulePatch();
  });

  observer.observe(document.documentElement,{
    subtree:true,
    childList:true
  });

  document.addEventListener('change',function(e){
    if(e.target && e.target.closest && e.target.closest('[data-v114-line]')){
      // 本体側のonchange処理が終わった後に、再描画された行だけ再配置
      setTimeout(schedulePatch,0);
    }
  },true);

  schedulePatch();

  console.log('[KOMBU v165.9.1] stable UI patch ready');
})();
