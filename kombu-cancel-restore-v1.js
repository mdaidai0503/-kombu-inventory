/* =========================================================
   昆布在庫管理 取消解除 安定化 v1.1
   ---------------------------------------------------------
   - 取消解除後、旧FAXBOX取消通知・旧クラウド状態で再取消されない
   - 取消解除ロックをlocalStorageに保存し、再読込後も保護
   - 新しい取消日時が解除日時より新しい場合は、ユーザーの再取消として許可
   ========================================================= */
(function(){
  'use strict';

  const HIST_KEY='kombu-v136-shipment-history';
  const LOCK_KEY='kombu_cancel_restore_locks_v2';
  let wrapped=false;
  let patching=false;
  let enforcing=false;

  function loadLocks(){
    try{const x=JSON.parse(localStorage.getItem(LOCK_KEY)||'{}');return x&&typeof x==='object'?x:{};}catch(_e){return {};}
  }
  function saveLocks(x){try{localStorage.setItem(LOCK_KEY,JSON.stringify(x||{}));}catch(_e){}}
  function lockKey(product,id){return String(product||'')+'::'+String(id||'');}
  function putLock(product,id,data){const x=loadLocks();x[lockKey(product,id)]=data;saveLocks(x);}
  function delLock(product,id){const x=loadLocks();delete x[lockKey(product,id)];saveLocks(x);}
  function getLock(product,id){return loadLocks()[lockKey(product,id)]||null;}

  function storeInfo(product){
    try{
      if(product==='kushiro' && typeof state!=='undefined') return {store:state, save:typeof save==='function'?save:null};
      if(product==='hidaka' && typeof hState!=='undefined') return {store:hState, save:typeof hSave==='function'?hSave:null};
      if(product==='nemuro' && typeof nState!=='undefined') return {store:nState, save:typeof nSave==='function'?nSave:null};
      if(product==='sanmae' && typeof smState!=='undefined') return {store:smState, save:typeof smSave==='function'?smSave:null};
    }catch(_e){}
    return null;
  }
  function shipmentOf(product,id){
    const info=storeInfo(product); if(!info)return null;
    const shipment=(info.store.shipments||[]).find(x=>String(x?.id||'')===String(id||''));
    return shipment?{...info,shipment}:null;
  }
  function loadHistory(){try{const x=JSON.parse(localStorage.getItem(HIST_KEY)||'[]');return Array.isArray(x)?x:[];}catch(_e){return [];}}
  function saveHistory(hist){try{localStorage.setItem(HIST_KEY,JSON.stringify(hist||[]));}catch(_e){}}
  function clone(x){try{return JSON.parse(JSON.stringify(x));}catch(_e){return x;}}
  function normalizeCancelledFlags(obj){
    if(!obj||typeof obj!=='object')return;
    delete obj.cancelledAt; delete obj.canceledAt; delete obj.cancelled_at; delete obj.canceled_at;
    delete obj.isCancelled; delete obj.isCanceled;
  }
  function availabilityCheck(product,shipment){
    if(typeof v160AvailableForShipmentLine!=='function')return {ok:true};
    for(const line of (shipment.lines||[])){
      const qty=Number(line?.qty||0); let av=0;
      try{av=Number(v160AvailableForShipmentLine(product,line,shipment.id)||0);}catch(_e){continue;}
      if(qty>Math.max(0,av))return {ok:false,line,qty,av};
    }
    return {ok:true};
  }
  async function holdFaxboxJob(shipment){
    const jobId=String(shipment?.faxboxJobId||'').trim();
    if(!jobId)return {ok:true,skipped:true};
    const client=window.kombuSupabase;
    if(!client||typeof client.from!=='function')return {ok:false,error:'Supabase接続がまだ準備できていません。'};
    try{
      const result=await client.from('faxbox_jobs').update({
        status:'held',canceled_at:null,locked_at:null,last_error:null,updated_at:new Date().toISOString()
      }).eq('id',jobId).eq('status','canceled').select('id,status');
      if(result.error)return {ok:false,error:result.error.message||String(result.error)};
      return {ok:true,data:result.data||[]};
    }catch(e){return {ok:false,error:e instanceof Error?e.message:String(e)};}
  }
  function targetStateFor(s){
    if(s.shippedAt||s.sentAt)return {status:'shipped',faxboxStatus:'sent',inventoryAppliedByFaxbox:true};
    if(s.confirmedAt)return {status:'confirmed',faxboxStatus:'held',inventoryAppliedByFaxbox:true};
    return {status:'draft',faxboxStatus:'held',inventoryAppliedByFaxbox:false};
  }
  function normalizeHistory(product,id,shipment){
    const hist=loadHistory(); const key=String(product)+'::'+String(id); let changed=false;
    hist.forEach(it=>{
      if(String(it?.key||'')!==key && !(String(it?.product||'')===String(product)&&String(it?.id||'')===String(id)))return;
      it.status=shipment.status; it.faxboxStatus=shipment.faxboxStatus==='sent'?'sent':'held';
      it.snapshot=clone(shipment); normalizeCancelledFlags(it); if(it.snapshot)normalizeCancelledFlags(it.snapshot); changed=true;
    });
    if(changed)saveHistory(hist);
  }
  function rerenderHistory(){try{if(typeof window.v136ShipmentHistory==='function')setTimeout(()=>window.v136ShipmentHistory(),50);}catch(_e){}}
  function persistFound(found){
    try{if(typeof found?.save==='function')found.save();}catch(_e){}
  }

  async function restoreCancelled(product,id){
    const found=shipmentOf(product,id);
    if(!found){alert('取消解除する出荷依頼 '+id+' が見つかりません。');return false;}
    const s=found.shipment;
    const stock=availabilityCheck(product,s);
    if(!stock.ok){alert('取消解除できません。現在庫が不足しています。\n対象数量: '+stock.qty+' / 出荷可能: '+stock.av);return false;}
    const held=await holdFaxboxJob(s);
    if(!held.ok){alert('取消解除できません。FAXBOX側の取消状態を解除できませんでした。\n'+held.error);return false;}

    const target=targetStateFor(s); const restoredAt=new Date().toISOString(); const jobId=String(s.faxboxJobId||'').trim();
    Object.assign(s,target);
    normalizeCancelledFlags(s);
    s.cancelRestoredAt=restoredAt; s.cancelRestoreJobId=jobId; s.updatedAt=restoredAt;
    putLock(product,id,{jobId,restoredAt,target});
    persistFound(found); normalizeHistory(product,id,s);

    // 完全同期・LiveRefreshと同時に走っても、解除状態を最後に残す。
    [250,1200,3500].forEach(ms=>setTimeout(()=>enforceRestoreLocks(true),ms));
    try{if(typeof window.kombuSyncShipmentsForWaybill==='function')setTimeout(()=>window.kombuSyncShipmentsForWaybill(),180);}catch(_e){}
    rerenderHistory();
    return true;
  }

  function isNewManualCancellation(s,lock){
    const cancelledAt=Date.parse(String(s?.cancelledAt||s?.canceledAt||''));
    const restoredAt=Date.parse(String(lock?.restoredAt||''));
    return Number.isFinite(cancelledAt)&&Number.isFinite(restoredAt)&&cancelledAt>restoredAt+1500;
  }

  function enforceRestoreLocks(forceRender){
    if(enforcing)return; enforcing=true; let any=false;
    try{
      const locks=loadLocks();
      Object.keys(locks).forEach(k=>{
        const p=k.split('::'); const product=p.shift(); const id=p.join('::'); const lock=locks[k];
        const found=shipmentOf(product,id); if(!found)return;
        const s=found.shipment;
        if(isNewManualCancellation(s,lock)){delLock(product,id);return;}
        const incomingJob=String(s?.faxboxJobId||'').trim();
        if(lock.jobId && incomingJob && lock.jobId!==incomingJob){delLock(product,id);return;}
        const cancelled=String(s.status||'')==='cancelled'||['cancelled','canceled'].includes(String(s.faxboxStatus||''));
        if(cancelled){
          Object.assign(s,lock.target||targetStateFor(s)); normalizeCancelledFlags(s);
          s.cancelRestoredAt=lock.restoredAt; s.cancelRestoreJobId=lock.jobId||incomingJob; s.updatedAt=new Date().toISOString();
          persistFound(found); normalizeHistory(product,id,s); any=true;
        }
      });
    }finally{enforcing=false;}
    if(any&&forceRender)rerenderHistory();
  }

  function wrapCancellationSync(){
    if(wrapped)return true;
    const base=window.kombuApplyFaxboxInventory; if(typeof base!=='function')return false;
    window.kombuApplyFaxboxInventory=function(product,id,action,meta){
      if(action==='cancel'){
        const found=shipmentOf(product,id); const shipment=found?.shipment; const lock=getLock(product,id);
        const incomingJob=String(meta?.jobId||'').trim(); const currentJob=String(shipment?.faxboxJobId||'').trim();
        if(lock && !isNewManualCancellation(shipment,lock)){
          const lockedJob=String(lock.jobId||'').trim();
          if(!incomingJob || !lockedJob || incomingJob===lockedJob){
            console.info('[KOMBU cancel restore] restored cancellation ignored',{product,id,incomingJob,lockedJob});
            setTimeout(()=>enforceRestoreLocks(true),20); return true;
          }
        }
        if(shipment&&incomingJob&&currentJob&&incomingJob!==currentJob){
          console.info('[KOMBU cancel restore] stale cancellation ignored',{product,id,incomingJob,currentJob}); return true;
        }
      }
      return base.apply(this,arguments);
    };
    wrapped=true; return true;
  }

  function isRestoreButton(el){if(!el)return false;const text=String(el.textContent||'').replace(/\s/g,'');return text==='取消解除'||el.matches?.('[data-cancel-restore],[data-uncancel]');}
  async function onClickCapture(e){
    const btn=e.target?.closest?.('button,a'); if(!isRestoreButton(btn))return;
    const tr=btn.closest('tr[data-hid][data-hprod]'); if(!tr)return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); if(patching)return; patching=true;
    try{const ok=await restoreCancelled(tr.dataset.hprod,tr.dataset.hid);if(ok)alert('取消解除しました。通常の出荷依頼履歴へ戻しました。\nFAXは自動再送しません。');}finally{patching=false;}
  }
  function ensureRestoreButtons(){
    const body=document.getElementById('v136HistBody'); if(!body)return;
    body.querySelectorAll('tr[data-hid][data-hprod]').forEach(tr=>{
      const cells=tr.querySelectorAll('td'); if(cells.length<6)return; const statusCell=cells[5];
      if(!/取消済/.test(String(statusCell.textContent||'')))return;
      if(Array.from(statusCell.querySelectorAll('button,a')).some(isRestoreButton))return;
      const b=document.createElement('button'); b.type='button'; b.className='mini'; b.dataset.cancelRestore='1'; b.textContent='取消解除'; b.style.marginLeft='8px'; statusCell.appendChild(b);
    });
  }

  document.addEventListener('click',onClickCapture,true);
  const observer=new MutationObserver(()=>{wrapCancellationSync();ensureRestoreButtons();enforceRestoreLocks(false);});
  observer.observe(document.documentElement,{subtree:true,childList:true});
  setInterval(()=>{wrapCancellationSync();ensureRestoreButtons();enforceRestoreLocks(true);},1500);
  window.kombuRestoreCancelledShipment=restoreCancelled;
})();
