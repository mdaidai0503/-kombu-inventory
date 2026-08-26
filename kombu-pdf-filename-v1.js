/* ===== 出荷依頼PDF ファイル名改善 v1.0 =====
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

  async function outputNamedPdf(productName, shipment, activeYear, canvasMaker){
    if(!shipment) return;
    try{
      const ys=v55ShipmentYears(shipment,activeYear);
      const canvases=ys.map(y=>canvasMaker(shipment,y));
      const blob=await v65LandscapePdfBlobFromCanvases(canvases);
      const name=filenameFor(shipment);
      const file=new File([blob],name,{type:'application/pdf'});

      // iPhone/iPadでは共有シート経由にすると「ファイルに保存」時も指定名を保持できる。
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

      // Windows / Android / 共有非対応ブラウザは指定名で直接保存。
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=name;
      a.style.display='none';
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},3000);
    }catch(e){
      console.error(e);
      alert((productName||'出荷依頼')+'のPDFを作成できませんでした。\n'+(e&&e.message?e.message:e));
    }
  }

  // v69のPDF出力だけを差し替え、帳票レイアウトやFAXBOX処理には触れない。
  globalThis.v69OpenShipmentLandscapePdf=outputNamedPdf;
  globalThis.kombuShipmentPdfFilename=filenameFor;
})();
