/* =========================================================
   昆布在庫管理 取消解除 安定化 v1.0
   ---------------------------------------------------------
   修正内容:
   1) 取消解除時、FAXBOXジョブを canceled のまま残さない。
      安全のため held に移し、再送はしない。
   2) 出荷依頼本体・履歴snapshot・履歴faxboxStatusの
      取消フラグを同時に解除する。
   3) 過去テストの canceled FAXBOXジョブが、同じ出荷IDを
      再利用した新しい出荷依頼を再取消ししないよう、
      faxboxJobId が一致する取消だけを適用する。
   ========================================================= */
(function(){
  'use strict';

  const HIST_KEY='kombu-v136-shipment-history';
  let wrapped=false;
  let patching=false;

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
    const info=storeInfo(product);
    if(!info) return null;
    const shipment=(info.store.shipments||[]).find(x=>String(x?.id||'')===String(id||''));
    return shipment?{...info,shipment}:null;
  }

  function loadHistory(){
    try{
      const x=JSON.parse(localStorage.getItem(HIST_KEY)||'[]');
      return Array.isArray(x)?x:[];
    }catch(_e){ return []; }
  }

  function saveHistory(hist){
    localStorage.setItem(HIST_KEY,JSON.stringify(hist||[]));
  }

  function clone(x){
    try{return JSON.parse(JSON.stringify(x));}catch(_e){return x;}
  }

  function normalizeCancelledFlags(obj){
    if(!obj || typeof obj!=='object') return;
    delete obj.cancelledAt;
    delete obj.canceledAt;
    delete obj.cancelled_at;
    delete obj.canceled_at;
    delete obj.isCancelled;
    delete obj.isCanceled;
  }

  function availabilityCheck(product,shipment){
    if(typeof v160AvailableForShipmentLine!=='function') return {ok:true};
    for(const line of (shipment.lines||[])){
      const qty=Number(line?.qty||0);
      let av=0;
      try{ av=Number(v160AvailableForShipmentLine(product,line,shipment.id)||0); }
      catch(_e){ continue; }
      if(qty>Math.max(0,av)){
        return {ok:false,line,qty,av};
      }
    }
    return {ok:true};
  }

  async function holdFaxboxJob(shipment){
    const jobId=String(shipment?.faxboxJobId||'').trim();
    if(!jobId) return {ok:true,skipped:true};

    const client=window.kombuSupabase;
    if(!client || typeof client.from!=='function'){
      return {ok:false,error:'Supabase接続がまだ準備できていません。'};
    }

    try{
      const result=await client
        .from('faxbox_jobs')
        .update({
          status:'held',
          canceled_at:null,
          locked_at:null,
          last_error:null,
          updated_at:new Date().toISOString()
        })
        .eq('id',jobId)
        .in('status',['canceled','cancelled'])
        .select('id,status');

      if(result.error) return {ok:false,error:result.error.message||String(result.error)};
      return {ok:true,data:result.data||[]};
    }catch(e){
      return {ok:false,error:e instanceof Error?e.message:String(e)};
    }
  }

  async function restoreCancelled(product,id){
    const found=shipmentOf(product,id);
    if(!found){
      alert('取消解除する出荷依頼 '+id+' が見つかりません。');
      return false;
    }

    const s=found.shipment;
    if(String(s.status||'')!=='cancelled' && String(s.faxboxStatus||'')!=='cancelled' && String(s.faxboxStatus||'')!=='canceled'){
      // 履歴側だけ取消表示が残っている場合も正規化する。
      normalizeHistory(product,id,s);
      rerenderHistory();
      return true;
    }

    const stock=availabilityCheck(product,s);
    if(!stock.ok){
      alert('取消解除できません。現在庫が不足しています。\n対象数量: '+stock.qty+' / 出荷可能: '+stock.av);
      return false;
    }

    const held=await holdFaxboxJob(s);
    if(!held.ok){
      alert('取消解除できません。FAXBOX側の取消状態を解除できませんでした。\n'+held.error);
      return false;
    }

    // FAXを勝手に再送しないため、送信完了には戻さない。
    // 取消前に確定済みだった依頼は confirmed に戻して在庫を再引当。
    // 送信完了日時が明確に残っている場合だけ shipped を維持する。
    const wasSent=Boolean(s.shippedAt || s.sentAt);
    if(wasSent){
      s.status='shipped';
      s.faxboxStatus='sent';
      s.inventoryAppliedByFaxbox=true;
    }else if(s.confirmedAt){
      s.status='confirmed';
      s.faxboxStatus='held';
      s.inventoryAppliedByFaxbox=true;
    }else{
      s.status='draft';
      s.faxboxStatus='held';
      s.inventoryAppliedByFaxbox=false;
    }

    normalizeCancelledFlags(s);
    s.cancelRestoredAt=new Date().toISOString();
    s.updatedAt=s.cancelRestoredAt;

    if(typeof found.save==='function') found.save();
    normalizeHistory(product,id,s);

    // 送り状照合用クラウド同期もすぐ更新。
    try{
      if(typeof window.kombuSyncShipmentsForWaybill==='function'){
        setTimeout(()=>window.kombuSyncShipmentsForWaybill(),150);
      }
    }catch(_e){}

    rerenderHistory();
    return true;
  }

  function normalizeHistory(product,id,shipment){
    const hist=loadHistory();
    const key=String(product)+'::'+String(id);
    let changed=false;
    hist.forEach(it=>{
      if(String(it?.key||'')!==key && !(String(it?.product||'')===String(product)&&String(it?.id||'')===String(id))) return;
      it.status=shipment.status;
      it.faxboxStatus=shipment.faxboxStatus==='sent'?'sent':'held';
      it.snapshot=clone(shipment);
      normalizeCancelledFlags(it);
      if(it.snapshot) normalizeCancelledFlags(it.snapshot);
      changed=true;
    });
    if(changed) saveHistory(hist);
  }

  function rerenderHistory(){
    try{
      if(typeof window.v136ShipmentHistory==='function'){
        setTimeout(()=>window.v136ShipmentHistory(),50);
      }
    }catch(_e){}
  }

  function wrapCancellationSync(){
    if(wrapped) return true;
    const base=window.kombuApplyFaxboxInventory;
    if(typeof base!=='function') return false;

    window.kombuApplyFaxboxInventory=function(product,id,action,meta){
      if(action==='cancel'){
        const found=shipmentOf(product,id);
        const shipment=found?.shipment;
        const incomingJob=String(meta?.jobId||'').trim();
        const currentJob=String(shipment?.faxboxJobId||'').trim();

        // 過去テスト等で同じ出荷IDが再利用されても、別FAXジョブの取消は無視する。
        if(shipment && incomingJob && currentJob && incomingJob!==currentJob){
          console.info('[KOMBU cancel restore] stale cancellation ignored',{
            product,id,incomingJob,currentJob
          });
          return true;
        }
      }
      return base.apply(this,arguments);
    };

    wrapped=true;
    return true;
  }

  function isRestoreButton(el){
    if(!el) return false;
    const text=String(el.textContent||'').replace(/\s/g,'');
    return text==='取消解除' || el.matches?.('[data-cancel-restore],[data-uncancel]');
  }

  async function onClickCapture(e){
    const btn=e.target?.closest?.('button,a');
    if(!isRestoreButton(btn)) return;
    const tr=btn.closest('tr[data-hid][data-hprod]');
    if(!tr) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if(patching) return;
    patching=true;
    try{
      const ok=await restoreCancelled(tr.dataset.hprod,tr.dataset.hid);
      if(ok) alert('取消解除しました。通常の出荷依頼履歴へ戻しました。\nFAXは自動再送しません。');
    }finally{
      patching=false;
    }
  }

  function ensureRestoreButtons(){
    const body=document.getElementById('v136HistBody');
    if(!body) return;
    body.querySelectorAll('tr[data-hid][data-hprod]').forEach(tr=>{
      const cells=tr.querySelectorAll('td');
      if(cells.length<6) return;
      const statusCell=cells[5];
      if(!/取消済/.test(String(statusCell.textContent||''))) return;
      if(Array.from(statusCell.querySelectorAll('button,a')).some(isRestoreButton)) return;
      const b=document.createElement('button');
      b.type='button';
      b.className='mini';
      b.dataset.cancelRestore='1';
      b.textContent='取消解除';
      b.style.marginLeft='8px';
      statusCell.appendChild(b);
    });
  }

  document.addEventListener('click',onClickCapture,true);

  const observer=new MutationObserver(()=>{
    wrapCancellationSync();
    ensureRestoreButtons();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});

  const timer=setInterval(()=>{
    const ok=wrapCancellationSync();
    ensureRestoreButtons();
    if(ok && document.readyState==='complete'){
      // 監視は継続。intervalだけ停止。
      clearInterval(timer);
    }
  },500);

  window.kombuRestoreCancelledShipment=restoreCancelled;
})();
