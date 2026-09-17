/* =========================================================
   昆布在庫管理 v165.9.4 安定版UIパッチ
   - v165.9のフリーズ原因を除去
   - 出荷可能在庫の計算ロジックには触れない
     （既存本体 + v165.7の正しい計算をそのまま使用）
   - ④出荷明細レイアウトだけ安全に変更
   - 年度表示を「R7年産」等へ統一
   - 送り状確認に月別折りたたみ / 削除 / 削除済PDFを追加
   ========================================================= */
(function(){
  'use strict';

  const VERSION = 'v165.9.4';
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
    [data-v114-line] .v16592-top,
    [data-v114-line] .v16592-bottom{
      display:flex;
      justify-content:flex-start;
      align-items:flex-end;
      gap:14px;
      flex-wrap:wrap;
      width:100%;
    }
    [data-v114-line] .v16592-top{ margin-top:12px; }
    [data-v114-line] .v16592-bottom{ margin-top:12px; }

    [data-v114-line] .v16592-top label,
    [data-v114-line] .v16592-bottom label{
      margin:0 !important;
      text-align:left !important;
    }

    [data-v114-line] .v16592-product{ flex:0 1 230px; }
    [data-v114-line] .v16592-year{ flex:0 1 190px; }
    [data-v114-line] .v16592-coop{ flex:0 1 290px; }
    [data-v114-line] .v16592-section{ flex:0 1 230px; }
    [data-v114-line] .v16592-grade{ flex:0 1 270px; }
    [data-v114-line] .v16592-qty{ flex:0 1 230px; }

    [data-v114-line] .v16592-top select,
    [data-v114-line] .v16592-bottom select{
      width:100% !important;
      min-width:0 !important;
    }

    .v16592-delete{
      margin-left:6px !important;
      background:#fff !important;
      color:#c0392b !important;
      border:1px solid #d64236 !important;
    }

    .v16592-month{
      margin:10px 0;
      border:1px solid #d9e2ec;
      border-radius:10px;
      overflow:hidden;
      background:#fff;
    }

    .v16592-month>summary{
      cursor:pointer;
      padding:10px 12px;
      font-weight:800;
      background:#eef6ff;
      color:#123d6b;
    }

    .v16592-month-body{ padding:8px; }

    .v16592-deleted{
      margin-top:12px;
      border-top:1px solid #e5eaf0;
      padding-top:12px;
    }

    .v16592-deleted summary{
      cursor:pointer;
      font-weight:800;
    }

    .v16592-overlay{
      position:fixed;
      inset:0;
      z-index:999999;
      background:rgba(0,0,0,.48);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:16px;
    }

    .v16592-panel{
      width:min(1000px,96vw);
      height:min(820px,94vh);
      background:#fff;
      border-radius:14px;
      overflow:hidden;
      display:flex;
      flex-direction:column;
      box-shadow:0 18px 60px rgba(0,0,0,.3);
    }

    .v16592-head{
      display:flex;
      gap:10px;
      align-items:center;
      padding:12px 14px;
      border-bottom:1px solid #e5eaf0;
    }

    .v16592-head strong{ margin-right:auto; }

    .v16592-frame{
      flex:1;
      width:100%;
      border:0;
      background:#f2f4f6;
    }

    .v16592-foot{
      display:flex;
      justify-content:flex-end;
      gap:8px;
      padding:12px 14px;
      border-top:1px solid #e5eaf0;
    }


    .v16592-history-month td{
      padding:0 !important;
      background:#eef4fb !important;
    }
    .v16592-history-month button{
      width:100%;
      border:0;
      background:#eef4fb;
      color:#173760;
      text-align:left;
      padding:10px 12px;
      font-weight:900;
      cursor:pointer;
    }
    .v16592-history-cancelled td{
      background:#fff4f2 !important;
    }
    .v16592-history-cancelled button{
      background:#fff4f2;
      color:#b42318;
    }

    @media(max-width:700px){
      [data-v114-line] .v16592-product,
      [data-v114-line] .v16592-year,
      [data-v114-line] .v16592-coop,
      [data-v114-line] .v16592-section,
      [data-v114-line] .v16592-grade,
      [data-v114-line] .v16592-qty{
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
      const v = String(opt.value || '').trim();
      const m = (t.match(/^(R\d+)(?:年産|年)?$/) || v.match(/^(R\d+)(?:年産|年)?$/));
      if(!m) return;

      // 表示だけ「R8年産」にし、内部値は必ず「R8」のまま保持する。
      // <option>R8</option> は textContent を変えると value も変わるため、
      // 先に value 属性を明示してから表示文字を変更する。
      const canonical = m[1];
      opt.setAttribute('value', canonical);
      opt.value = canonical;
      opt.textContent = canonical + '年産';
    });
  }

  function integerQtyInput(box){
    const input=box.querySelector('[data-f="qty"]');
    if(!input || input.dataset.v16592Integer==='1') return;

    input.type='text';
    input.inputMode='numeric';
    input.pattern='[0-9]*';
    input.setAttribute('autocomplete','off');

    input.addEventListener('beforeinput',function(e){
      if(e.inputType && e.inputType.indexOf('delete')===0) return;
      if(e.data != null && !/^[0-9]+$/.test(e.data)) e.preventDefault();
    });

    input.addEventListener('input',function(){
      const raw=String(input.value||'');
      const m=raw.match(/^\d+/);
      let clean=m ? m[0] : '';
      clean=clean.replace(/^0+(?=\d)/,'');
      if(clean!==raw) input.value=clean;
    });

    input.addEventListener('change',function(){
      if(input.value==='') return;
      const n=Math.floor(Number(input.value));
      input.value=Number.isFinite(n) && n>0 ? String(n) : '';
    });

    input.dataset.v16592Integer='1';
  }

  function arrangeShipmentLine(box){
    if(!box) return;

    integerQtyInput(box);
    if(box.dataset.v16592Arranged === '1') return;

    const productLabel = labelOf(box,'[data-v114-product]');
    const yearLabel = labelOf(box,'[data-f="year"]');
    const coopLabel = labelOf(box,'[data-f="coop"],[data-f="location"]');
    const sectionLabel = labelOf(box,'[data-f="season"],[data-f="section"]');
    const gradeLabel = labelOf(box,'[data-f="gi"],[data-f="grade"]');
    const qtyLabel = labelOf(box,'[data-f="qty"]');

    if(!productLabel || !yearLabel || !coopLabel || !sectionLabel || !gradeLabel || !qtyLabel) return;

    const row1 = box.querySelector('.v118-row1');
    if(!row1) return;

    const top = document.createElement('div');
    top.className = 'v16592-top';

    const bottom = document.createElement('div');
    bottom.className = 'v16592-bottom';

    productLabel.classList.add('v16592-product');
    yearLabel.classList.add('v16592-year');
    coopLabel.classList.add('v16592-coop');
    sectionLabel.classList.add('v16592-section');
    gradeLabel.classList.add('v16592-grade');
    qtyLabel.classList.add('v16592-qty');

    top.appendChild(productLabel);
    top.appendChild(yearLabel);
    top.appendChild(coopLabel);

    bottom.appendChild(sectionLabel);
    bottom.appendChild(gradeLabel);
    bottom.appendChild(qtyLabel);

    row1.appendChild(top);
    row1.appendChild(bottom);

    const row2 = box.querySelector('.v118-row2');
    if(row2) row2.style.display='none';

    const row3 = box.querySelector('.v118-row3');
    if(row3){
      const empty=row3.querySelector(':scope > div:not(.v118-delete-wrap)');
      if(empty) empty.style.display='none';
    }

    normalizeYearSelect(box.querySelector('[data-f="year"]'));
    box.dataset.v16592Arranged = '1';
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

  function isTempSeptember2026(w){
    return !!(w && w.parsed_data && w.parsed_data.temp_september_2026_deleted === true);
  }

  function isDeleted(w){
    return !!(w && w.parsed_data && ((w.parsed_data.deleted_pdf && w.parsed_data.deleted_pdf.deleted === true) || w.parsed_data.temp_september_2026_deleted === true));
  }

  function isSeptember2026(w){
    // v165.10.11: 9月分の母集団はPDF内部の日付ではなくFAXファイル名で固定する。
    // FAX_202609...pdf のみ対象。FAX_202608...pdf は最初から9月候補外。
    const name=String(w && w.original_filename || '');
    return /^FAX_202609\d*/i.test(name);
  }

  async function setSeptember2026TemporaryDeleted(flag){
    const c=sb();
    if(!c) throw new Error('Supabaseへ接続できません。');
    const all=await fetchAllWaybills();
    const targets=all.filter(isSeptember2026);
    let changed=0;
    for(const w of targets){
      const parsed=Object.assign({},w.parsed_data||{});
      if(flag){
        if(parsed.temp_september_2026_deleted===true) continue;
        parsed.temp_september_2026_deleted=true;
        parsed.temp_september_2026_deleted_at=new Date().toISOString();
      }else{
        if(parsed.temp_september_2026_deleted!==true) continue;
        delete parsed.temp_september_2026_deleted;
        delete parsed.temp_september_2026_deleted_at;
      }
      // match_status / manual_link / 自動紐付け情報は変更しない。
      const r=await c.from(TABLE).update({parsed_data:parsed}).eq('id',w.id);
      if(r.error) throw r.error;
      changed++;
    }
    return {total:targets.length,changed};
  }

  function diagnosticStatus(w){
    if(isTempSeptember2026(w)) return '9月一時保管（削除済）';
    if(w && w.parsed_data && w.parsed_data.deleted_pdf && w.parsed_data.deleted_pdf.deleted===true) return '削除済';
    const p=(w&&w.parsed_data)||{};
    if((p.manual_link&&p.manual_link.linked===true) || w.match_status==='matched' || w.match_status==='auto_attached') return '添付済み';
    if(w.match_status==='review' || w.match_status==='needs_review') return '要確認';
    if(w.match_status==='unmatched') return '不一致';
    if(w.match_status==='ignored') return '除外';
    return '未判定';
  }

  function fmtJstDate(raw){
    if(!raw) return '';
    const d=new Date(raw);
    if(Number.isNaN(d.getTime())) return String(raw).slice(0,10);
    try{return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d);}
    catch(_){return d.toLocaleString('ja-JP');}
  }

  async function showSeptember2026Diagnostic(){
    const all=await fetchAllWaybills();
    // v165.10.12: 全件診断の『削除』は永久削除済み一覧へ移す操作。
    // 削除済みにしたPDFは診断一覧から外す（削除済み欄では引き続き閲覧可能）。
    const rows=all.filter(w=>isSeptember2026(w) && !(w && w.parsed_data && w.parsed_data.deleted_pdf && w.parsed_data.deleted_pdf.deleted===true));
    const counts={};
    rows.forEach(w=>{const k=diagnosticStatus(w);counts[k]=(counts[k]||0)+1;});
    const old=document.querySelector('.v165110-sept-diagnostic'); if(old) old.remove();
    const ov=document.createElement('div');
    ov.className='v165110-sept-diagnostic';
    ov.style.cssText='position:fixed;inset:0;z-index:1000001;background:rgba(15,23,42,.5);padding:18px;overflow:auto';
    const summary=Object.keys(counts).map(k=>esc(k)+' '+counts[k]+'件').join(' ／ ');
    ov.innerHTML='<div style="max-width:1100px;margin:20px auto;background:#fff;border-radius:16px;padding:18px">'+
      '<div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><h2 style="margin:0">2026年9月 浜中運輸FAX 全件診断</h2><div style="margin-top:5px;color:#627d98">ファイル名が FAX_202609 で始まる未削除PDFを表示します。削除したPDFは「削除済のPDF」へ移動します。</div></div><button class="btn secondary" data-close>閉じる</button></div>'+
      '<div style="margin:14px 0;padding:12px;background:#eef6ff;border-radius:10px"><b>合計 '+rows.length+'件</b><div style="margin-top:5px">'+esc(summary||'該当なし')+'</div></div>'+
      (rows.length?'<div class="tablewrap"><table style="min-width:900px"><tr><th>受信日時</th><th>現在の状態</th><th>PDF名</th><th>操作</th></tr>'+rows.map(w=>'<tr><td>'+esc(fmtJstDate(w.received_at||w.shipping_date))+'</td><td><b>'+esc(diagnosticStatus(w))+'</b></td><td>'+esc(w.original_filename||'')+'</td><td style="white-space:nowrap"><button class="mini" data-diag-open="'+esc(w.id)+'">PDF</button> <button class="mini danger" data-diag-delete="'+esc(w.id)+'">削除</button></td></tr>').join('')+'</table></div>':'<div class="muted">FAX_202609 で始まるFAX PDFは見つかりませんでした。</div>')+
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('[data-close]').onclick=()=>ov.remove();
    ov.onclick=e=>{if(e.target===ov)ov.remove();};
    ov.querySelectorAll('[data-diag-open]').forEach(btn=>btn.onclick=async()=>{try{const w=await getWaybill(btn.dataset.diagOpen);const url=await makeUrl(w.storage_path);if(url)window.open(url,'_blank','noopener');else alert('PDFの保存先がありません。');}catch(e){console.error(e);alert('PDFを開けませんでした。');}});
    ov.querySelectorAll('[data-diag-delete]').forEach(btn=>btn.onclick=async()=>{
      let w;
      try{ w=await getWaybill(btn.dataset.diagDelete); }catch(e){ alert('PDF情報を取得できませんでした。'); return; }
      if(!confirm('このFAX PDFを削除済みに移動します。\n\n'+String(w.original_filename||'')+'\n\nよろしいですか？')) return;
      btn.disabled=true; btn.textContent='削除中…';
      try{ await markDeleted(w); ov.remove(); await renderDeletedSection(); await showSeptember2026Diagnostic(); }
      catch(e){ console.error(e); alert('削除できませんでした。'); btn.disabled=false; btn.textContent='削除'; }
    });
  }

  function ensureSeptemberTemporaryControls(){
    const panel=getReviewPanel();
    if(!panel || panel.querySelector('.v165109-september-controls')) return;
    const box=document.createElement('div');
    box.className='v165109-september-controls';
    box.style.cssText='display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0;padding:10px;border:1px solid #d9e2ec;border-radius:10px;background:#f8fafc';
    box.innerHTML='<strong style="font-size:13px">2026年9月 浜中運輸FAX</strong><button class="mini" data-sept-diagnostic>9月FAX全件診断</button><button class="mini" data-sept-move>9月分を削除済へ一時移動</button><button class="mini secondary" data-sept-restore>一時移動を元に戻す</button><span class="muted" style="font-size:12px">紐付け情報は保持します</span>';
    const first=panel.querySelector('.tablewrap,details');
    if(first) first.insertAdjacentElement('beforebegin',box); else panel.appendChild(box);
    box.querySelector('[data-sept-diagnostic]').onclick=async function(){ this.disabled=true; try{await showSeptember2026Diagnostic();}catch(e){console.error(e);alert('9月FAXの診断に失敗しました。');}finally{this.disabled=false;} };
    box.querySelector('[data-sept-move]').onclick=async function(){
      if(!confirm('2026年9月の浜中運輸送り状FAX PDFを、削除済へ一時的にまとめます。\n既存の紐付け情報は保持します。よろしいですか？')) return;
      this.disabled=true;
      try{ const r=await setSeptember2026TemporaryDeleted(true); alert('9月分 '+r.total+'件を確認し、'+r.changed+'件を一時移動しました。'); location.reload(); }
      catch(e){ console.error(e); alert('一時移動に失敗しました。'); this.disabled=false; }
    };
    box.querySelector('[data-sept-restore]').onclick=async function(){
      if(!confirm('2026年9月分の一時移動だけを元に戻します。\n通常の「削除」操作をしたPDFは削除済のまま残ります。')) return;
      this.disabled=true;
      try{ const r=await setSeptember2026TemporaryDeleted(false); alert(r.changed+'件の一時移動を元に戻しました。'); location.reload(); }
      catch(e){ console.error(e); alert('元に戻せませんでした。'); this.disabled=false; }
    };
  }

  async function markDeleted(w){
    const c = sb();
    const parsed = Object.assign({}, w.parsed_data || {});
    // 一時保管中のPDFを通常削除した場合は、一時保管フラグを解除して通常の削除済みに確定する。
    delete parsed.temp_september_2026_deleted;
    delete parsed.temp_september_2026_deleted_at;
    parsed.deleted_pdf = {
      deleted:true,
      deleted_at:new Date().toISOString(),
      previous_match_status:w.match_status || ''
    };

    const r = await c.from(TABLE).update({
      match_status:'ignored',
      parsed_data:parsed
    }).eq('id',w.id).select('id,match_status,parsed_data').maybeSingle();

    if(r.error) throw r.error;
    if(!r.data || String(r.data.id)!==String(w.id) || !r.data.parsed_data || !r.data.parsed_data.deleted_pdf || r.data.parsed_data.deleted_pdf.deleted!==true){
      throw new Error('削除状態をSupabaseへ保存できませんでした。');
    }
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

    const old=document.querySelector('.v16592-overlay');
    if(old) old.remove();

    const overlay=document.createElement('div');
    overlay.className='v16592-overlay';
    overlay.innerHTML =
      '<div class="v16592-panel">'+
        '<div class="v16592-head">'+
          '<strong>PDFの確認</strong>'+
          '<span style="font-size:12px;color:#627d98">'+esc(w.original_filename||'')+'</span>'+
        '</div>'+
        (url
          ? '<iframe class="v16592-frame" src="'+esc(url)+'"></iframe>'
          : '<div class="v16592-frame" style="display:flex;align-items:center;justify-content:center">PDFを表示できませんでした。</div>')+
        '<div class="v16592-foot">'+
          '<button class="btn secondary" id="v16592Cancel">キャンセル</button>'+
          '<button class="btn danger" id="v16592Delete">削除する</button>'+
        '</div>'+
      '</div>';

    document.body.appendChild(overlay);

    document.getElementById('v16592Cancel').onclick=function(){ overlay.remove(); };

    document.getElementById('v16592Delete').onclick=async function(){
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
        console.error('[v165.9.2] delete error',e);
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
      if(tr.querySelector('.v16592-delete')) return;

      const id=idFromRow(tr);
      if(!id) return;

      const cells=tr.querySelectorAll('td');
      if(!cells.length) return;

      const status=String(cells[0] ? cells[0].innerText : '');
      if(!/要確認|不一致|未判定/.test(status)) return;

      const action=cells[cells.length-1];
      const btn=document.createElement('button');
      btn.className='mini v16592-delete';
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
      console.warn('[v165.9.2] waybill list error',r.error);
      return [];
    }
    return r.data || [];
  }

  async function renderDeletedSection(){
    const panel=getReviewPanel();
    if(!panel) return;

    const all=await fetchAllWaybills();
    const deleted=all.filter(isDeleted);

    let wrap=panel.querySelector('.v16592-deleted');
    if(!wrap){
      wrap=document.createElement('details');
      wrap.className='v16592-deleted';

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
                '<td>'+esc(w.original_filename||'')+(isTempSeptember2026(w)?' <span style="font-size:11px;color:#8a5a00">［9月一時保管］</span>':'')+'</td>'+
                '<td><button class="mini v16592-open" data-waybill-id="'+esc(w.id)+'">PDF</button></td>'+
              '</tr>';
            }).join('')+
          '</table></div>'
        : '<div class="muted">削除済みPDFはありません。</div>')+
      '</div>';

    if(wrap.dataset.lastHtml !== html){
      wrap.innerHTML=html;
      wrap.dataset.lastHtml=html;

      wrap.querySelectorAll('.v16592-open').forEach(function(btn){
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
      if(wrap.closest('.v16592-deleted')) return;
      if(wrap.dataset.v16592Grouped === '1') return;

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
        wrap.dataset.v16592Grouped='1';
        return;
      }

      const header=table.querySelector('tr:has(th)');
      const holder=document.createElement('div');

      keys.forEach(function(key,i){
        const det=document.createElement('details');
        det.className='v16592-month';
        if(i===0) det.open=true;

        const body=document.createElement('div');
        body.className='v16592-month-body';

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
      wrap.dataset.v16592Grouped='1';
    });
  }

  let reviewBusy=false;
  async function patchReview(){
    if(reviewBusy) return;
    if(!document.getElementById('v159WaybillReviewClose')) return;

    reviewBusy=true;
    try{
      ensureSeptemberTemporaryControls();
      addDeleteButtons();
      await groupReviewByMonth();
      await renderDeletedSection();
    }finally{
      reviewBusy=false;
    }
  }


  const SHIPMENT_MONTH_OPEN_KEY='kombu_shipment_history_month_open_v16592';

  function historyMonthKeyFromRow(tr){
    const td=tr.querySelector('td');
    const t=String(td ? td.textContent : '').trim();
    let m=t.match(/^(\d{4})[-\/.](\d{1,2})/);
    if(!m) return '日付不明';
    return m[1]+'-'+String(m[2]).padStart(2,'0');
  }

  function historyMonthLabel(key){
    const m=String(key).match(/^(\d{4})-(\d{2})$/);
    return m ? Number(m[1])+'年'+Number(m[2])+'月分' : key;
  }

  function loadShipmentMonthOpen(){
    try{
      const x=JSON.parse(localStorage.getItem(SHIPMENT_MONTH_OPEN_KEY)||'{}');
      return x && typeof x==='object' ? x : {};
    }catch(_){ return {}; }
  }

  function saveShipmentMonthOpen(x){
    try{ localStorage.setItem(SHIPMENT_MONTH_OPEN_KEY,JSON.stringify(x||{})); }catch(_){}
  }

  function groupShipmentHistoryByMonth(){
    const body=document.getElementById('v136HistBody');
    if(!body) return;

    const fresh=Array.from(body.querySelectorAll(':scope > tr[data-hid]')).filter(function(tr){
      return tr.dataset.v16592MonthGrouped!=='1';
    });
    if(!fresh.length) return;

    body.querySelectorAll(':scope > tr.v16592-history-month').forEach(function(tr){ tr.remove(); });

    const rows=Array.from(body.querySelectorAll(':scope > tr[data-hid]'));
    if(!rows.length) return;

    const active=[];
    const cancelled=[];

    rows.forEach(function(tr){
      const cells=tr.querySelectorAll('td');
      const status=String(cells[5] ? cells[5].textContent : '');
      if(/取消済/.test(status)) cancelled.push(tr);
      else active.push(tr);
    });

    const groups=new Map();
    active.forEach(function(tr){
      const key=historyMonthKeyFromRow(tr);
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(tr);
    });

    const keys=Array.from(groups.keys());
    const datedKeys=keys.filter(function(k){ return /^\d{4}-\d{2}$/.test(k); });
    const latestKey=datedKeys.slice().sort().reverse()[0] || keys[0] || '';

    const open=loadShipmentMonthOpen();
    const frag=document.createDocumentFragment();

    keys.forEach(function(key){
      const items=groups.get(key);
      const hasSaved=Object.prototype.hasOwnProperty.call(open,key);
      const show=hasSaved ? !!open[key] : key===latestKey;

      const head=document.createElement('tr');
      head.className='v16592-history-month';
      head.innerHTML='<td colspan="8"><button type="button" data-v16592-hmonth="'+esc(key)+'">'+
        '<span data-v16592-arrow>'+(show?'▼':'▶')+'</span> '+
        esc(historyMonthLabel(key))+'（'+items.length+'件）</button></td>';
      frag.appendChild(head);

      items.forEach(function(tr){
        tr.style.display=show ? 'table-row' : 'none';
        tr.dataset.v16592MonthGrouped='1';
        frag.appendChild(tr);
      });

      head.querySelector('button').onclick=function(){
        const next=!items.some(function(tr){ return tr.style.display!=='none'; });
        items.forEach(function(tr){ tr.style.display=next ? 'table-row' : 'none'; });
        open[key]=next;
        saveShipmentMonthOpen(open);
        const a=head.querySelector('[data-v16592-arrow]');
        if(a) a.textContent=next?'▼':'▶';
      };
    });

    if(cancelled.length){
      const key='__cancelled__';
      const hasSaved=Object.prototype.hasOwnProperty.call(open,key);
      const show=hasSaved ? !!open[key] : false;

      const head=document.createElement('tr');
      head.className='v16592-history-month v16592-history-cancelled';
      head.innerHTML='<td colspan="8"><button type="button">'+
        '<span data-v16592-arrow>'+(show?'▼':'▶')+'</span> 取消済（'+cancelled.length+'件）</button></td>';
      frag.appendChild(head);

      cancelled.forEach(function(tr){
        tr.style.display=show ? 'table-row' : 'none';
        tr.dataset.v16592MonthGrouped='1';
        frag.appendChild(tr);
      });

      head.querySelector('button').onclick=function(){
        const next=!cancelled.some(function(tr){ return tr.style.display!=='none'; });
        cancelled.forEach(function(tr){ tr.style.display=next ? 'table-row' : 'none'; });
        open[key]=next;
        saveShipmentMonthOpen(open);
        const a=head.querySelector('[data-v16592-arrow]');
        if(a) a.textContent=next?'▼':'▶';
      };
    }

    body.innerHTML='';
    body.appendChild(frag);

    if(typeof window.kombuWaybillPatchHistory==='function'){
      requestAnimationFrame(function(){
        try{ window.kombuWaybillPatchHistory(); }catch(_){}
      });
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
      groupShipmentHistoryByMonth();
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

  console.log('[KOMBU v165.9.2] stable UI patch ready');
})();
