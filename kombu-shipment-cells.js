(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=x=>String(x??'').normalize('NFKC').replace(/[\s,，]+/g,'');
const number=x=>{const s=norm(x);return s!==''&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)?Number(s):NaN;};
const unitOf=r=>r.unit||r.purchase_unit||'';
const fmt=x=>Number(x||0).toLocaleString('ja-JP',{maximumFractionDigits:10});
function token(p,r){return p+':'+root.KombuModel.key(p,r);}
function label(p,r){return [root.KombuModel.PRODUCTS[p],r.year,...(p==='hidaka'?[r.location,r.section,r.grade]:[r.coop,r.season,r.group,r.item]),...(p.startsWith('rausu_')?[unitOf(r)]:[])].filter(Boolean).join(' / ');}
const isKg=(p,l)=>p.startsWith('rausu_')&&/^(kg|キロ|㎏|キログラム)$/i.test(norm(unitOf(l)));
function quantity(item){return number(item.count);}
function countOf(l){return l.shipmentCount!==undefined?Number(l.shipmentCount):Number(l.qty||0);}
function quotePackWeight(item){const pack=number(item.unit),count=number(item.count),weight=number(item.quantity);if(!(pack>0))throw Error('見積の1本あたり重量（入数）を確認してください。');if(count>0&&weight>0&&Math.abs(pack*count-weight)>0.000001*Math.max(1,weight))throw Error('見積の本数・1本重量・重量が一致しません。');return pack;}
function setShipmentCount(lines,p,line,value,factor){
 const count=number(value);if(!Number.isFinite(count)||count<0)throw Error('本数は0以上の数値で入力してください。');
 const old=lines.find(l=>token(l.product,l)===token(p,line));const pack=number(factor||old?.kgPerCount);
 if(isKg(p,line)&&count>0&&!(pack>0))throw Error('kg管理の在庫は、先に1本あたり重量を入力してください。');
 setQuantity(lines,p,line,isKg(p,line)?count*(pack||1):count);
 const saved=lines.find(l=>token(l.product,l)===token(p,line));if(saved)Object.assign(saved,{shipmentCount:count,...(isKg(p,line)?{kgPerCount:pack}:{})});
}
function quoteDestination(db,customer){
 const name=String(customer||'').trim(),key=s=>norm(s).replace(/株式会社|有限会社|\(株\)|\(有\)/g,''),target=key(name);
 const companies=(db.products?.kushiro?.companies||[]).filter(c=>c&&typeof c==='object'&&c.active!==false&&c.name);
 let matches=companies.filter(c=>key(c.name)===target);
 if(!matches.length)matches=companies.filter(c=>{const n=key(c.name);return n&&target.startsWith(n)&&/^(?:御中|様|.{1,20}(?:社長|会長|様))$/.test(target.slice(n.length));});
 const found=matches.length===1?matches[0]:null;
 const rawPostal=String(found?.postal||found?.postal_code||''),digits=rawPostal.replace(/\D/g,'');
 return {name:found?.name||name,postal:digits.length===7?digits.slice(0,3)+'-'+digits.slice(3):rawPostal,address:found?.address||'',phone:found?.phone||'',company:found};
}
function setQuantity(lines,p,line,value){
 const q=number(value);if(!Number.isFinite(q)||q<0)throw Error('数量は0以上の数値で入力してください。');
 const k=token(p,line),old=lines.filter(l=>token(l.product,l)===k);
 const refs=old.flatMap(l=>l.quoteRefs||[]);
 for(let i=lines.length-1;i>=0;i--)if(token(lines[i].product,lines[i])===k)lines.splice(i,1);
 const fields=p==='hidaka'?['year','location','section','grade']:['year','coop','season','group','item',...(p.startsWith('rausu_')?['unit']:[])];
 const dimensions=Object.fromEntries(fields.map(f=>[f,f==='unit'?unitOf(line):line[f]]));
 if(q>0)lines.push({...dimensions,product:p,qty:q,...(refs.length?{quoteRefs:refs}:{})});
}
function regularCells(p,year){
 const m=root.KombuStockTable.masters[p],out=[];
 if(p==='hidaka'){
  const rows=m.sections.flatMap(s=>s.items.map(grade=>({section:s.name,grade}))),n=rows.length;
  const scale=(n*26+32-11*34)/((n-11)*26+32),w=(1684-70-70-95-60)/m.locations.length;
  let y=414;
  rows.forEach((r,i)=>{const h=i<11?34:26*scale;m.locations.forEach((location,j)=>out.push({line:{year,location,...r},x:200+j*w,y,w,h}));y+=h;});
 }else{
  const columns=m.groups.flatMap(g=>g.items.map(item=>({group:g.name,item}))),k=p==='kushiro';
  const left=k?44:34,coopW=k?126:92,seasonW=k?52:45,totalW=k?62:58;
  const w=(1684-left*2-coopW-seasonW-totalW)/columns.length,h=k?42:p==='nemuro'?70:64;
  m.coops.forEach((coop,i)=>m.seasons.forEach((season,j)=>columns.forEach((c,n)=>out.push({line:{year,coop,season,...c},x:left+coopW+seasonW+n*w,y:366+(k?66:88)+(i*(m.seasons.length+1)+j)*h,w,h}))));
 }
 return out;
}
function rausuPages(p,year,unit,db,lines){
 const M=root.KombuModel,map=new Map();
 for(const l of [...M.stock(db,p),...lines.filter(l=>l.product===p)])if(l.year===year&&unitOf(l)===unit)map.set(M.key(p,l),{year,coop:l.coop,season:l.season,group:l.group,item:l.item,unit,qty:0});
 const sheets=root.KombuRausuLayout.sheets([...map.values()]);
 return sheets.map(sheet=>{
  const cells=[],layout=root.KombuOriginalPdf.rausuLayout,tx=layout.left,half=(layout.width-2*tx)/2,h=layout.rowHeight;
  function table(key,left,top){const d=root.KombuRausuLayout.sections[key],misc=key==='misc';let y=top+(misc?2*h:h);
   for(const g of sheet[key])for(let r=0;r<g.count;r++){
    if(g.product&&g.grades[r])d.items.forEach((item,j)=>cells.push({line:{year,coop:d.coop,season:g.product+g.kind,group:g.grades[r],item,unit},x:left+half*(3+j)/7,y,w:half/7,h}));y+=h;
   }return y+h;
  }
  table('natural',tx,layout.tableTop);const right=table('cultivated',tx+half,layout.tableTop);table('misc',tx+half,right);
  return {cells};
 });
}
function pages(p,year,unit,db,lines){return p.startsWith('rausu_')?rausuPages(p,year,unit,db,lines):[{cells:regularCells(p,year)}];}
function classificationKey(p,line){return token(p,{...line,year:'',unit:'',purchase_unit:''});}
function classificationChoices(db){
 const unique=new Map();for(const p of Object.keys(root.KombuModel.PRODUCTS))for(const l of root.KombuModel.stock(db,p)){
  const key=classificationKey(p,l);if(!unique.has(key))unique.set(key,{key,p,line:{...l,year:'',unit:'',purchase_unit:''}});
 }return [...unique.values()];
}
function recognizeQuoteItem(item,choices){
 const text=norm(item.name).replace(/(?:20\d{2}|R\d{1,2}|令和\d{1,2})(?:年産|年)?/gi,'').replace(/後採/g,'后採'),fields={};let product='';
 if(/羅臼|ラウス|らうす/.test(text))product=/長切|長きり/.test(text)?'rausu_long':'rausu_normal';
 else if(/日高/.test(text))product='hidaka';
 else if(/貝殻|根室|歯舞|落石/.test(text))product='nemuro';
 else if(/棹前|釧棹/.test(text))product='sanmae';
 else if(/釧路|東部|昆布森|厚岸|散布|浜中/.test(text))product='kushiro';
 let candidates=choices.filter(c=>!product||c.p===product);
 const set=(field,value)=>{if(value!==undefined&&value!==''){fields[field]=value;candidates=candidates.filter(c=>norm(c.line[field])===norm(value));}};
 const grade=text.match(/(\d+)等/),rank=grade?.[1];
 if(product.startsWith('rausu_')){
  const natural=/天然/.test(text),cultivated=/養殖/.test(text),side=natural?'天然':cultivated?'養殖':'';
  if(/加工/.test(text)&&side){set('coop','雑系');set('season','加工昆布（'+side+'）');if(rank)set('group',rank+'等');set('item','数量');}
  else if(/赤葉/.test(text)){set('coop','雑系');set('season','赤葉');const g=text.match(/赤葉([AB])/i);if(g)set('group',g[1].toUpperCase());set('item','数量');}
  else if(/頭/.test(text)&&side){set('coop','雑系');set('season','頭　'+side);const g=text.match(/頭[（(]?(大|小)/);if(g)set('group',g[1]);set('item','数量');}
  else{
   if(side)set('coop',side);if(rank)set('group',rank+'等');
   if(natural){
    if(/赤/.test(text))set('item','赤');else if(/黒/.test(text))set('item','黒');
    if(rank==='5')set('season','元揃');
    else if(/羅.*傷|傷羅/.test(text.replace(/羅臼/g,'')))set('season','元揃（傷羅）');
    else if(/走.*傷|傷/.test(text))set('season','元揃（傷）');
    else if(/羅/.test(text.replace(/羅臼/g,'')))set('season','元揃（黒羅）');
    else if(/走白|白走/.test(text))set('season','元揃（白走）');
    else if(/走/.test(text))set('season','元揃（走）');
   }else if(cultivated){
    if(/人工/.test(text))set('item','人工');else if(/自然/.test(text))set('item','自然');
    if(rank==='5')set('season','元揃');else if(/傷/.test(text))set('season','元揃（黒傷）');else if(/黒白|走白|白走/.test(text))set('season','元揃（黒白）');else if(/黒走/.test(text))set('season','元揃（黒走）');
   }
  }
 }else{
  const locationField=product==='hidaka'?'location':'coop';
  const locations=[...new Set(candidates.map(c=>c.line[locationField]).filter(Boolean))].filter(v=>{const n=norm(v).replace(/漁協$/,'');return n&&text.includes(n)&&!/各浜込/.test(text);});
  if(locations.length===1)set(locationField,locations[0]);
  if(product==='hidaka'){
   if(/加工/.test(text)){set('section','雑');if(rank)set('grade','加'+(/拾/.test(text)?'拾':/水/.test(text)?'水':'')+rank+'等');}
   else{
    const sections=['走り','后採','拾い'].filter(s=>text.includes(s)||s==='拾い'&&/拾/.test(text));if(sections.length===1)set('section',sections[0]);
    if(rank){const tag=/尺/.test(text)?'(尺)':/白/.test(text)?(['1','2'].includes(rank)?'白':'(白)'):'';const matches=[...new Set(candidates.map(c=>c.line.grade))].filter(g=>norm(g)===tag+rank+'等');if(matches.length===1)set('grade',matches[0]);else candidates=[];}
   }
  }else{
   const alias=s=>norm(s).replace(/うすば\(夏\)/g,'薄葉').replace(/あつば\(夏\)|厚葉/g,'厚葉').replace(/\(夏\)/g,'');
   const groups=[...new Set(candidates.map(c=>c.line.group).filter(Boolean))].filter(g=>text.includes(norm(g))||text.includes(alias(g)));
   if(groups.length){const longest=Math.max(...groups.map(g=>alias(g).length)),best=groups.filter(g=>alias(g).length===longest);if(best.length===1)set('group',best[0]);}
   const season=/拾/.test(text)?(/拾い/.test(text)?'拾い':'拾'):/秋/.test(text)?'秋':/夏/.test(text)?'夏':/採り/.test(text)?'採り':'';
   if(season){const values=[...new Set(candidates.map(c=>c.line.season))].filter(v=>v===season||v.replace(/い$/,'')===season.replace(/い$/,''));if(values.length===1)set('season',values[0]);}
   if(rank){const prefix=text.replace(/厚葉/g,'').match(/(特|葉|元|棹|花|水|尺|短)(?:[1-5]等)/)?.[1]||(/貝殻棹前/.test(text)&&rank==='1'?'棹':'');const items=[...new Set(candidates.map(c=>c.line.item))].filter(v=>{const v0=norm(v).replace(/等/g,'');return prefix?v0===prefix+rank:v0===rank||v0==='夏'+rank;});if(items.length===1)set('item',items[0]);else candidates=candidates.filter(c=>items.includes(c.line.item));}
  }
 }
 if(product.startsWith('rausu_')&&!fields.group)candidates=[];
 if(product==='hidaka'&&!fields.grade)candidates=[];
 // Without a clear product or any classification token, do not map arbitrary stock.
 if(!product&&!Object.keys(fields).length)candidates=[];
 return {product:product||(candidates.length===1?candidates[0].p:''),fields,matches:candidates,key:candidates.length===1?candidates[0].key:''};
}
function resolveQuoteRows(db,rows,choices,year,product,unit){
 if(!year)throw Error('下の年産を選択してから「一括転記」を押してください。');
 const stocks=[],resolved=[];
 for(const row of rows){const allocations=[];if(!row.skip)for(const a of row.allocations){
  const selected=choices.find(c=>c.key===a.stock);if(!selected)throw Error('商品 '+(row.index+1)+' の自動判定を確認してください。');
  let candidates=root.KombuModel.stock(db,selected.p).filter(l=>l.year===year&&classificationKey(selected.p,l)===selected.key);
  if(selected.p===product&&selected.p.startsWith('rausu_')&&unit)candidates=candidates.filter(l=>unitOf(l)===unit);
  if(candidates.length!==1)throw Error('商品 '+(row.index+1)+'：選択した年産の在庫・数量単位を一意に特定できません。年産や分類を確認してください。');
  const line=candidates[0],key=token(selected.p,line);if(!stocks.some(s=>s.key===key))stocks.push({p:selected.p,line,key});allocations.push({...a,stock:key});
 }resolved.push({...row,allocations});}return {rows:resolved,stocks};
}
function allocateQuote(db,lines,quote,rows,stockRows){
 const M=root.KombuModel,next=clone(lines),used=new Set(next.flatMap(l=>(l.quoteRefs||[]).map(r=>r.allocationId)));let count=0;
 for(const r of rows){if(r.skip)continue;for(const [j,a]of r.allocations.entries()){
  const stock=stockRows.find(s=>s.key===a.stock),q=number(a.qty);if(!stock||!Number.isFinite(q)||q<=0)throw Error('商品 '+(r.index+1)+' の在庫と出荷数を指定するか、「今回は取り込まない」を選んでください。');
  const allocationId=quote.quoteId+':'+r.index+':'+j;if(used.has(allocationId))throw Error('この見積明細はすでに取込み済みです。数量変更は帳票セルで行ってください。');
  if(!stock.p.startsWith('rausu_')&&!regularCells(stock.p,stock.line.year).some(c=>M.key(stock.p,c.line)===M.key(stock.p,stock.line)))throw Error(label(stock.p,stock.line)+' は標準帳票の分類と一致しません。在庫の分類を確認してください。');
  const kg=isKg(stock.p,stock.line),pack=kg?quotePackWeight(r.item):1,old=next.find(l=>token(l.product,l)===stock.key),totalWeight=Number(old?.qty||0)+q*pack,available=M.stock(db,stock.p).find(r=>M.key(stock.p,r)===M.key(stock.p,stock.line))?.qty||0;
  if(kg&&old&&(!(old.kgPerCount>0)||Number(old.kgPerCount)!==pack))throw Error('同じ在庫に1本重量の異なる明細があります。1本あたり重量を揃えてください。');
  if(totalWeight>available)throw Error(label(stock.p,stock.line)+' の出荷可能在庫を超えています。');
  setShipmentCount(next,stock.p,stock.line,(old?countOf(old):0)+q,pack);next.find(l=>token(l.product,l)===stock.key).quoteRefs=[...(old?.quoteRefs||[]),{quoteId:quote.quoteId,itemIndex:r.index,itemName:r.item.name,allocationId,qty:q,unit:'本'}];used.add(allocationId);count++;
 }}if(!count)throw Error('取り込む明細を選択してください。');return {lines:next,count};
}
function mount({host,lines,getDb,getShipment,onChange,product,year}){
 const M=root.KombuModel;let selectedProduct=product||'kushiro',selectedYear=year||'R8',selectedUnit='',serial=0,quotes=[],quoteRows=[],quote=null;
 const sheets=new Map(),packWeights=new Map();
 function factorFor(p,y,u){return packWeights.get(JSON.stringify([p,y,u]))||lines.find(l=>l.product===p&&l.year===y&&unitOf(l)===u&&l.kgPerCount>0)?.kgPerCount||'';}
 function addSheet(p,y,u=''){sheets.set(JSON.stringify([p,y,u]),{p,y,u});}
 for(const l of lines)addSheet(l.product,l.year,l.product.startsWith('rausu_')?unitOf(l):'');
 if(!sheets.size)addSheet(selectedProduct,selectedYear);
 host.innerHTML=`<style>
 .shipment-paper-scroll{overflow:auto;max-height:80vh;background:#e5eae6;padding:10px;margin:10px 0}.shipment-paper{position:relative;margin:auto;background:white;box-shadow:0 1px 5px #0003}.shipment-paper canvas{display:block;width:100%;height:100%}
 #actionBody .shipment-paper input.shipment-cell{position:absolute;display:block!important;min-width:0!important;max-width:none!important;min-height:0!important;margin:0!important;border:0;border-radius:0;padding:0 1px!important;text-align:center;background:#e9f8efb3;color:#12412a;box-sizing:border-box;font-family:inherit;appearance:textfield;-moz-appearance:textfield} .shipment-cell::-webkit-inner-spin-button,.shipment-cell::-webkit-outer-spin-button{appearance:none;margin:0}.shipment-cell:focus{outline:2px solid #307c51;background:#fff8d2!important;z-index:2}.shipment-cell[aria-invalid=true]{background:#ffe2deb3!important;color:#9b1717!important}.shipment-cell-status{min-height:24px;font-weight:600}.shipment-import{border:1px solid #bbcbbd;padding:12px;background:#f5faf5}.shipment-import input,.shipment-import select{max-width:100%;width:100%}.shipment-import .allocation{border-top:1px solid #cad8cf;padding:10px 0}.shipment-import input[type=checkbox]{width:auto!important;display:inline!important}.shipment-quote-summary{white-space:pre-wrap}.shipment-controls label{margin:4px 0}.shipment-import-error{color:#952020}
 </style><div class="shipment-import"><h4>見積から読み込む</h4><div class="toolbar"><button type="button" data-quotes="cloud">同期済みの見積を選ぶ</button><button type="button" data-quotes="pc">このPCの最新見積を選ぶ</button><label>見積JSONを読み込む<input type="file" data-quote-file accept=".json,application/json"></label></div><p>商品名から分類と本数を自動入力します。年産は下の選択欄で指定し、「一括転記」で数量セルへ反映します。商品名の年は年産の確定には使いません。取込みだけでは在庫は変わりません。</p><p data-quote-error role="status"></p><div data-quote-list></div><div data-quote-items></div></div><div class="toolbar shipment-controls"><label>昆布<select data-paper-product>${Object.entries(M.PRODUCTS).map(([p,n])=>`<option value="${p}">${esc(n)}</option>`).join('')}</select></label><label>年産<select data-paper-year></select></label><label data-unit-label hidden>数量単位<select data-paper-unit></select></label><button type="button" data-add-paper>帳票を追加・表示</button><button type="button" data-import>一括転記</button></div><p>緑色の数量セルへ出荷数を直接入力してください。空欄・0は出荷対象から外れます。Tabキーで次のセルへ移動できます。</p><p class="shipment-cell-status" role="status"></p><div data-paper-pages></div>`;
 const el=s=>host.querySelector(s),error=message=>{el('[data-quote-error]').textContent=message;};
 function applyQuoteDestination(){
  const dest=quoteDestination(getDb(),quote.customer);
  for(const [field,value] of Object.entries({Name:dest.name,Postal:dest.postal,Address:dest.address,Phone:dest.phone})){const input=document.getElementById('v114Dest'+field);if(input)input.value=value;}
  const region=document.getElementById('v229DestRegion');if(region){const value=dest.company?.toyamaRegion||dest.company?.toyama_region||dest.company?.region||'すべて';region.value=[...region.options].some(o=>o.value===value)?value:'すべて';region.dispatchEvent(new Event('change',{bubbles:true}));}
  for(const id of ['v161DestSelect','v229DestFavorite']){const select=document.getElementById(id);if(select)select.value=[...select.options].some(o=>o.value===dest.name)?dest.name:'';}
  onChange();drawCanvases();error(dest.company?'見積の得意先と、会社マスターの住所・電話番号を出荷先へ読み込みました。':'見積の得意先を出荷先へ読み込みました。住所・電話番号は会社マスターとの一致を確認できないため、必要に応じて入力してください。');
 }
 function available(p,l){return M.stock(getDb(),p).find(r=>M.key(p,r)===M.key(p,l))?.qty||0;}
 function changed(){onChange();drawCanvases();}
 function controls(){
  el('[data-paper-product]').value=selectedProduct;
  const ys=[...new Set([selectedYear,...Array.from({length:8},(_,i)=>'R'+(i+3)),...M.stock(getDb(),selectedProduct).map(r=>r.year)])].filter(Boolean).sort((a,b)=>a.localeCompare(b,'ja',{numeric:true}));
  el('[data-paper-year]').innerHTML='<option value="">年産を選択</option>'+ys.map(y=>`<option ${y===selectedYear?'selected':''}>${esc(y)}</option>`).join('');
  const units=[...new Set([...M.stock(getDb(),selectedProduct),...lines.filter(l=>l.product===selectedProduct)].filter(l=>!selectedYear||l.year===selectedYear).map(unitOf).filter(Boolean))];
  if(!units.includes(selectedUnit))selectedUnit=units.length===1?units[0]:'';
  el('[data-unit-label]').hidden=!selectedProduct.startsWith('rausu_');el('[data-paper-unit]').innerHTML='<option value="">単位を選択</option>'+units.map(u=>`<option ${u===selectedUnit?'selected':''}>${esc(u)}</option>`).join('');
 }
 el('[data-paper-product]').onchange=e=>{selectedProduct=e.target.value;controls();};
 el('[data-paper-year]').onchange=e=>{selectedYear=e.target.value;controls();};
 el('[data-paper-unit]').onchange=e=>selectedUnit=e.target.value;
 el('[data-add-paper]').onclick=()=>{if(!selectedYear){error('年産を選択してください。');return;}if(selectedProduct.startsWith('rausu_')&&!selectedUnit){error('この年産の羅臼在庫に数量単位がありません。入庫データを先に確認してください。');return;}addSheet(selectedProduct,selectedYear,selectedProduct.startsWith('rausu_')?selectedUnit:'');drawPapers();};
 let active=[];
 function context(p,y,u){const base=getShipment(),actual=lines.filter(l=>l.product===p&&l.year===y&&(!p.startsWith('rausu_')||unitOf(l)===u));
  const seeds=p.startsWith('rausu_')?M.stock(getDb(),p).filter(r=>r.year===y&&unitOf(r)===u).map(r=>({...r,qty:0})):[];
  const paperLines=[...seeds,...actual.map(l=>({...l,unit:unitOf(l)})),...(actual.length||seeds.length?[]:[{year:y,qty:0}])];
  return {...base,lines:paperLines.map(l=>p.startsWith('rausu_')?{...l,qty:isKg(p,l)&&l.shipmentCount===undefined&&factorFor(p,y,u)?Number(l.qty||0)/Number(factorFor(p,y,u)):countOf(l),unit:'本'}:l)};
 }
 function drawCanvases(){for(const {p,y,u,holders}of active){const canvases=root.KombuOriginalPdf.canvases(p,context(p,y,u));holders.forEach((h,i)=>{if(!canvases[i])return;const old=h.querySelector('canvas');canvases[i].setAttribute('aria-label',M.PRODUCTS[p]+' '+y+'年産 出荷依頼書');old.replaceWith(canvases[i]);});}}
 function drawPapers(){active=[];const area=el('[data-paper-pages]');area.replaceChildren();const visible=new Set();
  for(const {p,y,u}of sheets.values()){
   const kg=isKg(p,{unit:u}),factor=number(factorFor(p,y,u));
   const group=document.createElement('section');group.innerHTML=`<h4>${esc(M.PRODUCTS[p])} · ${esc(y)}年産 ／ 数量：本</h4>${kg?'<label>1本あたり重量（kg）<input data-pack-weight type="number" min="0.000001" step="any" value="'+esc(factorFor(p,y,u))+'"></label><p>帳票には本数を表示し、在庫は本数×1本重量のkgで引き落とします。</p>':''}`;area.append(group);
   if(kg)group.querySelector('[data-pack-weight]').onchange=e=>{const pack=number(e.target.value);if(!(pack>0)){e.target.setCustomValidity('1本あたり重量を入力してください。');error('1本あたり重量を入力してください。');return;}e.target.setCustomValidity('');packWeights.set(JSON.stringify([p,y,u]),pack);for(const l of lines.filter(l=>l.product===p&&l.year===y&&unitOf(l)===u)){const count=l.shipmentCount===undefined?Number(l.qty)/pack:countOf(l);Object.assign(l,{shipmentCount:count,kgPerCount:pack,qty:count*pack});}onChange();drawPapers();};
   const info=pages(p,y,u,getDb(),lines),canvases=root.KombuOriginalPdf.canvases(p,context(p,y,u)),holders=[];
   info.forEach((page,index)=>{const canvas=canvases[index];if(!canvas)return;const scroll=document.createElement('div');scroll.className='shipment-paper-scroll';const paper=document.createElement('div');paper.className='shipment-paper';paper.style.width=canvas.width+'px';paper.style.height=canvas.height+'px';paper.append(canvas);scroll.append(paper);group.append(scroll);holders.push(paper);
    page.cells.forEach(cell=>{const input=document.createElement('input'),k=token(p,cell.line),existing=lines.filter(l=>token(l.product,l)===k).reduce((a,l)=>a+(kg&&l.shipmentCount===undefined?(factor>0?Number(l.qty)/factor:0):countOf(l)),0),stockQty=available(p,cell.line),av=kg?(factor>0?stockQty/factor:0):stockQty;visible.add(k);
     input.type='number';input.min='0';input.step='any';input.inputMode='decimal';input.className='shipment-cell';input.value=existing||'';
     input.style.cssText=`left:${cell.x/canvas.width*100}%;top:${cell.y/canvas.height*100}%;width:${cell.w/canvas.width*100}%;height:${cell.h/canvas.height*100}%;font-size:${Math.min(24,cell.h*.62)}px`;
     const caption=label(p,cell.line)+' ／ 出荷可能本数 '+fmt(av)+' 本'+(kg?'（在庫 '+fmt(stockQty)+' kg ／ 1本 '+(factor>0?fmt(factor):'未設定')+' kg）':'');input.title=caption;input.setAttribute('aria-label',caption);input.setAttribute('aria-invalid',String(existing>av));
     input.onfocus=()=>el('.shipment-cell-status').textContent=caption;
     input.oninput=()=>{const q=input.value===''?0:number(input.value);input.setAttribute('aria-invalid',String(input.validity.badInput||!Number.isFinite(q)||q<0||q>av));try{if(input.validity.badInput)throw Error('本数を確認してください。');setShipmentCount(lines,p,cell.line,q,factor);el('.shipment-cell-status').textContent=caption+(q>av?'　⚠ 在庫不足':'');changed();}catch(e){input.setAttribute('aria-invalid','true');el('.shipment-cell-status').textContent=e.message;}};
     paper.append(input);
    });
   });active.push({p,y,u,holders});
  }
  const missing=lines.filter(l=>Number(l.qty)>0&&(!visible.has(token(l.product,l))||(isKg(l.product,l)&&!(l.kgPerCount>0))));
  if(missing.length){const warning=document.createElement('div');warning.dataset.unmappedShipment='true';warning.innerHTML='<p class="shipment-import-error" role="alert">帳票の分類、またはkg在庫の1本あたり重量を確認してください。未設定のままでは保存できません。</p>'+missing.map(l=>'<p>'+esc(label(l.product,l))+' ／ '+esc(l.qty)+'</p>').join('');area.append(warning);}
 }
 // Parent header fields update the same canvas, so displayed paper and saved PDF agree.
 const body=host.closest('#actionBody');const headerChanged=e=>{if(host.contains(e.target))return;if(/^v(?:114|161|229)/.test(e.target.id)){onChange();drawCanvases();}};
 body?.addEventListener('input',headerChanged);body?.addEventListener('change',headerChanged);
 const dlg=host.closest('dialog');dlg?.addEventListener('close',()=>{serial++;body?.removeEventListener('input',headerChanged);body?.removeEventListener('change',headerChanged);},{once:true});
 function setQuotes(data){quotes=(Array.isArray(data)?data:[data]).filter(q=>q&&Array.isArray(q.items)&&q.status!=='削除済').map(q=>({quoteId:q.quoteId||q.quote_id,customer:q.customer||'',quoteDate:q.quoteDate||q.quote_date||'',items:q.items,status:q.status,updatedAt:q.updatedAt||q.updated_at}));
  el('[data-quote-list]').innerHTML=`<label>見積を検索<input data-quote-search placeholder="見積番号・得意先"></label><label>見積<select data-quote-select></select></label>`;
  const select=el('[data-quote-select]');function filter(){const q=norm(el('[data-quote-search]').value);select.innerHTML='<option value="">選択してください</option>'+quotes.map((r,i)=>({r,i})).filter(({r})=>norm([r.quoteId,r.customer,r.quoteDate].join(' ')).includes(q)).sort((a,b)=>b.r.quoteDate.localeCompare(a.r.quoteDate)).map(({r,i})=>`<option value="${i}">${esc(r.quoteDate+' '+r.quoteId+' '+r.customer)}</option>`).join('');}
  el('[data-quote-search]').oninput=filter;select.onchange=()=>{if(select.value==='')return;quote=quotes[Number(select.value)];const choices=classificationChoices(getDb());quoteRows=quote.items.map((item,i)=>{const recognized=recognizeQuoteItem(item,choices),q=quantity(item);return {item,index:i,recognized,allocations:[{stock:recognized.key,qty:Number.isFinite(q)&&q>0?q:''}],skip:/^(※|計$|小計$|合計$|消費税)/.test(norm(item.name))||!String(item.name||'').trim()};});selectedProduct=quoteRows.find(r=>!r.skip&&r.recognized.product)?.recognized.product||selectedProduct;selectedYear='';selectedUnit='';controls();if(!lines.length)sheets.clear();applyQuoteDestination();drawQuote();drawPapers();};filter();error(quotes.length+'件の見積を読み込みました。');
 }
 async function loadQuotes(mode){const generation=++serial;error('見積を読み込んでいます…');try{
  const A=root.KombuCloud;let data;
  if(mode==='pc'){const r=await fetch('http://localhost:18765/api/quotes',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('PCの見積を読み込めません。');data=await r.json();}
  else{if(!A.session?.user?.id)throw Error('先に昆布帳へログインしてください。');const params=new URLSearchParams({select:'quote_id,quote_date,customer,status,items,updated_at',owner_id:'eq.'+A.session.user.id,order:'quote_date.desc,quote_id.desc',limit:'1000'});const r=await fetch('https://crltrozxztivkyxtjjxv.supabase.co/rest/v1/bp_quotes?'+params,{headers:{apikey:A.key,Authorization:'Bearer '+A.session.access_token},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('同期済み見積を取得できません（'+r.status+'）。PCの見積またはJSONから読み込んでください。');data=await r.json();}
  if(host.isConnected&&generation===serial)setQuotes(data);
 }catch(e){if(host.isConnected)error((mode==='pc'?'PC見積への接続を確認できません。見積管理アプリを起動し、ブラウザのローカル接続設定を確認するか、同期済み見積を選んでください。 ':'')+e.message);}}
 host.querySelectorAll('[data-quotes]').forEach(b=>b.onclick=()=>loadQuotes(b.dataset.quotes));
 el('[data-quote-file]').onchange=async e=>{try{const text=await e.target.files[0].text();const data=JSON.parse(text.replace(/^\uFEFF/,''));setQuotes(data.quotes||data);}catch(err){error('見積JSONを読み込めません：'+err.message);}};
 function stockOptions(){return classificationChoices(getDb());}
 let stockRows=[];
 function drawQuote(){stockRows=stockOptions();const holder=el('[data-quote-items]');holder.innerHTML=`<h4>${esc(quote.quoteId+' '+quote.customer)}</h4><p>分類と本数を自動入力しました。年産を下の選択欄で選び、「一括転記」を押してください。判別できない分類だけ確認してください。</p>`+quoteRows.map((r,i)=>`<div class="allocation"><b>${i+1}. ${esc(r.item.name)}</b><p>入数 ${esc(r.item.unit)} ／ 本数 ${esc(r.item.count)} ／ 重量・見積数量 ${esc(r.item.quantity)}</p><label><input type="checkbox" data-skip="${i}" ${r.skip?'checked':''}>今回は取り込まない</label>${r.allocations.map((a,j)=>`<div><label>見積から読み取った分類<select data-stock="${i}:${j}"><option value="">要確認：分類を選択してください</option>${stockRows.map((s,n)=>`<option value="${n}" ${s.key===a.stock?'selected':''}>${esc(label(s.p,s.line))}</option>`).join('')}</select></label><label>出荷本数（見積から自動入力）<input data-allocation="${i}:${j}" type="number" min="0" step="any" value="${esc(a.qty)}"></label></div>`).join('')}<button type="button" data-split="${i}">割当を追加</button></div>`).join('')+'<p data-allocation-error role="status" class="shipment-import-error"></p>';
  holder.querySelectorAll('[data-skip]').forEach(e=>e.onchange=()=>quoteRows[+e.dataset.skip].skip=e.checked);
  holder.querySelectorAll('[data-stock]').forEach(e=>e.onchange=()=>{const [i,j]=e.dataset.stock.split(':').map(Number),a=quoteRows[i].allocations[j],s=stockRows[+e.value];a.stock=e.value!==''?s.key:'';if(e.value!==''&&a.qty===''){const q=quantity(quoteRows[i].item,s.p,unitOf(s.line));a.qty=Number.isFinite(q)&&q>0?q:'';}drawQuote();});
  holder.querySelectorAll('[data-allocation]').forEach(e=>e.oninput=()=>{const [i,j]=e.dataset.allocation.split(':').map(Number);quoteRows[i].allocations[j].qty=e.value;});
  holder.querySelectorAll('[data-split]').forEach(e=>e.onclick=()=>{quoteRows[+e.dataset.split].allocations.push({stock:'',qty:''});drawQuote();});
  el('[data-import]').onclick=()=>{try{
   const resolved=resolveQuoteRows(getDb(),quoteRows,stockRows,selectedYear,selectedProduct,selectedUnit),imported=allocateQuote(getDb(),lines,quote,resolved.rows,resolved.stocks),count=imported.count;
   lines.splice(0,lines.length,...imported.lines);for(const l of lines)addSheet(l.product,l.year,l.product.startsWith('rausu_')?unitOf(l):'');
   error(quote.quoteId+'：'+count+'件を帳票へ追加しました。出荷先と出荷元を確認してください。');onChange();drawPapers();
  }catch(e){el('[data-allocation-error]').textContent=e.message;error(e.message);}};
 }
 el('[data-import]').onclick=()=>error('先に見積を選択してください。');controls();if(selectedProduct.startsWith('rausu_')&&!lines.length){sheets.clear();if(selectedUnit)addSheet(selectedProduct,selectedYear,selectedUnit);}drawPapers();
 return {refresh:drawCanvases};
}
const originalCanvases=root.KombuOriginalPdf.canvases;
root.KombuOriginalPdf.canvases=(p,s)=>originalCanvases(p,p.startsWith('rausu_')?{...s,lines:(s.lines||[]).map(l=>l.shipmentCount!==undefined?{...l,qty:countOf(l),unit:'本'}:l)}:s);
root.KombuShipmentCells={mount,regularCells,rausuPages,pages,setQuantity,setShipmentCount,quantity,countOf,quotePackWeight,number,label,allocateQuote,quoteDestination,classificationChoices,classificationKey,recognizeQuoteItem,resolveQuoteRows};
})(typeof window!=='undefined'?window:globalThis);
