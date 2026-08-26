/* =========================================================
   昆布在庫管理 → FAXBOX専用アプリ 完全統合 UI v2.9
   ---------------------------------------------------------
   ・旧ローカルFAX BOXを通常操作から外す
   ・出荷指示一覧「まとめてFAXBOXへ」→ 専用FAXBOXへ直接登録
   ・出荷指示詳細「FAX BOXへ追加」→ 専用FAXBOXへ直接登録
   ・専用FAXBOX登録成功分を出荷指示履歴へ移動
   ・下部ナビの旧FAXボタンを非表示、履歴を含む4ボタン構成へ
   ========================================================= */
(function(){
  'use strict';

  const HIST_KEY='kombu-v136-shipment-history';
  let bulkSending=false;
  let detailSending=false;

  const clone=o=>JSON.parse(JSON.stringify(o));
  const load=(k)=>{try{const a=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(a)?a:[]}catch(_e){return []}};
  const save=(k,a)=>localStorage.setItem(k,JSON.stringify(a||[]));
  const key=(p,id)=>p+'::'+id;

  function lookup(p,id){
    try{
      if(p==='kushiro' && typeof state!=='undefined') return state?.shipments?.find(x=>x.id===id)||null;
      if(p==='hidaka' && typeof hState!=='undefined') return hState?.shipments?.find(x=>x.id===id)||null;
      if(p==='nemuro' && typeof nState!=='undefined') return nState?.shipments?.find(x=>x.id===id)||null;
      if(p==='sanmae' && typeof smState!=='undefined') return smState?.shipments?.find(x=>x.id===id)||null;
    }catch(_e){}
    return null;
  }

  function dest(p,x){
    try{
      if(p==='kushiro' && typeof globalThis.shipmentDest==='function'){
        const d=globalThis.shipmentDest(x)||{};
        return {name:d.name||'',address:d.address||'',phone:d.phone||''};
      }
    }catch(_e){}
    const d=x?.dest||{};
    return {name:d.name||x?.destInfo?.name||'',address:d.address||x?.destInfo?.address||'',phone:d.phone||x?.destInfo?.phone||''};
  }

  function source(p,x){
    try{
      if(p==='kushiro' && typeof globalThis.shipmentSource==='function'){
        const d=globalThis.shipmentSource(x)||{};
        return {name:d.name||'',address:d.address||'',phone:d.phone||''};
      }
    }catch(_e){}
    const d=x?.source||{};
    return {name:d.name||'',address:d.address||'',phone:d.phone||''};
  }

  function qty(x){return (x?.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0)}

  function itemFor(p,id){
    const x=lookup(p,id);
    if(!x)return null;
    return {
      key:key(p,id),product:p,id:id,addedAt:new Date().toISOString(),
      shipDate:x.shipDate||'',dest:dest(p,x),source:source(p,x),qty:qty(x),snapshot:clone(x)
    };
  }

  function archiveSucceeded(result){
    // v2.9: FAXBOX登録時点では「出荷依頼履歴」へ移さない。
    // 履歴保存はFAXBOX側の実送信完了を確認した時点で行う。
    const now=new Date().toISOString();
    (result?.succeeded||[]).forEach(groupResult=>{
      (groupResult.items||[]).forEach(it=>{
        const x=lookup(it.product,it.id);
        if(x){
          x.faxboxQueuedAt=now;
          x.faxboxJobId=groupResult.jobId||x.faxboxJobId||'';
          x.faxboxStatus='queued';
        }
      });
    });
  }

  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
  function dkey(it){ if(typeof window.kombuFaxboxDestinationKey==='function')return window.kombuFaxboxDestinationKey(it); return String(it?.dest?.name||'')+'\u0001'+String(it?.dest?.phone||''); }
  function groups(items){const m=new Map();items.forEach(it=>{const k=dkey(it);if(!m.has(k))m.set(k,[]);m.get(k).push(it)});return [...m.entries()]}
  async function chooseRecipients(items){
    if(typeof window.kombuLoadFaxboxRecipients!=='function')throw new Error('FAXBOX送信先マスターを読み込めません。');
    const recipients=await window.kombuLoadFaxboxRecipients();
    if(!recipients.length)throw new Error('FAXBOX送信先マスターに有効なFAX送信先がありません。');
    const gs=groups(items);
    return await new Promise(resolve=>{
      const overlay=document.createElement('div'); overlay.style.cssText='position:fixed;inset:0;background:#0008;z-index:100200;display:flex;align-items:center;justify-content:center;padding:16px';
      const box=document.createElement('div'); box.style.cssText='background:#fff;width:min(680px,100%);max-height:88vh;overflow:auto;border-radius:16px;padding:18px;color:#102a43';
      const opts='<option value="">選択してください</option>'+recipients.map((r,i)=>'<option value="'+i+'">'+esc(r.recipient_name)+'　'+esc(r.fax_number)+'</option>').join('');
      box.innerHTML='<h2 style="margin:0 0 8px">FAX送信先を選択</h2><div style="font-size:13px;color:#627d98;margin-bottom:14px">出荷人・出荷先とは別に、実際にこのPDFをFAXする相手を選択してください。</div>'+gs.map(([k,g],i)=>{const it=g[0];return '<div style="border:1px solid #d7e0ea;border-radius:12px;padding:12px;margin:10px 0"><div><b>出荷人：</b>'+esc(it?.source?.name||'未設定')+'</div><div><b>出荷先：</b>'+esc(it?.dest?.name||'未設定')+'</div><label style="display:block;margin-top:9px;font-weight:700">FAX送信先<select data-faxsel="'+i+'" style="width:100%;margin-top:5px;padding:11px;font-size:16px;border:1px solid #bcc9d8;border-radius:9px;background:#fff">'+opts+'</select></label></div>'}).join('')+'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px"><button data-cancel style="padding:13px;border:0;border-radius:10px;background:#e7edf5;font-weight:700">キャンセル</button><button data-ok style="padding:13px;border:0;border-radius:10px;background:#0b2b55;color:#fff;font-weight:700">FAXBOXへ登録</button></div>';
      overlay.appendChild(box);document.body.appendChild(overlay);
      box.querySelector('[data-cancel]').onclick=()=>{overlay.remove();resolve(null)};
      box.querySelector('[data-ok]').onclick=()=>{const map={};let missing=false;gs.forEach(([k],i)=>{const sel=box.querySelector('[data-faxsel="'+i+'"]');if(!sel.value){missing=true;return}map[k]=recipients[Number(sel.value)]});if(missing){alert('FAX送信先を選択してください。');return}overlay.remove();const preview=document.getElementById('kombuShipmentPreviewOverlay');if(preview)preview.remove();resolve(map)};
    });
  }

  async function sendItems(items){
    if(typeof window.kombuSendShipmentItemsToDedicated!=='function'){alert('FAXBOX専用アプリとの連携機能を読み込めませんでした。ページを再読み込みしてください。');return null;}
    try{
      const recipientByDestination=await chooseRecipients(items);
      if(!recipientByDestination)return {succeeded:[],failed:[],cancelled:true};
      const result=await window.kombuSendShipmentItemsToDedicated(items,{confirm:false,showResult:true,recipientByDestination});
      if(result?.succeeded?.length)archiveSucceeded(result);
      return result;
    }catch(e){alert('FAX送信先の選択に失敗しました。\n'+String(e?.message||e));return null;}
  }

  async function sendVisible(){
    if(bulkSending)return;
    const trs=[...document.querySelectorAll('#v76ShipBody tr[data-gprod][data-gid]')];
    const items=trs.map(tr=>itemFor(tr.dataset.gprod,tr.dataset.gid)).filter(Boolean);
    if(!items.length)return alert('FAXBOXへ送る出荷指示がありません。');

    bulkSending=true;
    const btn=document.getElementById('v136BulkFax');
    if(btn){btn.disabled=true;btn.textContent='FAXBOXへ登録中…';}
    try{
      const result=await sendItems(items);
      if(result?.succeeded?.length && typeof globalThis.v76ShipmentMenu==='function')globalThis.v76ShipmentMenu();
    }finally{
      bulkSending=false;
      tuneBulkButton();
    }
  }

  function detailContext(){
    const h=document.querySelector('#app h2');
    const txt=h?.textContent||'';
    let m;
    if((m=txt.match(/出荷指示書\s+(S\d+)/)))return ['kushiro',m[1]];
    if((m=txt.match(/日高昆布 出荷指示\s+(H\d+)/)))return ['hidaka',m[1]];
    if((m=txt.match(/根室産昆布 出荷指示\s+(N\d+)/)))return ['nemuro',m[1]];
    if((m=txt.match(/釧路産棹前昆布 出荷指示\s+([MS]\d+)/)))return ['sanmae',m[1]];
    return null;
  }

  async function sendDetail(btn){
    if(detailSending)return;
    const ctx=detailContext();
    if(!ctx)return alert('出荷指示を確認できません。');
    const it=itemFor(ctx[0],ctx[1]);
    if(!it)return alert('出荷指示が見つかりません。');

    detailSending=true;
    if(btn){btn.disabled=true;btn.textContent='FAXBOXへ登録中…';}
    try{
      const result=await sendItems([it]);
      if(result?.succeeded?.length && typeof globalThis.v76ShipmentMenu==='function')globalThis.v76ShipmentMenu();
    }finally{
      detailSending=false;
      if(btn){btn.disabled=false;btn.textContent='📤 FAXBOXへ送信';}
    }
  }

  async function sendOneShipmentFromPreview(shipment){
    if(!shipment) return null;
    const id=String(shipment.id||'');
    let product='';
    if(/^H/i.test(id)) product='hidaka';
    else if(/^N/i.test(id)) product='nemuro';
    else if(/^[MS]/i.test(id)) product='sanmae';
    else if(/^S/i.test(id)) product='kushiro';

    // Prefix aloneで判別できない場合は各在庫から検索。
    if(!product){
      for(const p of ['kushiro','hidaka','nemuro','sanmae']){
        if(lookup(p,id)){ product=p; break; }
      }
    }
    if(!product) throw new Error('出荷依頼の昆布種類を判別できません。');

    let it=itemFor(product,id);
    // 履歴から開いた場合に現行一覧から取得できないときは、
    // 画面で保持しているshipmentを利用できる最低限の形へ補完する。
    if(!it){
      const d=dest(product,shipment);
      it={
        product,
        id,
        shipDate:shipment.shipDate||'',
        source:shipment.source||{},
        dest:d||shipment.dest||{},
        raw:shipment,
        shipment
      };
    }
    return await sendItems([it]);
  }

  function confirmInventoryFor(product,shipment){
    if(!shipment || shipment.status==='confirmed' || shipment.status==='shipped')return true;
    try{
      if(product==='kushiro'){
        for(const l of shipment.lines||[]){
          const av=typeof globalThis.shipmentLineAvailable==='function'
            ? globalThis.shipmentLineAvailable(l,shipment.id)
            : null;
          if(av!=null && Number(l.qty)>Number(av))throw new Error('在庫不足があります。');
        }
        shipment.status='confirmed';shipment.confirmedAt=new Date().toISOString();
        if(typeof globalThis.save==='function')globalThis.save();
        return true;
      }
      if(product==='hidaka'){
        for(const l of shipment.lines||[])if(typeof globalThis.hAvail==='function' && Number(l.qty)>Number(globalThis.hAvail(l.year,l.location,l.section,l.grade,shipment.id)))throw new Error('在庫不足があります。');
        shipment.status='confirmed';shipment.confirmedAt=new Date().toISOString(); if(typeof globalThis.hSave==='function')globalThis.hSave(); return true;
      }
      if(product==='nemuro'){
        for(const l of shipment.lines||[])if(typeof globalThis.nAvail==='function' && Number(l.qty)>Number(globalThis.nAvail(l.year,l.coop,l.season,l.group,l.item,shipment.id)))throw new Error('在庫不足があります。');
        shipment.status='confirmed';shipment.confirmedAt=new Date().toISOString(); if(typeof globalThis.nSave==='function')globalThis.nSave(); return true;
      }
      if(product==='sanmae'){
        for(const l of shipment.lines||[])if(typeof globalThis.smAvail==='function' && Number(l.qty)>Number(globalThis.smAvail(l.year,l.coop,l.season,l.group,l.item,shipment.id)))throw new Error('在庫不足があります。');
        shipment.status='confirmed';shipment.confirmedAt=new Date().toISOString(); if(typeof globalThis.smSave==='function')globalThis.smSave(); return true;
      }
    }catch(e){throw e}
    return false;
  }

  function removePending(created){
    (created||[]).forEach(({product,shipment})=>{
      try{
        const store=product==='kushiro'?globalThis.state:product==='hidaka'?globalThis.hState:product==='nemuro'?globalThis.nState:globalThis.smState;
        if(store&&Array.isArray(store.shipments))store.shipments=store.shipments.filter(x=>x.id!==shipment.id);
        if(product==='kushiro'&&typeof globalThis.save==='function')globalThis.save();
        else if(product==='hidaka'&&typeof globalThis.hSave==='function')globalThis.hSave();
        else if(product==='nemuro'&&typeof globalThis.nSave==='function')globalThis.nSave();
        else if(product==='sanmae'&&typeof globalThis.smSave==='function')globalThis.smSave();
      }catch(_e){}
    });
  }

  async function completeNewShipmentFlow(created){
    if(!Array.isArray(created)||!created.length)return {success:false};
    const items=created.map(x=>itemFor(x.product,x.shipment.id)).filter(Boolean);
    if(items.length!==created.length){alert('出荷依頼データを確認できません。');return {success:false};}

    const result=await sendItems(items);
    if(!result || !result.succeeded?.length)return {success:false};

    try{
      for(const groupResult of result.succeeded){
        for(const it of (groupResult.items||[])){
          if(typeof window.kombuApplyFaxboxInventory!=='function'){
            throw new Error('在庫反映機能を読み込めません。');
          }
          window.kombuApplyFaxboxInventory(
            it.product,
            it.id,
            'confirm',
            {jobId:groupResult.jobId||''}
          );
        }
      }
    }catch(e){
      alert('FAXBOXへの登録は完了しましたが、在庫反映でエラーが発生しました。\n二重送信せず内容を確認してください。\n'+String(e?.message||e));
      return {success:false,faxboxRegistered:true};
    }

    const successCount=result.succeeded.reduce((n,g)=>n+(g.items||[]).length,0);
    if(successCount===created.length){
      alert('FAXBOXへ登録しました。\n在庫にも反映しました。');
      if(typeof globalThis.v76ShipmentMenu==='function')globalThis.v76ShipmentMenu();
      return {success:true};
    }

    alert('一部のみFAXBOXへ登録されました。成功分だけ在庫へ反映しました。');
    return {success:false,partial:true};
  }

  function tuneBulkButton(){
    const old=document.getElementById('v136BulkFax');
    if(!old || old.dataset.dedicatedFaxbox==='1')return;
    const b=old.cloneNode(true);
    b.dataset.dedicatedFaxbox='1';
    b.innerHTML='📤 FAXBOXへ送信';
    b.onclick=sendVisible;
    old.replaceWith(b);
  }

  function tuneDetailButton(){
    const old=document.getElementById('v99FaxAdd');
    if(!old || old.dataset.dedicatedFaxbox==='1')return;
    const b=old.cloneNode(true);
    b.dataset.dedicatedFaxbox='1';
    b.textContent='📤 FAXBOXへ送信';
    b.onclick=()=>sendDetail(b);
    old.replaceWith(b);
  }

  function tuneShipmentNav(){
    const nav=document.getElementById('v119ShipmentNav');
    if(!nav)return;
    const fax=nav.querySelector('#v119Fax');
    if(fax)fax.style.setProperty('display','none','important');
    nav.style.setProperty('grid-template-columns','repeat(4,1fr)','important');
    const hist=nav.querySelector('#v136History');
    if(hist)hist.style.removeProperty('display');
  }

  function removeLegacyFaxEntry(){
    document.getElementById('v99FaxBoxBtn')?.remove();
    /* 旧FAX BOX画面を通常導線から外す。古いデータ自体は安全のため削除しない。 */
  }

  function tune(){
    tuneBulkButton();
    tuneDetailButton();
    tuneShipmentNav();
    removeLegacyFaxEntry();
  }

  const mo=new MutationObserver(()=>requestAnimationFrame(tune));
  mo.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',tune);
  setTimeout(tune,100);
  setTimeout(tune,600);

  window.kombuSendOneShipmentToFaxbox=sendOneShipmentFromPreview;
  window.kombuCompleteNewShipmentFlow=completeNewShipmentFlow;
  window.kombuCancelPendingShipmentFlow=function(created){removePending(created);};
  window.kombuFaxboxDirectIntegrationVersion='2.9';
})();
