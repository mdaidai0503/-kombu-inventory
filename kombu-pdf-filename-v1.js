/* ===== 出荷依頼PDF・帳票プレビュー v1.1 =====
   形式: YYYYMMDD_出荷先名_出荷依頼.pdf
   同じ出荷日・出荷先が複数ある場合: _02, _03 ...
   Windowsで使えない記号は自動除去。
*/
(function(){
  'use strict';

  function safePart(value){
    return String(value || '')
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/[\u0000-\u001f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/g, '') || '出荷先未設定';
  }

  function yyyymmdd(value){
    const s=String(value || '').trim();
    const m=s.match(/^(\d{4})[-\/.]?(\d{1,2})[-\/.]?(\d{1,2})$/);
    if(m) return m[1]+String(m[2]).padStart(2,'0')+String(m[3]).padStart(2,'0');
    const d=new Date(s);
    if(!Number.isNaN(d.getTime())){
      return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
    }
    const now=new Date();
    return now.getFullYear()+String(now.getMonth()+1).padStart(2,'0')+String(now.getDate()).padStart(2,'0');
  }

  function destNameOf(s){
    if(!s) return '';
    if(s.destInfo && typeof s.destInfo==='object' && s.destInfo.name) return s.destInfo.name;
    if(s.dest && typeof s.dest==='object' && s.dest.name) return s.dest.name;
    if(typeof s.dest==='string' && s.dest) return s.dest;
    if(s.destination && typeof s.destination==='object' && s.destination.name) return s.destination.name;
    return s.destName || s.shipToName || '';
  }

  function allShipments(){
    const out=[];
    try{ if(typeof state!=='undefined' && Array.isArray(state.shipments)) state.shipments.forEach((s,i)=>out.push({s,ord:0,i})); }catch(_e){}
    try{ if(typeof hState!=='undefined' && Array.isArray(hState.shipments)) hState.shipments.forEach((s,i)=>out.push({s,ord:1,i})); }catch(_e){}
    try{ if(typeof nState!=='undefined' && Array.isArray(nState.shipments)) nState.shipments.forEach((s,i)=>out.push({s,ord:2,i})); }catch(_e){}
    try{ if(typeof smState!=='undefined' && Array.isArray(smState.shipments)) smState.shipments.forEach((s,i)=>out.push({s,ord:3,i})); }catch(_e){}
    return out;
  }

  function sequenceFor(shipment){
    const date=yyyymmdd(shipment && shipment.shipDate);
    const dest=safePart(destNameOf(shipment));
    const matches=allShipments().filter(x=>yyyymmdd(x.s && x.s.shipDate)===date && safePart(destNameOf(x.s))===dest);
    if(matches.length<=1) return 1;
    matches.sort((a,b)=>{
      const at=String(a.s?.createdAt || a.s?.updatedAt || '');
      const bt=String(b.s?.createdAt || b.s?.updatedAt || '');
      if(at!==bt) return at.localeCompare(bt);
      if(a.ord!==b.ord) return a.ord-b.ord;
      return a.i-b.i;
    });
    let idx=matches.findIndex(x=>x.s===shipment);
    if(idx<0 && shipment?.id) idx=matches.findIndex(x=>x.s?.id===shipment.id);
    if(idx<0) idx=0;
    return idx+1;
  }

  function filenameFor(shipment){
    const date=yyyymmdd(shipment && shipment.shipDate);
    const dest=safePart(destNameOf(shipment));
    const seq=sequenceFor(shipment);
    return `${date}_${dest}_出荷依頼${seq>1?'_'+String(seq).padStart(2,'0'):''}.pdf`;
  }

  async function saveOrSharePdf(blob, name){
    const file=new File([blob],name,{type:'application/pdf'});
    const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);

    if(isiOS && navigator.share && navigator.canShare){
      try{
        if(navigator.canShare({files:[file]})){
          await navigator.share({files:[file],title:name});
          return;
        }
      }catch(err){
        if(err && err.name==='AbortError') return;
        console.warn('PDF共有をダウンロードへ切替',err);
      }
    }

    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=name;
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},3000);
  }

  function makePreviewOverlay(canvases, shipment, blob, name){
    const old=document.getElementById('kombuShipmentPreviewOverlay');
    if(old) old.remove();

    const overlay=document.createElement('div');
    overlay.id='kombuShipmentPreviewOverlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:100000;background:#eef2f6;display:flex;flex-direction:column;';

    const head=document.createElement('div');
    head.style.cssText='background:#0b2b55;color:#fff;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex:0 0 auto;';
    head.innerHTML='<div style="font-weight:700">出荷依頼書プレビュー</div><button type="button" data-close style="border:0;border-radius:8px;background:#fff;color:#0b2b55;padding:8px 13px;font-weight:700">閉じる</button>';

    const area=document.createElement('div');
    area.style.cssText='flex:1 1 auto;overflow:auto;padding:10px;-webkit-overflow-scrolling:touch;';
    canvases.forEach(function(src){
      const wrap=document.createElement('div');
      wrap.style.cssText='background:#fff;margin:0 auto 12px;box-shadow:0 1px 7px #0003;max-width:1100px;';
      const c=document.createElement('canvas');
      c.width=src.width; c.height=src.height;
      c.style.cssText='display:block;width:100%;height:auto;';
      c.getContext('2d').drawImage(src,0,0);
      wrap.appendChild(c); area.appendChild(wrap);
    });

    const foot=document.createElement('div');
    foot.style.cssText='background:#fff;border-top:1px solid #ccd5df;padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px;flex:0 0 auto;padding-bottom:calc(10px + env(safe-area-inset-bottom));';
    foot.innerHTML='<button type="button" data-save style="padding:13px 8px;border:0;border-radius:10px;background:#0b2b55;color:#fff;font-size:15px;font-weight:700">PDF保存・共有</button><button type="button" data-fax style="padding:13px 8px;border:0;border-radius:10px;background:#173f73;color:#fff;font-size:15px;font-weight:700">FAXBOXへ送る</button>';

    overlay.append(head,area,foot);
    document.body.appendChild(overlay);

    const close=()=>overlay.remove();
    head.querySelector('[data-close]').onclick=close;
    foot.querySelector('[data-save]').onclick=async()=>{ await saveOrSharePdf(blob,name); };

    const faxBtn=foot.querySelector('[data-fax]');
    faxBtn.onclick=async()=>{
      try{
        // 専用FAXBOX UI側が提供する詳細送信APIを優先。
        if(typeof globalThis.kombuSendOneShipmentToFaxbox==='function'){
          await globalThis.kombuSendOneShipmentToFaxbox(shipment);
          return;
        }
        // ブリッジへ直接渡せる場合のフォールバック。
        if(typeof globalThis.kombuSendShipmentItemsToDedicated==='function'){
          alert('FAXBOX送信先の選択は出荷依頼画面の「FAXBOXへ送信」から行ってください。');
          return;
        }
        alert('FAXBOX連携機能を読み込めませんでした。');
      }catch(e){
        console.error(e);
        alert('FAXBOXへの送信処理を開始できませんでした。\n'+(e&&e.message?e.message:e));
      }
    };
  }

  async function outputNamedPdf(productName, shipment, activeYear, canvasMaker){
    if(!shipment) return;
    try{
      const ys=v55ShipmentYears(shipment,activeYear);
      const canvases=ys.map(y=>canvasMaker(shipment,y));
      const blob=await v65LandscapePdfBlobFromCanvases(canvases);
      const name=filenameFor(shipment);

      // v2.4: スマホでも即保存画面へ移動せず、必ずアプリ内プレビューを先に表示。
      makePreviewOverlay(canvases,shipment,blob,name);
    }catch(e){
      console.error(e);
      alert((productName||'出荷依頼')+'の帳票を表示できませんでした。\n'+(e&&e.message?e.message:e));
    }
  }

  // v69のPDF出力だけを差し替え、帳票レイアウトやFAXBOX処理には触れない。
  globalThis.v69OpenShipmentLandscapePdf=outputNamedPdf;
  globalThis.kombuShipmentPdfFilename=filenameFor;
})();
