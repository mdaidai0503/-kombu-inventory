/* =========================================================
   昆布在庫管理 → FAXBOX専用アプリ 完全統合 UI v2.0
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
    const hist=load(HIST_KEY);
    const hm=new Map(hist.map(x=>[x.key,x]));
    const now=new Date().toISOString();

    (result?.succeeded||[]).forEach(groupResult=>{
      (groupResult.items||[]).forEach(it=>{
        hm.set(it.key,{
          ...it,
          archivedAt:now,
          faxboxQueuedAt:now,
          faxboxJobId:groupResult.jobId||'',
          faxboxStatus:'queued'
        });
      });
    });

    save(HIST_KEY,[...hm.values()]);
  }

  async function sendItems(items){
    if(typeof window.kombuSendShipmentItemsToDedicated!=='function'){
      alert('FAXBOX専用アプリとの連携機能を読み込めませんでした。ページを再読み込みしてください。');
      return null;
    }
    const result=await window.kombuSendShipmentItemsToDedicated(items,{confirm:true,showResult:true});
    if(result?.succeeded?.length)archiveSucceeded(result);
    return result;
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

  window.kombuFaxboxDirectIntegrationVersion='2.0';
})();
