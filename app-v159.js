"use strict";
const PDFJS=globalThis.__KOMBU_PDFJS__||globalThis.pdfjsLib||null;
/* PDF「R6年度 釧路産昆布 在庫証明書」の見出しを細分類化。対象外2群を除き、大分類6群で管理します。 */
const GROUPS=[
 
 {name:"特長",items:["葉①","元①","葉②","元②","葉③","元③","④","花③","花④","水③"]},
 {name:"特厚",items:["①","②","③","④","花③","花④"]},
 {name:"加工用",items:["①","②","③","尺①"]},
 {name:"長頭2段目10k",items:["①","②"]},
 {name:"厚頭2段目10k",items:["①","②"]},
 {name:"長頭束",items:["①"]}
];
const SEASONS=["夏","秋","拾"];
const YEARS=["R3","R4","R5","R6","R7","R8","R9","R10"];
const DEFAULT_YEAR="R7";
const PDF_COOPS=["東部漁協","昆布森漁協","厚岸漁協","散布漁協","浜中漁協"];
const PDF_PAGE_WIDTH=841.8898;
const PDF_COL_X0=126.6;
const PDF_COL_STEP=22.07;
const KEY="kombu_local_only_v3";
let state=JSON.parse(localStorage.getItem(KEY)||"null");
const old=JSON.parse(localStorage.getItem("kombu_local_only_v2")||"null");
const oldCoops=["東部漁協","昆布森漁協","厚岸漁協","散布漁協","浜中漁協"];
if(!state) state={records:[],coops:old?.coops?.length?old.coops:oldCoops};
state.coops=Array.isArray(state.coops)&&state.coops.length?state.coops:oldCoops;
if(state.coops.length===5&&oldCoops.every(c=>state.coops.includes(c))) state.coops=[...oldCoops];
state.records=Array.isArray(state.records)?state.records:[];
state.activeYear=YEARS.includes(state.activeYear)?state.activeYear:DEFAULT_YEAR;
state.records=state.records.map(r=>({...r,year:YEARS.includes(r.year)?r.year:DEFAULT_YEAR}));
state.pdfImports=Array.isArray(state.pdfImports)?state.pdfImports:[];
state.companies=Array.isArray(state.companies)?state.companies:[];
if(!state.companies.some(c=>c&&c.name==='㈱浜中運輸'))state.companies.unshift({name:'㈱浜中運輸',address:'',phone:''});
state.companies=state.companies.filter(c=>c&&String(c.name||'').trim()).map(c=>({...c,name:String(c.name||'').trim(),postal:String(c.postal||c.postal_code||''),address:String(c.address||''),phone:String(c.phone||c.tel||''),region:String(c.region||''),toyamaRegion:String(c.toyamaRegion||c.toyama_region||'')}));
const DELETED_GROUPS=new Set(["コケ","特長・特特"]);
state.records=state.records.filter(r=>!DELETED_GROUPS.has(r.group));
save();
function allItems(){return GROUPS.flatMap(g=>g.items.map(item=>({group:g.name,item})));}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function fmt(n){return Number(n||0).toLocaleString('ja-JP')}
function fmtBlankZero(n){const v=Number(n||0);return v===0?'':fmt(v)}
function today(){return new Date().toLocaleDateString('sv-SE')}
function key(r){return [r.year||DEFAULT_YEAR,r.coop,r.group,r.item,r.season||"夏"].join("|")}
function confirmedShipmentLines(){return Array.isArray(state.shipments)?state.shipments.filter(s=>s.status==='confirmed').flatMap(s=>Array.isArray(s.lines)?s.lines:[]):[]}
function matrix(){const m={};state.records.forEach(r=>{const k=key(r);m[k]=(m[k]||0)+(r.type==='out'?-Number(r.qty):Number(r.qty))});confirmedShipmentLines().forEach(l=>{const k=key(l);m[k]=(m[k]||0)-Number(l.qty||0)});return m}
function reservedTotal(year=state.activeYear){return confirmedShipmentLines().filter(l=>(l.year||DEFAULT_YEAR)===year).reduce((s,l)=>s+Number(l.qty||0),0)}
function total(year=state.activeYear){const physical=state.records.filter(r=>(r.year||DEFAULT_YEAR)===year).reduce((s,r)=>s+(r.type==='out'?-Number(r.qty):Number(r.qty)),0);return physical-reservedTotal(year)}
function yearOptions(selected){return YEARS.map(y=>`<option value="${y}" ${y===(selected||state.activeYear)?'selected':''}>${y}年産</option>`).join('')}
function setActiveYear(y){if(YEARS.includes(y)){state.activeYear=y;save();}}
function home(){app.innerHTML=`<section class="card"><div class="row"><h2>在庫状況</h2><select id="homeYear" style="width:auto;padding:8px;border:1px solid #ccd6e2;border-radius:9px;background:#fff;font-size:15px">${yearOptions(state.activeYear)}</select></div><div class="stats"><div class="stat">${esc(state.activeYear)}年産 総在庫<b>${fmt(total(state.activeYear))}</b></div><div class="stat">漁協数<b>${state.coops.length}</b></div><div class="stat">細分類数<b>${allItems().length}</b></div><div class="stat">登録履歴<b>${state.records.filter(r=>(r.year||DEFAULT_YEAR)===state.activeYear).length}件</b></div></div></section><section class="grid"><button class="action" id="shipHome" style="border-left:6px solid #e05a47">📦 出荷指示<small>生産年度指定・PDF・FAX</small></button><button class="action orange" id="c">▦ 在庫表<small>生産年度別に表示</small></button><button class="action purple" id="d">≡ 入出庫履歴<small>年度を含めて修正・削除</small></button><button class="action green" id="a">↓ 入庫登録<small>生産年度・季節・分類・数量</small></button><button class="action gray" id="moreHome">⋯ その他<small>その他の機能</small></button><button class="action blue" id="b">↑ 出庫登録<small>生産年度別の在庫から減算</small></button><button class="action gray" id="e">⇩ データ出力<small>Excel・CSV・バックアップ</small></button><button class="action gray" id="f">⚙ マスター設定<small>漁協・細分類を確認</small></button></section><section class="card"><h2>生産年度</h2><div class="note">在庫は R3年産〜R10年産を別々に管理します。入庫・出庫・PDF取込・出荷指示のすべてに生産年度が付きます。</div></section>`;homeYear.onchange=()=>{setActiveYear(homeYear.value);home()};a.onclick=()=>form('in');b.onclick=()=>form('out');c.onclick=stock;d.onclick=logs;e.onclick=exportsPage;f.onclick=masters;shipHome.onclick=shipment;moreHome.onclick=exportsPage}
function itemOptions(selectedGroup,selectedItem){return GROUPS.map(g=>`<optgroup label="${esc(g.name)}">${g.items.map(i=>`<option value="${esc(g.name)}|${esc(i)}" ${(g.name===selectedGroup&&i===selectedItem)?'selected':''}>${esc(i)}</option>`).join('')}</optgroup>`).join('')}
function companyByName(name){return state.companies.find(c=>c.name===String(name||'').trim())||null}
function companyDatalist(){return state.companies.map(c=>`<option value="${esc(c.name)}"></option>`).join('')}
function upsertCompany(info){const name=String(info?.name||'').trim();if(!name)return;const hit=companyByName(name);if(hit){hit.address=String(info.address||'');hit.phone=String(info.phone||'')}else state.companies.push({name,address:String(info.address||''),phone:String(info.phone||'')})}
function shipmentSource(s){return s?.source&&s.source.name?{name:s.source.name,address:s.source.address||'',phone:s.source.phone||''}:{name:'㈱浜中運輸',address:'',phone:''}}
function shipmentDest(s){return s?.destInfo&&s.destInfo.name?{name:s.destInfo.name,address:s.destInfo.address||'',phone:s.destInfo.phone||''}:{name:s?.dest||'',address:'',phone:''}}
function form(type,editId=null){
 const r=editId?state.records.find(x=>x.id===editId):null;
 const fixedType=r?.type||type||'in';
 const g=r?.group||GROUPS[0].name,i=r?.item||GROUPS[0].items[0],yr=r?.year||state.activeYear;
 const pdfButton=(!r&&fixedType==='in')?`<button class="btn secondary" id="pdfImportBtn" type="button">📄 PDFから入庫</button><input id="pdfImportFile" type="file" accept="application/pdf,.pdf" hidden><div class="note">50〜60ページ程度のPDFから「釧路産昆布」だけを抽出し、生産年度・漁協・区分・細分類ごとに合算します。同じPDFの二重登録は自動で防止します。</div>`:'';
 app.innerHTML=`<section class="card"><h2>${r?'入出庫修正':fixedType==='in'?'入庫登録':'出庫登録'}</h2><div class="form">${pdfButton}<label>区分<div class="note" style="margin-top:4px">${fixedType==='in'?'入庫':'出庫'}</div></label><label>生産年度<select id="y">${yearOptions(yr)}</select></label><label>漁協<select id="c">${state.coops.map(x=>`<option ${x===r?.coop?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>季節区分<select id="s">${SEASONS.map(x=>`<option ${x===(r?.season||'夏')?'selected':''}>${x}</option>`).join('')}</select></label><label>大分類＋細分類<select id="gi">${itemOptions(g,i)}</select></label><label>数量<input id="q" type="number" min="0" step="0.01" inputmode="decimal" value="${r?esc(r.qty):''}"></label><label>日付<input id="d" type="date" value="${r?.date||today()}"></label><label>備考<input id="memo" type="text" maxlength="100" value="${esc(r?.memo||'')}"></label><button class="btn" id="saveBtn">${r?'修正を保存':'登録する'}</button><button class="btn secondary" id="back">戻る</button></div></section>`;
 back.onclick=()=>r?logs():home;
 if(!r&&fixedType==='in'){pdfImportBtn.onclick=()=>pdfImportFile.click();pdfImportFile.onchange=()=>{const f=pdfImportFile.files?.[0];if(f)importInventoryPdf(f)}}
 saveBtn.onclick=()=>{
   const n=Number(q.value);if(!n||n<0)return alert('数量を入力してください');
   const [group,item]=gi.value.split('|'),year=y.value;
   if(r){const idx=state.records.findIndex(x=>x.id===r.id);state.records[idx]={...r,type:fixedType,year,coop:c.value,season:s.value,group,item,qty:n,date:d.value,memo:memo.value}}
   else{if(fixedType==='out'){const avail=stockAvailableForShipment(year,c.value,s.value,group,item);if(n>avail)return alert(`${year}年産 ${c.value} ${s.value} ${group} ${item} の出荷可能在庫は ${fmt(avail)} です。`)}state.records.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),type:fixedType,year,coop:c.value,season:s.value,group,item,qty:n,date:d.value,memo:memo.value})}
   setActiveYear(year);save();alert(r?'修正しました':fixedType==='in'?'入庫しました':'出庫しました');r?logs():stock();
 };
}

async function sha256File(file){
 const buf=await file.arrayBuffer();
 const hash=await crypto.subtle.digest('SHA-256',buf);
 return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function reiwaDateFromText(text){
 const m=String(text||'').replace(/\s/g,'').match(/令和(\d+)年(\d+)月(\d+)日/);
 if(!m)return today();
 const y=2018+Number(m[1]),mo=String(m[2]).padStart(2,'0'),d=String(m[3]).padStart(2,'0');
 return `${y}-${mo}-${d}`;
}
function productionYearFromText(text){
 const normalized=String(text||'').replace(/[Ｒｒ]/g,'R').replace(/\s/g,'');
 const m=normalized.match(/R(10|[3-9])年度?/i);
 return m&&YEARS.includes(`R${m[1]}`)?`R${m[1]}`:state.activeYear;
}
function pdfDuplicate(hash){return state.pdfImports.find(x=>x.hash===hash)}
function nearestPdfCol(x,pageWidth){
 const scale=pageWidth/PDF_PAGE_WIDTH;
 const idx=Math.round((x/scale-PDF_COL_X0)/PDF_COL_STEP);
 if(idx<0||idx>=allItems().length)return -1;
 const center=(PDF_COL_X0+PDF_COL_STEP*idx)*scale;
 return Math.abs(x-center)<=10*scale?idx:-1;
}
async function parseInventoryPdf(file){
  if(!PDFJS)throw new Error('PDF読取ライブラリを読み込めませんでした。アプリを再読み込みしてください。');
  PDFJS.GlobalWorkerOptions.workerSrc='./pdf-worker-v58.js';
  const data=new Uint8Array(await file.arrayBuffer());
  const pdf=await PDFJS.getDocument({data}).promise;
  if(pdf.numPages<1)throw new Error('PDFにページがありません。');
  const allRows=[],matchedPages=[],skippedPages=[];
  let statementDate=today();
  for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
    const page=await pdf.getPage(pageNo),viewport=page.getViewport({scale:1}),tc=await page.getTextContent();
    const items=tc.items.filter(x=>String(x.str||'').trim()).map(x=>({str:String(x.str).trim(),x:Number(x.transform[4]||0),y:Number(x.transform[5]||0),w:Number(x.width||0)}));
    const fullText=items.map(x=>x.str).join('');
    const normalized=fullText.replace(/\s/g,'').replace(/[Ｒｒ]/g,'R');
    if(pageNo===1||statementDate===today())statementDate=reiwaDateFromText(fullText);
    // 「釧路産昆布」だけを対象にし、「釧路産棹前昆布」は別品種として除外する。
    if(!normalized.includes('釧路産昆布')||normalized.includes('釧路産棹前昆布'))continue;
    const year=productionYearFromText(fullText);
    const seasonItems=items.filter(x=>SEASONS.includes(x.str)&&x.x<viewport.width*0.18).sort((a,b)=>b.y-a.y);
    const rowTriples=[];
    for(let i=0;i<=seasonItems.length-3;i++){
      const a=seasonItems[i],b=seasonItems[i+1],c=seasonItems[i+2];
      if(a.str==='夏'&&b.str==='秋'&&c.str==='拾'&&a.y>b.y&&b.y>c.y){rowTriples.push([a,b,c]);i+=2;if(rowTriples.length===5)break;}
    }
    if(rowTriples.length!==5){skippedPages.push(pageNo);continue;}
    const cols=allItems(),pageRows=[];
    rowTriples.forEach((triple,coopIndex)=>triple.forEach(row=>{
      const cells=Array.from({length:cols.length},()=>[]);
      items.forEach(it=>{
        if(Math.abs(it.y-row.y)>3.2)return;
        const cx=it.x+(it.w||0)/2,ci=nearestPdfCol(cx,viewport.width);
        if(ci<0||!/^[\d,.-]+$/.test(it.str))return;
        cells[ci].push(it);
      });
      cells.forEach((parts,ci)=>{
        if(!parts.length)return;
        const raw=parts.sort((a,b)=>a.x-b.x).map(x=>x.str).join('').replace(/,/g,'');
        if(raw==='-'||raw==='.'||raw==='')return;
        const qty=Number(raw.replace(/[^0-9.]/g,''));
        if(!Number.isFinite(qty)||qty<=0)return;
        pageRows.push({year,coop:PDF_COOPS[coopIndex],season:row.str,group:cols[ci].group,item:cols[ci].item,qty,page:pageNo});
      });
    }));
    if(pageRows.length){allRows.push(...pageRows);matchedPages.push(pageNo);}else skippedPages.push(pageNo);
  }
  if(!allRows.length)throw new Error('PDF内から「釧路産昆布」の数量を読み取れませんでした。');
  // 同じ生産年度・漁協・季節・分類を、取引先/ページをまたいで合算する。
  const agg=new Map();
  for(const r of allRows){
    const k=[r.year,r.coop,r.season,r.group,r.item].join('|');
    const cur=agg.get(k)||{year:r.year,coop:r.coop,season:r.season,group:r.group,item:r.item,qty:0,pages:[]};
    cur.qty+=Number(r.qty);if(!cur.pages.includes(r.page))cur.pages.push(r.page);agg.set(k,cur);
  }
  const rows=[...agg.values()].sort((a,b)=>YEARS.indexOf(a.year)-YEARS.indexOf(b.year)||PDF_COOPS.indexOf(a.coop)-PDF_COOPS.indexOf(b.coop)||SEASONS.indexOf(a.season)-SEASONS.indexOf(b.season)||allItems().findIndex(x=>x.group===a.group&&x.item===a.item)-allItems().findIndex(x=>x.group===b.group&&x.item===b.item));
  return {rows,date:statementDate,pageCount:pdf.numPages,matchedPages,skippedPages,years:[...new Set(rows.map(r=>r.year))]};
}
async function importInventoryPdf(file){
 try{
   app.innerHTML=`<section class="card"><h2>📄 PDFから入庫</h2><p>「${esc(file.name)}」を読み込んでいます…</p><p class="muted">PDF内の表を解析しています。</p></section>`;
   const hash=await sha256File(file),dup=pdfDuplicate(hash);
   if(dup){
     alert(`このPDFはすでに入庫済みです。\n取込日：${new Date(dup.importedAt).toLocaleString('ja-JP')}\nファイル：${dup.fileName}`);
     return form('in');
   }
   const parsed=await parseInventoryPdf(file);
   showPdfImportConfirm(file,hash,parsed);
 }catch(e){alert(`PDFを読み込めませんでした。\n${e?.message||e}`);form('in');}
}
function showPdfImportConfirm(file,hash,parsed){
  const totalQty=parsed.rows.reduce((s,r)=>s+Number(r.qty||0),0);
  const preview=parsed.rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.year)}年産</td><td>${esc(r.coop)}</td><td>${esc(r.season)}</td><td>${esc(r.group)}</td><td>${esc(r.item)}</td><td>${fmt(r.qty)}</td></tr>`).join('');
  app.innerHTML=`<section class="card"><h2>📄 PDF一括入庫 内容確認</h2><div class="stats"><div class="stat">対象ページ<b>${parsed.matchedPages.length} / ${parsed.pageCount}</b></div><div class="stat">集計後明細<b>${parsed.rows.length}件</b></div><div class="stat">生産年度<b>${parsed.years.map(y=>esc(y)).join('・')}</b></div><div class="stat">合計数量<b>${fmt(totalQty)}</b></div></div><p><b>PDF：</b>${esc(file.name)}<br><b>在庫表日付：</b>${esc(parsed.date)}<br><b>対象ページ：</b>${esc(parsed.matchedPages.join(', '))}</p><div class="note">「釧路産昆布」のページだけを抽出し、取引先をまたいで、生産年度・漁協・夏秋拾・細分類ごとに合算しています。「釧路産棹前昆布」は除外しています。</div>${parsed.skippedPages.length?`<div class="warning" style="margin-top:8px">釧路産昆布と判定したものの表を認識できなかったページ：${esc(parsed.skippedPages.join(', '))}</div>`:''}<div class="warning" style="margin-top:8px">まだ在庫には反映されていません。内容を確認してから登録してください。</div><div class="tablewrap" style="margin-top:12px"><table style="min-width:850px"><tr><th>No.</th><th>生産年度</th><th>漁協</th><th>区分</th><th>大分類</th><th>細分類</th><th>数量</th></tr>${preview}</table></div><div class="toolbar" style="margin-top:12px"><button class="btn" id="pdfCommit">この集計内容で一括入庫</button><button class="btn secondary" id="pdfCancel">キャンセル</button></div></section>`;
  pdfCancel.onclick=()=>form('in');
  pdfCommit.onclick=()=>{
    const dup=pdfDuplicate(hash);if(dup)return alert('このPDFはすでに登録済みです。二重登録はできません。');
    const ids=[];
    parsed.rows.forEach(r=>{const id=crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random());ids.push(id);state.records.push({id,type:'in',year:r.year,coop:r.coop,season:r.season,group:r.group,item:r.item,qty:Number(r.qty),date:parsed.date,memo:`PDF一括入庫：${file.name}`})});
    state.pdfImports.push({hash,fileName:file.name,years:parsed.years,statementDate:parsed.date,importedAt:new Date().toISOString(),count:parsed.rows.length,total:totalQty,pageCount:parsed.pageCount,matchedPages:parsed.matchedPages,recordIds:ids});
    if(parsed.years.length)setActiveYear(parsed.years[parsed.years.length-1]);save();alert(`${parsed.years.join('・')}年産を集計し、${parsed.rows.length}件、合計 ${fmt(totalQty)} を一括入庫しました。`);stock();
  };
}

function available(year,coop,season,group,item){return state.records.filter(r=>(r.year||DEFAULT_YEAR)===year&&r.coop===coop&&r.season===season&&r.group===group&&r.item===item).reduce((s,r)=>s+(r.type==='out'?-Number(r.qty):Number(r.qty)),0)}
function stock(){
 const m=matrix(),year=state.activeYear;
 let html=`<section class="card"><div class="row"><h2>在庫集計表（PDF準拠）</h2><select id="stockYear" style="width:auto;padding:8px;border:1px solid #ccd6e2;border-radius:9px;background:#fff;font-size:15px">${yearOptions(year)}</select></div><div class="toolbar"><button class="btn smallbtn" id="ex">Excel出力</button><button class="btn smallbtn" id="cs">CSV出力</button><button class="btn smallbtn" id="ps">PDF出力</button><button class="btn secondary smallbtn" id="x">ホーム</button><button class="btn secondary smallbtn" id="r">更新</button></div><style>.stock-report{border-collapse:collapse}.stock-report th,.stock-report td{border:.45px solid #333;font-size:13px}.stock-report td{font-size:17.5px;font-weight:400}.stock-report th{font-weight:600}.stock-report tr.coop-end th,.stock-report tr.coop-end td{border-bottom:1.6px solid #111}.stock-report tr.stock-subtotal th,.stock-report tr.stock-subtotal td{font-size:13.5px;font-weight:400;background:#fff;border-left-color:transparent;border-right-color:transparent}.stock-report tr.stock-subtotal td:first-child{border-left-color:#333}.stock-report tr.stock-subtotal td:last-child{border-right-color:#333}.stock-report tfoot th,.stock-report tfoot td{border-top:1.6px solid #111}.stock-report tfoot td,.stock-report tfoot th{font-weight:400}</style><div class="tablewrap" style="margin-top:12px"><table class="stock-report"><tr><th rowspan="2">組合名</th><th rowspan="2">区分</th>`;
 GROUPS.forEach(g=>html+=`<th class="group" colspan="${g.items.length}">${esc(g.name)}</th>`);
 html+=`<th rowspan="2">計</th></tr><tr>`;
 GROUPS.forEach(g=>g.items.forEach(i=>html+=`<th class="sub">${esc(i)}</th>`));
 html+='</tr>';
 state.coops.forEach(coop=>{
   SEASONS.forEach((season,si)=>{
     html+=`<tr><td>${si===0?esc(coop):''}</td><td class="season">${season}</td>`;
     GROUPS.forEach(g=>g.items.forEach(i=>{
       const v=m[[year,coop,g.name,i,season].join('|')]||0;
       html+=`<td>${v?fmt(v):''}</td>`;
     }));
     const st=GROUPS.reduce((a,g)=>a+g.items.reduce((b,i)=>b+(m[[year,coop,g.name,i,season].join('|')]||0),0),0);
     html+=`<td>${st?fmt(st):''}</td></tr>`;
   });
   html+=`<tr class="total stock-subtotal coop-end"><td></td><td>小計</td>`;
   GROUPS.forEach(g=>g.items.forEach(i=>{
     const v=SEASONS.reduce((ss,se)=>ss+(m[[year,coop,g.name,i,se].join('|')]||0),0);
     html+=`<td>${v?fmt(v):''}</td>`;
   }));
   const ct=GROUPS.reduce((a,g)=>a+g.items.reduce((b,i)=>b+SEASONS.reduce((ss,se)=>ss+(m[[year,coop,g.name,i,se].join('|')]||0),0),0),0);
   html+=`<td>${ct?fmt(ct):''}</td></tr>`;
 });
 html+=`<tr class="total"><th colspan="2">合計</th>`;
 GROUPS.forEach(g=>g.items.forEach(i=>{
   const v=state.coops.reduce((ss,c)=>ss+SEASONS.reduce((z,se)=>z+(m[[year,c,g.name,i,se].join('|')]||0),0),0);
   html+=`<th>${v?fmt(v):''}</th>`;
 }));
 html+=`<th>${total(year)?fmt(total(year)):''}</th></tr></table></div><p class="muted">${esc(year)}年産の利用可能在庫です。確定済みの出荷指示数量を差し引いて表示し、0は空欄表示します。</p>${reservedTotal(year)>0?`<div class="note">確定済み出荷指示による在庫反映：${fmt(reservedTotal(year))}</div>`:''}</section>`;
 app.innerHTML=html;
 stockYear.onchange=()=>{setActiveYear(stockYear.value);stock()};
 x.onclick=home;r.onclick=stock;ex.onclick=downloadExcel;cs.onclick=downloadCSV;ps.onclick=()=>openStockPdfDirect(year);
}

function _stockCanvasPage(year){
 const W=1684,H=1191,margin=44;const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#222';ctx.fillStyle='#000';ctx.lineWidth=.55;ctx.textBaseline='middle';
 const font=(px,bold=false)=>`${bold?'700 ':'400 '}${px}px -apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif`;
 const text=(t,x,y,size=18,align='left',bold=false)=>{ctx.font=font(size,bold);ctx.textAlign=align;ctx.fillStyle='#000';ctx.fillText(String(t??''),x,y)};
 const box=(x,y,w,h)=>ctx.strokeRect(x,y,w,h);
 const fit=(t,x,y,w,size=18,bold=false)=>{ctx.font=font(size,bold);ctx.textAlign='center';let z=String(t??'');while(ctx.measureText(z).width>w-6&&size>9){size--;ctx.font=font(size,bold)}ctx.fillText(z,x+w/2,y)};
 const cols=allItems(),m=matrix();
 text('在 庫 集 計 表',margin,52,32,'left',true);text(`${year}年産`,W-margin,42,20,'right',true);text(`作成日：${today()}`,W-margin,70,15,'right');ctx.beginPath();ctx.moveTo(margin,88);ctx.lineTo(W-margin,88);ctx.stroke();
 const tableX=margin,tableY=112,tableW=W-margin*2;const coopW=126,seasonW=52,totalW=62,dataW=tableW-coopW-seasonW-totalW,itemW=dataW/cols.length;const h1=34,h2=32,rowH=42,footH=38,rowsPerCoop=SEASONS.length+1,bodyRows=state.coops.length*rowsPerCoop,tableH=h1+h2+bodyRows*rowH+footH;
 const xCoop=tableX+coopW,xSeason=xCoop+seasonW,xData=xSeason;const shHead=!!window.__v63ShipmentHeaderLarge,shCoopMerge=!!window.__v136KushiroShipmentCoopMerged;ctx.fillStyle=shHead?'#fff':'#f1f1f1';ctx.fillRect(tableX,tableY,tableW,h1+h2);ctx.fillStyle='#000';box(tableX,tableY,tableW,tableH);[xCoop,xSeason,xData+dataW].forEach(x=>{ctx.beginPath();ctx.moveTo(x,tableY);ctx.lineTo(x,tableY+tableH);ctx.stroke()}); text('組合名',tableX+coopW/2,tableY+(h1+h2)/2,shHead?18:14,'center',true);text('区分',xCoop+seasonW/2,tableY+(h1+h2)/2,shHead?18:14,'center',true);text('計',xData+dataW+totalW/2,tableY+(h1+h2)/2,shHead?18:14,'center',true);
 let ci=0;GROUPS.forEach(g=>{const gx=xData+ci*itemW,gw=g.items.length*itemW;box(gx,tableY,gw,h1);fit(g.name,gx,tableY+h1/2,gw,shHead?17:13,true);g.items.forEach((it,j)=>{const ix=gx+j*itemW;box(ix,tableY+h1,itemW,h2);fit(it,ix,tableY+h1+h2/2,itemW,shHead?20:12,true)});ci+=g.items.length});
 let y=tableY+h1+h2;state.coops.forEach(coop=>{
  const coopTop=y;
  ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();ctx.lineWidth=.55;
  SEASONS.forEach((season,si)=>{
    if(si>0){ctx.beginPath();ctx.moveTo(shCoopMerge?xCoop:tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();}
    fit(season,xCoop,y+rowH/2,seasonW,14,true);let rt=0;
    cols.forEach((c,j)=>{const q=m[[year,coop,c.group,c.item,season].join('|')]||0;rt+=q;const xx=xData+j*itemW;ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+rowH);ctx.stroke();if(q)fit(fmt(q),xx,y+rowH/2,itemW,shCoopMerge?24:20,false)});
    if(rt)fit(fmt(rt),xData+dataW,y+rowH/2,totalW,shCoopMerge?24:20,false);y+=rowH
  });
  ctx.fillStyle='#fff';ctx.fillRect(shCoopMerge?xCoop:tableX,y,tableW-(shCoopMerge?coopW:0),rowH);ctx.fillStyle='#000';
  ctx.beginPath();ctx.moveTo(shCoopMerge?xCoop:tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();
  ctx.beginPath();ctx.moveTo(xSeason,y);ctx.lineTo(xSeason,y+rowH);ctx.stroke();
  fit('小計',xCoop,y+rowH/2,seasonW,13,false);let ct=0;cols.forEach((c,j)=>{const q=SEASONS.reduce((a,se)=>a+(m[[year,coop,c.group,c.item,se].join('|')]||0),0);ct+=q;const xx=xData+j*itemW;if(q)fit(fmt(q),xx,y+rowH/2,itemW,13,false)});if(ct)fit(fmt(ct),xData+dataW,y+rowH/2,totalW,13,false);
  if(shCoopMerge)fit(coop,tableX,coopTop+(SEASONS.length+1)*rowH/2,coopW,18,true);
  else fit(coop,tableX,coopTop+(window.__v58ShipmentCoopLower?rowH*1.7:rowH/2),coopW,13,true);
  y+=rowH;
  ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();
 });
 ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();fit('合計',tableX,y+footH/2,coopW+seasonW,14,true);cols.forEach((c,j)=>{const q=state.coops.reduce((a,coop)=>a+SEASONS.reduce((b,se)=>b+(m[[year,coop,c.group,c.item,se].join('|')]||0),0),0);const xx=xData+j*itemW;ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+footH);ctx.stroke();if(q)fit(fmt(q),xx,y+footH/2,itemW,shHead?20:16,false)});const grand=total(year);if(grand)fit(fmt(grand),xData+dataW,y+footH/2,totalW,shHead?20:16,false);
 text('※ 0は空欄表示。確定済み出荷指示数量を差し引いた利用可能在庫です。',margin,H-28,14);
 return canvas;
}

async function _singleCanvasPdfBlob(canvas){
 const im={bytes:await _canvasJpegBytes(canvas),w:canvas.width,h:canvas.height};const catalogId=1,pagesId=2,pageId=3,imgId=4,contentId=5,objCount=5;const objs=[];
 objs[catalogId]=_ascii(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);objs[pagesId]=_ascii(`<< /Type /Pages /Count 1 /Kids [${pageId} 0 R] >>`);objs[pageId]=_ascii(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im0 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`);objs[imgId]=_concatBytes([_ascii(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`),im.bytes,_ascii('\nendstream')]);const stream='q\n841.89 0 0 595.28 0 0 cm\n/Im0 Do\nQ\n';objs[contentId]=_ascii(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
 const parts=[_ascii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offsets=Array(objCount+1).fill(0);let pos=parts[0].length;for(let i=1;i<=objCount;i++){offsets[i]=pos;const a=_ascii(`${i} 0 obj\n`),b=objs[i],c=_ascii('\nendobj\n');parts.push(a,b,c);pos+=a.length+b.length+c.length}const xrefPos=pos;let xref=`xref\n0 ${objCount+1}\n0000000000 65535 f \n`;for(let i=1;i<=objCount;i++)xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';xref+=`trailer\n<< /Size ${objCount+1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;parts.push(_ascii(xref));return new Blob(parts,{type:'application/pdf'});
}

async function openStockPdfDirect(year=state.activeYear){
 const w=window.open('about:blank','_blank');if(!w)return alert('PDF表示用の画面を開けませんでした。Safariのポップアップ設定を確認してください。');
 try{w.document.write('<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>在庫集計表 PDF作成中</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:32px;text-align:center"><h3>A4横向きPDFを作成しています…</h3><p>そのままお待ちください。</p></body></html>');w.document.close();const blob=await _singleCanvasPdfBlob(_stockCanvasPage(year));const url=URL.createObjectURL(blob);w.location.replace(url);setTimeout(()=>URL.revokeObjectURL(url),10*60*1000)}catch(e){try{w.document.open();w.document.write('<meta name="viewport" content="width=device-width"><div style="font-family:-apple-system;padding:30px"><h3>PDF作成に失敗しました。</h3><p>'+String(e&&e.message?e.message:e).replace(/[&<>]/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]})+'</p><button onclick="window.close()" style="font-size:16px;padding:10px 16px">元の画面に戻る</button></div>');w.document.close()}catch(_e){}}
}

function logs(){const arr=state.records.slice().reverse();app.innerHTML=`<section class="card"><h2>入出庫履歴</h2><input class="search" id="search" placeholder="年度・漁協・季節・分類・備考を検索"><div class="tablewrap"><table style="min-width:1100px"><tr><th>日付</th><th>区分</th><th>生産年度</th><th>漁協</th><th>季節</th><th>大分類</th><th>細分類</th><th>数量</th><th>備考</th><th>操作</th></tr><tbody id="tb"></tbody></table></div><button class="btn secondary" id="x" style="margin-top:10px">ホームへ戻る</button></section>`;const render=()=>{const t=search.value.trim().toLowerCase();tb.innerHTML=arr.filter(r=>[r.date,r.type==='in'?'入庫':'出庫',r.year||DEFAULT_YEAR,r.coop,r.season,r.group,r.item,r.memo].join(' ').toLowerCase().includes(t)).map(r=>`<tr><td>${esc(r.date)}</td><td>${r.type==='in'?'入庫':'出庫'}</td><td>${esc(r.year||DEFAULT_YEAR)}年産</td><td>${esc(r.coop)}</td><td>${esc(r.season)}</td><td>${esc(r.group)}</td><td>${esc(r.item)}</td><td>${fmt(r.qty)}</td><td>${esc(r.memo||'')}</td><td><div class="record-actions"><button class="mini" data-edit="${r.id}">修正</button><button class="mini danger" data-del="${r.id}">削除</button></div></td></tr>`).join('')||'<tr><td colspan="10" class="empty">履歴はありません</td></tr>'};render();search.oninput=render;tb.onclick=e=>{const ed=e.target.dataset.edit,del=e.target.dataset.del;if(ed)form(null,ed);if(del&&confirm('この入出庫を削除しますか？')){state.records=state.records.filter(r=>r.id!==del);save();logs()}};x.onclick=home}
function flatRows(){const m=matrix(),rows=[];YEARS.forEach(y=>state.coops.forEach(c=>SEASONS.forEach(se=>GROUPS.forEach(g=>g.items.forEach(i=>rows.push([y,c,se,g.name,i,m[[y,c,g.name,i,se].join('|')]||0]))))));return rows}
function download(name,content,type){const blob=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function downloadCSV(){const rows=[['生産年度','組合名','区分','大分類','細分類','在庫'],...flatRows()];download('昆布在庫_年度別_'+today()+'.csv','\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8')}
function downloadExcel(){let h='<html><head><meta charset="UTF-8"></head><body><table border="1"><tr><th>生産年度</th><th>組合名</th><th>区分</th><th>大分類</th><th>細分類</th><th>在庫</th></tr>';flatRows().forEach(r=>{h+=`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`});h+='</table></body></html>';download('昆布在庫_年度別_'+today()+'.xls','\uFEFF'+h,'application/vnd.ms-excel;charset=utf-8')}
function exportsPage(){app.innerHTML=`<section class="card"><h2>データ出力・バックアップ</h2><div class="toolbar"><button class="btn" id="ex">Excel形式</button><button class="btn" id="cs">CSV</button><button class="btn secondary" id="bk">バックアップ保存</button><button class="btn secondary" id="rs">バックアップ復元</button></div><input id="file" type="file" accept="application/json,.json" hidden><p class="muted">出力・バックアップにはR3〜R10の生産年度情報も含まれます。</p><button class="btn secondary" id="x">ホームへ戻る</button></section>`;ex.onclick=downloadExcel;cs.onclick=downloadCSV;bk.onclick=backup;rs.onclick=()=>file.click();file.onchange=()=>restore(file.files[0]);x.onclick=home}
function backup(){download('昆布在庫管理_年度別バックアップ_'+today()+'.json',JSON.stringify({app:'昆布在庫管理',version:5,groups:GROUPS,seasons:SEASONS,years:YEARS,exportedAt:new Date().toISOString(),...state},null,2),'application/json;charset=utf-8')}
function restore(file){if(!file)return;const fr=new FileReader();fr.onload=()=>{try{const d=JSON.parse(fr.result);if(!Array.isArray(d.records)||!Array.isArray(d.coops))throw Error();if(!confirm('現在のデータをバックアップ内容に置き換えます。よろしいですか？'))return;state={records:d.records.map(r=>({...r,year:YEARS.includes(r.year)?r.year:DEFAULT_YEAR})),coops:d.coops,shipments:Array.isArray(d.shipments)?d.shipments:[],shipmentSeq:Number(d.shipmentSeq||1),pdfImports:Array.isArray(d.pdfImports)?d.pdfImports:[],companies:Array.isArray(d.companies)?d.companies:[{name:'㈱浜中運輸',address:'',phone:''}],activeYear:YEARS.includes(d.activeYear)?d.activeYear:DEFAULT_YEAR};save();alert('復元しました');home()}catch(e){alert('バックアップを読み込めませんでした')}};fr.readAsText(file)}
function masters(){
 app.innerHTML=`<section class="card"><h2>マスター設定</h2><p class="muted">生産年度はR3〜R10で固定しています。漁協名と、出荷指示で使う会社情報（会社名・住所・電話番号）を編集できます。</p><h3>漁協</h3><div class="master-list" id="cl"></div><button class="btn secondary" id="ac">＋ 漁協を追加</button><button class="btn" id="sm" style="margin-top:10px">保存</button><hr><h3>会社マスター</h3><div id="companyList" class="master-list"></div><button class="btn secondary" id="addCompany" style="margin-top:8px">＋ 会社を追加</button><button class="btn" id="saveCompanies" style="margin-top:10px">会社情報を保存</button><hr><h3>PDF準拠の細分類</h3><div id="defs"></div><button class="btn secondary" id="x" style="margin-top:8px">戻る</button></section>`;
 const renderCoops=()=>{cl.innerHTML=state.coops.map((v,i)=>`<div class="master-item"><input value="${esc(v)}" data-c="${i}"><button class="mini danger" data-r="${i}">削除</button></div>`).join('')};
 const renderCompanies=()=>{companyList.innerHTML=state.companies.map((v,i)=>`<div class="card" style="margin:6px 0;padding:10px;background:#f8fafc"><div class="form"><label>会社名<input value="${esc(v.name)}" data-company-field="name" data-company-i="${i}"></label><label>住所<input value="${esc(v.address||'')}" data-company-field="address" data-company-i="${i}"></label><label>電話番号<input value="${esc(v.phone||'')}" data-company-field="phone" data-company-i="${i}" inputmode="tel"></label><button class="mini danger" data-company-del="${i}" type="button">削除</button></div></div>`).join('')||'<div class="empty">会社はまだ登録されていません。</div>'};
 defs.innerHTML=GROUPS.map(g=>`<p><b>${esc(g.name)}</b>：${g.items.map(esc).join('・')}</p>`).join('');renderCoops();renderCompanies();
 ac.onclick=()=>{state.coops.push('新しい漁協');renderCoops()};
 cl.onclick=e=>{const i=e.target.dataset.r;if(i!==undefined){if(state.coops.length<=1)return alert('漁協は1件以上必要です');state.coops.splice(i,1);renderCoops()}};
 sm.onclick=()=>{const old=[...state.coops];document.querySelectorAll('[data-c]').forEach(x=>state.coops[+x.dataset.c]=x.value.trim());if(state.coops.some(x=>!x)||new Set(state.coops).size!==state.coops.length){state.coops=old;return alert('空欄や重複は使えません')}save();alert('漁協を保存しました')};
 addCompany.onclick=()=>{state.companies.push({name:'',address:'',phone:''});renderCompanies()};
 companyList.onclick=e=>{const i=e.target.dataset.companyDel;if(i!==undefined){state.companies.splice(+i,1);renderCompanies()}};
 saveCompanies.onclick=()=>{const arr=state.companies.map((c,i)=>{const q=f=>document.querySelector(`[data-company-i="${i}"][data-company-field="${f}"]`);return {...c,name:(q('name')?.value||'').trim(),address:(q('address')?.value||'').trim(),phone:(q('phone')?.value||'').trim()}}).filter(c=>c.name);if(new Set(arr.map(c=>c.name)).size!==arr.length)return alert('会社名が重複しています。');state.companies=arr;save();renderCompanies();alert('会社情報を保存しました')};
 x.onclick=home;
}


/* ===== 出荷指示機能 v1 ===== */
state.shipments=Array.isArray(state.shipments)?state.shipments:[];
state.shipments=state.shipments.map(s=>{const source=shipmentSource(s),destInfo=shipmentDest(s);return {...s,source,destInfo,dest:destInfo.name,baseYear:YEARS.includes(s.baseYear)?s.baseYear:(Array.isArray(s.lines)&&YEARS.includes(s.lines[0]?.year)?s.lines[0].year:DEFAULT_YEAR),lines:Array.isArray(s.lines)?s.lines.filter(l=>!DELETED_GROUPS.has(l.group)).map(l=>({...l,year:YEARS.includes(l.year)?l.year:DEFAULT_YEAR})):[]}});
if(!state.shipmentSeq) state.shipmentSeq=1;
function save2(){save();}
function shipmentQtyByKey(k, excludeId){
  return state.shipments.filter(s=>s.id!==excludeId && s.status==='confirmed').reduce((sum,s)=>sum+s.lines.filter(l=>key(l)===k).reduce((a,l)=>a+Number(l.qty||0),0),0);
}
function shipmentDraftReserved(k, excludeId){return shipmentQtyByKey(k,excludeId)}
function stockAvailableForShipment(year,coop,season,group,item,excludeId){
  const k=[year,coop,group,item,season].join('|');
  return Math.max(0,available(year,coop,season,group,item)-shipmentDraftReserved(k,excludeId));
}
function shipmentId(){return 'S'+String(state.shipmentSeq++).padStart(5,'0')}
function shipmentForm(id=null){
  const s=id?state.shipments.find(x=>x.id===id):null;
  if(s&&s.status==='shipped'){return shipmentDetail(id)}
  let lines=s?.lines?.length?s.lines.map(x=>({...x})):[];
  const baseYear=s?.baseYear||lines[0]?.year||state.activeYear;
  const src=shipmentSource(s),dst=shipmentDest(s);
  app.innerHTML=`<section class="card"><h2>📦 ${s?'出荷指示修正':'新規出荷指示'}</h2><div class="form"><datalist id="companyNames">${companyDatalist()}</datalist>
  <div class="card" style="margin:0;padding:12px;background:#f8fafc"><h3 style="margin-top:0">出荷元</h3><div class="form"><label>会社名<input id="sourceName" list="companyNames" value="${esc(src.name)}" placeholder="会社名"></label><label>住所<input id="sourceAddress" value="${esc(src.address)}" placeholder="住所"></label><label>電話番号<input id="sourcePhone" value="${esc(src.phone)}" inputmode="tel" placeholder="電話番号"></label></div></div>
  <div class="card" style="margin:0;padding:12px;background:#f8fafc"><h3 style="margin-top:0">出荷先</h3><div class="form"><label>会社名<input id="destName" list="companyNames" value="${esc(dst.name)}" placeholder="会社名"></label><label>住所<input id="destAddress" value="${esc(dst.address)}" placeholder="住所"></label><label>電話番号<input id="destPhone" value="${esc(dst.phone)}" inputmode="tel" placeholder="電話番号"></label></div></div>
  <div class="subgrid"><label>出荷日<input id="shipDate" type="date" value="${s?.shipDate||today()}"></label><label>基本生産年度<select id="shipBaseYear">${yearOptions(baseYear)}</select></label><label>希望着日<input id="arrivalDate" type="date" value="${s?.arrivalDate||''}"></label></div>
  <label>備考<input id="shipMemo" value="${esc(s?.memo||'')}" placeholder="配送・梱包等の指示"></label>
  <div class="note">出荷元・出荷先は会社名・住所・電話番号を保存します。会社名が会社マスターと一致すると住所・電話番号を自動入力します。指示を確定すると、その数量は在庫表から即時差し引かれます。</div>
  <div id="shipLines"></div><button class="btn secondary" id="addLine">＋ 明細を追加</button><div class="toolbar"><button class="btn" id="saveDraft">下書き保存</button><button class="btn secondary" id="backShip">戻る</button></div></div></section>`;
  const fillCompany=(nameEl,addressEl,phoneEl)=>{const c=companyByName(nameEl.value);if(c){addressEl.value=c.address||'';phoneEl.value=c.phone||''}};
  sourceName.onchange=()=>fillCompany(sourceName,sourceAddress,sourcePhone);destName.onchange=()=>fillCompany(destName,destAddress,destPhone);
  function renderLines(){
    shipLines.innerHTML=lines.map((l,idx)=>`<div class="card" style="margin:10px 0;padding:12px;background:#f8fafc"><div class="row"><b>明細 ${idx+1}</b><button class="mini danger" data-del-line="${idx}">削除</button></div><div class="form" style="margin-top:8px"><div class="subgrid"><label>生産年度<select data-f="year" data-i="${idx}">${yearOptions(l.year||state.activeYear)}</select></label><label>漁協<select data-f="coop" data-i="${idx}">${state.coops.map(c=>`<option ${c===l.coop?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>季節<select data-f="season" data-i="${idx}">${SEASONS.map(x=>`<option ${x===(l.season||'夏')?'selected':''}>${x}</option>`).join('')}</select></label></div><label>大分類・細分類<select data-f="gi" data-i="${idx}">${itemOptions(l.group||GROUPS[0].name,l.item||GROUPS[0].items[0])}</select></label><div class="subgrid"><label>数量<input data-f="qty" data-i="${idx}" type="number" min="0.01" step="0.01" value="${esc(l.qty||'')}"></label><label>明細備考<input data-f="memo" data-i="${idx}" value="${esc(l.memo||'')}"></label></div></div></div>`).join('')||'<div class="empty">明細を追加してください。</div>';
    shipLines.querySelectorAll('[data-f]').forEach(el=>el.onchange=()=>{const i=+el.dataset.i,f=el.dataset.f;if(f==='gi'){[lines[i].group,lines[i].item]=el.value.split('|')}else lines[i][f]=el.value});
    shipLines.querySelectorAll('[data-del-line]').forEach(b=>b.onclick=()=>{lines.splice(+b.dataset.delLine,1);renderLines()});
  }
  addLine.onclick=()=>{lines.push({year:shipBaseYear.value||state.activeYear,coop:state.coops[0],season:'夏',group:GROUPS[0].name,item:GROUPS[0].items[0],qty:'',memo:''});renderLines()};
  saveDraft.onclick=()=>{
    if(!sourceName.value.trim())return alert('出荷元の会社名を入力してください');
    if(!destName.value.trim())return alert('出荷先の会社名を入力してください');
    if(!lines.length)return alert('明細を1件以上追加してください');
    for(const l of lines){const q=Number(l.qty);if(!q||q<=0)return alert('数量を入力してください');const av=stockAvailableForShipment(l.year||DEFAULT_YEAR,l.coop,l.season,l.group,l.item,s?.id);if(q>av)return alert(`${l.year||DEFAULT_YEAR}年産 ${l.coop} ${l.season} ${l.group} ${l.item} の出荷可能在庫は ${fmt(av)} です。`)}
    const source={name:sourceName.value.trim(),address:sourceAddress.value.trim(),phone:sourcePhone.value.trim()},destInfo={name:destName.value.trim(),address:destAddress.value.trim(),phone:destPhone.value.trim()};
    upsertCompany(source);upsertCompany(destInfo);
    const obj=s||{id:shipmentId(),status:'draft',createdAt:new Date().toISOString()};Object.assign(obj,{source,destInfo,dest:destInfo.name,baseYear:shipBaseYear.value||state.activeYear,shipDate:shipDate.value,arrivalDate:arrivalDate.value,memo:shipMemo.value,lines,updatedAt:new Date().toISOString()});if(!s)state.shipments.push(obj);save();alert('出荷指示を保存しました');shipmentDetail(obj.id)
  };
  backShip.onclick=shipments;renderLines();
}
function v160AvailableForShipmentLine(product,l,excludeShipmentId=null){
  const inv=window.KombuRefactor?.Inventory;

  if(product==='hidaka'){
    return inv?.getHidakaAvailableQuantity
      ? inv.getHidakaAvailableQuantity({
          year:l.year||H_DEFAULT_YEAR,
          location:l.location,
          section:l.section,
          grade:l.grade
        },excludeShipmentId)
      : hAvail(
          l.year||H_DEFAULT_YEAR,
          l.location,
          l.section,
          l.grade,
          excludeShipmentId
        );
  }

  if(product==='nemuro'){
    return inv?.getAvailableQuantity
      ? inv.getAvailableQuantity('nemuro',{
          year:l.year||N_DEFAULT_YEAR,
          coop:l.coop,
          season:l.season,
          group:l.group,
          item:l.item
        },excludeShipmentId)
      : nAvail(
          l.year||N_DEFAULT_YEAR,
          l.coop,
          l.season,
          l.group,
          l.item,
          excludeShipmentId
        );
  }

  if(product==='sanmae'){
    return inv?.getAvailableQuantity
      ? inv.getAvailableQuantity('sanmae',{
          year:l.year||SM_DEFAULT_YEAR,
          coop:l.coop,
          season:l.season,
          group:l.group,
          item:l.item
        },excludeShipmentId)
      : smAvail(
          l.year||SM_DEFAULT_YEAR,
          l.coop,
          l.season,
          l.group,
          l.item,
          excludeShipmentId
        );
  }

  return inv?.getAvailableQuantity
    ? inv.getAvailableQuantity('kushiro',{
        year:l.year||DEFAULT_YEAR,
        coop:l.coop,
        season:l.season,
        group:l.group,
        item:l.item
      },excludeShipmentId)
    : stockAvailableForShipment(
        l.year||DEFAULT_YEAR,
        l.coop,
        l.season,
        l.group,
        l.item,
        excludeShipmentId
      );
}

/* ===== v2.8 FAXBOX連動：在庫確定/取消をapp本体で一元処理 ===== */
window.kombuApplyFaxboxInventory=function(product,id,action,meta){
  meta=meta||{};
  let store=null, saver=null;
  if(product==='kushiro'){store=state;saver=save}
  else if(product==='hidaka'){store=hState;saver=hSave}
  else if(product==='nemuro'){store=nState;saver=nSave}
  else if(product==='sanmae'){store=smState;saver=smSave}
  else throw new Error('昆布種類を判別できません。');

  const s=(store.shipments||[]).find(x=>String(x.id)===String(id));
  if(!s)throw new Error('出荷依頼 '+id+' が見つかりません。');

  if(action==='confirm'){
    if(s.status==='confirmed' || s.status==='shipped') return true;

    for(const l of (s.lines||[])){
      const av=v160AvailableForShipmentLine(product,l,s.id);
      if(Number(l.qty)>Math.max(0,Number(av||0))){
        throw new Error('在庫不足があります。');
      }
    }

    s.status='confirmed';
    s.confirmedAt=new Date().toISOString();
    s.faxboxJobId=meta.jobId||s.faxboxJobId||'';
    s.faxboxStatus='queued';
    s.inventoryAppliedByFaxbox=true;
    saver();
    return true;
  }

  if(action==='cancel'){
    if(s.status==='cancelled') return true;
    if(s.status==='shipped'){
      throw new Error('すでに出荷済みのため自動取消できません。');
    }

    s.status='cancelled';
    s.cancelledAt=new Date().toISOString();
    s.faxboxStatus='cancelled';
    s.inventoryAppliedByFaxbox=false;
    saver();
    return true;
  }

  throw new Error('不明な在庫処理です。');
};
/* ===== /v2.8 ===== */


/* ===== v2.9 FAX送信完了 → 出荷済・履歴保存 ===== */
window.kombuFinalizeFaxboxShipment=function(product,id,meta){
  meta=meta||{};
  let store=null,saver=null;
  if(product==='kushiro'){store=state;saver=save}
  else if(product==='hidaka'){store=hState;saver=hSave}
  else if(product==='nemuro'){store=nState;saver=nSave}
  else if(product==='sanmae'){store=smState;saver=smSave}
  else throw new Error('昆布種類を判別できません。');

  const s=(store.shipments||[]).find(x=>String(x.id)===String(id));
  if(!s)throw new Error('出荷依頼 '+id+' が見つかりません。');
  if(s.status==='cancelled')return false;

  if(s.status!=='shipped'){
    const already=(store.records||[]).some(r=>String(r.faxboxShipmentId||'')===String(s.id));
    if(!already){
      (s.lines||[]).forEach(l=>{
        const base={
          id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),
          type:'out',
          qty:Number(l.qty||0),
          date:s.shipDate||today(),
          memo:`FAX送信完了 出荷依頼 ${s.id}`,
          faxboxShipmentId:s.id,
          faxboxJobId:meta.jobId||s.faxboxJobId||''
        };
        if(product==='hidaka')Object.assign(base,{year:l.year,location:l.location,section:l.section,grade:l.grade});
        else Object.assign(base,{year:l.year,coop:l.coop,season:l.season,group:l.group,item:l.item});
        store.records.push(base);
      });
    }
    s.status='shipped';
    s.shippedAt=meta.sentAt||new Date().toISOString();
    s.faxboxStatus='sent';
    s.faxboxJobId=meta.jobId||s.faxboxJobId||'';
    saver();
  }

  const HIST_KEY='kombu-v136-shipment-history';
  let hist=[];
  try{hist=JSON.parse(localStorage.getItem(HIST_KEY)||'[]');if(!Array.isArray(hist))hist=[]}catch(_e){hist=[]}
  const k=product+'::'+id;
  const idx=hist.findIndex(x=>x.key===k);
  const d=product==='kushiro'
    ? (s.destInfo&&typeof s.destInfo==='object'?s.destInfo:{name:typeof s.dest==='string'?s.dest:'',address:'',phone:''})
    : (s.dest||{});
  const row={
    key:k,product,id,
    shipDate:s.shipDate||'',
    source:s.source||{},
    dest:d,
    qty:(s.lines||[]).reduce((n,l)=>n+Number(l.qty||0),0),
    snapshot:JSON.parse(JSON.stringify(s)),
    faxboxJobId:meta.jobId||s.faxboxJobId||'',
    faxboxStatus:'sent',
    sentAt:s.shippedAt,
    archivedAt:s.shippedAt
  };
  if(idx>=0)hist[idx]={...hist[idx],...row};
  else hist.push(row);
  localStorage.setItem(HIST_KEY,JSON.stringify(hist));
  return true;
};
/* ===== /v2.9 ===== */

function shipmentDetail(id){
 const s=state.shipments.find(x=>x.id===id);if(!s)return shipments();
 const statusName={draft:'下書き',confirmed:'確定・在庫反映済',shipped:'出荷済',cancelled:'取消'}[s.status]||s.status;
 const totalQ=s.lines.reduce((a,l)=>a+Number(l.qty||0),0),src=shipmentSource(s),dst=shipmentDest(s);
 const shipmentYears=[...new Set(s.lines.map(l=>l.year||s.baseYear||DEFAULT_YEAR))].sort((a,b)=>YEARS.indexOf(a)-YEARS.indexOf(b));
 app.innerHTML=`<section class="card"><div class="row"><h2>📦 出荷指示書 ${esc(s.id)}</h2><span class="pill">${statusName}</span></div><div class="subgrid"><div class="card" style="margin:0;padding:10px;background:#f8fafc"><b>出荷元</b><br>${esc(src.name)}<br><span class="small">${esc(src.address||'')} ${src.phone?'／ TEL '+esc(src.phone):''}</span></div><div class="card" style="margin:0;padding:10px;background:#f8fafc"><b>出荷先</b><br>${esc(dst.name)}<br><span class="small">${esc(dst.address||'')} ${dst.phone?'／ TEL '+esc(dst.phone):''}</span></div></div><p><b>出荷日：</b>${esc(s.shipDate||'')}　　<b>希望着日：</b>${esc(s.arrivalDate||'未指定')}</p><p><b>生産年度：</b>${esc(shipmentYears.map(y=>y+'年産').join('・'))}　　<b>合計：</b>${fmt(totalQ)}</p><div class="tablewrap"><table style="min-width:900px"><tr><th>生産年度</th><th>漁協</th><th>季節</th><th>大分類</th><th>細分類</th><th>数量</th><th>備考</th></tr>${s.lines.map(l=>`<tr><td>${esc(l.year||DEFAULT_YEAR)}年産</td><td>${esc(l.coop)}</td><td>${esc(l.season)}</td><td>${esc(l.group)}</td><td>${esc(l.item)}</td><td>${fmt(l.qty)}</td><td>${esc(l.memo||'')}</td></tr>`).join('')}</table></div><p class="muted">備考：${esc(s.memo||'')}</p><div class="note">下書きでは在庫は変わりません。「出荷指示を確定して在庫反映」を押すと在庫表から即時差し引き、取消時は自動で在庫へ戻します。出荷済みにすると入出庫履歴へ正式な出庫記録を作成します。</div><div class="toolbar"><button class="btn" id="pdf">📄 PDF・FAX用</button>${s.status==='draft'?'<button class="btn" id="confirmShipmentBtn">出荷指示を確定して在庫反映</button>':''}${s.status==='confirmed'?'<button class="btn" id="shippedShipmentBtn">出荷済にする</button>':''}${s.status==='draft'?'<button class="btn secondary" id="editShipmentBtn">修正</button>':''}${s.status!=='shipped'&&s.status!=='cancelled'?'<button class="btn danger" id="cancelShipmentBtn">取消</button>':''}<button class="btn secondary" id="backShipmentBtn">一覧へ</button></div></section>`;
 const pdfBtn=document.getElementById('pdf');if(pdfBtn)pdfBtn.onclick=()=>openShipmentPdfDirect(s.id);
if(s.status==='draft'){
  const confirmBtn=document.getElementById('confirmShipmentBtn');

  if(confirmBtn)confirmBtn.onclick=()=>{
    for(const l of s.lines){
      const av=v160AvailableForShipmentLine(
        'kushiro',
        l,
        s.id
      );

      if(Number(l.qty)>Math.max(0,Number(av||0))){
        return alert(
          `${l.year||DEFAULT_YEAR}年産 ${l.coop} ${l.season} ${l.group} ${l.item} の出荷可能在庫は ${fmt(av)} です。`
        );
      }
    }

    s.status='confirmed';
    s.confirmedAt=new Date().toISOString();

    save();

    alert('出荷指示を確定し、在庫表へ反映しました');
    shipmentDetail(s.id);
  };

  const editBtn=document.getElementById('editShipmentBtn');

  if(editBtn){
    editBtn.onclick=()=>v114UnifiedShipmentForm('kushiro',s.id);
  }
}

 if(s.status==='confirmed'){const shippedBtn=document.getElementById('shippedShipmentBtn');if(shippedBtn)shippedBtn.onclick=()=>{if(!window.confirm('出荷済みにしますか？ 在庫は確定時にすでに反映されています。'))return;for(const l of s.lines){state.records.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),type:'out',year:l.year||DEFAULT_YEAR,coop:l.coop,season:l.season,group:l.group,item:l.item,qty:Number(l.qty),date:s.shipDate||today(),memo:`出荷指示 ${s.id} / ${shipmentDest(s).name}`})}s.status='shipped';s.shippedAt=new Date().toISOString();save();alert('出荷済みにしました。入出庫履歴へ出庫記録を作成しました。');shipmentDetail(s.id)}}
 if(s.status!=='shipped'&&s.status!=='cancelled'){const cancelBtn=document.getElementById('cancelShipmentBtn');if(cancelBtn)cancelBtn.onclick=()=>{if(window.confirm(s.status==='confirmed'?'取消すると在庫表へ数量を戻します。よろしいですか？':'この出荷指示を取消しますか？')){s.status='cancelled';s.cancelledAt=new Date().toISOString();save();alert('出荷指示を取消しました');shipmentDetail(s.id)}}}
 const backBtn=document.getElementById('backShipmentBtn');if(backBtn)backBtn.onclick=shipments;
}
function shipments(){
 const arr=state.shipments.slice().reverse();
 app.innerHTML=`<section class="card"><div class="row"><h2>📦 出荷指示一覧</h2><button class="mini" id="newS">＋新規</button></div><input class="search" id="ss" placeholder="指示番号・出荷元・出荷先・状態で検索"><div class="tablewrap"><table style="min-width:1050px"><tr><th>指示番号</th><th>生産年度</th><th>出荷元</th><th>出荷先</th><th>出荷日</th><th>希望着日</th><th>数量</th><th>状態</th><th>操作</th></tr><tbody id="stb"></tbody></table></div><button class="btn secondary" id="sx" style="margin-top:10px">ホームへ戻る</button></section>`;
 const render=()=>{const q=ss.value.trim().toLowerCase();stb.innerHTML=arr.filter(s=>[s.id,...s.lines.map(l=>l.year||DEFAULT_YEAR),shipmentSource(s).name,shipmentDest(s).name,s.shipDate,s.arrivalDate,s.status].join(' ').toLowerCase().includes(q)).map(s=>`<tr><td>${esc(s.id)}</td><td>${esc([...new Set(s.lines.map(l=>(l.year||DEFAULT_YEAR)+'年産'))].join('・'))}</td><td>${esc(shipmentSource(s).name)}</td><td>${esc(shipmentDest(s).name)}</td><td>${esc(s.shipDate||'')}</td><td>${esc(s.arrivalDate||'')}</td><td>${fmt(s.lines.reduce((a,l)=>a+Number(l.qty||0),0))}</td><td>${{draft:'下書き',confirmed:'確定・在庫反映済',shipped:'出荷済',cancelled:'取消'}[s.status]||s.status}</td><td><button class="mini" data-open="${s.id}">開く</button></td></tr>`).join('')||'<tr><td colspan="9" class="empty">出荷指示はありません</td></tr>'};render();ss.oninput=render;stb.onclick=e=>{if(e.target.dataset.open)shipmentDetail(e.target.dataset.open)};newS.onclick=()=>shipmentForm();sx.onclick=home;
}

function _shipmentCanvasPage(s,year){
 const W=1684,H=1191,margin=44;const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#222';ctx.fillStyle='#000';ctx.lineWidth=.55;ctx.textBaseline='middle';
 const font=(px,bold=false)=>`${bold?'700 ':'400 '}${px}px -apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif`;
 const text=(t,x,y,size=18,align='left',bold=false)=>{ctx.font=font(size,bold);ctx.textAlign=align;ctx.fillStyle='#000';ctx.fillText(String(t??''),x,y)};
 const box=(x,y,w,h)=>ctx.strokeRect(x,y,w,h);
 const fit=(t,x,y,w,size=18,bold=false)=>{ctx.font=font(size,bold);ctx.textAlign='center';let z=String(t??'');while(ctx.measureText(z).width>w-6&&size>9){size--;ctx.font=font(size,bold)}ctx.fillText(z,x+w/2,y)};
 const cols=allItems(),lines=s.lines.filter(l=>(l.year||DEFAULT_YEAR)===year),totalAll=lines.reduce((a,l)=>a+Number(l.qty||0),0),src=shipmentSource(s),dst=shipmentDest(s);
 text('出 荷 指 示 書',margin,50,32,'left',true);text(`指示番号：${s.id}`,W-margin,42,16,'right');text(`作成日：${today()}`,W-margin,67,16,'right');ctx.beginPath();ctx.moveTo(margin,84);ctx.lineTo(W-margin,84);ctx.stroke();
 const infoY=96,half=(W-margin*2)/2,infoH=72;
 const leftInfo=dst,rightInfo=src;[[leftInfo,'出荷先'],[rightInfo,'出荷元']].forEach(([c,label],i)=>{const x=margin+i*half;box(x,infoY,half,infoH);text(`${label}：${c.name||''}`,x+10,infoY+18,16,'left',true);text(`住所：${c.address||''}`,x+10,infoY+40,14);text(`電話：${c.phone||''}`,x+10,infoY+60,14)});
 const dateY=176,dateH=40,dateW=(W-margin*2)/3;[['出荷日',s.shipDate||''],['希望着日',s.arrivalDate||''],['合計',fmt(totalAll)]].forEach((v,i)=>{box(margin+i*dateW,dateY,dateW,dateH);fit(`${v[0]}：${v[1]}`,margin+i*dateW,dateY+dateH/2,dateW,16,i===2)});
 box(margin,224,W-margin*2,40);text(`生産年度：${year}年産`,margin+14,244,17,'left',true);text(`区分：${[...new Set(lines.map(x=>x.season))].join('・')}`,margin+430,244,17);
 const tableX=margin,tableY=276,tableW=W-margin*2;const yearW=92,coopW=112,seasonW=48,totalW=58,dataW=tableW-yearW-coopW-seasonW-totalW,itemW=dataW/cols.length;const h1=30,h2=30,rowH=31,footH=34,rowsPerCoop=SEASONS.length+1,bodyRows=state.coops.length*rowsPerCoop,tableH=h1+h2+bodyRows*rowH+footH;
 const x0=tableX,xYear=x0+yearW,xCoop=xYear+coopW,xSeason=xCoop+seasonW,xData=xSeason;
 ctx.fillStyle='#f1f1f1';ctx.fillRect(tableX,tableY,tableW,h1+h2);ctx.fillStyle='#000';box(tableX,tableY,tableW,tableH);
 [xYear,xCoop,xSeason,xData+dataW].forEach(x=>{ctx.beginPath();ctx.moveTo(x,tableY);ctx.lineTo(x,tableY+tableH);ctx.stroke()});
 text('生産年度',tableX+yearW/2,tableY+(h1+h2)/2,13,'center',true);text('組合名',xYear+coopW/2,tableY+(h1+h2)/2,13,'center',true);text('区分',xCoop+seasonW/2,tableY+(h1+h2)/2,13,'center',true);text('計',xData+dataW+totalW/2,tableY+(h1+h2)/2,13,'center',true);
 let ci=0;GROUPS.forEach(g=>{const gx=xData+ci*itemW,gw=g.items.length*itemW;box(gx,tableY,gw,h1);fit(g.name,gx,tableY+h1/2,gw,13,true);g.items.forEach((it,j)=>{const ix=gx+j*itemW;box(ix,tableY+h1,itemW,h2);fit(it,ix,tableY+h1+h2/2,itemW,12,true)});ci+=g.items.length});
 let y=tableY+h1+h2,first=true;
 state.coops.forEach(coop=>{
  ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();ctx.lineWidth=.55;
  SEASONS.forEach((season,si)=>{ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();if(first){fit(year+'年産',tableX,y+rowH/2,yearW,13,true);first=false}if(si===0)fit(coop,xYear,y+rowH/2,coopW,13,true);fit(season,xCoop,y+rowH/2,seasonW,14,true);let rt=0;cols.forEach((c,j)=>{const q=lines.filter(l=>l.coop===coop&&l.season===season&&l.group===c.group&&l.item===c.item).reduce((a,l)=>a+Number(l.qty||0),0);rt+=q;const xx=xData+j*itemW;ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+rowH);ctx.stroke();if(q)fit(fmt(q),xx,y+rowH/2,itemW,20,false)});if(rt)fit(fmt(rt),xData+dataW,y+rowH/2,totalW,20,false);y+=rowH});
  ctx.fillStyle='#fff';ctx.fillRect(tableX,y,tableW,rowH);ctx.fillStyle='#000';ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();fit('小計',xCoop,y+rowH/2,seasonW,13,false);let ct=0;cols.forEach((c,j)=>{const q=lines.filter(l=>l.coop===coop&&l.group===c.group&&l.item===c.item).reduce((a,l)=>a+Number(l.qty||0),0);ct+=q;const xx=xData+j*itemW;if(q)fit(fmt(q),xx,y+rowH/2,itemW,13,false)});if(ct)fit(fmt(ct),xData+dataW,y+rowH/2,totalW,13,false);y+=rowH;
 });
 ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();fit('合計',tableX,y+footH/2,yearW+coopW+seasonW,14,true);cols.forEach((c,j)=>{const q=lines.filter(l=>l.group===c.group&&l.item===c.item).reduce((a,l)=>a+Number(l.qty||0),0);const xx=xData+j*itemW;ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+footH);ctx.stroke();if(q)fit(fmt(q),xx,y+footH/2,itemW,16,false)});if(totalAll)fit(fmt(totalAll),xData+dataW,y+footH/2,totalW,16,false);y+=footH;
 const noteY=y+12;box(margin,noteY,W-margin*2,44);text('備考：'+(s.memo||''),margin+10,noteY+22,14);const footY=noteY+54,fw=(W-margin*2)/3;[`出荷元：${src.name||''}`,'受注・配送指示：','FAX送信欄：'].forEach((v,i)=>{box(margin+i*fw,footY,fw,42);text(v,margin+i*fw+8,footY+21,13)});
 return canvas;
}

function _canvasJpegBytes(canvas){return new Promise((resolve,reject)=>canvas.toBlob(async b=>{if(!b)return reject(new Error('PDF画像の作成に失敗しました。'));resolve(new Uint8Array(await b.arrayBuffer()))},'image/jpeg',0.94));}
function _concatBytes(parts){let n=parts.reduce((a,b)=>a+b.length,0),o=new Uint8Array(n),p=0;for(const b of parts){o.set(b,p);p+=b.length}return o}
function _ascii(s){return new TextEncoder().encode(s)}
async function _shipmentPdfBlob(s){
 const years=[...new Set(s.lines.map(l=>l.year||DEFAULT_YEAR))].sort((a,b)=>YEARS.indexOf(a)-YEARS.indexOf(b));const imgs=[];for(const y of years){const c=_shipmentCanvasPage(s,y);imgs.push({bytes:await _canvasJpegBytes(c),w:c.width,h:c.height})}
 const objs=[];const pageIds=[],imgIds=[],contentIds=[];let id=1;const catalogId=id++,pagesId=id++;
 years.forEach(()=>{pageIds.push(id++);imgIds.push(id++);contentIds.push(id++)});const objCount=id-1;
 objs[catalogId]=_ascii(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
 objs[pagesId]=_ascii(`<< /Type /Pages /Count ${years.length} /Kids [${pageIds.map(x=>x+' 0 R').join(' ')}] >>`);
 for(let i=0;i<years.length;i++){
  const im=imgs[i],pageId=pageIds[i],imgId=imgIds[i],contentId=contentIds[i];
  objs[pageId]=_ascii(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im0 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  objs[imgId]=_concatBytes([_ascii(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`),im.bytes,_ascii('\nendstream')]);
  const stream='q\n841.89 0 0 595.28 0 0 cm\n/Im0 Do\nQ\n';objs[contentId]=_ascii(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
 }
 const parts=[_ascii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offsets=Array(objCount+1).fill(0);let pos=parts[0].length;
 for(let i=1;i<=objCount;i++){offsets[i]=pos;const a=_ascii(`${i} 0 obj\n`),b=objs[i],c=_ascii('\nendobj\n');parts.push(a,b,c);pos+=a.length+b.length+c.length}
 const xrefPos=pos;let xref=`xref\n0 ${objCount+1}\n0000000000 65535 f \n`;for(let i=1;i<=objCount;i++)xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';xref+=`trailer\n<< /Size ${objCount+1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
 parts.push(_ascii(xref));return new Blob(parts,{type:'application/pdf'});
}
// iPhone/Safari: child PDF/FAX preview cannot access top-level const state through window.opener.
// Expose a narrow bridge that resolves the shipment inside the main app window.
window._shipmentPdfBlobById=async function(id){
 const ship=state.shipments.find(x=>x.id===id);
 if(!ship)throw new Error('出荷指示データが見つかりません。');
 return _shipmentPdfBlob(ship);
};

async function openShipmentPdfDirect(id){
 const s=state.shipments.find(x=>x.id===id);
 if(!s)return alert('出荷指示データが見つかりません。');
 // Open the destination tab synchronously from the user's tap so iPhone/Safari does not block it.
 const w=window.open('about:blank','_blank');
 if(!w)return alert('PDF表示用の画面を開けませんでした。Safariのポップアップ設定を確認してください。');
 try{
  w.document.write('<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>出荷指示書 PDF作成中</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:32px;text-align:center"><h3>A4横向きPDFを作成しています…</h3><p>そのままお待ちください。</p></body></html>');
  w.document.close();
  const blob=await _shipmentPdfBlob(s);
  const url=URL.createObjectURL(blob);
  // Open the actual landscape PDF immediately. No second "create PDF" button is required.
  w.location.replace(url);
  // Keep the URL alive long enough for iOS/Safari's PDF viewer and share/print actions.
  setTimeout(()=>URL.revokeObjectURL(url),10*60*1000);
 }catch(e){
  try{w.document.open();w.document.write('<meta name="viewport" content="width=device-width"><div style="font-family:-apple-system;padding:30px"><h3>PDF作成に失敗しました。</h3><p>'+String(e&&e.message?e.message:e).replace(/[&<>]/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]})+'</p><button onclick="window.close()" style="font-size:16px;padding:10px 16px">元の画面に戻る</button></div>');w.document.close()}catch(_e){}
 }
}

function printShipment(id){
 const s=state.shipments.find(x=>x.id===id);if(!s)return;const cols=allItems();const printYears=[...new Set(s.lines.map(l=>l.year||DEFAULT_YEAR))].sort((a,b)=>YEARS.indexOf(a)-YEARS.indexOf(b));const seasons=[...new Set(s.lines.map(x=>x.season))].join('・');
 const rows=printYears.flatMap(y=>state.coops.flatMap(c=>{const seasonRows=SEASONS.map((season,si)=>{const lns=s.lines.filter(x=>(x.year||DEFAULT_YEAR)===y&&x.coop===c&&x.season===season);const rowTotal=lns.reduce((a,x)=>a+Number(x.qty||0),0);return `<tr><th>${si===0?esc(y)+'年産':''}</th><th class="coop">${si===0?esc(c):''}</th><th class="season">${esc(season)}</th>${cols.map(ci=>`<td>${fmtBlankZero(lns.filter(x=>x.group===ci.group&&x.item===ci.item).reduce((a,x)=>a+Number(x.qty||0),0))}</td>`).join('')}<td>${fmtBlankZero(rowTotal)}</td></tr>`});const cl=s.lines.filter(x=>(x.year||DEFAULT_YEAR)===y&&x.coop===c);const subtotal=`<tr class="total ship-subtotal"><th></th><th></th><th>小計</th>${cols.map(ci=>`<td>${fmtBlankZero(cl.filter(x=>x.group===ci.group&&x.item===ci.item).reduce((a,x)=>a+Number(x.qty||0),0))}</td>`).join('')}<td>${fmtBlankZero(cl.reduce((a,x)=>a+Number(x.qty||0),0))}</td></tr>`;return [...seasonRows,subtotal]})).join('');
 const w=window.open('','_blank');if(!w)return alert('ポップアップがブロックされました。Safariのポップアップ設定を確認してください。');
 w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>出荷指示書 ${esc(s.id)}</title><style>@page{size:297mm 210mm;margin:8mm}html,body{width:281mm;min-height:194mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif;color:#000;margin:0;font-size:9px}.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #000;padding-bottom:4px}.title{font-size:22px;font-weight:700;letter-spacing:5px}.meta{text-align:right;line-height:1.6}.info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:7px 0}.box{border:1px solid #000;padding:5px;min-height:25px}.label{font-weight:700}.table{width:100%;border-collapse:collapse;table-layout:fixed}.table th,.table td{border:.45px solid #333;padding:2px;text-align:center;height:19px;font-weight:400;overflow:hidden;white-space:nowrap}.table td{font-size:13px}.table tbody tr:nth-child(4n) th,.table tbody tr:nth-child(4n) td{border-bottom:1.6px solid #111;font-weight:400}.table thead th{background:#eee}.table .coop{width:55px}.table .season{width:24px}.foot{display:grid;grid-template-columns:1fr 2fr 1fr;margin-top:8px;gap:8px}.sign{height:38px;border:1px solid #000;padding:5px}.ship-subtotal th,.ship-subtotal td{font-size:10px!important;font-weight:400!important;border-left-color:transparent!important;border-right-color:transparent!important}.ship-subtotal th:first-child{border-left-color:#333!important}.ship-subtotal td:last-child{border-right-color:#333!important}.total{font-weight:400}.note{margin-top:6px;border:1px solid #000;padding:5px;min-height:28px}button{padding:10px 16px;font-size:16px}</style></head><body><div id="sheet"><div class="head"><div class="title">出 荷 指 示 書</div><div class="meta">指示番号：${esc(s.id)}<br>作成日：${esc(today())}</div></div><div class="info"><div class="box"><span class="label">出荷先：</span>${esc(shipmentDest(s).name)} 御中<br>住所：${esc(shipmentDest(s).address)}<br>電話：${esc(shipmentDest(s).phone)}</div><div class="box"><span class="label">出荷元：</span>${esc(shipmentSource(s).name)}<br>住所：${esc(shipmentSource(s).address)}<br>電話：${esc(shipmentSource(s).phone)}</div><div class="box"><span class="label">出荷日：</span>${esc(s.shipDate||'')}<br><span class="label">希望着日：</span>${esc(s.arrivalDate||'')}</div></div><div class="box" style="margin-bottom:6px"><span class="label">生産年度：</span>${esc(printYears.map(y=>y+'年産').join('・'))}　　<span class="label">区分：</span>${esc(seasons)}　　<span class="label">合計：</span>${fmt(s.lines.reduce((a,l)=>a+Number(l.qty||0),0))}</div><table class="table"><thead><tr><th rowspan="2">生産年度</th><th class="coop" rowspan="2">組合名</th><th class="season" rowspan="2">区分</th>${GROUPS.map(g=>`<th colspan="${g.items.length}">${esc(g.name)}</th>`).join('')}<th rowspan="2">計</th></tr><tr>${GROUPS.map(g=>g.items.map(i=>`<th>${esc(i)}</th>`).join('')).join('')}</tr></thead><tbody>${rows}</tbody><tfoot><tr class="total"><th colspan="3">合計</th>${cols.map(ci=>`<td>${fmtBlankZero(s.lines.filter(l=>l.group===ci.group&&l.item===ci.item).reduce((a,x)=>a+Number(x.qty||0),0))}</td>`).join('')}<td>${fmtBlankZero(s.lines.reduce((a,l)=>a+Number(l.qty||0),0))}</td></tr></tfoot></table><div class="note"><b>備考：</b>${esc(s.memo||'')}${s.lines.some(l=>l.memo)?'　明細備考：'+esc(s.lines.filter(l=>l.memo).map(l=>l.memo).join('／')):''}</div><div class="foot"><div class="sign">出荷元：${esc(shipmentSource(s).name)}</div><div class="sign">受注・配送指示：</div><div class="sign">FAX送信欄：</div></div></div><div style="margin-top:12px;text-align:center;display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button id="printPdfBtn" type="button">横向きPDFを作成</button><button id="returnBtn" type="button">元の画面に戻る</button><div id="msg" style="width:100%;font-size:13px;color:#627d98">PDF自体をA4横向きで作成するため、iPhoneの印刷方向設定に左右されません。</div></div><script>(function(){var p=document.getElementById('printPdfBtn'),r=document.getElementById('returnBtn'),m=document.getElementById('msg');if(p)p.onclick=async function(){var pw=window.open('about:blank','_blank');if(!pw){alert('PDF表示用の画面を開けませんでした。Safariのポップアップ設定を確認してください。');return;}pw.document.write('<meta name="viewport" content="width=device-width"><div style="font-family:-apple-system;padding:30px;text-align:center">A4横向きPDFを作成しています…</div>');p.disabled=true;p.textContent='作成中…';m.textContent='横向きPDFを生成しています。';try{var opener=window.opener;if(!opener||!opener._shipmentPdfBlobById)throw new Error('PDF作成機能を呼び出せませんでした。');var blob=await opener._shipmentPdfBlobById(${JSON.stringify(s.id)});var url=URL.createObjectURL(blob);pw.location.replace(url);m.textContent='A4横向きPDFを開きました。PDF画面から共有・印刷してください。';}catch(e){try{pw.close()}catch(_e){}alert('横向きPDFを作成できませんでした。\\n'+(e&&e.message?e.message:e));m.textContent='PDF作成に失敗しました。';}finally{p.disabled=false;p.textContent='横向きPDFを作成';}};if(r)r.onclick=function(){if(window.opener){window.close()}else{history.back()}}})();<\/script></body></html>`);w.document.close();setTimeout(()=>w.focus(),300);
}
/* ナビ・その他を更新 */
const homeNavBtnEl=document.getElementById('homeNavBtn');
const shipNavBtnEl=document.getElementById('shipNavBtn');
const stockNavBtnEl=document.getElementById('stockNavBtn');
const logsNavBtnEl=document.getElementById('logsNavBtn');
const inNavBtnEl=document.getElementById('inNavBtn');
const moreBtnEl=document.getElementById('moreBtn');


/* 出荷機能の安全性・復元対応 */
const _backupV4=backup;
backup=function(){download('昆布在庫管理_業務バックアップ_'+today()+'.json',JSON.stringify({app:'昆布在庫管理',version:5,groups:GROUPS,seasons:SEASONS,years:YEARS,exportedAt:new Date().toISOString(),...state},null,2),'application/json;charset=utf-8')};
restore=function(file){if(!file)return;const fr=new FileReader();fr.onload=()=>{try{const d=JSON.parse(fr.result);if(!Array.isArray(d.records)||!Array.isArray(d.coops))throw Error();if(!confirm('現在のデータをバックアップ内容に置き換えます。よろしいですか？'))return;state={records:d.records.map(r=>({...r,year:YEARS.includes(r.year)?r.year:DEFAULT_YEAR})),coops:d.coops,shipments:Array.isArray(d.shipments)?d.shipments.map(s=>({...s,baseYear:YEARS.includes(s.baseYear)?s.baseYear:(Array.isArray(s.lines)&&YEARS.includes(s.lines[0]?.year)?s.lines[0].year:DEFAULT_YEAR),lines:Array.isArray(s.lines)?s.lines.map(l=>({...l,year:YEARS.includes(l.year)?l.year:DEFAULT_YEAR})):[]})):[],shipmentSeq:Number(d.shipmentSeq||1),pdfImports:Array.isArray(d.pdfImports)?d.pdfImports:[],companies:Array.isArray(d.companies)?d.companies:[{name:'㈱浜中運輸',address:'',phone:''}],activeYear:YEARS.includes(d.activeYear)?d.activeYear:DEFAULT_YEAR};save();alert('復元しました');home()}catch(e){alert('バックアップを読み込めませんでした')}};fr.readAsText(file)};
const _shipmentDetailOriginal=shipmentDetail;
shipmentDetail=function(id){
  _shipmentDetailOriginal(id);
  const s=state.shipments.find(x=>x.id===id); if(!s||s.status!=='confirmed') return;
  const btn=document.getElementById('shipped'); if(!btn)return;
  btn.onclick=()=>{
  for(const l of s.lines){
  const inv=window.KombuRefactor?.Inventory;

  const av=inv?.getAvailableQuantity
    ? inv.getAvailableQuantity(
        'kushiro',
        {
          year:l.year||DEFAULT_YEAR,
          coop:l.coop,
          season:l.season,
          group:l.group,
          item:l.item
        },
        s.id
      )
    : available(
        l.year||DEFAULT_YEAR,
        l.coop,
        l.season,
        l.group,
        l.item
      );

  if(Number(l.qty)>Math.max(0,Number(av||0))){
    return alert(`${l.coop} ${l.season} ${l.group} ${l.item} の出荷可能在庫が不足しています。`);
  }
}
    if(!confirm('出荷済みにすると、明細数量を在庫から出庫します。よろしいですか？'))return;
    for(const l of s.lines){state.records.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),type:'out',year:l.year||DEFAULT_YEAR,coop:l.coop,season:l.season,group:l.group,item:l.item,qty:Number(l.qty),date:s.shipDate||today(),memo:`出荷指示 ${s.id} / ${s.dest}`})}
    s.status='shipped';s.shippedAt=new Date().toISOString();save();alert('出荷済みとして在庫から減算しました');shipmentDetail(s.id);
  };
};

/* ===== v33: 釧路産昆布 / 日高昆布 / 根室産昆布 / 釧路産棹前昆布 四系統管理 ===== */
let currentProduct=null;
const H_KEY='kombu_hidaka_local_v1';
const H_YEARS=['R2','R3','R4','R5','R6','R7','R8','R9','R10'];
const H_LOCATIONS=['井寒台','平宇','冬島','近笛','東栄','浦河','様似','本幌','歌別','三石','歌露','春立','荻伏','東洋','静内','門別','岬','庶野','新冠','富浜','厚賀'];
const H_SECTIONS=[
 {name:'走り',items:['1等','2等','3等','(尺)4等','(白)4等','4等','(尺)5等','(白)5等','5等','白1等','白2等']},
 {name:'后採',items:['1等','2等','3等','(尺)4等','4等','(尺)5等','5等']},
 {name:'拾い',items:['1等','2等','3等','(尺)4等','4等','(尺)5等','5等']},
 {name:'雑',items:['加1等','加2等','加3等','加拾1等','加拾2等','加水2等','海洋1等','海洋2等','海洋3等']}
];
let hState=JSON.parse(localStorage.getItem(H_KEY)||'null')||{records:[],shipments:[],shipmentSeq:1,activeYear:'R7',pdfImports:[],companies:[]};
hState.records=Array.isArray(hState.records)?hState.records:[];hState.shipments=Array.isArray(hState.shipments)?hState.shipments:[];hState.pdfImports=Array.isArray(hState.pdfImports)?hState.pdfImports:[];hState.shipmentSeq=Number(hState.shipmentSeq||1);hState.activeYear=H_YEARS.includes(hState.activeYear)?hState.activeYear:'R7';
function hSave(){localStorage.setItem(H_KEY,JSON.stringify(hState))}
function hKey(r){return [r.year,r.location,r.section,r.grade].join('|')}
function hMatrix(){const m={};hState.records.forEach(r=>{const k=hKey(r);m[k]=(m[k]||0)+(r.type==='out'?-Number(r.qty):Number(r.qty))});hState.shipments.filter(s=>s.status==='confirmed').flatMap(s=>s.lines||[]).forEach(l=>{const k=hKey(l);m[k]=(m[k]||0)-Number(l.qty||0)});return m}
function hTotal(y=hState.activeYear){const m=hMatrix();return Object.entries(m).filter(([k])=>k.startsWith(y+'|')).reduce((a,[,v])=>a+v,0)}
function hAvail(y,loc,sec,grade,excludeId){const physical=hState.records.filter(r=>r.year===y&&r.location===loc&&r.section===sec&&r.grade===grade).reduce((a,r)=>a+(r.type==='out'?-Number(r.qty):Number(r.qty)),0);const res=hState.shipments.filter(s=>s.id!==excludeId&&s.status==='confirmed').flatMap(s=>s.lines||[]).filter(l=>l.year===y&&l.location===loc&&l.section===sec&&l.grade===grade).reduce((a,l)=>a+Number(l.qty||0),0);return Math.max(0,physical-res)}
function hYearOptions(sel){return H_YEARS.map(y=>`<option ${y===(sel||hState.activeYear)?'selected':''}>${y}</option>`).join('')}
function hGradeOptions(section,grade){return H_SECTIONS.map(s=>`<optgroup label="${s.name}">${s.items.map(g=>`<option value="${esc(s.name)}|${esc(g)}" ${s.name===section&&g===grade?'selected':''}>${esc(g)}</option>`).join('')}</optgroup>`).join('')}
function setHeader(t){const h=document.querySelector('header');if(h)h.textContent=t}
function setNavVisible(v){const n=document.querySelector('nav');if(n)n.style.display=v?'flex':'none'}
function bindNav(){
 if(shipNavBtnEl)shipNavBtnEl.onclick=()=>currentProduct==='hidaka'?hShipments():currentProduct==='nemuro'?nShipments():currentProduct==='sanmae'?smShipments():shipments();
 if(stockNavBtnEl)stockNavBtnEl.onclick=()=>currentProduct==='hidaka'?hStock():currentProduct==='nemuro'?nStock():currentProduct==='sanmae'?smStock():stock();
 if(logsNavBtnEl)logsNavBtnEl.onclick=()=>currentProduct==='hidaka'?hLogs():currentProduct==='nemuro'?nLogs():currentProduct==='sanmae'?smLogs():logs();
 if(inNavBtnEl)inNavBtnEl.onclick=()=>currentProduct==='hidaka'?hForm('in'):currentProduct==='nemuro'?nForm('in'):currentProduct==='sanmae'?smForm('in'):form('in');
 if(moreBtnEl)moreBtnEl.onclick=()=>currentProduct==='hidaka'?hMore():currentProduct==='nemuro'?nMore():currentProduct==='sanmae'?smMore():exportsPage();
}
function productLanding(){currentProduct=null;setHeader('昆布在庫管理');setNavVisible(false);app.innerHTML=`<section class="card" style="margin-top:22px"><h2>管理する昆布を選択 <span style="font-size:12px;font-weight:700;background:#e8eef6;padding:4px 8px;border-radius:999px;vertical-align:middle">v36</span></h2><p class="muted">4種類の昆布は、在庫・入出庫履歴・出荷指示をそれぞれ別に管理します。</p><div class="grid" style="margin-top:16px"><button class="action orange" id="chooseK"><b style="font-size:20px">釧路産昆布</b><small>在庫管理・PDF入庫・出荷指示</small></button><button class="action green" id="chooseH"><b style="font-size:20px">日高昆布</b><small>日高昆布専用の在庫管理・PDF入庫・出荷指示</small></button><button class="action blue" id="chooseN"><b style="font-size:20px">根室産昆布</b><small>根室産昆布専用の在庫管理・PDF入庫・出荷指示</small></button><button class="action purple" id="chooseS"><b style="font-size:20px">釧路産棹前昆布</b><small>棹前昆布専用の在庫管理・PDF入庫・出荷指示</small></button></div></section>`;document.getElementById('chooseK').onclick=()=>{currentProduct='kushiro';setHeader('釧路産昆布 在庫管理');setNavVisible(true);bindNav();home()};document.getElementById('chooseH').onclick=()=>{currentProduct='hidaka';setHeader('日高昆布 在庫管理');setNavVisible(true);bindNav();hHome()};document.getElementById('chooseN').onclick=()=>{currentProduct='nemuro';setHeader('根室産昆布 在庫管理');setNavVisible(true);bindNav();nHome()};document.getElementById('chooseS').onclick=()=>{currentProduct='sanmae';setHeader('釧路産棹前昆布 在庫管理');setNavVisible(true);bindNav();smHome()}}
function hHome(){const y=hState.activeYear;app.innerHTML=`<section class="card"><div class="row"><h2>日高昆布 在庫状況</h2><select id="hy" style="width:auto">${hYearOptions(y)}</select></div><div class="stats"><div class="stat">${y}年産 総在庫<b>${fmt(hTotal(y))}</b></div><div class="stat">産地欄数<b>${H_LOCATIONS.length}</b></div><div class="stat">区分数<b>${H_SECTIONS.length}</b></div><div class="stat">登録履歴<b>${hState.records.filter(r=>r.year===y).length}件</b></div></div></section><section class="grid"><button class="action" id="hs" style="border-left:6px solid #e05a47">📦 出荷指示<small>日高昆布専用</small></button><button class="action orange" id="hst">▦ 在庫表<small>原票形式で集計</small></button><button class="action purple" id="hl">≡ 入出庫履歴<small>修正・削除</small></button><button class="action green" id="hi">↓ 入庫登録<small>PDFから一括入庫も可能</small></button><button class="action blue" id="ho">↑ 出庫登録<small>在庫から減算</small></button><button class="action gray" id="hm">⋯ その他<small>バックアップ・商品選択</small></button></section>`;hy.onchange=()=>{hState.activeYear=hy.value;hSave();hHome()};hs.onclick=hShipments;hst.onclick=hStock;hl.onclick=hLogs;hi.onclick=()=>hForm('in');ho.onclick=()=>hForm('out');hm.onclick=hMore}
function hForm(type,editId=null){const r=editId?hState.records.find(x=>x.id===editId):null,ft=r?.type||type||'in',sec=r?.section||'走り',grade=r?.grade||'1等';app.innerHTML=`<section class="card"><h2>${r?'入出庫修正':ft==='in'?'日高昆布 入庫登録':'日高昆布 出庫登録'}</h2><div class="form">${!r&&ft==='in'?'<button class="btn secondary" id="hPdfBtn">📄 52ページPDFから日高昆布を入庫</button><input id="hPdfFile" type="file" accept="application/pdf,.pdf" hidden>':''}<label>区分<div class="note">${ft==='in'?'入庫':'出庫'}</div></label><label>生産年度<select id="hyr">${hYearOptions(r?.year)}</select></label><label>産地<select id="hloc">${H_LOCATIONS.map(x=>`<option ${x===r?.location?'selected':''}>${x}</option>`).join('')}</select></label><label>区分・等級<select id="hgi">${hGradeOptions(sec,grade)}</select></label><label>数量<input id="hq" type="number" min="0" step="0.01" value="${r?esc(r.qty):''}"></label><label>日付<input id="hd" type="date" value="${r?.date||today()}"></label><label>備考<input id="hmem" value="${esc(r?.memo||'')}"></label><button class="btn" id="hsv">${r?'修正を保存':'登録する'}</button><button class="btn secondary" id="hb">戻る</button></div></section>`;if(!r&&ft==='in'){hPdfBtn.onclick=()=>hPdfFile.click();hPdfFile.onchange=()=>{const f=hPdfFile.files?.[0];if(f)hImportPdf(f)}}hsv.onclick=()=>{const q=Number(hq.value);if(!q||q<0)return alert('数量を入力してください');const [section,grade]=hgi.value.split('|'),year=hyr.value,location=hloc.value;if(ft==='out'&&q>hAvail(year,location,section,grade,r?.id))return alert('出庫可能在庫が不足しています。');const obj={id:r?.id||(crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())),type:ft,year,location,section,grade,qty:q,date:hd.value,memo:hmem.value};if(r)hState.records[hState.records.findIndex(x=>x.id===r.id)]=obj;else hState.records.push(obj);hState.activeYear=year;hSave();alert(r?'修正しました':ft==='in'?'入庫しました':'出庫しました');hStock()};hb.onclick=()=>r?hLogs():hHome()}
async function hParsePdf(file){if(!PDFJS)throw Error('PDF読取ライブラリを読み込めません。');PDFJS.GlobalWorkerOptions.workerSrc='./pdf-worker-v58.js';const pdf=await PDFJS.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;const rows=[];let date=today(),matched=[];const expected=H_SECTIONS.flatMap(s=>s.items.map(g=>({section:s.name,grade:g})));for(let pn=1;pn<=pdf.numPages;pn++){const pg=await pdf.getPage(pn),vp=pg.getViewport({scale:1}),tc=await pg.getTextContent();const its=tc.items.filter(x=>String(x.str||'').trim()).map(x=>({str:String(x.str).trim(),x:+x.transform[4],y:+x.transform[5],w:+(x.width||0)}));const txt=its.map(x=>x.str).join('');const norm=txt.replace(/\s/g,'').replace(/[Ｒｒ]/g,'R');if(!norm.includes('日高産昆布'))continue;const ym=norm.match(/R\.?\s*(10|[2-9])年度?/i),year=ym?`R${ym[1]}`:'R7';date=reiwaDateFromText(txt);const labelItems=its.filter(x=>x.x<115).filter(x=>expected.some(e=>e.grade===x.str)).sort((a,b)=>b.y-a.y);let ei=0;for(const li of labelItems){if(ei>=expected.length)break;let found=-1;for(let k=ei;k<Math.min(expected.length,ei+5);k++)if(expected[k].grade===li.str){found=k;break}if(found<0)continue;ei=found+1;const meta=expected[found];its.forEach(it=>{if(Math.abs(it.y-li.y)>3.4||!/^-?\d[\d,.-]*$/.test(it.str))return;const cx=it.x+(it.w||0)/2;if(cx<114||cx>768)return;const idx=Math.round((cx-130.4)/31.08);if(idx<0||idx>=H_LOCATIONS.length)return;const center=130.4+idx*31.08;if(Math.abs(cx-center)>15.5)return;const q=Number(it.str.replace(/,/g,'').replace(/[^0-9.-]/g,''));if(!Number.isFinite(q)||q<=0)return;rows.push({year,location:H_LOCATIONS[idx],section:meta.section,grade:meta.grade,qty:q,page:pn})})}matched.push(pn)}if(!rows.length)throw Error('日高産昆布の数量を読み取れませんでした。');const agg=new Map();rows.forEach(r=>{const k=[r.year,r.location,r.section,r.grade].join('|'),o=agg.get(k)||{...r,qty:0,pages:[]};o.qty+=r.qty;if(!o.pages.includes(r.page))o.pages.push(r.page);agg.set(k,o)});return {rows:[...agg.values()],date,matched,pageCount:pdf.numPages,years:[...new Set(rows.map(r=>r.year))]}}
async function hImportPdf(file){try{app.innerHTML='<section class="card"><h2>日高昆布 PDF読込中</h2><p>52ページPDFから「日高産昆布」のページだけを抽出しています…</p></section>';const parsed=await hParsePdf(file);const sum=parsed.rows.reduce((a,r)=>a+r.qty,0);app.innerHTML=`<section class="card"><h2>日高昆布 PDF入庫確認</h2><div class="stats"><div class="stat">対象ページ<b>${parsed.matched.join(', ')}</b></div><div class="stat">生産年度<b>${parsed.years.join('・')}</b></div><div class="stat">明細<b>${parsed.rows.length}件</b></div><div class="stat">合計<b>${fmt(sum)}</b></div></div><div class="note">「日高産昆布」のページだけを抽出し、生産年度・産地・走り/后採/拾い/雑・等級ごとに合算しました。</div><div class="toolbar" style="margin-top:12px"><button class="btn" id="hc">一括入庫</button><button class="btn secondary" id="hcan">キャンセル</button></div></section>`;hc.onclick=()=>{parsed.rows.forEach(r=>hState.records.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),type:'in',year:r.year,location:r.location,section:r.section,grade:r.grade,qty:r.qty,date:parsed.date,memo:`PDF一括入庫：${file.name}`}));hState.activeYear=parsed.years.at(-1)||'R7';hState.pdfImports.push({fileName:file.name,date:parsed.date,years:parsed.years,pages:parsed.matched,importedAt:new Date().toISOString()});hSave();alert(`${parsed.rows.length}件、合計${fmt(sum)}を入庫しました。`);hStock()};hcan.onclick=()=>hForm('in')}catch(e){alert('PDFを読み込めませんでした。\n'+(e.message||e));hForm('in')}}
function hStock(){const y=hState.activeYear,m=hMatrix(),rows=H_SECTIONS.flatMap(s=>s.items.map(g=>({section:s.name,grade:g})));let h=`<section class="card"><div class="row"><h2>日高昆布 在庫集計表</h2><select id="hsy">${hYearOptions(y)}</select></div><div class="toolbar"><button class="btn" id="hspdf">PDF出力</button><button class="btn secondary" id="hsh">ホーム</button></div><div class="tablewrap" style="margin-top:12px"><table class="stock-report" style="min-width:1850px"><tr><th>区分</th><th>等級</th>${H_LOCATIONS.map(l=>`<th>${l}</th>`).join('')}<th>計</th></tr>`;let last=null;for(const r of rows){const isStart=r.section!==last;h+=`<tr ${isStart?'style="border-top:1.6px solid #111"':''}><td>${isStart?r.section:''}</td><td>${r.grade}</td>`;let rt=0;for(const loc of H_LOCATIONS){const q=m[[y,loc,r.section,r.grade].join('|')]||0;rt+=q;h+=`<td style="font-size:15.5px">${q?fmt(q):''}</td>`}h+=`<td>${rt?fmt(rt):''}</td></tr>`;last=r.section}h+=`<tr style="border-top:1.6px solid #111"><th colspan="2">合計</th>${H_LOCATIONS.map(loc=>{const q=rows.reduce((a,r)=>a+(m[[y,loc,r.section,r.grade].join('|')]||0),0);return `<th>${q?fmt(q):''}</th>`}).join('')}<th>${hTotal(y)?fmt(hTotal(y)):''}</th></tr></table></div><p class="muted">0は空欄表示。確定済み出荷指示数量を差し引いた利用可能在庫です。</p></section>`;app.innerHTML=h;hsy.onchange=()=>{hState.activeYear=hsy.value;hSave();hStock()};hsh.onclick=hHome;hspdf.onclick=()=>hOpenStockPdf(y)}
function hStockCanvas(y){const W=1684,H=1191,m=35,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);x.strokeStyle='#222';x.fillStyle='#000';const font=(z,b=false)=>`${b?'700 ':'400 '}${z}px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif`;const txt=(t,xx,yy,z=14,a='center',b=false)=>{x.font=font(z,b);x.textAlign=a;x.textBaseline='middle';x.fillText(String(t??''),xx,yy)};const rows=H_SECTIONS.flatMap(s=>s.items.map(g=>({section:s.name,grade:g}))),mt=hMatrix();txt('日 高 昆 布　在 庫 集 計 表',m,45,30,'left',true);txt(`${y}年産`,W-m,45,18,'right',true);const tx=m,ty=80,tw=W-m*2,secW=70,gradeW=95,totalW=60,colW=(tw-secW-gradeW-totalW)/H_LOCATIONS.length,rowH=26,headH=48; x.lineWidth=.55;x.strokeRect(tx,ty,tw,headH+rows.length*rowH+32);[tx+secW,tx+secW+gradeW,tx+tw-totalW].forEach(xx=>{x.beginPath();x.moveTo(xx,ty);x.lineTo(xx,ty+headH+rows.length*rowH+32);x.stroke()});const shHead=!!window.__v63ShipmentHeaderLarge;txt('区分',tx+secW/2,ty+headH/2,shHead?17:13);txt('等級',tx+secW+gradeW/2,ty+headH/2,shHead?17:13);H_LOCATIONS.forEach((l,i)=>{const xx=tx+secW+gradeW+i*colW;x.beginPath();x.moveTo(xx,ty);x.lineTo(xx,ty+headH+rows.length*rowH+32);x.stroke();txt(l,xx+colW/2,ty+headH/2,shHead?18:10)});txt('計',tx+tw-totalW/2,ty+headH/2,shHead?16:12);let yy=ty+headH,last=null;rows.forEach(r=>{if(r.section!==last){x.lineWidth=1.6;x.beginPath();x.moveTo(tx,yy);x.lineTo(tx+tw,yy);x.stroke();x.lineWidth=.55}if(r.section!==last){const sectionY=window.__v59HidakaSectionCentered?yy+rowH*(H_SECTIONS.find(z=>z.name===r.section)?.items.length||1)/2:yy+rowH/2;txt(r.section,tx+secW/2,sectionY,12)}txt(r.grade,tx+secW+gradeW/2,yy+rowH/2,11);let rt=0;H_LOCATIONS.forEach((l,i)=>{const q=mt[[y,l,r.section,r.grade].join('|')]||0,xx=tx+secW+gradeW+i*colW;rt+=q;x.beginPath();x.moveTo(xx,yy);x.lineTo(xx,yy+rowH);x.stroke();if(q)txt(fmt(q),xx+colW/2,yy+rowH/2,shHead?18:14)});if(rt)txt(fmt(rt),tx+tw-totalW/2,yy+rowH/2,shHead?18:14);x.beginPath();x.moveTo(tx,yy+rowH);x.lineTo(tx+tw,yy+rowH);x.stroke();yy+=rowH;last=r.section});x.lineWidth=1.6;x.beginPath();x.moveTo(tx,yy);x.lineTo(tx+tw,yy);x.stroke();x.lineWidth=.55;txt('合計',tx+(secW+gradeW)/2,yy+16,13,'center',true);H_LOCATIONS.forEach((l,i)=>{const q=rows.reduce((a,r)=>a+(mt[[y,l,r.section,r.grade].join('|')]||0),0);if(q)txt(fmt(q),tx+secW+gradeW+i*colW+colW/2,yy+16,shHead?21:13)});txt(fmt(hTotal(y)),tx+tw-totalW/2,yy+16,shHead?21:13);return c}
async function hOpenStockPdf(y){const w=window.open('about:blank','_blank');if(!w)return alert('PDF画面を開けません。');try{const b=await _singleCanvasPdfBlob(hStockCanvas(y)),u=URL.createObjectURL(b);w.location.replace(u);setTimeout(()=>URL.revokeObjectURL(u),600000)}catch(e){w.close();alert('PDF作成に失敗しました。')}}
function hLogs(){const a=hState.records.slice().reverse();app.innerHTML=`<section class="card"><h2>日高昆布 入出庫履歴</h2><div class="tablewrap"><table style="min-width:900px"><tr><th>日付</th><th>区分</th><th>年度</th><th>産地</th><th>区分</th><th>等級</th><th>数量</th><th>操作</th></tr>${a.map(r=>`<tr><td>${r.date}</td><td>${r.type==='in'?'入庫':'出庫'}</td><td>${r.year}</td><td>${r.location}</td><td>${r.section}</td><td>${r.grade}</td><td>${fmt(r.qty)}</td><td><button class="mini" data-he="${r.id}">修正</button> <button class="mini danger" data-hd="${r.id}">削除</button></td></tr>`).join('')}</table></div><button class="btn secondary" id="hlb">戻る</button></section>`;app.querySelectorAll('[data-he]').forEach(b=>b.onclick=()=>hForm(null,b.dataset.he));app.querySelectorAll('[data-hd]').forEach(b=>b.onclick=()=>{if(confirm('削除しますか？')){hState.records=hState.records.filter(r=>r.id!==b.dataset.hd);hSave();hLogs()}});hlb.onclick=hHome}
function hShipId(){return 'H'+String(hState.shipmentSeq++).padStart(5,'0')}
function hShipments(){app.innerHTML=`<section class="card"><div class="row"><h2>日高昆布 出荷指示</h2><button class="mini" id="hnew">＋新規</button></div><div class="tablewrap"><table><tr><th>番号</th><th>出荷元</th><th>出荷先</th><th>出荷日</th><th>数量</th><th>状態</th><th></th></tr>${hState.shipments.slice().reverse().map(s=>`<tr><td>${s.id}</td><td>${esc(s.source?.name||'')}</td><td>${esc(s.dest?.name||'')}</td><td>${s.shipDate||''}</td><td>${fmt((s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0))}</td><td>${s.status}</td><td><button class="mini" data-hs="${s.id}">開く</button></td></tr>`).join('')}</table></div><button class="btn secondary" id="hsb">戻る</button></section>`;hnew.onclick=()=>hShipForm();app.querySelectorAll('[data-hs]').forEach(b=>b.onclick=()=>hShipDetail(b.dataset.hs));hsb.onclick=hHome}
function hShipForm(id=null){const s=id?hState.shipments.find(x=>x.id===id):null;let lines=s?.lines?.map(x=>({...x}))||[];app.innerHTML=`<section class="card"><h2>日高昆布 ${s?'出荷指示修正':'新規出荷指示'}</h2><div class="form"><label>出荷元 会社名<input id="hsrc" value="${esc(s?.source?.name||'㈱浜中運輸')}"></label><label>出荷元 住所<input id="hsrca" value="${esc(s?.source?.address||'')}"></label><label>出荷元 電話<input id="hsrcp" value="${esc(s?.source?.phone||'')}"></label><label>出荷先 会社名<input id="hdst" value="${esc(s?.dest?.name||'')}"></label><label>出荷先 住所<input id="hdsta" value="${esc(s?.dest?.address||'')}"></label><label>出荷先 電話<input id="hdstp" value="${esc(s?.dest?.phone||'')}"></label><div class="subgrid"><label>出荷日<input id="hsd" type="date" value="${s?.shipDate||today()}"></label><label>希望着日<input id="had" type="date" value="${s?.arrivalDate||''}"></label></div><div id="hsl"></div><button class="btn secondary" id="hala">＋明細追加</button><button class="btn" id="hssv">保存</button><button class="btn secondary" id="hsfb">戻る</button></div></section>`;function rend(){hsl.innerHTML=lines.map((l,i)=>`<div class="card" style="background:#f8fafc"><label>年度<select data-hi="${i}" data-hf="year">${hYearOptions(l.year)}</select></label><label>産地<select data-hi="${i}" data-hf="location">${H_LOCATIONS.map(x=>`<option ${x===l.location?'selected':''}>${x}</option>`).join('')}</select></label><label>区分・等級<select data-hi="${i}" data-hf="sg">${hGradeOptions(l.section,l.grade)}</select></label><label>数量<input type="number" value="${esc(l.qty||'')}" data-hi="${i}" data-hf="qty"></label><button class="mini danger" data-hr="${i}">削除</button></div>`).join('');hsl.querySelectorAll('[data-hf]').forEach(e=>e.onchange=()=>{const i=+e.dataset.hi;if(e.dataset.hf==='sg'){[lines[i].section,lines[i].grade]=e.value.split('|')}else lines[i][e.dataset.hf]=e.value});hsl.querySelectorAll('[data-hr]').forEach(e=>e.onclick=()=>{lines.splice(+e.dataset.hr,1);rend()})}hala.onclick=()=>{lines.push({year:hState.activeYear,location:H_LOCATIONS[0],section:'走り',grade:'1等',qty:''});rend()};hssv.onclick=()=>{if(!hdst.value.trim()||!lines.length)return alert('出荷先と明細を入力してください。');for(const l of lines){l.qty=Number(l.qty);if(!l.qty||l.qty>hAvail(l.year,l.location,l.section,l.grade,s?.id))return alert(`${l.location} ${l.section} ${l.grade} の在庫が不足しています。`)}const o=s||{id:hShipId(),status:'draft',createdAt:new Date().toISOString()};Object.assign(o,{source:{name:hsrc.value,address:hsrca.value,phone:hsrcp.value},dest:{name:hdst.value,address:hdsta.value,phone:hdstp.value},shipDate:hsd.value,arrivalDate:had.value,lines});if(!s)hState.shipments.push(o);hSave();hShipDetail(o.id)};hsfb.onclick=hShipments;rend()}
function hShipDetail(id){const s=hState.shipments.find(x=>x.id===id);if(!s)return hShipments();app.innerHTML=`<section class="card"><div class="row"><h2>日高昆布 出荷指示 ${s.id}</h2><span class="pill">${s.status}</span></div><p><b>出荷先：</b>${esc(s.dest?.name||'')}　<b>出荷元：</b>${esc(s.source?.name||'')}</p><p><b>出荷日：</b>${s.shipDate||''}　<b>合計：</b>${fmt((s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0))}</p><div class="toolbar"><button class="btn" id="hpdfs">PDF・FAX用</button>${s.status==='draft'?'<button class="btn" id="hconf">確定・在庫反映</button><button class="btn secondary" id="hedit">修正</button>':''}${s.status==='confirmed'?'<button class="btn" id="hshipped">出荷済</button>':''}
${s.status!=='shipped'&&s.status!=='cancelled'?'<button class="btn danger" id="hcancel">取消</button>':''}
<button class="btn secondary" id="hback">一覧へ</button></div></section>`;const pdf=document.getElementById('hpdfs');if(pdf)pdf.onclick=()=>hOpenShipPdf(s);if(s.status==='draft'){const c=document.getElementById('hconf');if(c)c.onclick=()=>{for(const l of s.lines)if(Number(l.qty)>hAvail(l.year,l.location,l.section,l.grade,s.id))return alert('在庫不足があります。');s.status='confirmed';s.confirmedAt=new Date().toISOString();hSave();alert('出荷指示を確定し、在庫表へ反映しました。');hShipDetail(id)};const e=document.getElementById('hedit');if(e)e.onclick=()=>v114UnifiedShipmentForm('hidaka',id)}if(s.status==='confirmed'){
  const sh=document.getElementById('hshipped');

  if(sh)sh.onclick=()=>{
    const inv=window.KombuRefactor?.Inventory;

    for(const l of s.lines){
      const av=inv?.getHidakaAvailableQuantity
        ? inv.getHidakaAvailableQuantity(
            {
              year:l.year,
              location:l.location,
              section:l.section,
              grade:l.grade
            },
            s.id
          )
        : hAvail(
            l.year,
            l.location,
            l.section,
            l.grade,
            s.id
          );

      if(Number(l.qty)>Math.max(0,Number(av||0))){
        return alert(
          `${l.location} ${l.section} ${l.grade} の出荷可能在庫が不足しています。`
        );
      }
    }

    if(!window.confirm(
      '出荷済みにすると、明細数量を在庫から出庫します。よろしいですか？'
    ))return;

    s.lines.forEach(l=>
      hState.records.push({
        id:crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()+Math.random()),
        type:'out',
        year:l.year,
        location:l.location,
        section:l.section,
        grade:l.grade,
        qty:Number(l.qty),
        date:s.shipDate||today(),
        memo:`出荷指示 ${s.id}`
      })
    );

    s.status='shipped';
    s.shippedAt=new Date().toISOString();

    hSave();
    hShipDetail(id);
  };
}
const cancelBtn=document.getElementById('hcancel');

if(cancelBtn){
  cancelBtn.onclick=()=>{
    if(!window.confirm(
      s.status==='confirmed'
        ? '取消すると在庫表へ数量を戻します。よろしいですか？'
        : 'この出荷指示を取消しますか？'
    ))return;

    s.status='cancelled';
    s.cancelledAt=new Date().toISOString();

    hSave();
    alert('出荷指示を取消しました');
    hShipDetail(id);
  };
}const b=document.getElementById('hback');if(b)b.onclick=hShipments}
async function hOpenShipPdf(s){const w=window.open('about:blank','_blank');if(!w)return alert('PDF画面を開けません。');try{const ys=[...new Set(s.lines.map(l=>l.year))],imgs=[];for(const y of ys){const tmp={...hState};const mt={};s.lines.filter(l=>l.year===y).forEach(l=>mt[hKey(l)]=(mt[hKey(l)]||0)+Number(l.qty));const old=hMatrix;/* shipment canvas uses stock-style layout; values are overlaid by temporary state */const savedRecords=hState.records,savedShip=hState.shipments;hState.records=s.lines.filter(l=>l.year===y).map(l=>({...l,type:'in'}));hState.shipments=[];imgs.push(hShipCanvas(s,y));hState.records=savedRecords;hState.shipments=savedShip}const b=imgs.length===1?await _singleCanvasPdfBlob(imgs[0]):await (async()=>{const ims=[];for(const cc of imgs)ims.push({bytes:await _canvasJpegBytes(cc),w:cc.width,h:cc.height});const objs=[],pageIds=[],imgIds=[],contentIds=[];let id=1,catalog=id++,pages=id++;ims.forEach(()=>{pageIds.push(id++);imgIds.push(id++);contentIds.push(id++)});objs[catalog]=_ascii(`<< /Type /Catalog /Pages ${pages} 0 R >>`);objs[pages]=_ascii(`<< /Type /Pages /Count ${ims.length} /Kids [${pageIds.map(x=>x+' 0 R').join(' ')}] >>`);ims.forEach((im,i)=>{objs[pageIds[i]]=_ascii(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im0 ${imgIds[i]} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`);objs[imgIds[i]]=_concatBytes([_ascii(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`),im.bytes,_ascii('\nendstream')]);const st='q\n841.89 0 0 595.28 0 0 cm\n/Im0 Do\nQ\n';objs[contentIds[i]]=_ascii(`<< /Length ${st.length} >>\nstream\n${st}endstream`)});const n=id-1,parts=[_ascii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offs=Array(n+1).fill(0);let pos=parts[0].length;for(let i=1;i<=n;i++){offs[i]=pos;const a=_ascii(`${i} 0 obj\n`),bb=objs[i],cc=_ascii('\nendobj\n');parts.push(a,bb,cc);pos+=a.length+bb.length+cc.length}const xp=pos;let xr=`xref\n0 ${n+1}\n0000000000 65535 f \n`;for(let i=1;i<=n;i++)xr+=String(offs[i]).padStart(10,'0')+' 00000 n \n';xr+=`trailer\n<< /Size ${n+1} /Root ${catalog} 0 R >>\nstartxref\n${xp}\n%%EOF`;parts.push(_ascii(xr));return new Blob(parts,{type:'application/pdf'})})();const u=URL.createObjectURL(b);w.location.replace(u);setTimeout(()=>URL.revokeObjectURL(u),600000)}catch(e){try{w.close()}catch{}alert('PDF作成に失敗しました。\n'+(e.message||e))}}
function hMore(){app.innerHTML=`<section class="card"><h2>日高昆布 その他</h2><div class="form"><button class="btn secondary" id="hprod">← 昆布選択画面へ</button><button class="btn secondary" id="hbk">日高昆布バックアップ保存</button><input id="hrf" type="file" accept="application/json" hidden><button class="btn secondary" id="hrs">日高昆布バックアップ復元</button><button class="btn secondary" id="hhm">ホーム</button></div></section>`;hprod.onclick=productLanding;hbk.onclick=()=>download('日高昆布バックアップ_'+today()+'.json',JSON.stringify(hState,null,2),'application/json');hrs.onclick=()=>hrf.click();hrf.onchange=()=>{const f=hrf.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{hState=JSON.parse(rd.result);hSave();alert('復元しました');hHome()}catch{alert('復元できませんでした')}};rd.readAsText(f)};hhm.onclick=hHome}


/* ===== v32: 根室産昆布 独立管理 ===== */
const N_KEY='kombu_nemuro_local_v1';
const N_YEARS=['R3','R4','R5','R6','R7','R8','R9','R10'];
const N_COOPS=['歯舞漁協','落石漁協','根室漁協'];
const N_SEASONS=['夏','秋','拾'];
const N_GROUPS=[
 {name:'うすば(夏)',items:['葉①','葉②','葉③','夏④']},
 {name:'うすば(夏)',items:['元①','元②','元③']},
 {name:'あつば(夏)',items:['①','②','③','④']},
 {name:'薄葉',items:['8月検①','9月検①','10月検①','11月検①']},
 {name:'貝殻棹前',items:['棹①','③','④','元①']},
 {name:'加工用',items:['①','②']},
 {name:'春茎',items:['①','②','③','④','加工②']},
 {name:'ちがいそ',items:['ちがいそ']},
 {name:'厚頭',items:['厚頭']},
 {name:'加工用1等',items:['加工用1等']}
];
let nState=JSON.parse(localStorage.getItem(N_KEY)||'null')||{records:[],shipments:[],shipmentSeq:1,activeYear:'R7',pdfImports:[]};
nState.records=Array.isArray(nState.records)?nState.records:[];nState.shipments=Array.isArray(nState.shipments)?nState.shipments:[];nState.pdfImports=Array.isArray(nState.pdfImports)?nState.pdfImports:[];nState.shipmentSeq=Number(nState.shipmentSeq||1);nState.activeYear=N_YEARS.includes(nState.activeYear)?nState.activeYear:'R7';
function nSave(){localStorage.setItem(N_KEY,JSON.stringify(nState))}
function nItems(){return N_GROUPS.flatMap(g=>g.items.map(item=>({group:g.name,item})))}
function nKey(r){return [r.year,r.coop,r.season,r.group,r.item].join('|')}
function nMatrix(){const m={};nState.records.forEach(r=>{const k=nKey(r);m[k]=(m[k]||0)+(r.type==='out'?-Number(r.qty):Number(r.qty))});nState.shipments.filter(s=>s.status==='confirmed').flatMap(s=>s.lines||[]).forEach(l=>{const k=nKey(l);m[k]=(m[k]||0)-Number(l.qty||0)});return m}
function nTotal(y=nState.activeYear){const m=nMatrix();return Object.entries(m).filter(([k])=>k.startsWith(y+'|')).reduce((a,[,v])=>a+v,0)}
function nAvail(y,coop,season,group,item,excludeId){const physical=nState.records.filter(r=>r.year===y&&r.coop===coop&&r.season===season&&r.group===group&&r.item===item).reduce((a,r)=>a+(r.type==='out'?-Number(r.qty):Number(r.qty)),0);const res=nState.shipments.filter(s=>s.id!==excludeId&&s.status==='confirmed').flatMap(s=>s.lines||[]).filter(l=>l.year===y&&l.coop===coop&&l.season===season&&l.group===group&&l.item===item).reduce((a,l)=>a+Number(l.qty||0),0);return Math.max(0,physical-res)}
function nYearOptions(sel){return N_YEARS.map(y=>`<option ${y===(sel||nState.activeYear)?'selected':''}>${y}</option>`).join('')}
function nItemOptions(group,item){return N_GROUPS.map(g=>`<optgroup label="${esc(g.name)}">${g.items.map(i=>`<option value="${esc(g.name)}|${esc(i)}" ${g.name===group&&i===item?'selected':''}>${esc(i)}</option>`).join('')}</optgroup>`).join('')}
function nHome(){const y=nState.activeYear;app.innerHTML=`<section class="card"><div class="row"><h2>根室産昆布 在庫状況</h2><select id="ny" style="width:auto">${nYearOptions(y)}</select></div><div class="stats"><div class="stat">${y}年産 総在庫<b>${fmt(nTotal(y))}</b></div><div class="stat">漁協数<b>${N_COOPS.length}</b></div><div class="stat">分類数<b>${nItems().length}</b></div><div class="stat">登録履歴<b>${nState.records.filter(r=>r.year===y).length}件</b></div></div></section><section class="grid"><button class="action" id="ns" style="border-left:6px solid #e05a47">📦 出荷指示<small>根室産昆布専用・PDF/FAX</small></button><button class="action orange" id="nst">▦ 在庫表<small>原票形式で集計・PDF出力</small></button><button class="action purple" id="nl">≡ 入出庫履歴<small>修正・削除</small></button><button class="action green" id="ni">↓ 入庫登録<small>PDFから一括入庫も可能</small></button><button class="action blue" id="no">↑ 出庫登録<small>在庫から減算</small></button><button class="action gray" id="nm">⋯ その他<small>バックアップ・商品選択</small></button></section>`;ny.onchange=()=>{nState.activeYear=ny.value;nSave();nHome()};ns.onclick=nShipments;nst.onclick=nStock;nl.onclick=nLogs;ni.onclick=()=>nForm('in');no.onclick=()=>nForm('out');nm.onclick=nMore}
function nForm(type,editId=null){const r=editId?nState.records.find(x=>x.id===editId):null,ft=r?.type||type||'in',g=r?.group||N_GROUPS[0].name,it=r?.item||N_GROUPS[0].items[0];app.innerHTML=`<section class="card"><h2>${r?'入出庫修正':ft==='in'?'根室産昆布 入庫登録':'根室産昆布 出庫登録'}</h2><div class="form">${!r&&ft==='in'?'<button class="btn secondary" id="nPdfBtn">📄 PDFから根室産昆布を一括入庫</button><input id="nPdfFile" type="file" accept="application/pdf,.pdf" hidden><div class="note">在庫証明書PDFから「根室産昆布」だけを抽出し、年度・漁協・夏/秋/拾・分類ごとに集計します。</div>':''}<label>区分<div class="note">${ft==='in'?'入庫':'出庫'}</div></label><label>生産年度<select id="nyr">${nYearOptions(r?.year)}</select></label><label>漁協<select id="ncoop">${N_COOPS.map(x=>`<option ${x===r?.coop?'selected':''}>${x}</option>`).join('')}</select></label><label>季節区分<select id="nseason">${N_SEASONS.map(x=>`<option ${x===(r?.season||'夏')?'selected':''}>${x}</option>`).join('')}</select></label><label>分類<select id="ngi">${nItemOptions(g,it)}</select></label><label>数量<input id="nq" type="number" min="0" step="0.01" inputmode="decimal" value="${r?esc(r.qty):''}"></label><label>日付<input id="nd" type="date" value="${r?.date||today()}"></label><label>備考<input id="nmem" value="${esc(r?.memo||'')}"></label><button class="btn" id="nsv">${r?'修正を保存':'登録する'}</button><button class="btn secondary" id="nb">戻る</button></div></section>`;if(!r&&ft==='in'){nPdfBtn.onclick=()=>nPdfFile.click();nPdfFile.onchange=()=>{const f=nPdfFile.files?.[0];if(f)nImportPdf(f)}}nsv.onclick=()=>{const q=Number(nq.value);if(!q||q<0)return alert('数量を入力してください');const [group,item]=ngi.value.split('|'),year=nyr.value,coop=ncoop.value,season=nseason.value;if(ft==='out'&&q>nAvail(year,coop,season,group,item,r?.id))return alert('出庫可能在庫が不足しています。');const obj={id:r?.id||(crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())),type:ft,year,coop,season,group,item,qty:q,date:nd.value,memo:nmem.value};if(r)nState.records[nState.records.findIndex(x=>x.id===r.id)]=obj;else nState.records.push(obj);nState.activeYear=year;nSave();alert(r?'修正しました':ft==='in'?'入庫しました':'出庫しました');nStock()};nb.onclick=()=>r?nLogs():nHome()}
async function nParsePdf(file){if(!PDFJS)throw Error('PDF読取ライブラリを読み込めません。');PDFJS.GlobalWorkerOptions.workerSrc='./pdf-worker-v58.js';const hash=await sha256File(file);if(nState.pdfImports.some(x=>x.hash===hash))throw Error('このPDFはすでに根室産昆布へ取り込み済みです。');const pdf=await PDFJS.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,cols=nItems(),rows=[];let matched=[],date=today();for(let pn=1;pn<=pdf.numPages;pn++){const pg=await pdf.getPage(pn),tc=await pg.getTextContent();const its=tc.items.filter(x=>String(x.str||'').trim()).map(x=>({str:String(x.str).trim(),x:+x.transform[4],y:+x.transform[5],w:+(x.width||0)}));const txt=its.map(x=>x.str).join(''),norm=txt.replace(/\s/g,'').replace(/[Ｒｒ]/g,'R');if(!norm.includes('根室産昆布'))continue;const ym=norm.match(/R\.?\s*(10|[3-9])年度?/i),year=ym?`R${ym[1]}`:nState.activeYear;date=reiwaDateFromText(txt);const sl=its.filter(x=>x.x<110&&N_SEASONS.includes(x.str)).sort((a,b)=>b.y-a.y).slice(0,9);if(sl.length<9)continue;for(let ri=0;ri<9;ri++){const li=sl[ri],coop=N_COOPS[Math.floor(ri/3)],season=N_SEASONS[ri%3];its.forEach(v=>{if(Math.abs(v.y-li.y)>3.6||!/^-?\d[\d,.-]*$/.test(v.str))return;const cx=v.x+(v.w||0)/2,idx=Math.round((cx-115.54)/22.82);if(idx<0||idx>=cols.length||Math.abs(cx-(115.54+idx*22.82))>10.8)return;const q=Number(v.str.replace(/,/g,'').replace(/[^0-9.-]/g,''));if(!Number.isFinite(q)||q<=0)return;rows.push({year,coop,season,group:cols[idx].group,item:cols[idx].item,qty:q,page:pn})})}matched.push(pn)}if(!rows.length)throw Error('PDF内から「根室産昆布」の数量を読み取れませんでした。');const agg=new Map();rows.forEach(r=>{const k=[r.year,r.coop,r.season,r.group,r.item].join('|'),o=agg.get(k)||{...r,qty:0,pages:[]};o.qty+=r.qty;if(!o.pages.includes(r.page))o.pages.push(r.page);agg.set(k,o)});return {rows:[...agg.values()],date,matched,pageCount:pdf.numPages,years:[...new Set(rows.map(r=>r.year))],hash}}
async function nImportPdf(file){try{app.innerHTML='<section class="card"><h2>根室産昆布 PDF読込中</h2><p>PDFから「根室産昆布」のページだけを抽出しています…</p></section>';const parsed=await nParsePdf(file),sum=parsed.rows.reduce((a,r)=>a+r.qty,0);const preview=parsed.rows.slice(0,120).map((r,i)=>`<tr><td>${i+1}</td><td>${r.year}</td><td>${r.coop}</td><td>${r.season}</td><td>${esc(r.group)}</td><td>${esc(r.item)}</td><td>${fmt(r.qty)}</td></tr>`).join('');app.innerHTML=`<section class="card"><h2>根室産昆布 PDF入庫確認</h2><div class="stats"><div class="stat">対象ページ<b>${parsed.matched.join(', ')}</b></div><div class="stat">生産年度<b>${parsed.years.join('・')}</b></div><div class="stat">明細<b>${parsed.rows.length}件</b></div><div class="stat">合計<b>${fmt(sum)}</b></div></div><div class="note">「根室産昆布」だけを取引先をまたいで集計しています。まだ在庫には反映されていません。</div><div class="tablewrap" style="margin-top:12px"><table style="min-width:850px"><tr><th>No.</th><th>年度</th><th>漁協</th><th>区分</th><th>分類</th><th>細分類</th><th>数量</th></tr>${preview}</table></div><div class="toolbar" style="margin-top:12px"><button class="btn" id="nc">この集計内容で一括入庫</button><button class="btn secondary" id="ncan">キャンセル</button></div></section>`;nc.onclick=()=>{parsed.rows.forEach(r=>nState.records.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),type:'in',year:r.year,coop:r.coop,season:r.season,group:r.group,item:r.item,qty:r.qty,date:parsed.date,memo:`PDF一括入庫：${file.name}`}));nState.activeYear=parsed.years.at(-1)||'R7';nState.pdfImports.push({hash:parsed.hash,fileName:file.name,date:parsed.date,years:parsed.years,pages:parsed.matched,importedAt:new Date().toISOString()});nSave();alert(`${parsed.rows.length}件、合計${fmt(sum)}を入庫しました。`);nStock()};ncan.onclick=()=>nForm('in')}catch(e){alert('PDFを読み込めませんでした。\n'+(e.message||e));nForm('in')}}
function nStock(){const y=nState.activeYear,m=nMatrix(),cols=nItems();let h=`<section class="card"><div class="row"><h2>根室産昆布 在庫集計表</h2><select id="nsy">${nYearOptions(y)}</select></div><div class="toolbar"><button class="btn" id="nspdf">PDF出力</button><button class="btn secondary" id="nsh">ホーム</button></div><div class="tablewrap" style="margin-top:12px"><table class="stock-report"><tr><th rowspan="2">組合名</th><th rowspan="2">区分</th>${N_GROUPS.map(g=>`<th colspan="${g.items.length}">${esc(g.name)}</th>`).join('')}<th rowspan="2">計</th></tr><tr>${N_GROUPS.flatMap(g=>g.items).map(i=>`<th>${esc(i)}</th>`).join('')}</tr>`;for(const coop of N_COOPS){for(const season of N_SEASONS){let rt=0;h+=`<tr><th>${season===N_SEASONS[0]?coop:''}</th><th>${season}</th>`;for(const c of cols){const q=m[[y,coop,season,c.group,c.item].join('|')]||0;rt+=q;h+=`<td>${q?fmt(q):''}</td>`}h+=`<td>${rt?fmt(rt):''}</td></tr>`}h+=`<tr class="stock-subtotal"><th></th><th>小計</th>`;let st=0;for(const c of cols){const q=N_SEASONS.reduce((a,se)=>a+(m[[y,coop,se,c.group,c.item].join('|')]||0),0);st+=q;h+=`<td>${q?fmt(q):''}</td>`}h+=`<td>${st?fmt(st):''}</td></tr>`}h+=`<tfoot><tr><th colspan="2">合計</th>`;let gt=0;for(const c of cols){const q=N_COOPS.reduce((a,co)=>a+N_SEASONS.reduce((b,se)=>b+(m[[y,co,se,c.group,c.item].join('|')]||0),0),0);gt+=q;h+=`<th>${q?fmt(q):''}</th>`}h+=`<th>${gt?fmt(gt):''}</th></tr></tfoot></table></div><p class="muted">0は空欄表示。確定済み出荷指示数量を差し引いた利用可能在庫です。</p></section>`;app.innerHTML=h;nsy.onchange=()=>{nState.activeYear=nsy.value;nSave();nStock()};nsh.onclick=nHome;nspdf.onclick=()=>nOpenStockPdf(y)}
function nReportCanvas(y,ship=null){const W=1684,H=1191,margin=34,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),cols=nItems(),title=ship?'出 荷 指 示 書（根室産昆布）':'根 室 産 昆 布　在 庫 集 計 表';x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#000';x.strokeStyle='#222';const f=(z,b=false)=>`${b?'700 ':'400 '}${z}px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif`,t=(v,xx,yy,z=13,a='center',b=false)=>{x.font=f(z,b);x.textAlign=a;x.textBaseline='middle';x.fillText(String(v??''),xx,yy)};t(title,margin,38,28,'left',true);t(`${y}年産`,W-margin,38,16,'right',true);if(ship){t(`指示番号：${ship.id}　出荷日：${ship.shipDate||''}`,W-margin,62,13,'right');t(`出荷先：${ship.dest?.name||''}　${ship.dest?.address||''}　TEL ${ship.dest?.phone||''}`,margin,62,12,'left')}const ty=ship?85:70,tw=W-margin*2,coopW=92,seasonW=45,totalW=58,dataW=tw-coopW-seasonW-totalW,colW=dataW/cols.length,shipmentTall=!!window.__v127NemuroShipmentTall,shipmentMerged=!!window.__v128NemuroShipmentMerged,h1=shipmentTall?44:28,h2=shipmentTall?44:28,rowH=shipmentTall?70:39,footH=shipmentTall?38:34,tableH=h1+h2+N_COOPS.length*4*rowH+footH;x.lineWidth=.55;x.strokeRect(margin,ty,tw,tableH);const xData=margin+coopW+seasonW;[margin+coopW,xData,xData+dataW].forEach(xx=>{x.beginPath();x.moveTo(xx,ty);x.lineTo(xx,ty+tableH);x.stroke()});const shHead=!!window.__v63ShipmentHeaderLarge;t('組合名',margin+coopW/2,ty+(h1+h2)/2,shHead?16:12);t('区分',margin+coopW+seasonW/2,ty+(h1+h2)/2,shHead?16:12);t('計',xData+dataW+totalW/2,ty+(h1+h2)/2,shHead?16:12);let ci=0;N_GROUPS.forEach(g=>{const gx=xData+ci*colW,gw=g.items.length*colW;x.strokeRect(gx,ty,gw,h1);const oldGroupSize=['ちがいそ','厚頭','加工用1等'].includes(g.name);t(g.name,gx+gw/2,ty+h1/2,shHead?(oldGroupSize?14:23):10,'center',true);g.items.forEach((it,j)=>{const xx=gx+j*colW;x.strokeRect(xx,ty+h1,colW,h2);const oldItemSize=['8月検①','9月検①','10月検①','11月検①','加工②','ちがいそ','厚頭','加工用1等'].includes(it);t(it,xx+colW/2,ty+h1+h2/2,shHead?(oldItemSize?12:21):8)});ci+=g.items.length});const mt=nMatrix(),lines=ship?.lines||null;const qFor=(coop,se,c)=>lines?lines.filter(l=>l.year===y&&l.coop===coop&&l.season===se&&l.group===c.group&&l.item===c.item).reduce((a,l)=>a+Number(l.qty||0),0):(mt[[y,coop,se,c.group,c.item].join('|')]||0);let yy=ty+h1+h2;for(const coop of N_COOPS){x.lineWidth=1.5;x.beginPath();x.moveTo(margin,yy);x.lineTo(margin+tw,yy);x.stroke();x.lineWidth=.55;for(let si=0;si<N_SEASONS.length;si++){const se=N_SEASONS[si];if(si===0)t(coop,margin+coopW/2,yy+(shipmentMerged?rowH*2:(shipmentTall?rowH*2:(window.__v58ShipmentCoopLower?rowH*1.7:rowH/2))),shipmentMerged?18:12,'center',true);t(se,margin+coopW+seasonW/2,yy+rowH/2,13,'center',true);let rt=0;cols.forEach((cc,j)=>{const q=qFor(coop,se,cc),xx=xData+j*colW;rt+=q;x.beginPath();x.moveTo(xx,yy);x.lineTo(xx,yy+rowH);x.stroke();if(q)t(fmt(q),xx+colW/2,yy+rowH/2,shipmentMerged?24:13)});if(rt)t(fmt(rt),xData+dataW+totalW/2,yy+rowH/2,shipmentMerged?24:13);x.beginPath();x.moveTo(shipmentMerged?margin+coopW:margin,yy+rowH);x.lineTo(margin+tw,yy+rowH);x.stroke();yy+=rowH}t('小計',margin+coopW+seasonW/2,yy+rowH/2,11);let st=0;cols.forEach((cc,j)=>{const q=N_SEASONS.reduce((a,se)=>a+qFor(coop,se,cc),0),xx=xData+j*colW;st+=q;if(q)t(fmt(q),xx+colW/2,yy+rowH/2,11)});if(st)t(fmt(st),xData+dataW+totalW/2,yy+rowH/2,11);x.beginPath();x.moveTo(margin,yy+rowH);x.lineTo(margin+tw,yy+rowH);x.stroke();yy+=rowH}x.lineWidth=1.5;x.beginPath();x.moveTo(margin,yy);x.lineTo(margin+tw,yy);x.stroke();x.lineWidth=.55;t('合計',margin+(coopW+seasonW)/2,yy+footH/2,12,'center',true);let gt=0;cols.forEach((cc,j)=>{const q=N_COOPS.reduce((a,co)=>a+N_SEASONS.reduce((b,se)=>b+qFor(co,se,cc),0),0),xx=xData+j*colW;gt+=q;if(q)t(fmt(q),xx+colW/2,yy+footH/2,shHead?18:12)});if(gt)t(fmt(gt),xData+dataW+totalW/2,yy+footH/2,shHead?18:12);return c}
async function nOpenStockPdf(y){const w=window.open('about:blank','_blank');if(!w)return alert('PDF画面を開けません。');try{const b=await _singleCanvasPdfBlob(nReportCanvas(y)),u=URL.createObjectURL(b);w.location.replace(u);setTimeout(()=>URL.revokeObjectURL(u),600000)}catch(e){w.close();alert('PDF作成に失敗しました。')}}
function nLogs(){const a=nState.records.slice().reverse();app.innerHTML=`<section class="card"><h2>根室産昆布 入出庫履歴</h2><div class="tablewrap"><table style="min-width:950px"><tr><th>日付</th><th>区分</th><th>年度</th><th>漁協</th><th>季節</th><th>分類</th><th>細分類</th><th>数量</th><th>操作</th></tr>${a.map(r=>`<tr><td>${r.date}</td><td>${r.type==='in'?'入庫':'出庫'}</td><td>${r.year}</td><td>${r.coop}</td><td>${r.season}</td><td>${esc(r.group)}</td><td>${esc(r.item)}</td><td>${fmt(r.qty)}</td><td><button class="mini" data-ne="${r.id}">修正</button> <button class="mini danger" data-nd="${r.id}">削除</button></td></tr>`).join('')}</table></div><button class="btn secondary" id="nlb">戻る</button></section>`;app.querySelectorAll('[data-ne]').forEach(b=>b.onclick=()=>nForm(null,b.dataset.ne));app.querySelectorAll('[data-nd]').forEach(b=>b.onclick=()=>{if(confirm('削除しますか？')){nState.records=nState.records.filter(r=>r.id!==b.dataset.nd);nSave();nLogs()}});nlb.onclick=nHome}
function nShipId(){return 'N'+String(nState.shipmentSeq++).padStart(5,'0')}
function nShipments(){app.innerHTML=`<section class="card"><div class="row"><h2>根室産昆布 出荷指示</h2><button class="mini" id="nnew">＋新規</button></div><div class="tablewrap"><table><tr><th>番号</th><th>出荷元</th><th>出荷先</th><th>出荷日</th><th>数量</th><th>状態</th><th></th></tr>${nState.shipments.slice().reverse().map(s=>`<tr><td>${s.id}</td><td>${esc(s.source?.name||'')}</td><td>${esc(s.dest?.name||'')}</td><td>${s.shipDate||''}</td><td>${fmt((s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0))}</td><td>${s.status}</td><td><button class="mini" data-ns="${s.id}">開く</button></td></tr>`).join('')}</table></div><button class="btn secondary" id="nsb">戻る</button></section>`;nnew.onclick=()=>nShipForm();app.querySelectorAll('[data-ns]').forEach(b=>b.onclick=()=>nShipDetail(b.dataset.ns));nsb.onclick=nHome}
function nShipForm(id=null){const s=id?nState.shipments.find(x=>x.id===id):null;let lines=s?.lines?.map(x=>({...x}))||[];app.innerHTML=`<section class="card"><h2>根室産昆布 ${s?'出荷指示修正':'新規出荷指示'}</h2><div class="form"><label>出荷元 会社名<input id="nsrc" value="${esc(s?.source?.name||'㈱浜中運輸')}"></label><label>出荷元 住所<input id="nsrca" value="${esc(s?.source?.address||'')}"></label><label>出荷元 電話<input id="nsrcp" value="${esc(s?.source?.phone||'')}"></label><label>出荷先 会社名<input id="ndst" value="${esc(s?.dest?.name||'')}"></label><label>出荷先 住所<input id="ndsta" value="${esc(s?.dest?.address||'')}"></label><label>出荷先 電話<input id="ndstp" value="${esc(s?.dest?.phone||'')}"></label><div class="subgrid"><label>出荷日<input id="nsd" type="date" value="${s?.shipDate||today()}"></label><label>希望着日<input id="nad" type="date" value="${s?.arrivalDate||''}"></label></div><div id="nsl"></div><button class="btn secondary" id="nala">＋明細追加</button><button class="btn" id="nssv">保存</button><button class="btn secondary" id="nsfb">戻る</button></div></section>`;function rend(){nsl.innerHTML=lines.map((l,i)=>`<div class="card" style="background:#f8fafc"><label>年度<select data-ni="${i}" data-nf="year">${nYearOptions(l.year)}</select></label><label>漁協<select data-ni="${i}" data-nf="coop">${N_COOPS.map(x=>`<option ${x===l.coop?'selected':''}>${x}</option>`).join('')}</select></label><label>区分<select data-ni="${i}" data-nf="season">${N_SEASONS.map(x=>`<option ${x===l.season?'selected':''}>${x}</option>`).join('')}</select></label><label>分類<select data-ni="${i}" data-nf="gi">${nItemOptions(l.group,l.item)}</select></label><label>数量<input type="number" value="${esc(l.qty||'')}" data-ni="${i}" data-nf="qty"></label><button class="mini danger" data-nr="${i}">削除</button></div>`).join('');nsl.querySelectorAll('[data-nf]').forEach(e=>e.onchange=()=>{const i=+e.dataset.ni;if(e.dataset.nf==='gi'){[lines[i].group,lines[i].item]=e.value.split('|')}else lines[i][e.dataset.nf]=e.value});nsl.querySelectorAll('[data-nr]').forEach(e=>e.onclick=()=>{lines.splice(+e.dataset.nr,1);rend()})}nala.onclick=()=>{lines.push({year:nState.activeYear,coop:N_COOPS[0],season:'夏',group:N_GROUPS[0].name,item:N_GROUPS[0].items[0],qty:''});rend()};nssv.onclick=()=>{if(!ndst.value.trim()||!lines.length)return alert('出荷先と明細を入力してください。');for(const l of lines){l.qty=Number(l.qty);if(!l.qty||l.qty>nAvail(l.year,l.coop,l.season,l.group,l.item,s?.id))return alert(`${l.coop} ${l.season} ${l.group} ${l.item} の在庫が不足しています。`)}const o=s||{id:nShipId(),status:'draft',createdAt:new Date().toISOString()};Object.assign(o,{source:{name:nsrc.value,address:nsrca.value,phone:nsrcp.value},dest:{name:ndst.value,address:ndsta.value,phone:ndstp.value},shipDate:nsd.value,arrivalDate:nad.value,lines});if(!s)nState.shipments.push(o);nSave();nShipDetail(o.id)};nsfb.onclick=nShipments;rend()}
function nShipDetail(id){const s=nState.shipments.find(x=>x.id===id);if(!s)return nShipments();app.innerHTML=`<section class="card"><div class="row"><h2>根室産昆布 出荷指示 ${s.id}</h2><span class="pill">${s.status}</span></div><p><b>出荷先：</b>${esc(s.dest?.name||'')}　<b>出荷元：</b>${esc(s.source?.name||'')}</p><p><b>出荷日：</b>${s.shipDate||''}　<b>合計：</b>${fmt((s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0))}</p><div class="toolbar"><button class="btn" id="npdfs">帳票を確認</button>${s.status==='draft'?'<button class="btn" id="nconf">確定・在庫反映</button><button class="btn secondary" id="nedit">修正</button>':''}${s.status==='confirmed'?'<button class="btn" id="nshipped">出荷済</button>':''}
${s.status!=='shipped'&&s.status!=='cancelled'?'<button class="btn danger" id="ncancel">取消</button>':''}
<button class="btn secondary" id="nback">一覧へ</button></div></section>`;const pdf=document.getElementById('npdfs');if(pdf)pdf.onclick=()=>nOpenShipPdf(s);if(s.status==='draft'){
  const c=document.getElementById('nconf');

  if(c)c.onclick=()=>{
    const inv=window.KombuRefactor?.Inventory;

    for(const l of s.lines){
      const av=inv?.getAvailableQuantity
        ? inv.getAvailableQuantity(
            'nemuro',
            {
              year:l.year,
              coop:l.coop,
              season:l.season,
              group:l.group,
              item:l.item
            },
            s.id
          )
        : nAvail(
            l.year,
            l.coop,
            l.season,
            l.group,
            l.item,
            s.id
          );

      if(Number(l.qty)>Math.max(0,Number(av||0))){
        return alert(
          `${l.coop} ${l.season} ${l.group} ${l.item} の出荷可能在庫が不足しています。`
        );
      }
    }

    s.status='confirmed';
    s.confirmedAt=new Date().toISOString();

    nSave();

    alert('出荷指示を確定し、在庫表へ反映しました。');
    nShipDetail(id);
  };

  const e=document.getElementById('nedit');
  if(e)e.onclick=()=>v114UnifiedShipmentForm('nemuro',id);
}
  const sh=document.getElementById('nshipped');

  if(sh)sh.onclick=()=>{
    const inv=window.KombuRefactor?.Inventory;

    for(const l of s.lines){
      const av=inv?.getAvailableQuantity
        ? inv.getAvailableQuantity(
            'nemuro',
            {
              year:l.year,
              coop:l.coop,
              season:l.season,
              group:l.group,
              item:l.item
            },
            s.id
          )
        : nAvail(
            l.year,
            l.coop,
            l.season,
            l.group,
            l.item,
            s.id
          );

      if(Number(l.qty)>Math.max(0,Number(av||0))){
        return alert(
          `${l.coop} ${l.season} ${l.group} ${l.item} の出荷可能在庫が不足しています。`
        );
      }
    }

    if(!window.confirm(
      '出荷済みにすると、明細数量を在庫から出庫します。よろしいですか？'
    ))return;

    s.lines.forEach(l=>
      nState.records.push({
        id:crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()+Math.random()),
        type:'out',
        year:l.year,
        coop:l.coop,
        season:l.season,
        group:l.group,
        item:l.item,
        qty:Number(l.qty),
        date:s.shipDate||today(),
        memo:`出荷指示 ${s.id}`
      })
    );

    s.status='shipped';
    s.shippedAt=new Date().toISOString();

    nSave();
    nShipDetail(id);
  };
const cancelBtn=document.getElementById('ncancel');

if(cancelBtn){
  cancelBtn.onclick=()=>{
    if(!window.confirm(
      s.status==='confirmed'
        ? '取消すると在庫表へ数量を戻します。よろしいですか？'
        : 'この出荷指示を取消しますか？'
    ))return;

    s.status='cancelled';
    s.cancelledAt=new Date().toISOString();

    nSave();
    alert('出荷指示を取消しました');
    nShipDetail(id);
  };
}const b=document.getElementById('nback');if(b)b.onclick=nShipments}
async function nOpenShipPdf(s){const w=window.open('about:blank','_blank');if(!w)return alert('PDF画面を開けません。');try{const ys=[...new Set(s.lines.map(l=>l.year))],ims=[];for(const y of ys)ims.push({bytes:await _canvasJpegBytes(nReportCanvas(y,s)),w:1684,h:1191});const objs=[],pageIds=[],imgIds=[],contentIds=[];let id=1,catalog=id++,pages=id++;ims.forEach(()=>{pageIds.push(id++);imgIds.push(id++);contentIds.push(id++)});objs[catalog]=_ascii(`<< /Type /Catalog /Pages ${pages} 0 R >>`);objs[pages]=_ascii(`<< /Type /Pages /Count ${ims.length} /Kids [${pageIds.map(x=>x+' 0 R').join(' ')}] >>`);ims.forEach((im,i)=>{objs[pageIds[i]]=_ascii(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im0 ${imgIds[i]} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`);objs[imgIds[i]]=_concatBytes([_ascii(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`),im.bytes,_ascii('\nendstream')]);const st='q\n841.89 0 0 595.28 0 0 cm\n/Im0 Do\nQ\n';objs[contentIds[i]]=_ascii(`<< /Length ${st.length} >>\nstream\n${st}endstream`)});const n=id-1,parts=[_ascii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offs=Array(n+1).fill(0);let pos=parts[0].length;for(let i=1;i<=n;i++){offs[i]=pos;const a=_ascii(`${i} 0 obj\n`),bb=objs[i],cc=_ascii('\nendobj\n');parts.push(a,bb,cc);pos+=a.length+bb.length+cc.length}const xp=pos;let xr=`xref\n0 ${n+1}\n0000000000 65535 f \n`;for(let i=1;i<=n;i++)xr+=String(offs[i]).padStart(10,'0')+' 00000 n \n';xr+=`trailer\n<< /Size ${n+1} /Root ${catalog} 0 R >>\nstartxref\n${xp}\n%%EOF`;parts.push(_ascii(xr));const b=new Blob(parts,{type:'application/pdf'}),u=URL.createObjectURL(b);w.location.replace(u);setTimeout(()=>URL.revokeObjectURL(u),600000)}catch(e){try{w.close()}catch{}alert('PDF作成に失敗しました。\n'+(e.message||e))}}
function nMore(){app.innerHTML=`<section class="card"><h2>根室産昆布 その他</h2><div class="form"><button class="btn secondary" id="nprod">← 昆布選択画面へ</button><button class="btn secondary" id="nbk">根室産昆布バックアップ保存</button><input id="nrf" type="file" accept="application/json" hidden><button class="btn secondary" id="nrs">根室産昆布バックアップ復元</button><button class="btn secondary" id="nhm">ホーム</button></div></section>`;nprod.onclick=productLanding;nbk.onclick=()=>download('根室産昆布バックアップ_'+today()+'.json',JSON.stringify(nState,null,2),'application/json');nrs.onclick=()=>nrf.click();nrf.onchange=()=>{const f=nrf.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{nState=JSON.parse(rd.result);nSave();alert('復元しました');nHome()}catch{alert('復元できませんでした')}};rd.readAsText(f)};nhm.onclick=nHome}


/* ===== v33: 釧路産棹前昆布 独立管理 ===== */
const S_KEY='kombu_kushiro_sanmae_local_v1';
const S_YEARS=['R3','R4','R5','R6','R7','R8','R9','R10'];
const S_COOPS=['東部漁協','昆布森漁協','厚岸漁協','散布漁協','浜中漁協'];
const S_SEASONS=['採り','拾い'];
const S_GROUPS=[
 {name:'棹前',items:['①','特②','②','③','④','尺④']},
 {name:'棹前頭',items:['尺①','尺②','短①','短②']},
 {name:'棹前加工用',items:['①','②','③']},
 {name:'尺',items:['①']}
];
let smState=JSON.parse(localStorage.getItem(S_KEY)||'null')||{records:[],shipments:[],shipmentSeq:1,activeYear:'R7',pdfImports:[]};
smState.records=Array.isArray(smState.records)?smState.records:[];smState.shipments=Array.isArray(smState.shipments)?smState.shipments:[];smState.pdfImports=Array.isArray(smState.pdfImports)?smState.pdfImports:[];smState.shipmentSeq=Number(smState.shipmentSeq||1);smState.activeYear=S_YEARS.includes(smState.activeYear)?smState.activeYear:'R7';
function smSave(){localStorage.setItem(S_KEY,JSON.stringify(smState))}
function smItems(){return S_GROUPS.flatMap(g=>g.items.map(item=>({group:g.name,item})))}
function smKey(r){return [r.year,r.coop,r.season,r.group,r.item].join('|')}
function smMatrix(){const m={};smState.records.forEach(r=>{const k=smKey(r);m[k]=(m[k]||0)+(r.type==='out'?-Number(r.qty):Number(r.qty))});smState.shipments.filter(s=>s.status==='confirmed').flatMap(s=>s.lines||[]).forEach(l=>{const k=smKey(l);m[k]=(m[k]||0)-Number(l.qty||0)});return m}
function smTotal(y=smState.activeYear){const m=smMatrix();return Object.entries(m).filter(([k])=>k.startsWith(y+'|')).reduce((a,[,v])=>a+v,0)}
function smAvail(y,coop,season,group,item,excludeId){const physical=smState.records.filter(r=>r.year===y&&r.coop===coop&&r.season===season&&r.group===group&&r.item===item).reduce((a,r)=>a+(r.type==='out'?-Number(r.qty):Number(r.qty)),0);const res=smState.shipments.filter(s=>s.id!==excludeId&&s.status==='confirmed').flatMap(s=>s.lines||[]).filter(l=>l.year===y&&l.coop===coop&&l.season===season&&l.group===group&&l.item===item).reduce((a,l)=>a+Number(l.qty||0),0);return Math.max(0,physical-res)}
function smYearOptions(sel){return S_YEARS.map(y=>`<option ${y===(sel||smState.activeYear)?'selected':''}>${y}</option>`).join('')}
function smItemOptions(group,item){return S_GROUPS.map(g=>`<optgroup label="${esc(g.name)}">${g.items.map(i=>`<option value="${esc(g.name)}|${esc(i)}" ${g.name===group&&i===item?'selected':''}>${esc(i)}</option>`).join('')}</optgroup>`).join('')}
function smHome(){const y=smState.activeYear;app.innerHTML=`<section class="card"><div class="row"><h2>釧路産棹前昆布 在庫状況</h2><select id="ny" style="width:auto">${smYearOptions(y)}</select></div><div class="stats"><div class="stat">${y}年産 総在庫<b>${fmt(smTotal(y))}</b></div><div class="stat">漁協数<b>${S_COOPS.length}</b></div><div class="stat">分類数<b>${smItems().length}</b></div><div class="stat">登録履歴<b>${smState.records.filter(r=>r.year===y).length}件</b></div></div></section><section class="grid"><button class="action" id="ns" style="border-left:6px solid #e05a47">📦 出荷指示<small>釧路産棹前昆布専用・PDF/FAX</small></button><button class="action orange" id="nst">▦ 在庫表<small>原票形式で集計・PDF出力</small></button><button class="action purple" id="nl">≡ 入出庫履歴<small>修正・削除</small></button><button class="action green" id="ni">↓ 入庫登録<small>PDFから一括入庫も可能</small></button><button class="action blue" id="no">↑ 出庫登録<small>在庫から減算</small></button><button class="action gray" id="nm">⋯ その他<small>バックアップ・商品選択</small></button></section>`;ny.onchange=()=>{smState.activeYear=ny.value;smSave();smHome()};ns.onclick=smShipments;nst.onclick=smStock;nl.onclick=smLogs;ni.onclick=()=>smForm('in');no.onclick=()=>smForm('out');nm.onclick=smMore}
function smForm(type,editId=null){const r=editId?smState.records.find(x=>x.id===editId):null,ft=r?.type||type||'in',g=r?.group||S_GROUPS[0].name,it=r?.item||S_GROUPS[0].items[0];app.innerHTML=`<section class="card"><h2>${r?'入出庫修正':ft==='in'?'釧路産棹前昆布 入庫登録':'釧路産棹前昆布 出庫登録'}</h2><div class="form">${!r&&ft==='in'?'<button class="btn secondary" id="smPdfBtn">📄 PDFから釧路産棹前昆布を一括入庫</button><input id="smPdfFile" type="file" accept="application/pdf,.pdf" hidden><div class="note">在庫証明書PDFから「釧路産棹前昆布」だけを抽出し、年度・漁協・採り/拾い・分類ごとに集計します。</div>':''}<label>区分<div class="note">${ft==='in'?'入庫':'出庫'}</div></label><label>生産年度<select id="nyr">${smYearOptions(r?.year)}</select></label><label>漁協<select id="ncoop">${S_COOPS.map(x=>`<option ${x===r?.coop?'selected':''}>${x}</option>`).join('')}</select></label><label>採取区分<select id="nseason">${S_SEASONS.map(x=>`<option ${x===(r?.season||'採り')?'selected':''}>${x}</option>`).join('')}</select></label><label>分類<select id="ngi">${smItemOptions(g,it)}</select></label><label>数量<input id="nq" type="number" min="0" step="0.01" inputmode="decimal" value="${r?esc(r.qty):''}"></label><label>日付<input id="nd" type="date" value="${r?.date||today()}"></label><label>備考<input id="nmem" value="${esc(r?.memo||'')}"></label><button class="btn" id="nsv">${r?'修正を保存':'登録する'}</button><button class="btn secondary" id="nb">戻る</button></div></section>`;if(!r&&ft==='in'){smPdfBtn.onclick=()=>smPdfFile.click();smPdfFile.onchange=()=>{const f=smPdfFile.files?.[0];if(f)smImportPdf(f)}}nsv.onclick=()=>{const q=Number(nq.value);if(!q||q<0)return alert('数量を入力してください');const [group,item]=ngi.value.split('|'),year=nyr.value,coop=ncoop.value,season=nseason.value;if(ft==='out'&&q>smAvail(year,coop,season,group,item,r?.id))return alert('出庫可能在庫が不足しています。');const obj={id:r?.id||(crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())),type:ft,year,coop,season,group,item,qty:q,date:nd.value,memo:nmem.value};if(r)smState.records[smState.records.findIndex(x=>x.id===r.id)]=obj;else smState.records.push(obj);smState.activeYear=year;smSave();alert(r?'修正しました':ft==='in'?'入庫しました':'出庫しました');smStock()};nb.onclick=()=>r?smLogs():smHome()}
async function smParsePdf(file){if(!PDFJS)throw Error('PDF読取ライブラリを読み込めません。');PDFJS.GlobalWorkerOptions.workerSrc='./pdf-worker-v58.js';const hash=await sha256File(file);if(smState.pdfImports.some(x=>x.hash===hash))throw Error('このPDFはすでに釧路産棹前昆布へ取り込み済みです。');const pdf=await PDFJS.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,cols=smItems(),rows=[];let matched=[],date=today();for(let pn=1;pn<=pdf.numPages;pn++){const pg=await pdf.getPage(pn),tc=await pg.getTextContent();const its=tc.items.filter(x=>String(x.str||'').trim()).map(x=>({str:String(x.str).trim(),x:+x.transform[4],y:+x.transform[5],w:+(x.width||0)}));const txt=its.map(x=>x.str).join(''),norm=txt.replace(/\s/g,'').replace(/[Ｒｒ]/g,'R');if(!norm.includes('釧路産棹前昆布'))continue;const ym=norm.match(/R\.?\s*(10|[3-9])年度?/i),year=ym?`R${ym[1]}`:smState.activeYear;date=reiwaDateFromText(txt);const sl=its.filter(x=>x.x>105&&x.x<150&&S_SEASONS.includes(x.str.replace(/\s/g,''))).sort((a,b)=>b.y-a.y).slice(0,S_COOPS.length*S_SEASONS.length);if(sl.length<S_COOPS.length*S_SEASONS.length)continue;for(let ri=0;ri<sl.length;ri++){const li=sl[ri],coop=S_COOPS[Math.floor(ri/S_SEASONS.length)],season=S_SEASONS[ri%S_SEASONS.length];its.forEach(v=>{if(Math.abs(v.y-li.y)>3.8||!/^-?\d[\d,.-]*$/.test(v.str))return;const cx=v.x+(v.w||0)/2,idx=Math.round((cx-163.5)/30.48);if(idx<0||idx>=cols.length||Math.abs(cx-(163.5+idx*30.48))>14.8)return;const q=Number(v.str.replace(/,/g,'').replace(/[^0-9.-]/g,''));if(!Number.isFinite(q)||q<=0)return;rows.push({year,coop,season,group:cols[idx].group,item:cols[idx].item,qty:q,page:pn})})}matched.push(pn)}if(!rows.length)throw Error('PDF内から「釧路産棹前昆布」の数量を読み取れませんでした。');const agg=new Map();rows.forEach(r=>{const k=[r.year,r.coop,r.season,r.group,r.item].join('|'),o=agg.get(k)||{...r,qty:0,pages:[]};o.qty+=r.qty;if(!o.pages.includes(r.page))o.pages.push(r.page);agg.set(k,o)});return {rows:[...agg.values()],date,matched,pageCount:pdf.numPages,years:[...new Set(rows.map(r=>r.year))],hash}}
async function smImportPdf(file){try{app.innerHTML='<section class="card"><h2>釧路産棹前昆布 PDF読込中</h2><p>PDFから「釧路産棹前昆布」のページだけを抽出しています…</p></section>';const parsed=await smParsePdf(file),sum=parsed.rows.reduce((a,r)=>a+r.qty,0);const preview=parsed.rows.slice(0,120).map((r,i)=>`<tr><td>${i+1}</td><td>${r.year}</td><td>${r.coop}</td><td>${r.season}</td><td>${esc(r.group)}</td><td>${esc(r.item)}</td><td>${fmt(r.qty)}</td></tr>`).join('');app.innerHTML=`<section class="card"><h2>釧路産棹前昆布 PDF入庫確認</h2><div class="stats"><div class="stat">対象ページ<b>${parsed.matched.join(', ')}</b></div><div class="stat">生産年度<b>${parsed.years.join('・')}</b></div><div class="stat">明細<b>${parsed.rows.length}件</b></div><div class="stat">合計<b>${fmt(sum)}</b></div></div><div class="note">「釧路産棹前昆布」だけを取引先をまたいで集計しています。まだ在庫には反映されていません。</div><div class="tablewrap" style="margin-top:12px"><table style="min-width:850px"><tr><th>No.</th><th>年度</th><th>漁協</th><th>区分</th><th>分類</th><th>細分類</th><th>数量</th></tr>${preview}</table></div><div class="toolbar" style="margin-top:12px"><button class="btn" id="nc">この集計内容で一括入庫</button><button class="btn secondary" id="ncan">キャンセル</button></div></section>`;nc.onclick=()=>{parsed.rows.forEach(r=>smState.records.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),type:'in',year:r.year,coop:r.coop,season:r.season,group:r.group,item:r.item,qty:r.qty,date:parsed.date,memo:`PDF一括入庫：${file.name}`}));smState.activeYear=parsed.years.at(-1)||'R7';smState.pdfImports.push({hash:parsed.hash,fileName:file.name,date:parsed.date,years:parsed.years,pages:parsed.matched,importedAt:new Date().toISOString()});smSave();alert(`${parsed.rows.length}件、合計${fmt(sum)}を入庫しました。`);smStock()};ncan.onclick=()=>smForm('in')}catch(e){alert('PDFを読み込めませんでした。\n'+(e.message||e));smForm('in')}}
function smStock(){const y=smState.activeYear,m=smMatrix(),cols=smItems();let h=`<section class="card"><div class="row"><h2>釧路産棹前昆布 在庫集計表</h2><select id="nsy">${smYearOptions(y)}</select></div><div class="toolbar"><button class="btn" id="nspdf">PDF出力</button><button class="btn secondary" id="nsh">ホーム</button></div><div class="tablewrap" style="margin-top:12px"><table class="stock-report"><tr><th rowspan="2">組合名</th><th rowspan="2">区分</th>${S_GROUPS.map(g=>`<th colspan="${g.items.length}">${esc(g.name)}</th>`).join('')}<th rowspan="2">計</th></tr><tr>${S_GROUPS.flatMap(g=>g.items).map(i=>`<th>${esc(i)}</th>`).join('')}</tr>`;for(const coop of S_COOPS){for(const season of S_SEASONS){let rt=0;h+=`<tr><th>${season===S_SEASONS[0]?coop:''}</th><th>${season}</th>`;for(const c of cols){const q=m[[y,coop,season,c.group,c.item].join('|')]||0;rt+=q;h+=`<td>${q?fmt(q):''}</td>`}h+=`<td>${rt?fmt(rt):''}</td></tr>`}h+=`<tr class="stock-subtotal"><th></th><th>小計</th>`;let st=0;for(const c of cols){const q=S_SEASONS.reduce((a,se)=>a+(m[[y,coop,se,c.group,c.item].join('|')]||0),0);st+=q;h+=`<td>${q?fmt(q):''}</td>`}h+=`<td>${st?fmt(st):''}</td></tr>`}h+=`<tfoot><tr><th colspan="2">合計</th>`;let gt=0;for(const c of cols){const q=S_COOPS.reduce((a,co)=>a+S_SEASONS.reduce((b,se)=>b+(m[[y,co,se,c.group,c.item].join('|')]||0),0),0);gt+=q;h+=`<th>${q?fmt(q):''}</th>`}h+=`<th>${gt?fmt(gt):''}</th></tr></tfoot></table></div><p class="muted">0は空欄表示。確定済み出荷指示数量を差し引いた利用可能在庫です。</p></section>`;app.innerHTML=h;nsy.onchange=()=>{smState.activeYear=nsy.value;smSave();smStock()};nsh.onclick=smHome;nspdf.onclick=()=>smOpenStockPdf(y)}
function smReportCanvas(y,ship=null){const W=1684,H=1191,margin=34,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),cols=smItems(),title=ship?'出 荷 指 示 書（釧路産棹前昆布）':'釧 路 産 棹 前 昆 布　在 庫 集 計 表';x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#000';x.strokeStyle='#222';const f=(z,b=false)=>`${b?'700 ':'400 '}${z}px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif`,t=(v,xx,yy,z=13,a='center',b=false)=>{x.font=f(z,b);x.textAlign=a;x.textBaseline='middle';x.fillText(String(v??''),xx,yy)};t(title,margin,38,28,'left',true);t(`${y}年産`,W-margin,38,16,'right',true);if(ship){t(`指示番号：${ship.id}　出荷日：${ship.shipDate||''}`,W-margin,62,13,'right');t(`出荷先：${ship.dest?.name||''}　${ship.dest?.address||''}　TEL ${ship.dest?.phone||''}`,margin,62,12,'left')}const ty=ship?85:70,tw=W-margin*2,coopW=92,seasonW=45,totalW=58,dataW=tw-coopW-seasonW-totalW,colW=dataW/cols.length,shipmentTall=!!window.__v136SanmaeShipmentTall,shipmentMerged=!!window.__v136SanmaeShipmentMerged,h1=shipmentTall?44:28,h2=shipmentTall?44:28,rowH=shipmentTall?64:39,footH=shipmentTall?40:34,tableH=h1+h2+S_COOPS.length*(S_SEASONS.length+1)*rowH+footH;x.lineWidth=.55;x.strokeRect(margin,ty,tw,tableH);const xData=margin+coopW+seasonW;[margin+coopW,xData,xData+dataW].forEach(xx=>{x.beginPath();x.moveTo(xx,ty);x.lineTo(xx,ty+tableH);x.stroke()});const shHead=!!window.__v63ShipmentHeaderLarge;t('組合名',margin+coopW/2,ty+(h1+h2)/2,shHead?16:12);t('区分',margin+coopW+seasonW/2,ty+(h1+h2)/2,shHead?16:12);t('計',xData+dataW+totalW/2,ty+(h1+h2)/2,shHead?16:12);let ci=0;S_GROUPS.forEach(g=>{const gx=xData+ci*colW,gw=g.items.length*colW;x.strokeRect(gx,ty,gw,h1);t(g.name,gx+gw/2,ty+h1/2,shHead?23:10,'center',true);g.items.forEach((it,j)=>{const xx=gx+j*colW;x.strokeRect(xx,ty+h1,colW,h2);t(it,xx+colW/2,ty+h1+h2/2,shHead?21:8)});ci+=g.items.length});const mt=smMatrix(),lines=ship?.lines||null;const qFor=(coop,se,c)=>lines?lines.filter(l=>l.year===y&&l.coop===coop&&l.season===se&&l.group===c.group&&l.item===c.item).reduce((a,l)=>a+Number(l.qty||0),0):(mt[[y,coop,se,c.group,c.item].join('|')]||0);let yy=ty+h1+h2;for(const coop of S_COOPS){x.lineWidth=1.5;x.beginPath();x.moveTo(margin,yy);x.lineTo(margin+tw,yy);x.stroke();x.lineWidth=.55;for(let si=0;si<S_SEASONS.length;si++){const se=S_SEASONS[si];if(si===0)t(coop,margin+coopW/2,yy+(shipmentMerged?rowH*1.5:(window.__v58ShipmentCoopLower?rowH*1.7:rowH/2)),shipmentMerged?18:12,'center',true);t(se,margin+coopW+seasonW/2,yy+rowH/2,13,'center',true);let rt=0;cols.forEach((cc,j)=>{const q=qFor(coop,se,cc),xx=xData+j*colW;rt+=q;x.beginPath();x.moveTo(xx,yy);x.lineTo(xx,yy+rowH);x.stroke();if(q)t(fmt(q),xx+colW/2,yy+rowH/2,shipmentMerged?24:13)});if(rt)t(fmt(rt),xData+dataW+totalW/2,yy+rowH/2,shipmentMerged?24:13);x.beginPath();x.moveTo(shipmentMerged?margin+coopW:margin,yy+rowH);x.lineTo(margin+tw,yy+rowH);x.stroke();yy+=rowH}t('小計',margin+coopW+seasonW/2,yy+rowH/2,11);let st=0;cols.forEach((cc,j)=>{const q=S_SEASONS.reduce((a,se)=>a+qFor(coop,se,cc),0),xx=xData+j*colW;st+=q;if(q)t(fmt(q),xx+colW/2,yy+rowH/2,11)});if(st)t(fmt(st),xData+dataW+totalW/2,yy+rowH/2,11);x.beginPath();x.moveTo(margin,yy+rowH);x.lineTo(margin+tw,yy+rowH);x.stroke();yy+=rowH}x.lineWidth=1.5;x.beginPath();x.moveTo(margin,yy);x.lineTo(margin+tw,yy);x.stroke();x.lineWidth=.55;t('合計',margin+(coopW+seasonW)/2,yy+footH/2,12,'center',true);let gt=0;cols.forEach((cc,j)=>{const q=S_COOPS.reduce((a,co)=>a+S_SEASONS.reduce((b,se)=>b+qFor(co,se,cc),0),0),xx=xData+j*colW;gt+=q;if(q)t(fmt(q),xx+colW/2,yy+footH/2,shHead?18:12)});if(gt)t(fmt(gt),xData+dataW+totalW/2,yy+footH/2,shHead?18:12);return c}
async function smOpenStockPdf(y){const w=window.open('about:blank','_blank');if(!w)return alert('PDF画面を開けません。');try{const b=await _singleCanvasPdfBlob(smReportCanvas(y)),u=URL.createObjectURL(b);w.location.replace(u);setTimeout(()=>URL.revokeObjectURL(u),600000)}catch(e){w.close();alert('PDF作成に失敗しました。')}}
function smLogs(){const a=smState.records.slice().reverse();app.innerHTML=`<section class="card"><h2>釧路産棹前昆布 入出庫履歴</h2><div class="tablewrap"><table style="min-width:950px"><tr><th>日付</th><th>区分</th><th>年度</th><th>漁協</th><th>季節</th><th>分類</th><th>細分類</th><th>数量</th><th>操作</th></tr>${a.map(r=>`<tr><td>${r.date}</td><td>${r.type==='in'?'入庫':'出庫'}</td><td>${r.year}</td><td>${r.coop}</td><td>${r.season}</td><td>${esc(r.group)}</td><td>${esc(r.item)}</td><td>${fmt(r.qty)}</td><td><button class="mini" data-ne="${r.id}">修正</button> <button class="mini danger" data-nd="${r.id}">削除</button></td></tr>`).join('')}</table></div><button class="btn secondary" id="nlb">戻る</button></section>`;app.querySelectorAll('[data-ne]').forEach(b=>b.onclick=()=>smForm(null,b.dataset.ne));app.querySelectorAll('[data-nd]').forEach(b=>b.onclick=()=>{if(confirm('削除しますか？')){smState.records=smState.records.filter(r=>r.id!==b.dataset.nd);smSave();smLogs()}});nlb.onclick=smHome}
function smShipId(){return 'S'+String(smState.shipmentSeq++).padStart(5,'0')}
function smShipments(){app.innerHTML=`<section class="card"><div class="row"><h2>釧路産棹前昆布 出荷指示</h2><button class="mini" id="nnew">＋新規</button></div><div class="tablewrap"><table><tr><th>番号</th><th>出荷元</th><th>出荷先</th><th>出荷日</th><th>数量</th><th>状態</th><th></th></tr>${smState.shipments.slice().reverse().map(s=>`<tr><td>${s.id}</td><td>${esc(s.source?.name||'')}</td><td>${esc(s.dest?.name||'')}</td><td>${s.shipDate||''}</td><td>${fmt((s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0))}</td><td>${s.status}</td><td><button class="mini" data-ns="${s.id}">開く</button></td></tr>`).join('')}</table></div><button class="btn secondary" id="nsb">戻る</button></section>`;nnew.onclick=()=>smShipForm();app.querySelectorAll('[data-ns]').forEach(b=>b.onclick=()=>smShipDetail(b.dataset.ns));nsb.onclick=smHome}
function smShipForm(id=null){const s=id?smState.shipments.find(x=>x.id===id):null;let lines=s?.lines?.map(x=>({...x}))||[];app.innerHTML=`<section class="card"><h2>釧路産棹前昆布 ${s?'出荷指示修正':'新規出荷指示'}</h2><div class="form"><label>出荷元 会社名<input id="nsrc" value="${esc(s?.source?.name||'㈱浜中運輸')}"></label><label>出荷元 住所<input id="nsrca" value="${esc(s?.source?.address||'')}"></label><label>出荷元 電話<input id="nsrcp" value="${esc(s?.source?.phone||'')}"></label><label>出荷先 会社名<input id="ndst" value="${esc(s?.dest?.name||'')}"></label><label>出荷先 住所<input id="ndsta" value="${esc(s?.dest?.address||'')}"></label><label>出荷先 電話<input id="ndstp" value="${esc(s?.dest?.phone||'')}"></label><div class="subgrid"><label>出荷日<input id="nsd" type="date" value="${s?.shipDate||today()}"></label><label>希望着日<input id="nad" type="date" value="${s?.arrivalDate||''}"></label></div><div id="nsl"></div><button class="btn secondary" id="nala">＋明細追加</button><button class="btn" id="nssv">保存</button><button class="btn secondary" id="nsfb">戻る</button></div></section>`;function rend(){nsl.innerHTML=lines.map((l,i)=>`<div class="card" style="background:#f8fafc"><label>年度<select data-ni="${i}" data-nf="year">${smYearOptions(l.year)}</select></label><label>漁協<select data-ni="${i}" data-nf="coop">${S_COOPS.map(x=>`<option ${x===l.coop?'selected':''}>${x}</option>`).join('')}</select></label><label>区分<select data-ni="${i}" data-nf="season">${S_SEASONS.map(x=>`<option ${x===l.season?'selected':''}>${x}</option>`).join('')}</select></label><label>分類<select data-ni="${i}" data-nf="gi">${smItemOptions(l.group,l.item)}</select></label><label>数量<input type="number" value="${esc(l.qty||'')}" data-ni="${i}" data-nf="qty"></label><button class="mini danger" data-nr="${i}">削除</button></div>`).join('');nsl.querySelectorAll('[data-nf]').forEach(e=>e.onchange=()=>{const i=+e.dataset.ni;if(e.dataset.nf==='gi'){[lines[i].group,lines[i].item]=e.value.split('|')}else lines[i][e.dataset.nf]=e.value});nsl.querySelectorAll('[data-nr]').forEach(e=>e.onclick=()=>{lines.splice(+e.dataset.nr,1);rend()})}nala.onclick=()=>{lines.push({year:smState.activeYear,coop:S_COOPS[0],season:'採り',group:S_GROUPS[0].name,item:S_GROUPS[0].items[0],qty:''});rend()};nssv.onclick=()=>{if(!ndst.value.trim()||!lines.length)return alert('出荷先と明細を入力してください。');for(const l of lines){l.qty=Number(l.qty);if(!l.qty||l.qty>smAvail(l.year,l.coop,l.season,l.group,l.item,s?.id))return alert(`${l.coop} ${l.season} ${l.group} ${l.item} の在庫が不足しています。`)}const o=s||{id:smShipId(),status:'draft',createdAt:new Date().toISOString()};Object.assign(o,{source:{name:nsrc.value,address:nsrca.value,phone:nsrcp.value},dest:{name:ndst.value,address:ndsta.value,phone:ndstp.value},shipDate:nsd.value,arrivalDate:nad.value,lines});if(!s)smState.shipments.push(o);smSave();smShipDetail(o.id)};nsfb.onclick=smShipments;rend()}
function smShipDetail(id){const s=smState.shipments.find(x=>x.id===id);if(!s)return smShipments();app.innerHTML=`<section class="card"><div class="row"><h2>釧路産棹前昆布 出荷指示 ${s.id}</h2><span class="pill">${s.status}</span></div><p><b>出荷先：</b>${esc(s.dest?.name||'')}　<b>出荷元：</b>${esc(s.source?.name||'')}</p><p><b>出荷日：</b>${s.shipDate||''}　<b>合計：</b>${fmt((s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0))}</p><div class="toolbar"><button class="btn" id="smpdfs">帳票を確認</button>${s.status==='draft'?'<button class="btn" id="smconf">確定・在庫反映</button><button class="btn secondary" id="smedit">修正</button>':''}${s.status==='confirmed'?'<button class="btn" id="smshipped">出荷済</button>':''}
${s.status!=='shipped'&&s.status!=='cancelled'?'<button class="btn danger" id="smcancel">取消</button>':''}
<button class="btn secondary" id="smback">一覧へ</button>${s.status==='confirmed'?'<button class="btn" id="smshipped">出荷済</button>':''}
${s.status!=='shipped'&&s.status!=='cancelled'?'<button class="btn danger" id="smcancel">取消</button>':''}
<button class="btn secondary" id="smback">一覧へ</button></div></section>`;const pdf=document.getElementById('smpdfs');if(pdf)pdf.onclick=()=>smOpenShipPdf(s);if(s.status==='draft'){const c=document.getElementById('smconf');if(c)c.onclick=()=>{for(const l of s.lines)if(Number(l.qty)>v160AvailableForShipmentLine('sanmae',l,s.id))return alert('在庫不足があります。');s.status='confirmed';s.confirmedAt=new Date().toISOString();smSave();alert('出荷指示を確定し、在庫表へ反映しました。');smShipDetail(id)};const e=document.getElementById('smedit');if(e)e.onclick=()=>v114UnifiedShipmentForm('sanmae',id)}if(s.status==='confirmed'){
  const sh=document.getElementById('smshipped');

  if(sh)sh.onclick=()=>{
    const inv=window.KombuRefactor?.Inventory;

    for(const l of s.lines){
      const av=inv?.getAvailableQuantity
        ? inv.getAvailableQuantity(
            'sanmae',
            {
              year:l.year,
              coop:l.coop,
              season:l.season,
              group:l.group,
              item:l.item
            },
            s.id
          )
        : smAvail(
            l.year,
            l.coop,
            l.season,
            l.group,
            l.item,
            s.id
          );

      if(Number(l.qty)>Math.max(0,Number(av||0))){
        return alert(
          `${l.coop} ${l.season} ${l.group} ${l.item} の出荷可能在庫が不足しています。`
        );
      }
    }

    if(!window.confirm(
      '出荷済みにすると、明細数量を在庫から出庫します。よろしいですか？'
    ))return;

    s.lines.forEach(l=>
      smState.records.push({
        id:crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()+Math.random()),
        type:'out',
        year:l.year,
        coop:l.coop,
        season:l.season,
        group:l.group,
        item:l.item,
        qty:Number(l.qty),
        date:s.shipDate||today(),
        memo:`出荷指示 ${s.id}`
      })
    );

    s.status='shipped';
    s.shippedAt=new Date().toISOString();

    smSave();
    smShipDetail(id);
  };
const cancelBtn=document.getElementById('smcancel');

if(cancelBtn){
  cancelBtn.onclick=()=>{
    if(!window.confirm(
      s.status==='confirmed'
        ? '取消すると在庫表へ数量を戻します。よろしいですか？'
        : 'この出荷指示を取消しますか？'
    ))return;

    s.status='cancelled';
    s.cancelledAt=new Date().toISOString();

    smSave();
    alert('出荷指示を取消しました');
    smShipDetail(id);
  };
}
}const b=document.getElementById('smback');if(b)b.onclick=smShipments}
async function smOpenShipPdf(s){const w=window.open('about:blank','_blank');if(!w)return alert('PDF画面を開けません。');try{const ys=[...new Set(s.lines.map(l=>l.year))],ims=[];for(const y of ys)ims.push({bytes:await _canvasJpegBytes(smReportCanvas(y,s)),w:1684,h:1191});const objs=[],pageIds=[],imgIds=[],contentIds=[];let id=1,catalog=id++,pages=id++;ims.forEach(()=>{pageIds.push(id++);imgIds.push(id++);contentIds.push(id++)});objs[catalog]=_ascii(`<< /Type /Catalog /Pages ${pages} 0 R >>`);objs[pages]=_ascii(`<< /Type /Pages /Count ${ims.length} /Kids [${pageIds.map(x=>x+' 0 R').join(' ')}] >>`);ims.forEach((im,i)=>{objs[pageIds[i]]=_ascii(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im0 ${imgIds[i]} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`);objs[imgIds[i]]=_concatBytes([_ascii(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`),im.bytes,_ascii('\nendstream')]);const st='q\n841.89 0 0 595.28 0 0 cm\n/Im0 Do\nQ\n';objs[contentIds[i]]=_ascii(`<< /Length ${st.length} >>\nstream\n${st}endstream`)});const n=id-1,parts=[_ascii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offs=Array(n+1).fill(0);let pos=parts[0].length;for(let i=1;i<=n;i++){offs[i]=pos;const a=_ascii(`${i} 0 obj\n`),bb=objs[i],cc=_ascii('\nendobj\n');parts.push(a,bb,cc);pos+=a.length+bb.length+cc.length}const xp=pos;let xr=`xref\n0 ${n+1}\n0000000000 65535 f \n`;for(let i=1;i<=n;i++)xr+=String(offs[i]).padStart(10,'0')+' 00000 n \n';xr+=`trailer\n<< /Size ${n+1} /Root ${catalog} 0 R >>\nstartxref\n${xp}\n%%EOF`;parts.push(_ascii(xr));const b=new Blob(parts,{type:'application/pdf'}),u=URL.createObjectURL(b);w.location.replace(u);setTimeout(()=>URL.revokeObjectURL(u),600000)}catch(e){try{w.close()}catch{}alert('PDF作成に失敗しました。\n'+(e.message||e))}}
function smMore(){app.innerHTML=`<section class="card"><h2>釧路産棹前昆布 その他</h2><div class="form"><button class="btn secondary" id="nprod">← 昆布選択画面へ</button><button class="btn secondary" id="nbk">釧路産棹前昆布バックアップ保存</button><input id="nrf" type="file" accept="application/json" hidden><button class="btn secondary" id="nrs">釧路産棹前昆布バックアップ復元</button><button class="btn secondary" id="nhm">ホーム</button></div></section>`;nprod.onclick=productLanding;nbk.onclick=()=>download('釧路産棹前昆布バックアップ_'+today()+'.json',JSON.stringify(smState,null,2),'application/json');nrs.onclick=()=>nrf.click();nrf.onchange=()=>{const f=nrf.files?.[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{try{smState=JSON.parse(rd.result);smSave();alert('復元しました');smHome()}catch{alert('復元できませんでした')}};rd.readAsText(f)};nhm.onclick=smHome}


/* ===== v35: iPhone Safari PDF/FAX white-screen fix =====
   Avoid Blob-PDF navigation for 釧路産棹前昆布. Render a print-ready HTML sheet first,
   then let iOS/Safari create/share PDF through its native print sheet. */
smOpenShipPdf=function(s){
  if(!s)return alert('出荷指示データが見つかりません。');
  const w=window.open('about:blank','_blank');
  if(!w)return alert('PDF・FAX用画面を開けませんでした。Safariのポップアップ設定を確認してください。');
  try{
    const cols=smItems();
    const years=[...new Set((s.lines||[]).map(l=>l.year||smState.activeYear))].sort((a,b)=>S_YEARS.indexOf(a)-S_YEARS.indexOf(b));
    const totalAll=(s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0);
    const src=s.source||{}, dst=s.dest||{};
    const pages=years.map(year=>{
      const lines=(s.lines||[]).filter(l=>(l.year||smState.activeYear)===year);
      let body='';
      for(const coop of S_COOPS){
        for(let si=0;si<S_SEASONS.length;si++){
          const season=S_SEASONS[si];
          const rowLines=lines.filter(l=>l.coop===coop&&l.season===season);
          const rt=rowLines.reduce((a,l)=>a+Number(l.qty||0),0);
          body+=`<tr>${si===0?`<th rowspan="${S_SEASONS.length+1}" class="coop">${esc(coop)}</th>`:''}<th class="season">${esc(season)}</th>${cols.map(c=>{const q=rowLines.filter(l=>l.group===c.group&&l.item===c.item).reduce((a,l)=>a+Number(l.qty||0),0);return `<td>${q?fmt(q):''}</td>`}).join('')}<td>${rt?fmt(rt):''}</td></tr>`;
        }
        const cl=lines.filter(l=>l.coop===coop),ct=cl.reduce((a,l)=>a+Number(l.qty||0),0);
        body+=`<tr class="subtotal"><th>小計</th>${cols.map(c=>{const q=cl.filter(l=>l.group===c.group&&l.item===c.item).reduce((a,l)=>a+Number(l.qty||0),0);return `<td>${q?fmt(q):''}</td>`}).join('')}<td>${ct?fmt(ct):''}</td></tr>`;
      }
      const yt=lines.reduce((a,l)=>a+Number(l.qty||0),0);
      const totalRow=`<tr class="grand"><th colspan="2">合計</th>${cols.map(c=>{const q=lines.filter(l=>l.group===c.group&&l.item===c.item).reduce((a,l)=>a+Number(l.qty||0),0);return `<td>${q?fmt(q):''}</td>`}).join('')}<td>${yt?fmt(yt):''}</td></tr>`;
      let groupHead='',itemHead='';
      for(const g of S_GROUPS){groupHead+=`<th colspan="${g.items.length}">${esc(g.name)}</th>`;itemHead+=g.items.map(i=>`<th>${esc(i)}</th>`).join('')}
      return `<section class="sheet"><div class="head"><div><div class="title">出 荷 指 示 書</div><div class="subtitle">釧路産棹前昆布</div></div><div class="meta">指示番号：${esc(s.id||'')}<br>作成日：${esc(today())}</div></div><div class="info"><div><b>出荷先：</b>${esc(dst.name||'')} 御中<br>住所：${esc(dst.address||'')}<br>電話：${esc(dst.phone||'')}</div><div><b>出荷元：</b>${esc(src.name||'')}<br>住所：${esc(src.address||'')}<br>電話：${esc(src.phone||'')}</div><div><b>出荷日：</b>${esc(s.shipDate||'')}<br><b>希望着日：</b>${esc(s.arrivalDate||'')}<br><b>合計：</b>${fmt(yt)}</div></div><div class="year">${esc(year)}年産</div><table><thead><tr><th rowspan="2">組合名</th><th rowspan="2">区分</th>${groupHead}<th rowspan="2">計</th></tr><tr>${itemHead}</tr></thead><tbody>${body}${totalRow}</tbody></table><div class="memo"><b>備考：</b>${esc(s.memo||'')}</div><div class="signs"><div>出荷元：${esc(src.name||'')}</div><div>受注・配送指示：</div><div>FAX送信欄：</div></div></section>`;
    }).join('');
    const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><title>釧路産棹前昆布 出荷指示書 ${esc(s.id||'')}</title><style>@page{size:A4 landscape;margin:7mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#eef2f6;color:#000;font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Yu Gothic",sans-serif}.toolbar{position:sticky;top:0;z-index:5;background:#173661;color:white;padding:10px;display:flex;gap:8px;justify-content:center}.toolbar button{border:0;border-radius:10px;padding:11px 16px;font-size:16px;font-weight:700}.primary{background:white;color:#173661}.secondary{background:#dfe7f1;color:#173661}.hint{background:#fff7d6;color:#5c4b00;padding:9px 12px;text-align:center;font-size:13px}.sheet{width:281mm;min-height:194mm;margin:10px auto;background:white;padding:6mm;page-break-after:always}.sheet:last-child{page-break-after:auto}.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #000;padding-bottom:4px}.title{font-size:22px;font-weight:800;letter-spacing:5px}.subtitle{font-size:12px;margin-top:2px}.meta{text-align:right;font-size:10px;line-height:1.5}.info{display:grid;grid-template-columns:1fr 1fr .8fr;gap:5px;margin:6px 0;font-size:9px}.info>div,.memo,.signs>div{border:1px solid #222;padding:4px}.year{font-weight:800;font-size:12px;margin:4px 0}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7px}th,td{border:.5px solid #333;text-align:center;padding:1px;height:18px;white-space:nowrap;overflow:hidden}thead th{background:#eee}.coop{width:50px}.season{width:24px}.subtotal th,.subtotal td{border-top:1px solid #111}.grand th,.grand td{border-top:1.5px solid #000;font-weight:700}.memo{margin-top:5px;min-height:24px;font-size:9px}.signs{display:grid;grid-template-columns:1fr 1.5fr 1fr;gap:5px;margin-top:5px;font-size:9px}.signs>div{height:28px}@media print{html,body{background:white}.toolbar,.hint{display:none}.sheet{margin:0;width:auto;min-height:auto;padding:0}}</style></head><body><div class="toolbar"><button class="primary" id="printBtn">PDF・印刷・FAXへ</button><button class="secondary" id="closeBtn">元の画面に戻る</button></div><div class="hint">帳票が表示されていれば正常です。「PDF・印刷・FAXへ」を押すとiPhoneの印刷画面が開き、PDFとして共有・保存できます。</div>${pages}<script>document.getElementById('printBtn').onclick=function(){window.print()};document.getElementById('closeBtn').onclick=function(){if(window.opener)window.close();else history.back()};<\/script></body></html>`;
    w.document.open();w.document.write(html);w.document.close();setTimeout(()=>w.focus(),50);
  }catch(e){
    try{w.document.open();w.document.write('<meta name="viewport" content="width=device-width"><div style="font-family:-apple-system;padding:24px"><h3>出荷指示書を表示できませんでした。</h3><p>'+String(e&&e.message?e.message:e).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c])+'</p></div>');w.document.close()}catch(_e){}
  }
};


/* ===== v36: reliable iPhone print preview + cache escape ===== */
smOpenShipPdf=function(s){
  if(!s)return alert('出荷指示データが見つかりません。');
  try{
    const cols=smItems();
    const years=[...new Set((s.lines||[]).map(l=>l.year||smState.activeYear))].sort((a,b)=>S_YEARS.indexOf(a)-S_YEARS.indexOf(b));
    const src=s.source||{}, dst=s.dest||{};
    const pages=years.map(year=>{
      const lines=(s.lines||[]).filter(l=>(l.year||smState.activeYear)===year);
      let body='';
      for(const coop of S_COOPS){
        for(let si=0;si<S_SEASONS.length;si++){
          const season=S_SEASONS[si], rowLines=lines.filter(l=>l.coop===coop&&l.season===season);
          const rt=rowLines.reduce((a,l)=>a+Number(l.qty||0),0);
          body+=`<tr>${si===0?`<th rowspan="${S_SEASONS.length+1}" class="sm-coop">${esc(coop)}</th>`:''}<th class="sm-season">${esc(season)}</th>${cols.map(c=>{const q=rowLines.filter(l=>l.group===c.group&&l.item===c.item).reduce((a,l)=>a+Number(l.qty||0),0);return `<td>${q?fmt(q):''}</td>`}).join('')}<td>${rt?fmt(rt):''}</td></tr>`;
        }
        const cl=lines.filter(l=>l.coop===coop),ct=cl.reduce((a,l)=>a+Number(l.qty||0),0);
        body+=`<tr class="sm-subtotal"><th>小計</th>${cols.map(c=>{const q=cl.filter(l=>l.group===c.group&&l.item===c.item).reduce((a,l)=>a+Number(l.qty||0),0);return `<td>${q?fmt(q):''}</td>`}).join('')}<td>${ct?fmt(ct):''}</td></tr>`;
      }
      const yt=lines.reduce((a,l)=>a+Number(l.qty||0),0);
      const totalRow=`<tr class="sm-grand"><th colspan="2">合計</th>${cols.map(c=>{const q=lines.filter(l=>l.group===c.group&&l.item===c.item).reduce((a,l)=>a+Number(l.qty||0),0);return `<td>${q?fmt(q):''}</td>`}).join('')}<td>${yt?fmt(yt):''}</td></tr>`;
      let groupHead='',itemHead='';
      for(const g of S_GROUPS){groupHead+=`<th colspan="${g.items.length}">${esc(g.name)}</th>`;itemHead+=g.items.map(i=>`<th>${esc(i)}</th>`).join('')}
      return `<section class="sm-sheet"><div class="sm-head"><div><div class="sm-title">出 荷 指 示 書</div><div class="sm-subtitle">釧路産棹前昆布</div></div><div class="sm-meta">指示番号：${esc(s.id||'')}<br>作成日：${esc(today())}</div></div><div class="sm-info"><div><b>出荷先：</b>${esc(dst.name||'')} 御中<br>住所：${esc(dst.address||'')}<br>電話：${esc(dst.phone||'')}</div><div><b>出荷元：</b>${esc(src.name||'')}<br>住所：${esc(src.address||'')}<br>電話：${esc(src.phone||'')}</div><div><b>出荷日：</b>${esc(s.shipDate||'')}<br><b>希望着日：</b>${esc(s.arrivalDate||'')}<br><b>合計：</b>${fmt(yt)}</div></div><div class="sm-year">${esc(year)}年産</div><table class="sm-table"><thead><tr><th rowspan="2">組合名</th><th rowspan="2">区分</th>${groupHead}<th rowspan="2">計</th></tr><tr>${itemHead}</tr></thead><tbody>${body}${totalRow}</tbody></table><div class="sm-memo"><b>備考：</b>${esc(s.memo||'')}</div><div class="sm-signs"><div>出荷元：${esc(src.name||'')}</div><div>受注・配送指示：</div><div>FAX送信欄：</div></div></section>`;
    }).join('');
    app.innerHTML=`<style id="smPrintStyle">#smPrintView{margin:-14px -12px 0}.sm-screenbar{position:sticky;top:0;z-index:20;background:#173661;color:#fff;padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.sm-screenbar button{border:0;border-radius:10px;padding:12px;font-size:16px;font-weight:700}.sm-print{background:#fff;color:#173661}.sm-back{background:#dfe7f1;color:#173661}.sm-hint{background:#fff3bf;color:#5c4b00;padding:10px;text-align:center;font-size:13px}.sm-preview{overflow:auto;background:#eef2f6;padding:8px}.sm-sheet{width:281mm;min-height:194mm;margin:0 auto 10px;background:#fff;color:#000;padding:6mm;box-shadow:0 2px 8px #0002}.sm-head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #000;padding-bottom:4px}.sm-title{font-size:22px;font-weight:800;letter-spacing:5px}.sm-subtitle{font-size:12px}.sm-meta{text-align:right;font-size:10px;line-height:1.5}.sm-info{display:grid;grid-template-columns:1fr 1fr .8fr;gap:5px;margin:6px 0;font-size:9px}.sm-info>div,.sm-memo,.sm-signs>div{border:1px solid #222;padding:4px}.sm-year{font-weight:800;font-size:12px;margin:4px 0}.sm-table{width:100%;min-width:0;border-collapse:collapse;table-layout:fixed;font-size:7px}.sm-table th,.sm-table td{border:.5px solid #333;text-align:center;padding:1px;height:18px;white-space:nowrap;overflow:hidden}.sm-table thead th{background:#eee}.sm-coop{width:50px}.sm-season{width:24px}.sm-subtotal th,.sm-subtotal td{border-top:1px solid #111}.sm-grand th,.sm-grand td{border-top:1.5px solid #000;font-weight:700}.sm-memo{margin-top:5px;min-height:24px;font-size:9px}.sm-signs{display:grid;grid-template-columns:1fr 1.5fr 1fr;gap:5px;margin-top:5px;font-size:9px}.sm-signs>div{height:28px}@media print{@page{size:A4 landscape;margin:7mm}header,nav,.sm-screenbar,.sm-hint{display:none!important}main{padding:0!important;max-width:none!important}.sm-preview{overflow:visible;background:#fff;padding:0}.sm-sheet{margin:0;width:auto;min-height:auto;padding:0;box-shadow:none;page-break-after:always}.sm-sheet:last-child{page-break-after:auto}}</style><div id="smPrintView"><div class="sm-screenbar"><button class="sm-print" id="smDoPrint">PDF・印刷・FAXへ</button><button class="sm-back" id="smPrintBack">出荷指示へ戻る</button></div><div class="sm-hint"><b>v36 帳票プレビュー</b> — 下に出荷指示書が見えていれば正常です。</div><div class="sm-preview">${pages}</div></div>`;
    document.getElementById('smDoPrint').onclick=()=>window.print();
    document.getElementById('smPrintBack').onclick=()=>smShipDetail(s.id);
    window.scrollTo(0,0);
  }catch(e){alert('帳票を表示できませんでした。\n'+(e.message||e));}
};


/* ===== v37: navigation + product selector + shared company master ===== */
function currentProductHome(){
  if(currentProduct==='hidaka') return hHome();
  if(currentProduct==='nemuro') return nHome();
  if(currentProduct==='sanmae') return smHome();
  return home();
}

bindNav=function(){
 if(homeNavBtnEl)homeNavBtnEl.onclick=currentProductHome;
 if(shipNavBtnEl)shipNavBtnEl.onclick=()=>currentProduct==='hidaka'?hShipments():currentProduct==='nemuro'?nShipments():currentProduct==='sanmae'?smShipments():shipments();
 if(stockNavBtnEl)stockNavBtnEl.onclick=()=>currentProduct==='hidaka'?hStock():currentProduct==='nemuro'?nStock():currentProduct==='sanmae'?smStock():stock();
 if(logsNavBtnEl)logsNavBtnEl.onclick=()=>currentProduct==='hidaka'?hLogs():currentProduct==='nemuro'?nLogs():currentProduct==='sanmae'?smLogs():logs();
 if(inNavBtnEl)inNavBtnEl.onclick=()=>currentProduct==='hidaka'?hForm('in'):currentProduct==='nemuro'?nForm('in'):currentProduct==='sanmae'?smForm('in'):form('in');
 if(moreBtnEl)moreBtnEl.onclick=()=>currentProduct==='hidaka'?hMore():currentProduct==='nemuro'?nMore():currentProduct==='sanmae'?smMore():exportsPage();
}

function companyMasterPage(){
  currentProduct=null; setHeader('会社マスター'); setNavVisible(false);
  let editIndex=-1;
  const draw=()=>{
    const editing=editIndex>=0&&state.companies[editIndex];
    const draft=editing||{name:'',postal:'',address:'',phone:'',region:'',toyamaRegion:'',favoriteSource:false,favoriteDestination:false};
    const favSource=!!(draft.favoriteSource ?? draft.favorite);
    const favDest=!!(draft.favoriteDestination ?? draft.favorite);
    const regionOpts=['','北海道・東北','関東','中部東海','北陸','関西','中四国九州'].map(x=>`<option value="${esc(x)}" ${String(draft.region||'')===x?'selected':''}>${x||'選択してください'}</option>`).join('');
    const toyamaOpts=['','高岡','呉西その他','富山','呉東その他'].map(x=>`<option value="${esc(x)}" ${String(draft.toyamaRegion||'')===x?'selected':''}>${x||'該当なし'}</option>`).join('');
    app.innerHTML=`<section class="card" style="margin-top:22px"><div class="row"><h2>会社マスター</h2><span class="pill">v37</span></div><p class="muted">出荷指示で使用する会社情報を登録します。「よく使う出荷人」「よく使う出荷先」は、新規出荷依頼画面の最上部プルダウンに表示されます。</p>
    <h3>登録済み会社</h3><div id="globalCompanyList" class="master-list"></div>
    <hr><h3 id="globalCompanyFormTitle">${editing?'会社を編集':'新しい会社を登録'}</h3>
    <div class="card" style="margin:6px 0;padding:10px;background:#f8fafc"><div class="form">
      <label>会社名<input id="globalCompanyName" value="${esc(draft.name||'')}" autocomplete="organization"></label>
      <label>郵便番号<input id="globalCompanyPostal" value="${esc(draft.postal||draft.postal_code||'')}" inputmode="numeric" placeholder="123-4567"></label>
      <label>住所<input id="globalCompanyAddress" value="${esc(draft.address||'')}" autocomplete="street-address"></label>
      <label>電話番号<input id="globalCompanyPhone" value="${esc(draft.phone||'')}" inputmode="tel" autocomplete="tel"></label>
      <label>地区<select id="globalCompanyRegion">${regionOpts}</select></label>
      <label>富山地区<select id="globalCompanyToyamaRegion">${toyamaOpts}</select></label>
      <label style="display:flex;align-items:center;gap:8px"><input id="globalFavoriteSource" type="checkbox" ${favSource?'checked':''} style="width:auto">よく使う出荷人</label>
      <label style="display:flex;align-items:center;gap:8px"><input id="globalFavoriteDestination" type="checkbox" ${favDest?'checked':''} style="width:auto">よく使う出荷先</label>
      <button class="btn" id="globalSaveCompanies" type="button">${editing?'変更を保存':'この会社を登録'}</button>
      ${editing?'<button class="btn secondary" id="globalCancelEdit" type="button">編集をやめる</button>':''}
    </div></div>
    <button class="btn secondary" id="globalMasterBack" style="margin-top:10px">← 昆布選択画面へ戻る</button></section>`;

    const list=document.getElementById('globalCompanyList');
    list.innerHTML=state.companies.map((v,i)=>`<div class="card" style="margin:6px 0;padding:10px;background:#f8fafc"><div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap"><div style="min-width:0;flex:1"><b>${esc(v.name)}</b>${v.postal?`<div class="small" style="margin-top:4px">〒${esc(v.postal)}</div>`:''}${v.address?`<div class="small" style="margin-top:2px">${esc(v.address)}</div>`:''}${v.phone?`<div class="small" style="margin-top:2px">TEL ${esc(v.phone)}</div>`:''}<div class="small" style="margin-top:4px">${v.region?`地区：${esc(v.region)}${v.toyamaRegion?` / ${esc(v.toyamaRegion)}`:''}`:''}${(v.favoriteSource??v.favorite)?'　★よく使う出荷人':''}${(v.favoriteDestination??v.favorite)?'　★よく使う出荷先':''}</div></div><div style="display:flex;gap:6px"><button class="mini" data-gce="${i}" type="button">編集</button><button class="mini danger" data-gcd="${i}" type="button">削除</button></div></div></div>`).join('')||'<div class="empty">会社はまだ登録されていません。</div>';


    list.onclick=e=>{
      const edit=e.target.dataset.gce;
      if(edit!==undefined){editIndex=+edit;draw();document.getElementById('globalCompanyName')?.focus();return;}
      const del=e.target.dataset.gcd;
      if(del!==undefined){
        const i=+del, c=state.companies[i];
        if(!c)return;
        if(!confirm(`「${c.name}」を会社マスターから削除しますか？`))return;
        state.companies.splice(i,1);
        if(editIndex===i)editIndex=-1; else if(editIndex>i)editIndex--;
        save();draw();
      }
    };

    document.getElementById('globalSaveCompanies').onclick=()=>{
      const name=(document.getElementById('globalCompanyName')?.value||'').trim();
      const postal=(document.getElementById('globalCompanyPostal')?.value||'').trim();
      const address=(document.getElementById('globalCompanyAddress')?.value||'').trim();
      const phone=(document.getElementById('globalCompanyPhone')?.value||'').trim();
      const region=(document.getElementById('globalCompanyRegion')?.value||'').trim();
      const toyamaRegion=(document.getElementById('globalCompanyToyamaRegion')?.value||'').trim();
      const favoriteSource=!!document.getElementById('globalFavoriteSource')?.checked;
      const favoriteDestination=!!document.getElementById('globalFavoriteDestination')?.checked;
      if(!name){alert('会社名を入力してください。');document.getElementById('globalCompanyName')?.focus();return;}
      if(postal&&!/^\d{3}-\d{4}$/.test(postal)){alert('郵便番号は123-4567形式で入力してください。');document.getElementById('globalCompanyPostal')?.focus();return;}
      const duplicate=state.companies.findIndex((c,i)=>i!==editIndex&&String(c?.name||'').trim()===name);
      if(duplicate>=0){alert('同じ会社名がすでに登録されています。');document.getElementById('globalCompanyName')?.focus();return;}
      const payload={name,postal,address,phone,region,toyamaRegion,favoriteSource,favoriteDestination};
      if(editIndex>=0&&state.companies[editIndex]){
        state.companies[editIndex]={...state.companies[editIndex],...payload};
        save();editIndex=-1;alert('会社情報を変更しました。');draw();
      }else{
        state.companies.push(payload);
        save();alert('会社を登録しました。');draw();
      }
      document.getElementById('globalCompanyName')?.focus();
    };

    const cancel=document.getElementById('globalCancelEdit');
    if(cancel)cancel.onclick=()=>{editIndex=-1;draw();document.getElementById('globalCompanyName')?.focus();};
    document.getElementById('globalMasterBack').onclick=productLanding;
  }; draw();
}

productLanding=function(){
 currentProduct=null;setHeader('昆布在庫管理');setNavVisible(false);
 app.innerHTML=`<section class="card" style="margin-top:22px"><h2>管理する昆布を選択 <span style="font-size:12px;font-weight:700;background:#e8eef6;padding:4px 8px;border-radius:999px;vertical-align:middle">v37</span></h2><p class="muted">4種類の昆布は、在庫・入出庫履歴・出荷指示をそれぞれ別に管理します。</p><div class="grid" style="margin-top:16px"><button class="action orange" id="chooseK"><b style="font-size:20px">釧路産昆布</b><small>在庫管理・PDF入庫・出荷指示</small></button><button class="action green" id="chooseH"><b style="font-size:20px">日高昆布</b><small>日高昆布専用の在庫管理・PDF入庫・出荷指示</small></button><button class="action blue" id="chooseN"><b style="font-size:20px">根室産昆布</b><small>根室産昆布専用の在庫管理・PDF入庫・出荷指示</small></button><button class="action purple" id="chooseS"><b style="font-size:20px">釧路産棹前昆布</b><small>棹前昆布専用の在庫管理・PDF入庫・出荷指示</small></button></div><hr style="border:0;border-top:1px solid #d9e2ec;margin:18px 0"><button class="action gray" id="companyMasterTop" style="width:100%"><b style="font-size:18px">⚙ 会社マスター</b><small>会社名・住所・電話番号を編集</small></button></section>`;
 document.getElementById('chooseK').onclick=()=>{currentProduct='kushiro';setHeader('釧路産昆布 在庫管理');setNavVisible(true);bindNav();home()};
 document.getElementById('chooseH').onclick=()=>{currentProduct='hidaka';setHeader('日高昆布 在庫管理');setNavVisible(true);bindNav();hHome()};
 document.getElementById('chooseN').onclick=()=>{currentProduct='nemuro';setHeader('根室産昆布 在庫管理');setNavVisible(true);bindNav();nHome()};
 document.getElementById('chooseS').onclick=()=>{currentProduct='sanmae';setHeader('釧路産棹前昆布 在庫管理');setNavVisible(true);bindNav();smHome()};
 document.getElementById('companyMasterTop').onclick=companyMasterPage;
}

const _v36KushiroHome=home;
home=function(){
 _v36KushiroHome();
 const grid=app.querySelector('.grid');
 if(grid&&!document.getElementById('kProductSelect')){
   const b=document.createElement('button'); b.className='action gray'; b.id='kProductSelect'; b.innerHTML='← 昆布選択画面へ<small>釧路・日高・根室・棹前の選択へ戻る</small>'; grid.appendChild(b); b.onclick=productLanding;
 }
};

function attachSharedCompanyMaster(nameId,addressId,phoneId){
 const nameEl=document.getElementById(nameId), addressEl=document.getElementById(addressId), phoneEl=document.getElementById(phoneId); if(!nameEl)return;
 let dl=document.getElementById('sharedCompanyNames'); if(!dl){dl=document.createElement('datalist');dl.id='sharedCompanyNames';dl.innerHTML=companyDatalist();app.prepend(dl)}
 nameEl.setAttribute('list','sharedCompanyNames');
 const fill=()=>{const c=companyByName(nameEl.value);if(c){addressEl.value=c.address||'';phoneEl.value=c.phone||''}}; nameEl.addEventListener('change',fill);
 if(nameEl.value&&(!addressEl.value&&!phoneEl.value))fill();
}
const _v36HShipForm=hShipForm; hShipForm=function(id=null){_v36HShipForm(id);attachSharedCompanyMaster('hsrc','hsrca','hsrcp');attachSharedCompanyMaster('hdst','hdsta','hdstp')};
const _v36NShipForm=nShipForm; nShipForm=function(id=null){_v36NShipForm(id);attachSharedCompanyMaster('nsrc','nsrca','nsrcp');attachSharedCompanyMaster('ndst','ndsta','ndstp')};
const _v36SmShipForm=smShipForm; smShipForm=function(id=null){_v36SmShipForm(id);attachSharedCompanyMaster('nsrc','nsrca','nsrcp');attachSharedCompanyMaster('ndst','ndsta','ndstp')};

bindNav();
productLanding();

/* ===== v38: split inventory management and shipment entry ===== */
function openProductContext(product, mode){
  currentProduct=product;
  const names={kushiro:'釧路産昆布',hidaka:'日高昆布',nemuro:'根室産昆布',sanmae:'釧路産棹前昆布'};
  const name=names[product]||'昆布';
  setHeader(name+(mode==='shipment'?' 出荷指示':' 在庫管理'));
  setNavVisible(true);bindNav();
  if(mode==='shipment'){
    if(product==='hidaka')return hShipments();
    if(product==='nemuro')return nShipments();
    if(product==='sanmae')return smShipments();
    return shipments();
  }
  if(product==='hidaka')return hHome();
  if(product==='nemuro')return nHome();
  if(product==='sanmae')return smHome();
  return home();
}

function productChoicePage(mode){
  currentProduct=null;
  const isShip=mode==='shipment';
  setHeader(isShip?'出荷指示':'在庫管理');
  setNavVisible(false);
  const title=isShip?'出荷指示する昆布を選択':'在庫管理する昆布を選択';
  const lead=isShip?'昆布を選ぶと、その昆布の出荷指示一覧へ直接進みます。':'昆布を選ぶと、その昆布の在庫状況トップへ進みます。';
  const detail=isShip?'出荷指示一覧・新規作成・PDF/FAX':'在庫表・入出庫・PDF入庫・マスター';
  app.innerHTML=`<section class="card" style="margin-top:22px"><div class="row"><h2>${title}</h2><span class="pill">v38</span></div><p class="muted">${lead}</p><div class="${isShip?'':'grid'}" style="${isShip?'display:grid;grid-template-columns:1fr;gap:10px;':''}margin-top:16px"><button class="action orange" id="v38K" style="${isShip?'width:100%;padding:15px 16px;':''}"><b style="font-size:20px">釧路産昆布</b><small>${detail}</small></button><button class="action green" id="v38H" style="${isShip?'width:100%;padding:15px 16px;':''}"><b style="font-size:20px">日高昆布</b><small>${detail}</small></button><button class="action blue" id="v38N" style="${isShip?'width:100%;padding:15px 16px;':''}"><b style="font-size:20px">根室産昆布</b><small>${detail}</small></button><button class="action purple" id="v38S" style="${isShip?'width:100%;padding:15px 16px;':''}"><b style="font-size:20px">釧路産棹前昆布</b><small>${detail}</small></button></div><button class="btn secondary" id="v38Back" style="margin-top:16px">← 最初のトップ画面へ</button></section>`;
  v38K.onclick=()=>openProductContext('kushiro',mode);
  v38H.onclick=()=>openProductContext('hidaka',mode);
  v38N.onclick=()=>openProductContext('nemuro',mode);
  v38S.onclick=()=>openProductContext('sanmae',mode);
  v38Back.onclick=productLanding;
}

productLanding=function(){
  currentProduct=null;setHeader('昆布在庫管理');setNavVisible(false);
  app.innerHTML=`<section class="card" style="margin-top:22px"><div class="row"><h2>昆布在庫・出荷管理</h2><span class="pill">v38</span></div><p class="muted">行いたい業務を選択してください。在庫管理と出荷指示を入口から分けています。</p><div style="display:grid;gap:12px;margin-top:18px"><button class="action orange" id="v38Inventory" style="width:100%;padding:22px 16px"><b style="font-size:22px">📊 在庫管理</b><small>4種類の昆布から選択して、在庫状況・入出庫・在庫表を管理</small></button><button class="action blue" id="v38Shipment" style="width:100%;padding:22px 16px"><b style="font-size:22px">📦 出荷指示</b><small>4種類の昆布から選択して、出荷指示を作成・PDF/FAX出力</small></button><button class="action gray" id="v38Company" style="width:100%;padding:18px 16px"><b style="font-size:19px">⚙ 会社マスター</b><small>会社名・住所・電話番号を編集</small></button></div></section>`;
  v38Inventory.onclick=()=>productChoicePage('inventory');
  v38Shipment.onclick=()=>productChoicePage('shipment');
  v38Company.onclick=companyMasterPage;
};

// Kushiro home: make the existing selector button describe the new top-level navigation.
const _v37HomeForV38=home;
home=function(){
  _v37HomeForV38();
  const b=document.getElementById('kProductSelect');
  if(b){b.innerHTML='← 最初のトップ画面へ<small>在庫管理・出荷指示の選択へ戻る</small>';b.onclick=productLanding;}
};

// Company master wording/version update while keeping the same stored data.
const _v37CompanyMasterForV38=companyMasterPage;
companyMasterPage=function(){
  _v37CompanyMasterForV38();
  const pill=app.querySelector('.pill');if(pill)pill.textContent='v38';
  const back=document.getElementById('globalMasterBack');if(back){back.textContent='← 最初のトップ画面へ戻る';back.onclick=productLanding;}
};

bindNav();
productLanding();

/* ===== v40: unified shipment history across all products ===== */
function shipmentStatusJa(status){return {draft:'下書き',confirmed:'確定・在庫反映済',shipped:'出荷済',cancelled:'取消'}[status]||status||''}
function globalShipmentRows(){
  const packs=[
    {product:'kushiro',name:'釧路産昆布',items:Array.isArray(state.shipments)?state.shipments:[]},
    {product:'hidaka',name:'日高昆布',items:Array.isArray(hState.shipments)?hState.shipments:[]},
    {product:'nemuro',name:'根室産昆布',items:Array.isArray(nState.shipments)?nState.shipments:[]},
    {product:'sanmae',name:'釧路産棹前昆布',items:Array.isArray(smState.shipments)?smState.shipments:[]}
  ];
  return packs.flatMap(p=>p.items.map(s=>{
    let src='',dst='';
    if(p.product==='kushiro'){
      src=shipmentSource(s).name||'';dst=shipmentDest(s).name||'';
    }else{
      src=(s.source&&s.source.name)||'';
      dst=(s.dest&&s.dest.name)||(s.destInfo&&s.destInfo.name)||(typeof s.dest==='string'?s.dest:'')||'';
    }
    return {product:p.product,productName:p.name,s,src,dst,qty:(s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0)};
  }));
}
function openGlobalShipment(product,id){
  currentProduct=product;
  const names={kushiro:'釧路産昆布',hidaka:'日高昆布',nemuro:'根室産昆布',sanmae:'釧路産棹前昆布'};
  setHeader((names[product]||'昆布')+' 出荷指示');setNavVisible(true);bindNav();
  if(product==='hidaka')return hShipDetail(id);
  if(product==='nemuro')return nShipDetail(id);
  if(product==='sanmae')return smShipDetail(id);
  return shipmentDetail(id);
}
function allShipmentHistory(){
  currentProduct=null;setHeader('出荷指示一覧');setNavVisible(false);
  app.innerHTML=`<section class="card" style="margin-top:22px"><div class="row"><h2>📋 全昆布 出荷指示一覧</h2><span class="pill">v41</span></div><p class="muted">4種類の昆布の出荷指示をまとめて時系列で表示します。</p><div class="subgrid" style="margin-top:12px"><label>検索<input id="gShipSearch" class="search" placeholder="番号・昆布・会社名・日付"></label><label>状態<select id="gShipStatus"><option value="">すべて</option><option value="draft">下書き</option><option value="confirmed">確定・在庫反映済</option><option value="shipped">出荷済</option><option value="cancelled">取消</option></select></label><label>並び順<select id="gShipSort"><option value="desc">新しい順</option><option value="asc">古い順</option></select></label></div><div class="tablewrap" style="margin-top:12px"><table style="min-width:980px"><thead><tr><th>出荷日</th><th>番号</th><th>昆布の種類</th><th>出荷先</th><th>出荷元</th><th>数量</th><th>状態</th><th></th></tr></thead><tbody id="gShipBody"></tbody></table></div><button class="btn secondary" id="gShipBack" style="margin-top:14px">← 出荷指示メニューへ戻る</button></section>`;
  const render=()=>{
    const q=gShipSearch.value.trim().toLowerCase(),status=gShipStatus.value,dir=gShipSort.value;
    const rows=globalShipmentRows().filter(r=>!status||r.s.status===status).filter(r=>[r.s.id,r.productName,r.src,r.dst,r.s.shipDate,r.s.arrivalDate,shipmentStatusJa(r.s.status)].join(' ').toLowerCase().includes(q));
    rows.sort((a,b)=>{
      const ad=a.s.shipDate||a.s.createdAt||a.s.updatedAt||'',bd=b.s.shipDate||b.s.createdAt||b.s.updatedAt||'';
      const c=String(ad).localeCompare(String(bd));
      if(c!==0)return dir==='asc'?c:-c;
      const ai=a.s.createdAt||a.s.updatedAt||'',bi=b.s.createdAt||b.s.updatedAt||'';
      const c2=String(ai).localeCompare(String(bi));return dir==='asc'?c2:-c2;
    });
    gShipBody.innerHTML=rows.map(r=>`<tr><td>${esc(r.s.shipDate||'')}</td><td>${esc(r.s.id||'')}</td><td><b>${esc(r.productName)}</b></td><td>${esc(r.dst)}</td><td>${esc(r.src)}</td><td>${fmt(r.qty)}</td><td>${esc(shipmentStatusJa(r.s.status))}</td><td><button class="mini" data-gprod="${r.product}" data-gid="${esc(r.s.id||'')}">開く</button></td></tr>`).join('')||'<tr><td colspan="8" class="empty">出荷指示はありません</td></tr>';
  };
  render();gShipSearch.oninput=render;gShipStatus.onchange=render;gShipSort.onchange=render;
  gShipBody.onclick=e=>{const b=e.target.closest('[data-gid]');if(b)openGlobalShipment(b.dataset.gprod,b.dataset.gid)};
  gShipBack.onclick=()=>productChoicePage('shipment');
}

const _v38ProductChoiceForV39=productChoicePage;
productChoicePage=function(mode){
  _v38ProductChoiceForV39(mode);
  const pill=app.querySelector('.pill');if(pill)pill.textContent='v40';
  if(mode==='shipment'){
    const card=app.querySelector('.card'),back=document.getElementById('v38Back');
    if(card&&back){
      const btn=document.createElement('button');btn.className='btn';btn.id='v40AllShipments';btn.style.marginTop='16px';btn.textContent='📋 出荷指示一覧（全昆布・時系列）';card.insertBefore(btn,back);btn.onclick=allShipmentHistory;
    }
  }
};

const _v38LandingForV39=productLanding;
productLanding=function(){_v38LandingForV39();const pill=app.querySelector('.pill');if(pill)pill.textContent='v40'};
const _v38CompanyForV39=companyMasterPage;
companyMasterPage=function(){_v38CompanyForV39();const pill=app.querySelector('.pill');if(pill)pill.textContent='v40'};

bindNav();productLanding();

/* ===== v41: 出荷指示確定をiPhone Safariで確実に実行 ===== */
function v41ShowResult(message,isError){
  let box=document.getElementById('shipmentActionResult');
  if(!box){
    box=document.createElement('div');
    box.id='shipmentActionResult';
    box.style.cssText='margin:12px 0;padding:12px 14px;border-radius:12px;font-weight:700;line-height:1.55;';
    const toolbar=app.querySelector('.toolbar');
    if(toolbar)toolbar.parentNode.insertBefore(box,toolbar); else app.prepend(box);
  }
  box.style.background=isError?'#fff1f0':'#edf9ef';
  box.style.color=isError?'#a61b12':'#216e39';
  box.style.border=isError?'1px solid #f0b7b2':'1px solid #b8dfbf';
  box.textContent=message;
  try{box.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){}
}
function v41GroupNeeds(lines,keyFn){
  const m=new Map();
  for(const l of (lines||[])){
    const k=keyFn(l);m.set(k,(m.get(k)||0)+Number(l.qty||0));
  }
  return m;
}
function v41ConfirmKushiro(id){
  const s=state.shipments.find(x=>x.id===id);if(!s||s.status!=='draft')return;
  try{
    if(!Array.isArray(s.lines)||!s.lines.length)throw new Error('出荷明細がありません。');
    const needs=v41GroupNeeds(s.lines,l=>[l.year||DEFAULT_YEAR,l.coop,l.season,l.group,l.item].join('|'));
    for(const [k,need] of needs){
      const [year,coop,season,group,item]=k.split('|');
      const av=stockAvailableForShipment(year,coop,season,group,item,s.id);
      if(need>av)throw new Error(`${year}年産 ${coop} ${season} ${group} ${item} の出荷可能在庫は ${fmt(av)} です（指示数量 ${fmt(need)}）。`);
    }
    s.status='confirmed';s.confirmedAt=new Date().toISOString();s.updatedAt=s.confirmedAt;
    save();
    shipmentDetail(s.id);
    v41ShowResult('出荷指示を確定し、在庫表へ反映しました。',false);
  }catch(err){
    v41ShowResult('確定できませんでした：'+(err&&err.message?err.message:String(err)),true);
  }
}
function v41ConfirmHidaka(id){
  const s=hState.shipments.find(x=>x.id===id);if(!s||s.status!=='draft')return;
  try{
    const needs=v41GroupNeeds(s.lines,l=>[l.year,l.location,l.section,l.grade].join('|'));
    for(const [k,need] of needs){const [y,loc,sec,grade]=k.split('|');const av=hAvail(y,loc,sec,grade,s.id);if(need>av)throw new Error(`${y}年産 ${loc} ${sec} ${grade} の出荷可能在庫は ${fmt(av)} です（指示数量 ${fmt(need)}）。`)}
    s.status='confirmed';s.confirmedAt=new Date().toISOString();hSave();hShipDetail(id);v41ShowResult('出荷指示を確定し、在庫表へ反映しました。',false);
  }catch(err){v41ShowResult('確定できませんでした：'+(err&&err.message?err.message:String(err)),true)}
}
function v41ConfirmNemuro(id){
  const s=nState.shipments.find(x=>x.id===id);if(!s||s.status!=='draft')return;
  try{
    const needs=v41GroupNeeds(s.lines,l=>[l.year,l.coop,l.season,l.group,l.item].join('|'));
    for(const [k,need] of needs){const [y,coop,season,group,item]=k.split('|');const av=nAvail(y,coop,season,group,item,s.id);if(need>av)throw new Error(`${y}年産 ${coop} ${season} ${group} ${item} の出荷可能在庫は ${fmt(av)} です（指示数量 ${fmt(need)}）。`)}
    s.status='confirmed';s.confirmedAt=new Date().toISOString();nSave();nShipDetail(id);v41ShowResult('出荷指示を確定し、在庫表へ反映しました。',false);
  }catch(err){v41ShowResult('確定できませんでした：'+(err&&err.message?err.message:String(err)),true)}
}
function v41ConfirmSanmae(id){
  const s=smState.shipments.find(x=>x.id===id);if(!s||s.status!=='draft')return;
  try{
    const needs=v41GroupNeeds(s.lines,l=>[l.year,l.coop,l.season,l.group,l.item].join('|'));
    for(const [k,need] of needs){const [y,coop,season,group,item]=k.split('|');const av=smAvail(y,coop,season,group,item,s.id);if(need>av)throw new Error(`${y}年産 ${coop} ${season} ${group} ${item} の出荷可能在庫は ${fmt(av)} です（指示数量 ${fmt(need)}）。`)}
    s.status='confirmed';s.confirmedAt=new Date().toISOString();smSave();smShipDetail(id);v41ShowResult('出荷指示を確定し、在庫表へ反映しました。',false);
  }catch(err){v41ShowResult('確定できませんでした：'+(err&&err.message?err.message:String(err)),true)}
}

document.addEventListener('click',function(e){
  const b=e.target&&e.target.closest?e.target.closest('button'):null;if(!b)return;
  const id=b.id;
  if(!['confirmShipmentBtn','hconf','nconf','smconf'].includes(id))return;
  e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();
  b.disabled=true;const old=b.textContent;b.textContent='処理中…';
  setTimeout(()=>{
    try{
      if(id==='confirmShipmentBtn'){
        const s=state.shipments.find(x=>x.status==='draft'&&document.body.textContent.includes(x.id));if(!s)throw new Error('対象の出荷指示を特定できませんでした。');v41ConfirmKushiro(s.id);
      }else if(id==='hconf'){
        const s=hState.shipments.find(x=>x.status==='draft'&&document.body.textContent.includes(x.id));if(!s)throw new Error('対象の出荷指示を特定できませんでした。');v41ConfirmHidaka(s.id);
      }else if(id==='nconf'){
        const s=nState.shipments.find(x=>x.status==='draft'&&document.body.textContent.includes(x.id));if(!s)throw new Error('対象の出荷指示を特定できませんでした。');v41ConfirmNemuro(s.id);
      }else if(id==='smconf'){
        const s=smState.shipments.find(x=>x.status==='draft'&&document.body.textContent.includes(x.id));if(!s)throw new Error('対象の出荷指示を特定できませんでした。');v41ConfirmSanmae(s.id);
      }
    }catch(err){v41ShowResult('確定できませんでした：'+(err&&err.message?err.message:String(err)),true);b.disabled=false;b.textContent=old;}
  },0);
},true);

/* ===== v42: 4種類の昆布をPDF1回で一括入庫 ===== */
function v42IsNoRowsError(err){
  const m=String(err&&err.message?err.message:err||'');
  return m.includes('数量を読み取れません')||m.includes('数量を読み取れませんでした');
}
function v42NewId(){return crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2)}
function v42ImportAlready(hash,file){
  return {
    kushiro:state.pdfImports.some(x=>x.hash===hash),
    hidaka:hState.pdfImports.some(x=>x.hash===hash)||(hState.pdfImports.some(x=>!x.hash&&x.fileName===file.name)),
    nemuro:nState.pdfImports.some(x=>x.hash===hash),
    sanmae:smState.pdfImports.some(x=>x.hash===hash)
  };
}
async function v42ParseOne(label,fn,file,already,statusEl){
  if(already)return {label,status:'duplicate',parsed:null,error:null};
  if(statusEl)statusEl.textContent=label+'を解析中…';
  try{return {label,status:'ok',parsed:await fn(file),error:null}}
  catch(err){if(v42IsNoRowsError(err))return {label,status:'none',parsed:null,error:null};return {label,status:'error',parsed:null,error:err}}
}
function v42ResultMeta(r){
  if(r.status==='duplicate')return {statusText:'取込済みのためスキップ',count:0,total:0,years:'—',pages:'—'};
  if(r.status==='none')return {statusText:'対象ページなし',count:0,total:0,years:'—',pages:'—'};
  if(r.status==='error')return {statusText:'解析エラー',count:0,total:0,years:'—',pages:'—'};
  const p=r.parsed,rows=p.rows||[];
  return {statusText:'入庫対象',count:rows.length,total:rows.reduce((a,x)=>a+Number(x.qty||0),0),years:(p.years||[]).join('・')||'—',pages:(p.matchedPages||p.matched||[]).join(', ')||'—'};
}
async function v42BulkPdfImport(file){
  if(!file)return;
  currentProduct=null;setHeader('PDFから一括入庫');setNavVisible(false);
  app.innerHTML=`<section class="card" style="margin-top:22px"><div class="row"><h2>📄 4種類 PDF一括入庫</h2><span class="pill">v73</span></div><p><b>${esc(file.name)}</b></p><div class="note">PDFを1回読み込み、釧路産昆布・日高昆布・根室産昆布・釧路産棹前昆布を自動判別しています。</div><p id="v42Progress" style="margin-top:16px;font-weight:700">PDFを準備しています…</p></section>`;
  const progress=document.getElementById('v42Progress');
  try{
    const hash=await sha256File(file),dups=v42ImportAlready(hash,file);
    const results=[];
    results.push(await v42ParseOne('釧路産昆布',parseInventoryPdf,file,dups.kushiro,progress));
    results.push(await v42ParseOne('日高昆布',hParsePdf,file,dups.hidaka,progress));
    results.push(await v42ParseOne('根室産昆布',nParsePdf,file,dups.nemuro,progress));
    results.push(await v42ParseOne('釧路産棹前昆布',smParsePdf,file,dups.sanmae,progress));
    const metas=results.map(v42ResultMeta),importable=results.filter(x=>x.status==='ok');
    const expectedReady=results.every(x=>x.status==='ok'||x.status==='duplicate');
    const newlyReady=results.filter(x=>x.status==='ok');
    const grandCount=metas.reduce((a,x)=>a+x.count,0),grandTotal=metas.reduce((a,x)=>a+x.total,0);
    const cards=results.map((r,i)=>{const m=metas[i];return `<div class="card" style="margin:0;padding:12px;background:#f8fafc"><b style="font-size:17px">${esc(r.label)}</b><div style="margin-top:7px"><span class="pill">${esc(m.statusText)}</span></div><div class="small" style="margin-top:8px">生産年度：${esc(m.years)}<br>対象ページ：${esc(m.pages)}<br>明細：${m.count}件 ／ 合計：${fmt(m.total)}</div>${r.status==='error'?`<div class="warning" style="margin-top:8px">${esc(r.error&&r.error.message?r.error.message:String(r.error))}</div>`:''}</div>`}).join('');
    app.innerHTML=`<section class="card" style="margin-top:22px"><div class="row"><h2>📄 PDF一括入庫 内容確認</h2><span class="pill">v73</span></div><p><b>PDF：</b>${esc(file.name)}</p><div class="stats"><div class="stat">入庫対象<b>${importable.length}種類</b></div><div class="stat">明細合計<b>${grandCount}件</b></div><div class="stat">数量合計<b>${fmt(grandTotal)}</b></div><div class="stat">PDFハッシュ<b style="font-size:12px">${esc(hash.slice(0,12))}…</b></div></div><div class="subgrid" style="margin-top:14px">${cards}</div><div class="warning" style="margin-top:14px">まだ在庫には反映されていません。「4種類へ一括反映」を押すと、入庫対象になった昆布だけを一度に登録します。取込済みの種類は二重登録しません。</div><div class="toolbar" style="margin-top:14px"><button class="btn" id="v42Commit" ${expectedReady&&newlyReady.length?'':'disabled'}>4種類へ一括反映</button><button class="btn secondary" id="v42Cancel">キャンセル</button></div>${!expectedReady?'<div class="warning" style="margin-top:12px"><b>4種類すべての解析が完了していないため反映を停止しています。</b><br>一部だけ（例：釧路だけ）が在庫へ入ることはありません。各昆布の解析結果を確認してください。</div>':''}</section>`;
    const commit=document.getElementById('v42Commit'),cancel=document.getElementById('v42Cancel');
    cancel.onclick=()=>productChoicePage('inventory');
    if(commit)commit.onclick=()=>{
      if(!confirm(`PDFの入庫対象 ${newlyReady.length}種類・${grandCount}件・合計${fmt(grandTotal)}を在庫へ反映します。よろしいですか？`))return;
      commit.disabled=true;commit.textContent='反映中…';
      try{
        const now=new Date().toISOString();
        const k=results[0],h=results[1],n=results[2],s=results[3];
        if(k.status==='ok'){
          const ids=[];k.parsed.rows.forEach(r=>{const id=v42NewId();ids.push(id);state.records.push({id,type:'in',year:r.year,coop:r.coop,season:r.season,group:r.group,item:r.item,qty:Number(r.qty),date:k.parsed.date,memo:`PDF一括入庫：${file.name}`})});
          state.activeYear=k.parsed.years.at(-1)||state.activeYear;state.pdfImports.push({hash,fileName:file.name,years:k.parsed.years,statementDate:k.parsed.date,importedAt:now,count:k.parsed.rows.length,total:k.parsed.rows.reduce((a,x)=>a+Number(x.qty||0),0),pageCount:k.parsed.pageCount,matchedPages:k.parsed.matchedPages,recordIds:ids,bulkV42:true});save();
        }
        if(h.status==='ok'){
          h.parsed.rows.forEach(r=>hState.records.push({id:v42NewId(),type:'in',year:r.year,location:r.location,section:r.section,grade:r.grade,qty:Number(r.qty),date:h.parsed.date,memo:`PDF一括入庫：${file.name}`}));
          hState.activeYear=h.parsed.years.at(-1)||hState.activeYear;hState.pdfImports.push({hash,fileName:file.name,date:h.parsed.date,years:h.parsed.years,pages:h.parsed.matched,importedAt:now,bulkV42:true});hSave();
        }
        if(n.status==='ok'){
          n.parsed.rows.forEach(r=>nState.records.push({id:v42NewId(),type:'in',year:r.year,coop:r.coop,season:r.season,group:r.group,item:r.item,qty:Number(r.qty),date:n.parsed.date,memo:`PDF一括入庫：${file.name}`}));
          nState.activeYear=n.parsed.years.at(-1)||nState.activeYear;nState.pdfImports.push({hash,fileName:file.name,date:n.parsed.date,years:n.parsed.years,pages:n.parsed.matched,importedAt:now,bulkV42:true});nSave();
        }
        if(s.status==='ok'){
          s.parsed.rows.forEach(r=>smState.records.push({id:v42NewId(),type:'in',year:r.year,coop:r.coop,season:r.season,group:r.group,item:r.item,qty:Number(r.qty),date:s.parsed.date,memo:`PDF一括入庫：${file.name}`}));
          smState.activeYear=s.parsed.years.at(-1)||smState.activeYear;smState.pdfImports.push({hash,fileName:file.name,date:s.parsed.date,years:s.parsed.years,pages:s.parsed.matched,importedAt:now,bulkV42:true});smSave();
        }
        alert(`4種類の確認が完了しました。新規反映 ${newlyReady.length}種類、${grandCount}件、合計${fmt(grandTotal)}を一括入庫しました。`);productChoicePage('inventory');
      }catch(err){commit.disabled=false;commit.textContent='4種類へ一括反映';alert('一括入庫中にエラーが発生しました。\n'+(err&&err.message?err.message:String(err)))}
    };
  }catch(err){
    app.innerHTML=`<section class="card" style="margin-top:22px"><h2>PDFを読み込めませんでした</h2><div class="warning">${esc(err&&err.message?err.message:String(err))}</div><button class="btn secondary" id="v42ErrorBack" style="margin-top:14px">在庫管理へ戻る</button></section>`;document.getElementById('v42ErrorBack').onclick=()=>productChoicePage('inventory');
  }
}

const _v41ProductChoiceForV42=productChoicePage;
productChoicePage=function(mode){
  _v41ProductChoiceForV42(mode);
  const pill=app.querySelector('.pill');if(pill)pill.textContent='v73';
  if(mode==='inventory'){
    const card=app.querySelector('.card'),back=document.getElementById('v38Back');
    if(card&&back&&!document.getElementById('v42BulkPdfBtn')){
      const btn=document.createElement('button');btn.className='btn';btn.id='v42BulkPdfBtn';btn.style.marginTop='16px';btn.textContent='📄 PDFから4種類を一括入庫';
      const input=document.createElement('input');input.id='v42BulkPdfFile';input.type='file';input.accept='application/pdf,.pdf';input.hidden=true;
      card.insertBefore(btn,back);card.insertBefore(input,back);
      btn.onclick=()=>input.click();input.onchange=()=>{const f=input.files&&input.files[0];if(f)v42BulkPdfImport(f)};
    }
  }
};
const _v41LandingForV42=productLanding;
productLanding=function(){_v41LandingForV42();const pill=app.querySelector('.pill');if(pill)pill.textContent='v73'};
const _v41CompanyForV42=companyMasterPage;
companyMasterPage=function(){_v41CompanyForV42();const pill=app.querySelector('.pill');if(pill)pill.textContent='v73'};

bindNav();productLanding();


/* ===== v55: iPhone Safari shipment PDF/FAX white-screen fix =====
   Do NOT navigate to Blob PDF for shipment instructions.
   Render a print-ready sheet inside the current app, then use window.print().
*/
function v55ShipmentPrintPreview(opts){
  const s=opts.shipment;
  const src=opts.source||{};
  const dst=opts.dest||{};
  const total=(s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0);
  const th=opts.headers.map(x=>`<th>${esc(x)}</th>`).join('');
  const tr=(s.lines||[]).map(l=>`<tr>${opts.cells(l).map(v=>`<td>${esc(v==null?'':v)}</td>`).join('')}</tr>`).join('');
  const oldHeader=document.querySelector('header h1')?.textContent||'昆布在庫管理';
  setHeader(opts.title);
  app.innerHTML=`
  <style id="v55ShipPrintStyle">
    #v55ShipPrint{margin:-14px -12px 0}
    .v55bar{position:sticky;top:0;z-index:30;background:#173661;color:#fff;padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .v55bar button{border:0;border-radius:10px;padding:12px;font-size:16px;font-weight:700}
    .v55print{background:#fff;color:#173661}.v55back{background:#dfe7f1;color:#173661}
    .v55hint{background:#fff3bf;color:#5c4b00;padding:10px;text-align:center;font-size:13px}
    .v55preview{overflow:auto;background:#eef2f6;padding:8px}
    .v55sheet{width:281mm;min-height:194mm;margin:0 auto 10px;background:#fff;color:#000;padding:7mm;box-shadow:0 2px 8px #0002}
    .v55head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #000;padding-bottom:5px}
    .v55title{font-size:24px;font-weight:800;letter-spacing:5px}.v55meta{text-align:right;font-size:10px;line-height:1.6}
    .v55info{display:grid;grid-template-columns:1fr 1fr .8fr;gap:6px;margin:7px 0;font-size:10px}
    .v55box,.v55memo,.v55sign>div{border:1px solid #222;padding:5px}
    .v55summary{border:1px solid #222;padding:5px;margin-bottom:7px;font-size:10px}
    .v55table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px}
    .v55table th,.v55table td{border:.5px solid #333;padding:3px;text-align:center;height:22px;overflow:hidden;white-space:nowrap}
    .v55table thead th{background:#eee}.v55table tfoot th,.v55table tfoot td{border-top:1.5px solid #000;font-weight:700}
    .v55memo{margin-top:7px;min-height:32px;font-size:10px}
    .v55sign{display:grid;grid-template-columns:1fr 1.5fr 1fr;gap:6px;margin-top:7px;font-size:10px}.v55sign>div{height:34px}
    @media print{
      @page{size:A4 landscape;margin:7mm}
      header,nav,.v55bar,.v55hint{display:none!important}
      main{padding:0!important;max-width:none!important}
      .v55preview{overflow:visible;background:#fff;padding:0}
      .v55sheet{margin:0;width:auto;min-height:auto;padding:0;box-shadow:none}
    }
  </style>
  <div id="v55ShipPrint">
    <div class="v55bar">
      <button class="v55print" id="v55DoPrint">PDF・印刷・FAXへ</button>
      <button class="v55back" id="v55Back">出荷指示へ戻る</button>
    </div>
    <div class="v55hint"><b>帳票プレビュー</b> — 下に出荷依頼書が表示されていれば正常です。「PDF・印刷・FAXへ」からiPhoneの印刷・共有機能を使えます。</div>
    <div class="v55preview">
      <div class="v55sheet">
        <div class="v55head">
          <div class="v55title">出 荷 指 示 書</div>
          <div class="v55meta">指示番号：${esc(s.id||'')}<br>作成日：${esc(today())}</div>
        </div>
        <div class="v55info">
          <div class="v55box"><b>出荷先：</b>${esc(dst.name||'')} 御中<br>住所：${esc(dst.address||'')}<br>電話：${esc(dst.phone||'')}</div>
          <div class="v55box"><b>出荷元：</b>${esc(src.name||'')}<br>住所：${esc(src.address||'')}<br>電話：${esc(src.phone||'')}</div>
          <div class="v55box"><b>出荷日：</b>${esc(s.shipDate||'')}<br><b>希望着日：</b>${esc(s.arrivalDate||'')}</div>
        </div>
        <div class="v55summary"><b>昆布：</b>${esc(opts.title)}　　<b>合計数量：</b>${fmt(total)}</div>
        <table class="v55table">
          <thead><tr>${th}</tr></thead>
          <tbody>${tr||`<tr><td colspan="${opts.headers.length}">明細なし</td></tr>`}</tbody>
          <tfoot><tr><th colspan="${Math.max(1,opts.headers.length-1)}">合計</th><td>${fmt(total)}</td></tr></tfoot>
        </table>
        <div class="v55memo"><b>備考：</b>${esc(s.memo||'')}</div>
        <div class="v55sign"><div>出荷元：${esc(src.name||'')}</div><div>受注・配送指示：</div><div>FAX送信欄：</div></div>
      </div>
    </div>
  </div>`;
  const p=document.getElementById('v55DoPrint');
  const b=document.getElementById('v55Back');
  if(p)p.onclick=()=>window.print();
  if(b)b.onclick=()=>{setHeader(oldHeader);opts.back();};
}

/* 釧路産昆布 */
openShipmentPdfDirect=function(id){
  const s=state.shipments.find(x=>x.id===id);
  if(!s)return;
  v55ShipmentPrintPreview({
    title:'釧路産昆布 出荷指示',
    shipment:s,
    source:shipmentSource(s),
    dest:shipmentDest(s),
    headers:['生産年度','漁協','区分','大分類','細分類','数量','備考'],
    cells:l=>[(l.year||DEFAULT_YEAR)+'年産',l.coop||'',l.season||'',l.group||'',l.item||'',fmt(l.qty),l.memo||''],
    back:()=>shipmentDetail(s.id)
  });
};

/* 日高昆布 */
hOpenShipPdf=function(s){
  if(!s)return;
  v55ShipmentPrintPreview({
    title:'日高昆布 出荷指示',
    shipment:s,
    source:s.source||{},
    dest:s.dest||{},
    headers:['生産年度','産地','区分','等級','数量'],
    cells:l=>[(l.year||hState.activeYear)+'年産',l.location||'',l.section||'',l.grade||'',fmt(l.qty)],
    back:()=>hShipDetail(s.id)
  });
};

/* 根室産昆布 */
nOpenShipPdf=function(s){
  if(!s)return;
  v55ShipmentPrintPreview({
    title:'根室産昆布 出荷指示',
    shipment:s,
    source:s.source||{},
    dest:s.dest||{},
    headers:['生産年度','漁協','区分','大分類','細分類','数量'],
    cells:l=>[(l.year||nState.activeYear)+'年産',l.coop||'',l.season||'',l.group||'',l.item||'',fmt(l.qty)],
    back:()=>nShipDetail(s.id)
  });
};

/* 釧路産棹前昆布はv36以降の同画面プレビュー方式を維持。 */



/* ===== v55 出荷指示書 = 各昆布の在庫集計表フォーマット ===== */
function v55MatrixShipmentPreview(o){
  const s=o.shipment, src=o.source||{}, dst=o.dest||{};
  const lines=s.lines||[];
  const total=lines.reduce((a,l)=>a+Number(l.qty||0),0);
  const rowKeys=o.rows(lines), colKeys=o.cols(lines);
  const val=(r,c)=>lines.filter(l=>o.rowKey(l)===r&&o.colKey(l)===c)
    .reduce((a,l)=>a+Number(l.qty||0),0);
  const rowTotal=r=>colKeys.reduce((a,c)=>a+val(r,c),0);
  const colTotal=c=>rowKeys.reduce((a,r)=>a+val(r,c),0);
  const cols=colKeys.map(c=>`<th>${esc(c)}</th>`).join('');
  const body=rowKeys.map(r=>`<tr><th>${esc(r)}</th>${colKeys.map(c=>{
    const n=val(r,c); return `<td>${n?fmt(n):''}</td>`;
  }).join('')}<th>${rowTotal(r)?fmt(rowTotal(r)):''}</th></tr>`).join('');
  const foot=colKeys.map(c=>`<th>${colTotal(c)?fmt(colTotal(c)):''}</th>`).join('');
  const oldHeader=document.querySelector('header h1')?.textContent||'昆布在庫管理';
  setHeader(o.title);
  app.innerHTML=`
  <style>
    .v55bar{position:sticky;top:0;z-index:30;background:#173661;padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .v55bar button{border:0;border-radius:10px;padding:12px;font-size:16px;font-weight:700}.v55go{background:#fff;color:#173661}.v55back{background:#dfe7f1;color:#173661}
    .v55wrap{overflow:auto;background:#eef2f6;padding:8px}.v55sheet{width:281mm;min-height:194mm;margin:auto;background:#fff;color:#000;padding:7mm;box-shadow:0 2px 8px #0002}
    .v55title{text-align:center;font-size:23px;font-weight:800;letter-spacing:4px;margin-bottom:5px}
    .v55sub{text-align:center;font-size:14px;font-weight:700;margin-bottom:7px}
    .v55info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;font-size:9px;margin-bottom:6px}.v55info>div{border:1px solid #333;padding:4px}
    .v55tbl{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px}.v55tbl th,.v55tbl td{border:1px solid #333;text-align:center;padding:3px;height:21px}.v55tbl thead th,.v55tbl tfoot th{background:#e8edf3;font-weight:700}.v55tbl tbody th{background:#f4f6f8;text-align:left}
    .v55memo{border:1px solid #333;margin-top:6px;padding:5px;min-height:27px;font-size:9px}
    @media print{@page{size:A4 landscape;margin:7mm}header,nav,.v55bar{display:none!important}main{padding:0!important;max-width:none!important}.v55wrap{overflow:visible;background:#fff;padding:0}.v55sheet{width:auto;min-height:auto;padding:0;box-shadow:none}}
  </style>
  <div class="v55bar"><button class="v55go" id="v55print">PDF・印刷・FAXへ</button><button class="v55back" id="v55back">出荷指示へ戻る</button></div>
  <div class="v55wrap"><section class="v55sheet">
    <div class="v55title">${esc(o.reportTitle)}</div>
    <div class="v55sub">出　荷　指　示　書</div>
    <div class="v55info">
      <div><b>出荷元</b>　${esc(src.name||'')}<br>${esc(src.address||'')}</div>
      <div><b>出荷先</b>　${esc(dst.name||'')} 御中<br>${esc(dst.address||'')}</div>
      <div><b>指示番号</b>　${esc(s.id||'')}<br><b>出荷日</b>　${esc(s.shipDate||'')}<br><b>希望着日</b>　${esc(s.arrivalDate||'')}</div>
    </div>
    <table class="v55tbl"><thead><tr><th>${esc(o.rowLabel)}</th>${cols}<th>合計</th></tr></thead>
      <tbody>${body}</tbody><tfoot><tr><th>合計</th>${foot}<th>${fmt(total)}</th></tr></tfoot></table>
    <div class="v55memo"><b>備考：</b>${esc(s.memo||'')}</div>
  </section></div>`;
  document.getElementById('v55print').onclick=()=>window.print();
  document.getElementById('v55back').onclick=()=>{setHeader(oldHeader);o.back();};
}
function v55Unique(a){return [...new Set(a.filter(Boolean))]}

/* 釧路：在庫集計表と同じ「漁協 × 等級/分類」の横持ち表 */
openShipmentPdfDirect=function(id){
 const s=state.shipments.find(x=>x.id===id); if(!s)return;
 v55MatrixShipmentPreview({title:'釧路産昆布 出荷指示',reportTitle:'釧 路 産 昆 布',
 shipment:s,source:shipmentSource(s),dest:shipmentDest(s),rowLabel:'漁協',
 rows:ls=>{const order=['東部漁協','昆布森漁協','厚岸漁協','散布漁協','浜中漁協'];const got=v55Unique(ls.map(l=>l.coop));return [...order.filter(x=>got.includes(x)),...got.filter(x=>!order.includes(x))]},
 cols:ls=>v55Unique(ls.map(l=>[l.season,l.group,l.item].filter(Boolean).join('・'))),
 rowKey:l=>l.coop||'',colKey:l=>[l.season,l.group,l.item].filter(Boolean).join('・'),
 back:()=>shipmentDetail(s.id)});
};

/* 日高：在庫集計表と同じ「産地 × 等級」の表 */
hOpenShipPdf=function(s){if(!s)return;
 v55MatrixShipmentPreview({title:'日高昆布 出荷指示',reportTitle:'日 高 昆 布',
 shipment:s,source:s.source||{},dest:s.dest||{},rowLabel:'産地',
 rows:ls=>v55Unique(ls.map(l=>l.location)),cols:ls=>v55Unique(ls.map(l=>[l.section,l.grade].filter(Boolean).join('・'))),
 rowKey:l=>l.location||'',colKey:l=>[l.section,l.grade].filter(Boolean).join('・'),
 back:()=>hShipDetail(s.id)});
};

/* 根室：在庫集計表と同じ「漁協 × 等級/分類」の表 */
nOpenShipPdf=function(s){if(!s)return;
 v55MatrixShipmentPreview({title:'根室産昆布 出荷指示',reportTitle:'根 室 産 昆 布',
 shipment:s,source:s.source||{},dest:s.dest||{},rowLabel:'漁協',
 rows:ls=>v55Unique(ls.map(l=>l.coop)),cols:ls=>v55Unique(ls.map(l=>[l.season,l.group,l.item].filter(Boolean).join('・'))),
 rowKey:l=>l.coop||'',colKey:l=>[l.season,l.group,l.item].filter(Boolean).join('・'),
 back:()=>nShipDetail(s.id)});
};

/* 棹前：既存の分類情報を使い、同じ集計表型へ統一 */
if(typeof spOpenShipPdf==='function'){
 const v55OldSp=spOpenShipPdf;
 spOpenShipPdf=function(s){
   if(!s)return v55OldSp(s);
   v55MatrixShipmentPreview({title:'釧路産棹前昆布 出荷指示',reportTitle:'釧 路 産 棹 前 昆 布',
   shipment:s,source:s.source||{},dest:s.dest||{},rowLabel:'漁協',
   rows:ls=>v55Unique(ls.map(l=>l.coop||l.location)),cols:ls=>v55Unique(ls.map(l=>[l.season,l.group,l.item,l.grade].filter(Boolean).join('・'))),
   rowKey:l=>l.coop||l.location||'',colKey:l=>[l.season,l.group,l.item,l.grade].filter(Boolean).join('・'),
   back:()=>spShipDetail(s.id)});
 };
}



/* ===== v55 出荷指示書PDFを在庫集計表PDFと完全に同じ表レイアウトへ =====
   在庫集計表Canvas関数をそのまま使用する。
   出荷数量だけを一時的に在庫レコードとして渡すため、
   0数量の行・列もマスター定義どおり全て表示される。
*/
function v55RetitleStockCanvas(canvas, title, year, shipment, tableY, tableX){
  const W=canvas.width,H=canvas.height, headerBottom=190;
  const out=document.createElement('canvas');out.width=W;out.height=H+(headerBottom-tableY);
  const x=out.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,out.width,out.height);
  /* 在庫集計表の表部分をそのまま下へ移動。列幅・罫線・固定行は変更しない */
  x.drawImage(canvas,0,tableY,W,H-tableY,0,headerBottom,W,H-tableY);
  x.fillStyle='#000';x.strokeStyle='#222';x.lineWidth=1.2;
  const font=(z,b=false)=>`${b?'700 ':'400 '}${z}px -apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif`;
  const text=(t,xx,yy,z=14,a='left',b=false)=>{x.font=font(z,b);x.textAlign=a;x.textBaseline='middle';x.fillText(String(t??''),xx,yy)};
  const src=shipment?.source&&typeof shipment.source==='object'?shipment.source:shipmentSource(shipment);
  const dst=shipment?.destInfo&&typeof shipment.destInfo==='object'?shipment.destInfo:(shipment?.dest&&typeof shipment.dest==='object'?shipment.dest:shipmentDest(shipment));
  text(title,tableX,31,27,'left',true);
  text(`${year}年産`,W-tableX,31,16,'right',true);
  const boxY=52,boxH=118,boxW=(W-tableX*2)/2;
  x.strokeRect(tableX,boxY,boxW,boxH);x.strokeRect(tableX+boxW,boxY,boxW,boxH);
  const party=(left,label,o)=>{
    /* ラベルは従来の約半分、会社名を大きく、住所・電話は少し小さく */
    text(label,left+14,boxY+20,15,'left',true);
    text(o?.name||'',left+14,boxY+51,24,'left',true);
    text(`住所：${o?.address||''}`,left+14,boxY+79,14,'left',false);
    text(`電話：${o?.phone||''}`,left+14,boxY+101,14,'left',false);
  };
  party(tableX,'出荷先',dst);party(tableX+boxW,'出荷元',src);
  text(`指示番号：${shipment?.id||''}　出荷日：${shipment?.shipDate||''}`,W-tableX,181,12,'right',false);
  return out;
}
function v55ShipmentYears(s, fallback){
  const ys=[...new Set((s.lines||[]).map(l=>l.year||fallback).filter(Boolean))];
  return ys.length?ys:[fallback];
}
function v55CanvasKushiro(s,y){
  const rec=state.records,ships=state.shipments;
  try{
    state.records=(s.lines||[]).filter(l=>(l.year||DEFAULT_YEAR)===y).map(l=>({
      ...l,type:'in',year:y,qty:Number(l.qty||0)
    }));
    state.shipments=[];
    window.__v58ShipmentCoopLower=true;window.__v63ShipmentHeaderLarge=true;window.__v136KushiroShipmentCoopMerged=true;try{return v55RetitleStockCanvas(_stockCanvasPage(y),'釧路産昆布　出 荷 依 頼 書',y,s,112,44);}finally{window.__v58ShipmentCoopLower=false;window.__v63ShipmentHeaderLarge=false;window.__v136KushiroShipmentCoopMerged=false;}
  }finally{state.records=rec;state.shipments=ships}
}
function v55CanvasHidaka(s,y){
  const rec=hState.records,ships=hState.shipments;
  try{
    hState.records=(s.lines||[]).filter(l=>(l.year||hState.activeYear)===y).map(l=>({
      ...l,type:'in',year:y,qty:Number(l.qty||0)
    }));
    hState.shipments=[];
    window.__v59HidakaSectionCentered=true;window.__v63ShipmentHeaderLarge=true;window.__v141HidakaShipment=true;window.__v144HidakaTallTopRows=true;try{return v55RetitleStockCanvas(hStockCanvas(y),'日高昆布　出 荷 依 頼 書',y,s,80,35);}finally{window.__v59HidakaSectionCentered=false;window.__v63ShipmentHeaderLarge=false;window.__v141HidakaShipment=false;window.__v144HidakaTallTopRows=false;}
  }finally{hState.records=rec;hState.shipments=ships}
}
function v55CanvasNemuro(s,y){
  const rec=nState.records,ships=nState.shipments;
  try{
    nState.records=(s.lines||[]).filter(l=>(l.year||nState.activeYear)===y).map(l=>({
      ...l,type:'in',year:y,qty:Number(l.qty||0)
    }));
    nState.shipments=[];
    window.__v58ShipmentCoopLower=true;window.__v63ShipmentHeaderLarge=true;window.__v127NemuroShipmentTall=true;window.__v128NemuroShipmentMerged=true;try{return v55RetitleStockCanvas(nReportCanvas(y,null),'根室産昆布　出 荷 依 頼 書',y,s,70,34);}finally{window.__v58ShipmentCoopLower=false;window.__v63ShipmentHeaderLarge=false;window.__v127NemuroShipmentTall=false;window.__v128NemuroShipmentMerged=false;}
  }finally{nState.records=rec;nState.shipments=ships}
}
function v55CanvasSanmae(s,y){
  const rec=smState.records,ships=smState.shipments;
  try{
    smState.records=(s.lines||[]).filter(l=>(l.year||smState.activeYear)===y).map(l=>({
      ...l,type:'in',year:y,qty:Number(l.qty||0)
    }));
    smState.shipments=[];
    window.__v58ShipmentCoopLower=true;window.__v63ShipmentHeaderLarge=true;window.__v136SanmaeShipmentTall=true;window.__v136SanmaeShipmentMerged=true;try{return v55RetitleStockCanvas(smReportCanvas(y,null),'釧路産棹前昆布　出 荷 依 頼 書',y,s,70,34);}finally{window.__v58ShipmentCoopLower=false;window.__v63ShipmentHeaderLarge=false;window.__v136SanmaeShipmentTall=false;window.__v136SanmaeShipmentMerged=false;}
  }finally{smState.records=rec;smState.shipments=ships}
}
function v55ShowShipmentCanvasPreview(title, shipment, canvases, backFn){
  const oldHeader=document.querySelector('header h1')?.textContent||'昆布在庫管理';
  setHeader(title);
  app.innerHTML=`
   <style>
    .v55bar{position:sticky;top:0;z-index:30;background:#173661;padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .v55bar button{border:0;border-radius:10px;padding:12px;font-size:16px;font-weight:700}
    .v55print{background:#fff;color:#173661}.v55back{background:#dfe7f1;color:#173661}
    .v55note{background:#fff3bf;color:#5c4b00;padding:8px 12px;text-align:center;font-size:13px}
    .v55preview{overflow:auto;background:#eef2f6;padding:8px}
    .v55page{width:281mm;margin:0 auto 10px;background:#fff;box-shadow:0 2px 8px #0002}
    .v55page canvas{display:block;width:281mm;height:auto;background:#fff}
    @media print{
      @page{size:A4 landscape;margin:0}
      html,body{margin:0!important;padding:0!important;width:297mm!important;min-height:0!important;overflow:visible!important}
      header,nav,.v55bar,.v55note{display:none!important}
      main{margin:0!important;padding:0!important;max-width:none!important;width:297mm!important;min-height:0!important}
      .v55preview{overflow:visible!important;background:#fff!important;padding:0!important;margin:0!important;width:297mm!important}
      .v55page{width:289mm!important;height:202mm!important;margin:3mm auto 0!important;padding:0!important;box-shadow:none!important;display:flex!important;align-items:flex-start!important;justify-content:flex-start!important;break-after:auto!important;page-break-after:auto!important;overflow:hidden!important}
      .v55page:not(:last-child){break-after:page!important;page-break-after:always!important}
      .v55page canvas{display:block!important;width:289mm!important;height:202mm!important;max-width:289mm!important;max-height:202mm!important;object-fit:contain!important;margin:0!important;padding:0!important}
    }
   </style>
   <div class="v55bar"><button class="v55print" id="v55print">PDF・印刷・FAXへ</button><button class="v55back" id="v55back">出荷指示へ戻る</button></div>
   <div class="v55note">在庫集計表PDFと同じ固定行・固定列です。数量0の行・列も表示し、0のセルだけ空欄にしています。</div>
   <div class="v55preview" id="v55preview"></div>`;
  const preview=document.getElementById('v55preview');
  canvases.forEach(c=>{
    const d=document.createElement('div');d.className='v55page';d.appendChild(c);preview.appendChild(d);
  });
  document.getElementById('v55print').onclick=()=>window.print();
  document.getElementById('v55back').onclick=()=>{setHeader(oldHeader);backFn()};
}

/* 釧路産昆布 */
openShipmentPdfDirect=function(id){
  const s=state.shipments.find(x=>x.id===id);if(!s)return;
  const ys=v55ShipmentYears(s,state.activeYear);
  v55ShowShipmentCanvasPreview('釧路産昆布 出荷指示',s,ys.map(y=>v55CanvasKushiro(s,y)),()=>shipmentDetail(s.id));
};
/* 日高昆布 */
hOpenShipPdf=function(s){
  if(!s)return;
  const ys=v55ShipmentYears(s,hState.activeYear);
  v55ShowShipmentCanvasPreview('日高昆布 出荷指示',s,ys.map(y=>v55CanvasHidaka(s,y)),()=>hShipDetail(s.id));
};
/* 根室産昆布 */
nOpenShipPdf=function(s){
  if(!s)return;
  const ys=v55ShipmentYears(s,nState.activeYear);
  v55ShowShipmentCanvasPreview('根室産昆布 出荷指示',s,ys.map(y=>v55CanvasNemuro(s,y)),()=>nShipDetail(s.id));
};
/* 釧路産棹前昆布 */
smOpenShipPdf=function(s){
  if(!s)return;
  const ys=v55ShipmentYears(s,smState.activeYear);
  v55ShowShipmentCanvasPreview('釧路産棹前昆布 出荷指示',s,ys.map(y=>v55CanvasSanmae(s,y)),()=>smShipDetail(s.id));
};



/* ===== v55 釧路産昆布トップ画面を他3種類と統一 ===== */
home=function(){
  const y=state.activeYear;
  app.innerHTML=`
  <section class="card">
    <div class="row">
      <h2>釧路産昆布 在庫状況</h2>
      <select id="ky" style="width:auto">${yearOptions(y)}</select>
    </div>
    <div class="stats">
      <div class="stat">${y}年産 総在庫<b>${fmt(total(y))}</b></div>
      <div class="stat">漁協数<b>${state.coops.length}</b></div>
      <div class="stat">分類数<b>${allItems().length}</b></div>
      <div class="stat">登録履歴<b>${state.records.filter(r=>(r.year||DEFAULT_YEAR)===y).length}件</b></div>
    </div>
  </section>
  <section class="grid">
    <button class="action" id="ks" style="border-left:6px solid #e05a47">
      📦 出荷指示<small>釧路産昆布専用・PDF/FAX</small>
    </button>
    <button class="action orange" id="kst">
      ▦ 在庫表<small>原票形式で集計・PDF出力</small>
    </button>
    <button class="action purple" id="kl">
      ≡ 入出庫履歴<small>修正・削除</small>
    </button>
    <button class="action green" id="ki">
      ↓ 入庫登録<small>PDFから一括入庫も可能</small>
    </button>
    <button class="action blue" id="ko">
      ↑ 出庫登録<small>在庫から減算</small>
    </button>
    <button class="action gray" id="km">
      ⋯ その他<small>バックアップ・商品選択</small>
    </button>
  </section>`;

  ky.onchange=()=>{
    setActiveYear(ky.value);
    home();
  };
  ks.onclick=shipments;
  kst.onclick=stock;
  kl.onclick=logs;
  ki.onclick=()=>form('in');
  ko.onclick=()=>form('out');
  km.onclick=kMore;
};

function kMore(){
  app.innerHTML=`
  <section class="card">
    <h2>釧路産昆布 その他</h2>
    <div class="form">
      <button class="btn secondary" id="kprod">← 昆布選択画面へ</button>
      <button class="btn secondary" id="kbk">釧路産昆布バックアップ保存</button>
      <input id="krf" type="file" accept="application/json,.json" hidden>
      <button class="btn secondary" id="krs">釧路産昆布バックアップ復元</button>
      <button class="btn secondary" id="kexp">データ出力</button>
      <button class="btn secondary" id="kmas">マスター設定</button>
      <button class="btn secondary" id="khm">ホーム</button>
    </div>
  </section>`;
  kprod.onclick=productLanding;
  kbk.onclick=backup;
  krs.onclick=()=>krf.click();
  krf.onchange=()=>{
    const f=krf.files?.[0];
    if(f)restore(f);
  };
  kexp.onclick=exportsPage;
  kmas.onclick=masters;
  khm.onclick=home;
}



/* ===== v55 下部ナビのホームは常に最初のトップ画面へ ===== */
function goInitialTop(){
  try{
    if(typeof initialLanding==='function'){initialLanding();return;}
    if(typeof rootLanding==='function'){rootLanding();return;}
    if(typeof mainLanding==='function'){mainLanding();return;}
    if(typeof productLanding==='function'){productLanding();return;}
    if(typeof landing==='function'){landing();return;}
  }catch(e){console.error(e)}
  location.hash='';
  location.reload();
}

/* 既存ナビ生成後にホームボタンを最初のトップ画面へ統一 */
function v55WireGlobalHome(){
  const candidates=[
    document.getElementById('navHome'),
    document.getElementById('homeNav'),
    document.querySelector('nav [data-nav="home"]'),
    document.querySelector('nav button:first-child'),
    document.querySelector('nav a:first-child')
  ].filter(Boolean);
  for(const el of candidates){
    el.onclick=(ev)=>{ev?.preventDefault?.();goInitialTop();};
  }
}
document.addEventListener('click',function(ev){
  const t=ev.target.closest('nav button,nav a');
  if(!t)return;
  const txt=(t.textContent||'').replace(/\s/g,'');
  if(txt.includes('ホーム')){
    ev.preventDefault();
    ev.stopImmediatePropagation();
    goInitialTop();
  }
},true);
setTimeout(v55WireGlobalHome,0);



/* ===== v57 出荷指示書 上部：出荷先 / 出荷元 大型枠 =====
   在庫管理UIはv55のまま。4種類の出荷帳票Canvasだけを変更。
*/
function v57ShipmentParty(s, side){
  if(side==='dest'){
    if(s?.destInfo && typeof s.destInfo==='object'){
      return {name:s.destInfo.name||'',address:s.destInfo.address||'',phone:s.destInfo.phone||''};
    }
    if(s?.dest && typeof s.dest==='object'){
      return {name:s.dest.name||'',address:s.dest.address||'',phone:s.dest.phone||''};
    }
    if(typeof s?.dest==='string'){
      return {name:s.dest,address:'',phone:''};
    }
    try{
      if(typeof shipmentDest==='function'){
        const d=shipmentDest(s)||{};
        return {name:d.name||'',address:d.address||'',phone:d.phone||''};
      }
    }catch(e){}
    return {name:'',address:'',phone:''};
  }
  if(s?.source && typeof s.source==='object'){
    return {name:s.source.name||'',address:s.source.address||'',phone:s.source.phone||''};
  }
  try{
    if(typeof shipmentSource==='function'){
      const d=shipmentSource(s)||{};
      return {name:d.name||'',address:d.address||'',phone:d.phone||''};
    }
  }catch(e){}
  return {name:'',address:'',phone:''};
}


/* ===== v161.3: 会社情報右揃え + PDFタイトル中央 + 最新版表示 ===== */
const V161_YAMASAN_LOGO_DATA='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGIAAABZCAAAAADgc668AAAB1UlEQVR42u2Z25IDIQhEbSr//8u9D8kmmdFBWrD2UvEpt/EIDQoGbLvHTfo1WtOXZAoAd8o2BPC0RBtg3EevwR1WwHlXg8DkfRqB54ykzjDJBL5kAAoROKpM1VmmEnRnCanH7lXMWbO8wDgVIGSIacHazYwsog/WBYat2HAUHQkEgnsSlhEzAoMMS9jAwQ6jICJeYotALKUDI4pYTun3YIaEiBJOzhIQAiHAsCxhzrA0YRpYlifMAssuj2mlknEZFnpMrUo9BBYJdBiW99KMYeNvdC/xUg8rIjiaY1SxsERonqyoIFxUKVZIuGBYJWHMsFJCx8ADUUjoJkBrYIaAi1kPTHCZAGfl6333VVvG07pP3wb3JcgafH/+pgXj80m7vw2q7uIxbmHQCs2w2hMve82yrsX0gMkRnHYSzkT9KcOljhVVFQn1jnjXfdSviKgfRNxSXg7JtKqFcFUoIyDvOHEE1nI7iEBm/3DkxicvdjRirE89xtXyIgrB1SKRF+u3/fG8QEWh8DkvPoia65XiiIKXmcwtMZD/GHU3zB0WdBE15xD3RxQ8BDcw/mfq8U9a0acepLQK/G6Q3Rg8MKnB3Z4N9J9Y+VOfwu0BF9wOzrUoLAzu4wueJ5iNTB1zTgAAAABJRU5ErkJggg==';
const V161_YAMASAN_LOGO_IMG=new Image();
V161_YAMASAN_LOGO_IMG.src=V161_YAMASAN_LOGO_DATA;
/* ===== /v161.3 ===== */

v55RetitleStockCanvas=function(sourceCanvas, title, year, shipment, tableY, tableX){
  const W=sourceCanvas.width,H=sourceCanvas.height;
  tableY=Number(tableY)||70; tableX=Number(tableX)||35;
  /* v141: 年産表示と上部罫線の干渉を避けるため、帳票本体を少し下へ移動。
     PDF化時はA4横1ページへ自動フィットするため、全体バランスを保ったまま収める。 */
  /* v159: 出荷元/出荷先の下に配送情報・備考欄を追加するため表を少し下へ移動。
     A4横1ページへの自動フィットは既存PDF処理で維持。 */
  const headerBottom=366;
  const c=document.createElement('canvas');c.width=W;c.height=H+(headerBottom-tableY);
  const x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);

  /* 在庫集計表は縮小せず、そのまま下へ移動。これで上部枠と表の左右端が完全一致する。 */
  x.drawImage(sourceCanvas,0,tableY,W,H-tableY,0,headerBottom,W,H-tableY);

  const dest=v57ShipmentParty(shipment,'dest');
  const src=v57ShipmentParty(shipment,'source');
  const font=(z,b=false)=>`${b?'700 ':'400 '}${z}px -apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif`;
  const text=(t,xx,yy,z=18,a='left',b=false)=>{x.fillStyle='#000';x.font=font(z,b);x.textAlign=a;x.textBaseline='middle';x.fillText(String(t??''),xx,yy)};

  const rawProduct=String(title||'').replace(/　?出 荷 指 示 書/g,'').replace(/　?出 荷 依 頼 書/g,'').trim();
  let productName=rawProduct;
  if(rawProduct.includes('釧路産棹前'))productName='釧路棹前昆布';
  else if(rawProduct.includes('釧路産昆布'))productName='釧路昆布';
  else if(rawProduct.includes('根室産昆布'))productName='根室昆布';
  else if(rawProduct.includes('日高昆布'))productName='日高昆布';
  const mainTitle='出荷依頼書';
  /* v161.1: 右上に山三商事の会社情報を配置。
     ロゴは「山三商事ロゴ住所.pdf」から切り出した原本マークを使用。
     事業者番号は表示しない。郵便番号と住所、TELとFAXはそれぞれ横並び。 */
  const productLabel=productName?`(${productName})`:'';
  const titleSize=42;
  const companyRight=W-tableX;
  const companyBlockW=Math.min(620,Math.round(W*0.34));
  const companyLeft=companyRight-companyBlockW;
  /* v161.2: ロゴは会社名の文字高とほぼ同じ見た目サイズへ縮小 */
  const logoSize=42;
  const logoX=companyLeft;
  const logoY=11;
  const companyTextX=logoX+logoSize+14;

  /* v161.3: 出荷依頼書タイトルをページ全体の中央へ配置 */
  const titleCenter=W/2;
  const titleSizeCentered=38;
  x.font=font(titleSizeCentered,true);const mainW=x.measureText(mainTitle).width;
  x.font=font(titleSizeCentered,true);const productW=x.measureText(productLabel).width;
  const titleStart=titleCenter-(mainW+productW)/2;
  text(mainTitle,titleStart,30,titleSizeCentered,'left',true);
  if(productLabel)text(productLabel,titleStart+mainW,30,titleSizeCentered,'left',true);
  text(`(${year}年産)`,titleCenter,76,titleSizeCentered,'center',true);

  text(`依頼日：${shipment?.shipDate||''}`,tableX,26,30,'left',true);
  text(`依頼番号：${shipment?.id||''}`,tableX,72,18,'left',false);

  if(V161_YAMASAN_LOGO_IMG.complete&&V161_YAMASAN_LOGO_IMG.naturalWidth){
    x.drawImage(V161_YAMASAN_LOGO_IMG,logoX,logoY,logoSize,logoSize*89/98);
  }
  /* v161.3: 会社名・住所・TEL/FAXはすべて右端を同じ位置へ揃える */
  const companyName='山三商事株式会社';
  x.font=font(36,true);
  const companyNameW=x.measureText(companyName).width;
  const alignedLogoX=companyRight-companyNameW-logoSize-14;
  if(V161_YAMASAN_LOGO_IMG.complete&&V161_YAMASAN_LOGO_IMG.naturalWidth){
    /* 先に描いた旧位置ロゴを白で消し、新しい位置へ原本ロゴを再描画 */
    x.fillStyle='#fff';
    x.fillRect(logoX-2,logoY-2,logoSize+5,logoSize*89/98+5);
    x.drawImage(V161_YAMASAN_LOGO_IMG,alignedLogoX,logoY,logoSize,logoSize*89/98);
  }
  text(companyName,companyRight,31,36,'right',true);
  text('〒933-0804　富山県高岡市問屋町90',companyRight,72,19,'right',false);
  text('TEL 0766-24-3660　　FAX 0766-24-3661',companyRight,96,19,'right',false);

  const boxY=108,boxH=145,boxW=(W-tableX*2)/2;
  x.strokeStyle='#111';x.lineWidth=1.5;
  x.strokeRect(tableX,boxY,boxW,boxH);
  x.strokeRect(tableX+boxW,boxY,boxW,boxH);
  const drawParty=(left,label,p)=>{
    text(label,left+14,boxY+22,15,'left',true);
    text(p.name||'',left+14,boxY+59,28,'left',true);
    text(`住所：${p.address||''}`,left+14,boxY+96,18,'left',false);
    text(`電話：${p.phone||''}`,left+14,boxY+124,18,'left',false);
  };
  /* 左＝出荷先、右＝出荷元（既存レイアウトを維持） */
  drawParty(tableX,'出荷先',dest);
  drawParty(tableX+boxW,'出荷元',src);

  /* v159: 出荷先下＝着希望日／配送・袋入等（2分割）、出荷元下＝備考 */
  const infoY=boxY+boxH,infoH=82;
  x.strokeRect(tableX,infoY,boxW,infoH);
  x.strokeRect(tableX+boxW,infoY,boxW,infoH);
  const leftHalf=boxW/2;
  x.beginPath();x.moveTo(tableX+leftHalf,infoY);x.lineTo(tableX+leftHalf,infoY+infoH);x.stroke();

  text('着希望日',tableX+12,infoY+18,14,'left',true);
  text(shipment?.arrivalDate||'',tableX+12,infoY+51,26,'left',true);

  text('配送・袋入等',tableX+leftHalf+12,infoY+18,14,'left',true);
  text(shipment?.deliveryPack||'',tableX+leftHalf+12,infoY+51,26,'left',true);

  const sourceInfoLeft=tableX+boxW;
  text('備考',sourceInfoLeft+12,infoY+18,14,'left',true);
  text(shipment?.memo||'',sourceInfoLeft+12,infoY+51,26,'left',true);
  return c;
};


/* v59: 出荷指示書表示調整：釧路・根室・釧路産棹前の組合名をv58より少し下へ。日高の走り・后採・拾い・雑を各区分ブロック中央へ。 */


/* ===== v65: 日高昆布 PDF/FAX = A4横向きPDFを直接生成 ===== */
async function v65LandscapePdfBlobFromCanvases(canvases){
  const ims=[];
  for(const canvas of canvases){
    ims.push({bytes:await _canvasJpegBytes(canvas),w:canvas.width,h:canvas.height});
  }
  const objs=[],pageIds=[],imgIds=[],contentIds=[];
  let id=1; const catalog=id++, pages=id++;
  ims.forEach(()=>{pageIds.push(id++);imgIds.push(id++);contentIds.push(id++)});
  objs[catalog]=_ascii(`<< /Type /Catalog /Pages ${pages} 0 R >>`);
  objs[pages]=_ascii(`<< /Type /Pages /Count ${ims.length} /Kids [${pageIds.map(x=>x+' 0 R').join(' ')}] >>`);
  ims.forEach((im,i)=>{
    objs[pageIds[i]]=_ascii(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im0 ${imgIds[i]} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`);
    objs[imgIds[i]]=_concatBytes([_ascii(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`),im.bytes,_ascii('\nendstream')]);
    /* 約5mmの余白を確保し、v64の「数mm小さく」をPDF本体にも反映 */
    const st='q\n813.54 0 0 566.93 14.17 14.17 cm\n/Im0 Do\nQ\n';
    objs[contentIds[i]]=_ascii(`<< /Length ${st.length} >>\nstream\n${st}endstream`);
  });
  const n=id-1,parts=[_ascii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offs=Array(n+1).fill(0);let pos=parts[0].length;
  for(let i=1;i<=n;i++){offs[i]=pos;const a=_ascii(`${i} 0 obj\n`),b=objs[i],c=_ascii('\nendobj\n');parts.push(a,b,c);pos+=a.length+b.length+c.length}
  const xp=pos;let xr=`xref\n0 ${n+1}\n0000000000 65535 f \n`;
  for(let i=1;i<=n;i++)xr+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
  xr+=`trailer\n<< /Size ${n+1} /Root ${catalog} 0 R >>\nstartxref\n${xp}\n%%EOF`;
  parts.push(_ascii(xr));
  return new Blob(parts,{type:'application/pdf'});
}

hOpenShipPdf=async function(s){
  if(!s)return;
  const w=window.open('about:blank','_blank');
  if(!w)return alert('PDF表示用の画面を開けませんでした。Safariのポップアップ設定を確認してください。');
  try{
    w.document.write('<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>日高昆布 PDF作成中</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:32px;text-align:center"><h3>A4横向きPDFを作成しています…</h3><p>そのままお待ちください。</p></body></html>');
    w.document.close();
    const ys=v55ShipmentYears(s,hState.activeYear);
    const canvases=ys.map(y=>v55CanvasHidaka(s,y));
    const blob=await v65LandscapePdfBlobFromCanvases(canvases);
    const url=URL.createObjectURL(blob);
    w.location.replace(url);
    setTimeout(()=>URL.revokeObjectURL(url),10*60*1000);
  }catch(e){
    try{w.close()}catch(_e){}
    alert('日高昆布の横向きPDFを作成できませんでした。\n'+(e&&e.message?e.message:e));
  }
};


/* ===== v68: 日高昆布「区分」列を縦結合表示・白背景修正 =====
   出荷依頼書では、走り・后採・拾い・雑の各ブロック内部にある
   区分列の細い横線を消し、結合セル相当の中央へ区分名を表示する。 */
const _v68BaseHStockCanvas=hStockCanvas;
hStockCanvas=function(y){
  let c=_v68BaseHStockCanvas(y);
  if(!window.__v59HidakaSectionCentered) return c;

  /* v144: 日高出荷依頼PDFのみ、表の2〜12行目（走り11行）を二段階高く。
     それ以下は縦方向だけ圧縮し、元の表全体の高さに収める。 */
  if(window.__v144HidakaTallTopRows){
    const src=c, W=src.width, H=src.height;
    const out=document.createElement('canvas');out.width=W;out.height=H;
    const o=out.getContext('2d');o.fillStyle='#fff';o.fillRect(0,0,W,H);
    const ty=80, headH=48, baseRow=26, topRows=11;
    const tableTop=ty+headH, tableBottom=tableTop+H_SECTIONS.reduce((a,z)=>a+z.items.length,0)*baseRow+32;
    const tallRow=34, tallH=topRows*tallRow, oldTopH=topRows*baseRow;
    const oldRestY=tableTop+oldTopH, newRestY=tableTop+tallH;
    const oldRestH=tableBottom-oldRestY, newRestH=tableBottom-newRestY;
    o.drawImage(src,0,0,W,tableTop,0,0,W,tableTop);
    o.drawImage(src,0,tableTop,W,oldTopH,0,tableTop,W,tallH);
    o.drawImage(src,0,oldRestY,W,oldRestH,0,newRestY,W,newRestH);
    o.drawImage(src,0,tableBottom,W,H-tableBottom,0,tableBottom,W,H-tableBottom);
    c=out;
  }

  const x=c.getContext('2d');
  const tx=35, ty=80, secW=70, headH=48, rowH=26;
  const tall=!!window.__v144HidakaTallTopRows, tallRow=34, topRows=11;
  const totalRows=H_SECTIONS.reduce((a,z)=>a+z.items.length,0);
  /* v145: v144の画像伸縮では「走り」以降の行と合計行(32px)をまとめて縮小している。
     区分結合セルの高さも同じ縮尺から算出し、后採・拾い・雑の下罫線を右側セルと完全一致させる。 */
  const oldRestH=(totalRows-topRows)*rowH+32;
  const newRestH=totalRows*rowH+32-topRows*tallRow;
  const restScale=tall?(newRestH/oldRestH):1;
  const restRow=tall?(rowH*restScale):rowH;
  let startY=ty+headH;
  x.save();
  x.strokeStyle='#222';
  x.fillStyle='#fff';
  x.textAlign='center';
  x.textBaseline='middle';
  x.font='400 12px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';

  for(const sec of H_SECTIONS){
    const blockH=sec.name==='走り'&&tall ? sec.items.length*tallRow : sec.items.length*restRow;
    /* 各ブロックごとに白背景へ戻してから内部罫線を消す。 */
    x.fillStyle='#fff';
    x.fillRect(tx+1, startY+1, secW-2, blockH-2);

    x.lineWidth=1.6;
    x.beginPath(); x.moveTo(tx,startY); x.lineTo(tx+secW,startY); x.stroke();
    x.beginPath(); x.moveTo(tx,startY+blockH); x.lineTo(tx+secW,startY+blockH); x.stroke();
    x.lineWidth=.55;
    x.beginPath(); x.moveTo(tx,startY); x.lineTo(tx,startY+blockH); x.stroke();
    x.beginPath(); x.moveTo(tx+secW,startY); x.lineTo(tx+secW,startY+blockH); x.stroke();

    x.fillStyle='#000';
    x.fillText(sec.name, tx+secW/2, startY+blockH/2);
    startY+=blockH;
  }
  x.restore();
  return c;
};


/* ===== v69: 4種類の出荷依頼書 PDF/FAX をA4横向きPDF本体の直接表示へ統一 =====
   日高(v65)と同じPDF生成処理を釧路・根室・釧路産棹前にも適用。
   A4 landscape (297x210mm) に約5mm余白を取り、帳票画像は287x200mm相当で配置する。 */
async function v69OpenShipmentLandscapePdf(productName, shipment, activeYear, canvasMaker){
  if(!shipment)return;
  const w=window.open('about:blank','_blank');
  if(!w)return alert('PDF表示用の画面を開けませんでした。Safariのポップアップ設定を確認してください。');
  try{
    w.document.write('<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+productName+' PDF作成中</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:32px;text-align:center"><h3>A4横向きPDFを作成しています…</h3><p>そのままお待ちください。</p></body></html>');
    w.document.close();
    const ys=v55ShipmentYears(shipment,activeYear);
    const canvases=ys.map(y=>canvasMaker(shipment,y));
    const blob=await v65LandscapePdfBlobFromCanvases(canvases);
    const url=URL.createObjectURL(blob);
    w.location.replace(url);
    setTimeout(()=>URL.revokeObjectURL(url),10*60*1000);
  }catch(e){
    try{w.close()}catch(_e){}
    alert(productName+'の横向きPDFを作成できませんでした。\n'+(e&&e.message?e.message:e));
  }
}

/* 釧路産昆布 */
openShipmentPdfDirect=function(id){
  const s=state.shipments.find(x=>x.id===id);if(!s)return;
  return v69OpenShipmentLandscapePdf('釧路産昆布',s,state.activeYear,v55CanvasKushiro);
};
/* 日高昆布：既存v65仕様を共通処理へ統一 */
hOpenShipPdf=function(s){
  return v69OpenShipmentLandscapePdf('日高昆布',s,hState.activeYear,v55CanvasHidaka);
};
/* 根室産昆布 */
nOpenShipPdf=function(s){
  return v69OpenShipmentLandscapePdf('根室産昆布',s,nState.activeYear,v55CanvasNemuro);
};
/* 釧路産棹前昆布 */
smOpenShipPdf=function(s){
  return v69OpenShipmentLandscapePdf('釧路産棹前昆布',s,smState.activeYear,v55CanvasSanmae);
};


/* ===== v71: 釧路産昆布 在庫管理トップに年産別在庫集計表を直接表示 ===== */
function v71KushiroHomeTable(year){
  const m=matrix(), inv=window.KombuRefactor?.Inventory;
  let html=`<style>
    .v71-stock{border-collapse:collapse;min-width:1120px;width:100%}
    .v71-stock th,.v71-stock td{border:.45px solid #46515e;padding:3px 4px;text-align:center;white-space:nowrap;font-size:10px;line-height:1.25}
    .v71-stock th{font-weight:650;background:#f7f9fb}
    .v71-stock td{font-size:11px;background:#fff}
    .v71-stock .coop-end th,.v71-stock .coop-end td{border-bottom:1.5px solid #111}
    .v71-stock .subtotal th,.v71-stock .subtotal td{font-size:10px;background:#fff}
    .v71-stock .grand th{border-top:1.5px solid #111;font-size:10px;background:#f7f9fb}
    .v71-home-table{margin-top:10px;max-height:330px;overflow:auto;-webkit-overflow-scrolling:touch;border:1px solid #e1e7ee;border-radius:10px;background:#fff}
  </style><div class="v71-home-table"><table class="v71-stock"><tr><th rowspan="2">組合名</th><th rowspan="2">区分</th>`;
  GROUPS.forEach(g=>html+=`<th colspan="${g.items.length}">${esc(g.name)}</th>`);
  html+=`<th rowspan="2">計</th></tr><tr>`;
  GROUPS.forEach(g=>g.items.forEach(i=>html+=`<th>${esc(i)}</th>`));
  html+='</tr>';
  state.coops.forEach(coop=>{
    SEASONS.forEach((season,si)=>{
      html+=`<tr><td>${si===0?esc(coop):''}</td><td>${season}</td>`;
      let rt=0;
      GROUPS.forEach(g=>g.items.forEach(i=>{
  const v=inv?.getQuantity
    ? inv.getQuantity('kushiro',{year,coop,season,group:g.name,item:i})
    : (m[[year,coop,g.name,i,season].join('|')]||0);
  rt+=v;
  html+=`<td>${v?fmt(v):''}</td>`;
}));
    });
    html+=`<tr class="subtotal coop-end"><td></td><td>小計</td>`;
    let ct=0;
    GROUPS.forEach(g=>g.items.forEach(i=>{const v=SEASONS.reduce((ss,se)=>ss+(
  inv?.getQuantity
    ? inv.getQuantity('kushiro',{year,coop,season:se,group:g.name,item:i})
    : (m[[year,coop,g.name,i,se].join('|')]||0)
),0);;ct+=v;html+=`<td>${v?fmt(v):''}</td>`}));
    html+=`<td>${ct?fmt(ct):''}</td></tr>`;
  });
  html+=`<tr class="grand"><th colspan="2">合計</th>`;
  GROUPS.forEach(g=>g.items.forEach(i=>{
  const v=state.coops.reduce((ss,c)=>ss+SEASONS.reduce((z,se)=>z+(
    inv?.getQuantity
      ? inv.getQuantity('kushiro',{year,coop:c,season:se,group:g.name,item:i})
      : (m[[year,c,g.name,i,se].join('|')]||0)
  ),0),0);
  html+=`<th>${v?fmt(v):''}</th>`;
}));
 const grandTotal=inv?.getQuantity
  ? inv.getQuantity('kushiro',{year})
  : total(year);

html+=`<th>${grandTotal?fmt(grandTotal):''}</th></tr></table></div>`;
  return html;
}

home=function(){
  const y=state.activeYear;
  app.innerHTML=`<section class="card"><div class="row"><h2>釧路産昆布 在庫集計表</h2><select id="homeYear" style="width:auto;padding:8px;border:1px solid #ccd6e2;border-radius:9px;background:#fff;font-size:15px">${yearOptions(y)}</select></div>${v71KushiroHomeTable(y)}<p class="muted" style="margin:8px 0 0">${esc(y)}年産の利用可能在庫です。0は空欄表示です。</p></section><section class="grid"><button class="action" id="shipHome" style="border-left:6px solid #e05a47">📦 出荷指示<small>生産年度指定・PDF・FAX</small></button><button class="action orange" id="c">▦ 在庫表<small>大きな表で表示・PDF出力</small></button><button class="action purple" id="d">≡ 入出庫履歴<small>年度を含めて修正・削除</small></button><button class="action green" id="a">↓ 入庫登録<small>生産年度・季節・分類・数量</small></button><button class="action gray" id="moreHome">⋯ その他<small>その他の機能</small></button><button class="action blue" id="b">↑ 出庫登録<small>生産年度別の在庫から減算</small></button><button class="action gray" id="e">⇩ データ出力<small>Excel・CSV・バックアップ</small></button><button class="action gray" id="f">⚙ マスター設定<small>漁協・細分類を確認</small></button></section>`;
  homeYear.onchange=()=>{setActiveYear(homeYear.value);home()};
  a.onclick=()=>form('in');b.onclick=()=>form('out');c.onclick=stock;d.onclick=logs;e.onclick=exportsPage;f.onclick=masters;shipHome.onclick=shipments;moreHome.onclick=exportsPage;
};

/* ===== v70: 共通「⬅️ ひとつ前に戻る」ナビゲーション ===== */
(function(){
  const navStack=[];
  let current={name:'productLanding',args:[]};
  let restoring=false;
  const names=[
    'productLanding','productChoicePage','companyMasterPage','globalShipmentHistory',
    'home','form','stock','logs','exportsPage','masters','shipmentForm','shipmentDetail','shipments',
    'hHome','hForm','hStock','hLogs','hShipments','hShipForm','hShipDetail','hMore',
    'nHome','nForm','nStock','nLogs','nShipments','nShipForm','nShipDetail','nMore',
    'smHome','smForm','smStock','smLogs','smShipments','smShipForm','smShipDetail','smMore'
  ];
  function addBackButton(){
    const old=document.getElementById('v70OneBack'); if(old)old.remove();
    if(!current || current.name==='productLanding') return;
    const wrap=document.createElement('section');
    wrap.id='v70OneBack'; wrap.className='card'; wrap.style.marginTop='14px';
    wrap.innerHTML='<button class="btn secondary" style="width:100%;font-size:16px;font-weight:700;padding:13px 16px">⬅️ ひとつ前に戻る</button>';
    wrap.querySelector('button').onclick=function(){
      const prev=navStack.pop();
      if(!prev){ productLanding(); return; }
      const fn=window[prev.name];
      if(typeof fn!=='function'){ productLanding(); return; }
      restoring=true;
      try{ fn.apply(window,prev.args||[]); } finally { restoring=false; }
      current=prev;
      setTimeout(addBackButton,0);
    };
    app.appendChild(wrap);
  }
  names.forEach(function(name){
    const original=window[name]; if(typeof original!=='function')return;
    window[name]=function(){
      const args=Array.prototype.slice.call(arguments);
      if(!restoring && current && !(current.name===name && JSON.stringify(current.args||[])===JSON.stringify(args))){
        navStack.push(current);
        if(navStack.length>40)navStack.shift();
      }
      const result=original.apply(this,args);
      current={name:name,args:args};
      if(result && typeof result.then==='function') result.finally(function(){setTimeout(addBackButton,0)});
      else setTimeout(addBackButton,0);
      return result;
    };
  });
  window.__v70AddOneBack=addBackButton;
  setTimeout(addBackButton,0);
})();

/* ===== v73: トップ右下の設定アイコン + 共通設定/全データバックアップ ===== */
function v73BackupAll(){
  const data={
    app:'昆布在庫・出荷管理',version:73,exportedAt:new Date().toISOString(),
    kushiro:state,hidaka:hState,nemuro:nState,sanmae:smState
  };
  download('昆布在庫出荷管理_全データバックアップ_'+today()+'.json',JSON.stringify(data,null,2),'application/json;charset=utf-8');
}

function v73RestoreAll(file){
  if(!file)return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const d=JSON.parse(rd.result);
      if(!d || !d.kushiro || !d.hidaka || !d.nemuro || !d.sanmae) throw new Error('形式が違います');
      if(!confirm('4種類の昆布データ・出荷指示・会社マスターを、バックアップ内容に置き換えます。よろしいですか？'))return;
      state=d.kushiro; hState=d.hidaka; nState=d.nemuro; smState=d.sanmae;
      state.coops=Array.isArray(state.coops)&&state.coops.length?state.coops:[...oldCoops];
      state.records=Array.isArray(state.records)?state.records:[];
      state.shipments=Array.isArray(state.shipments)?state.shipments:[];
      state.pdfImports=Array.isArray(state.pdfImports)?state.pdfImports:[];
      state.companies=Array.isArray(state.companies)?state.companies:[];
      state.activeYear=YEARS.includes(state.activeYear)?state.activeYear:DEFAULT_YEAR;
      hState.records=Array.isArray(hState.records)?hState.records:[]; hState.shipments=Array.isArray(hState.shipments)?hState.shipments:[]; hState.pdfImports=Array.isArray(hState.pdfImports)?hState.pdfImports:[]; hState.activeYear=YEARS.includes(hState.activeYear)?hState.activeYear:DEFAULT_YEAR;
      nState.records=Array.isArray(nState.records)?nState.records:[]; nState.shipments=Array.isArray(nState.shipments)?nState.shipments:[]; nState.pdfImports=Array.isArray(nState.pdfImports)?nState.pdfImports:[]; nState.activeYear=YEARS.includes(nState.activeYear)?nState.activeYear:DEFAULT_YEAR;
      smState.records=Array.isArray(smState.records)?smState.records:[]; smState.shipments=Array.isArray(smState.shipments)?smState.shipments:[]; smState.pdfImports=Array.isArray(smState.pdfImports)?smState.pdfImports:[]; smState.activeYear=YEARS.includes(smState.activeYear)?smState.activeYear:DEFAULT_YEAR;
      save();hSave();nSave();smSave();
      alert('全データを復元しました。');
      productLanding();
    }catch(e){
      alert('このバックアップファイルは読み込めませんでした。');
    }
  };
  rd.readAsText(file);
}

function v73SettingsPage(){
  currentProduct=null;setHeader('設定');setNavVisible(false);
  app.innerHTML=`<section class="card" style="margin-top:22px">
    <div class="row"><h2>設定</h2><span class="pill">v73</span></div>
    <p class="muted">会社情報と、4種類すべての昆布データのバックアップを管理します。</p>
    <div style="display:grid;grid-template-columns:1fr;gap:12px;margin-top:18px">
      <button class="action gray" id="v73CompanyMaster" style="width:100%;padding:18px 16px"><b style="font-size:20px">⚙️ 会社マスター</b><small>会社名・住所・電話番号を編集</small></button>
      <button class="action blue" id="v73Backup" style="width:100%;padding:18px 16px"><b style="font-size:20px">💾 バックアップ</b><small>4種類の在庫・出荷指示・会社マスターを保存</small></button>
      <button class="action orange" id="v73Restore" style="width:100%;padding:18px 16px"><b style="font-size:20px">↩️ バックアップ復元</b><small>保存した全データバックアップを読み込む</small></button>
      <input id="v73RestoreFile" type="file" accept="application/json,.json" hidden>
    </div>
  </section>
  <section class="card" style="margin-top:14px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <button class="btn secondary" id="v73SettingsHome" aria-label="ホーム" title="ホーム" style="font-size:28px;padding:13px">🏠</button>
      <button class="btn secondary" id="v73SettingsBack" aria-label="ひとつ前に戻る" title="ひとつ前に戻る" style="font-size:28px;padding:13px">⬅️</button>
    </div>
  </section>`;
  document.getElementById('v73CompanyMaster').onclick=()=>{
    companyMasterPage();
    setTimeout(()=>{
      const b=document.getElementById('globalMasterBack');
      if(b){b.textContent='⬅️ 設定へ戻る';b.onclick=v73SettingsPage;}
    },0);
  };
  document.getElementById('v73Backup').onclick=v73BackupAll;
  document.getElementById('v73Restore').onclick=()=>document.getElementById('v73RestoreFile').click();
  document.getElementById('v73RestoreFile').onchange=e=>v73RestoreAll(e.target.files?.[0]);
  document.getElementById('v73SettingsHome').onclick=productLanding;
  document.getElementById('v73SettingsBack').onclick=productLanding;
}

/* トップは業務2ボタンを維持し、設定は右下の歯車アイコンだけにする。 */
productLanding=function(){
  currentProduct=null;setHeader('昆布在庫管理');setNavVisible(false);
  app.innerHTML=`<section class="card" style="margin-top:22px;position:relative;padding-bottom:86px">
    <div class="row"><h2>昆布在庫・出荷管理</h2><span class="pill">v73</span></div>
    <p class="muted">行いたい業務を選択してください。在庫管理と出荷指示を入口から分けています。</p>
    <div style="display:grid;gap:12px;margin-top:18px">
      <button class="action orange" id="v73Inventory" style="width:100%;padding:22px 16px"><b style="font-size:22px">📊 在庫管理</b><small>4種類の昆布から選択して、在庫状況・入出庫・在庫表を管理</small></button>
      <button class="action blue" id="v73Shipment" style="width:100%;padding:22px 16px"><b style="font-size:22px">📦 出荷指示</b><small>4種類の昆布から選択して、出荷指示を作成・PDF/FAX出力</small></button>
    </div>
    <button id="v73Gear" aria-label="設定" title="設定" style="position:absolute;right:18px;bottom:16px;width:56px;height:56px;border:1px solid #d5dee8;border-radius:18px;background:#edf2f7;color:#12304f;font-size:29px;line-height:1;box-shadow:0 4px 12px rgba(16,42,67,.10)">⚙️</button>
  </section>`;
  document.getElementById('v73Inventory').onclick=()=>productChoicePage('inventory');
  document.getElementById('v73Shipment').onclick=()=>productChoicePage('shipment');
  document.getElementById('v73Gear').onclick=v73SettingsPage;
};

/* 起動中の画面もv73トップへ更新 */
productLanding();

/* ===== v74: 出荷指示トップを4タブ + 常時一覧 + 下部3ボタンに再構成 ===== */
function v74ShipmentShortName(product){
  return {kushiro:'釧路',hidaka:'日高',nemuro:'根室',sanmae:'釧棹'}[product]||'';
}
function v74ShipmentMenu(){
  currentProduct=null;
  setHeader('出荷指示');
  setNavVisible(false);
  const rows=globalShipmentRows().sort((a,b)=>{
    const ad=a.s.shipDate||a.s.createdAt||a.s.updatedAt||'';
    const bd=b.s.shipDate||b.s.createdAt||b.s.updatedAt||'';
    const c=String(bd).localeCompare(String(ad));
    if(c!==0)return c;
    return String(b.s.createdAt||b.s.updatedAt||'').localeCompare(String(a.s.createdAt||a.s.updatedAt||''));
  });
  const body=rows.map(r=>`<tr data-gprod="${r.product}" data-gid="${esc(r.s.id||'')}" style="cursor:pointer">
    <td style="white-space:nowrap">${esc(r.s.shipDate||'')}</td>
    <td><b>${esc(v74ShipmentShortName(r.product))}</b></td>
    <td>${esc(r.dst||'')}</td>
    <td style="text-align:right;white-space:nowrap">${fmt(r.qty)}</td>
    <td style="white-space:nowrap">${esc(shipmentStatusJa(r.s.status))}</td>
  </tr>`).join('')||'<tr><td colspan="5" class="empty">出荷指示はありません</td></tr>';
  app.innerHTML=`
    <section class="card" style="margin-top:14px;padding:14px">
      <div class="row" style="align-items:center;margin-bottom:10px"><h2 style="margin:0;font-size:20px">出荷指示</h2><span class="pill">v74</span></div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">
        <button class="btn" id="v74K" style="padding:12px 4px;font-size:16px;font-weight:800">釧路</button>
        <button class="btn" id="v74H" style="padding:12px 4px;font-size:16px;font-weight:800">日高</button>
        <button class="btn" id="v74N" style="padding:12px 4px;font-size:16px;font-weight:800">根室</button>
        <button class="btn" id="v74S" style="padding:12px 4px;font-size:16px;font-weight:800">釧棹</button>
      </div>
    </section>
    <section class="card" id="v74ShipmentList" style="margin-top:12px;padding:14px">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0;font-size:19px">出荷指示一覧</h2><span class="muted" style="font-size:12px">新しい順</span></div>
      <div class="tablewrap" style="max-height:58vh;overflow:auto;-webkit-overflow-scrolling:touch">
        <table style="min-width:650px;font-size:13px">
          <thead><tr><th>出荷日</th><th>昆布</th><th>出荷先</th><th>数量</th><th>状態</th></tr></thead>
          <tbody id="v74ShipBody">${body}</tbody>
        </table>
      </div>
    </section>
    <section class="card" style="margin-top:12px;padding:12px">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        <button class="btn secondary" id="v74Home" aria-label="ホーム" title="ホーム" style="font-size:25px;padding:12px 4px">🏠</button>
        <button class="btn secondary" id="v74Back" aria-label="ひとつ前に戻る" title="ひとつ前に戻る" style="font-size:25px;padding:12px 4px">⬅️</button>
        <button class="btn secondary" id="v74List" aria-label="一覧" title="一覧" style="font-size:25px;padding:12px 4px">📋</button>
      </div>
    </section>`;
  document.getElementById('v74K').onclick=()=>openProductContext('kushiro','shipment');
  document.getElementById('v74H').onclick=()=>openProductContext('hidaka','shipment');
  document.getElementById('v74N').onclick=()=>openProductContext('nemuro','shipment');
  document.getElementById('v74S').onclick=()=>openProductContext('sanmae','shipment');
  document.getElementById('v74ShipBody').onclick=e=>{
    const tr=e.target.closest('[data-gid]');
    if(tr)openGlobalShipment(tr.dataset.gprod,tr.dataset.gid);
  };
  document.getElementById('v74Home').onclick=productLanding;
  document.getElementById('v74Back').onclick=productLanding;
  document.getElementById('v74List').onclick=allShipmentHistory;
}

const _v74ProductChoiceBase=productChoicePage;
productChoicePage=function(mode){
  if(mode==='shipment')return v74ShipmentMenu();
  const r=_v74ProductChoiceBase(mode);
  const pill=app.querySelector('.pill');if(pill)pill.textContent='v74';
  return r;
};

const _v74LandingBase=productLanding;
productLanding=function(){
  const r=_v74LandingBase();
  const pill=app.querySelector('.pill');if(pill)pill.textContent='v74';
  return r;
};

/* 起動中画面もv74へ */
productLanding();

/* ===== v75: 出荷指示トップ一覧を6列・コンパクト表示 ===== */
function v75ShipmentStatusShort(status){return {draft:'下書き',confirmed:'確定済',shipped:'出荷済',cancelled:'取消'}[status]||shipmentStatusJa(status)}
function v75ShipmentMenu(){
  currentProduct=null;
  setHeader('出荷指示');
  setNavVisible(false);
  const rows=globalShipmentRows().sort((a,b)=>{
    const ad=a.s.shipDate||a.s.createdAt||a.s.updatedAt||'';
    const bd=b.s.shipDate||b.s.createdAt||b.s.updatedAt||'';
    const c=String(bd).localeCompare(String(ad));
    if(c!==0)return c;
    return String(b.s.createdAt||b.s.updatedAt||'').localeCompare(String(a.s.createdAt||a.s.updatedAt||''));
  });
  const body=rows.map(r=>`<tr data-gprod="${r.product}" data-gid="${esc(r.s.id||'')}" style="cursor:pointer">
    <td class="v75-date">${esc(r.s.shipDate||'')}</td>
    <td class="v75-kombu"><b>${esc(v74ShipmentShortName(r.product))}</b></td>
    <td class="v75-company" title="${esc(r.src||'')}">${esc(r.src||'')}</td>
    <td class="v75-company" title="${esc(r.dst||'')}">${esc(r.dst||'')}</td>
    <td class="v75-qty">${fmt(r.qty)}</td>
    <td class="v75-status">${esc(v75ShipmentStatusShort(r.s.status))}</td>
  </tr>`).join('')||'<tr><td colspan="6" class="empty">出荷指示はありません</td></tr>';
  app.innerHTML=`
    <style>
      #v75ShipTable{min-width:540px;width:100%;table-layout:fixed;font-size:11.5px}
      #v75ShipTable th,#v75ShipTable td{padding:7px 5px;line-height:1.25;vertical-align:middle}
      #v75ShipTable th:nth-child(1),#v75ShipTable td:nth-child(1){width:82px}
      #v75ShipTable th:nth-child(2),#v75ShipTable td:nth-child(2){width:46px;text-align:center}
      #v75ShipTable th:nth-child(3),#v75ShipTable td:nth-child(3){width:108px}
      #v75ShipTable th:nth-child(4),#v75ShipTable td:nth-child(4){width:108px}
      #v75ShipTable th:nth-child(5),#v75ShipTable td:nth-child(5){width:50px;text-align:right}
      #v75ShipTable th:nth-child(6),#v75ShipTable td:nth-child(6){width:72px;text-align:center}
      #v75ShipTable .v75-date{white-space:nowrap;font-variant-numeric:tabular-nums}
      #v75ShipTable .v75-company{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #v75ShipTable .v75-qty{white-space:nowrap;font-variant-numeric:tabular-nums}
      #v75ShipTable .v75-status{white-space:nowrap}
      @media(max-width:430px){
        #v75ShipTable{min-width:505px;font-size:10.5px}
        #v75ShipTable th,#v75ShipTable td{padding:6px 3px}
        #v75ShipTable th:nth-child(1),#v75ShipTable td:nth-child(1){width:52px}
        #v75ShipTable th:nth-child(2),#v75ShipTable td:nth-child(2){width:40px}
        #v75ShipTable th:nth-child(3),#v75ShipTable td:nth-child(3){width:96px}
        #v75ShipTable th:nth-child(4),#v75ShipTable td:nth-child(4){width:96px}
        #v75ShipTable th:nth-child(5),#v75ShipTable td:nth-child(5){width:28px}
        #v75ShipTable th:nth-child(6),#v75ShipTable td:nth-child(6){width:66px}
      }
    </style>
    <section class="card" style="margin-top:14px;padding:14px">
      <div class="row" style="align-items:center;margin-bottom:10px"><h2 style="margin:0;font-size:20px">出荷指示</h2><span class="pill">v75</span></div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">
        <button class="btn" id="v75K" style="padding:12px 4px;font-size:16px;font-weight:800">釧路</button>
        <button class="btn" id="v75H" style="padding:12px 4px;font-size:16px;font-weight:800">日高</button>
        <button class="btn" id="v75N" style="padding:12px 4px;font-size:16px;font-weight:800">根室</button>
        <button class="btn" id="v75S" style="padding:12px 4px;font-size:16px;font-weight:800">釧棹</button>
      </div>
    </section>
    <section class="card" id="v75ShipmentList" style="margin-top:12px;padding:14px">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0;font-size:19px">出荷指示一覧</h2><span class="muted" style="font-size:12px">新しい順</span></div>
      <div class="tablewrap" style="max-height:58vh;overflow:auto;-webkit-overflow-scrolling:touch">
        <table id="v75ShipTable">
          <thead><tr><th>出荷日</th><th>昆布</th><th>出荷元</th><th>出荷先</th><th>個数</th><th>状態</th></tr></thead>
          <tbody id="v75ShipBody">${body}</tbody>
        </table>
      </div>
    </section>
    <section class="card" style="margin-top:12px;padding:12px">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        <button class="btn secondary" id="v75Home" aria-label="ホーム" title="ホーム" style="font-size:25px;padding:12px 4px">🏠</button>
        <button class="btn secondary" id="v75Back" aria-label="ひとつ前に戻る" title="ひとつ前に戻る" style="font-size:25px;padding:12px 4px">⬅️</button>
        <button class="btn secondary" id="v75List" aria-label="一覧" title="一覧" style="font-size:25px;padding:12px 4px">📋</button>
      </div>
    </section>`;
  document.getElementById('v75K').onclick=()=>openProductContext('kushiro','shipment');
  document.getElementById('v75H').onclick=()=>openProductContext('hidaka','shipment');
  document.getElementById('v75N').onclick=()=>openProductContext('nemuro','shipment');
  document.getElementById('v75S').onclick=()=>openProductContext('sanmae','shipment');
  document.getElementById('v75ShipBody').onclick=e=>{
    const tr=e.target.closest('[data-gid]');
    if(tr)openGlobalShipment(tr.dataset.gprod,tr.dataset.gid);
  };
  document.getElementById('v75Home').onclick=productLanding;
  document.getElementById('v75Back').onclick=productLanding;
  document.getElementById('v75List').onclick=allShipmentHistory;
}

const _v75ProductChoiceBase=productChoicePage;
productChoicePage=function(mode){
  if(mode==='shipment')return v75ShipmentMenu();
  const r=_v75ProductChoiceBase(mode);
  const pill=app.querySelector('.pill');if(pill)pill.textContent='v75';
  return r;
};
const _v75LandingBase=productLanding;
productLanding=function(){
  const r=_v75LandingBase();
  const pill=app.querySelector('.pill');if(pill)pill.textContent='v75';
  return r;
};
productLanding();


/* ===== v79: 出荷指示一覧 幅・中央寄せ調整 ===== */
function v78ShortShipDate(v){const m=String(v||'').match(/^(?:\d{4})-(\d{1,2})-(\d{1,2})$/);return m?(Number(m[1])+'/'+Number(m[2])):String(v||'')}
const V76_SHIP_CHECK_KEY='kombu-v76-shipment-checks';
function v76LoadShipChecks(){try{return JSON.parse(localStorage.getItem(V76_SHIP_CHECK_KEY)||'{}')||{}}catch(e){return {}}}
function v76SaveShipChecks(v){localStorage.setItem(V76_SHIP_CHECK_KEY,JSON.stringify(v||{}))}
function v76ShipCheckId(product,id){return String(product||'')+'::'+String(id||'')}
function v76SetShipCheck(product,id,field,checked){const all=v76LoadShipChecks(),k=v76ShipCheckId(product,id);all[k]=all[k]||{};all[k][field]=!!checked;v76SaveShipChecks(all)}
function v76ShipmentMenu(){
  currentProduct=null;
  setHeader('出荷依頼一覧');
  setNavVisible(false);
  const checks=v76LoadShipChecks();
  const rows=globalShipmentRows()
  .filter(r=>r.s.status!=='shipped'&&r.s.status!=='cancelled')
  .sort((a,b)=>{
    const ad=a.s.shipDate||a.s.createdAt||a.s.updatedAt||'';
    const bd=b.s.shipDate||b.s.createdAt||b.s.updatedAt||'';
    const c=String(bd).localeCompare(String(ad));
    if(c!==0)return c;
    return String(b.s.createdAt||b.s.updatedAt||'').localeCompare(String(a.s.createdAt||a.s.updatedAt||''));
  });
  const body=rows.map(r=>{const ck=checks[v76ShipCheckId(r.product,r.s.id)]||{};return `<tr data-gprod="${r.product}" data-gid="${esc(r.s.id||'')}">
    <td class="v76-check"><input type="checkbox" data-v76check="fax" ${ck.fax?'checked':''} aria-label="FAX済"></td>
    <td class="v76-check"><input type="checkbox" data-v76check="slip" ${ck.slip?'checked':''} aria-label="伝票済"></td>
    <td><div class="v76-cellscroll v76-date" title="${esc(r.s.shipDate||'')}">${esc(v78ShortShipDate(r.s.shipDate||''))}</div></td>
    <td class="v76-kombu"><b>${esc(v74ShipmentShortName(r.product))}</b></td>
    <td style="text-align:center"><div class="v76-cellscroll" title="${esc(r.src||'')}">${esc(r.src||'')}</div></td>
    <td style="text-align:center"><div class="v76-cellscroll" title="${esc(r.dst||'')}">${esc(r.dst||'')}</div></td>
    <td class="v76-qty"><div class="v78-qtyinner">${fmt(r.qty)}</div></td>
    <td class="v76-status">${esc(v75ShipmentStatusShort(r.s.status))}</td>
    <td class="v76-open"><button class="mini" data-v76open="1">開く</button></td>
  </tr>`}).join('')||'<tr><td colspan="9" class="empty">出荷指示はありません</td></tr>';
  app.innerHTML=`
    <style>
      #v76ShipTable{min-width:500px;width:100%;table-layout:fixed;font-size:10px}
      #v76ShipTable th,#v76ShipTable td{padding:4px 2px;line-height:1.15;vertical-align:middle;text-align:center}
      #v76ShipTable th:nth-child(1),#v76ShipTable td:nth-child(1),#v76ShipTable th:nth-child(2),#v76ShipTable td:nth-child(2){width:30px}
      #v76ShipTable th:nth-child(3),#v76ShipTable td:nth-child(3){width:5ch}
      #v76ShipTable th:nth-child(4),#v76ShipTable td:nth-child(4){width:38px}
      #v76ShipTable th:nth-child(5),#v76ShipTable td:nth-child(5),#v76ShipTable th:nth-child(6),#v76ShipTable td:nth-child(6){width:5em}
      #v76ShipTable th:nth-child(7),#v76ShipTable td:nth-child(7){width:46px}
      #v76ShipTable th:nth-child(8),#v76ShipTable td:nth-child(8){width:42px}
      #v76ShipTable th:nth-child(9),#v76ShipTable td:nth-child(9){width:38px}
      #v76ShipTable .v76-cellscroll{display:block;width:5em;max-width:100%;margin:0 auto;overflow-x:auto;overflow-y:hidden;white-space:nowrap;text-align:center;-webkit-overflow-scrolling:touch;scrollbar-width:none}
      #v76ShipTable .v76-cellscroll::-webkit-scrollbar{display:none}
      #v76ShipTable .v76-date{width:5ch;font-variant-numeric:tabular-nums;text-align:center;margin:0 auto}
      #v76ShipTable .v76-check{padding-left:1px!important;padding-right:1px!important}#v76ShipTable .v76-check input{width:14px;height:14px;margin:0;accent-color:#173760;vertical-align:middle}
      #v76ShipTable .v76-qty{white-space:nowrap;font-variant-numeric:tabular-nums;text-align:center;padding-left:1px!important;padding-right:1px!important}#v76ShipTable .v78-qtyinner{display:flex;align-items:center;justify-content:center;width:100%;min-height:24px;line-height:1;border:0;overflow:hidden;white-space:nowrap}
      #v76ShipTable .v76-status{white-space:nowrap}
      #v76ShipTable .v76-open{padding-left:1px!important;padding-right:1px!important}#v76ShipTable .v76-open .mini{padding:2px 4px;font-size:8px;line-height:1.1;min-height:20px;border-radius:5px;white-space:nowrap}
      @media(max-width:430px){
        #v76ShipTable{min-width:480px;font-size:9.5px}
        #v76ShipTable th,#v76ShipTable td{padding:3px 1px}
        #v76ShipTable th:nth-child(1),#v76ShipTable td:nth-child(1),#v76ShipTable th:nth-child(2),#v76ShipTable td:nth-child(2){width:27px}
        #v76ShipTable th:nth-child(3),#v76ShipTable td:nth-child(3){width:5ch}
        #v76ShipTable th:nth-child(4),#v76ShipTable td:nth-child(4){width:36px}
        #v76ShipTable th:nth-child(5),#v76ShipTable td:nth-child(5),#v76ShipTable th:nth-child(6),#v76ShipTable td:nth-child(6){width:5em}
        #v76ShipTable th:nth-child(7),#v76ShipTable td:nth-child(7){width:25px}
        #v76ShipTable th:nth-child(8),#v76ShipTable td:nth-child(8){width:44px}
        #v76ShipTable th:nth-child(9),#v76ShipTable td:nth-child(9){width:32px}
        #v76ShipTable .v76-check input{width:13px;height:13px}
      }
    </style>
    <section class="card" id="v159HiddenProductHeader" style="display:none!important">
      <div class="row" style="align-items:center;margin-bottom:10px"><h2 style="margin:0;font-size:20px">出荷指示</h2><span class="pill">v79</span></div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">
        <button class="btn" id="v76K" style="padding:12px 4px;font-size:16px;font-weight:800">釧路</button>
        <button class="btn" id="v76H" style="padding:12px 4px;font-size:16px;font-weight:800">日高</button>
        <button class="btn" id="v76N" style="padding:12px 4px;font-size:16px;font-weight:800">根室</button>
        <button class="btn" id="v76S" style="padding:12px 4px;font-size:16px;font-weight:800">釧棹</button>
      </div>
    </section>
    <section class="card" id="v76ShipmentList" style="margin-top:12px;padding:14px">
      <div class="row" style="margin-bottom:8px"><h2 style="margin:0;font-size:19px">出荷依頼一覧</h2><span class="muted" style="font-size:12px">新しい順</span></div>
      <div class="tablewrap" style="max-height:58vh;overflow:auto;-webkit-overflow-scrolling:touch">
        <table id="v76ShipTable">
          <thead><tr><th>FAX済</th><th>伝票済</th><th>出荷日</th><th>昆布</th><th>出荷元</th><th>出荷先</th><th>個数</th><th>状態</th><th>開く</th></tr></thead>
          <tbody id="v76ShipBody">${body}</tbody>
        </table>
      </div>
    </section>
    <section class="card" style="margin-top:12px;padding:12px">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
        <button class="btn secondary" id="v76Home" aria-label="ホーム" title="ホーム" style="font-size:25px;padding:12px 4px">🏠</button>
        <button class="btn secondary" id="v76Back" aria-label="ひとつ前に戻る" title="ひとつ前に戻る" style="font-size:25px;padding:12px 4px">⬅️</button>
        <button class="btn secondary" id="v76List" aria-label="一覧" title="一覧" style="font-size:25px;padding:12px 4px">📋</button>
      </div>
    </section>`;
  document.getElementById('v76K').onclick=()=>openProductContext('kushiro','shipment');
  document.getElementById('v76H').onclick=()=>openProductContext('hidaka','shipment');
  document.getElementById('v76N').onclick=()=>openProductContext('nemuro','shipment');
  document.getElementById('v76S').onclick=()=>openProductContext('sanmae','shipment');
  document.getElementById('v76ShipBody').onclick=e=>{
    const tr=e.target.closest('[data-gid]'); if(!tr)return;
    const cb=e.target.closest('[data-v76check]');
    if(cb){v76SetShipCheck(tr.dataset.gprod,tr.dataset.gid,cb.dataset.v76check,cb.checked);return}
    const ob=e.target.closest('[data-v76open]');
    if(ob){openGlobalShipment(tr.dataset.gprod,tr.dataset.gid);return}
  };
  document.getElementById('v76Home').onclick=productLanding;
  document.getElementById('v76Back').onclick=productLanding;
  document.getElementById('v76List').onclick=allShipmentHistory;
}
const _v76ProductChoiceBase=productChoicePage;
productChoicePage=function(mode){if(mode==='shipment')return v76ShipmentMenu();const r=_v76ProductChoiceBase(mode);const pill=app.querySelector('.pill');if(pill)pill.textContent='v78';return r};
const _v76LandingBase=productLanding;
productLanding=function(){const r=_v76LandingBase();const pill=app.querySelector('.pill');if(pill)pill.textContent='v78';return r};
productLanding();

/* ===== v80: 在庫管理画面 共通4昆布クイックスイッチ ===== */
let v80InventoryMode=false;
function v80InventoryProductName(p){return {kushiro:'釧路',nemuro:'根室',hidaka:'日高',sanmae:'釧棹'}[p]||''}
function v80InjectInventorySwitcher(){
  if(!v80InventoryMode||!currentProduct||!app||document.getElementById('v80InventorySwitcher'))return;
  const box=document.createElement('section');
  box.id='v80InventorySwitcher';
  box.className='card';
  box.style.cssText='margin-top:12px;margin-bottom:12px;padding:10px 12px;';
  box.innerHTML=`<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px">
    ${[['kushiro','釧路'],['nemuro','根室'],['hidaka','日高'],['sanmae','釧棹']].map(([p,n])=>`<button class="btn ${currentProduct===p?'':'secondary'}" data-v80inv="${p}" style="padding:10px 2px;font-size:14px;font-weight:800;min-width:0">${n}</button>`).join('')}
  </div>`;
  app.insertBefore(box,app.firstChild);
  box.querySelectorAll('[data-v80inv]').forEach(b=>b.onclick=()=>openProductContext(b.dataset.v80inv,'inventory'));
}
const v80Observer=new MutationObserver(()=>{if(v80InventoryMode&&currentProduct)requestAnimationFrame(v80InjectInventorySwitcher)});
/* v122 perf: obsolete observer disabled; screen wrappers apply switcher explicitly */

const _v80OpenProductContext=openProductContext;
openProductContext=function(product,mode){v80InventoryMode=(mode!=='shipment');const r=_v80OpenProductContext(product,mode);v80InjectInventorySwitcher();return r};

const _v80Home=home; home=function(){v80InventoryMode=true;const r=_v80Home();v80InjectInventorySwitcher();return r};
const _v80HHome=hHome; hHome=function(){v80InventoryMode=true;const r=_v80HHome();v80InjectInventorySwitcher();return r};
const _v80NHome=nHome; nHome=function(){v80InventoryMode=true;const r=_v80NHome();v80InjectInventorySwitcher();return r};
const _v80SmHome=smHome; smHome=function(){v80InventoryMode=true;const r=_v80SmHome();v80InjectInventorySwitcher();return r};

const _v80Shipments=shipments; shipments=function(){v80InventoryMode=false;return _v80Shipments()};
const _v80HShipments=hShipments; hShipments=function(){v80InventoryMode=false;return _v80HShipments()};
const _v80NShipments=nShipments; nShipments=function(){v80InventoryMode=false;return _v80NShipments()};
const _v80SmShipments=smShipments; smShipments=function(){v80InventoryMode=false;return _v80SmShipments()};

const _v80ProductLanding=productLanding;
productLanding=function(){v80InventoryMode=false;const r=_v80ProductLanding();const pill=app.querySelector('.pill');if(pill)pill.textContent='v80';return r};
const _v80ProductChoice=productChoicePage;
productChoicePage=function(mode){v80InventoryMode=false;const r=_v80ProductChoice(mode);const pill=app.querySelector('.pill');if(pill)pill.textContent='v80';return r};

/* 下部ナビから在庫系機能へ進む場合もスイッチを維持する */
const _v80BindNav=bindNav;
bindNav=function(){
  _v80BindNav();
  if(shipNavBtnEl)shipNavBtnEl.onclick=()=>{v80InventoryMode=false;return currentProduct==='hidaka'?hShipments():currentProduct==='nemuro'?nShipments():currentProduct==='sanmae'?smShipments():shipments()};
  if(stockNavBtnEl)stockNavBtnEl.onclick=()=>{v80InventoryMode=true;const r=currentProduct==='hidaka'?hStock():currentProduct==='nemuro'?nStock():currentProduct==='sanmae'?smStock():stock();v80InjectInventorySwitcher();return r};
  if(logsNavBtnEl)logsNavBtnEl.onclick=()=>{v80InventoryMode=true;const r=currentProduct==='hidaka'?hLogs():currentProduct==='nemuro'?nLogs():currentProduct==='sanmae'?smLogs():logs();v80InjectInventorySwitcher();return r};
  if(inNavBtnEl)inNavBtnEl.onclick=()=>{v80InventoryMode=true;const r=currentProduct==='hidaka'?hForm('in'):currentProduct==='nemuro'?nForm('in'):currentProduct==='sanmae'?smForm('in'):form('in');v80InjectInventorySwitcher();return r};
  if(moreBtnEl)moreBtnEl.onclick=()=>{v80InventoryMode=true;const r=currentProduct==='hidaka'?hMore():currentProduct==='nemuro'?nMore():currentProduct==='sanmae'?smMore():exportsPage();v80InjectInventorySwitcher();return r};
};

/* 現在表示中トップをv80へ */
productLanding();

/* ===== v81: 全4昆布の在庫トップに年産別在庫集計表を常時表示 ===== */
function v81HidakaHomeTable(y){
 const m=hMatrix(), rows=H_SECTIONS.flatMap(s=>s.items.map(g=>({section:s.name,grade:g})));
 let h='<div class="tablewrap" style="margin-top:12px;max-height:430px;overflow:auto"><table class="stock-report" style="min-width:1850px"><tr><th>区分</th><th>等級</th>'+H_LOCATIONS.map(l=>`<th>${esc(l)}</th>`).join('')+'<th>計</th></tr>';
 let last=null;
 for(const r of rows){const start=r.section!==last;h+=`<tr ${start?'style="border-top:1.6px solid #111"':''}><td>${start?esc(r.section):''}</td><td>${esc(r.grade)}</td>`;let rt=0;for(const loc of H_LOCATIONS){const q=m[[y,loc,r.section,r.grade].join('|')]||0;rt+=q;h+=`<td>${q?fmt(q):''}</td>`}h+=`<td>${rt?fmt(rt):''}</td></tr>`;last=r.section}
 h+=`<tr style="border-top:1.6px solid #111"><th colspan="2">合計</th>${H_LOCATIONS.map(loc=>{const q=rows.reduce((a,r)=>a+(m[[y,loc,r.section,r.grade].join('|')]||0),0);return `<th>${q?fmt(q):''}</th>`}).join('')}<th>${hTotal(y)?fmt(hTotal(y)):''}</th></tr></table></div>`;return h;
}
function v81NemuroHomeTable(y){
 const m=nMatrix(),cols=nItems();let h='<div class="tablewrap" style="margin-top:12px;max-height:430px;overflow:auto"><table class="stock-report"><tr><th rowspan="2">組合名</th><th rowspan="2">区分</th>'+N_GROUPS.map(g=>`<th colspan="${g.items.length}">${esc(g.name)}</th>`).join('')+'<th rowspan="2">計</th></tr><tr>'+N_GROUPS.flatMap(g=>g.items).map(i=>`<th>${esc(i)}</th>`).join('')+'</tr>';
 for(const coop of N_COOPS){for(const season of N_SEASONS){let rt=0;h+=`<tr><th>${season===N_SEASONS[0]?esc(coop):''}</th><th>${esc(season)}</th>`;for(const c of cols){const q=m[[y,coop,season,c.group,c.item].join('|')]||0;rt+=q;h+=`<td>${q?fmt(q):''}</td>`}h+=`<td>${rt?fmt(rt):''}</td></tr>`}h+='<tr class="stock-subtotal"><th></th><th>小計</th>';let st=0;for(const c of cols){const q=N_SEASONS.reduce((a,se)=>a+(m[[y,coop,se,c.group,c.item].join('|')]||0),0);st+=q;h+=`<td>${q?fmt(q):''}</td>`}h+=`<td>${st?fmt(st):''}</td></tr>`}
 h+='<tfoot><tr><th colspan="2">合計</th>';let gt=0;for(const c of cols){const q=N_COOPS.reduce((a,co)=>a+N_SEASONS.reduce((b,se)=>b+(m[[y,co,se,c.group,c.item].join('|')]||0),0),0);gt+=q;h+=`<th>${q?fmt(q):''}</th>`}h+=`<th>${gt?fmt(gt):''}</th></tr></tfoot></table></div>`;return h;
}
function v81SanmaeHomeTable(y){
 const m=smMatrix(),cols=smItems();let h='<div class="tablewrap" style="margin-top:12px;max-height:430px;overflow:auto"><table class="stock-report"><tr><th rowspan="2">組合名</th><th rowspan="2">区分</th>'+S_GROUPS.map(g=>`<th colspan="${g.items.length}">${esc(g.name)}</th>`).join('')+'<th rowspan="2">計</th></tr><tr>'+S_GROUPS.flatMap(g=>g.items).map(i=>`<th>${esc(i)}</th>`).join('')+'</tr>';
 for(const coop of S_COOPS){for(const season of S_SEASONS){let rt=0;h+=`<tr><th>${season===S_SEASONS[0]?esc(coop):''}</th><th>${esc(season)}</th>`;for(const c of cols){const q=m[[y,coop,season,c.group,c.item].join('|')]||0;rt+=q;h+=`<td>${q?fmt(q):''}</td>`}h+=`<td>${rt?fmt(rt):''}</td></tr>`}h+='<tr class="stock-subtotal"><th></th><th>小計</th>';let st=0;for(const c of cols){const q=S_SEASONS.reduce((a,se)=>a+(m[[y,coop,se,c.group,c.item].join('|')]||0),0);st+=q;h+=`<td>${q?fmt(q):''}</td>`}h+=`<td>${st?fmt(st):''}</td></tr>`}
 h+='<tfoot><tr><th colspan="2">合計</th>';let gt=0;for(const c of cols){const q=S_COOPS.reduce((a,co)=>a+S_SEASONS.reduce((b,se)=>b+(m[[y,co,se,c.group,c.item].join('|')]||0),0),0);gt+=q;h+=`<th>${q?fmt(q):''}</th>`}h+=`<th>${gt?fmt(gt):''}</th></tr></tfoot></table></div>`;return h;
}
function v81ReplaceHomeSummary(kind){
 const switcher=document.getElementById('v80InventorySwitcher');const cards=[...app.querySelectorAll(':scope > section.card')].filter(x=>x!==switcher);const card=cards[0];if(!card)return;
 if(kind==='hidaka'){const y=hState.activeYear;card.innerHTML=`<div class="row"><h2>日高昆布 在庫集計表</h2><select id="v81y" style="width:auto">${hYearOptions(y)}</select></div>${v81HidakaHomeTable(y)}<p class="muted" style="margin:8px 0 0">${esc(y)}年産の利用可能在庫です。0は空欄表示です。</p>`;v81y.onchange=()=>{hState.activeYear=v81y.value;hSave();hHome()}}
 if(kind==='nemuro'){const y=nState.activeYear;card.innerHTML=`<div class="row"><h2>根室産昆布 在庫集計表</h2><select id="v81y" style="width:auto">${nYearOptions(y)}</select></div>${v81NemuroHomeTable(y)}<p class="muted" style="margin:8px 0 0">${esc(y)}年産の利用可能在庫です。0は空欄表示です。</p>`;v81y.onchange=()=>{nState.activeYear=v81y.value;nSave();nHome()}}
 if(kind==='sanmae'){const y=smState.activeYear;card.innerHTML=`<div class="row"><h2>釧路産棹前昆布 在庫集計表</h2><select id="v81y" style="width:auto">${smYearOptions(y)}</select></div>${v81SanmaeHomeTable(y)}<p class="muted" style="margin:8px 0 0">${esc(y)}年産の利用可能在庫です。0は空欄表示です。</p>`;v81y.onchange=()=>{smState.activeYear=v81y.value;smSave();smHome()}}
}
const _v81HHome=hHome;hHome=function(){const r=_v81HHome();v81ReplaceHomeSummary('hidaka');return r};
const _v81NHome=nHome;nHome=function(){const r=_v81NHome();v81ReplaceHomeSummary('nemuro');return r};
const _v81SmHome=smHome;smHome=function(){const r=_v81SmHome();v81ReplaceHomeSummary('sanmae');return r};
/* ===== /v81 ===== */


/* ===== v82: 在庫集計表 左2列固定 + 日高/釧棹列幅コンパクト化 ===== */
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .stock-report.v82-inventory-table{width:max-content!important;min-width:100%!important;table-layout:auto!important;border-collapse:separate!important;border-spacing:0!important}
    .stock-report.v82-inventory-table th,.stock-report.v82-inventory-table td{padding:4px 5px!important;white-space:nowrap;background-clip:padding-box!important}
    .stock-report.v82-inventory-table tr>:not(.v82-fixed1):not(.v82-fixed2){min-width:54px;max-width:68px}
    .stock-report.v82-inventory-table .v82-fixed1{position:-webkit-sticky!important;position:sticky!important;left:0!important;z-index:20!important;min-width:108px!important;width:108px!important;max-width:108px!important;background:#fff!important;text-align:left!important;transform:translateZ(0)}
    .stock-report.v82-inventory-table .v82-fixed2{position:-webkit-sticky!important;position:sticky!important;left:108px!important;z-index:20!important;min-width:64px!important;width:64px!important;max-width:64px!important;background:#fff!important;text-align:center!important;box-shadow:2px 0 0 #cfd8e3;transform:translateZ(0)}
    .stock-report.v82-inventory-table tr:first-child>.v82-fixed1,
    .stock-report.v82-inventory-table tr:first-child>.v82-fixed2{background:#eaf0f7!important;z-index:7!important;font-weight:700}
    .stock-report.v82-inventory-table .group.v82-fixed1,
    .stock-report.v82-inventory-table .group.v82-fixed2{background:#dbe7f5!important}
    .stock-report.v82-inventory-table .sub.v82-fixed1,
    .stock-report.v82-inventory-table .sub.v82-fixed2{background:#f2f6fa!important}
    .stock-report.v82-inventory-table .total.v82-fixed1,
    .stock-report.v82-inventory-table .total.v82-fixed2{background:#f6f8fb!important}
    .tablewrap.v82-scroll{overflow-x:auto!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch;position:relative!important;isolation:isolate!important;transform:translateZ(0)}
  `;
  document.head.appendChild(style);

  function decorateTable(table){
    if(!table||table.classList.contains('v82-inventory-table'))return;
    table.classList.add('v82-inventory-table');
    const rows=[...table.rows];
    if(!rows.length)return;
    const first=rows[0];
    if(first.cells[0])first.cells[0].classList.add('v82-fixed1');
    if(first.cells[1])first.cells[1].classList.add('v82-fixed2');
    const twoHeader=!!(first.cells[0]&&Number(first.cells[0].rowSpan)>1);
    const start=twoHeader?2:1;
    for(let i=start;i<rows.length;i++){
      const row=rows[i];
      if(!row.cells||row.cells.length<2)continue;
      if(Number(row.cells[0].colSpan)>=2)continue;
      row.cells[0].classList.add('v82-fixed1');
      row.cells[1].classList.add('v82-fixed2');
    }
    const wrap=table.closest('.tablewrap');if(wrap)wrap.classList.add('v82-scroll');
  }
  function decorateInventoryTables(){
    if(!window.v80InventoryMode)return;
    app.querySelectorAll('table.stock-report').forEach(decorateTable);
  }
  const obs=new MutationObserver(()=>requestAnimationFrame(decorateInventoryTables));
  /* v122 perf: obsolete v82 observer disabled */

  // 既存の在庫画面遷移後にも確実に適用
  const names=['home','stock','hHome','hStock','nHome','nStock','smHome','smStock'];
  names.forEach(name=>{
    const fn=window[name];if(typeof fn!=='function')return;
    window[name]=function(){const r=fn.apply(this,arguments);requestAnimationFrame(decorateInventoryTables);return r};
  });

  // バージョン表示をv82へ統一
  const oldLanding=window.productLanding;
  if(typeof oldLanding==='function')window.productLanding=function(){const r=oldLanding.apply(this,arguments);const pill=app.querySelector('.pill');if(pill)pill.textContent='v83';return r};
  const oldChoice=window.productChoicePage;
  if(typeof oldChoice==='function')window.productChoicePage=function(){const r=oldChoice.apply(this,arguments);const pill=app.querySelector('.pill');if(pill)pill.textContent='v83';return r};
  requestAnimationFrame(decorateInventoryTables);
})();
/* v83: iPhone Safari対策。stickyセルがborder-collapseで一緒に流れる問題を避けるため、
   在庫表はborder-collapse:separate + sticky + 独立スクロールコンテナに変更。 */
/* ===== /v82 ===== */

/* ===== v84: iPhone Safari確実固定 - scrollLeft分をJSで相殺 ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    .tablewrap.v84-hardfreeze{position:relative!important;overflow:auto!important;-webkit-overflow-scrolling:touch!important;isolation:isolate!important}
    .tablewrap.v84-hardfreeze table.stock-report .v82-fixed1,
    .tablewrap.v84-hardfreeze table.stock-report .v82-fixed2{
      position:relative!important;left:auto!important;right:auto!important;
      z-index:40!important;background:#fff!important;
      will-change:transform!important;
      -webkit-backface-visibility:hidden!important;backface-visibility:hidden!important;
    }
    .tablewrap.v84-hardfreeze table.stock-report .v82-fixed2{box-shadow:2px 0 0 #cfd8e3!important}
    .tablewrap.v84-hardfreeze table.stock-report tr:first-child>.v82-fixed1,
    .tablewrap.v84-hardfreeze table.stock-report tr:first-child>.v82-fixed2{z-index:45!important;background:#eaf0f7!important}
  `;
  document.head.appendChild(css);

  function bindWrap(wrap){
    if(!wrap || wrap.dataset.v84Freeze==='1')return;
    const table=wrap.querySelector('table.stock-report.v82-inventory-table');
    if(!table)return;
    wrap.dataset.v84Freeze='1';
    wrap.classList.add('v84-hardfreeze');
    let raf=0;
    const sync=()=>{
      raf=0;
      const x=wrap.scrollLeft||0;
      const t=`translate3d(${x}px,0,0)`;
      table.querySelectorAll('.v82-fixed1,.v82-fixed2').forEach(cell=>{cell.style.transform=t;cell.style.webkitTransform=t;});
    };
    const onscroll=()=>{if(raf)cancelAnimationFrame(raf);raf=requestAnimationFrame(sync)};
    wrap.addEventListener('scroll',onscroll,{passive:true});
    sync();
  }
  function bindAll(){
    if(!window.v80InventoryMode)return;
    app.querySelectorAll('.tablewrap.v82-scroll').forEach(bindWrap);
  }
  const obs=new MutationObserver(()=>requestAnimationFrame(bindAll));
  /* v122 perf: obsolete v84 observer disabled */
  window.addEventListener('resize',()=>requestAnimationFrame(bindAll),{passive:true});
  requestAnimationFrame(bindAll);

  // バージョン表示
  ['productLanding','productChoicePage'].forEach(name=>{
    const fn=window[name];if(typeof fn!=='function')return;
    window[name]=function(){const r=fn.apply(this,arguments);const pill=app.querySelector('.pill');if(pill)pill.textContent='v84';return r};
  });
})();
/* ===== /v84 ===== */


/* ===== v89: 左2列をスクロールバー外へ完全分離 ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    html,body{width:100%!important;max-width:100%!important;overflow-x:hidden!important}
    body{position:relative!important;overscroll-behavior-x:none!important}
    main,#app{width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:hidden!important;box-sizing:border-box!important}
    .card{width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:hidden!important;box-sizing:border-box!important}
    .v88-stock-viewport{width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:hidden!important;overflow-y:auto!important;border:1px solid #e1e7ee;border-radius:10px;background:#fff;box-sizing:border-box!important;-webkit-overflow-scrolling:touch}
    .v88-stock-row{display:grid!important;grid-template-columns:var(--v89-left-w,220px) minmax(0,1fr)!important;align-items:start!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important;box-sizing:border-box!important}
    .v88-fixed-pane{grid-column:1!important;width:var(--v89-left-w,220px)!important;min-width:var(--v89-left-w,220px)!important;max-width:var(--v89-left-w,220px)!important;overflow:hidden!important;background:#fff!important;z-index:5!important;border-right:2px solid #cfd8e3!important;box-sizing:border-box!important}
    .v88-scroll-pane{grid-column:2!important;width:100%!important;min-width:0!important;max-width:100%!important;overflow-x:auto!important;overflow-y:hidden!important;-webkit-overflow-scrolling:touch!important;background:#fff!important;box-sizing:border-box!important;touch-action:pan-x!important;overscroll-behavior-x:contain!important;scrollbar-gutter:stable!important}
    .v88-fixed-table{width:var(--v89-left-w,220px)!important;min-width:var(--v89-left-w,220px)!important;max-width:var(--v89-left-w,220px)!important;border-collapse:separate!important;border-spacing:0!important;table-layout:fixed!important;margin:0!important}
    .v88-fixed-table th,.v88-fixed-table td{box-sizing:border-box!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:clip!important;background:#fff!important;padding:4px 5px!important;border:.45px solid #cfd8e3!important}
    .v88-fixed-table .v88-c1{width:var(--v89-c1-w,140px)!important;min-width:var(--v89-c1-w,140px)!important;max-width:var(--v89-c1-w,140px)!important;text-align:left!important}
    .v88-fixed-table .v88-c2{width:var(--v89-c2-w,80px)!important;min-width:var(--v89-c2-w,80px)!important;max-width:var(--v89-c2-w,80px)!important;text-align:center!important}
    .v88-fixed-table .v88-total{width:var(--v89-left-w,220px)!important;min-width:var(--v89-left-w,220px)!important;max-width:var(--v89-left-w,220px)!important;text-align:center!important}
    .v88-fixed-table thead th,.v88-fixed-table tr:first-child th{background:#eaf0f7!important;font-weight:700!important}
    .v88-right-table{margin:0!important;border-collapse:separate!important;border-spacing:0!important;table-layout:auto!important;width:max-content!important;min-width:100%!important}
    .v88-right-table th,.v88-right-table td{min-width:54px!important;max-width:68px!important;padding:4px 5px!important;white-space:nowrap!important;box-sizing:border-box!important}
    .v88-right-table.v88-hidaka th,.v88-right-table.v88-hidaka td,
    .v88-right-table.v88-sanmae th,.v88-right-table.v88-sanmae td{min-width:54px!important;max-width:68px!important}
  `;
  document.head.appendChild(css);

  function isInventoryTable(table){
    if(!window.v80InventoryMode || !table || table.dataset.v88Split==='1') return false;
    if(!(table.classList.contains('stock-report') || table.classList.contains('v71-stock'))) return false;
    const first=table.rows&&table.rows[0];
    if(!first || first.cells.length<2) return false;
    const a=(first.cells[0].textContent||'').trim();
    const b=(first.cells[1].textContent||'').trim();
    return (a==='組合名'&&b==='区分') || (a==='区分'&&b==='等級');
  }

  function fixedCellInfo(row, ri, hasTwoHeader){
    const cells=[...row.cells];
    if(!cells.length) return {type:'empty'};
    if(ri===0){
      return {type:'two', a:cells[0], b:cells[1]};
    }
    if(hasTwoHeader && ri===1){
      return {type:'blankheader'};
    }
    if(Number(cells[0].colSpan||1)>=2){
      return {type:'total', a:cells[0]};
    }
    if(cells.length>=2) return {type:'two', a:cells[0], b:cells[1]};
    return {type:'empty'};
  }

  function makeCell(src, tag, cls){
    const c=document.createElement(tag||'td');
    c.className=cls||'';
    c.textContent=src ? (src.textContent||'') : '';
    if(src){
      if(src.rowSpan>1)c.rowSpan=src.rowSpan;
      if(src.classList.contains('group'))c.classList.add('group');
      if(src.classList.contains('sub'))c.classList.add('sub');
      if(src.classList.contains('total'))c.classList.add('total');
    }
    return c;
  }

  function splitTable(table){
    if(!isInventoryTable(table))return;
    const wrap=table.closest('.tablewrap,.v71-home-table');
    if(!wrap || wrap.dataset.v88Done==='1')return;
    table.dataset.v88Split='1';

    const rows=[...table.rows];
    const rowHeights=rows.map(r=>Math.max(1,Math.ceil(r.getBoundingClientRect().height)));
    const first=rows[0];
    const hasTwoHeader=Number(first.cells[0]?.rowSpan||1)>1;
    // v89: 元表の左2列の実寸を測り、その合計を固定領域として確保
    const rawW1=Math.ceil(first.cells[0]?.getBoundingClientRect().width||108);
    const rawW2=Math.ceil(first.cells[1]?.getBoundingClientRect().width||64);
    const c1w=Math.max(96,Math.min(150,rawW1));
    const c2w=Math.max(58,Math.min(90,rawW2));
    const leftW=c1w+c2w;
    const visibleH=Math.max(1,Math.ceil(wrap.getBoundingClientRect().height));
    const hadMax=/max-height/i.test(wrap.getAttribute('style')||'') || wrap.classList.contains('v71-home-table');

    // 左固定表はゼロから作成（元表の隠し列やcolspanの影響を完全排除）
    const left=document.createElement('table');
    left.className='v88-fixed-table';
    const lbody=document.createElement('tbody'); left.appendChild(lbody);
    rows.forEach((r,ri)=>{
      const info=fixedCellInfo(r,ri,hasTwoHeader);
      const tr=document.createElement('tr');
      if(rowHeights[ri])tr.style.height=rowHeights[ri]+'px';
      if(info.type==='two'){
        const tag=(ri===0?'th':'td');
        tr.appendChild(makeCell(info.a,tag,'v88-c1'));
        tr.appendChild(makeCell(info.b,tag,'v88-c2'));
      }else if(info.type==='total'){
        const c=makeCell(info.a,'td','v88-total'); c.colSpan=2; tr.appendChild(c);
      }else if(info.type==='blankheader'){
        const a=document.createElement('th');a.className='v88-c1';
        const b=document.createElement('th');b.className='v88-c2';
        tr.append(a,b);
      }else{
        const a=document.createElement('td');a.className='v88-c1';
        const b=document.createElement('td');b.className='v88-c2';
        tr.append(a,b);
      }
      lbody.appendChild(tr);
    });

    // 右表もコピーを作り、左2列そのものをDOMから削除
    const right=table.cloneNode(true);
    right.removeAttribute('id');
    right.classList.add('v88-right-table');
    right.classList.remove('v82-inventory-table');
    const label=(document.querySelector('header')?.textContent||'');
    if(label.includes('日高'))right.classList.add('v88-hidaka');
    if(label.includes('棹前'))right.classList.add('v88-sanmae');
    [...right.rows].forEach((r,ri)=>{
      const orig=rows[ri];
      const info=fixedCellInfo(orig,ri,hasTwoHeader);
      if(info.type==='two'){
        if(r.cells[0])r.deleteCell(0);
        if(r.cells[0])r.deleteCell(0);
      }else if(info.type==='total'){
        if(r.cells[0])r.deleteCell(0);
      }
      if(rowHeights[ri])r.style.height=rowHeights[ri]+'px';
    });

    const viewport=document.createElement('div');viewport.className='v88-stock-viewport';
    viewport.style.setProperty('--v89-c1-w',c1w+'px');
    viewport.style.setProperty('--v89-c2-w',c2w+'px');
    viewport.style.setProperty('--v89-left-w',leftW+'px');
    if(hadMax) viewport.style.height=visibleH+'px';
    const row=document.createElement('div');row.className='v88-stock-row';
    const lp=document.createElement('div');lp.className='v88-fixed-pane';lp.appendChild(left);
    const rp=document.createElement('div');rp.className='v88-scroll-pane';rp.appendChild(right);
    row.append(lp,rp);viewport.appendChild(row);

    wrap.dataset.v88Done='1';
    wrap.parentNode.replaceChild(viewport,wrap);

    // ページ全体の横スクロール位置を常に0に戻す
    try{window.scrollTo({left:0,top:window.scrollY,behavior:'instant'})}catch(_e){window.scrollTo(0,window.scrollY)}
    document.documentElement.scrollLeft=0;document.body.scrollLeft=0;
  }

  function run(){
    if(!window.v80InventoryMode)return;
    app.querySelectorAll('table.stock-report,table.v71-stock').forEach(splitTable);
  }
  const obs=null; /* v122 perf: obsolete v89 observer disabled */
  ['home','stock','hHome','hStock','nHome','nStock','smHome','smStock'].forEach(name=>{
    const fn=window[name];if(typeof fn!=='function')return;
    window[name]=function(){const r=fn.apply(this,arguments);requestAnimationFrame(run);return r};
  });
  ['productLanding','productChoicePage'].forEach(name=>{
    const fn=window[name];if(typeof fn!=='function')return;
    window[name]=function(){const r=fn.apply(this,arguments);const pill=app.querySelector('.pill');if(pill)pill.textContent='v89';return r};
  });
  window.addEventListener('scroll',()=>{if(window.scrollX!==0){window.scrollTo(0,window.scrollY)}},{passive:true});
  requestAnimationFrame(run);
})();
/* ===== /v89 ===== */




/* ===== v90: 根室在庫集計表 左2列をスクロール領域の完全外側へ ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    .n90-stock-shell{display:grid;grid-template-columns:170px minmax(0,1fr);width:100%;max-width:100%;min-width:0;overflow:hidden;border:1px solid #cfd8e3;border-radius:10px;background:#fff;box-sizing:border-box;margin-top:12px}
    .n90-fixed-pane{grid-column:1;width:170px;min-width:170px;max-width:170px;overflow:hidden;background:#fff;border-right:2px solid #aebdce;box-sizing:border-box;position:relative;z-index:2}
    .n90-scroll-pane{grid-column:2;min-width:0;width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;touch-action:pan-x;background:#fff;box-sizing:border-box}
    .n90-left-table,.n90-right-table{border-collapse:separate;border-spacing:0;margin:0;table-layout:fixed;background:#fff;color:#102a43}
    .n90-left-table{width:170px;min-width:170px;max-width:170px}
    .n90-left-table col:first-child{width:108px}.n90-left-table col:nth-child(2){width:62px}
    .n90-right-table{width:max-content;min-width:860px}
    .n90-left-table th,.n90-left-table td,.n90-right-table th,.n90-right-table td{border-right:1px solid #cfd8e3;border-bottom:1px solid #cfd8e3;padding:4px 5px;box-sizing:border-box;white-space:nowrap;text-align:center;font-size:14px;height:36px;background:#fff}
    .n90-left-table th:first-child,.n90-left-table td:first-child{text-align:left}
    .n90-left-table tr:first-child th,.n90-right-table tr:first-child th,.n90-right-table tr:nth-child(2) th{background:#eaf0f7;font-weight:700}
    .n90-left-table .n90-head1,.n90-right-table .n90-head1{height:42px}
    .n90-left-table .n90-head2,.n90-right-table .n90-head2{height:38px}
    .n90-left-table .n90-body,.n90-right-table .n90-body{height:36px}
    .n90-left-table .n90-sub,.n90-right-table .n90-sub{height:36px}
    .n90-left-table .n90-total,.n90-right-table .n90-total{height:40px;background:#eaf0f7;font-weight:700;border-top:1.6px solid #111}
    .n90-left-table .n90-coop-end,.n90-right-table .n90-coop-end{border-bottom:1.6px solid #111}
    .n90-right-table th,.n90-right-table td{min-width:66px;max-width:78px}
    .n90-right-table th.n90-group{min-width:auto;max-width:none}
    .n90-stock-shell *{box-sizing:border-box}
    @media(max-width:520px){
      .n90-stock-shell{grid-template-columns:154px minmax(0,1fr)}
      .n90-fixed-pane,.n90-left-table{width:154px;min-width:154px;max-width:154px}
      .n90-left-table col:first-child{width:96px}.n90-left-table col:nth-child(2){width:58px}
      .n90-left-table th,.n90-left-table td,.n90-right-table th,.n90-right-table td{font-size:13px;padding:4px 3px}
      .n90-right-table{min-width:820px}
    }
  `;
  document.head.appendChild(css);

  function renderNemuroStockV90(){
    const y=nState.activeYear,m=nMatrix(),cols=nItems();
    let left='<table class="n90-left-table"><colgroup><col><col></colgroup><tbody>';
    left+='<tr class="n90-head1"><th>組合名</th><th>区分</th></tr>';
    left+='<tr class="n90-head2"><th></th><th></th></tr>';
    let right='<table class="n90-right-table"><thead><tr class="n90-head1">'+N_GROUPS.map(g=>`<th class="n90-group" colspan="${g.items.length}">${esc(g.name)}</th>`).join('')+'<th rowspan="2">計</th></tr><tr class="n90-head2">'+N_GROUPS.flatMap(g=>g.items).map(i=>`<th>${esc(i)}</th>`).join('')+'</tr></thead><tbody>';

    for(const coop of N_COOPS){
      for(const season of N_SEASONS){
        let rt=0;
        left+=`<tr class="n90-body"><th>${season===N_SEASONS[0]?esc(coop):''}</th><th>${esc(season)}</th></tr>`;
        right+='<tr class="n90-body">';
        for(const c of cols){const q=m[[y,coop,season,c.group,c.item].join('|')]||0;rt+=q;right+=`<td>${q?fmt(q):''}</td>`}
        right+=`<td>${rt?fmt(rt):''}</td></tr>`;
      }
      left+='<tr class="n90-sub"><th></th><th>小計</th></tr>';
      let st=0;
      right+='<tr class="n90-sub">';
      for(const c of cols){const q=N_SEASONS.reduce((a,se)=>a+(m[[y,coop,se,c.group,c.item].join('|')]||0),0);st+=q;right+=`<td>${q?fmt(q):''}</td>`}
      right+=`<td>${st?fmt(st):''}</td></tr>`;
      // cooperation boundary line on the subtotal row
      left=left.replace(/<tr class="n90-sub"><th><\/th><th>小計<\/th><\/tr>$/,'<tr class="n90-sub"><th class="n90-coop-end"></th><th class="n90-coop-end">小計</th></tr>');
      right=right.replace(/<tr class="n90-sub">([^]*?)<\/tr>$/,(all,inner)=>'<tr class="n90-sub">'+inner.replace(/<td>/g,'<td class="n90-coop-end">')+'</tr>');
    }
    left+='</tbody><tfoot><tr class="n90-total"><th colspan="2">合計</th></tr></tfoot></table>';
    let gt=0;
    right+='</tbody><tfoot><tr class="n90-total">';
    for(const c of cols){const q=N_COOPS.reduce((a,co)=>a+N_SEASONS.reduce((b,se)=>b+(m[[y,co,se,c.group,c.item].join('|')]||0),0),0);gt+=q;right+=`<th>${q?fmt(q):''}</th>`}
    right+=`<th>${gt?fmt(gt):''}</th></tr></tfoot></table>`;

    const html=`<section class="card"><div class="row"><h2>根室産昆布 在庫集計表</h2><select id="nsy">${nYearOptions(y)}</select></div><div class="toolbar"><button class="btn" id="nspdf">PDF出力</button><button class="btn secondary" id="nsh">ホーム</button></div><div class="n90-stock-shell"><div class="n90-fixed-pane">${left}</div><div class="n90-scroll-pane">${right}</div></div><p class="muted">0は空欄表示。確定済み出荷指示数量を差し引いた利用可能在庫です。</p></section>`;
    app.innerHTML=html;
    const sy=document.getElementById('nsy'), sh=document.getElementById('nsh'), pdf=document.getElementById('nspdf');
    if(sy)sy.onchange=()=>{nState.activeYear=sy.value;nSave();renderNemuroStockV90()};
    if(sh)sh.onclick=nHome;
    if(pdf)pdf.onclick=()=>nOpenStockPdf(y);
    // Horizontal scrolling is confined to the right pane only.
    document.documentElement.scrollLeft=0;document.body.scrollLeft=0;
  }

  window.nStock=renderNemuroStockV90;
  try{nStock=renderNemuroStockV90}catch(_e){}

  // Ensure UI version badge reflects v90.
  ['productLanding','productChoicePage'].forEach(name=>{
    const fn=window[name];if(typeof fn!=='function')return;
    window[name]=function(){const r=fn.apply(this,arguments);const pill=app.querySelector('.pill');if(pill)pill.textContent='v90';return r};
  });
})();
/* ===== /v90 ===== */

/* ===== v91: 4種すべて 左2列をスクロール領域外へ + コンパクト表示 ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    .v91-viewport{width:100%;max-width:100%;min-width:0;overflow-x:hidden;box-sizing:border-box;margin-top:10px;border:1px solid #d5dee8;border-radius:10px;background:#fff}
    .v91-viewport.v91-home{max-height:360px;overflow-y:auto;-webkit-overflow-scrolling:touch}
    .v91-shell{display:grid;grid-template-columns:132px minmax(0,1fr);width:100%;max-width:100%;min-width:0;overflow:hidden;background:#fff}
    .v91-left{grid-column:1;width:132px;min-width:132px;max-width:132px;overflow:hidden;background:#eef3f8;border-right:1.5px solid #aebdce;box-sizing:border-box;z-index:2}
    .v91-right{grid-column:2;min-width:0;width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;touch-action:pan-x;background:#fff;box-sizing:border-box}
    .v91-left table,.v91-right table{border-collapse:separate;border-spacing:0;table-layout:fixed;margin:0;color:#102a43;background:#fff}
    .v91-left table{width:132px;min-width:132px;max-width:132px}
    .v91-left col.v91-c1{width:84px}.v91-left col.v91-c2{width:48px}
    .v91-left.v91-hidaka col.v91-c1{width:58px}.v91-left.v91-hidaka col.v91-c2{width:74px}
    .v91-right table{width:max-content;min-width:100%}
    .v91-left th,.v91-left td,.v91-right th,.v91-right td{box-sizing:border-box;border-right:1px solid #cfd8e3;border-bottom:1px solid #cfd8e3;height:30px;padding:2px 3px;white-space:nowrap;overflow:hidden;text-overflow:clip;text-align:center;font-size:11px;line-height:1.1;background:#fff}
    .v91-left th,.v91-right th{font-weight:700}
    .v91-left td:first-child,.v91-left th:first-child{text-align:left}
    .v91-left .v91-head,.v91-right .v91-head{height:34px;background:#eaf0f7;font-size:11px}
    .v91-left .v91-head2,.v91-right .v91-head2{height:30px;background:#eaf0f7;font-size:10.5px}
    .v91-left .v91-sub,.v91-right .v91-sub{height:29px}
    .v91-left .v91-total,.v91-right .v91-total{height:32px;background:#eaf0f7;font-weight:700;border-top:1.4px solid #111}
    .v91-left .v91-end,.v91-right .v91-end{border-bottom:1.4px solid #111}
    .v91-right th,.v91-right td{min-width:48px;width:48px;max-width:58px}
    .v91-right th.v91-group{min-width:auto;width:auto;max-width:none}
    .v91-right th.v91-totalcol,.v91-right td.v91-totalcol{min-width:50px;width:50px;max-width:54px}
    .v91-right::-webkit-scrollbar{height:6px}.v91-right::-webkit-scrollbar-thumb{background:#9aa7b4;border-radius:6px}
    .v91-compact-note{margin:7px 0 0!important;font-size:12px!important}
    @media(max-width:520px){
      .v91-shell{grid-template-columns:124px minmax(0,1fr)}
      .v91-left,.v91-left table{width:124px;min-width:124px;max-width:124px}
      .v91-left col.v91-c1{width:78px}.v91-left col.v91-c2{width:46px}
      .v91-left.v91-hidaka col.v91-c1{width:54px}.v91-left.v91-hidaka col.v91-c2{width:70px}
      .v91-left th,.v91-left td,.v91-right th,.v91-right td{font-size:10.5px;padding:2px;height:29px}
      .v91-left .v91-head,.v91-right .v91-head{height:33px}.v91-left .v91-head2,.v91-right .v91-head2{height:29px}
      .v91-right th,.v91-right td{min-width:45px;width:45px;max-width:52px}
    }
  `;
  document.head.appendChild(css);

  function groupSplit({year,coops,seasons,groups,cols,getValue,totalValue,home=false,leftClass=''}){
    let L='<table><colgroup><col class="v91-c1"><col class="v91-c2"></colgroup><tbody><tr><th class="v91-head">組合名</th><th class="v91-head">区分</th></tr><tr><th class="v91-head2"></th><th class="v91-head2"></th></tr>';
    let R='<table><thead><tr>'+groups.map(g=>`<th class="v91-head v91-group" colspan="${g.items.length}">${esc(g.name)}</th>`).join('')+'<th class="v91-head v91-totalcol" rowspan="2">計</th></tr><tr>'+groups.flatMap(g=>g.items).map(i=>`<th class="v91-head2">${esc(i)}</th>`).join('')+'</tr></thead><tbody>';
    for(const coop of coops){
      for(let si=0;si<seasons.length;si++){
        const se=seasons[si]; let rt=0;
        L+=`<tr><th>${si===0?esc(coop):''}</th><th>${esc(se)}</th></tr>`;
        R+='<tr>';
        for(const c of cols){const q=getValue(coop,se,c)||0;rt+=q;R+=`<td>${q?fmt(q):''}</td>`}
        R+=`<td class="v91-totalcol">${rt?fmt(rt):''}</td></tr>`;
      }
      L+='<tr class="v91-sub"><th class="v91-end"></th><th class="v91-end">小計</th></tr>';
      R+='<tr class="v91-sub">'; let st=0;
      for(const c of cols){const q=seasons.reduce((a,se)=>a+(getValue(coop,se,c)||0),0);st+=q;R+=`<td class="v91-end">${q?fmt(q):''}</td>`}
      R+=`<td class="v91-end v91-totalcol">${st?fmt(st):''}</td></tr>`;
    }
    L+='</tbody><tfoot><tr class="v91-total"><th colspan="2">合計</th></tr></tfoot></table>';
    R+='</tbody><tfoot><tr class="v91-total">'; let gt=0;
    for(const c of cols){const q=coops.reduce((a,co)=>a+seasons.reduce((b,se)=>b+(getValue(co,se,c)||0),0),0);gt+=q;R+=`<th>${q?fmt(q):''}</th>`}
    const grand=typeof totalValue==='function'?totalValue():gt;
    R+=`<th class="v91-totalcol">${grand?fmt(grand):''}</th></tr></tfoot></table>`;
    return `<div class="v91-viewport ${home?'v91-home':''}"><div class="v91-shell"><div class="v91-left ${leftClass}">${L}</div><div class="v91-right">${R}</div></div></div>`;
  }

  function hidakaSplit(y,home=false){
  const m=hMatrix(),
        rows=H_SECTIONS.flatMap(s=>s.items.map(g=>({section:s.name,grade:g}))),
        inv=window.KombuRefactor?.Inventory;

  const getValue=(loc,section,grade)=>
    inv?.getHidakaQuantity
      ? inv.getHidakaQuantity({
          year:y,
          location:loc,
          section,
          grade
        })
      : (m[[y,loc,section,grade].join('|')]||0);

  let L='<table><colgroup><col class="v91-c1"><col class="v91-c2"></colgroup><tbody><tr><th class="v91-head">区分</th><th class="v91-head">等級</th></tr>';
  let R='<table><thead><tr>'+H_LOCATIONS.map(l=>`<th class="v91-head">${esc(l)}</th>`).join('')+'<th class="v91-head v91-totalcol">計</th></tr></thead><tbody>';

  let last=null;

  for(const r of rows){
    const start=r.section!==last;

    L+=`<tr${start?' class="v91-end"':''}><th>${start?esc(r.section):''}</th><th>${esc(r.grade)}</th></tr>`;

    let rt=0;
    R+=`<tr${start?' class="v91-end"':''}>`;

    for(const loc of H_LOCATIONS){
      const q=getValue(loc,r.section,r.grade);
      rt+=q;
      R+=`<td>${q?fmt(q):''}</td>`;
    }

    R+=`<td class="v91-totalcol">${rt?fmt(rt):''}</td></tr>`;
    last=r.section;
  }

  L+='</tbody><tfoot><tr class="v91-total"><th colspan="2">合計</th></tr></tfoot></table>';

  R+='</tbody><tfoot><tr class="v91-total">'+
    H_LOCATIONS.map(loc=>{
      const q=rows.reduce(
        (a,r)=>a+getValue(loc,r.section,r.grade),
        0
      );
      return `<th>${q?fmt(q):''}</th>`;
    }).join('');

  const grandTotal=inv?.getHidakaQuantity
    ? inv.getHidakaQuantity({year:y})
    : hTotal(y);

  R+=`<th class="v91-totalcol">${grandTotal?fmt(grandTotal):''}</th></tr></tfoot></table>`;

  return `<div class="v91-viewport ${home?'v91-home':''}"><div class="v91-shell"><div class="v91-left v91-hidaka">${L}</div><div class="v91-right">${R}</div></div></div>`;
}

  function kushiroSplit(y,home=false){const m=matrix(),cols=allItems();return groupSplit({year:y,coops:state.coops,seasons:SEASONS,groups:GROUPS,cols,getValue:(co,se,c)=>m[[y,co,c.group,c.item,se].join('|')]||0,totalValue:()=>total(y),home})}
  function nemuroSplit(y,home=false){
  const m=nMatrix(),cols=nItems(),inv=window.KombuRefactor?.Inventory;

  return groupSplit({
    year:y,
    coops:N_COOPS,
    seasons:N_SEASONS,
    groups:N_GROUPS,
    cols,

    getValue:(co,se,c)=>
      inv?.getQuantity
        ? inv.getQuantity('nemuro',{
            year:y,
            coop:co,
            season:se,
            group:c.group,
            item:c.item
          })
        : (m[[y,co,se,c.group,c.item].join('|')]||0),

    totalValue:()=>
      inv?.getQuantity
        ? inv.getQuantity('nemuro',{year:y})
        : nTotal(y),

    home
  });
}
  function sanmaeSplit(y,home=false){
  const m=smMatrix(),cols=smItems(),inv=window.KombuRefactor?.Inventory;

  return groupSplit({
    year:y,
    coops:S_COOPS,
    seasons:S_SEASONS,
    groups:S_GROUPS,
    cols,

    getValue:(co,se,c)=>
      inv?.getQuantity
        ? inv.getQuantity('sanmae',{
            year:y,
            coop:co,
            season:se,
            group:c.group,
            item:c.item
          })
        : (m[[y,co,se,c.group,c.item].join('|')]||0),

    totalValue:()=>
      inv?.getQuantity
        ? inv.getQuantity('sanmae',{year:y})
        : smTotal(y),

    home
  });
}

  // Full stock screens: all four products use the same true split layout.
  stock=function(){const y=state.activeYear;app.innerHTML=`<section class="card"><div class="row"><h2>釧路産昆布 在庫集計表</h2><select id="v91y" style="width:auto">${yearOptions(y)}</select></div><div class="toolbar"><button class="btn smallbtn" id="v91ex">Excel出力</button><button class="btn smallbtn" id="v91cs">CSV出力</button><button class="btn smallbtn" id="v91pdf">PDF出力</button><button class="btn secondary smallbtn" id="v91home">ホーム</button></div>${kushiroSplit(y)}<p class="muted v91-compact-note">${esc(y)}年産の利用可能在庫です。0は空欄表示です。</p></section>`;v91y.onchange=()=>{setActiveYear(v91y.value);stock()};v91home.onclick=home;v91ex.onclick=downloadExcel;v91cs.onclick=downloadCSV;v91pdf.onclick=()=>openStockPdfDirect(y)};
  hStock=function(){const y=hState.activeYear;app.innerHTML=`<section class="card"><div class="row"><h2>日高昆布 在庫集計表</h2><select id="v91y">${hYearOptions(y)}</select></div><div class="toolbar"><button class="btn" id="v91pdf">PDF出力</button><button class="btn secondary" id="v91home">ホーム</button></div>${hidakaSplit(y)}<p class="muted v91-compact-note">0は空欄表示。確定済み出荷指示数量を差し引いた利用可能在庫です。</p></section>`;v91y.onchange=()=>{hState.activeYear=v91y.value;hSave();hStock()};v91home.onclick=hHome;v91pdf.onclick=()=>hOpenStockPdf(y)};
  nStock=function(){const y=nState.activeYear;app.innerHTML=`<section class="card"><div class="row"><h2>根室産昆布 在庫集計表</h2><select id="v91y">${nYearOptions(y)}</select></div><div class="toolbar"><button class="btn" id="v91pdf">PDF出力</button><button class="btn secondary" id="v91home">ホーム</button></div>${nemuroSplit(y)}<p class="muted v91-compact-note">0は空欄表示。確定済み出荷指示数量を差し引いた利用可能在庫です。</p></section>`;v91y.onchange=()=>{nState.activeYear=v91y.value;nSave();nStock()};v91home.onclick=nHome;v91pdf.onclick=()=>nOpenStockPdf(y)};
  smStock=function(){const y=smState.activeYear;app.innerHTML=`<section class="card"><div class="row"><h2>釧路産棹前昆布 在庫集計表</h2><select id="v91y">${smYearOptions(y)}</select></div><div class="toolbar"><button class="btn" id="v91pdf">PDF出力</button><button class="btn secondary" id="v91home">ホーム</button></div>${sanmaeSplit(y)}<p class="muted v91-compact-note">0は空欄表示。確定済み出荷指示数量を差し引いた利用可能在庫です。</p></section>`;v91y.onchange=()=>{smState.activeYear=v91y.value;smSave();smStock()};v91home.onclick=smHome;v91pdf.onclick=()=>smOpenStockPdf(y)};

  // Home summary tables use the same split layout, with a limited vertical viewport.
  v71KushiroHomeTable=function(y){return kushiroSplit(y,true)};
  v81HidakaHomeTable=function(y){return hidakaSplit(y,true)};
  v81NemuroHomeTable=function(y){return nemuroSplit(y,true)};
  v81SanmaeHomeTable=function(y){return sanmaeSplit(y,true)};

  // Force current/home wrappers to re-use the new v91 summary functions.
  const oldReplace=v81ReplaceHomeSummary;
  v81ReplaceHomeSummary=function(kind){return oldReplace(kind)};

  // Version badge and cache-busting label.
  ['productLanding','productChoicePage'].forEach(name=>{const fn=window[name]||globalThis[name];if(typeof fn!=='function')return;const wrapped=function(){const r=fn.apply(this,arguments);const pill=app.querySelector('.pill');if(pill)pill.textContent='v91';return r};try{window[name]=wrapped}catch(_e){}try{globalThis[name]=wrapped}catch(_e){}});
})();
/* ===== /v91 ===== */

/* ===== v92: fixed headers + narrower fixed columns + merged coop cells ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    .v92-viewport{width:100%;max-width:100%;min-width:0;margin-top:9px;border:1px solid #d5dee8;border-radius:10px;background:#fff;overflow:hidden;box-sizing:border-box;color:#102a43}
    .v92-head-shell,.v92-body-shell{display:grid;grid-template-columns:116px minmax(0,1fr);width:100%;max-width:100%;min-width:0;box-sizing:border-box}
    .v92-head-shell{background:#eaf0f7;position:relative;z-index:5}
    .v92-body-shell{max-height:520px;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;align-items:start}
    .v92-viewport.v92-home .v92-body-shell{max-height:285px}
    .v92-left-head,.v92-left-body{grid-column:1;width:116px;min-width:116px;max-width:116px;overflow:hidden;background:#eef3f8;border-right:1.5px solid #aebdce;box-sizing:border-box}
    .v92-right-head,.v92-right-body{grid-column:2;min-width:0;width:100%;max-width:100%;box-sizing:border-box;background:#fff}
    .v92-right-head{overflow:hidden;background:#eaf0f7}
    .v92-right-body{overflow-x:auto;overflow-y:visible;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;touch-action:pan-x}
    .v92-left-head table,.v92-left-body table,.v92-right-head table,.v92-right-body table{border-collapse:separate;border-spacing:0;table-layout:fixed;margin:0;color:#102a43;background:#fff}
    .v92-left-head table,.v92-left-body table{width:116px;min-width:116px;max-width:116px}
    .v92-left-head col.v92-c1,.v92-left-body col.v92-c1{width:74px}
    .v92-left-head col.v92-c2,.v92-left-body col.v92-c2{width:42px}
    .v92-left-head.v92-hidaka col.v92-c1,.v92-left-body.v92-hidaka col.v92-c1{width:50px}
    .v92-left-head.v92-hidaka col.v92-c2,.v92-left-body.v92-hidaka col.v92-c2{width:66px}
    .v92-right-head table,.v92-right-body table{width:max-content;min-width:100%}
    .v92-left-head th,.v92-left-body th,.v92-left-body td,.v92-right-head th,.v92-right-body th,.v92-right-body td{box-sizing:border-box;border-right:1px solid #cfd8e3;border-bottom:1px solid #cfd8e3;height:27px;padding:1px 2px;white-space:nowrap;overflow:hidden;text-overflow:clip;text-align:center;font-size:10px;line-height:1.05;background:#fff}
    .v92-left-head th,.v92-right-head th{font-weight:700;background:#eaf0f7}
    .v92-h1{height:31px!important;font-size:10.3px!important;background:#eaf0f7!important}
    .v92-h2{height:27px!important;font-size:9.8px!important;background:#eaf0f7!important}
    .v92-left-body .v92-coop{font-weight:700;text-align:center!important;vertical-align:middle!important;background:#f3f6fa!important;padding:2px 3px!important;white-space:normal!important;line-height:1.15!important}
    .v92-left-body .v92-section{text-align:center!important;font-weight:600}
    .v92-left-body .v92-sub,.v92-right-body .v92-sub{height:27px}
    .v92-left-body .v92-total,.v92-right-body .v92-total{height:29px;background:#eaf0f7;font-weight:700;border-top:1.4px solid #111}
    .v92-end{border-bottom:1.4px solid #111!important}
    .v92-right-head th,.v92-right-body td,.v92-right-body th{min-width:41px;width:41px;max-width:49px}
    .v92-right-head .v92-group{width:auto!important;max-width:none!important}
    .v92-right-head .v92-totalcol,.v92-right-body .v92-totalcol{min-width:45px!important;width:45px!important;max-width:49px!important}
    .v92-right-body::-webkit-scrollbar{height:6px}.v92-right-body::-webkit-scrollbar-thumb{background:#9aa7b4;border-radius:6px}
    .v92-note{margin:6px 0 0!important;font-size:11.5px!important}
    @media(max-width:520px){
      .v92-head-shell,.v92-body-shell{grid-template-columns:108px minmax(0,1fr)}
      .v92-left-head,.v92-left-body,.v92-left-head table,.v92-left-body table{width:108px;min-width:108px;max-width:108px}
      .v92-left-head col.v92-c1,.v92-left-body col.v92-c1{width:68px}.v92-left-head col.v92-c2,.v92-left-body col.v92-c2{width:40px}
      .v92-left-head.v92-hidaka col.v92-c1,.v92-left-body.v92-hidaka col.v92-c1{width:46px}.v92-left-head.v92-hidaka col.v92-c2,.v92-left-body.v92-hidaka col.v92-c2{width:62px}
      .v92-left-head th,.v92-left-body th,.v92-left-body td,.v92-right-head th,.v92-right-body th,.v92-right-body td{font-size:9.7px;height:26px;padding:1px}
      .v92-h1{height:30px!important;font-size:10px!important}.v92-h2{height:26px!important;font-size:9.5px!important}
      .v92-right-head th,.v92-right-body td,.v92-right-body th{min-width:39px;width:39px;max-width:46px}
    }
  `;
  document.head.appendChild(css);

  function syncHorizontal(root){
    requestAnimationFrame(()=>{
      root.querySelectorAll('.v92-right-body').forEach(body=>{
        if(body.dataset.v92sync==='1')return; body.dataset.v92sync='1';
        const head=root.querySelector('.v92-right-head');
        body.addEventListener('scroll',()=>{if(head)head.scrollLeft=body.scrollLeft},{passive:true});
      });
    });
  }

  function groupSplit92({coops,seasons,groups,cols,getValue,totalValue,home=false}){
    let LH='<table><colgroup><col class="v92-c1"><col class="v92-c2"></colgroup><tbody><tr><th class="v92-h1" rowspan="2">組合名</th><th class="v92-h1" rowspan="2">区分</th></tr><tr></tr></tbody></table>';
    let RH='<table><thead><tr>'+groups.map(g=>`<th class="v92-h1 v92-group" colspan="${g.items.length}">${esc(g.name)}</th>`).join('')+'<th class="v92-h1 v92-totalcol" rowspan="2">計</th></tr><tr>'+groups.flatMap(g=>g.items).map(i=>`<th class="v92-h2">${esc(i)}</th>`).join('')+'</tr></thead></table>';
    let LB='<table><colgroup><col class="v92-c1"><col class="v92-c2"></colgroup><tbody>';
    let RB='<table><tbody>';
    for(const coop of coops){
      const span=seasons.length+1;
      for(let si=0;si<seasons.length;si++){
        const se=seasons[si];let rt=0;
        LB+='<tr>'+(si===0?`<th class="v92-coop" rowspan="${span}">${esc(coop)}</th>`:'')+`<th class="v92-section">${esc(se)}</th></tr>`;
        RB+='<tr>';
        for(const c of cols){const q=getValue(coop,se,c)||0;rt+=q;RB+=`<td>${q?fmt(q):''}</td>`}
        RB+=`<td class="v92-totalcol">${rt?fmt(rt):''}</td></tr>`;
      }
      LB+='<tr class="v92-sub"><th class="v92-section v92-end">小計</th></tr>';
      RB+='<tr class="v92-sub">';let st=0;
      for(const c of cols){const q=seasons.reduce((a,se)=>a+(getValue(coop,se,c)||0),0);st+=q;RB+=`<td class="v92-end">${q?fmt(q):''}</td>`}
      RB+=`<td class="v92-end v92-totalcol">${st?fmt(st):''}</td></tr>`;
    }
    LB+='</tbody><tfoot><tr class="v92-total"><th colspan="2">合計</th></tr></tfoot></table>';
    RB+='</tbody><tfoot><tr class="v92-total">';let gt=0;
    for(const c of cols){const q=coops.reduce((a,co)=>a+seasons.reduce((b,se)=>b+(getValue(co,se,c)||0),0),0);gt+=q;RB+=`<th>${q?fmt(q):''}</th>`}
    const grand=typeof totalValue==='function'?totalValue():gt;
    RB+=`<th class="v92-totalcol">${grand?fmt(grand):''}</th></tr></tfoot></table>`;
    return `<div class="v92-viewport ${home?'v92-home':''}"><div class="v92-head-shell"><div class="v92-left-head">${LH}</div><div class="v92-right-head">${RH}</div></div><div class="v92-body-shell"><div class="v92-left-body">${LB}</div><div class="v92-right-body">${RB}</div></div></div>`;
  }

  function hidakaSplit92(y,home=false){
    const m=hMatrix(),rows=H_SECTIONS.flatMap(s=>s.items.map(g=>({section:s.name,grade:g})));
    const LH='<table><colgroup><col class="v92-c1"><col class="v92-c2"></colgroup><tbody><tr><th class="v92-h1">区分</th><th class="v92-h1">等級</th></tr></tbody></table>';
    const RH='<table><thead><tr>'+H_LOCATIONS.map(l=>`<th class="v92-h1">${esc(l)}</th>`).join('')+'<th class="v92-h1 v92-totalcol">計</th></tr></thead></table>';
    let LB='<table><colgroup><col class="v92-c1"><col class="v92-c2"></colgroup><tbody>',RB='<table><tbody>';
    let last=null;
    for(const r of rows){const start=r.section!==last;LB+=`<tr><th class="v92-section">${start?esc(r.section):''}</th><th class="v92-section">${esc(r.grade)}</th></tr>`;let rt=0;RB+='<tr>';for(const loc of H_LOCATIONS){const q=m[[y,loc,r.section,r.grade].join('|')]||0;rt+=q;RB+=`<td>${q?fmt(q):''}</td>`}RB+=`<td class="v92-totalcol">${rt?fmt(rt):''}</td></tr>`;last=r.section}
    LB+='</tbody><tfoot><tr class="v92-total"><th colspan="2">合計</th></tr></tfoot></table>';
    RB+='</tbody><tfoot><tr class="v92-total">'+H_LOCATIONS.map(loc=>{const q=rows.reduce((a,r)=>a+(m[[y,loc,r.section,r.grade].join('|')]||0),0);return `<th>${q?fmt(q):''}</th>`}).join('')+`<th class="v92-totalcol">${hTotal(y)?fmt(hTotal(y)):''}</th></tr></tfoot></table>`;
    return `<div class="v92-viewport ${home?'v92-home':''}"><div class="v92-head-shell"><div class="v92-left-head v92-hidaka">${LH}</div><div class="v92-right-head">${RH}</div></div><div class="v92-body-shell"><div class="v92-left-body v92-hidaka">${LB}</div><div class="v92-right-body">${RB}</div></div></div>`;
  }

  function kushiro92(y,home=false){const m=matrix(),cols=allItems();return groupSplit92({coops:state.coops,seasons:SEASONS,groups:GROUPS,cols,getValue:(co,se,c)=>m[[y,co,c.group,c.item,se].join('|')]||0,totalValue:()=>total(y),home})}
  function nemuro92(y,home=false){const m=nMatrix(),cols=nItems();return groupSplit92({coops:N_COOPS,seasons:N_SEASONS,groups:N_GROUPS,cols,getValue:(co,se,c)=>m[[y,co,se,c.group,c.item].join('|')]||0,totalValue:()=>nTotal(y),home})}
  function sanmae92(y,home=false){const m=smMatrix(),cols=smItems();return groupSplit92({coops:S_COOPS,seasons:S_SEASONS,groups:S_GROUPS,cols,getValue:(co,se,c)=>m[[y,co,se,c.group,c.item].join('|')]||0,totalValue:()=>smTotal(y),home})}

  function finish(){syncHorizontal(app);if(typeof v80InjectInventorySwitcher==='function')requestAnimationFrame(v80InjectInventorySwitcher)}
  stock=function(){const y=state.activeYear;app.innerHTML=`<section class="card"><div class="row"><h2>釧路産昆布 在庫集計表</h2><select id="v92y" style="width:auto">${yearOptions(y)}</select></div><div class="toolbar"><button class="btn smallbtn" id="v92ex">Excel出力</button><button class="btn smallbtn" id="v92cs">CSV出力</button><button class="btn smallbtn" id="v92pdf">PDF出力</button><button class="btn secondary smallbtn" id="v92home">ホーム</button></div>${kushiro92(y)}<p class="muted v92-note">${esc(y)}年産の利用可能在庫です。0は空欄表示です。</p></section>`;v92y.onchange=()=>{setActiveYear(v92y.value);stock()};v92home.onclick=home;v92ex.onclick=downloadExcel;v92cs.onclick=downloadCSV;v92pdf.onclick=()=>openStockPdfDirect(y);finish()};
  hStock=function(){const y=hState.activeYear;app.innerHTML=`<section class="card"><div class="row"><h2>日高昆布 在庫集計表</h2><select id="v92y">${hYearOptions(y)}</select></div><div class="toolbar"><button class="btn" id="v92pdf">PDF出力</button><button class="btn secondary" id="v92home">ホーム</button></div>${hidakaSplit92(y)}<p class="muted v92-note">0は空欄表示。確定済み出荷指示数量を差し引いた利用可能在庫です。</p></section>`;v92y.onchange=()=>{hState.activeYear=v92y.value;hSave();hStock()};v92home.onclick=hHome;v92pdf.onclick=()=>hOpenStockPdf(y);finish()};
  nStock=function(){const y=nState.activeYear;app.innerHTML=`<section class="card"><div class="row"><h2>根室産昆布 在庫集計表</h2><select id="v92y">${nYearOptions(y)}</select></div><div class="toolbar"><button class="btn" id="v92pdf">PDF出力</button><button class="btn secondary" id="v92home">ホーム</button></div>${nemuro92(y)}<p class="muted v92-note">0は空欄表示。確定済み出荷指示数量を差し引いた利用可能在庫です。</p></section>`;v92y.onchange=()=>{nState.activeYear=v92y.value;nSave();nStock()};v92home.onclick=nHome;v92pdf.onclick=()=>nOpenStockPdf(y);finish()};
  smStock=function(){const y=smState.activeYear;app.innerHTML=`<section class="card"><div class="row"><h2>釧路産棹前昆布 在庫集計表</h2><select id="v92y">${smYearOptions(y)}</select></div><div class="toolbar"><button class="btn" id="v92pdf">PDF出力</button><button class="btn secondary" id="v92home">ホーム</button></div>${sanmae92(y)}<p class="muted v92-note">0は空欄表示。確定済み出荷指示数量を差し引いた利用可能在庫です。</p></section>`;v92y.onchange=()=>{smState.activeYear=v92y.value;smSave();smStock()};v92home.onclick=smHome;v92pdf.onclick=()=>smOpenStockPdf(y);finish()};

  v71KushiroHomeTable=function(y){return kushiro92(y,true)};
  v81HidakaHomeTable=function(y){return hidakaSplit92(y,true)};
  v81NemuroHomeTable=function(y){return nemuro92(y,true)};
  v81SanmaeHomeTable=function(y){return sanmae92(y,true)};

  const mo=null; /* v122 perf: obsolete v92 observer disabled */
  ['productLanding','productChoicePage'].forEach(name=>{const fn=window[name]||globalThis[name];if(typeof fn!=='function')return;const wrapped=function(){const r=fn.apply(this,arguments);const pill=app.querySelector('.pill');if(pill)pill.textContent='v92';return r};try{window[name]=wrapped}catch(_e){}try{globalThis[name]=wrapped}catch(_e){}});
})();
/* ===== /v92 ===== */

/* ===== v93: compact year selector + hidaka merged sections / bold group lines ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    .v93-stock-card .v93-year-row{display:flex!important;justify-content:flex-start!important;align-items:center!important;margin:0 0 10px!important;gap:8px!important}
    .v93-stock-card .v93-year-row h2{display:none!important}
    .v93-stock-card .v93-year-row select{width:auto!important;min-width:92px!important;font-size:18px!important;font-weight:600!important;padding:10px 12px!important;border:1px solid #c8d3df!important;border-radius:12px!important;background:#fff!important;color:#102a43!important}
    .v93-stock-card .v92-viewport{margin-top:7px!important}
    .v93-stock-card .v92-head-shell,.v93-stock-card .v92-body-shell{grid-template-columns:100px minmax(0,1fr)!important}
    .v93-stock-card .v92-left-head,.v93-stock-card .v92-left-body,
    .v93-stock-card .v92-left-head table,.v93-stock-card .v92-left-body table{width:100px!important;min-width:100px!important;max-width:100px!important}
    .v93-stock-card .v92-left-head col.v92-c1,.v93-stock-card .v92-left-body col.v92-c1{width:63px!important}
    .v93-stock-card .v92-left-head col.v92-c2,.v93-stock-card .v92-left-body col.v92-c2{width:37px!important}
    .v93-stock-card .v92-left-head.v92-hidaka col.v92-c1,.v93-stock-card .v92-left-body.v92-hidaka col.v92-c1{width:40px!important}
    .v93-stock-card .v92-left-head.v92-hidaka col.v92-c2,.v93-stock-card .v92-left-body.v92-hidaka col.v92-c2{width:60px!important}
    .v93-stock-card .v92-left-head th,.v93-stock-card .v92-left-body th,.v93-stock-card .v92-left-body td,
    .v93-stock-card .v92-right-head th,.v93-stock-card .v92-right-body th,.v93-stock-card .v92-right-body td{height:25px!important;font-size:9.4px!important;padding:1px!important}
    .v93-stock-card .v92-h1{height:29px!important;font-size:9.8px!important}
    .v93-stock-card .v92-h2{height:25px!important;font-size:9.2px!important}
    .v93-stock-card .v92-right-head th,.v93-stock-card .v92-right-body td,.v93-stock-card .v92-right-body th{min-width:37px!important;width:37px!important;max-width:44px!important}
    .v93-stock-card .v92-left-body .v93-h-section{font-weight:700!important;text-align:center!important;vertical-align:middle!important;background:#f3f6fa!important;white-space:normal!important;line-height:1.15!important}
    .v93-stock-card .v93-endline{border-bottom:2.2px solid #111!important}
    @media(max-width:520px){
      .v93-stock-card .v92-head-shell,.v93-stock-card .v92-body-shell{grid-template-columns:94px minmax(0,1fr)!important}
      .v93-stock-card .v92-left-head,.v93-stock-card .v92-left-body,.v93-stock-card .v92-left-head table,.v93-stock-card .v92-left-body table{width:94px!important;min-width:94px!important;max-width:94px!important}
      .v93-stock-card .v92-left-head col.v92-c1,.v93-stock-card .v92-left-body col.v92-c1{width:59px!important}
      .v93-stock-card .v92-left-head col.v92-c2,.v93-stock-card .v92-left-body col.v92-c2{width:35px!important}
      .v93-stock-card .v92-left-head.v92-hidaka col.v92-c1,.v93-stock-card .v92-left-body.v92-hidaka col.v92-c1{width:38px!important}
      .v93-stock-card .v92-left-head.v92-hidaka col.v92-c2,.v93-stock-card .v92-left-body.v92-hidaka col.v92-c2{width:56px!important}
    }
  `;
  document.head.appendChild(css);

  function v93Decorate(root=app){
    root.querySelectorAll('.v92-viewport').forEach(vp=>{
      const card=vp.closest('section.card'); if(!card)return;
      card.classList.add('v93-stock-card');
      const sel=card.querySelector('select');
      if(sel){
        const row=sel.closest('.row');
        if(row){row.classList.add('v93-year-row');const h=row.querySelector('h2');if(h)h.remove();}
      }
    });
  }

  function v93Sync(root){
    requestAnimationFrame(()=>{
      const body=root.querySelector('.v92-right-body'),head=root.querySelector('.v92-right-head');
      if(body&&head&&!body.dataset.v93sync){body.dataset.v93sync='1';body.addEventListener('scroll',()=>{head.scrollLeft=body.scrollLeft},{passive:true});}
    });
  }

  function v93HidakaSplit(y,home=false){
    const m=hMatrix();
    const LH='<table><colgroup><col class="v92-c1"><col class="v92-c2"></colgroup><tbody><tr><th class="v92-h1">区分</th><th class="v92-h1">等級</th></tr></tbody></table>';
    const RH='<table><thead><tr>'+H_LOCATIONS.map(l=>`<th class="v92-h1">${esc(l)}</th>`).join('')+'<th class="v92-h1 v92-totalcol">計</th></tr></thead></table>';
    let LB='<table><colgroup><col class="v92-c1"><col class="v92-c2"></colgroup><tbody>',RB='<table><tbody>';
    const flat=[];
    for(const sec of H_SECTIONS){
      sec.items.forEach((grade,idx)=>flat.push({section:sec.name,grade,first:idx===0,last:idx===sec.items.length-1,span:sec.items.length}));
    }
    for(const r of flat){
      const end=r.last?' v93-endline':'';
      LB+='<tr>'+(r.first?`<th class="v93-h-section${end}" rowspan="${r.span}">${esc(r.section)}</th>`:'')+`<th class="v92-section${end}">${esc(r.grade)}</th></tr>`;
      let rt=0;RB+='<tr>';
      for(const loc of H_LOCATIONS){const q=m[[y,loc,r.section,r.grade].join('|')]||0;rt+=q;RB+=`<td class="${r.last?'v93-endline':''}">${q?fmt(q):''}</td>`}
      RB+=`<td class="v92-totalcol ${r.last?'v93-endline':''}">${rt?fmt(rt):''}</td></tr>`;
    }
    LB+='</tbody><tfoot><tr class="v92-total"><th colspan="2">合計</th></tr></tfoot></table>';
    RB+='</tbody><tfoot><tr class="v92-total">'+H_LOCATIONS.map(loc=>{const q=flat.reduce((a,r)=>a+(m[[y,loc,r.section,r.grade].join('|')]||0),0);return `<th>${q?fmt(q):''}</th>`}).join('')+`<th class="v92-totalcol">${hTotal(y)?fmt(hTotal(y)):''}</th></tr></tfoot></table>`;
    return `<div class="v92-viewport ${home?'v92-home':''}"><div class="v92-head-shell"><div class="v92-left-head v92-hidaka">${LH}</div><div class="v92-right-head">${RH}</div></div><div class="v92-body-shell"><div class="v92-left-body v92-hidaka">${LB}</div><div class="v92-right-body">${RB}</div></div></div>`;
  }

  // 日高の詳細表は区分セル結合＋指定位置の太線を使う。
  hStock=function(){
    const y=hState.activeYear;
    app.innerHTML=`<section class="card"><div class="row"><select id="v93y">${hYearOptions(y)}</select></div><div class="toolbar"><button class="btn" id="v93pdf">PDF出力</button><button class="btn secondary" id="v93home">ホーム</button></div>${v93HidakaSplit(y)}<p class="muted v92-note">0は空欄表示。確定済み出荷指示数量を差し引いた利用可能在庫です。</p></section>`;
    v93y.onchange=()=>{hState.activeYear=v93y.value;hSave();hStock()};v93home.onclick=hHome;v93pdf.onclick=()=>hOpenStockPdf(y);
    v93Decorate();v93Sync(app);if(typeof v80InjectInventorySwitcher==='function')requestAnimationFrame(v80InjectInventorySwitcher);
  };
  v81HidakaHomeTable=function(y){return v93HidakaSplit(y,true)};

  // 既存3種類は構造を維持しつつ見出しを消し、年産を左上へ。
  [['stock','home'],['nStock','nHome'],['smStock','smHome']].forEach(([name])=>{
    const old=globalThis[name]; if(typeof old!=='function')return;
    globalThis[name]=function(){const r=old.apply(this,arguments);v93Decorate();return r};
  });

  // 在庫管理トップの小型表も同じ表示ルールにする。
  ['home','hHome','nHome','smHome'].forEach(name=>{
    const old=globalThis[name]; if(typeof old!=='function')return;
    globalThis[name]=function(){const r=old.apply(this,arguments);requestAnimationFrame(()=>{v93Decorate();v93Sync(app)});return r};
  });

  const obs=null; /* v122 perf: obsolete v93 observer disabled */
  ['productLanding','productChoicePage'].forEach(name=>{const fn=globalThis[name];if(typeof fn!=='function')return;globalThis[name]=function(){const r=fn.apply(this,arguments);const pill=app.querySelector('.pill');if(pill)pill.textContent='v93';return r}});
})();
/* ===== /v93 ===== */

/* ===== v94: inventory-home year selector + PDF button ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    .v94-home-year-pdf-row{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:10px!important;margin:0 0 10px!important;flex-wrap:nowrap!important}
    .v94-home-year-pdf-row select{width:auto!important;min-width:92px!important;font-size:18px!important;font-weight:600!important;padding:10px 12px!important;border:1px solid #c8d3df!important;border-radius:12px!important;background:#fff!important;color:#102a43!important}
    .v94-home-pdf-btn{width:auto!important;min-width:78px!important;flex:0 0 auto!important;margin:0!important;padding:11px 18px!important;border-radius:12px!important;font-size:16px!important;font-weight:700!important;line-height:1.2!important}
    @media(max-width:520px){
      .v94-home-year-pdf-row{gap:8px!important}
      .v94-home-year-pdf-row select{min-width:90px!important;font-size:17px!important;padding:9px 11px!important}
      .v94-home-pdf-btn{min-width:72px!important;padding:10px 15px!important;font-size:15px!important}
    }
  `;
  document.head.appendChild(css);

  function currentKind(){
    if(typeof currentProduct==='string') return currentProduct;
    const title=(document.querySelector('header')?.textContent||'')+' '+(app?.textContent||'');
    if(title.includes('日高'))return 'hidaka';
    if(title.includes('根室'))return 'nemuro';
    if(title.includes('棹前')||title.includes('釧棹'))return 'sanmae';
    return 'kushiro';
  }
  function outputHomePdf(){
    const kind=currentKind();
    if(kind==='hidaka') return hOpenStockPdf(hState.activeYear);
    if(kind==='nemuro') return nOpenStockPdf(nState.activeYear);
    if(kind==='sanmae') return smOpenStockPdf(smState.activeYear);
    return openStockPdfDirect(state.activeYear);
  }
  function injectHomePdfButton(){
    const vp=app.querySelector('.v92-viewport.v92-home');
    if(!vp)return;
    const card=vp.closest('section.card');
    if(!card)return;
    const sel=card.querySelector('select');
    if(!sel)return;
    let row=sel.closest('.row,.v93-year-row,.v94-home-year-pdf-row');
    if(!row){
      row=document.createElement('div');
      sel.parentNode.insertBefore(row,sel);
      row.appendChild(sel);
    }
    row.classList.add('v94-home-year-pdf-row');
    const h=row.querySelector('h2');if(h)h.remove();
    let btn=row.querySelector('#v94HomePdf');
    if(!btn){
      btn=document.createElement('button');
      btn.id='v94HomePdf';
      btn.type='button';
      btn.className='btn v94-home-pdf-btn';
      btn.textContent='PDF';
      row.appendChild(btn);
    }
    btn.onclick=outputHomePdf;
  }

  // Home functions are already wrapped by earlier versions; wrap the final functions once more.
  ['home','hHome','nHome','smHome'].forEach(name=>{
    const old=globalThis[name]; if(typeof old!=='function')return;
    globalThis[name]=function(){
      const r=old.apply(this,arguments);
      requestAnimationFrame(injectHomePdfButton);
      return r;
    };
  });

  const mo=null; /* v122 perf: obsolete v94 observer disabled */

  ['productLanding','productChoicePage'].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){const r=fn.apply(this,arguments);const pill=app.querySelector('.pill');if(pill)pill.textContent='v95';return r};
  });
})();
/* ===== /v94 ===== */

/* ===== v95: 根室産昆布 貝殻棹前 等級順変更 =====
   貝殻棹前: 棹① → ③ → ④ → 元①。N_GROUPSを共通参照するため、在庫集計表・在庫PDF・出荷指示書PDFに同じ順序を適用。
===== /v95 ===== */


/* ===== v96: inventory home cleanup + larger summary ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    /* 上部4種類切替ボタンの高さを少し小さく */
    #v80InventorySwitcher{padding:6px 9px!important;margin-top:8px!important;margin-bottom:8px!important}
    #v80InventorySwitcher [data-v80inv]{padding:6px 2px!important;min-height:34px!important;font-size:13px!important;line-height:1.05!important;border-radius:10px!important}

    /* 在庫管理トップの年産プルダウン＋PDFを少し小さく */
    .v94-home-year-pdf-row{gap:7px!important;margin-bottom:7px!important}
    .v94-home-year-pdf-row select{min-width:76px!important;font-size:14px!important;padding:7px 9px!important;border-radius:10px!important}
    .v94-home-pdf-btn{min-width:54px!important;padding:8px 11px!important;font-size:13px!important;border-radius:10px!important}

    /* 中央2ボタン削除分、上部在庫集計表を縦に大きく */
    .v96-home-summary-card .v92-viewport.v92-home .v92-body-shell{max-height:430px!important}
    .v96-home-summary-card{padding-bottom:10px!important}
    .v96-home-summary-card .v92-viewport{margin-top:5px!important}
    .v96-home-summary-card .v92-note,
    .v96-home-summary-card p.muted{margin-top:6px!important;margin-bottom:0!important}

    @media(max-width:520px){
      #v80InventorySwitcher{padding:5px 8px!important;margin-top:7px!important;margin-bottom:7px!important}
      #v80InventorySwitcher [data-v80inv]{padding:5px 1px!important;min-height:32px!important;font-size:12.5px!important}
      .v94-home-year-pdf-row select{min-width:72px!important;font-size:13.5px!important;padding:6px 8px!important}
      .v94-home-pdf-btn{min-width:50px!important;padding:7px 9px!important;font-size:12.5px!important}
      .v96-home-summary-card .v92-viewport.v92-home .v92-body-shell{max-height:405px!important}
    }
  `;
  document.head.appendChild(css);

  function v96TidyHome(){
    const vp=app&&app.querySelector('.v92-viewport.v92-home');
    if(!vp)return;
    const card=vp.closest('section.card');
    if(card)card.classList.add('v96-home-summary-card');

    // 在庫管理トップ中央の「出荷指示」「在庫表」だけ削除。
    ['shipHome','c','hs','hst','ns','nst'].forEach(id=>{
      const b=document.getElementById(id);
      if(b && b.closest('section.grid')) b.remove();
    });
  }

  ['home','hHome','nHome','smHome'].forEach(name=>{
    const old=globalThis[name];
    if(typeof old!=='function')return;
    globalThis[name]=function(){
      const r=old.apply(this,arguments);
      requestAnimationFrame(v96TidyHome);
      return r;
    };
  });

  const mo=null; /* v122 perf: obsolete v96 observer disabled */

  ['productLanding','productChoicePage'].forEach(name=>{
    const fn=globalThis[name];
    if(typeof fn!=='function')return;
    globalThis[name]=function(){
      const r=fn.apply(this,arguments);
      const pill=app.querySelector('.pill');if(pill)pill.textContent='v96';
      return r;
    };
  });
})();
/* ===== /v96 ===== */


/* ===== v97: remove history/intake home buttons + sticky product switcher ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    /* 4昆布切替ボタンをiPhone縦スクロールでも上部固定 */
    #v80InventorySwitcher{
      position:sticky!important;
      top:calc(55px + env(safe-area-inset-top))!important;
      z-index:7!important;
      background:#f4f7fb!important;
      box-shadow:0 3px 10px #0002!important;
    }

    /* 中央ボタンをさらに削除した分、在庫集計表の表示領域を拡大 */
    .v96-home-summary-card .v92-viewport.v92-home .v92-body-shell{
      max-height:520px!important;
    }
    @media(max-width:520px){
      .v96-home-summary-card .v92-viewport.v92-home .v92-body-shell{
        max-height:485px!important;
      }
      #v80InventorySwitcher{
        top:calc(55px + env(safe-area-inset-top))!important;
      }
    }
  `;
  document.head.appendChild(css);

  function v97TidyHome(){
    const vp=app&&app.querySelector('.v92-viewport.v92-home');
    if(!vp)return;
    const card=vp.closest('section.card');
    if(card)card.classList.add('v96-home-summary-card');

    /* 釧路/日高/根室/釧棹の在庫管理トップ中央から
       入出庫履歴・入庫登録を削除。下部ナビや各機能そのものは残す。 */
    ['d','a','hl','hi','nl','ni'].forEach(id=>{
      const b=document.getElementById(id);
      if(b && b.closest('section.grid')) b.remove();
    });

    const sw=document.getElementById('v80InventorySwitcher');
    if(sw){sw.setAttribute('aria-label','昆布切替（固定）')}
  }

  ['home','hHome','nHome','smHome'].forEach(name=>{
    const old=globalThis[name];
    if(typeof old!=='function')return;
    globalThis[name]=function(){
      const r=old.apply(this,arguments);
      requestAnimationFrame(v97TidyHome);
      return r;
    };
  });

  const mo=null; /* v122 perf: obsolete v97 observer disabled */

  ['productLanding','productChoicePage'].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){
      const r=fn.apply(this,arguments);
      const pill=app.querySelector('.pill');if(pill)pill.textContent='v97';
      return r;
    };
  });
})();
/* ===== /v97 ===== */

/* ===== v98: 4昆布切替を在庫集計表から完全分離し画面最上部へ固定 ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    /* v98: switcher is mounted directly under BODY, outside #app/table */
    #v80InventorySwitcher.v98-fixed-switcher{
      position:fixed!important;
      top:var(--v98-switcher-top, 82px)!important;
      left:50%!important;
      right:auto!important;
      transform:translateX(-50%)!important;
      width:min(calc(100% - 24px),1176px)!important;
      max-width:1176px!important;
      margin:0!important;
      padding:6px 9px!important;
      z-index:30!important;
      background:#fff!important;
      border-radius:18px!important;
      box-shadow:0 3px 12px #0002!important;
    }
    #v80InventorySwitcher.v98-fixed-switcher [data-v80inv]{
      min-height:32px!important;
      padding:5px 2px!important;
      font-size:12.5px!important;
      line-height:1.05!important;
      border-radius:10px!important;
    }
    body.v98-switcher-active main{
      padding-top:84px!important;
    }
    @media(max-width:520px){
      #v80InventorySwitcher.v98-fixed-switcher{
        width:calc(100% - 24px)!important;
        padding:5px 8px!important;
      }
      #v80InventorySwitcher.v98-fixed-switcher [data-v80inv]{
        min-height:31px!important;
        padding:5px 1px!important;
        font-size:12px!important;
      }
      body.v98-switcher-active main{padding-top:80px!important}
    }
  `;
  document.head.appendChild(css);

  const mainEl=document.querySelector('main');
  const headerEl=document.querySelector('header');

  function setTop(){
    if(!headerEl)return;
    const bottom=Math.max(0,Math.round(headerEl.getBoundingClientRect().bottom));
    document.documentElement.style.setProperty('--v98-switcher-top', bottom+'px');
  }

  function updateActive(sw){
    if(!sw)return;
    sw.querySelectorAll('[data-v80inv]').forEach(btn=>{
      const active=btn.dataset.v80inv===currentProduct;
      btn.classList.toggle('secondary',!active);
      btn.classList.toggle('btn',true);
    });
  }

  function removeFixed(){
    const sw=document.getElementById('v80InventorySwitcher');
    if(sw && sw.parentElement!==app) sw.remove();
    document.body.classList.remove('v98-switcher-active');
  }

  function mountFixed(){
    if(!v80InventoryMode||!currentProduct){removeFixed();return;}
    // create with the existing app logic when absent
    if(!document.getElementById('v80InventorySwitcher') && typeof v80InjectInventorySwitcher==='function'){
      v80InjectInventorySwitcher();
    }
    const sw=document.getElementById('v80InventorySwitcher');
    if(!sw)return;
    // DOM-level separation: move outside MAIN/#app so table scrolling can never move it
    if(sw.parentElement!==document.body){
      document.body.insertBefore(sw,mainEl);
    }
    sw.classList.add('v98-fixed-switcher');
    sw.setAttribute('aria-label','昆布切替（画面上部固定）');
    updateActive(sw);
    document.body.classList.add('v98-switcher-active');
    setTop();
  }

  // Ensure any call to the original injector ends with the switcher outside #app.
  if(typeof v80InjectInventorySwitcher==='function'){
    const oldInject=v80InjectInventorySwitcher;
    v80InjectInventorySwitcher=function(){
      const r=oldInject.apply(this,arguments);
      requestAnimationFrame(mountFixed);
      return r;
    };
  }

  const mo=null; /* v122 perf: obsolete v98 observer disabled */

  window.addEventListener('resize',setTop,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(setTop,80),{passive:true});
  window.addEventListener('scroll',setTop,{passive:true});

  requestAnimationFrame(mountFixed);

  // Update visible version pills when present.
  ['productLanding','productChoicePage'].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){
      const r=fn.apply(this,arguments);
      requestAnimationFrame(()=>{
        const pill=app.querySelector('.pill');if(pill)pill.textContent='v98';
        mountFixed();
      });
      return r;
    };
  });
})();
/* ===== /v98 ===== */


/* v99: 日高出荷指示書キャンバス（従来hOpenShipPdfからも利用） */
function hShipCanvas(s,y){
  const c=hStockCanvas(y),x=c.getContext('2d'),W=c.width;
  x.fillStyle='#fff';x.fillRect(0,0,W,78);x.fillStyle='#000';
  x.font='700 28px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';x.textAlign='left';x.textBaseline='middle';x.fillText('出 荷 指 示 書（日高昆布）',35,30);
  x.font='700 16px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';x.textAlign='right';x.fillText(String(y||'')+'年産',W-35,26);
  x.font='400 12px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif';
  const src=s?.source||{},dst=s?.dest||{};x.fillText('指示番号：'+String(s?.id||'')+'　出荷日：'+String(s?.shipDate||''),W-35,50);
  x.textAlign='left';x.fillText('出荷先：'+String(dst.name||'')+'　　出荷元：'+String(src.name||''),35,60);
  return c;
}

/* ===== v99: FAX BOX - shipment snapshots, grouped multi-page PDF ===== */
(function(){
  const FAX_BOX_KEY='kombu-v99-fax-box';
  const productLabel=p=>({kushiro:'釧路',hidaka:'日高',nemuro:'根室',sanmae:'釧棹'}[p]||p||'');
  const clone=o=>JSON.parse(JSON.stringify(o));
  function loadBox(){try{const a=JSON.parse(localStorage.getItem(FAX_BOX_KEY)||'[]');return Array.isArray(a)?a:[]}catch(e){return []}}
  function saveBox(a){localStorage.setItem(FAX_BOX_KEY,JSON.stringify(a||[]))}
  function destOf(product,s){
    if(product==='kushiro'){const d=shipmentDest(s);return {name:d.name||'',address:d.address||'',phone:d.phone||''}}
    const d=s?.dest||{};return {name:d.name||s?.destInfo?.name||'',address:d.address||s?.destInfo?.address||'',phone:d.phone||s?.destInfo?.phone||''}
  }
  function sourceOf(product,s){
    if(product==='kushiro'){const d=shipmentSource(s);return {name:d.name||'',address:d.address||'',phone:d.phone||''}}
    const d=s?.source||{};return {name:d.name||'',address:d.address||'',phone:d.phone||''}
  }
  function qtyOf(s){return (s?.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0)}
  function shipLookup(product,id){
    if(product==='kushiro')return state.shipments.find(s=>s.id===id);
    if(product==='hidaka')return hState.shipments.find(s=>s.id===id);
    if(product==='nemuro')return nState.shipments.find(s=>s.id===id);
    if(product==='sanmae')return smState.shipments.find(s=>s.id===id);
    return null;
  }
  function addFaxBox(product,id){
    const s=shipLookup(product,id);if(!s)return alert('出荷指示が見つかりません。');
    const box=loadBox(),key=product+'::'+id,d=destOf(product,s),now=new Date().toISOString();
    const item={key,product,id,addedAt:now,shipDate:s.shipDate||'',dest:d,source:sourceOf(product,s),qty:qtyOf(s),snapshot:clone(s)};
    const i=box.findIndex(x=>x.key===key);
    if(i>=0){box[i]=item;saveBox(box);alert('FAX BOXの内容を最新の出荷指示で更新しました。')}
    else{box.push(item);saveBox(box);alert('FAX BOXへ追加しました。')}
    injectFaxBoxButtons();
  }
  function removeFaxBox(key){const box=loadBox().filter(x=>x.key!==key);saveBox(box);faxBoxPage()}
  function groupKey(item){const d=item.dest||{};return (d.name||'送信先未設定')+'\u0001'+(d.phone||'')}

  async function canvasesFor(item){
    const p=item.product,s=clone(item.snapshot||{}),ys=[...new Set((s.lines||[]).map(l=>l.year||s.baseYear||DEFAULT_YEAR))];
    if(!ys.length)ys.push(s.baseYear||DEFAULT_YEAR);
    /* v130: FAX BOXも通常のPDF/FAXボタンと同じ最新帳票キャンバスを使用 */
    if(p==='kushiro')return ys.map(y=>v55CanvasKushiro(s,y));
    if(p==='hidaka')return ys.map(y=>v55CanvasHidaka(s,y));
    if(p==='nemuro')return ys.map(y=>v55CanvasNemuro(s,y));
    if(p==='sanmae')return ys.map(y=>v55CanvasSanmae(s,y));
    return [];
  }
  async function multiCanvasPdfBlob(canvases){
    if(!canvases.length)throw new Error('PDFにする帳票がありません。');
    const ims=[];for(const c of canvases)ims.push({bytes:await _canvasJpegBytes(c),w:c.width,h:c.height});
    const objs=[],pageIds=[],imgIds=[],contentIds=[];let id=1,catalog=id++,pages=id++;
    ims.forEach(()=>{pageIds.push(id++);imgIds.push(id++);contentIds.push(id++)});
    objs[catalog]=_ascii(`<< /Type /Catalog /Pages ${pages} 0 R >>`);
    objs[pages]=_ascii(`<< /Type /Pages /Count ${ims.length} /Kids [${pageIds.map(x=>x+' 0 R').join(' ')}] >>`);
    ims.forEach((im,i)=>{
      objs[pageIds[i]]=_ascii(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Im0 ${imgIds[i]} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`);
      objs[imgIds[i]]=_concatBytes([_ascii(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`),im.bytes,_ascii('\nendstream')]);
      const st='q\n841.89 0 0 595.28 0 0 cm\n/Im0 Do\nQ\n';
      objs[contentIds[i]]=_ascii(`<< /Length ${st.length} >>\nstream\n${st}endstream`);
    });
    const n=id-1,parts=[_ascii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')],offs=Array(n+1).fill(0);let pos=parts[0].length;
    for(let i=1;i<=n;i++){offs[i]=pos;const a=_ascii(`${i} 0 obj\n`),b=objs[i],c=_ascii('\nendobj\n');parts.push(a,b,c);pos+=a.length+b.length+c.length}
    const xp=pos;let xr=`xref\n0 ${n+1}\n0000000000 65535 f \n`;for(let i=1;i<=n;i++)xr+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
    xr+=`trailer\n<< /Size ${n+1} /Root ${catalog} 0 R >>\nstartxref\n${xp}\n%%EOF`;parts.push(_ascii(xr));
    return new Blob(parts,{type:'application/pdf'});
  }
  async function openGroupPdf(keys){
    const w=window.open('about:blank','_blank');if(!w)return alert('PDF画面を開けません。Safariのポップアップ設定を確認してください。');
    try{
      w.document.write('<meta name="viewport" content="width=device-width,initial-scale=1"><div style="font-family:-apple-system;padding:30px;text-align:center"><h3>FAX用PDFをまとめています…</h3><p>そのままお待ちください。</p></div>');w.document.close();
      const map=new Map(loadBox().map(x=>[x.key,x])),canv=[];
      for(const k of keys){const item=map.get(k);if(!item)continue;canv.push(...await canvasesFor(item))}
      const blob=await v65LandscapePdfBlobFromCanvases(canv),url=URL.createObjectURL(blob);w.location.replace(url);setTimeout(()=>URL.revokeObjectURL(url),10*60*1000);
    }catch(e){try{w.close()}catch{}alert('まとめPDFの作成に失敗しました。\n'+(e.message||e))}
  }
  async function openItemsPdf(items){
    if(!items||!items.length){alert('PDF/FAXにする項目をチェックしてください。');return false}
    const w=window.open('about:blank','_blank');if(!w){alert('PDF画面を開けません。Safariのポップアップ設定を確認してください。');return false}
    try{
      w.document.write('<meta name="viewport" content="width=device-width,initial-scale=1"><div style="font-family:-apple-system;padding:30px;text-align:center"><h3>FAX用PDFをまとめています…</h3><p>そのままお待ちください。</p></div>');w.document.close();
      const canv=[];for(const item of items)canv.push(...await canvasesFor(item));
      const blob=await v65LandscapePdfBlobFromCanvases(canv),url=URL.createObjectURL(blob);w.location.replace(url);setTimeout(()=>URL.revokeObjectURL(url),10*60*1000);
      return true;
    }catch(e){try{w.close()}catch{}alert('まとめPDFの作成に失敗しました。\n'+(e.message||e));return false}
  }
  window.v159OpenItemsPdf=openItemsPdf;

  function faxBoxPage(){
    v80InventoryMode=false;currentProduct=null;setHeader('FAX BOX');setNavVisible(false);
    const box=loadBox(), groups=new Map();
    box.forEach(it=>{const k=groupKey(it);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(it)});
    const cards=[...groups.entries()].map(([g,items],gi)=>{
      const d=items[0]?.dest||{},sorted=items.slice().sort((a,b)=>String(a.shipDate||'').localeCompare(String(b.shipDate||'')));
      const rows=sorted.map(it=>`<tr data-fax-row="${esc(it.key)}">
        <td class="v159-check"><input type="checkbox" class="v159-fax-check" data-key="${esc(it.key)}"></td>
        <td>${esc(it.shipDate||'')}</td><td><b>${esc(productLabel(it.product))}</b></td><td>${esc(it.source?.name||'')}</td><td>${esc(it.dest?.name||'')}</td>
        <td style="text-align:center">${fmt(it.qty||0)}</td><td><button class="mini danger" data-fax-remove="${esc(it.key)}">削除</button></td><td>${esc(it.id||'')}</td></tr>`).join('');
      return `<section class="card v159-fax-card" style="margin-top:12px;padding:14px" data-fax-card="${gi}"><div class="row" style="align-items:flex-start"><div><h3 style="margin:0 0 3px">${esc(d.name||'送信先未設定')}</h3></div><span class="pill">${items.length}件</span></div>
        <div class="tablewrap" style="margin-top:10px;overflow:auto"><table class="v159-compact-table"><colgroup><col class="c0"><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"><col class="c6"><col class="c7"></colgroup><thead><tr><th><input type="checkbox" class="v159-fax-all" aria-label="全選択"></th><th>依頼日</th><th>昆布</th><th>出荷元</th><th>出荷先</th><th>個数</th><th>削除</th><th>番号</th></tr></thead><tbody>${rows}</tbody></table></div>
        <button class="btn" style="margin-top:10px" data-fax-checked="${gi}">📄 まとめてPDF/FAX</button></section>`;
    }).join('');
    app.innerHTML=`<section class="card" style="margin-top:12px;padding:14px"><div class="row"><div><h2 style="margin:0">📥 FAX BOX</h2><p class="muted" style="margin:5px 0 0">チェックした出荷指示書だけをPDF/FAXにまとめます。</p></div><span class="pill">${box.length}件</span></div></section>${cards||'<section class="card"><div class="empty">FAX BOXは空です。</div></section>'}<section class="card" style="margin-top:12px;padding:12px"><div style="display:grid;grid-template-columns:${box.length?'repeat(3,1fr)':'repeat(2,1fr)'};gap:9px"><button class="btn secondary" id="faxBoxHome">🏠</button><button class="btn secondary" id="faxBoxBack">⬅️</button>${box.length?'<button class="btn danger" id="faxBoxClear">全削除</button>':''}</div></section>`;
    app.querySelectorAll('.v159-fax-all').forEach(all=>all.onchange=()=>{const card=all.closest('.v159-fax-card');card.querySelectorAll('.v159-fax-check').forEach(c=>c.checked=all.checked)});
    app.querySelectorAll('[data-fax-checked]').forEach(b=>b.onclick=async()=>{
      const card=b.closest('.v159-fax-card'),keys=[...card.querySelectorAll('.v159-fax-check:checked')].map(c=>c.dataset.key),map=new Map(box.map(x=>[x.key,x])),items=keys.map(k=>map.get(k)).filter(Boolean);
      if(!items.length)return alert('PDF/FAXにする項目をチェックしてください。');
      const ok=await openItemsPdf(items);if(!ok)return;
      const HIST_KEY='kombu-v136-shipment-history';
      let hist=[];try{hist=JSON.parse(localStorage.getItem(HIST_KEY)||'[]');if(!Array.isArray(hist))hist=[]}catch(_e){hist=[]}
      const hm=new Map(hist.map(x=>[x.key,x])),now=new Date().toISOString();
      items.forEach(it=>hm.set(it.key,{...it,archivedAt:now}));
      localStorage.setItem(HIST_KEY,JSON.stringify([...hm.values()]));
      const selected=new Set(keys);saveBox(box.filter(it=>!selected.has(it.key)));
      faxBoxPage();
    });
    app.querySelectorAll('[data-fax-remove]').forEach(b=>b.onclick=()=>removeFaxBox(b.dataset.faxRemove));
    faxBoxHome.onclick=productLanding;faxBoxBack.onclick=()=>productChoicePage('shipment');
    const clear=document.getElementById('faxBoxClear');if(clear)clear.onclick=()=>{if(confirm('FAX BOXを空にしますか？')){saveBox([]);faxBoxPage()}};
  }
  window.v99FaxBoxPage=faxBoxPage;

  function injectFaxBoxButtons(){
    // shipment detail buttons: detect current product detail and current ID from heading.
    if(document.getElementById('v99FaxAdd'))return;
    let product=null,id=null,toolbar=null;
    const h=app.querySelector('h2');const txt=h?.textContent||'';
    if(/出荷指示書\s+S\d+/.test(txt)){product='kushiro';id=(txt.match(/S\d+/)||[])[0];toolbar=app.querySelector('.toolbar')}
    else if(/日高昆布 出荷指示 H\d+/.test(txt)){product='hidaka';id=(txt.match(/H\d+/)||[])[0];toolbar=app.querySelector('.toolbar')}
    else if(/根室産昆布 出荷指示 N\d+/.test(txt)){product='nemuro';id=(txt.match(/N\d+/)||[])[0];toolbar=app.querySelector('.toolbar')}
    else if(/釧路産棹前昆布 出荷指示 M\d+|釧路産棹前昆布 出荷指示 S\d+/.test(txt)){product='sanmae';id=(txt.match(/[MS]\d+/)||[])[0];toolbar=app.querySelector('.toolbar')}
    if(product&&id&&toolbar){
      const b=document.createElement('button');b.className='btn secondary';b.id='v99FaxAdd';b.textContent='📥 FAX BOXへ追加';b.onclick=()=>addFaxBox(product,id);
      const pdf=toolbar.querySelector('[id*="pdf"]');pdf&&pdf.nextSibling?toolbar.insertBefore(b,pdf.nextSibling):toolbar.insertBefore(b,toolbar.firstChild);
    }
  }
  const obs=new MutationObserver(()=>requestAnimationFrame(injectFaxBoxButtons));obs.observe(app,{childList:true,subtree:true});

  // Wrap shipment menu to add a visible FAX BOX entry without disturbing the compact list.
  const baseChoice=productChoicePage;
  productChoicePage=function(mode){
    const r=baseChoice(mode);
    if(mode==='shipment')requestAnimationFrame(()=>{
      const first=app.querySelector('section.card');if(!first||document.getElementById('v99FaxBoxBtn'))return;
      const btn=document.createElement('button');btn.id='v99FaxBoxBtn';btn.className='btn secondary';btn.style.cssText='width:100%;margin-top:9px;padding:9px 10px;font-size:14px;font-weight:800';btn.textContent='📥 FAX BOX ('+loadBox().length+')';btn.onclick=faxBoxPage;first.appendChild(btn);
      const pill=first.querySelector('.pill');if(pill)pill.textContent='v99';
    });
    return r;
  };
  const baseLanding=productLanding;productLanding=function(){const r=baseLanding();const p=app.querySelector('.pill');if(p)p.textContent='v99';return r};
  productLanding();
})();
/* ===== /v99 ===== */


/* ===== v100: FAX BOX moved to shipment bottom nav; compact shipment top ===== */
(function(){
  const FAX_BOX_KEY='kombu-v99-fax-box';
  function faxCount(){
    try{const a=JSON.parse(localStorage.getItem(FAX_BOX_KEY)||'[]');return Array.isArray(a)?a.length:0}catch(e){return 0}
  }
  function tuneShipmentMenu(){
    // Only touch the shipment dashboard (four product buttons + compact shipment list).
    if(!document.getElementById('v76K') || !document.getElementById('v76ShipmentList'))return;

    // Remove the upper FAX BOX entry introduced in v99.
    const topFax=document.getElementById('v99FaxBoxBtn');
    if(topFax)topFax.remove();

    // Remove the "出荷指示" heading row above the four product buttons.
    const first=document.getElementById('v76K')?.closest('section.card');
    if(first){
      [...first.querySelectorAll(':scope > .row')].forEach(row=>{
        const h=row.querySelector('h2');
        if(h && ((h.textContent||'').trim()==='出荷指示'||(h.textContent||'').trim()==='出荷依頼一覧'))row.remove();
      });
      first.style.paddingTop='12px';
    }

    // Add FAX BOX to the bottom navigation; visible text is icon + stock count only.
    const home=document.getElementById('v76Home');
    if(home){
      const grid=home.parentElement;
      if(grid){
        grid.style.gridTemplateColumns='repeat(4,1fr)';
        grid.style.gap='8px';
        let b=document.getElementById('v100FaxBottom');
        if(!b){
          b=document.createElement('button');
          b.className='btn secondary';
          b.id='v100FaxBottom';
          b.setAttribute('aria-label','FAX BOX');
          b.setAttribute('title','FAX BOX');
          b.style.cssText='font-size:22px;padding:12px 2px;white-space:nowrap';
          b.onclick=()=>{if(typeof window.v99FaxBoxPage==='function')window.v99FaxBoxPage()};
          grid.appendChild(b);
        }
        b.textContent='📥 ('+faxCount()+')';
      }
    }
  }

  const css=document.createElement('style');
  css.textContent=`
    #v100FaxBottom{min-width:0!important}
    @media(max-width:430px){#v100FaxBottom{font-size:19px!important;padding-left:1px!important;padding-right:1px!important}}
  `;
  document.head.appendChild(css);

  const baseChoice=productChoicePage;
  productChoicePage=function(mode){
    const r=baseChoice.apply(this,arguments);
    if(mode==='shipment')requestAnimationFrame(()=>requestAnimationFrame(tuneShipmentMenu));
    return r;
  };

  // v99 adds/removes content asynchronously; keep the dashboard normalized and the count fresh.
  /* v122 perf: obsolete v100 mutation observer disabled; explicit wrappers remain */
  window.addEventListener('storage',()=>tuneShipmentMenu());

  // On direct current dashboard, apply immediately.
  requestAnimationFrame(()=>requestAnimationFrame(tuneShipmentMenu));

  const baseLanding=productLanding;
  productLanding=function(){const r=baseLanding.apply(this,arguments);const p=app.querySelector('.pill');if(p)p.textContent='v100';return r};
})();
/* ===== /v100 ===== */

/* ===== v101: unify lower navigation like Hidaka shipment screen ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    /* 共通下部ナビは日高出荷指示と同じ固定バー */
    body > nav{
      position:fixed!important;left:0!important;right:0!important;bottom:0!important;
      z-index:60!important;background:#0b2b55!important;
      box-shadow:0 -2px 10px #0002!important;
    }
    /* ひとつ前に戻るは中段カードではなく下部固定ドックへ */
    #v101BackDock{
      position:fixed;left:12px;right:12px;
      bottom:calc(58px + env(safe-area-inset-bottom));
      z-index:59;display:flex;justify-content:center;align-items:center;
      pointer-events:none;
    }
    #v101BackDock button{
      pointer-events:auto;width:min(420px,100%);border:0;border-radius:14px;
      background:#e7edf5;color:#102a43;font-weight:800;font-size:15px;
      padding:10px 16px;box-shadow:0 2px 9px #0002;
    }
    body.v101-has-back main{padding-bottom:calc(150px + env(safe-area-inset-bottom))!important}
    /* 旧v70の中段カードは出さない */
    #v70OneBack{display:none!important}
    @media(max-width:430px){
      #v101BackDock{left:10px;right:10px;bottom:calc(57px + env(safe-area-inset-bottom))}
      #v101BackDock button{font-size:14px;padding:9px 14px}
    }
  `;
  document.head.appendChild(css);

  function isNavOnlyButton(btn){
    if(!btn || btn.closest('body > nav'))return false;
    const t=(btn.textContent||'').replace(/\s+/g,'').trim();
    if(!t)return false;
    return ['戻る','ホームへ戻る','ホーム','最初のトップ画面へ','⬅️ひとつ前に戻る','ひとつ前に戻る'].includes(t);
  }

  function ensureDock(){
    let dock=document.getElementById('v101BackDock');
    if(!dock){
      dock=document.createElement('div');dock.id='v101BackDock';
      const b=document.createElement('button');b.type='button';b.textContent='⬅️ 戻る';
      dock.appendChild(b);document.body.appendChild(dock);
    }
    return dock;
  }

  function currentV70Button(){
    const old=document.querySelector('#v70OneBack button');
    return old || null;
  }

  function tidy(){
    const dock=ensureDock();
    const dockBtn=dock.querySelector('button');
    const v70=currentV70Button();

    // v70の履歴戻りを優先して固定ドックへ引き継ぐ
    if(v70){
      dockBtn.onclick=()=>v70.click();
      dock.style.display='flex';
      document.body.classList.add('v101-has-back');
    }else{
      // v70が無いトップ画面では戻るドックを非表示
      dock.style.display='none';
      document.body.classList.remove('v101-has-back');
    }

    // 画面途中に残る重複ナビゲーションボタンを削除/非表示。
    [...app.querySelectorAll('button')].forEach(btn=>{
      if(btn.closest('#v70OneBack'))return;
      if(!isNavOnlyButton(btn))return;
      const parent=btn.parentElement;
      btn.style.display='none';
      // buttonだけのカード/toolbarなら余白も消す
      if(parent && [...parent.children].every(el=>el===btn || (el.tagName==='BUTTON' && getComputedStyle(el).display==='none'))){
        parent.style.display='none';
        const sec=parent.matches('section.card')?parent:parent.closest('section.card');
        if(sec && sec!==app.querySelector('section.card') && sec.querySelectorAll('button:not([style*="display: none"])').length===0 && sec.textContent.trim().replace(/戻る|ホームへ戻る|ひとつ前に戻る/g,'').trim()==='') sec.style.display='none';
      }
    });
  }

  // v70が毎画面後にボタンを作るためMutationObserverで同期
  /* v122 perf: obsolete v101 mutation observer disabled; explicit wrappers remain */
  requestAnimationFrame(()=>requestAnimationFrame(tidy));

  // バージョン表示
  ['productLanding','productChoicePage'].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){
      const r=fn.apply(this,arguments);
      requestAnimationFrame(tidy);
      const p=app.querySelector('.pill');if(p)p.textContent='v101';
      return r;
    };
  });
})();
/* ===== /v101 ===== */

/* ===== v102: shipment/FAX BOX middle navigation moved to fixed bottom docks ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    /* 出荷指示トップとFAX BOXの中段ナビを最下部固定へ */
    .v102-fixed-bottom-nav-card{
      position:fixed!important;
      left:10px!important;right:10px!important;
      bottom:calc(10px + env(safe-area-inset-bottom))!important;
      z-index:95!important;
      margin:0!important;padding:8px!important;
      border-radius:18px!important;
      box-shadow:0 5px 20px rgba(16,42,67,.22)!important;
      background:#fff!important;
      width:auto!important;max-width:none!important;
    }
    .v102-fixed-bottom-nav-card > div{
      gap:8px!important;
    }
    .v102-fixed-bottom-nav-card button{
      min-height:54px!important;
      padding:8px 3px!important;
      font-size:22px!important;
      border-radius:14px!important;
    }
    .v102-fixed-bottom-nav-card #faxBoxClear{
      font-size:13px!important;
      font-weight:800!important;
    }
    body.v102-special-bottom main{
      padding-bottom:calc(105px + env(safe-area-inset-bottom))!important;
    }
    /* v101の戻るドックはこの2画面では重複するため非表示 */
    body.v102-special-bottom #v101BackDock{display:none!important}
    @media(min-width:700px){
      .v102-fixed-bottom-nav-card{left:50%!important;right:auto!important;transform:translateX(-50%)!important;width:min(760px,calc(100vw - 30px))!important}
    }
  `;
  document.head.appendChild(css);

  function clearSpecial(){
    document.body.classList.remove('v102-special-bottom');
    document.querySelectorAll('.v102-fixed-bottom-nav-card').forEach(x=>x.classList.remove('v102-fixed-bottom-nav-card'));
  }

  function fixShipmentDashboard(){
    const home=document.getElementById('v76Home');
    if(!home)return false;
    const card=home.closest('section.card');
    if(!card)return false;
    card.classList.add('v102-fixed-bottom-nav-card');
    document.body.classList.add('v102-special-bottom');
    return true;
  }

  function fixFaxBox(){
    const home=document.getElementById('faxBoxHome');
    const back=document.getElementById('faxBoxBack');
    if(!home||!back)return false;
    const card=home.closest('section.card');
    if(!card)return false;
    card.classList.add('v102-fixed-bottom-nav-card');
    document.body.classList.add('v102-special-bottom');
    return true;
  }

  function tune(){
    const special=fixShipmentDashboard() || fixFaxBox();
    if(!special && !document.querySelector('.v102-fixed-bottom-nav-card')){
      document.body.classList.remove('v102-special-bottom');
    }
  }

  /* v122 perf: obsolete v102 mutation observer disabled; explicit wrappers remain */
  requestAnimationFrame(()=>requestAnimationFrame(tune));

  // 主要画面遷移時に旧固定クラスを掃除してから再判定
  ['productLanding','productChoicePage'].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){
      clearSpecial();
      const r=fn.apply(this,arguments);
      requestAnimationFrame(tune);
      const p=app.querySelector('.pill');if(p)p.textContent='v102';
      return r;
    };
  });

  if(typeof window.v99FaxBoxPage==='function'){
    const f=window.v99FaxBoxPage;
    window.v99FaxBoxPage=function(){
      clearSpecial();
      const r=f.apply(this,arguments);
      requestAnimationFrame(tune);
      return r;
    };
  }
})();
/* ===== /v102 ===== */


/* ===== v103: shipment/FAX BOX fixed nav styled like Hidaka bottom navigation ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    /* v102の白いフローティングカードを、日高出荷指示と同じ下部固定ナビへ */
    .v102-fixed-bottom-nav-card{
      position:fixed!important;
      left:0!important;right:0!important;
      bottom:0!important;
      z-index:100!important;
      margin:0!important;
      padding:7px 10px calc(7px + env(safe-area-inset-bottom))!important;
      border-radius:0!important;
      box-shadow:0 -2px 10px rgba(0,0,0,.16)!important;
      background:#0b2b55!important;
      width:100%!important;max-width:none!important;
      box-sizing:border-box!important;
    }
    .v102-fixed-bottom-nav-card > div{
      display:grid!important;
      gap:6px!important;
      align-items:stretch!important;
    }
    .v102-fixed-bottom-nav-card button{
      min-height:50px!important;
      padding:5px 2px!important;
      margin:0!important;
      border:0!important;
      border-radius:10px!important;
      background:transparent!important;
      color:#fff!important;
      box-shadow:none!important;
      font-size:23px!important;
      line-height:1!important;
      font-weight:800!important;
    }
    .v102-fixed-bottom-nav-card button:active{
      background:rgba(255,255,255,.12)!important;
    }
    .v102-fixed-bottom-nav-card #faxBoxClear{
      font-size:12px!important;
      line-height:1.15!important;
    }
    body.v102-special-bottom main{
      padding-bottom:calc(76px + env(safe-area-inset-bottom))!important;
    }
    body.v102-special-bottom #v101BackDock{display:none!important}
    @media(min-width:700px){
      .v102-fixed-bottom-nav-card{
        left:0!important;right:0!important;transform:none!important;width:100%!important;
      }
    }
  `;
  document.head.appendChild(css);

  // バージョン表示
  ['productLanding','productChoicePage'].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){
      const r=fn.apply(this,arguments);
      requestAnimationFrame(()=>{const p=app.querySelector('.pill');if(p)p.textContent='v103';});
      return r;
    };
  });
})();
/* ===== /v103 ===== */

/* ===== v104: product shipment lists match dashboard compact layout ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    .v104-prod-ship-card{padding:14px!important}
    .v104-prod-ship-card .row{margin-bottom:8px!important}
    .v104-prod-ship-card .row h2{font-size:20px!important;margin:0!important}
    .v104-prod-ship-card .tablewrap{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important}
    .v104-prod-ship-table{min-width:450px!important;width:100%!important;table-layout:fixed!important;font-size:10px!important}
    .v104-prod-ship-table th,.v104-prod-ship-table td{padding:4px 2px!important;line-height:1.15!important;vertical-align:middle!important;text-align:center!important}
    .v104-prod-ship-table th:nth-child(1),.v104-prod-ship-table td:nth-child(1),
    .v104-prod-ship-table th:nth-child(2),.v104-prod-ship-table td:nth-child(2){width:30px!important}
    .v104-prod-ship-table th:nth-child(3),.v104-prod-ship-table td:nth-child(3){width:5ch!important}
    .v104-prod-ship-table th:nth-child(4),.v104-prod-ship-table td:nth-child(4),
    .v104-prod-ship-table th:nth-child(5),.v104-prod-ship-table td:nth-child(5){width:5em!important}
    .v104-prod-ship-table th:nth-child(6),.v104-prod-ship-table td:nth-child(6){width:28px!important}
    .v104-prod-ship-table th:nth-child(7),.v104-prod-ship-table td:nth-child(7){width:44px!important}
    .v104-prod-ship-table th:nth-child(8),.v104-prod-ship-table td:nth-child(8){width:32px!important}
    .v104-prod-ship-table .v104-check{padding-left:1px!important;padding-right:1px!important}
    .v104-prod-ship-table .v104-check input{width:13px!important;height:13px!important;margin:0!important;accent-color:#173760!important;vertical-align:middle!important}
    .v104-prod-ship-table .v104-scroll{display:block;width:5em;max-width:100%;margin:0 auto;overflow-x:auto;overflow-y:hidden;white-space:nowrap;text-align:center;-webkit-overflow-scrolling:touch;scrollbar-width:none}
    .v104-prod-ship-table .v104-scroll::-webkit-scrollbar{display:none}
    .v104-prod-ship-table .v104-date{width:5ch!important;font-variant-numeric:tabular-nums!important}
    .v104-prod-ship-table .v104-qty{white-space:nowrap!important;font-variant-numeric:tabular-nums!important}
    .v104-prod-ship-table .v104-status{white-space:nowrap!important}
    .v104-prod-ship-table .v104-open .mini{padding:2px 4px!important;font-size:8px!important;line-height:1.1!important;min-height:20px!important;border-radius:5px!important;white-space:nowrap!important}
    @media(max-width:430px){
      .v104-prod-ship-table{min-width:430px!important;font-size:9.5px!important}
      .v104-prod-ship-table th,.v104-prod-ship-table td{padding:3px 1px!important}
      .v104-prod-ship-table th:nth-child(1),.v104-prod-ship-table td:nth-child(1),
      .v104-prod-ship-table th:nth-child(2),.v104-prod-ship-table td:nth-child(2){width:27px!important}
      .v104-prod-ship-table th:nth-child(6),.v104-prod-ship-table td:nth-child(6){width:25px!important}
      .v104-prod-ship-table th:nth-child(8),.v104-prod-ship-table td:nth-child(8){width:30px!important}
    }
  `;
  document.head.appendChild(css);

  function statusShort(s){return typeof v75ShipmentStatusShort==='function'?v75ShipmentStatusShort(s):({draft:'下書き',confirmed:'確定済',shipped:'出荷済',cancelled:'取消'}[s]||s||'')}
  function sourceName(product,s){return product==='kushiro'?shipmentSource(s).name:(s?.source?.name||'')}
  function destName(product,s){return product==='kushiro'?shipmentDest(s).name:(s?.dest?.name||'')}
  function qtyOf(s){return (s?.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0)}

  function renderProductList(cfg){
    const rows=(cfg.rows||[]).slice().reverse();
    const checks=v76LoadShipChecks();
    const body=rows.map(s=>{
      const ck=checks[v76ShipCheckId(cfg.product,s.id)]||{};
      const src=sourceName(cfg.product,s),dst=destName(cfg.product,s);
      return `<tr data-v104-id="${esc(s.id||'')}">
        <td class="v104-check"><input type="checkbox" data-v104-check="fax" ${ck.fax?'checked':''} aria-label="FAX済"></td>
        <td class="v104-check"><input type="checkbox" data-v104-check="slip" ${ck.slip?'checked':''} aria-label="伝票済"></td>
        <td><div class="v104-scroll v104-date" title="${esc(s.shipDate||'')}">${esc(v78ShortShipDate(s.shipDate||''))}</div></td>
        <td><div class="v104-scroll" title="${esc(src)}">${esc(src)}</div></td>
        <td><div class="v104-scroll" title="${esc(dst)}">${esc(dst)}</div></td>
        <td class="v104-qty">${fmt(qtyOf(s))}</td>
        <td class="v104-status">${esc(statusShort(s.status))}</td>
        <td class="v104-open"><button class="mini" data-v104-open="1">開く</button></td>
      </tr>`;
    }).join('') || `<tr><td colspan="8" class="empty">出荷指示はありません</td></tr>`;

    app.innerHTML=`<section class="card v104-prod-ship-card">
      <div class="row"><h2>${esc(cfg.title)}</h2><button class="mini" id="v104New">＋新規</button></div>
      <div class="tablewrap"><table class="v104-prod-ship-table">
        <thead><tr><th>FAX済</th><th>伝票済</th><th>出荷日</th><th>出荷元</th><th>出荷先</th><th>個数</th><th>状態</th><th>開く</th></tr></thead>
        <tbody id="v104Body">${body}</tbody>
      </table></div>
      <button class="btn secondary" id="v104Back" style="margin-top:10px">戻る</button>
    </section>`;
    document.getElementById('v104New').onclick=cfg.newFn;
    document.getElementById('v104Back').onclick=cfg.backFn;
    document.getElementById('v104Body').onclick=e=>{
      const tr=e.target.closest('tr[data-v104-id]');if(!tr)return;
      const cb=e.target.closest('[data-v104-check]');
      if(cb){v76SetShipCheck(cfg.product,tr.dataset.v104Id,cb.dataset.v104Check,cb.checked);return}
      if(e.target.closest('[data-v104-open]'))cfg.openFn(tr.dataset.v104Id);
    };
  }

  shipments=function(){renderProductList({product:'kushiro',title:'釧路産昆布 出荷指示',rows:state.shipments,newFn:()=>shipmentForm(),backFn:home,openFn:id=>shipmentDetail(id)})};
  hShipments=function(){renderProductList({product:'hidaka',title:'日高昆布 出荷指示',rows:hState.shipments,newFn:()=>hShipForm(),backFn:hHome,openFn:id=>hShipDetail(id)})};
  nShipments=function(){renderProductList({product:'nemuro',title:'根室産昆布 出荷指示',rows:nState.shipments,newFn:()=>nShipForm(),backFn:nHome,openFn:id=>nShipDetail(id)})};
  smShipments=function(){renderProductList({product:'sanmae',title:'釧路産棹前昆布 出荷指示',rows:smState.shipments,newFn:()=>smShipForm(),backFn:smHome,openFn:id=>smShipDetail(id)})};

  // バージョン表示
  ['productLanding','productChoicePage'].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){const r=fn.apply(this,arguments);requestAnimationFrame(()=>{const p=app.querySelector('.pill');if(p)p.textContent='v104'});return r};
  });
})();
/* ===== /v104 ===== */


/* ===== v105: simplified two-button landing ===== */
(function(){
  const baseSettings = typeof v73SettingsPage==='function' ? v73SettingsPage : null;
  productLanding=function(){
    currentProduct=null;
    setHeader('昆布在庫管理');
    setNavVisible(false);
    app.innerHTML=`
      <style>
        .v105-landing-card{margin-top:22px;position:relative;padding:22px 18px 86px!important}
        .v105-version{position:absolute;right:18px;top:16px;font-size:12px;font-weight:700;background:#e8eef6;padding:4px 8px;border-radius:999px;color:#12304f}
        .v105-main-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}
        .v105-main-actions .action{width:100%;min-height:150px;padding:18px 10px!important;display:flex;align-items:center;justify-content:center;text-align:center}
        .v105-main-actions .action b{font-size:25px!important;line-height:1.18!important;display:block!important;white-space:normal!important}
        .v105-main-actions .v105-icon{display:block;font-size:30px;line-height:1;margin-bottom:8px}
        #v105Gear{position:absolute;right:18px;bottom:16px;width:56px;height:56px;border:1px solid #d5dee8;border-radius:18px;background:#edf2f7;color:#12304f;font-size:29px;line-height:1;box-shadow:0 4px 12px rgba(16,42,67,.10)}
        @media(max-width:430px){
          .v105-landing-card{padding:18px 14px 80px!important}
          .v105-main-actions{gap:10px;margin-top:12px}
          .v105-main-actions .action{min-height:132px;padding:14px 8px!important}
          .v105-main-actions .action b{font-size:23px!important}
          .v105-main-actions .v105-icon{font-size:28px;margin-bottom:7px}
        }
      </style>
      <section class="card v105-landing-card">
        <span class="v105-version">v105</span>
        <div class="v105-main-actions">
          <button class="action orange" id="v105Inventory" aria-label="在庫管理">
            <b><span class="v105-icon">📊</span>在庫<br>管理</b>
          </button>
          <button class="action blue" id="v105Shipment" aria-label="出荷依頼">
            <b><span class="v105-icon">📦</span>出荷<br>依頼</b>
          </button>
        </div>
        <button id="v105Gear" aria-label="設定" title="設定">⚙️</button>
      </section>`;
    document.getElementById('v105Inventory').onclick=()=>productChoicePage('inventory');
    document.getElementById('v105Shipment').onclick=()=>productChoicePage('shipment');
    document.getElementById('v105Gear').onclick=baseSettings||v73SettingsPage;
  };

  const oldChoice=productChoicePage;
  productChoicePage=function(){
    const r=oldChoice.apply(this,arguments);
    requestAnimationFrame(()=>{const p=app.querySelector('.pill');if(p)p.textContent='v105'});
    return r;
  };

  productLanding();
})();
/* ===== /v105 ===== */

/* ===== v106: centered landing actions + settings fixed bottom navigation ===== */
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .v106-landing-card{
      position:relative!important;
      min-height:calc(100dvh - 250px)!important;
      padding:18px 14px 82px!important;
      display:flex!important;
      flex-direction:column!important;
      justify-content:center!important;
    }
    .v106-main-actions{
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      gap:12px!important;
      width:100%!important;
      transform:translateY(4vh);
    }
    .v106-main-actions .action{
      min-height:148px!important;
      padding:18px 10px!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      text-align:center!important;
      width:100%!important;
    }
    .v106-main-actions .action b{font-size:25px!important;line-height:1.18!important;display:block!important}
    .v106-main-actions .v106-icon{display:block;font-size:30px;line-height:1;margin-bottom:8px}
    .v106-version{position:absolute;right:18px;top:16px;font-size:12px;font-weight:700;background:#e8eef6;padding:4px 8px;border-radius:999px;color:#12304f}
    #v106Gear{position:absolute;right:18px;bottom:16px;width:56px;height:56px;border:1px solid #d5dee8;border-radius:18px;background:#edf2f7;color:#12304f;font-size:29px;line-height:1;box-shadow:0 4px 12px rgba(16,42,67,.10)}

    .v106-settings-spacer{min-height:calc(100dvh - 210px)}
    .v106-settings-nav{
      position:fixed!important;
      left:0!important;right:0!important;bottom:0!important;
      z-index:5000!important;
      display:grid!important;
      grid-template-columns:repeat(4,1fr)!important;
      gap:0!important;
      background:#123765!important;
      padding:12px 10px calc(12px + env(safe-area-inset-bottom))!important;
      box-shadow:0 -8px 24px rgba(15,42,72,.18)!important;
    }
    .v106-settings-nav button{
      appearance:none!important;border:0!important;background:transparent!important;color:white!important;
      min-height:72px!important;font-size:31px!important;font-weight:800!important;
      display:flex!important;align-items:center!important;justify-content:center!important;
      border-radius:12px!important;padding:8px 4px!important;
    }
    .v106-settings-nav button:active{background:rgba(255,255,255,.12)!important}
    body.v106-settings-open{padding-bottom:110px!important}
    @media(max-width:520px){
      .v106-landing-card{min-height:calc(100dvh - 230px)!important;padding:14px 12px 78px!important}
      .v106-main-actions{gap:10px!important;transform:translateY(5vh)}
      .v106-main-actions .action{min-height:136px!important;padding:14px 8px!important}
      .v106-main-actions .action b{font-size:23px!important}
      .v106-main-actions .v106-icon{font-size:28px;margin-bottom:7px}
      .v106-settings-nav button{min-height:68px!important;font-size:29px!important}
    }
  `;
  document.head.appendChild(style);

  const previousSettings=globalThis.v73SettingsPage;

  globalThis.v106SettingsPage=function(){
    currentProduct=null;
    setHeader('設定');
    setNavVisible(false);
    document.body.classList.add('v106-settings-open');
    app.innerHTML=`
      <div class="v106-settings-spacer"></div>
      <input id="v106RestoreFile" type="file" accept="application/json,.json" hidden>
      <nav class="v106-settings-nav" aria-label="設定メニュー">
        <button id="v106SettingsHome" aria-label="ホーム" title="ホーム">🏠</button>
        <button id="v106Backup" aria-label="バックアップ" title="バックアップ">💾</button>
        <button id="v106Restore" aria-label="バックアップ復元" title="バックアップ復元">♻️</button>
        <button id="v106Company" aria-label="会社マスター" title="会社マスター">🏢</button>
      </nav>`;

    document.getElementById('v106SettingsHome').onclick=()=>productLanding();
    document.getElementById('v106Backup').onclick=v73BackupAll;
    document.getElementById('v106Restore').onclick=()=>document.getElementById('v106RestoreFile').click();
    document.getElementById('v106RestoreFile').onchange=e=>v73RestoreAll(e.target.files?.[0]);
    document.getElementById('v106Company').onclick=()=>{
      document.body.classList.remove('v106-settings-open');
      companyMasterPage();
      setTimeout(()=>{
        const b=document.getElementById('globalMasterBack');
        if(b){b.textContent='⬅️';b.onclick=globalThis.v106SettingsPage;}
      },0);
    };
  };
  try{globalThis.v73SettingsPage=globalThis.v106SettingsPage;}catch(_e){}

  productLanding=function(){
    document.body.classList.remove('v106-settings-open');
    currentProduct=null;
    setHeader('昆布在庫管理');
    setNavVisible(false);
    app.innerHTML=`
      <section class="card v106-landing-card">
        <span class="v106-version">v106</span>
        <div class="v106-main-actions">
          <button class="action orange" id="v106Inventory" aria-label="在庫管理">
            <b><span class="v106-icon">📊</span>在庫<br>管理</b>
          </button>
          <button class="action blue" id="v106Shipment" aria-label="出荷依頼">
            <b><span class="v106-icon">📦</span>出荷<br>依頼</b>
          </button>
        </div>
        <button id="v106Gear" aria-label="設定" title="設定">⚙️</button>
      </section>`;
    document.getElementById('v106Inventory').onclick=()=>productChoicePage('inventory');
    document.getElementById('v106Shipment').onclick=()=>productChoicePage('shipment');
    document.getElementById('v106Gear').onclick=globalThis.v106SettingsPage;
  };

  // 既存の各画面からホームへ戻った際も設定用bodyクラスを残さない。
  const oldChoice=globalThis.productChoicePage;
  if(typeof oldChoice==='function'){
    globalThis.productChoicePage=function(){document.body.classList.remove('v106-settings-open');return oldChoice.apply(this,arguments)};
  }

  productLanding();
})();
/* ===== /v106 ===== */


/* ===== v107: landing fixed bottom settings nav + darker action cards ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    .v107-landing-card{padding-bottom:94px!important}
    .v107-landing-card .v106-main-actions .action{
      background:#e8eef5!important;
      border-color:#d4dee9!important;
    }
    .v107-landing-card .v106-main-actions .action.orange{border-left-color:#e89018!important}
    .v107-landing-card .v106-main-actions .action.blue{border-left-color:#2f67c9!important}
    #v107LandingNav{
      position:fixed!important;left:0!important;right:0!important;bottom:0!important;z-index:10020!important;
      background:#173661!important;display:grid!important;grid-template-columns:repeat(4,1fr)!important;
      gap:0!important;padding:9px 10px calc(9px + env(safe-area-inset-bottom))!important;
      box-shadow:0 -3px 14px rgba(16,42,67,.18)!important;border-radius:0!important;
    }
    #v107LandingNav button{
      appearance:none!important;border:0!important;background:transparent!important;color:#fff!important;
      min-height:58px!important;padding:5px 2px!important;font-size:28px!important;line-height:1!important;
      display:flex!important;align-items:center!important;justify-content:center!important;border-radius:0!important;box-shadow:none!important;
    }
    #v107LandingNav button:active{background:rgba(255,255,255,.12)!important}
    body.v107-landing-open main{padding-bottom:calc(78px + env(safe-area-inset-bottom))!important}
    @media(max-width:520px){
      .v107-landing-card .v106-main-actions .action{background:#e6edf4!important}
      #v107LandingNav button{min-height:54px!important;font-size:27px!important}
    }
  `;
  document.head.appendChild(css);

  function renderLandingNav(){
    document.body.classList.add('v107-landing-open');
    document.getElementById('v107LandingNav')?.remove();
    let restore=document.getElementById('v107RestoreFile');
    if(!restore){
      restore=document.createElement('input');
      restore.id='v107RestoreFile'; restore.type='file'; restore.accept='application/json,.json'; restore.hidden=true;
      document.body.appendChild(restore);
      restore.onchange=e=>{const f=e.target.files?.[0]; if(f)v73RestoreAll(f); e.target.value='';};
    }
    const nav=document.createElement('nav');
    nav.id='v107LandingNav'; nav.setAttribute('aria-label','トップ画面メニュー');
    nav.innerHTML=`
      <button id="v107NavHome" aria-label="ホーム" title="ホーム">🏠</button>
      <button id="v107NavBackup" aria-label="バックアップ" title="バックアップ">💾</button>
      <button id="v107NavRestore" aria-label="バックアップ復元" title="バックアップ復元">♻️</button>
      <button id="v107NavCompany" aria-label="会社マスター" title="会社マスター">🏢</button>`;
    document.body.appendChild(nav);
    nav.querySelector('#v107NavHome').onclick=()=>productLanding();
    nav.querySelector('#v107NavBackup').onclick=v73BackupAll;
    nav.querySelector('#v107NavRestore').onclick=()=>restore.click();
    nav.querySelector('#v107NavCompany').onclick=()=>{document.body.classList.remove('v107-landing-open');nav.remove();companyMasterPage();};
  }

  const baseLanding=productLanding;
  productLanding=function(){
    const r=baseLanding.apply(this,arguments);
    document.body.classList.remove('v106-settings-open');
    const card=app.querySelector('.v106-landing-card');
    if(card){
      card.classList.add('v107-landing-card');
      card.querySelector('#v106Gear')?.remove();
      const ver=card.querySelector('.v106-version');if(ver)ver.textContent='v107';
    }
    renderLandingNav();
    return r;
  };

  const oldChoice=productChoicePage;
  productChoicePage=function(){
    document.body.classList.remove('v107-landing-open');
    document.getElementById('v107LandingNav')?.remove();
    return oldChoice.apply(this,arguments);
  };
  productLanding();
})();
/* ===== /v107 ===== */

/* ===== v108: navy landing action buttons ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    .v107-landing-card .v106-main-actions .action,
    .v107-landing-card .v106-main-actions .action.orange,
    .v107-landing-card .v106-main-actions .action.blue{
      background:#173661!important;
      border-color:#173661!important;
      border-left-color:#173661!important;
      color:#fff!important;
    }
    .v107-landing-card .v106-main-actions .action b{color:#fff!important}
    @media(max-width:520px){
      .v107-landing-card .v106-main-actions .action{background:#173661!important}
    }
  `;
  document.head.appendChild(css);
  const oldLanding=productLanding;
  productLanding=function(){
    const r=oldLanding.apply(this,arguments);
    const ver=app.querySelector('.v106-version');if(ver)ver.textContent='v108';
    return r;
  };
  productLanding();
})();
/* ===== /v108 ===== */

/* ===== v109: inventory home remove 出庫登録・その他 middle buttons ===== */
(function(){
  function v109TidyInventoryHome(){
    const vp=app&&app.querySelector('.v92-viewport.v92-home');
    if(!vp)return;
    // 釧路: b / moreHome, 日高: ho / hm, 根室・釧棹: no / nm
    ['b','moreHome','ho','hm','no','nm'].forEach(id=>{
      const el=document.getElementById(id);
      if(el && el.closest('section.grid')) el.remove();
    });
    const grid=vp.closest('section.card')?.nextElementSibling;
    if(grid && grid.matches('section.grid') && grid.children.length===0) grid.remove();
  }

  ['home','hHome','nHome','smHome'].forEach(name=>{
    const old=globalThis[name];
    if(typeof old!=='function')return;
    globalThis[name]=function(){
      const r=old.apply(this,arguments);
      requestAnimationFrame(v109TidyInventoryHome);
      return r;
    };
  });

  const mo=null; /* v122 perf: obsolete v109 observer disabled */

  ['productLanding','productChoicePage'].forEach(name=>{
    const fn=globalThis[name];
    if(typeof fn!=='function')return;
    globalThis[name]=function(){
      const r=fn.apply(this,arguments);
      const pill=app.querySelector('.pill');if(pill)pill.textContent='v109';
      return r;
    };
  });
})();
/* ===== /v109 ===== */

/* ===== v110: inventory choice compact middle layout ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    body.v110-inventory-choice{padding-bottom:118px!important}
    .v110-choice-card{min-height:calc(100vh - 360px);display:flex;flex-direction:column;justify-content:center;padding:28px 34px!important}
    .v110-choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .v110-choice-btn{background:#173661!important;color:#fff!important;border:0!important;border-left:0!important;border-radius:18px!important;min-height:88px;padding:12px 8px!important;display:flex!important;align-items:center;justify-content:center;text-align:center}
    .v110-choice-btn b{color:#fff!important;font-size:23px!important;line-height:1.15}
    .v110-bulk{margin-top:18px!important;min-height:54px;font-size:16px!important}
    .v110-home-nav{position:fixed;left:0;right:0;bottom:0;z-index:9998;background:#173661;padding:12px 18px calc(12px + env(safe-area-inset-bottom));display:flex;justify-content:center;box-shadow:0 -8px 22px rgba(23,54,97,.12)}
    .v110-home-nav button{appearance:none;border:0;background:transparent;color:#fff;font-size:34px;line-height:1;padding:8px 34px;min-width:110px}
    @media(max-width:520px){.v110-choice-card{margin-top:22px!important;min-height:58vh;padding:24px 34px!important}.v110-choice-grid{gap:12px}.v110-choice-btn{min-height:82px}.v110-choice-btn b{font-size:22px!important}}
  `;
  document.head.appendChild(css);
  const oldChoice=productChoicePage;
  productChoicePage=function(mode){
    if(mode!=='inventory') return oldChoice.apply(this,arguments);
    currentProduct=null;setHeader('在庫管理');setNavVisible(false);
    document.body.classList.add('v110-inventory-choice');
    document.getElementById('v110HomeNav')?.remove();
    app.innerHTML=`<section class="card v110-choice-card"><div class="v110-choice-grid"><button class="action v110-choice-btn" id="v110K"><b>釧路</b></button><button class="action v110-choice-btn" id="v110H"><b>日高</b></button><button class="action v110-choice-btn" id="v110N"><b>根室</b></button><button class="action v110-choice-btn" id="v110S"><b>釧棹</b></button></div><button class="btn v110-bulk" id="v42BulkPdfBtn">📄 PDFから4種類を一括入庫</button><input id="v42BulkPdfFile" type="file" accept="application/pdf,.pdf" hidden></section>`;
    const nav=document.createElement('div');nav.id='v110HomeNav';nav.className='v110-home-nav';nav.innerHTML='<button id="v110HomeBtn" aria-label="ホーム">🏠</button>';document.body.appendChild(nav);
    v110K.onclick=()=>openProductContext('kushiro','inventory');v110H.onclick=()=>openProductContext('hidaka','inventory');v110N.onclick=()=>openProductContext('nemuro','inventory');v110S.onclick=()=>openProductContext('sanmae','inventory');
    v42BulkPdfBtn.onclick=()=>v42BulkPdfFile.click();v42BulkPdfFile.onchange=()=>{const f=v42BulkPdfFile.files?.[0];if(f)v42BulkPdfImport(f)};
    v110HomeBtn.onclick=productLanding;
  };
  ['productLanding','home','hHome','nHome','smHome'].forEach(name=>{const old=globalThis[name];if(typeof old!=='function')return;globalThis[name]=function(){document.body.classList.remove('v110-inventory-choice');document.getElementById('v110HomeNav')?.remove();return old.apply(this,arguments)}});
  const oldLanding=productLanding;productLanding=function(){const r=oldLanding.apply(this,arguments);const ver=app.querySelector('.v106-version,.pill');if(ver)ver.textContent='v110';return r};
})();
/* ===== /v110 ===== */

/* ===== v111: inventory screens use the standard compact bottom nav ===== */
(function(){
  function clearLandingSettingsNav(){
    document.body.classList.remove('v107-landing-open','v106-settings-open');
    document.getElementById('v107LandingNav')?.remove();
    document.querySelector('.v106-settings-nav')?.remove();
  }
  const oldOpen=globalThis.openProductContext;
  if(typeof oldOpen==='function'){
    globalThis.openProductContext=function(product,mode){
      clearLandingSettingsNav();
      const r=oldOpen.apply(this,arguments);
      if(mode==='inventory'){
        setNavVisible(true); bindNav();
      }
      return r;
    };
  }
  ['home','hHome','nHome','smHome'].forEach(name=>{
    const old=globalThis[name]; if(typeof old!=='function')return;
    globalThis[name]=function(){
      clearLandingSettingsNav();
      const r=old.apply(this,arguments);
      setNavVisible(true); bindNav();
      return r;
    };
  });
  const oldChoice=globalThis.productChoicePage;
  if(typeof oldChoice==='function'){
    globalThis.productChoicePage=function(mode){
      clearLandingSettingsNav();
      return oldChoice.apply(this,arguments);
    };
  }
  const oldLanding=globalThis.productLanding;
  if(typeof oldLanding==='function'){
    globalThis.productLanding=function(){
      const r=oldLanding.apply(this,arguments);
      const ver=app.querySelector('.v106-version,.pill'); if(ver)ver.textContent='v111';
      return r;
    };
  }
})();
/* ===== /v111 ===== */

/* ===== v112: confirmed shipment lines appear in in/out history ===== */
function v112ShipmentHistoryRowsKushiro(){
  const rows=[];
  for(const s of (Array.isArray(state.shipments)?state.shipments:[])){
    if(s.status!=='confirmed') continue;
    for(const l of (Array.isArray(s.lines)?s.lines:[])) rows.push({
      _shipment:true,id:`ship:${s.id}:${rows.length}`,shipmentId:s.id,type:'out',
      year:l.year||DEFAULT_YEAR,coop:l.coop||'',season:l.season||'',group:l.group||'',item:l.item||'',
      qty:Number(l.qty||0),date:s.shipDate||today(),memo:`出荷指示 ${s.id} / ${shipmentDest(s).name||''}`
    });
  }
  return rows;
}
function v112ShipmentHistoryRowsHidaka(){
  const rows=[];
  for(const s of (Array.isArray(hState.shipments)?hState.shipments:[])){
    if(s.status!=='confirmed') continue;
    for(const l of (Array.isArray(s.lines)?s.lines:[])) rows.push({
      _shipment:true,id:`ship:${s.id}:${rows.length}`,shipmentId:s.id,type:'out',year:l.year||H_DEFAULT_YEAR,
      location:l.location||'',section:l.section||'',grade:l.grade||'',qty:Number(l.qty||0),date:s.shipDate||today(),memo:`出荷指示 ${s.id}`
    });
  }
  return rows;
}
function v112ShipmentHistoryRowsNemuro(){
  const rows=[];
  for(const s of (Array.isArray(nState.shipments)?nState.shipments:[])){
    if(s.status!=='confirmed') continue;
    for(const l of (Array.isArray(s.lines)?s.lines:[])) rows.push({
      _shipment:true,id:`ship:${s.id}:${rows.length}`,shipmentId:s.id,type:'out',year:l.year||N_DEFAULT_YEAR,
      coop:l.coop||'',season:l.season||'',group:l.group||'',item:l.item||'',qty:Number(l.qty||0),date:s.shipDate||today(),memo:`出荷指示 ${s.id}`
    });
  }
  return rows;
}
function v112ShipmentHistoryRowsSanmae(){
  const rows=[];
  for(const s of (Array.isArray(smState.shipments)?smState.shipments:[])){
    if(s.status!=='confirmed') continue;
    for(const l of (Array.isArray(s.lines)?s.lines:[])) rows.push({
      _shipment:true,id:`ship:${s.id}:${rows.length}`,shipmentId:s.id,type:'out',year:l.year||SM_DEFAULT_YEAR,
      coop:l.coop||'',season:l.season||'',group:l.group||'',item:l.item||'',qty:Number(l.qty||0),date:s.shipDate||today(),memo:`出荷指示 ${s.id}`
    });
  }
  return rows;
}

logs=function(){
  const arr=[...state.records,...v112ShipmentHistoryRowsKushiro()].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  app.innerHTML=`<section class="card"><h2>入出庫履歴</h2><input class="search" id="search" placeholder="年度・漁協・季節・分類・備考を検索"><div class="tablewrap"><table style="min-width:1100px"><tr><th>日付</th><th>区分</th><th>生産年度</th><th>漁協</th><th>季節</th><th>大分類</th><th>細分類</th><th>数量</th><th>備考</th><th>操作</th></tr><tbody id="tb"></tbody></table></div><button class="btn secondary" id="x" style="margin-top:10px">ホームへ戻る</button></section>`;
  const render=()=>{const t=search.value.trim().toLowerCase();tb.innerHTML=arr.filter(r=>[r.date,r.type==='in'?'入庫':'出庫',r.year||DEFAULT_YEAR,r.coop,r.season,r.group,r.item,r.memo].join(' ').toLowerCase().includes(t)).map(r=>`<tr><td>${esc(r.date)}</td><td>${r.type==='in'?'入庫':(r._shipment?'出庫（出荷指示）':'出庫')}</td><td>${esc(r.year||DEFAULT_YEAR)}年産</td><td>${esc(r.coop)}</td><td>${esc(r.season)}</td><td>${esc(r.group)}</td><td>${esc(r.item)}</td><td>${fmt(r.qty)}</td><td>${esc(r.memo||'')}</td><td>${r._shipment?`<button class="mini" data-shipopen="${esc(r.shipmentId)}">出荷指示を開く</button>`:`<div class="record-actions"><button class="mini" data-edit="${r.id}">修正</button><button class="mini danger" data-del="${r.id}">削除</button></div>`}</td></tr>`).join('')||'<tr><td colspan="10" class="empty">履歴はありません</td></tr>'};
  render();search.oninput=render;tb.onclick=e=>{const ed=e.target.dataset.edit,del=e.target.dataset.del,so=e.target.dataset.shipopen;if(so)return shipmentDetail(so);if(ed)form(null,ed);if(del&&confirm('この入出庫を削除しますか？')){state.records=state.records.filter(r=>r.id!==del);save();logs()}};x.onclick=home;
};

hLogs=function(){
  const a=[...hState.records,...v112ShipmentHistoryRowsHidaka()].sort((x,y)=>String(y.date||'').localeCompare(String(x.date||'')));
  app.innerHTML=`<section class="card"><h2>日高昆布 入出庫履歴</h2><div class="tablewrap"><table style="min-width:960px"><tr><th>日付</th><th>区分</th><th>年度</th><th>産地</th><th>区分</th><th>等級</th><th>数量</th><th>備考</th><th>操作</th></tr>${a.map(r=>`<tr><td>${esc(r.date||'')}</td><td>${r.type==='in'?'入庫':(r._shipment?'出庫（出荷指示）':'出庫')}</td><td>${esc(r.year||'')}</td><td>${esc(r.location||'')}</td><td>${esc(r.section||'')}</td><td>${esc(r.grade||'')}</td><td>${fmt(r.qty)}</td><td>${esc(r.memo||'')}</td><td>${r._shipment?`<button class="mini" data-hso="${esc(r.shipmentId)}">出荷指示を開く</button>`:`<button class="mini" data-he="${r.id}">修正</button> <button class="mini danger" data-hd="${r.id}">削除</button>`}</td></tr>`).join('')}</table></div><button class="btn secondary" id="hlb">戻る</button></section>`;
  app.querySelectorAll('[data-he]').forEach(b=>b.onclick=()=>hForm(null,b.dataset.he));app.querySelectorAll('[data-hd]').forEach(b=>b.onclick=()=>{if(confirm('削除しますか？')){hState.records=hState.records.filter(r=>r.id!==b.dataset.hd);hSave();hLogs()}});app.querySelectorAll('[data-hso]').forEach(b=>b.onclick=()=>hShipDetail(b.dataset.hso));hlb.onclick=hHome;
};

nLogs=function(){
  const a=[...nState.records,...v112ShipmentHistoryRowsNemuro()].sort((x,y)=>String(y.date||'').localeCompare(String(x.date||'')));
  app.innerHTML=`<section class="card"><h2>根室産昆布 入出庫履歴</h2><div class="tablewrap"><table style="min-width:1020px"><tr><th>日付</th><th>区分</th><th>年度</th><th>漁協</th><th>季節</th><th>分類</th><th>細分類</th><th>数量</th><th>備考</th><th>操作</th></tr>${a.map(r=>`<tr><td>${esc(r.date||'')}</td><td>${r.type==='in'?'入庫':(r._shipment?'出庫（出荷指示）':'出庫')}</td><td>${esc(r.year||'')}</td><td>${esc(r.coop||'')}</td><td>${esc(r.season||'')}</td><td>${esc(r.group||'')}</td><td>${esc(r.item||'')}</td><td>${fmt(r.qty)}</td><td>${esc(r.memo||'')}</td><td>${r._shipment?`<button class="mini" data-nso="${esc(r.shipmentId)}">出荷指示を開く</button>`:`<button class="mini" data-ne="${r.id}">修正</button> <button class="mini danger" data-nd="${r.id}">削除</button>`}</td></tr>`).join('')}</table></div><button class="btn secondary" id="nlb">戻る</button></section>`;
  app.querySelectorAll('[data-ne]').forEach(b=>b.onclick=()=>nForm(null,b.dataset.ne));app.querySelectorAll('[data-nd]').forEach(b=>b.onclick=()=>{if(confirm('削除しますか？')){nState.records=nState.records.filter(r=>r.id!==b.dataset.nd);nSave();nLogs()}});app.querySelectorAll('[data-nso]').forEach(b=>b.onclick=()=>nShipDetail(b.dataset.nso));nlb.onclick=nHome;
};

smLogs=function(){
  const a=[...smState.records,...v112ShipmentHistoryRowsSanmae()].sort((x,y)=>String(y.date||'').localeCompare(String(x.date||'')));
  app.innerHTML=`<section class="card"><h2>釧路産棹前昆布 入出庫履歴</h2><div class="tablewrap"><table style="min-width:1020px"><tr><th>日付</th><th>区分</th><th>年度</th><th>漁協</th><th>季節</th><th>分類</th><th>細分類</th><th>数量</th><th>備考</th><th>操作</th></tr>${a.map(r=>`<tr><td>${esc(r.date||'')}</td><td>${r.type==='in'?'入庫':(r._shipment?'出庫（出荷指示）':'出庫')}</td><td>${esc(r.year||'')}</td><td>${esc(r.coop||'')}</td><td>${esc(r.season||'')}</td><td>${esc(r.group||'')}</td><td>${esc(r.item||'')}</td><td>${fmt(r.qty)}</td><td>${esc(r.memo||'')}</td><td>${r._shipment?`<button class="mini" data-smso="${esc(r.shipmentId)}">出荷指示を開く</button>`:`<button class="mini" data-ne="${r.id}">修正</button> <button class="mini danger" data-nd="${r.id}">削除</button>`}</td></tr>`).join('')}</table></div><button class="btn secondary" id="nlb">戻る</button></section>`;
  app.querySelectorAll('[data-ne]').forEach(b=>b.onclick=()=>smForm(null,b.dataset.ne));app.querySelectorAll('[data-nd]').forEach(b=>b.onclick=()=>{if(confirm('削除しますか？')){smState.records=smState.records.filter(r=>r.id!==b.dataset.nd);smSave();smLogs()}});app.querySelectorAll('[data-smso]').forEach(b=>b.onclick=()=>smShipDetail(b.dataset.smso));nlb.onclick=smHome;
};

/* version badge */
(function(){
  const oldLanding=productLanding;
  productLanding=function(){const r=oldLanding.apply(this,arguments);const p=app.querySelector('.pill');if(p)p.textContent='v112';return r;};
})();
/* ===== /v112 ===== */


/* ===== v113 新規出荷指示レイアウト統一 ===== */
(function(){
  const st=document.createElement('style');
  st.textContent=`
    .v113-ship-form{padding:16px!important}
    .v113-date-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
    .v113-party-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
    .v113-darkbox{background:#123665;border-radius:16px;padding:12px;color:#fff}
    .v113-darkbox h3{margin:0 0 8px;font-size:17px;color:#fff}
    .v113-darkbox label{color:#fff;font-weight:700;font-size:13px}
    .v113-darkbox input,.v113-darkbox select{background:#fff!important;color:#102a43!important;border:1px solid #d4dde8!important;border-radius:9px!important;padding:8px!important}
    .v113-lines-wrap{background:#123665;border-radius:16px;padding:12px;color:#fff;margin-top:12px}
    .v113-lines-wrap>.v113-lines-title{font-size:17px;font-weight:800;margin:0 0 8px}
    .v113-line{background:#123665!important;border:1px solid rgba(255,255,255,.25)!important;color:#fff!important;padding:10px!important;margin:8px 0!important;border-radius:12px!important}
    .v113-line label{color:#fff;font-weight:700;font-size:12.5px}
    .v113-line input,.v113-line select{background:#fff!important;color:#102a43!important;border:1px solid #d4dde8!important;border-radius:8px!important;padding:7px!important}
    .v113-line .mini.danger{background:#fff!important;color:#b42318!important;border:none!important}
    .v113-empty{color:#dce8f6;padding:10px 4px;text-align:center}
    .v113-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .v113-actions .btn{flex:1;min-width:120px}
    @media(max-width:520px){
      .v113-party-row{grid-template-columns:1fr 1fr;gap:7px}
      .v113-darkbox{padding:9px}
      .v113-darkbox h3{font-size:15px}
      .v113-darkbox label{font-size:11.5px}
      .v113-darkbox input{font-size:13px;padding:7px!important}
      .v113-date-row label{font-size:13px}
      .v113-date-row input{font-size:13px}
      .v113-line label{font-size:11.5px}
      .v113-line input,.v113-line select{font-size:12.5px}
    }
  `;document.head.appendChild(st);

  function partiesHTML(src,dst,p){
    return `<div class="v113-party-row">
      <div class="v113-darkbox"><h3>出荷元</h3>
        <label>会社名<input id="${p}src" value="${esc(src?.name||'㈱浜中運輸')}"></label>
        <label>住所<input id="${p}srca" value="${esc(src?.address||'')}"></label>
        <label>電話<input id="${p}srcp" value="${esc(src?.phone||'')}"></label>
      </div>
      <div class="v113-darkbox"><h3>出荷先</h3>
        <label>会社名<input id="${p}dst" value="${esc(dst?.name||'')}"></label>
        <label>住所<input id="${p}dsta" value="${esc(dst?.address||'')}"></label>
        <label>電話<input id="${p}dstp" value="${esc(dst?.phone||'')}"></label>
      </div>
    </div>`;
  }

  // 釧路産昆布
  shipmentForm=function(id=null){
    const s=id?state.shipments.find(x=>x.id===id):null;if(s&&s.status==='shipped')return shipmentDetail(id);
    let lines=s?.lines?.length?s.lines.map(x=>({...x})):[];const src=shipmentSource(s),dst=shipmentDest(s);
    app.innerHTML=`<section class="card v113-ship-form"><h2>📦 ${s?'出荷指示修正':'新規出荷指示'}</h2><div class="form"><datalist id="companyNames">${companyDatalist()}</datalist>
      <div class="v113-date-row"><label>出荷日<input id="shipDate" type="date" value="${s?.shipDate||today()}"></label><label>着希望日<input id="arrivalDate" type="date" value="${s?.arrivalDate||''}"></label></div>
      <div class="v113-party-row"><div class="v113-darkbox"><h3>出荷元</h3><label>会社名<input id="sourceName" list="companyNames" value="${esc(src.name)}"></label><label>住所<input id="sourceAddress" value="${esc(src.address)}"></label><label>電話<input id="sourcePhone" value="${esc(src.phone)}"></label></div><div class="v113-darkbox"><h3>出荷先</h3><label>会社名<input id="destName" list="companyNames" value="${esc(dst.name)}"></label><label>住所<input id="destAddress" value="${esc(dst.address)}"></label><label>電話<input id="destPhone" value="${esc(dst.phone)}"></label></div></div>
      <label>備考<input id="shipMemo" value="${esc(s?.memo||'')}" placeholder="配送・梱包等の指示"></label>
      <div class="v113-lines-wrap"><div class="v113-lines-title">明細</div><div id="shipLines"></div><button class="btn secondary" id="addLine">＋ 明細追加</button></div>
      <div class="v113-actions"><button class="btn" id="saveDraft">下書き保存</button><button class="btn secondary" id="backShip">戻る</button></div></div></section>`;
    const fillCompany=(n,a,p)=>{const c=companyByName(n.value);if(c){a.value=c.address||'';p.value=c.phone||''}};sourceName.onchange=()=>fillCompany(sourceName,sourceAddress,sourcePhone);destName.onchange=()=>fillCompany(destName,destAddress,destPhone);
    function renderLines(){shipLines.innerHTML=lines.map((l,i)=>`<div class="v113-line"><div class="row"><b>明細 ${i+1}</b><button class="mini danger" data-del-line="${i}">削除</button></div><div class="form"><div class="subgrid"><label>生産年度<select data-f="year" data-i="${i}">${yearOptions(l.year||state.activeYear)}</select></label><label>漁協<select data-f="coop" data-i="${i}">${state.coops.map(c=>`<option ${c===l.coop?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>季節<select data-f="season" data-i="${i}">${SEASONS.map(x=>`<option ${x===(l.season||'夏')?'selected':''}>${x}</option>`).join('')}</select></label></div><label>大分類・細分類<select data-f="gi" data-i="${i}">${itemOptions(l.group||GROUPS[0].name,l.item||GROUPS[0].items[0])}</select></label><div class="subgrid"><label>数量<input data-f="qty" data-i="${i}" type="number" min="0.01" step="0.01" value="${esc(l.qty||'')}"></label><label>明細備考<input data-f="memo" data-i="${i}" value="${esc(l.memo||'')}"></label></div></div></div>`).join('')||'<div class="v113-empty">明細はまだありません。</div>';shipLines.querySelectorAll('[data-f]').forEach(el=>el.onchange=()=>{const i=+el.dataset.i,f=el.dataset.f;if(f==='gi'){[lines[i].group,lines[i].item]=el.value.split('|')}else lines[i][f]=el.value});shipLines.querySelectorAll('[data-del-line]').forEach(b=>b.onclick=()=>{lines.splice(+b.dataset.delLine,1);renderLines()})}
    addLine.onclick=()=>{lines.push({year:state.activeYear,coop:state.coops[0],season:'夏',group:GROUPS[0].name,item:GROUPS[0].items[0],qty:'',memo:''});renderLines()};
    saveDraft.onclick=()=>{if(!sourceName.value.trim())return alert('出荷元の会社名を入力してください');if(!destName.value.trim())return alert('出荷先の会社名を入力してください');if(!lines.length)return alert('明細を1件以上追加してください');for(const l of lines){const q=Number(l.qty);if(!q||q<=0)return alert('数量を入力してください');const av=stockAvailableForShipment(l.year||DEFAULT_YEAR,l.coop,l.season,l.group,l.item,s?.id);if(q>av)return alert(`${l.year||DEFAULT_YEAR}年産 ${l.coop} ${l.season} ${l.group} ${l.item} の出荷可能在庫は ${fmt(av)} です。`)}const source={name:sourceName.value.trim(),address:sourceAddress.value.trim(),phone:sourcePhone.value.trim()},destInfo={name:destName.value.trim(),address:destAddress.value.trim(),phone:destPhone.value.trim()};upsertCompany(source);upsertCompany(destInfo);const obj=s||{id:shipmentId(),status:'draft',createdAt:new Date().toISOString()};Object.assign(obj,{source,destInfo,dest:destInfo.name,shipDate:shipDate.value,arrivalDate:arrivalDate.value,memo:shipMemo.value,lines,updatedAt:new Date().toISOString()});delete obj.baseYear;if(!s)state.shipments.push(obj);save();alert('出荷指示を保存しました');shipmentDetail(obj.id)};
    backShip.onclick=shipments;renderLines();
  };

  function buildSimpleForm(cfg){
    const {id,stateObj,title,prefix,yearOpts,field1Label,field1Options,field2Label,field2Options,itemLabel,itemOpts,defaultLine,avail,saveFn,listFn,detailFn,shipIdFn}=cfg;
    const s=id?stateObj.shipments.find(x=>x.id===id):null;let lines=s?.lines?.map(x=>({...x}))||[];const src=s?.source||{name:'㈱浜中運輸',address:'',phone:''},dst=s?.dest||{};
    app.innerHTML=`<section class="card v113-ship-form"><h2>${title} ${s?'出荷指示修正':'新規出荷指示'}</h2><div class="form"><div class="v113-date-row"><label>出荷日<input id="${prefix}sd" type="date" value="${s?.shipDate||today()}"></label><label>着希望日<input id="${prefix}ad" type="date" value="${s?.arrivalDate||''}"></label></div>${partiesHTML(src,dst,prefix)}<div class="v113-lines-wrap"><div class="v113-lines-title">明細</div><div id="${prefix}sl"></div><button class="btn secondary" id="${prefix}ala">＋ 明細追加</button></div><div class="v113-actions"><button class="btn" id="${prefix}ssv">保存</button><button class="btn secondary" id="${prefix}sfb">戻る</button></div></div></section>`;
    const sl=document.getElementById(prefix+'sl');
    function rend(){sl.innerHTML=lines.map((l,i)=>`<div class="v113-line"><div class="row"><b>明細 ${i+1}</b><button class="mini danger" data-r="${i}">削除</button></div><label>生産年度<select data-i="${i}" data-f="year">${yearOpts(l.year)}</select></label><label>${field1Label}<select data-i="${i}" data-f="f1">${field1Options(l)}</select></label><label>${field2Label}<select data-i="${i}" data-f="f2">${field2Options(l)}</select></label><label>${itemLabel}<select data-i="${i}" data-f="item">${itemOpts(l)}</select></label><label>数量<input type="number" data-i="${i}" data-f="qty" value="${esc(l.qty||'')}"></label></div>`).join('')||'<div class="v113-empty">明細はまだありません。</div>';sl.querySelectorAll('[data-f]').forEach(e=>e.onchange=()=>{const i=+e.dataset.i,f=e.dataset.f;if(f==='year')lines[i].year=e.value;else cfg.applyField(lines[i],f,e.value)});sl.querySelectorAll('[data-r]').forEach(e=>e.onclick=()=>{lines.splice(+e.dataset.r,1);rend()})}
    document.getElementById(prefix+'ala').onclick=()=>{lines.push(defaultLine());rend()};
    document.getElementById(prefix+'ssv').onclick=()=>{const srcN=document.getElementById(prefix+'src'),dstN=document.getElementById(prefix+'dst');if(!dstN.value.trim()||!lines.length)return alert('出荷先と明細を入力してください。');for(const l of lines){l.qty=Number(l.qty);if(!l.qty||l.qty>avail(l,s?.id))return alert('在庫が不足している明細があります。')}const o=s||{id:shipIdFn(),status:'draft',createdAt:new Date().toISOString()};Object.assign(o,{source:{name:srcN.value,address:document.getElementById(prefix+'srca').value,phone:document.getElementById(prefix+'srcp').value},dest:{name:dstN.value,address:document.getElementById(prefix+'dsta').value,phone:document.getElementById(prefix+'dstp').value},shipDate:document.getElementById(prefix+'sd').value,arrivalDate:document.getElementById(prefix+'ad').value,lines});if(!s)stateObj.shipments.push(o);saveFn();detailFn(o.id)};
    document.getElementById(prefix+'sfb').onclick=listFn;rend();
  }

  hShipForm=function(id=null){buildSimpleForm({id,stateObj:hState,title:'日高昆布',prefix:'h',yearOpts:hYearOptions,field1Label:'産地',field1Options:l=>H_LOCATIONS.map(x=>`<option ${x===l.location?'selected':''}>${x}</option>`).join(''),field2Label:'区分・等級',field2Options:l=>hGradeOptions(l.section,l.grade),itemLabel:'数量区分',itemOpts:l=>'<option>通常</option>',defaultLine:()=>({year:hState.activeYear,location:H_LOCATIONS[0],section:'走り',grade:'1等',qty:''}),applyField:(l,f,v)=>{if(f==='f1')l.location=v;else if(f==='f2')[l.section,l.grade]=v.split('|')},avail:(l,id)=>hAvail(l.year,l.location,l.section,l.grade,id),saveFn:hSave,listFn:hShipments,detailFn:hShipDetail,shipIdFn:hShipId})};
  nShipForm=function(id=null){buildSimpleForm({id,stateObj:nState,title:'根室産昆布',prefix:'n',yearOpts:nYearOptions,field1Label:'漁協',field1Options:l=>N_COOPS.map(x=>`<option ${x===l.coop?'selected':''}>${x}</option>`).join(''),field2Label:'区分',field2Options:l=>N_SEASONS.map(x=>`<option ${x===l.season?'selected':''}>${x}</option>`).join(''),itemLabel:'分類',itemOpts:l=>nItemOptions(l.group,l.item),defaultLine:()=>({year:nState.activeYear,coop:N_COOPS[0],season:'夏',group:N_GROUPS[0].name,item:N_GROUPS[0].items[0],qty:''}),applyField:(l,f,v)=>{if(f==='f1')l.coop=v;else if(f==='f2')l.season=v;else if(f==='item')[l.group,l.item]=v.split('|')},avail:(l,id)=>nAvail(l.year,l.coop,l.season,l.group,l.item,id),saveFn:nSave,listFn:nShipments,detailFn:nShipDetail,shipIdFn:nShipId})};
  smShipForm=function(id=null){buildSimpleForm({id,stateObj:smState,title:'釧路産棹前昆布',prefix:'sm',yearOpts:smYearOptions,field1Label:'漁協',field1Options:l=>S_COOPS.map(x=>`<option ${x===l.coop?'selected':''}>${x}</option>`).join(''),field2Label:'区分',field2Options:l=>S_SEASONS.map(x=>`<option ${x===l.season?'selected':''}>${x}</option>`).join(''),itemLabel:'分類',itemOpts:l=>smItemOptions(l.group,l.item),defaultLine:()=>({year:smState.activeYear,coop:S_COOPS[0],season:'採り',group:S_GROUPS[0].name,item:S_GROUPS[0].items[0],qty:''}),applyField:(l,f,v)=>{if(f==='f1')l.coop=v;else if(f==='f2')l.season=v;else if(f==='item')[l.group,l.item]=v.split('|')},avail:(l,id)=>smAvail(l.year,l.coop,l.season,l.group,l.item,id),saveFn:smSave,listFn:smShipments,detailFn:smShipDetail,shipIdFn:smShipId})};
})();
/* ===== /v113 ===== */


/* ===== v114: unified shipment entry, product selected per line ===== */
(function(){
  const style=document.createElement('style');
  style.textContent=`
    .v114-line-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
    .v114-line-title{font-weight:800;font-size:16px;white-space:nowrap}
    .v114-product-select{background:#fff!important;color:#102a43!important;font-weight:800!important}
    .v114-avail{font-size:11.5px;color:#dce8f6;margin-top:7px;text-align:right}
    .v118-row{display:grid;gap:10px;align-items:end;margin-bottom:9px}
    .v118-row1{grid-template-columns:.72fr 1fr 1fr}
    .v118-row2{grid-template-columns:1fr 1fr 1.22fr}
    .v118-row3{grid-template-columns:1fr 1fr auto}
    .v118-line-no{align-self:center;font-weight:800;font-size:16px;padding-bottom:9px;white-space:nowrap}
    .v118-delete-wrap{display:flex;justify-content:flex-end;align-items:flex-end;height:100%}
    .v118-delete-wrap .mini{min-width:64px;min-height:42px;font-size:13px}
    .v118-row label{margin:0!important}
    @media(max-width:520px){
      .v114-line-title{font-size:14px}
      .v118-row{gap:7px}
      .v118-row1{grid-template-columns:.7fr 1fr 1fr}
      .v118-row2{grid-template-columns:1fr 1fr 1.15fr}
      .v118-row3{grid-template-columns:1fr .55fr auto}
      .v118-line-no{font-size:13.5px;padding-bottom:8px}
      .v118-row label{font-size:11px!important}
      .v118-row select,.v118-row input{font-size:12px!important;padding:7px 5px!important;min-width:0!important}
      .v118-delete-wrap .mini{min-width:58px;min-height:40px;font-size:12px}
    }
  `;
  document.head.appendChild(style);

  const productDefs={
    kushiro:{
      label:'釧路',
      make:()=>({product:'kushiro',year:state.activeYear,coop:state.coops[0],season:'夏',group:GROUPS[0].name,item:GROUPS[0].items[0],qty:'',memo:''}),
      fields:l=>`<div class="subgrid"><label>生産年度<select data-f="year">${yearOptions(l.year||state.activeYear)}</select></label><label>漁協<select data-f="coop">${state.coops.map(c=>`<option ${c===l.coop?'selected':''}>${esc(c)}</option>`).join('')}</select><label>季節<select data-f="season">${SEASONS.map(x=>`<option ${x===(l.season||'夏')?'selected':''}>${x}</option>`).join('')}</select></div><label>大分類・細分類<select data-f="gi">${itemOptions(l.group||GROUPS[0].name,l.item||GROUPS[0].items[0])}</select></label>`,
      apply:(l,f,v)=>{if(f==='gi')[l.group,l.item]=v.split('|');else l[f]=v},
      avail:l=>{
  const inv=window.KombuRefactor?.Inventory;
  return inv?.getAvailableQuantity
    ? inv.getAvailableQuantity('kushiro',{
        year:l.year||DEFAULT_YEAR,
        coop:l.coop,
        season:l.season,
        group:l.group,
        item:l.item
      },null)
    : stockAvailableForShipment(
        l.year||DEFAULT_YEAR,
        l.coop,
        l.season,
        l.group,
        l.item,
        null
      );
},
      desc:l=>`${l.year||DEFAULT_YEAR}年産 ${l.coop} ${l.season} ${l.group} ${l.item}`
    },
    hidaka:{
      label:'日高',
      make:()=>({product:'hidaka',year:hState.activeYear,location:H_LOCATIONS[0],section:'走り',grade:'1等',qty:'',memo:''}),
      fields:l=>`<div class="subgrid"><label>生産年度<select data-f="year">${hYearOptions(l.year||hState.activeYear)}</select></label><label>産地<select data-f="location">${H_LOCATIONS.map(x=>`<option ${x===l.location?'selected':''}>${esc(x)}</option>`).join('')}</select></div><label>区分・等級<select data-f="sg">${hGradeOptions(l.section||'走り',l.grade||'1等')}</select></label>`,
      apply:(l,f,v)=>{if(f==='sg')[l.section,l.grade]=v.split('|');else l[f]=v},
      avail:l=>{
  const inv=window.KombuRefactor?.Inventory;
  return inv?.getHidakaAvailableQuantity
    ? inv.getHidakaAvailableQuantity({
        year:l.year||H_DEFAULT_YEAR,
        location:l.location,
        section:l.section,
        grade:l.grade
      },null)
    : hAvail(
        l.year||H_DEFAULT_YEAR,
        l.location,
        l.section,
        l.grade,
        null
      );
},
      desc:l=>`${l.year||H_DEFAULT_YEAR}年産 ${l.location} ${l.section} ${l.grade}`
    },
    nemuro:{
      label:'根室',
      make:()=>({product:'nemuro',year:nState.activeYear,coop:N_COOPS[0],season:'夏',group:N_GROUPS[0].name,item:N_GROUPS[0].items[0],qty:'',memo:''}),
      fields:l=>`<div class="subgrid"><label>生産年度<select data-f="year">${nYearOptions(l.year||nState.activeYear)}</select></label><label>漁協<select data-f="coop">${N_COOPS.map(x=>`<option ${x===l.coop?'selected':''}>${esc(x)}</option>`).join('')}</select><label>区分<select data-f="season">${N_SEASONS.map(x=>`<option ${x===l.season?'selected':''}>${esc(x)}</option>`).join('')}</select></div><label>分類<select data-f="gi">${nItemOptions(l.group||N_GROUPS[0].name,l.item||N_GROUPS[0].items[0])}</select></label>`,
      apply:(l,f,v)=>{if(f==='gi')[l.group,l.item]=v.split('|');else l[f]=v},
      avail:l=>{
  const inv=window.KombuRefactor?.Inventory;
  return inv?.getAvailableQuantity
    ? inv.getAvailableQuantity('nemuro',{
        year:l.year||N_DEFAULT_YEAR,
        coop:l.coop,
        season:l.season,
        group:l.group,
        item:l.item
      },null)
    : nAvail(
        l.year||N_DEFAULT_YEAR,
        l.coop,
        l.season,
        l.group,
        l.item,
        null
      );
},
      desc:l=>`${l.year||N_DEFAULT_YEAR}年産 ${l.coop} ${l.season} ${l.group} ${l.item}`
    },
    sanmae:{
      label:'釧棹',
      make:()=>({product:'sanmae',year:smState.activeYear,coop:S_COOPS[0],season:'採り',group:S_GROUPS[0].name,item:S_GROUPS[0].items[0],qty:'',memo:''}),
      fields:l=>`<div class="subgrid"><label>生産年度<select data-f="year">${smYearOptions(l.year||smState.activeYear)}</select></label><label>漁協<select data-f="coop">${S_COOPS.map(x=>`<option ${x===l.coop?'selected':''}>${esc(x)}</option>`).join('')}</select><label>区分<select data-f="season">${S_SEASONS.map(x=>`<option ${x===l.season?'selected':''}>${esc(x)}</option>`).join('')}</select></div><label>分類<select data-f="gi">${smItemOptions(l.group||S_GROUPS[0].name,l.item||S_GROUPS[0].items[0])}</select></label>`,
      apply:(l,f,v)=>{if(f==='gi')[l.group,l.item]=v.split('|');else l[f]=v},
      avail:l=>{
  const inv=window.KombuRefactor?.Inventory;
  return inv?.getAvailableQuantity
    ? inv.getAvailableQuantity('sanmae',{
        year:l.year||SM_DEFAULT_YEAR,
        coop:l.coop,
        season:l.season,
        group:l.group,
        item:l.item
      },null)
    : smAvail(
        l.year||SM_DEFAULT_YEAR,
        l.coop,
        l.season,
        l.group,
        l.item,
        null
      );
},
      desc:l=>`${l.year||SM_DEFAULT_YEAR}年産 ${l.coop} ${l.season} ${l.group} ${l.item}`
    }
  };
  const productOptions=p=>Object.entries(productDefs).map(([k,d])=>`<option value="${k}" ${k===p?'selected':''}>${d.label}</option>`).join('');

  function v114UnifiedShipmentForm(editProduct=null,editId=null,preset=null){
    try{screenKind='form';setMode('shipment','form');}catch(_e){}
    currentProduct=null;v80InventoryMode=false;setHeader('出荷依頼');setNavVisible(true);bindNav();
    const editStores={
      kushiro:{find:id=>state.shipments.find(x=>x.id===id),save:()=>save()},
      hidaka:{find:id=>hState.shipments.find(x=>x.id===id),save:()=>hSave()},
      nemuro:{find:id=>nState.shipments.find(x=>x.id===id),save:()=>nSave()},
      sanmae:{find:id=>smState.shipments.find(x=>x.id===id),save:()=>smSave()}
    };
    const editing=!!(editProduct&&editId&&editStores[editProduct]);
    const existing=editing?editStores[editProduct].find(editId):null;
    let lines=existing?.lines?.length?existing.lines.map(x=>({product:editProduct,...x})):[];
    const existingSrc=existing?(existing.source&&typeof existing.source==='object'?existing.source:shipmentSource(existing)):null;
    const existingDst=existing?(existing.destInfo&&typeof existing.destInfo==='object'?existing.destInfo:(existing.dest&&typeof existing.dest==='object'?existing.dest:shipmentDest(existing))):null;
    const source0=existingSrc||{name:'',postal:'',address:'',phone:'',region:'',toyamaRegion:''};
    const dest0=existingDst||{name:'',postal:'',address:'',phone:'',region:'',toyamaRegion:''};
    const companies=Array.isArray(state.companies)?state.companies.filter(c=>c&&String(c.name||'').trim()):[];
    const V229_PAIR_KEY='kombu_company_pairs_v162';
    const v229LoadPairs=()=>{try{const x=JSON.parse(localStorage.getItem(V229_PAIR_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return []}};
    const v229Pairs=v229LoadPairs();
    const v229MainRegions=['北海道・東北','関東','中部東海','北陸','関西','中四国九州'];
    const v229ToyamaRegions=['高岡','呉西その他','富山','呉東その他'];
    const v229RegionOptions=selected=>{
      const v=String(selected||'すべて');
      return ['すべて',...v229MainRegions,...v229ToyamaRegions].map(x=>`<option value="${esc(x)}" ${x===v?'selected':''}>${esc(x)}</option>`).join('');
    };
    const v229Bool=(v,def=true)=>v===undefined||v===null||v===''?def:!(v===false||String(v).toLowerCase()==='false'||String(v)==='いいえ'||String(v)==='0');
    // 会社名照合は全角/半角・空白差を吸収。表示名そのものは変更しない。
    const v229NormName=v=>String(v||'').normalize('NFKC').replace(/[\s　]+/g,'').trim();
    const v229NormRegion=v=>String(v||'').normalize('NFKC').replace(/[\s　]+/g,'').trim();
    const v229FindCompanyByName=name=>{
      const key=v229NormName(name);
      return companies.find(c=>v229NormName(c?.name)===key)||null;
    };
    const v229FindCompanyForPair=p=>{
      const code=String(p?.destCode||'').trim();
      if(code){const byCode=companies.find(c=>String(c?.code||'').trim()===code);if(byCode)return byCode;}
      return v229FindCompanyByName(p?.dest||'');
    };
    const v229MatchRegion=(c,region)=>{
      const target=v229NormRegion(region);
      if(!target||target===v229NormRegion('すべて'))return true;
      if(v229ToyamaRegions.some(x=>v229NormRegion(x)===target))return v229NormRegion(c?.toyamaRegion||c?.toyama_region||'')===target;
      return v229NormRegion(c?.region||'')===target;
    };
    // 会社マスターに登録されている有効会社は、出荷人・出荷先どちらでも選択可能。
    // Excelの「出荷人として使用/出荷先として使用」は候補を消す条件にはしない。
    const v229CompanyPool=(_type,region='すべて')=>companies.filter(c=>c?.active!==false&&v229MatchRegion(c,region));
    const v229SortCompanies=a=>a.slice().sort((x,y)=>{
      const xf=x?.favorite===true||x?.favorite==='はい'?0:1;
      const yf=y?.favorite===true||y?.favorite==='はい'?0:1;
      if(xf!==yf)return xf-yf;
      return Number(x?.sortOrder||999999)-Number(y?.sortOrder||999999);
    });
    const v229SourceOptions=(selected,region='すべて')=>{
      const selectedKey=v229NormName(selected);
      const pool=v229SortCompanies(v229CompanyPool('source',region));
      return `<option value="">直接入力</option>`+pool.map(c=>{const n=String(c.name||'').trim();return `<option value="${esc(n)}" ${v229NormName(n)===selectedKey?'selected':''}>${esc(n)}</option>`}).join('');
    };
    const v229FavoriteFlag=(c,type)=>type==='source'?(c?.favoriteSource===true||c?.favoriteSource==='はい'||((c?.favoriteSource===undefined||c?.favoriteSource===null)&&(c?.favorite===true||c?.favorite==='はい'))):(c?.favoriteDestination===true||c?.favoriteDestination==='はい'||((c?.favoriteDestination===undefined||c?.favoriteDestination===null)&&(c?.favorite===true||c?.favorite==='はい')));
    const v229FavoriteOptions=(type,selected='')=>{
      const selectedKey=v229NormName(selected);
      const pool=v229SortCompanies(companies.filter(c=>c?.active!==false&&v229FavoriteFlag(c,type)));
      return `<option value="">選択してください</option>`+pool.map(c=>{const n=String(c?.name||'').trim();return `<option value="${esc(n)}" ${v229NormName(n)===selectedKey?'selected':''}>${esc(n)}</option>`}).join('');
    };
    const v229DestOptions=(selected,region='すべて',sourceName='')=>{
      const selectedKey=v229NormName(selected);
      const targetRegion=String(region||'すべて');
      const area=v229SortCompanies(v229CompanyPool('destination',targetRegion));
      const sourceCompany=v229FindCompanyByName(sourceName);
      const sourceCode=String(sourceCompany?.code||'').trim();
      const sourceKey=v229NormName(sourceName);
      const pairRows=v229Pairs.filter(p=>{
        const pCode=String(p?.sourceCode||'').trim();
        if(sourceCode&&pCode&&sourceCode===pCode)return true;
        return v229NormName(p?.source||'')===sourceKey;
      }).sort((a,b)=>{
        const af=a?.favorite===true||a?.favorite==='はい'?0:1;
        const bf=b?.favorite===true||b?.favorite==='はい'?0:1;
        if(af!==bf)return af-bf;
        return Number(a?.sortOrder||999999)-Number(b?.sortOrder||999999);
      });
      const seen=new Set();
      const priority=[];
      pairRows.forEach(p=>{
        const c=v229FindCompanyForPair(p);
        const key=v229NormName(c?.name||'');
        if(c&&c?.active!==false&&v229MatchRegion(c,targetRegion)&&key&&!seen.has(key)){seen.add(key);priority.push(c)}
      });
      const opt=c=>{const n=String(c?.name||'').trim();return `<option value="${esc(n)}" ${v229NormName(n)===selectedKey?'selected':''}>${esc(n)}</option>`};
      let html=`<option value="">直接入力</option>`;
      if(priority.length)html+=`<optgroup label="この出荷人でよく使う出荷先（${priority.length}件）">${priority.map(opt).join('')}</optgroup>`;
      if(targetRegion!=='すべて'){
        if(area.length)html+=`<optgroup label="地区から探す：${esc(targetRegion)}（${area.length}件）">${area.map(opt).join('')}</optgroup>`;
      }else if(area.length){
        html+=`<optgroup label="すべての会社から探す（${area.length}件）">${area.map(opt).join('')}</optgroup>`;
      }
      return html;
    };

    app.innerHTML=`<style>
      .v161-step2{max-width:1180px;margin:0 auto}
      .v161-step2 .v161-s{margin-top:12px}
      .v161-step2 .v161-title{margin:0 0 12px;font-size:18px;font-weight:900}
      .v161-step2 .v161-basic{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .v161-step2 .v161-box{background:#173f73;color:#fff;border-radius:16px;padding:14px}
      .v161-step2 .v161-box label{font-weight:800}
      .v161-step2 .v161-box input,.v161-step2 .v161-box select{width:100%;margin-top:6px;padding:12px;border:1px solid #ccd6e2;border-radius:10px;background:#fff;color:#102a43;font-size:16px}
      .v161-step2 .v161-party{display:grid;grid-template-columns:minmax(250px,.8fr) 1.2fr;gap:14px}
      .v161-step2 .v161-details{background:#f8fafc;border:1px solid #dbe4ee;border-radius:14px;padding:12px}
      .v161-step2 .v161-details label{display:block;margin-bottom:10px;font-weight:800}
      .v161-step2 .v161-details input{width:100%;margin-top:5px;padding:10px;border:1px solid #d6dee8;border-radius:9px;background:#fff;color:#102a43;font-size:15px}
      .v161-step2 .v161-headrow{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
      .v161-step2 .v161-total{background:#eef4fb;border-radius:999px;padding:7px 12px;font-weight:900}
      .v161-preview-overlay{position:fixed;inset:0;z-index:50000;background:rgba(13,30,50,.48);padding:18px;overflow:auto;-webkit-overflow-scrolling:touch}
      .v161-preview-panel{max-width:900px;margin:18px auto;background:#f4f7fb;border-radius:20px;padding:14px;box-shadow:0 18px 60px #0005}
      .v161-preview-top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}
      .v161-preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .v161-preview-party{background:#fff;border-radius:14px;padding:12px;border:1px solid #dbe4ee}
      .v161-preview-line{background:#fff;border-radius:12px;padding:11px;margin-top:8px;border:1px solid #dbe4ee}
      .v161-preview-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
      @media(max-width:700px){.v161-step2 .v161-basic,.v161-step2 .v161-party{grid-template-columns:1fr}.v161-preview-grid,.v161-preview-actions{grid-template-columns:1fr}}
    </style>
    <div class="v161-step2">
      <section class="card">
        <div class="row"><div><h2 class="v159-form-title" style="margin:0">📦 ${editing?'出荷依頼修正':'新規出荷依頼'}</h2><div class="muted" style="margin-top:5px">① 基本情報 → ② 出荷元 → ③ 出荷先 → ④ 出荷明細</div></div>${editing?'<span class="pill">修正</span>':''}</div>
      </section>

      <section class="card v161-s">
        <h3 class="v161-title">① 基本情報</h3>
        <div class="v161-basic">
          <div class="v161-box"><label>依頼日<input id="v114ShipDate" type="date" value="${existing?.shipDate||(()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));return m.year+'-'+m.month+'-'+m.day})()}"></label></div>
          <div class="v161-box"><label>着希望日<input id="v114ArrivalDate" type="date" value="${existing?.arrivalDate||''}"></label></div>
          <div class="v161-box"><label>配送・袋入等<select id="v114DeliveryPack"><option value="" ${!existing?.deliveryPack?'selected':''}>　</option><option value="ビニール袋入り" ${existing?.deliveryPack==='ビニール袋入り'?'selected':''}>ビニール袋入り</option><option value="コンテナ対応" ${existing?.deliveryPack==='コンテナ対応'?'selected':''}>コンテナ対応</option></select></label></div>
          <div class="v161-box"><label>備考<input id="v114Memo" type="text" placeholder="自由入力" value="${esc(existing?.memo||'')}"></label></div>
        </div>
      </section>

      <section class="card v161-s">
        <h3 class="v161-title">② 出荷人</h3>
        <div class="v161-party">
          <div class="v161-box"><label>よく使う会社<select id="v229SourceFavorite"></select></label><label style="display:block;margin-top:10px">地区<select id="v229SourceRegion">${v229RegionOptions(source0.toyamaRegion||source0.region||'すべて')}</select></label><label style="display:block;margin-top:10px">会社を選択<select id="v161SourceSelect">${v229SourceOptions(source0.name,source0.toyamaRegion||source0.region||'すべて')}</select></label><div class="small" style="margin-top:8px">よく使う会社、地区別会社、または右側への直接入力ができます。</div></div>
          <div class="v161-details"><label>会社名<input id="v114SourceName" autocomplete="off" value="${esc(source0.name||'')}"></label><label>郵便番号<input id="v114SourcePostal" autocomplete="off" inputmode="numeric" placeholder="123-4567" value="${esc(source0.postal||source0.postal_code||'')}"></label><label>住所<input id="v114SourceAddress" autocomplete="off" value="${esc(source0.address||'')}"></label><label>電話<input id="v114SourcePhone" autocomplete="off" value="${esc(source0.phone||'')}"></label></div>
        </div>
      </section>

      <section class="card v161-s">
        <h3 class="v161-title">③ 出荷先</h3>
        <div class="v161-party">
          <div class="v161-box"><label>よく使う会社<select id="v229DestFavorite"></select></label><label style="display:block;margin-top:10px">地区<select id="v229DestRegion">${v229RegionOptions(dest0.toyamaRegion||dest0.region||'すべて')}</select></label><label style="display:block;margin-top:10px">会社を選択<select id="v161DestSelect">${v229DestOptions(dest0.name,dest0.toyamaRegion||dest0.region||'すべて',source0.name)}</select></label><div class="small" style="margin-top:8px">よく使う会社を最上段に表示。通常欄では出荷人×出荷先の組み合わせ・地区・全会社から選択でき、直接入力もできます。</div></div>
          <div class="v161-details"><label>会社名<input id="v114DestName" autocomplete="off" value="${esc(dest0.name||'')}"></label><label>郵便番号<input id="v114DestPostal" autocomplete="off" inputmode="numeric" placeholder="123-4567" value="${esc(dest0.postal||dest0.postal_code||'')}"></label><label>住所<input id="v114DestAddress" autocomplete="off" value="${esc(dest0.address||'')}"></label><label>電話<input id="v114DestPhone" autocomplete="off" value="${esc(dest0.phone||'')}"></label></div>
        </div>
      </section>

      <section class="card v161-s">
        <div class="v161-headrow"><h3 class="v161-title" style="margin:0">④ 出荷明細</h3><div class="v161-total">合計数量：<span id="v161ShipmentTotal">0</span></div></div>
        <div class="v113-lines-wrap" style="margin-top:12px"><div id="v114Lines"></div><button class="btn secondary" id="v114AddLine">➕ 明細追加</button><button class="btn" id="v114PdfFlow" style="margin-top:12px;font-size:17px;padding:14px">📄 出荷依頼PDFを確認</button><button class="btn" id="v1649TestFaxDirect" type="button" style="margin-top:10px;font-size:17px;padding:14px;background:#7a3e00;color:#fff">🧪 テストFAX完了（FAX送信なし）</button></div>
        <div class="note" style="margin-top:10px">PDFを確認後、そのままFAXBOXへ登録します。FAXBOX登録が成功するまで在庫には反映されません。</div>
      </section>
    </div>`;

    const byId=id=>document.getElementById(id);
    const sn=byId('v114SourceName'),sx=byId('v114SourcePostal'),sa=byId('v114SourceAddress'),sp=byId('v114SourcePhone'),dn=byId('v114DestName'),dx=byId('v114DestPostal'),da=byId('v114DestAddress'),dp=byId('v114DestPhone');
    const sourceSelect=byId('v161SourceSelect'),destSelect=byId('v161DestSelect'),sourceRegion=byId('v229SourceRegion'),destRegion=byId('v229DestRegion'),sourceFavorite=byId('v229SourceFavorite'),destFavorite=byId('v229DestFavorite');
    sourceFavorite.innerHTML=v229FavoriteOptions('source','');
    destFavorite.innerHTML=v229FavoriteOptions('destination','');
    if(!editing){
      const v1642TokyoToday=()=>{
        const parts=new Intl.DateTimeFormat('en-CA',{
          timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'
        }).formatToParts(new Date());
        const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
        return m.year+'-'+m.month+'-'+m.day;
      };
      const v1642ResetNewShipmentDefaults=()=>{
        const dateEl=byId('v114ShipDate');
        if(dateEl){dateEl.value=v1642TokyoToday();dateEl.defaultValue=dateEl.value;}

        sourceFavorite.value='';
        destFavorite.value='';
        sourceRegion.value='すべて';
        destRegion.value='すべて';

        // 必ず先頭の「直接入力」にする
        sourceSelect.innerHTML=v229SourceOptions('','すべて');
        destSelect.innerHTML=v229DestOptions('','すべて','');
        sourceSelect.selectedIndex=0;
        sourceSelect.value='';
        destSelect.selectedIndex=0;
        destSelect.value='';

        // 新規画面では会社情報を必ず空欄にする
        [sn,sx,sa,sp,dn,dx,da,dp].forEach(el=>{
          if(!el)return;
          el.value='';
          el.defaultValue='';
          el.setAttribute('autocomplete','off');
        });
      };

      // Chrome のフォーム復元より後にも再度初期値を確定する
      v1642ResetNewShipmentDefaults();
      requestAnimationFrame(v1642ResetNewShipmentDefaults);
      setTimeout(v1642ResetNewShipmentDefaults,80);
      setTimeout(v1642ResetNewShipmentDefaults,220);
    }
    const v229Postal=v=>{const d=String(v||'').replace(/\D/g,'');return d.length===7?d.slice(0,3)+'-'+d.slice(3):String(v||'').trim()};
    const applyCompany=(selectEl,nameEl,postalEl,addressEl,phoneEl)=>{
      if(!selectEl.value)return;
      const c=v229FindCompanyByName(selectEl.value)||companyByName(selectEl.value);
      nameEl.value=c?.name||'';postalEl.value=v229Postal(c?.postal||c?.postal_code||'');addressEl.value=c?.address||'';phoneEl.value=c?.phone||'';
    };
    const rebuildSource=()=>{
      const keep=sourceSelect.value||sn.value;
      sourceSelect.innerHTML=v229SourceOptions(keep,sourceRegion.value||'すべて');
      if([...sourceSelect.options].some(o=>o.value===keep))sourceSelect.value=keep;
    };
    const rebuildDest=(resetToTop=false)=>{
      const keep=resetToTop?'':(destSelect.value||dn.value);
      destSelect.innerHTML=v229DestOptions(keep,destRegion.value||'すべて',sn.value);
      if(resetToTop){
        destSelect.selectedIndex=0;
        destSelect.value='';
      }else if([...destSelect.options].some(o=>o.value===keep)){
        destSelect.value=keep;
      }else{
        destSelect.selectedIndex=0;
      }
    };
    sourceRegion.onchange=()=>rebuildSource();
    destRegion.onchange=()=>rebuildDest(true);
    sourceFavorite.onchange=()=>{if(sourceFavorite.value){const c=v229FindCompanyByName(sourceFavorite.value);sn.value=c?.name||'';sx.value=v229Postal(c?.postal||c?.postal_code||'');sa.value=c?.address||'';sp.value=c?.phone||'';const r=c?.toyamaRegion||c?.toyama_region||c?.region||'すべて';sourceRegion.value=[...sourceRegion.options].some(o=>v229NormRegion(o.value)===v229NormRegion(r))?r:'すべて';rebuildSource();sourceSelect.value=[...sourceSelect.options].some(o=>v229NormName(o.value)===v229NormName(sourceFavorite.value))?sourceFavorite.value:'';destFavorite.value='';rebuildDest(true);}};
    destFavorite.onchange=()=>{if(destFavorite.value){const c=v229FindCompanyByName(destFavorite.value);dn.value=c?.name||'';dx.value=v229Postal(c?.postal||c?.postal_code||'');da.value=c?.address||'';dp.value=c?.phone||'';const r=c?.toyamaRegion||c?.toyama_region||c?.region||'すべて';destRegion.value=[...destRegion.options].some(o=>v229NormRegion(o.value)===v229NormRegion(r))?r:'すべて';rebuildDest();destSelect.value=[...destSelect.options].some(o=>v229NormName(o.value)===v229NormName(destFavorite.value))?destFavorite.value:'';}};
    sourceSelect.onchange=()=>{if(sourceSelect.value)applyCompany(sourceSelect,sn,sx,sa,sp);sourceFavorite.value=[...sourceFavorite.options].some(o=>v229NormName(o.value)===v229NormName(sourceSelect.value))?sourceSelect.value:'';destFavorite.value='';rebuildDest(true)};
    destSelect.onchange=()=>{if(destSelect.value)applyCompany(destSelect,dn,dx,da,dp);destFavorite.value=[...destFavorite.options].some(o=>v229NormName(o.value)===v229NormName(destSelect.value))?destSelect.value:''};
    sn.addEventListener('change',rebuildDest);
    sx.addEventListener('blur',()=>sx.value=v229Postal(sx.value));
    dx.addEventListener('blur',()=>dx.value=v229Postal(dx.value));

    function rowFields(l){
      const p=l.product||'kushiro';
      if(p==='hidaka'){
        const sec=H_SECTIONS.find(x=>x.name===(l.section||'走り'))||H_SECTIONS[0];
        const gradeOpts=sec.items.map(g=>`<option ${g===(l.grade||sec.items[0])?'selected':''}>${esc(g)}</option>`).join('');
        return {year:hYearOptions(l.year||hState.activeYear),coop:H_LOCATIONS.map(x=>`<option ${x===l.location?'selected':''}>${esc(x)}</option>`).join(''),coopF:'location',section:H_SECTIONS.map(x=>`<option ${x.name===(l.section||'走り')?'selected':''}>${esc(x.name)}</option>`).join(''),sectionF:'section',grade:gradeOpts,gradeF:'grade'};
      }
      if(p==='nemuro')return {year:nYearOptions(l.year||nState.activeYear),coop:N_COOPS.map(x=>`<option ${x===l.coop?'selected':''}>${esc(x)}</option>`).join(''),coopF:'coop',section:N_SEASONS.map(x=>`<option ${x===l.season?'selected':''}>${esc(x)}</option>`).join(''),sectionF:'season',grade:nItemOptions(l.group||N_GROUPS[0].name,l.item||N_GROUPS[0].items[0]),gradeF:'gi'};
      if(p==='sanmae')return {year:smYearOptions(l.year||smState.activeYear),coop:S_COOPS.map(x=>`<option ${x===l.coop?'selected':''}>${esc(x)}</option>`).join(''),coopF:'coop',section:S_SEASONS.map(x=>`<option ${x===l.season?'selected':''}>${esc(x)}</option>`).join(''),sectionF:'season',grade:smItemOptions(l.group||S_GROUPS[0].name,l.item||S_GROUPS[0].items[0]),gradeF:'gi'};
      return {year:yearOptions(l.year||state.activeYear),coop:state.coops.map(x=>`<option ${x===l.coop?'selected':''}>${esc(x)}</option>`).join(''),coopF:'coop',section:SEASONS.map(x=>`<option ${x===(l.season||'夏')?'selected':''}>${esc(x)}</option>`).join(''),sectionF:'season',grade:itemOptions(l.group||GROUPS[0].name,l.item||GROUPS[0].items[0]),gradeF:'gi'};
    }
    function updateTotal(){const el=byId('v161ShipmentTotal');if(el)el.textContent=fmt(lines.reduce((a,l)=>a+Number(l.qty||0),0));}
    function render(){
      byId('v114Lines').innerHTML=lines.map((l,i)=>{const d=productDefs[l.product]||productDefs.kushiro,f=rowFields(l);let av=0;try{av=d.avail(l)}catch(e){}const over=Number(l.qty||0)>Number(av||0);return `<div class="v113-line" data-v114-line="${i}"><div class="v118-row v118-row1"><div class="v118-line-no">明細 ${i+1}</div><label>生産年度<select data-f="year">${f.year}</select></label><label>昆布の種類<select class="v114-product-select" data-v114-product="${i}" ${editing?'disabled':''}>${productOptions(l.product)}</select></label></div><div class="v118-row v118-row2"><label>漁協<select data-f="${f.coopF}">${f.coop}</select></label><label>区分<select data-f="${f.sectionF}">${f.section}</select></label><label>等級<select data-f="${f.gradeF}">${f.grade}</select></label></div><div class="v118-row v118-row3"><label class="v159-qty-label">数量<input type="number" min="0.01" step="0.01" data-f="qty" value="${esc(l.qty||'')}"><span class="v114-avail v159-avail" style="${over?'color:#b42318;font-weight:900':''}">出荷可能在庫：${fmt(av)}${over?'　⚠ 在庫不足':''}</span></label><div></div><div class="v118-delete-wrap"><button class="mini danger v159-delete" data-v114-del="${i}">削除</button></div></div></div>`}).join('')||'<div class="v113-empty">明細はまだありません。</div>';
      byId('v114Lines').querySelectorAll('[data-v114-product]').forEach(sel=>sel.onchange=()=>{const i=+sel.dataset.v114Product;lines[i]=productDefs[sel.value].make();render()});
      byId('v114Lines').querySelectorAll('[data-v114-del]').forEach(b=>b.onclick=()=>{if(!window.confirm('本当に削除しますか？'))return;lines.splice(+b.dataset.v114Del,1);render()});
      byId('v114Lines').querySelectorAll('[data-v114-line]').forEach(box=>{const i=+box.dataset.v114Line;box.querySelectorAll('[data-f]').forEach(el=>{const handler=()=>{const d=productDefs[lines[i].product],f=el.dataset.f;d.apply(lines[i],f,el.value);if(lines[i].product==='hidaka'&&f==='section'){const sec=H_SECTIONS.find(x=>x.name===el.value)||H_SECTIONS[0];lines[i].grade=sec.items[0]}if(f==='qty'){let av=0;try{av=d.avail(lines[i])}catch(e){}const over=Number(lines[i].qty||0)>Number(av||0),span=box.querySelector('.v114-avail');if(span){span.textContent=`出荷可能在庫：${fmt(av)}${over?'　⚠ 在庫不足':''}`;span.style.color=over?'#b42318':'';span.style.fontWeight=over?'900':''}updateTotal()}else render()};el.onchange=handler;if(el.dataset.f==='qty')el.oninput=handler})});
      updateTotal();
    }
    byId('v114AddLine').onclick=()=>{lines.push(productDefs.kushiro.make());render()};

    function v161ValidateCurrent(){
      if(!sn.value.trim())return '出荷元を入力してください。';
      if(sx.value.trim()&&!/^\d{3}-\d{4}$/.test(sx.value.trim()))return '出荷元の郵便番号を123-4567形式で入力してください。';
      if(!dn.value.trim())return '出荷先を入力してください。';
      if(dx.value.trim()&&!/^\d{3}-\d{4}$/.test(dx.value.trim()))return '出荷先の郵便番号を123-4567形式で入力してください。';
      if(!lines.length)return '明細を1件以上追加してください。';
      for(let i=0;i<lines.length;i++){
        const l=lines[i],d=productDefs[l.product],q=Number(l.qty);
        if(!q||q<=0)return `明細 ${i+1} の数量を入力してください。`;
        let av=0;try{av=d.avail(l)}catch(e){}
        if(q>Number(av||0))return `${d.desc(l)} の出荷可能在庫は ${fmt(av)} です。`;
      }
      return '';
    }

    function v25BuildDraftObjects(){
      const source={name:sn.value.trim(),postal:v229Postal(sx.value),address:sa.value.trim(),phone:sp.value.trim()};
      const dest={name:dn.value.trim(),postal:v229Postal(dx.value),address:da.value.trim(),phone:dp.value.trim()};
      const common={source,dest,shipDate:byId('v114ShipDate').value,arrivalDate:byId('v114ArrivalDate').value,deliveryPack:byId('v114DeliveryPack').value||'',memo:byId('v114Memo').value||'',batchId:'M'+Date.now().toString(36).toUpperCase(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'draft'};
      const groups={}; for(const l of lines)(groups[l.product]||(groups[l.product]=[])).push({...l});
      const created=[];
      if(groups.kushiro){const ls=groups.kushiro.map(({product,...x})=>x),o={id:shipmentId(),status:'draft',source,destInfo:dest,dest:dest.name,baseYear:ls[0]?.year||state.activeYear,shipDate:common.shipDate,arrivalDate:common.arrivalDate,deliveryPack:common.deliveryPack,memo:common.memo,batchId:common.batchId,createdAt:common.createdAt,updatedAt:common.updatedAt,lines:ls};state.shipments.push(o);save();created.push({product:'kushiro',shipment:o})}
      if(groups.hidaka){const ls=groups.hidaka.map(({product,memo,...x})=>x),o={id:hShipId(),status:'draft',source,dest,shipDate:common.shipDate,arrivalDate:common.arrivalDate,deliveryPack:common.deliveryPack,memo:common.memo,batchId:common.batchId,createdAt:common.createdAt,updatedAt:common.updatedAt,lines:ls};hState.shipments.push(o);hSave();created.push({product:'hidaka',shipment:o})}
      if(groups.nemuro){const ls=groups.nemuro.map(({product,memo,...x})=>x),o={id:nShipId(),status:'draft',source,dest,shipDate:common.shipDate,arrivalDate:common.arrivalDate,deliveryPack:common.deliveryPack,memo:common.memo,batchId:common.batchId,createdAt:common.createdAt,updatedAt:common.updatedAt,lines:ls};nState.shipments.push(o);nSave();created.push({product:'nemuro',shipment:o})}
      if(groups.sanmae){const ls=groups.sanmae.map(({product,memo,...x})=>x),o={id:smShipId(),status:'draft',source,dest,shipDate:common.shipDate,arrivalDate:common.arrivalDate,deliveryPack:common.deliveryPack,memo:common.memo,batchId:common.batchId,createdAt:common.createdAt,updatedAt:common.updatedAt,lines:ls};smState.shipments.push(o);smSave();created.push({product:'sanmae',shipment:o})}
      return created;
    }

    function v25RemoveDrafts(created){
      (created||[]).forEach(({product,shipment})=>{
        const store=product==='kushiro'?state:product==='hidaka'?hState:product==='nemuro'?nState:smState;
        store.shipments=(store.shipments||[]).filter(x=>x.id!==shipment.id);
        if(product==='kushiro')save(); else if(product==='hidaka')hSave(); else if(product==='nemuro')nSave(); else smSave();
      });
    }

    async function v25StartPdfFlow(){
      const err=v161ValidateCurrent();
      if(err)return alert(err);
      if(editing){
        alert('既存の出荷依頼を修正する場合は、修正保存後に履歴から帳票を確認してください。');
        return;
      }
      const created=v25BuildDraftObjects();
      if(!created.length)return alert('出荷依頼を作成できませんでした。');

      // 新規フローは昆布種類ごとにPDFを確認する。まず1件目をプレビュー。
      const first=created[0];
      globalThis.__v25PendingShipments=created;
      globalThis.__v25PendingCurrent=0;
      try{
        if(typeof globalThis.kombuPreviewShipmentForFlow==='function'){
          await globalThis.kombuPreviewShipmentForFlow(first.product,first.shipment,created);
        }else{
          openGlobalShipment(first.product,first.shipment.id);
          alert('帳票プレビュー機能を読み込めませんでした。出荷依頼は下書きとして保持しています。');
        }
      }catch(e){
        console.error(e);
        alert('PDF確認画面を開けませんでした。出荷依頼は下書きとして保持しています。\n'+(e?.message||e));
      }
    }

    function v161ShowPreview(){
      const err=v161ValidateCurrent();
      if(err)return alert(err);

      const old=document.getElementById('v161ShipmentPreviewOverlay');
      if(old)old.remove();

      const overlay=document.createElement('div');
      overlay.id='v161ShipmentPreviewOverlay';
      overlay.className='v161-preview-overlay';

      const total=lines.reduce((a,l)=>a+Number(l.qty||0),0);
      const lineHtml=lines.map((l,i)=>{
        const d=productDefs[l.product]||productDefs.kushiro;
        let av=0;try{av=d.avail(l)}catch(e){}
        return `<div class="v161-preview-line">
          <div><b>明細 ${i+1}　${esc(d.label||l.product||'')}</b></div>
          <div style="margin-top:5px">${esc(d.desc(l))}</div>
          <div style="margin-top:5px"><b>数量：</b>${fmt(l.qty)}　<span class="muted">出荷可能在庫：${fmt(av)}</span></div>
        </div>`;
      }).join('');

      overlay.innerHTML=`
        <div class="v161-preview-panel">
          <div class="v161-preview-top">
            <div>
              <h2 style="margin:0">👁 出荷依頼 内容確認</h2>
              <div class="muted" style="margin-top:4px">まだ在庫には反映されていません。</div>
            </div>
            <span class="pill">確認中</span>
          </div>

          <section class="card" style="margin:0 0 10px">
            <h3 style="margin-top:0">① 基本情報</h3>
            <div class="v161-preview-grid">
              <div><b>依頼日</b><br>${esc(byId('v114ShipDate').value||'')}</div>
              <div><b>着希望日</b><br>${esc(byId('v114ArrivalDate').value||'未指定')}</div>
              <div><b>配送・袋入等</b><br>${esc(byId('v114DeliveryPack').value||'なし')}</div>
              <div><b>備考</b><br>${esc(byId('v114Memo').value||'なし')}</div>
            </div>
          </section>

          <section class="card" style="margin:0 0 10px">
            <div class="v161-preview-grid">
              <div class="v161-preview-party">
                <b>② 出荷元</b><br>
                ${esc(sn.value||'')}<br>
                <span class="small">${sx.value?'〒'+esc(sx.value)+'　':''}${esc(sa.value||'')}</span><br>
                <span class="small">${sp.value?'TEL '+esc(sp.value):''}</span>
              </div>
              <div class="v161-preview-party">
                <b>③ 出荷先</b><br>
                ${esc(dn.value||'')}<br>
                <span class="small">${dx.value?'〒'+esc(dx.value)+'　':''}${esc(da.value||'')}</span><br>
                <span class="small">${dp.value?'TEL '+esc(dp.value):''}</span>
              </div>
            </div>
          </section>

          <section class="card" style="margin:0 0 10px">
            <div class="row"><h3 style="margin:0">④ 出荷明細</h3><b>合計数量：${fmt(total)}</b></div>
            ${lineHtml}
          </section>

          <section class="card" style="margin:0">
            <div class="note">内容を確認してください。「下書き保存して次へ」を押すと、従来どおり下書きとして保存され、詳細画面へ進みます。詳細画面の「出荷指示を確定して在庫反映」を押すまでは在庫は変わりません。</div>
            <div class="v161-preview-actions">
              <button class="btn secondary" id="v161PreviewBack" type="button">← 修正する</button>
              <button class="btn" id="v161PreviewSave" type="button">💾 下書き保存して次へ</button>
            </div>
          </section>
        </div>`;

      document.body.appendChild(overlay);
      document.getElementById('v161PreviewBack').onclick=()=>overlay.remove();
      document.getElementById('v161PreviewSave').onclick=()=>{
        overlay.remove();
        byId('v114Save').click();
      };
      overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove()});
    }

    const v25PdfFlowBtn=byId('v114PdfFlow');
    if(v25PdfFlowBtn)v25PdfFlowBtn.onclick=v25StartPdfFlow;

    const v114PreviewBtn=byId('v114Preview');
    if(v114PreviewBtn)v114PreviewBtn.onclick=v161ShowPreview;

    const v1649TestFaxBtn=byId('v1649TestFaxDirect');
    if(v1649TestFaxBtn)v1649TestFaxBtn.onclick=()=>{
      if(editing)return alert('テストFAX完了は新規出荷依頼で使用してください。');
      if(!sn.value.trim())return alert('出荷人を入力してください。');
      if(sx.value.trim()&&!/^\d{3}-\d{4}$/.test(sx.value.trim()))return alert('出荷人の郵便番号を123-4567形式で入力してください。');
      if(!dn.value.trim())return alert('出荷先を入力してください。');
      if(dx.value.trim()&&!/^\d{3}-\d{4}$/.test(dx.value.trim()))return alert('出荷先の郵便番号を123-4567形式で入力してください。');
      if(!lines.length)return alert('明細を1件以上追加してください。');

      for(const l of lines){
        const d=productDefs[l.product],q=Number(l.qty);
        if(!q||q<=0)return alert('明細の数量を入力してください。');
        let av=0;try{av=d.avail(l)}catch(e){}
        if(q>Number(av||0))return alert(`${d.desc(l)} の出荷可能在庫は ${fmt(av)} です。`);
        l.qty=q;
      }

      const source={name:sn.value.trim(),postal:v229Postal(sx.value),address:sa.value.trim(),phone:sp.value.trim()};
      const dest={name:dn.value.trim(),postal:v229Postal(dx.value),address:da.value.trim(),phone:dp.value.trim()};
      const common={
        source,dest,
        shipDate:byId('v114ShipDate').value,
        arrivalDate:byId('v114ArrivalDate').value,
        deliveryPack:byId('v114DeliveryPack').value||'',
        memo:byId('v114Memo').value||'',
        batchId:'TESTM'+Date.now().toString(36).toUpperCase(),
        createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString()
      };
      const total=lines.reduce((n,l)=>n+Number(l.qty||0),0);
      if(!confirm(
        '【テストFAX完了】\n\n実際のFAXは送信しません。\n'+
        '出荷依頼を保存し、本番のFAX完了後処理を実行します。\n\n'+
        '出荷人：'+source.name+'\n出荷先：'+dest.name+
        '\n出荷日：'+common.shipDate+'\n合計数量：'+total+
        '\n\n在庫差引・入出庫履歴・出荷依頼履歴へ反映します。よろしいですか？'
      ))return;

      v1649TestFaxBtn.disabled=true;
      v1649TestFaxBtn.textContent='テストFAX完了処理中…';
      try{
        const groups={};for(const l of lines)(groups[l.product]||(groups[l.product]=[])).push({...l});
        const created=[];
        if(groups.kushiro){
          const ls=groups.kushiro.map(({product,...x})=>x);
          const o={id:shipmentId(),status:'draft',source,destInfo:dest,dest:dest.name,baseYear:ls[0]?.year||state.activeYear,shipDate:common.shipDate,arrivalDate:common.arrivalDate,deliveryPack:common.deliveryPack,memo:common.memo,batchId:common.batchId,createdAt:common.createdAt,updatedAt:common.updatedAt,lines:ls};
          state.shipments.push(o);save();created.push(['kushiro',o.id]);
        }
        if(groups.hidaka){
          const ls=groups.hidaka.map(({product,memo,...x})=>x);
          const o={id:hShipId(),status:'draft',source,dest,shipDate:common.shipDate,arrivalDate:common.arrivalDate,deliveryPack:common.deliveryPack,memo:common.memo,batchId:common.batchId,createdAt:common.createdAt,updatedAt:common.updatedAt,lines:ls};
          hState.shipments.push(o);hSave();created.push(['hidaka',o.id]);
        }
        if(groups.nemuro){
          const ls=groups.nemuro.map(({product,memo,...x})=>x);
          const o={id:nShipId(),status:'draft',source,dest,shipDate:common.shipDate,arrivalDate:common.arrivalDate,deliveryPack:common.deliveryPack,memo:common.memo,batchId:common.batchId,createdAt:common.createdAt,updatedAt:common.updatedAt,lines:ls};
          nState.shipments.push(o);nSave();created.push(['nemuro',o.id]);
        }
        if(groups.sanmae){
          const ls=groups.sanmae.map(({product,memo,...x})=>x);
          const o={id:smShipId(),status:'draft',source,dest,shipDate:common.shipDate,arrivalDate:common.arrivalDate,deliveryPack:common.deliveryPack,memo:common.memo,batchId:common.batchId,createdAt:common.createdAt,updatedAt:common.updatedAt,lines:ls};
          smState.shipments.push(o);smSave();created.push(['sanmae',o.id]);
        }

        const stamp=Date.now();
        for(const [product,id] of created){
          // Same production stock validation/confirmation path.
          window.kombuApplyFaxboxInventory(product,id,'confirm',{jobId:'TEST-'+stamp});
          // Same production FAX-completion finalizer. This creates formal OUT records and shipment history.
          window.kombuFinalizeFaxboxShipment(product,id,{
            jobId:'TEST-'+stamp,
            sentAt:new Date().toISOString(),
            testMode:true
          });
        }
        alert(
          'テストFAX完了しました。\n\n'+
          '実際のFAXは送信していません。\n'+
          '作成した出荷依頼：'+created.length+'件\n'+
          '在庫・入出庫履歴・出荷依頼履歴へ本番完了処理で反映しました。'
        );
        if(typeof globalThis.gShipmentHistory==='function')globalThis.gShipmentHistory();
        else if(typeof globalThis.v136ShipmentHistory==='function')globalThis.v136ShipmentHistory();
        else v76ShipmentMenu();
      }catch(err){
        console.error('[v164.9 direct test fax]',err);
        v1649TestFaxBtn.disabled=false;
        v1649TestFaxBtn.textContent='🧪 テストFAX完了（FAX送信なし）';
        alert('テストFAX完了処理に失敗しました。\n'+String(err?.message||err));
      }
    };

    const v114SaveBtn=byId('v114Save');
    if(v114SaveBtn)v114SaveBtn.onclick=()=>{
      if(!sn.value.trim())return alert('出荷元を入力してください。');
      if(sx.value.trim()&&!/^\d{3}-\d{4}$/.test(sx.value.trim()))return alert('出荷元の郵便番号を123-4567形式で入力してください。');
      if(!dn.value.trim())return alert('出荷先を入力してください。');
      if(dx.value.trim()&&!/^\d{3}-\d{4}$/.test(dx.value.trim()))return alert('出荷先の郵便番号を123-4567形式で入力してください。');
      if(!lines.length)return alert('明細を1件以上追加してください。');
      for(const l of lines){const d=productDefs[l.product],q=Number(l.qty);if(!q||q<=0)return alert('明細の数量を入力してください。');let av=0;try{av=d.avail(l)}catch(e){}if(q>Number(av||0))return alert(`${d.desc(l)} の出荷可能在庫は ${fmt(av)} です。`);l.qty=q}
      const source={name:sn.value.trim(),postal:v229Postal(sx.value),address:sa.value.trim(),phone:sp.value.trim()},dest={name:dn.value.trim(),postal:v229Postal(dx.value),address:da.value.trim(),phone:dp.value.trim()};
      const common={source,dest,shipDate:byId('v114ShipDate').value,arrivalDate:byId('v114ArrivalDate').value,deliveryPack:byId('v114DeliveryPack').value||'',memo:byId('v114Memo').value||'',batchId:'M'+Date.now().toString(36).toUpperCase(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'draft'};
      if(editing){
        if(lines.some(l=>l.product!==editProduct))return alert('修正画面では昆布の種類は変更できません。');
        const cleanLines=lines.map(({product,...x})=>x);
        if(editProduct==='kushiro')Object.assign(existing,{source,destInfo:dest,dest:dest.name,shipDate:common.shipDate,arrivalDate:common.arrivalDate,deliveryPack:common.deliveryPack,memo:common.memo,updatedAt:common.updatedAt,lines:cleanLines});
        else Object.assign(existing,{source,dest,shipDate:common.shipDate,arrivalDate:common.arrivalDate,deliveryPack:common.deliveryPack,memo:common.memo,updatedAt:common.updatedAt,lines:cleanLines});
        editStores[editProduct].save();alert('出荷依頼を修正しました。');openGlobalShipment(editProduct,editId);return;
      }
      const groups={};for(const l of lines)(groups[l.product]||(groups[l.product]=[])).push({...l});
      const created=[];
      if(groups.kushiro){const ls=groups.kushiro.map(({product,...x})=>x),o={id:shipmentId(),status:'draft',source,destInfo:dest,dest:dest.name,baseYear:ls[0]?.year||state.activeYear,shipDate:common.shipDate,arrivalDate:common.arrivalDate,deliveryPack:common.deliveryPack,memo:common.memo,batchId:common.batchId,createdAt:common.createdAt,updatedAt:common.updatedAt,lines:ls};state.shipments.push(o);save();created.push(['kushiro',o.id])}
      if(groups.hidaka){const ls=groups.hidaka.map(({product,memo,...x})=>x),o={id:hShipId(),status:'draft',source,dest,shipDate:common.shipDate,arrivalDate:common.arrivalDate,deliveryPack:common.deliveryPack,memo:common.memo,batchId:common.batchId,createdAt:common.createdAt,updatedAt:common.updatedAt,lines:ls};hState.shipments.push(o);hSave();created.push(['hidaka',o.id])}
      if(groups.nemuro){const ls=groups.nemuro.map(({product,memo,...x})=>x),o={id:nShipId(),status:'draft',source,dest,shipDate:common.shipDate,arrivalDate:common.arrivalDate,deliveryPack:common.deliveryPack,memo:common.memo,batchId:common.batchId,createdAt:common.createdAt,updatedAt:common.updatedAt,lines:ls};nState.shipments.push(o);nSave();created.push(['nemuro',o.id])}
      if(groups.sanmae){const ls=groups.sanmae.map(({product,memo,...x})=>x),o={id:smShipId(),status:'draft',source,dest,shipDate:common.shipDate,arrivalDate:common.arrivalDate,deliveryPack:common.deliveryPack,memo:common.memo,batchId:common.batchId,createdAt:common.createdAt,updatedAt:common.updatedAt,lines:ls};smState.shipments.push(o);smSave();created.push(['sanmae',o.id])}
      alert(`出荷依頼を保存しました。${created.length>1?'\\n昆布種類ごとに '+created.length+'件の出荷依頼として作成しています。':''}`);
      if(created.length===1)openGlobalShipment(created[0][0],created[0][1]);else v76ShipmentMenu();
    };
    if(!lines.length){const pp=preset&&productDefs[preset.product]?preset.product:'kushiro';const first=productDefs[pp].make();first.product=pp;if(preset&&preset.year)first.year=preset.year;lines.push(first)}
    render();
  }
  globalThis.v114UnifiedShipmentForm=v114UnifiedShipmentForm;

  const oldChoice=globalThis.productChoicePage;
  globalThis.productChoicePage=function(mode){
    if(mode==='shipment')return v114UnifiedShipmentForm();
    return oldChoice.apply(this,arguments);
  };
  const oldMenu=globalThis.v76ShipmentMenu;
  if(typeof oldMenu==='function'){
    globalThis.v76ShipmentMenu=function(){const r=oldMenu.apply(this,arguments);const pill=app.querySelector('.pill');if(pill)pill.textContent='v114';return r};
  }
  const oldLanding=globalThis.productLanding;
  globalThis.productLanding=function(){const r=oldLanding.apply(this,arguments);const ver=app.querySelector('.v106-version,.pill');if(ver)ver.textContent='v114';return r};
})();
/* ===== /v114 ===== */

/* ===== v115-v117 legacy nav patches removed in v121 for performance ===== */
/* ===== v119: deterministic inventory/shipment bottom navigation switching ===== */
(function(){
  const FAX_KEY='kombu-v99-fax-box';
  const css=document.createElement('style');
  css.textContent=`
    body[data-v119-nav-mode="inventory"] #v119ShipmentNav,
    body[data-v119-nav-mode="inventory"] #v115ShipmentNav{display:none!important}
    body[data-v119-nav-mode="inventory"] > nav.v119-standard-nav{
      display:flex!important;z-index:40100!important;
    }
    body[data-v119-nav-mode="shipment"] > nav.v119-standard-nav,
    body[data-v119-nav-mode="shipment"] #v115ShipmentNav,
    body[data-v119-nav-mode="shipment"] #v107LandingNav,
    body[data-v119-nav-mode="shipment"] .v106-settings-nav,
    body[data-v119-nav-mode="shipment"] #v110HomeNav,
    body[data-v119-nav-mode="shipment"] #v101BackDock,
    body[data-v119-nav-mode="shipment"] .v102-fixed-bottom-nav-card{display:none!important}
    #v119ShipmentNav{
      position:fixed!important;left:0!important;right:0!important;bottom:0!important;
      z-index:40200!important;background:#0b2b55!important;
      display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:5px!important;
      padding:7px 10px calc(7px + env(safe-area-inset-bottom))!important;
      box-sizing:border-box!important;box-shadow:0 -2px 10px rgba(0,0,0,.16)!important;
    }
    #v119ShipmentNav button{
      min-width:0!important;min-height:50px!important;margin:0!important;padding:5px 2px!important;
      border:0!important;border-radius:10px!important;background:transparent!important;color:#fff!important;
      box-shadow:none!important;font-size:23px!important;line-height:1!important;font-weight:800!important;white-space:nowrap!important;
    }
    #v119ShipmentNav button:active{background:rgba(255,255,255,.12)!important}
    #v119ShipmentNav .v119-fax{font-size:20px!important}
    body[data-v119-nav-mode="shipment"] main{padding-bottom:calc(76px + env(safe-area-inset-bottom))!important}
    body[data-v119-nav-mode="inventory"] main{padding-bottom:calc(78px + env(safe-area-inset-bottom))!important}
    @media(max-width:430px){
      #v119ShipmentNav{padding-left:7px!important;padding-right:7px!important;gap:3px!important}
      #v119ShipmentNav button{font-size:21px!important;min-height:48px!important}
      #v119ShipmentNav .v119-fax{font-size:18px!important}
    }
  `;
  document.head.appendChild(css);

  let mode='';
  let screenKind='menu';

  function standardNav(){
    const nav=Array.from(document.body.children).find(el=>el.tagName==='NAV' && !['v115ShipmentNav','v119ShipmentNav','v107LandingNav','v110HomeNav'].includes(el.id));
    if(nav)nav.classList.add('v119-standard-nav');
    return nav||null;
  }
  function faxCount(){
    try{const a=JSON.parse(localStorage.getItem(FAX_KEY)||'[]');return Array.isArray(a)?a.length:0}catch(_e){return 0}
  }
  function ensureShipmentNav(){
    let nav=document.getElementById('v119ShipmentNav');
    if(!nav){
      nav=document.createElement('nav');
      nav.id='v119ShipmentNav';
      nav.setAttribute('aria-label','出荷依頼 共通固定メニュー');
      nav.innerHTML=`
        <button id="v119Home" aria-label="ホーム" title="ホーム">
          <span class="v124-nav-icon">🏠</span>
          <span class="v124-nav-label">ホーム</span>
        </button>
        <button id="v119Back" aria-label="戻る" title="戻る">
          <span class="v124-nav-icon">⬅️</span>
          <span class="v124-nav-label">戻る</span>
        </button>
        <button id="v119New" aria-label="新規出荷依頼" title="新規出荷依頼">
          <span class="v124-nav-icon">➕</span>
          <span class="v124-nav-label">新規</span>
        </button>
        <button id="v119List" aria-label="出荷依頼履歴" title="出荷依頼履歴">
          <span class="v124-nav-icon">🕘</span>
          <span class="v124-nav-label">履歴</span>
        </button>`;

      document.body.appendChild(nav);

      nav.querySelector('#v119Home').onclick=()=>{
        screenKind='menu';
        setMode('');
        productLanding();
      };

      nav.querySelector('#v119Back').onclick=()=>{
        const appText=String(document.getElementById('app')?.textContent||'');
        const onEntry =
          appText.includes('新規出荷依頼') &&
          appText.includes('出荷依頼履歴') &&
          !document.getElementById('v114ShipDate') &&
          !document.querySelector('.v159-history-card');

        if(onEntry){
          screenKind='menu';
          setMode('');
          productLanding();
          return;
        }

        screenKind='entry';
        setMode('shipment','entry');
        if(typeof globalThis.v161ShipmentEntryMenu==='function'){
          globalThis.v161ShipmentEntryMenu();
        }else{
          productLanding();
        }
      };

      nav.querySelector('#v119New').onclick=()=>{
        screenKind='form';
        setMode('shipment','form');
        if(typeof globalThis.v114UnifiedShipmentForm==='function'){
          globalThis.v114UnifiedShipmentForm();
        }
      };

      nav.querySelector('#v119List').onclick=()=>{
        try{
          if(typeof window.v136ShipmentHistory==='function'){
            window.v136ShipmentHistory();
          }
        }catch(e){
          console.error('[KOMBU v2.21] 下部履歴ボタン',e);
          alert('出荷依頼履歴を開けませんでした。\n'+String(e?.message||e));
        }
      };
    }

    nav.dataset.v124Screen=screenKind;
    nav.style.setProperty('display',mode==='shipment'?'grid':'none','important');
    nav.style.setProperty('grid-template-columns','repeat(4,1fr)','important');
    return nav;
  }

  function v217ForceShipmentFourNav(kind){
    try{
      mode='shipment';
      screenKind=kind||screenKind||'entry';
      document.body.dataset.v119NavMode='shipment';
      document.body.classList.add('v115-shipment-mode');
      document.body.classList.remove('v117-inventory-mode');

      // 旧3ボタン/旧出荷ナビはすべて隠す。
      const oldIds=['v115ShipmentNav','v107LandingNav','v110HomeNav','v101BackDock'];
      oldIds.forEach(id=>{
        const el=document.getElementById(id);
        if(el)el.style.setProperty('display','none','important');
      });
      document.querySelectorAll('.v102-fixed-bottom-nav-card').forEach(el=>{
        el.style.setProperty('display','none','important');
      });

      const std=standardNav();
      if(std)std.style.setProperty('display','none','important');

      const nav=ensureShipmentNav();
      if(nav){
        // 過去版の余分なボタンを除去。
        nav.querySelector('#v136History')?.remove();
        nav.querySelector('#v119Fax')?.remove();

        // 必要な4ボタンが欠けていた場合は作り直す。
        const needed=['v119Home','v119Back','v119New','v119List'];
        if(needed.some(id=>!nav.querySelector('#'+id))){
          // v2.18: 再帰呼び出し禁止。旧ナビを1回だけ削除して作り直す。
          nav.remove();
          const rebuilt=ensureShipmentNav();
          if(rebuilt){
            rebuilt.querySelector('#v136History')?.remove();
            rebuilt.querySelector('#v119Fax')?.remove();
            rebuilt.style.setProperty('display','grid','important');
            rebuilt.style.setProperty('grid-template-columns','repeat(4,1fr)','important');
            rebuilt.style.setProperty('z-index','40200','important');
          }
          return;
        }

        nav.style.setProperty('display','grid','important');
        nav.style.setProperty('grid-template-columns','repeat(4,1fr)','important');
        nav.style.setProperty('z-index','40200','important');
      }
    }catch(e){
      console.warn('[KOMBU v2.17] 4ボタンナビ確定失敗',e);
    }
  }

  window.kombuForceShipmentFourNav=v217ForceShipmentFourNav;

  function sync(){
    const body=document.body;
    if(mode)body.dataset.v119NavMode=mode; else delete body.dataset.v119NavMode;
    const std=standardNav();
    if(mode==='inventory'){
      body.classList.add('v117-inventory-mode');
      body.classList.remove('v115-shipment-mode');
      document.getElementById('v115ShipmentNav')?.style.setProperty('display','none','important');
      document.getElementById('v119ShipmentNav')?.style.setProperty('display','none','important');
      if(std){std.style.setProperty('display','flex','important');std.style.setProperty('z-index','40100','important')}
      try{bindNav()}catch(_e){}
    }else if(mode==='shipment'){
      body.classList.remove('v117-inventory-mode');
      body.classList.add('v115-shipment-mode');
      if(std)std.style.setProperty('display','none','important');
      document.getElementById('v115ShipmentNav')?.style.setProperty('display','none','important');
      ensureShipmentNav();
    }else{
      body.classList.remove('v117-inventory-mode','v115-shipment-mode');
      if(std){std.style.removeProperty('display');std.style.removeProperty('z-index')}
      document.getElementById('v119ShipmentNav')?.remove();
    }
  }
  function setMode(next,kind){
    const nm=next||'';
    const nk=kind||screenKind;
    if(mode===nm && screenKind===nk){
      if(mode==='shipment'){
        const nav=document.getElementById('v119ShipmentNav');if(nav)nav.dataset.v124Screen=screenKind;
        const draft=document.getElementById('v124Draft');if(draft)draft.style.display=screenKind==='form'?'block':'none';
        const fax=document.querySelector('#v119Fax');if(fax)fax.innerHTML='<span class="v124-nav-icon">📥 ('+faxCount()+')</span><span class="v124-nav-label">FAX</span>';
      }
      return;
    }
    mode=nm;
    if(kind)screenKind=kind;
    sync();
  }

  // 在庫管理系は常に6ボタン。
  const oldChoice=globalThis.productChoicePage;
  if(typeof oldChoice==='function')globalThis.productChoicePage=function(m){
    if(m==='inventory')setMode('inventory');
    else if(m==='shipment')setMode('shipment','form');
    const r=oldChoice.apply(this,arguments);
    if(m==='inventory')setMode('inventory'); else if(m==='shipment')setMode('shipment','form');
    return r;
  };
  const oldOpen=globalThis.openProductContext;
  if(typeof oldOpen==='function')globalThis.openProductContext=function(product,m){
    if(m==='inventory')setMode('inventory'); else if(m==='shipment')setMode('shipment','list');
    const r=oldOpen.apply(this,arguments);
    if(m==='inventory')setMode('inventory'); else if(m==='shipment')setMode('shipment','list');
    return r;
  };
  ['home','hHome','nHome','smHome','stockReport','hStockReport','nStockReport','smStockReport','logs','hLogs','nLogs','smLogs','inForm','hInForm','nInForm','smInForm'].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){setMode('inventory');const r=fn.apply(this,arguments);setMode('inventory');return r};
  });

  // 出荷指示系は常に4ボタン。
  const shipTargets={
    v76ShipmentMenu:'menu',v114UnifiedShipmentForm:'form',
    shipments:'list',hShipments:'list',nShipments:'list',smShipments:'list',globalShipmentList:'list',
    shipmentForm:'form',hShipForm:'form',nShipForm:'form',smShipForm:'form',
    shipmentDetail:'detail',hShipDetail:'detail',nShipDetail:'detail',smShipDetail:'detail',openGlobalShipment:'detail'
  };
  Object.entries(shipTargets).forEach(([name,kind])=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){setMode('shipment',kind);const r=fn.apply(this,arguments);setMode('shipment',kind);return r};
  });
  if(typeof window.v99FaxBoxPage==='function'){
    const f=window.v99FaxBoxPage;
    window.v99FaxBoxPage=function(){setMode('shipment','fax');const r=f.apply(this,arguments);setMode('shipment','fax');return r};
  }

  // トップ・設定画面では専用モードを解除。
  ['productLanding','v73SettingsPage','companyMasterPage'].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){setMode('');const r=fn.apply(this,arguments);setMode('');return r};
  });

  // v121: DOM監視による連続再同期を廃止。FAX件数変更だけ軽量更新する。
  window.addEventListener('storage',()=>{if(mode==='shipment'){const fax=document.querySelector('#v119Fax');if(fax)fax.innerHTML='<span class="v124-nav-icon">📥 ('+faxCount()+')</span><span class="v124-nav-label">FAX</span>'}});

  // 現在表示が在庫画面なら初期状態も6ボタンへ。
  standardNav();
  const oldLanding=globalThis.productLanding;
  if(typeof oldLanding==='function')globalThis.productLanding=function(){setMode('');const r=oldLanding.apply(this,arguments);const ver=app.querySelector('.v106-version,.pill');if(ver)ver.textContent='v122';return r};
})();
/* ===== /v119 ===== */


/* ===== v130: iPhone対応 トップ画面バックアップ ===== */
async function v130TopBackup(){
  try{
    const data={
      app:'昆布在庫・出荷管理',
      version:130,
      exportedAt:new Date().toISOString(),
      kushiro:state,
      hidaka:hState,
      nemuro:nState,
      sanmae:smState
    };
    const text=JSON.stringify(data,null,2);
    const name='昆布在庫出荷管理_'+v136BackupTimestamp()+'.json';
    const blob=new Blob([text],{type:'application/json;charset=utf-8'});
    const file=new File([blob],name,{type:'application/json'});

    // iPhone/iPadではWeb Shareのファイル共有が最も確実。
    // 「ファイルに保存」などを選択できる。
    const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
    if(isiOS && navigator.share && navigator.canShare){
      try{
        if(navigator.canShare({files:[file]})){
          await navigator.share({
            files:[file],
            title:'昆布在庫・出荷管理 バックアップ'
          });
          return;
        }
      }catch(err){
        // ユーザーが共有シートを閉じた場合は何もしない
        if(err && err.name==='AbortError') return;
        console.warn('backup share fallback',err);
      }
    }

    // その他の端末 / Web Share非対応時は従来のダウンロード
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=name;
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},3000);
  }catch(err){
    console.error(err);
    alert('バックアップファイルを作成できませんでした。もう一度お試しください。');
  }
}

/* ===== v120: top screen uses dedicated 3-button fixed navigation ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    body.v120-top-mode > nav.v119-standard-nav,
    body.v120-top-mode #v115ShipmentNav,
    body.v120-top-mode #v119ShipmentNav,
    body.v120-top-mode #v107LandingNav,
    body.v120-top-mode .v106-settings-nav,
    body.v120-top-mode #v110HomeNav,
    body.v120-top-mode #v101BackDock,
    body.v120-top-mode .v102-fixed-bottom-nav-card{display:none!important}
    #v120TopNav{
      position:fixed!important;left:0!important;right:0!important;bottom:0!important;z-index:40500!important;
      background:#0b2b55!important;display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:8px!important;
      padding:8px 16px calc(8px + env(safe-area-inset-bottom))!important;box-sizing:border-box!important;
      box-shadow:0 -2px 10px rgba(0,0,0,.16)!important;
    }
    #v120TopNav button{
      appearance:none!important;border:0!important;background:transparent!important;color:#fff!important;
      min-height:52px!important;padding:5px 4px!important;border-radius:10px!important;
      font-size:27px!important;line-height:1!important;font-weight:800!important;box-shadow:none!important;
    }
    #v120TopNav button:active{background:rgba(255,255,255,.12)!important}
    body.v120-top-mode main{padding-bottom:calc(78px + env(safe-area-inset-bottom))!important}
    @media(max-width:430px){#v120TopNav{padding-left:10px!important;padding-right:10px!important;gap:4px!important}#v120TopNav button{font-size:25px!important;min-height:50px!important}}
  `;
  document.head.appendChild(css);

  function standardNav(){
    return Array.from(document.body.children).find(el=>el.tagName==='NAV' && !['v115ShipmentNav','v119ShipmentNav','v107LandingNav','v110HomeNav','v120TopNav'].includes(el.id))||null;
  }
  function ensureRestoreInput(){
    let inp=document.getElementById('v120RestoreFile');
    if(!inp){
      inp=document.createElement('input');
      inp.id='v120RestoreFile';inp.type='file';inp.accept='application/json,.json';inp.hidden=true;
      document.body.appendChild(inp);
      inp.onchange=e=>{const f=e.target.files?.[0];if(f)v73RestoreAll(f);e.target.value='';};
    }
    return inp;
  }
  function leaveTopMode(){
    document.body.classList.remove('v120-top-mode');
    document.getElementById('v120TopNav')?.remove();
  }
  function renderTopNav(){
    document.body.classList.add('v120-top-mode');
    document.body.classList.remove('v117-inventory-mode','v115-shipment-mode');
    document.getElementById('v119ShipmentNav')?.style.setProperty('display','none','important');
    document.getElementById('v115ShipmentNav')?.style.setProperty('display','none','important');
    document.getElementById('v107LandingNav')?.remove();
    document.querySelectorAll('.v106-settings-nav,#v110HomeNav,#v101BackDock,.v102-fixed-bottom-nav-card').forEach(el=>el.remove());
    const std=standardNav();if(std)std.style.setProperty('display','none','important');
    let nav=document.getElementById('v120TopNav');
    if(!nav){
      nav=document.createElement('nav');nav.id='v120TopNav';nav.setAttribute('aria-label','トップ画面メニュー');
      nav.innerHTML=`<button id="v120Backup" aria-label="バックアップ" title="バックアップ"><span class="v159-top-icon">💾</span><span class="v159-top-label">バックアップ</span></button><button id="v120Restore" aria-label="バックアップ復元" title="バックアップ復元"><span class="v159-top-icon">♻️</span><span class="v159-top-label">復元</span></button><button id="v120Company" aria-label="会社マスター" title="会社マスター"><span class="v159-top-icon">🏢</span><span class="v159-top-label">会社マスター</span></button>`;
      document.body.appendChild(nav);
      nav.querySelector('#v120Backup').onclick=()=>v130TopBackup();
      nav.querySelector('#v120Restore').onclick=()=>ensureRestoreInput().click();
      nav.querySelector('#v120Company').onclick=()=>{leaveTopMode();companyMasterPage();};
    }
  }

  const oldLanding=globalThis.productLanding;
  if(typeof oldLanding==='function')globalThis.productLanding=function(){
    leaveTopMode();
    const r=oldLanding.apply(this,arguments);
    requestAnimationFrame(()=>{
      const ver=app.querySelector('.v106-version,.pill');if(ver)ver.textContent='v122';
      renderTopNav();
    });
    return r;
  };

  // トップから業務画面へ移る直前にトップ専用ナビを解除。
  ['productChoicePage','openProductContext','v76ShipmentMenu','v114UnifiedShipmentForm','home','hHome','nHome','smHome'].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){leaveTopMode();return fn.apply(this,arguments)};
  });

  // 初回表示がトップなら3ボタンへ置換。
  if(app.querySelector('.v106-landing-card')) renderTopNav();
})();
/* ===== /v120 ===== */

/* ===== v123: shipment nav matches inventory nav typography + Kushiro home cleanup ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    #v119ShipmentNav{
      display:flex!important;justify-content:space-around!important;align-items:stretch!important;
      gap:0!important;padding:7px 2px calc(7px + env(safe-area-inset-bottom))!important;
    }
    #v119ShipmentNav button{
      border:0!important;background:none!important;color:#fff!important;
      font-size:10px!important;min-width:24.5%!important;min-height:auto!important;
      padding:2px 1px!important;border-radius:0!important;line-height:normal!important;
      font-weight:400!important;white-space:nowrap!important;
    }
    #v119ShipmentNav button span.v123-nav-icon{
      display:block!important;font-size:20px!important;line-height:23px!important;font-weight:400!important;
    }
    #v119ShipmentNav button span.v123-nav-label{
      display:block!important;font-size:10px!important;line-height:14px!important;font-weight:400!important;
    }
    #v119ShipmentNav button:active{background:rgba(255,255,255,.10)!important}
    @media(max-width:430px){
      #v119ShipmentNav{padding-left:2px!important;padding-right:2px!important;gap:0!important}
      #v119ShipmentNav button{font-size:10px!important;min-height:auto!important}
      #v119ShipmentNav button span.v123-nav-icon{font-size:20px!important;line-height:23px!important}
      #v119ShipmentNav button span.v123-nav-label{font-size:10px!important;line-height:14px!important}
    }
  `;
  document.head.appendChild(css);

  function faxCount(){
    try{const a=JSON.parse(localStorage.getItem('kombu-v99-fax-box')||'[]');return Array.isArray(a)?a.length:0}catch(_e){return 0}
  }
  function restyleShipmentNav(){
    const nav=document.getElementById('v119ShipmentNav');
    if(!nav)return;
    const data=[
      ['v119Home','🏠','ホーム'],
      ['v119Back','⬅️','戻る'],
      ['v119List','📋','一覧'],
      ['v119Fax','📥 ('+faxCount()+')','FAX']
    ];
    data.forEach(([id,icon,label])=>{
      const b=document.getElementById(id);if(!b)return;
      const desired=`<span class="v123-nav-icon">${icon}</span><span class="v123-nav-label">${label}</span>`;
      if(b.innerHTML!==desired)b.innerHTML=desired;
    });
  }

  // Existing shipment entry points: restyle immediately after their normal nav setup.
  [
    'v76ShipmentMenu','v114UnifiedShipmentForm','shipments','hShipments','nShipments','smShipments','globalShipmentList',
    'shipmentForm','hShipForm','nShipForm','smShipForm','shipmentDetail','hShipDetail','nShipDetail','smShipDetail','openGlobalShipment'
  ].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){const r=fn.apply(this,arguments);restyleShipmentNav();return r};
  });
  if(typeof window.v99FaxBoxPage==='function'){
    const f=window.v99FaxBoxPage;window.v99FaxBoxPage=function(){const r=f.apply(this,arguments);restyleShipmentNav();return r};
  }

  // Keep count/labels fresh after any click or storage update without DOM observers.
  document.addEventListener('click',e=>{if(e.target.closest('#v119ShipmentNav'))setTimeout(restyleShipmentNav,0)},true);
  window.addEventListener('storage',restyleShipmentNav);

  // Kushiro inventory home: remove only the two redundant middle buttons.
  const oldHome=globalThis.home;
  if(typeof oldHome==='function'){
    globalThis.home=function(){
      const r=oldHome.apply(this,arguments);
      ['e','f'].forEach(id=>{const el=document.getElementById(id);if(el&&el.closest('section.grid'))el.remove()});
      const grid=app.querySelector('section.grid');if(grid&&grid.children.length===0)grid.remove();
      return r;
    };
  }

  const oldLanding=globalThis.productLanding;
  if(typeof oldLanding==='function')globalThis.productLanding=function(){const r=oldLanding.apply(this,arguments);const ver=app.querySelector('.v106-version,.pill');if(ver)ver.textContent='v123';return r};
  restyleShipmentNav();
})();
/* ===== /v123 ===== */


/* ===== v124: exact shipment nav typography + draft action in fixed nav ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    #v119ShipmentNav{
      display:flex!important;justify-content:space-around!important;align-items:stretch!important;
      gap:0!important;padding:7px 2px calc(7px + env(safe-area-inset-bottom))!important;
      background:#0b2b55!important;box-shadow:0 -2px 10px #0002!important;
    }
    #v119ShipmentNav button{
      flex:1 1 0!important;min-width:0!important;min-height:0!important;margin:0!important;
      padding:2px 1px!important;border:0!important;border-radius:0!important;background:none!important;
      color:#fff!important;font-size:10px!important;font-weight:400!important;line-height:normal!important;
      box-shadow:none!important;white-space:nowrap!important;text-align:center!important;
    }
    #v119ShipmentNav .v124-nav-icon,
    #v119ShipmentNav .v123-nav-icon{
      display:block!important;font-size:20px!important;line-height:23px!important;font-weight:400!important;
    }
    #v119ShipmentNav .v124-nav-label,
    #v119ShipmentNav .v123-nav-label{
      display:block!important;font-size:10px!important;line-height:14px!important;font-weight:400!important;
    }
    #v119ShipmentNav button:active{background:rgba(255,255,255,.10)!important}
    body[data-v119-nav-mode="shipment"] main{padding-bottom:calc(82px + env(safe-area-inset-bottom))!important}
    .v113-actions{display:none!important}
    @media(max-width:430px){
      #v119ShipmentNav{padding-left:2px!important;padding-right:2px!important;gap:0!important}
      #v119ShipmentNav button{font-size:10px!important}
      #v119ShipmentNav .v124-nav-icon,#v119ShipmentNav .v123-nav-icon{font-size:20px!important;line-height:23px!important}
      #v119ShipmentNav .v124-nav-label,#v119ShipmentNav .v123-nav-label{font-size:10px!important;line-height:14px!important}
    }
  `;
  document.head.appendChild(css);

  function faxCount(){try{const a=JSON.parse(localStorage.getItem('kombu-v99-fax-box')||'[]');return Array.isArray(a)?a.length:0}catch(_e){return 0}}
  function normalize(){
    const nav=document.getElementById('v119ShipmentNav');if(!nav)return;
    const map={v119Home:['🏠','ホーム'],v119Back:['⬅️','戻る'],v119List:['📋','一覧'],v124Draft:['💾','下書き'],v119Fax:['📥 ('+faxCount()+')','FAX']};
    Object.entries(map).forEach(([id,[icon,label]])=>{const b=document.getElementById(id);if(!b)return;b.innerHTML=`<span class="v124-nav-icon">${icon}</span><span class="v124-nav-label">${label}</span>`});
    const d=document.getElementById('v124Draft');if(d)d.style.display=nav.dataset.v124Screen==='form'?'block':'none';
  }
  ['v76ShipmentMenu','v114UnifiedShipmentForm','shipments','hShipments','nShipments','smShipments','globalShipmentList','shipmentForm','hShipForm','nShipForm','smShipForm','shipmentDetail','hShipDetail','nShipDetail','smShipDetail','openGlobalShipment'].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){const r=fn.apply(this,arguments);normalize();return r};
  });
  if(typeof window.v99FaxBoxPage==='function'){const f=window.v99FaxBoxPage;window.v99FaxBoxPage=function(){const r=f.apply(this,arguments);normalize();return r}}
  document.addEventListener('click',e=>{if(e.target.closest('#v119ShipmentNav'))queueMicrotask(normalize)},true);
  window.addEventListener('storage',normalize);
  const oldLanding=globalThis.productLanding;
  if(typeof oldLanding==='function')globalThis.productLanding=function(){const r=oldLanding.apply(this,arguments);const ver=app.querySelector('.v106-version,.pill');if(ver)ver.textContent='v124';return r};
  normalize();
})();
/* ===== /v124 ===== */

/* ===== v125: remove redundant shipment middle buttons + compact FAX count ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    #v119ShipmentNav .v125-fax-count{
      display:inline!important;
      font-size:14px!important;
      line-height:1!important;
      font-weight:400!important;
      vertical-align:baseline!important;
    }
    @media(max-width:430px){#v119ShipmentNav .v125-fax-count{font-size:13px!important}}
  `;
  document.head.appendChild(css);
  function faxCount(){try{const a=JSON.parse(localStorage.getItem('kombu-v99-fax-box')||'[]');return Array.isArray(a)?a.length:0}catch(_e){return 0}}
  function cleanShipmentMenu(){
    const home=document.getElementById('v76Home');
    if(home){const card=home.closest('section.card');if(card)card.remove()}
  }
  function tuneFax(){
    const b=document.getElementById('v119Fax');if(!b)return;
    b.innerHTML=`<span class="v124-nav-icon">📥 <span class="v125-fax-count">(${faxCount()})</span></span><span class="v124-nav-label">FAX</span>`;
  }
  const oldMenu=globalThis.v76ShipmentMenu;
  if(typeof oldMenu==='function')globalThis.v76ShipmentMenu=function(){const r=oldMenu.apply(this,arguments);cleanShipmentMenu();tuneFax();return r};
  ['shipments','hShipments','nShipments','smShipments','globalShipmentList','shipmentForm','hShipForm','nShipForm','smShipForm','shipmentDetail','hShipDetail','nShipDetail','smShipDetail','openGlobalShipment','v114UnifiedShipmentForm'].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){const r=fn.apply(this,arguments);tuneFax();return r};
  });
  if(typeof window.v99FaxBoxPage==='function'){const f=window.v99FaxBoxPage;window.v99FaxBoxPage=function(){const r=f.apply(this,arguments);tuneFax();return r}}
  document.addEventListener('click',e=>{if(e.target.closest('#v119ShipmentNav'))queueMicrotask(tuneFax)},true);
  window.addEventListener('storage',tuneFax);
  const oldLanding=globalThis.productLanding;
  if(typeof oldLanding==='function')globalThis.productLanding=function(){const r=oldLanding.apply(this,arguments);const ver=app.querySelector('.v106-version,.pill');if(ver)ver.textContent='v125';return r};
  cleanShipmentMenu();tuneFax();
})();
/* ===== /v125 ===== */

/* ===== v126: remove inventory product switcher outside inventory mode ===== */
(function(){
  const css=document.createElement('style');
  css.textContent=`
    body[data-v119-nav-mode="shipment"] #v80InventorySwitcher,
    body.v120-top-mode #v80InventorySwitcher{display:none!important}
  `;
  document.head.appendChild(css);

  function clearInventorySwitcher(){
    const sw=document.getElementById('v80InventorySwitcher');
    if(sw)sw.remove();
    document.body.classList.remove('v98-switcher-active');
  }
  function afterShipment(fn){
    return function(){
      clearInventorySwitcher();
      const r=fn.apply(this,arguments);
      clearInventorySwitcher();
      return r;
    };
  }

  // Any shipment screen must never retain the fixed inventory product switcher.
  [
    'v76ShipmentMenu','v114UnifiedShipmentForm','shipments','hShipments','nShipments','smShipments','globalShipmentList',
    'shipmentForm','hShipForm','nShipForm','smShipForm','shipmentDetail','hShipDetail','nShipDetail','smShipDetail','openGlobalShipment'
  ].forEach(name=>{
    const fn=globalThis[name];
    if(typeof fn==='function')globalThis[name]=afterShipment(fn);
  });

  const oldChoice=globalThis.productChoicePage;
  if(typeof oldChoice==='function')globalThis.productChoicePage=function(mode){
    if(mode==='shipment')clearInventorySwitcher();
    const r=oldChoice.apply(this,arguments);
    if(mode==='shipment')clearInventorySwitcher();
    return r;
  };

  const oldOpen=globalThis.openProductContext;
  if(typeof oldOpen==='function')globalThis.openProductContext=function(product,mode){
    if(mode==='shipment')clearInventorySwitcher();
    const r=oldOpen.apply(this,arguments);
    if(mode==='shipment')clearInventorySwitcher();
    return r;
  };

  if(typeof window.v99FaxBoxPage==='function'){
    const f=window.v99FaxBoxPage;
    window.v99FaxBoxPage=afterShipment(f);
  }

  const oldLanding=globalThis.productLanding;
  if(typeof oldLanding==='function')globalThis.productLanding=function(){
    clearInventorySwitcher();
    const r=oldLanding.apply(this,arguments);
    clearInventorySwitcher();
    const ver=app.querySelector('.v106-version,.pill');if(ver)ver.textContent='v127';
    return r;
  };
})();
/* ===== /v126 ===== */


/* ===== v136: 自動保存 + 入力途中下書き復元 + 日時入りバックアップ名 ===== */
(function(){
  const SNAP_KEY='kombu-v136-autosave-snapshot';
  const DRAFT_KEY='kombu-v136-form-drafts';
  let saveTimer=0;

  window.v136BackupTimestamp=function(){
    const d=new Date(),p=n=>String(n).padStart(2,'0');
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'_'+p(d.getHours())+'-'+p(d.getMinutes())+'-'+p(d.getSeconds());
  };

  function safeAllSave(){
    try{if(typeof save==='function')save()}catch(_e){}
    try{if(typeof hSave==='function')hSave()}catch(_e){}
    try{if(typeof nSave==='function')nSave()}catch(_e){}
    try{if(typeof smSave==='function')smSave()}catch(_e){}
    try{
      localStorage.setItem(SNAP_KEY,JSON.stringify({
        savedAt:new Date().toISOString(),version:131,
        kushiro:state,hidaka:hState,nemuro:nState,sanmae:smState
      }));
    }catch(e){console.warn('v136 autosave snapshot',e)}
  }
  function queueAllSave(){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(safeAllSave,350);
  }

  function screenKey(){
    const title=(document.querySelector('header h1')?.textContent||'').trim();
    const h2=(document.querySelector('#app h2')?.textContent||'').trim();
    return (title+'|'+h2).slice(0,160);
  }
  function readDrafts(){try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')||{}}catch(_e){return {}}}
  function writeDrafts(v){try{localStorage.setItem(DRAFT_KEY,JSON.stringify(v))}catch(_e){}}
  function captureDraft(){
    const root=document.getElementById('app');if(!root)return;
    const key=screenKey();if(!key||key==='|')return;
    const vals={};let count=0;
    root.querySelectorAll('input,select,textarea').forEach((el,i)=>{
      if(el.type==='file'||el.type==='hidden'||el.disabled)return;
      const k=el.id||el.name||('f'+i);
      vals[k]=el.type==='checkbox'||el.type==='radio'?{checked:!!el.checked}:{value:el.value};count++;
    });
    if(!count)return;
    const all=readDrafts();all[key]={at:Date.now(),vals};writeDrafts(all);
  }
  function restoreDraft(){
    const root=document.getElementById('app');if(!root)return;
    const key=screenKey(),all=readDrafts(),d=all[key];
    if(!d||Date.now()-Number(d.at||0)>7*24*60*60*1000)return;
    root.querySelectorAll('input,select,textarea').forEach((el,i)=>{
      if(el.type==='file'||el.type==='hidden'||el.disabled)return;
      const k=el.id||el.name||('f'+i),v=d.vals&&d.vals[k];if(!v)return;
      if('checked' in v)el.checked=!!v.checked;
      else if('value' in v){el.value=v.value;try{el.dispatchEvent(new Event('change',{bubbles:true}))}catch(_e){}}
    });
  }
  function clearCurrentDraft(){const key=screenKey(),all=readDrafts();if(all[key]){delete all[key];writeDrafts(all)}}

  // 入力中は350msのデバウンスで保存。性能への影響を抑えつつフリック終了にも備える。
  document.addEventListener('input',()=>{captureDraft();queueAllSave()},true);
  document.addEventListener('change',()=>{captureDraft();queueAllSave()},true);
  document.addEventListener('click',e=>{
    const t=e.target.closest('button');if(!t)return;
    const txt=(t.textContent||'').trim();
    if(/登録|確定|修正を保存|復元|削除|下書き/.test(txt))setTimeout(()=>{safeAllSave();if(/登録|確定|修正を保存/.test(txt))clearCurrentDraft()},0);
  },true);
  window.addEventListener('pagehide',()=>{captureDraft();safeAllSave()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){captureDraft();safeAllSave()}});

  // フォーム系画面を開き直した時だけ、保存されていた入力途中値を復元。
  [
    'form','hForm','nForm','smForm','shipmentForm','hShipForm','nShipForm','smShipForm',
    'v114UnifiedShipmentForm','companyMasterPage'
  ].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){const r=fn.apply(this,arguments);setTimeout(restoreDraft,0);return r};
  });

  // 起動時にも最新状態を確実にローカル保存。
  safeAllSave();

  const oldLanding=globalThis.productLanding;
  if(typeof oldLanding==='function')globalThis.productLanding=function(){
    const r=oldLanding.apply(this,arguments);
    const ver=app.querySelector('.v106-version,.pill');if(ver)ver.textContent='v137';
    return r;
  };
})();
/* ===== /v136 ===== */


/* ===== v136: shipment list bulk-to-FAXBOX + shipment archive ===== */
(function(){
  const FAX_KEY='kombu-v99-fax-box', HIST_KEY='kombu-v136-shipment-history';
  const clone=o=>JSON.parse(JSON.stringify(o));
  const label=p=>({kushiro:'釧路',hidaka:'日高',nemuro:'根室',sanmae:'釧棹'}[p]||p||'');
  function load(k){try{const a=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(a)?a:[]}catch(_e){return []}}
  function save(k,a){localStorage.setItem(k,JSON.stringify(a||[]))}
  function key(p,id){return p+'::'+id}
  function lookup(p,id){
    if(p==='kushiro')return state.shipments.find(x=>x.id===id);
    if(p==='hidaka')return hState.shipments.find(x=>x.id===id);
    if(p==='nemuro')return nState.shipments.find(x=>x.id===id);
    if(p==='sanmae')return smState.shipments.find(x=>x.id===id);
    return null;
  }
  function dest(p,x){
    if(p==='kushiro'){const d=shipmentDest(x);return {name:d.name||'',address:d.address||'',phone:d.phone||''}}
    const d=x?.dest||{};return {name:d.name||x?.destInfo?.name||'',address:d.address||x?.destInfo?.address||'',phone:d.phone||x?.destInfo?.phone||''}
  }
  function source(p,x){
    if(p==='kushiro'){const d=shipmentSource(x);return {name:d.name||'',address:d.address||'',phone:d.phone||''}}
    const d=x?.source||{};return {name:d.name||'',address:d.address||'',phone:d.phone||''}
  }
  function qty(x){return (x?.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0)}
  function bulkVisibleToFax(){
    const trs=[...document.querySelectorAll('#v76ShipBody tr[data-gprod][data-gid]')];
    if(!trs.length)return alert('FAX BOXへ送る出荷指示がありません。');
    const box=load(FAX_KEY);
    let n=0;
    trs.forEach(tr=>{
      const p=tr.dataset.gprod,id=tr.dataset.gid,x=lookup(p,id); if(!x)return;
      const k=key(p,id), item={key:k,product:p,id,addedAt:new Date().toISOString(),shipDate:x.shipDate||'',dest:dest(p,x),source:source(p,x),qty:qty(x),snapshot:clone(x)};
      const bi=box.findIndex(v=>v.key===k); if(bi>=0)box[bi]=item; else box.push(item);
      n++;
    });
    save(FAX_KEY,box);
    alert(n+'件をFAX BOXへ送りました。FAX/PDF実行後、チェックした項目だけ履歴へ移動します。');
    v76ShipmentMenu();
  }
  function v224HistoryFourNav(){
    try{
      // 履歴画面では既存の下部navをすべて非表示にする。
      Array.from(document.querySelectorAll('nav')).forEach(el=>{
        el.style.setProperty('display','none','important');
      });
      document.querySelectorAll(
        '#v115ShipmentNav,#v119ShipmentNav,#v107LandingNav,#v110HomeNav,#v101BackDock,.v102-fixed-bottom-nav-card,.v106-settings-nav'
      ).forEach(el=>el.style.setProperty('display','none','important'));

      document.getElementById('v224HistoryNav')?.remove();

      const nav=document.createElement('div');
      nav.id='v224HistoryNav';
      nav.setAttribute('role','navigation');
      nav.setAttribute('aria-label','出荷依頼 履歴共通メニュー');

      nav.style.setProperty('position','fixed','important');
      nav.style.setProperty('left','0','important');
      nav.style.setProperty('right','0','important');
      nav.style.setProperty('bottom','0','important');
      nav.style.setProperty('width','100%','important');
      nav.style.setProperty('max-width','none','important');
      nav.style.setProperty('min-width','0','important');
      nav.style.setProperty('margin','0','important');
      nav.style.setProperty('padding','7px 10px calc(7px + env(safe-area-inset-bottom))','important');
      nav.style.setProperty('display','grid','important');
      nav.style.setProperty('grid-template-columns','repeat(4,minmax(0,1fr))','important');
      nav.style.setProperty('gap','4px','important');
      nav.style.setProperty('background','#0b2b55','important');
      nav.style.setProperty('border-radius','0','important');
      nav.style.setProperty('box-sizing','border-box','important');
      nav.style.setProperty('transform','none','important');
      nav.style.setProperty('z-index','2147483000','important');
      nav.style.setProperty('box-shadow','0 -2px 10px rgba(0,0,0,.16)','important');

      const makeBtn=(id,icon,label)=>{
        const b=document.createElement('button');
        b.id=id;
        b.type='button';
        b.style.setProperty('display','flex','important');
        b.style.setProperty('flex-direction','column','important');
        b.style.setProperty('align-items','center','important');
        b.style.setProperty('justify-content','center','important');
        b.style.setProperty('width','100%','important');
        b.style.setProperty('min-width','0','important');
        b.style.setProperty('min-height','52px','important');
        b.style.setProperty('margin','0','important');
        b.style.setProperty('padding','5px 2px','important');
        b.style.setProperty('border','0','important');
        b.style.setProperty('border-radius','8px','important');
        b.style.setProperty('background','transparent','important');
        b.style.setProperty('color','#fff','important');
        b.style.setProperty('box-shadow','none','important');
        b.innerHTML=
          '<span style="font-size:22px;line-height:1">'+icon+'</span>'+
          '<span style="font-size:10px;line-height:1.2;margin-top:4px;font-weight:800">'+label+'</span>';
        return b;
      };

      const home=makeBtn('v224Home','🏠','ホーム');
      const back=makeBtn('v224Back','⬅️','戻る');
      const add=makeBtn('v224New','➕','新規');
      const hist=makeBtn('v224History','🕘','履歴');

      home.onclick=()=>globalThis.productLanding?.();
      back.onclick=()=>globalThis.v161ShipmentEntryMenu?.();
      add.onclick=()=>globalThis.v114UnifiedShipmentForm?.();
      hist.onclick=()=>{};

      nav.append(home,back,add,hist);
      document.body.appendChild(nav);

      requestAnimationFrame(()=>{
        Array.from(document.querySelectorAll('nav')).forEach(el=>{
          el.style.setProperty('display','none','important');
        });
        nav.style.setProperty('display','grid','important');
      });

      return nav;
    }catch(e){
      console.error('[KOMBU v2.24] 履歴専用4ボタン生成失敗',e);
      return null;
    }
  }
  window.kombuHistoryFourNav=v224HistoryFourNav;

  function shipmentHistory(){
    const hist=load(HIST_KEY)
      .filter(it=>it.faxboxStatus!=='queued')
      .sort((a,b)=>{
        const aCancelled=(a.faxboxStatus==='cancelled'||a.faxboxStatus==='canceled'||a.snapshot?.status==='cancelled');
        const bCancelled=(b.faxboxStatus==='cancelled'||b.faxboxStatus==='canceled'||b.snapshot?.status==='cancelled');

        // 取消済は必ず最下部
        if(aCancelled!==bCancelled)return aCancelled?1:-1;

        // 同じグループ内は最新順
        const at=String(a.sentAt||a.cancelledAt||a.archivedAt||a.shipDate||'');
        const bt=String(b.sentAt||b.cancelledAt||b.archivedAt||b.shipDate||'');
        return bt.localeCompare(at);
      });
    /* v159: 履歴画面は上部タイトル文字なし。固定ナビは維持。 */
    setHeader('出荷依頼履歴');setNavVisible(false);
    v224HistoryFourNav();

    const escAttr=v=>esc(String(v??''));
    const historyStatus=it=>{
      const cancelled=
        it?.faxboxStatus==='cancelled' ||
        it?.faxboxStatus==='canceled' ||
        it?.snapshot?.status==='cancelled';

      if(cancelled)return '取消済';

      const faxDone=
        it?.faxboxStatus==='sent' ||
        it?.faxboxStatus==='completed' ||
        it?.faxboxStatus==='success' ||
        it?.faxboxStatus==='succeeded' ||
        it?.snapshot?.status==='shipped';

      if(faxDone)return 'FAX済';

      return '処理中';
    };

    const statusBadge=it=>{
      const st=historyStatus(it);
      if(st==='取消済'){
        return '<span style="display:inline-block;padding:4px 8px;border-radius:999px;background:#fee4e2;color:#b42318;font-weight:900">取消済</span>';
      }
      if(st==='FAX済'){
        return '<span style="display:inline-block;padding:4px 8px;border-radius:999px;background:#e8f5e9;color:#216e39;font-weight:900">FAX済</span>';
      }
      return '<span style="display:inline-block;padding:4px 8px;border-radius:999px;background:#eef4fb;color:#173760;font-weight:800">処理中</span>';
    };

    const pdfDisplayName=it=>{
      const raw=String(it?.shipDate||'').trim();
      let date=raw;
      const digits=raw.replace(/\D/g,'');
      if(digits.length>=8){
        date=digits.slice(0,4)+'.'+digits.slice(4,6)+'.'+digits.slice(6,8);
      }else{
        const mm=raw.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
        if(mm)date=mm[1]+'.'+String(mm[2]).padStart(2,'0')+'.'+String(mm[3]).padStart(2,'0');
      }
      const company=String(it?.dest?.name||it?.snapshot?.dest?.name||it?.snapshot?.destInfo?.name||'出荷先未設定')
        .replace(/[\\/:*?"<>|]/g,'')
        .trim()||'出荷先未設定';
      return date+'_'+company+'_出荷指示';
    };

    const historyShipment=it=>{
      if(it?.product==='kushiro')return (state.shipments||[]).find(x=>String(x.id)===String(it.id))||it.snapshot||null;
      if(it?.product==='hidaka')return (hState.shipments||[]).find(x=>String(x.id)===String(it.id))||it.snapshot||null;
      if(it?.product==='nemuro')return (nState.shipments||[]).find(x=>String(x.id)===String(it.id))||it.snapshot||null;
      if(it?.product==='sanmae')return (smState.shipments||[]).find(x=>String(x.id)===String(it.id))||it.snapshot||null;
      return it?.snapshot||null;
    };

    const openHistoryPdf=it=>{
      const ship=historyShipment(it);
      if(!ship)return alert('出荷依頼PDFの元データが見つかりません。');
      try{
        if(it.product==='kushiro'){
          if((state.shipments||[]).some(x=>String(x.id)===String(it.id)) && typeof openShipmentPdfDirect==='function'){
            return openShipmentPdfDirect(it.id);
          }
          return v69OpenShipmentLandscapePdf('釧路産昆布',ship,state.activeYear,v55CanvasKushiro);
        }
        if(it.product==='hidaka')return v69OpenShipmentLandscapePdf('日高昆布',ship,hState.activeYear,v55CanvasHidaka);
        if(it.product==='nemuro')return v69OpenShipmentLandscapePdf('根室産昆布',ship,nState.activeYear,v55CanvasNemuro);
        if(it.product==='sanmae')return v69OpenShipmentLandscapePdf('釧路産棹前昆布',ship,smState.activeYear,v55CanvasSanmae);
      }catch(e){
        console.error(e);
        alert('出荷依頼PDFを表示できませんでした。\n'+String(e?.message||e));
      }
    };

    const getVal=(it,col)=>{
      if(col==='date')return it.shipDate||'';
      if(col==='product')return label(it.product);
      if(col==='source')return it.source?.name||'';
      if(col==='dest')return it.dest?.name||'';
      if(col==='qty')return Number(it.qty||0);
      if(col==='status')return historyStatus(it);
      return '';
    };
    const unique=(col)=>[...new Set(hist.map(it=>String(getVal(it,col))).filter(v=>v!==''))].sort((a,b)=>a.localeCompare(b,'ja',{numeric:true}));
    const makeOptions=(col)=>`<option value="">すべて</option><option value="__asc">↑ 昇順</option><option value="__desc">↓ 降順</option>${unique(col).map(v=>`<option value="${escAttr(v)}">${esc(v)}</option>`).join('')}`;

    app.innerHTML=`<section class="card v159-history-card v159-history-title-marker" style="margin-top:14px;padding:12px">
      <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
        <button type="button" id="v210ResetShipmentHistory" class="btn secondary" style="width:auto;padding:8px 12px;font-size:13px">🧹 テスト履歴を初期化</button>
      </div>
      <div class="tablewrap" style="overflow:auto">
        <table class="v159-compact-table v159-history-table">
          <colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"><col class="c6"><col class="c7"><col class="c8"></colgroup>
          <thead>
            <tr><th>依頼日</th><th>昆布</th><th>出荷人</th><th>出荷先</th><th>個数</th><th>状態</th><th>送り状</th><th>PDF</th></tr>
            <tr class="v159-filter-row">
              <th><select data-col="date">${makeOptions('date')}</select></th>
              <th><select data-col="product">${makeOptions('product')}</select></th>
              <th><select data-col="source">${makeOptions('source')}</select></th>
              <th><select data-col="dest">${makeOptions('dest')}</select></th>
              <th><select data-col="qty">${makeOptions('qty')}</select></th>
<th><select data-col="status">${makeOptions('status')}</select></th>
<th></th>
<th><select disabled><option>--</option></select></th>
            </tr>
          </thead>
          <tbody id="v136HistBody"></tbody>
        </table>
      </div>
    </section>`;

    const resetHistoryBtn=document.getElementById('v210ResetShipmentHistory');
    if(resetHistoryBtn)resetHistoryBtn.onclick=()=>{
      if(!confirm('この端末に残っているテスト用の出荷依頼履歴を全削除します。\n\n在庫・入出庫履歴・会社マスター・FAX送信先は削除しません。\n\n実行しますか？'))return;
      localStorage.removeItem(HIST_KEY);
      alert('この端末の出荷依頼履歴を初期化しました。');
      shipmentHistory();
    };

    const body=document.getElementById('v136HistBody');
    const selects=[...document.querySelectorAll('.v159-filter-row select[data-col]')];
    const stateFilter={};
    let sortCol='',sortDir='';

    function render(){
      let items=hist.slice();
      for(const [col,val] of Object.entries(stateFilter)){
        if(!val||val==='__asc'||val==='__desc')continue;
        items=items.filter(it=>String(getVal(it,col))===val);
      }
      if(sortCol){
        items.sort((a,b)=>{
          const aCancelled=historyStatus(a)==='取消済';
          const bCancelled=historyStatus(b)==='取消済';

          // 取消済はどの並び替えでも最下部を維持
          if(aCancelled!==bCancelled)return aCancelled?1:-1;

          const av=getVal(a,sortCol),bv=getVal(b,sortCol);
          if(sortCol==='qty')return (Number(av)-Number(bv))*(sortDir==='desc'?-1:1);
          return String(av).localeCompare(String(bv),'ja',{numeric:true})*(sortDir==='desc'?-1:1);
        });
      }
body.innerHTML=items.map(it=>`<tr data-hprod="${it.product}" data-hid="${escAttr(it.id||'')}" data-hkey="${escAttr(it.key)}">
  <td>${esc(it.shipDate||'')}</td>
  <td><b>${esc(label(it.product))}</b></td>
  <td>${esc(it.source?.name||'')}</td>
  <td>${esc(it.dest?.name||'')}</td>
  <td>${fmt(it.qty||0)}</td>
  <td>${statusBadge(it)}</td>
  <td><span class="muted">未着</span></td>
  <td><button class="mini v215-history-pdf" data-hpdf="1" title="${escAttr(pdfDisplayName(it))}">${esc(pdfDisplayName(it))}</button></td>
</tr>`).join('')||'<tr><td colspan="8" class="empty">該当する出荷依頼履歴はありません</td></tr>';
    }

    selects.forEach(sel=>sel.onchange=()=>{
      const col=sel.dataset.col,val=sel.value;
      stateFilter[col]=val;
      if(val==='__asc'||val==='__desc'){
        sortCol=col;sortDir=val==='__desc'?'desc':'asc';
        /* 並び替えは1列だけ有効にして分かりやすくする。値絞り込みは他列を維持。 */
        selects.forEach(other=>{
          if(other!==sel&&(other.value==='__asc'||other.value==='__desc')){
            other.value='';stateFilter[other.dataset.col]='';
          }
        });
      }else if(sortCol===col){
        sortCol='';sortDir='';
      }
      render();
    });

    if(body)body.onclick=e=>{
      const tr=e.target.closest('[data-hid]');
      if(!tr)return;
      if(e.target.closest('[data-hpdf]')){
        const it=hist.find(x=>String(x.product)===String(tr.dataset.hprod)&&String(x.id)===String(tr.dataset.hid));
        if(it)openHistoryPdf(it);
      }
    };
    render();
    document.body.dataset.v119NavMode='shipment';

    // v2.22: 履歴画面では旧ナビ処理に依存せず4ボタンを直接確定。
    v224HistoryFourNav();
    requestAnimationFrame(()=>v224HistoryFourNav());
  }
  window.v136ShipmentHistory=shipmentHistory;

  const baseMenu=globalThis.v76ShipmentMenu;
  globalThis.v76ShipmentMenu=function(){
    const r=baseMenu.apply(this,arguments);
const hist=load(HIST_KEY);
const archived=new Set(hist.map(x=>x.key));
const inFax=new Set(load(FAX_KEY).map(x=>x.key));
let histChanged=false;

document.querySelectorAll('#v76ShipBody tr[data-gprod][data-gid]').forEach(tr=>{
  const p=tr.dataset.gprod;
  const id=tr.dataset.gid;
  const k=key(p,id);
  const x=lookup(p,id);

  if(
    x &&
    (x.status==='shipped'||x.status==='cancelled') &&
    !archived.has(k)
  ){
    hist.push({
      key:k,
      product:p,
      id,
      addedAt:x.shippedAt||x.cancelledAt||new Date().toISOString(),
      archivedAt:new Date().toISOString(),
      shipDate:x.shipDate||'',
      dest:dest(p,x),
      source:source(p,x),
      qty:qty(x),
      snapshot:clone(x)
    });

    archived.add(k);
    histChanged=true;
  }

  if(archived.has(k)||inFax.has(k)){
    tr.remove();
  }
});

if(histChanged){
  save(HIST_KEY,hist);
}
    const body=document.getElementById('v76ShipBody');
    if(body && !body.querySelector('tr[data-gid]'))body.innerHTML='<tr><td colspan="9" class="empty">出荷指示はありません</td></tr>';
    const head=document.querySelector('#v76ShipmentList .row');
    if(head && !document.getElementById('v136BulkFax')){
      const right=head.querySelector('.muted');
      const b=document.createElement('button');b.id='v136BulkFax';b.className='mini';
      b.style.cssText='margin-left:auto;background:#173760;color:#fff;border:0;border-radius:9px;padding:7px 9px;font-size:11px;font-weight:800;white-space:nowrap';
      b.innerHTML='📥 まとめてFAXBOXへ';b.onclick=bulkVisibleToFax;
      if(right)right.remove();head.appendChild(b);
    }
    return r;
  };

  function upgradeNav(){
    // v2.16: 旧5ボタン化処理は廃止。
    // 新規出荷依頼と同じ4ボタン
    // 🏠 ホーム / ⬅️ 戻る / ➕ 新規 / 🕘 履歴
    // をそのまま維持する。
    const nav=document.getElementById('v119ShipmentNav');
    if(!nav)return;

    // 過去版で追加されたボタンがDOMに残っていた場合だけ除去。
    nav.querySelector('#v136History')?.remove();
    nav.querySelector('#v119Fax')?.remove();

    nav.style.setProperty('display','grid','important');
    nav.style.setProperty('grid-template-columns','repeat(4,1fr)','important');
  }
  window.v136EnsureHistoryNav=upgradeNav;
  const mo=new MutationObserver(()=>{if(document.body.dataset.v119NavMode==='shipment')upgradeNav()});
  mo.observe(document.body,{childList:true});
  requestAnimationFrame(upgradeNav);
})();
/* ===== /v136 ===== */

/* ===== v159: compact selectable FAXBOX/history tables ===== */
(function(){
 const st=document.createElement('style');st.textContent=`
 .v159-compact-table{min-width:720px;width:100%;font-size:11px;table-layout:fixed}
 .v159-compact-table th,.v159-compact-table td{padding:7px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}
 .v159-compact-table .c0{width:30px}.v159-compact-table .c1{width:82px}.v159-compact-table .c2{width:48px}.v159-compact-table .c3{width:105px}.v159-compact-table .c4{width:105px}.v159-compact-table .c5{width:44px}.v159-compact-table .c6{width:50px}.v159-compact-table .c7{width:66px}
 .v159-compact-table input[type=checkbox]{width:18px;height:18px;margin:0;vertical-align:middle}
 `;document.head.appendChild(st);
})();
/* ===== /v159 ===== */


/* ===== v2.15: shipment history PDF column ===== */
(function(){
 const st=document.createElement('style');
 st.textContent=`
 .v159-history-table col.c8{width:235px!important}
 .v215-history-pdf{
   display:block!important;
   width:100%!important;
   max-width:100%!important;
   text-align:left!important;
   overflow:hidden!important;
   text-overflow:ellipsis!important;
   white-space:nowrap!important;
   font-size:10px!important;
   padding:6px 8px!important;
 }
 @media(max-width:600px){
   .v159-history-table{min-width:820px!important}
   .v159-history-table col.c8{width:220px!important}
   .v215-history-pdf{font-size:9.5px!important}
 }
 `;
 document.head.appendChild(st);
})();
/* ===== /v2.15 ===== */

/* ===== v159: shipment history filters ===== */
(function(){
 const st=document.createElement('style');
 st.textContent=`
 body:has(.v159-history-card) header h1:empty{display:none}
 body:has(.v159-history-card) header:has(h1:empty){min-height:18px;padding-top:0;padding-bottom:0}
 .v159-history-card{margin-bottom:calc(120px + env(safe-area-inset-bottom))}
 .v159-history-table{
  width:100%;
  min-width:900px;
  table-layout:fixed;
}
.v159-history-table th,
.v159-history-table td{
  padding:6px 5px;
  font-size:10.5px;
}
.v159-history-table col.c1{width:9%}
.v159-history-table col.c2{width:10%}
.v159-history-table col.c3{width:16%}
.v159-history-table col.c4{width:16%}
.v159-history-table col.c5{width:8%}
.v159-history-table col.c6{width:10%}
.v159-history-table col.c7{width:10%}
.v159-history-table col.c8{width:8%}
.v159-history-table col.c9{width:10%}
 .v159-filter-row th{padding:3px 2px;background:#f4f7fb}
 .v159-filter-row select{width:100%;min-width:0;height:28px;padding:1px 14px 1px 3px;font-size:9.5px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;color:#17324f}
 .v159-filter-row select:disabled{opacity:.45}
 `;
 document.head.appendChild(st);
})();
/* ===== /v159 ===== */


/* ===== v159: shipment request UI refinements ===== */
(function(){
 const st=document.createElement('style');
 st.textContent=`
 /* unified shipment form */
 .v159-draft-save{margin-top:10px!important;width:100%!important}
 .v159-qty-label{display:flex!important;flex-direction:column!important;align-items:stretch!important}
 .v159-avail{display:block!important;margin-top:6px!important;text-align:left!important;font-size:11px!important;line-height:1.2!important;color:#e7eef8!important;white-space:nowrap!important}
 .v159-delete{font-size:12px!important;padding:6px 9px!important;min-width:56px!important;min-height:38px!important;border-radius:10px!important}
 .v118-delete-wrap{display:flex!important;align-items:flex-end!important;justify-content:flex-end!important}
 #v114AddLine{font-weight:800!important}

 /* history: narrower columns, while keeping dropdown filtering */
 body:has(.v159-history-title-marker) header{background:#0b2b55!important;color:#fff!important}
 .v159-history-table{min-width:560px!important;width:100%!important}
 .v159-history-table th,.v159-history-table td{padding:5px 2px!important;font-size:9.6px!important}
 .v159-history-table col.c1{width:66px!important}
 .v159-history-table col.c2{width:38px!important}
 .v159-history-table col.c3{width:76px!important}
 .v159-history-table col.c4{width:76px!important}
 .v159-history-table col.c5{width:34px!important}
 .v159-history-table col.c6{width:52px!important}
 .v159-history-table col.c7{width:38px!important}
 .v159-history-table col.c8{width:50px!important}
 .v159-history-table col.c9{width:54px!important}
 .v159-filter-row select{height:26px!important;font-size:8.8px!important;padding-left:2px!important;padding-right:12px!important}
 `;
 document.head.appendChild(st);
})();
/* ===== /v159 ===== */


/* ===== v159: back navigation / delete confirm / date styling ===== */
(function(){
 const st=document.createElement('style');
 st.textContent=`
 .v113-date-row .v159-date-box{
   display:flex!important;
   flex-direction:column!important;
   gap:6px!important;
   background:#123665!important;
   color:#fff!important;
   font-weight:800!important;
   border-radius:14px!important;
   padding:10px!important;
   box-sizing:border-box!important;
 }
 .v113-date-row .v159-date-box input{
   width:100%!important;
   box-sizing:border-box!important;
   background:#fff!important;
   color:#102a43!important;
   border:1px solid #d4dde8!important;
   border-radius:9px!important;
   padding:9px 8px!important;
   font-weight:700!important;
 }
 .v159-delete{
   font-size:10px!important;
   padding:4px 7px!important;
   min-width:44px!important;
   min-height:32px!important;
   border-radius:8px!important;
 }
 @media(max-width:430px){
   .v113-date-row .v159-date-box{padding:8px!important;font-size:12px!important}
   .v113-date-row .v159-date-box input{font-size:12.5px!important;padding:8px 6px!important}
   .v159-delete{font-size:9.5px!important;min-width:42px!important;min-height:30px!important;padding:3px 6px!important}
 }
 `;
 document.head.appendChild(st);
})();
/* ===== /v159 ===== */


/* ===== v159: 配送・袋入等 / 備考 ===== */
(function(){
 const st=document.createElement('style');
 st.textContent=`
 .v113-date-row{align-items:start!important}
 .v159-date-stack{display:flex!important;flex-direction:column!important;gap:10px!important;min-width:0!important}
 .v159-date-stack .v159-date-box{width:100%!important;min-width:0!important;overflow:hidden!important}
 .v159-date-stack .v159-date-box input{display:block!important;max-width:100%!important;min-width:0!important;margin:0!important}
 .v159-extra-box{
   display:flex!important;flex-direction:column!important;gap:6px!important;
   width:100%!important;min-width:0!important;box-sizing:border-box!important;
   background:#123665!important;color:#fff!important;font-weight:800!important;
   border-radius:14px!important;padding:10px!important;overflow:hidden!important;
 }
 .v159-extra-box input,.v159-extra-box select{
   display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;
   box-sizing:border-box!important;margin:0!important;
   background:#fff!important;color:#102a43!important;border:1px solid #d4dde8!important;
   border-radius:9px!important;padding:9px 8px!important;font-weight:700!important;
 }
 @media(max-width:430px){
   .v159-extra-box{padding:8px!important;font-size:12px!important}
   .v159-extra-box input,.v159-extra-box select{font-size:12.5px!important;padding:8px 6px!important}
 }
 `;
 document.head.appendChild(st);
})();
/* ===== /v159 ===== */


/* ===== v159: compact top fields + unified edit form ===== */
(function(){
 const st=document.createElement('style');
 st.textContent=`
 .v159-form-title{text-align:center!important;width:100%!important}
 .v159-top-grid{
   display:grid!important;grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
   gap:10px!important;margin-bottom:12px!important;align-items:stretch!important;
 }
 .v159-top-box{
   display:flex!important;flex-direction:column!important;gap:5px!important;
   min-width:0!important;width:100%!important;box-sizing:border-box!important;
   background:#123665!important;color:#fff!important;font-weight:800!important;
   border-radius:14px!important;padding:8px 10px!important;overflow:hidden!important;
 }
 .v159-top-box input,.v159-top-box select{
   display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;
   box-sizing:border-box!important;margin:0!important;
   background:#fff!important;color:#102a43!important;border:1px solid #d4dde8!important;
   border-radius:9px!important;padding:7px 9px!important;height:42px!important;
   font-weight:700!important;-webkit-appearance:none!important;appearance:none!important;
 }
 .v159-date-box{padding-top:7px!important;padding-bottom:7px!important}
 .v159-date-box input{height:40px!important;padding-top:5px!important;padding-bottom:5px!important}
 .v159-top-box select{
   -webkit-appearance:auto!important;appearance:auto!important;
 }
 @media(max-width:430px){
   .v159-top-grid{gap:8px!important}
   .v159-top-box{padding:7px 8px!important;font-size:12px!important}
   .v159-top-box input,.v159-top-box select{height:39px!important;font-size:12.5px!important;padding:5px 7px!important}
   .v159-date-box input{height:37px!important}
 }
 `;
 document.head.appendChild(st);
})();
/* ===== /v159 ===== */


/* ===== v159: v151-style top input arrangement ===== */
(function(){
 const st=document.createElement('style');
 st.textContent=`
 .v159-top-columns{
   display:grid!important;
   grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
   gap:10px!important;
   margin-bottom:12px!important;
   align-items:start!important;
 }
 .v159-top-stack{
   display:flex!important;
   flex-direction:column!important;
   gap:10px!important;
   min-width:0!important;
 }
 .v159-top-stack .v159-top-box{
   width:100%!important;
   min-width:0!important;
   box-sizing:border-box!important;
 }
 @media(max-width:430px){
   .v159-top-columns{gap:8px!important}
   .v159-top-stack{gap:8px!important}
 }
 `;
 document.head.appendChild(st);
})();
/* ===== /v159 ===== */


/* ===== v159: inventory stock nav + labeled home nav ===== */
(function(){
  const st=document.createElement('style');
  st.textContent=`
    #v120TopNav button{
      display:flex!important;
      flex-direction:column!important;
      align-items:center!important;
      justify-content:center!important;
      gap:2px!important;
      font-size:10px!important;
      line-height:normal!important;
      font-weight:400!important;
      min-height:54px!important;
      padding:3px 2px!important;
    }
    #v120TopNav .v159-top-icon{
      display:block!important;
      font-size:22px!important;
      line-height:24px!important;
      font-weight:400!important;
    }
    #v120TopNav .v159-top-label{
      display:block!important;
      font-size:10px!important;
      line-height:13px!important;
      font-weight:400!important;
      white-space:nowrap!important;
    }
    @media(max-width:430px){
      #v120TopNav button{font-size:10px!important;min-height:52px!important}
      #v120TopNav .v159-top-icon{font-size:21px!important;line-height:23px!important}
      #v120TopNav .v159-top-label{font-size:9.5px!important;line-height:12px!important}
    }
  `;
  document.head.appendChild(st);

  /* 在庫管理下部ナビの「在庫表」は、古いExcel/CSV/PDF/ホーム画面へ遷移させず、
     現在選択中昆布の在庫管理トップ（在庫集計表）を直接表示する。 */
  const prevBind=globalThis.bindNav;
  globalThis.bindNav=function(){
    if(typeof prevBind==='function')prevBind.apply(this,arguments);
    if(stockNavBtnEl){
      stockNavBtnEl.onclick=()=>{
        v80InventoryMode=true;
        if(currentProduct==='hidaka')return hHome();
        if(currentProduct==='nemuro')return nHome();
        if(currentProduct==='sanmae')return smHome();
        return home();
      };
    }
  };

  /* すでに在庫管理画面が表示中の場合にも即時反映。 */
  if(document.body.dataset.v119NavMode==='inventory' || document.body.classList.contains('v117-inventory-mode')){
    try{globalThis.bindNav()}catch(_e){}
  }
})();
/* ===== /v159 ===== */


/* ===== v159: direct inventory landing + simplified Other ===== */
(function(){
  /* ホーム→在庫管理は昆布選択画面を挟まず、釧路の在庫管理トップへ直接進む。
     その後は上部4ボタンで釧路・根室・日高・釧棹を切替。 */
  function openInventoryDirect(){
    currentProduct='kushiro';
    v80InventoryMode=true;
    if(typeof openProductContext==='function'){
      return openProductContext('kushiro','inventory');
    }
    if(typeof home==='function')return home();
  }

  const baseLanding=globalThis.productLanding;
  if(typeof baseLanding==='function'){
    globalThis.productLanding=function(){
      const r=baseLanding.apply(this,arguments);
      requestAnimationFrame(()=>{
        const btn=document.getElementById('v106Inventory')||document.getElementById('v105Inventory')||document.getElementById('v73Inventory');
        if(btn)btn.onclick=openInventoryDirect;
      });
      return r;
    };
  }

  /* 旧「在庫管理する昆布を選択」画面は使用しない。
     既存コードから inventory 選択画面を呼ばれても直接在庫トップへ戻す。 */
  const baseChoice=globalThis.productChoicePage;
  if(typeof baseChoice==='function'){
    globalThis.productChoicePage=function(mode){
      if(mode==='inventory')return openInventoryDirect();
      return baseChoice.apply(this,arguments);
    };
  }

  /* 「その他」はPDF一括入庫だけに統一。 */
  function v159OtherPage(){
    v80InventoryMode=true;
    setNavVisible(true);
    if(typeof bindNav==='function')bindNav();
    app.innerHTML=`
      <section class="card v159-other-card" style="margin-top:22px">
        <button class="btn v159-bulk-btn" id="v159BulkPdfBtn">📄 PDFから4種類を一括入庫</button>
        <input id="v159BulkPdfFile" type="file" accept="application/pdf,.pdf" hidden>
      </section>`;
    const btn=document.getElementById('v159BulkPdfBtn');
    const inp=document.getElementById('v159BulkPdfFile');
    if(btn&&inp){
      btn.onclick=()=>inp.click();
      inp.onchange=()=>{
        const f=inp.files?.[0];
        if(f&&typeof v42BulkPdfImport==='function')v42BulkPdfImport(f);
        inp.value='';
      };
    }
    if(typeof v80InjectInventorySwitcher==='function')requestAnimationFrame(v80InjectInventorySwitcher);
  }

  globalThis.exportsPage=v159OtherPage;
  globalThis.hMore=v159OtherPage;
  globalThis.nMore=v159OtherPage;
  globalThis.smMore=v159OtherPage;

  /* 下部ナビの「その他」も現在の昆布に関係なく共通画面へ。 */
  const baseBind=globalThis.bindNav;
  globalThis.bindNav=function(){
    if(typeof baseBind==='function')baseBind.apply(this,arguments);
    if(moreBtnEl)moreBtnEl.onclick=v159OtherPage;
  };

  const style=document.createElement('style');
  style.textContent=`
    .v159-other-card{padding:18px!important}
    .v159-bulk-btn{
      width:100%!important;
      background:#0b2b55!important;
      color:#fff!important;
      font-size:17px!important;
      font-weight:800!important;
      padding:15px 12px!important;
      border-radius:12px!important;
    }
  `;
  document.head.appendChild(style);

  /* 今表示中がホームなら新しいクリック動作も即反映。 */
  requestAnimationFrame(()=>{
    const btn=document.getElementById('v106Inventory')||document.getElementById('v105Inventory')||document.getElementById('v73Inventory');
    if(btn)btn.onclick=openInventoryDirect;
  });
})();
/* ===== /v159 ===== */


/* ===== v159: stock-header shipment button + inventory back navigation ===== */
(function(){
  let backStack=[];
  let currentView=null;
  let restoring=false;

  function productKind(){
    if(currentProduct==='hidaka'||currentProduct==='nemuro'||currentProduct==='sanmae'||currentProduct==='kushiro')return currentProduct;
    const t=(document.querySelector('header')?.textContent||'')+' '+(app?.textContent||'');
    if(t.includes('日高'))return 'hidaka';
    if(t.includes('根室'))return 'nemuro';
    if(t.includes('棹前')||t.includes('釧棹'))return 'sanmae';
    return 'kushiro';
  }
  function activeYear(kind){
    if(kind==='hidaka')return hState.activeYear;
    if(kind==='nemuro')return nState.activeYear;
    if(kind==='sanmae')return smState.activeYear;
    return state.activeYear;
  }
  function renderProductHome(kind){
    currentProduct=kind;
    v80InventoryMode=true;
    if(kind==='hidaka')return hHome();
    if(kind==='nemuro')return nHome();
    if(kind==='sanmae')return smHome();
    return home();
  }
  function descriptorHome(kind){return {type:'home',product:kind}}
  function descriptorForNav(type,kind){
    return {type,product:kind};
  }
  function renderDescriptor(d){
    if(!d)return renderProductHome(productKind());
    const p=d.product||'kushiro';
    currentProduct=p;v80InventoryMode=true;
    if(d.type==='logs'){
      if(p==='hidaka')return hLogs();if(p==='nemuro')return nLogs();if(p==='sanmae')return smLogs();return logs();
    }
    if(d.type==='in'){
      if(p==='hidaka')return hForm('in');if(p==='nemuro')return nForm('in');if(p==='sanmae')return smForm('in');return form('in');
    }
    if(d.type==='more'){
      if(p==='hidaka')return hMore();if(p==='nemuro')return nMore();if(p==='sanmae')return smMore();return exportsPage();
    }
    return renderProductHome(p);
  }
  function setCurrent(d){if(!restoring)currentView=d}
  function pushCurrent(){
    if(restoring)return;
    if(currentView)backStack.push({...currentView});
    if(backStack.length>20)backStack.shift();
  }
  function goBack(){
    const d=backStack.pop()||descriptorHome(productKind());
    restoring=true;
    try{renderDescriptor(d)}finally{
      currentView=d;
      setTimeout(()=>{restoring=false;installInventoryUi()},0);
    }
  }

  function openShipmentForCurrentStock(){
    const p=productKind(),y=activeYear(p);
    /* 在庫画面へ戻れるように現在位置を保持してから出荷依頼へ。 */
    currentView=descriptorHome(p);
    globalThis.v114UnifiedShipmentForm(null,null,{product:p,year:y});
  }

  function injectStockShipmentButton(){
    const vp=app&&app.querySelector('.v92-viewport.v92-home');
    if(!vp)return;
    const card=vp.closest('section.card');if(!card)return;
    const pdf=card.querySelector('#v94HomePdf,.v94-home-pdf-btn');if(!pdf)return;
    let b=card.querySelector('#v159StockShip');
    if(!b){
      b=document.createElement('button');
      b.id='v159StockShip';b.type='button';
      b.className='btn v159-stock-ship-btn';
      b.innerHTML='<span aria-hidden="true">📦</span><span class="v159-ship-label">出荷依頼</span>';
      pdf.insertAdjacentElement('afterend',b);
    }
    b.onclick=openShipmentForCurrentStock;
    setCurrent(descriptorHome(productKind()));
  }

  function styleInventoryBackButton(){
    if(!shipNavBtnEl)return;
    shipNavBtnEl.innerHTML='<span>⬅️</span>戻る';
    shipNavBtnEl.setAttribute('aria-label','戻る');
    shipNavBtnEl.setAttribute('title','戻る');
    shipNavBtnEl.onclick=goBack;
  }

  function bindInventoryActions(){
    const p=productKind();
    styleInventoryBackButton();

    if(homeNavBtnEl)homeNavBtnEl.onclick=()=>{
      pushCurrent();currentView=descriptorHome(p);renderProductHome(p);
    };
    if(stockNavBtnEl)stockNavBtnEl.onclick=()=>{
      pushCurrent();currentView=descriptorHome(p);renderProductHome(p);
    };
    if(logsNavBtnEl)logsNavBtnEl.onclick=()=>{
      pushCurrent();currentView=descriptorForNav('logs',p);
      if(p==='hidaka')hLogs();else if(p==='nemuro')nLogs();else if(p==='sanmae')smLogs();else logs();
    };
    if(inNavBtnEl)inNavBtnEl.onclick=()=>{
      pushCurrent();currentView=descriptorForNav('in',p);
      if(p==='hidaka')hForm('in');else if(p==='nemuro')nForm('in');else if(p==='sanmae')smForm('in');else form('in');
    };
    if(moreBtnEl)moreBtnEl.onclick=()=>{
      pushCurrent();currentView=descriptorForNav('more',p);
      if(p==='hidaka')hMore();else if(p==='nemuro')nMore();else if(p==='sanmae')smMore();else exportsPage();
    };
  }

  function installInventoryUi(){
    if(document.body.dataset.v119NavMode!=='inventory' && !document.body.classList.contains('v117-inventory-mode'))return;
    styleInventoryBackButton();
    bindInventoryActions();
    injectStockShipmentButton();
  }

  /* Final bind override so older bindNav patches cannot restore 出荷指示 in inventory nav. */
  const oldBind=globalThis.bindNav;
  globalThis.bindNav=function(){
    if(typeof oldBind==='function')oldBind.apply(this,arguments);
    requestAnimationFrame(installInventoryUi);
  };

  /* Every inventory-home render gets the new 📦 button next to PDF. */
  ['home','hHome','nHome','smHome'].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){
      const r=fn.apply(this,arguments);
      currentView=descriptorHome(productKind());
      requestAnimationFrame(installInventoryUi);
      return r;
    };
  });

  /* Product switcher: remember the product screen immediately before switching. */
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-v80inv]');
    if(!b||restoring)return;
    pushCurrent();
    const target=b.getAttribute('data-v80inv');
    setTimeout(()=>{currentView=descriptorHome(target||productKind());installInventoryUi()},0);
  },true);

  const css=document.createElement('style');
  css.textContent=`
    .v94-home-year-pdf-row{gap:7px!important}
    .v159-stock-ship-btn{
      width:auto!important;min-width:62px!important;flex:0 0 auto!important;
      margin:0!important;padding:7px 9px!important;border-radius:10px!important;
      font-size:12.5px!important;font-weight:700!important;line-height:1.05!important;
      display:flex!important;align-items:center!important;gap:4px!important;
      background:#0b2b55!important;color:#fff!important;
    }
    .v159-stock-ship-btn>span:first-child{font-size:16px!important;line-height:1!important}
    .v159-ship-label{font-size:11px!important;white-space:nowrap!important}
    body[data-v119-nav-mode="inventory"] > nav.v119-standard-nav button{min-width:16.4%!important}
    @media(max-width:430px){
      .v159-stock-ship-btn{min-width:56px!important;padding:6px 7px!important}
      .v159-stock-ship-btn>span:first-child{font-size:15px!important}
      .v159-ship-label{font-size:10px!important}
    }
  `;
  document.head.appendChild(css);

  requestAnimationFrame(installInventoryUi);
})();
/* ===== /v159 ===== */


/* ===== v159: reliable per-product history + atomic 4-product bulk import UI ===== */
(function(){
  let historyMode=false;
  const labels={kushiro:'釧路',hidaka:'日高',nemuro:'根室',sanmae:'釧棹'};

  function rowsFor(p){
    if(p==='hidaka')return (hState.records||[]).map(r=>({
      raw:r,date:r.date||'',type:r.type,year:r.year||'',coop:r.location||'',section:r.section||'',grade:r.grade||'',qty:r.qty,memo:r.memo||''
    }));
    if(p==='nemuro')return (nState.records||[]).map(r=>({
      raw:r,date:r.date||'',type:r.type,year:r.year||'',coop:r.coop||'',section:r.season||'',grade:[r.group,r.item].filter(Boolean).join(' / '),qty:r.qty,memo:r.memo||''
    }));
    if(p==='sanmae')return (smState.records||[]).map(r=>({
      raw:r,date:r.date||'',type:r.type,year:r.year||'',coop:r.coop||'',section:r.season||'',grade:[r.group,r.item].filter(Boolean).join(' / '),qty:r.qty,memo:r.memo||''
    }));
    return (state.records||[]).map(r=>({
      raw:r,date:r.date||'',type:r.type,year:r.year||'',coop:r.coop||'',section:r.season||'',grade:[r.group,r.item].filter(Boolean).join(' / '),qty:r.qty,memo:r.memo||''
    }));
  }
  function editRecord(p,id){
    historyMode=false;
    if(p==='hidaka')return hForm(null,id);
    if(p==='nemuro')return nForm(null,id);
    if(p==='sanmae')return smForm(null,id);
    return form(null,id);
  }
  function deleteRecord(p,id){
    if(!confirm('本当に削除しますか？'))return;
    if(p==='hidaka'){hState.records=hState.records.filter(r=>r.id!==id);hSave()}
    else if(p==='nemuro'){nState.records=nState.records.filter(r=>r.id!==id);nSave()}
    else if(p==='sanmae'){smState.records=smState.records.filter(r=>r.id!==id);smSave()}
    else {state.records=state.records.filter(r=>r.id!==id);save()}
    renderHistory(p);
  }
  function renderHistory(p){
    historyMode=true;
    currentProduct=p;
    v80InventoryMode=true;
    setHeader('在庫管理');
    setNavVisible(true);
    const a=rowsFor(p).slice().sort((x,y)=>{
      const d=String(y.date).localeCompare(String(x.date));
      return d||String(y.raw?.id||'').localeCompare(String(x.raw?.id||''));
    });
    app.innerHTML=`<section class="card v159-history-card">
      <h2>入出庫履歴</h2>
      <div class="v159-history-caption">${labels[p]}の履歴　${a.length}件</div>
      <div class="tablewrap"><table class="v159-history-table">
        <thead><tr><th>日付</th><th>区分</th><th>生産年度</th><th>漁協・産地</th><th>区分</th><th>等級</th><th>数量</th><th>備考</th><th>操作</th></tr></thead>
        <tbody>${a.map(x=>`<tr>
          <td>${esc(x.date)}</td><td>${x.type==='in'?'入庫':'出庫'}</td><td>${esc(x.year)}</td>
          <td>${esc(x.coop)}</td><td>${esc(x.section)}</td><td>${esc(x.grade)}</td>
          <td>${fmt(Number(x.qty||0))}</td><td>${esc(x.memo)}</td>
          <td><button class="mini" data-v159-edit="${esc(x.raw.id)}">修正</button> <button class="mini danger" data-v159-del="${esc(x.raw.id)}">削除</button></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </section>`;
    app.querySelectorAll('[data-v159-edit]').forEach(b=>b.onclick=()=>editRecord(p,b.dataset.v159Edit));
    app.querySelectorAll('[data-v159-del]').forEach(b=>b.onclick=()=>deleteRecord(p,b.dataset.v159Del));
    if(typeof bindNav==='function')bindNav();
    if(typeof v80InjectInventorySwitcher==='function')requestAnimationFrame(v80InjectInventorySwitcher);
  }

  /* Replace all four history entry points with the same reliable renderer. */
  globalThis.logs=()=>renderHistory('kushiro');
  globalThis.hLogs=()=>renderHistory('hidaka');
  globalThis.nLogs=()=>renderHistory('nemuro');
  globalThis.smLogs=()=>renderHistory('sanmae');

  /* Top four buttons: while on history, they sort/switch history only, never stock table. */
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-v80inv]');
    if(!b||!historyMode)return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const p=b.getAttribute('data-v80inv');
    if(labels[p])renderHistory(p);
  },true);

  /* Leaving history through other inventory functions resets this special switcher behavior. */
  ['home','hHome','nHome','smHome','form','hForm','nForm','smForm','exportsPage','hMore','nMore','smMore'].forEach(name=>{
    const fn=globalThis[name];if(typeof fn!=='function')return;
    globalThis[name]=function(){historyMode=false;return fn.apply(this,arguments)};
  });

  const st=document.createElement('style');
  st.textContent=`
    .v159-history-card{padding:15px!important}
    .v159-history-card h2{margin:0 0 8px!important}
    .v159-history-caption{font-size:12px;color:#647b95;margin-bottom:8px}
    .v159-history-table{min-width:900px!important;border-collapse:collapse!important}
    .v159-history-table th,.v159-history-table td{padding:7px 8px!important;font-size:12px!important;white-space:nowrap!important}
    .v159-history-table th{background:#e8eff7!important}
  `;
  document.head.appendChild(st);
})();
/* ===== /v159 ===== */


/* ===== v159: Windows / desktop bottom-nav alignment ===== */
(function(){
  const st=document.createElement('style');
  st.textContent=`
    @media (min-width: 768px){
      #bottomNav,
      nav#bottomNav,
      .v119-standard-nav,
      #v119ShipmentNav,
      #v120TopNav{
        left:50%!important;
        right:auto!important;
        transform:translateX(-50%)!important;
        width:min(980px, calc(100vw - 32px))!important;
        max-width:980px!important;
        margin:0!important;
        box-sizing:border-box!important;
      }

      #bottomNav,
      nav#bottomNav,
      .v119-standard-nav{
        display:grid!important;
        grid-template-columns:repeat(6,minmax(0,1fr))!important;
        align-items:stretch!important;
        justify-content:center!important;
        gap:0!important;
      }

      #bottomNav button,
      nav#bottomNav button,
      .v119-standard-nav button{
        width:100%!important;
        min-width:0!important;
        max-width:none!important;
        flex:1 1 0!important;
        margin:0!important;
        padding:8px 4px!important;
        box-sizing:border-box!important;
      }

      #v119ShipmentNav{
        display:grid!important;
        grid-template-columns:repeat(5,minmax(0,1fr))!important;
        gap:0!important;
      }
      #v119ShipmentNav button{
        width:100%!important;
        min-width:0!important;
        max-width:none!important;
        margin:0!important;
        box-sizing:border-box!important;
      }

      #v120TopNav{
        display:grid!important;
        grid-template-columns:repeat(3,minmax(0,1fr))!important;
        gap:0!important;
      }
      #v120TopNav button{
        width:100%!important;
        min-width:0!important;
        margin:0!important;
      }

      body{
        padding-bottom:96px!important;
      }
    }

    @media (min-width: 1200px){
      #bottomNav,
      nav#bottomNav,
      .v119-standard-nav,
      #v119ShipmentNav,
      #v120TopNav{
        max-width:1040px!important;
        width:1040px!important;
      }
    }
  `;
  document.head.appendChild(st);
})();
/* ===== /v159 ===== */
/* ===== v161 Step1: 出荷依頼入口整理（安全追加版） ===== */
(function(){
  'use strict';

  /*
    既存機能を変更せず、入口だけ整理する。
    ・新規出荷依頼 → v114UnifiedShipmentForm()
    ・出荷依頼一覧 → v76ShipmentMenu()
    ・出荷依頼履歴 → v136ShipmentHistory()
  */
  function v161ShipmentEntryMenu(){
    document.getElementById('v224HistoryNav')?.remove();
    currentProduct=null;
    v80InventoryMode=false;
    setHeader('出荷依頼');
    setNavVisible(false);
    window.kombuForceShipmentFourNav?.('entry');

    app.innerHTML=`
      <section class="card" style="margin-top:14px;padding:16px">
        <h2 style="margin:0 0 6px;font-size:20px">📦 出荷依頼</h2>
        <div class="muted" style="font-size:12px">
          新規作成・現在の出荷依頼・過去の履歴をここから選択します。
        </div>
      </section>

      <section class="card" style="margin-top:12px;padding:14px">
        <div style="display:grid;grid-template-columns:1fr;gap:12px">

          <button class="action green" id="v161NewShipment" type="button"
            style="text-align:left;padding:18px">
            ＋ 新規出荷依頼
            <small>4種類の昆布を共通フォームから入力</small>
          </button>
<button class="action purple" id="v161ShipmentHistory" type="button"
            style="text-align:left;padding:18px">
            🕘 出荷依頼履歴
            <small>完了・保存済みの出荷依頼を確認</small>
          </button>

        </div>
      </section>
    `;

    document.getElementById('v161NewShipment').onclick=function(){
      globalThis.v114UnifiedShipmentForm();
    };
document.getElementById('v161ShipmentHistory').onclick=function(){
      try{
        if(typeof window.v136ShipmentHistory!=='function'){
          throw new Error('出荷依頼履歴を読み込めません。');
        }
        window.v136ShipmentHistory();
      }catch(e){
        console.error('[KOMBU v2.21] 履歴表示エラー',e);
        alert('出荷依頼履歴を開けませんでした。\n'+String(e?.message||e));
      }
    };

    // v164.4: 中段「ホームへ戻る」ボタンは削除済み。
    // 下部固定ナビのホームを使用するため、旧ボタンへのイベント設定は行わない。

    // v2.20: 画面を先に表示してから出荷依頼用4ボタンを適用。
    // productChoicePage / setMode の古いラップ連鎖には依存しない。
    document.body.dataset.v119NavMode='shipment';
    window.kombuForceShipmentFourNav?.('entry');
    requestAnimationFrame(()=>window.kombuForceShipmentFourNav?.('entry'));
  }

  globalThis.v161ShipmentEntryMenu=v161ShipmentEntryMenu;

  /*
    v160.7では productChoicePage('shipment') が
    v114UnifiedShipmentForm() を直接開く。
    最終ロード後に入口だけ v161 メニューへ差し替える。
    inventory 等、shipment以外の処理は元関数をそのまま使用する。
  */
  const v161BaseProductChoicePage=globalThis.productChoicePage;

  if(typeof v161BaseProductChoicePage==='function'){
    globalThis.productChoicePage=function(mode){
      if(mode==='shipment'){
        return v161ShipmentEntryMenu();
      }
      return v161BaseProductChoicePage.apply(this,arguments);
    };
  }

  console.info('[KOMBU v161 Step1] 出荷依頼入口整理を有効化');
})();
/* ===== /v161 Step1 ===== */
/* ===== v161 Step4: 出荷依頼詳細・確定導線整理 ===== */
(function(){
  'use strict';

  const productLabel={
    kushiro:'釧路産昆布',
    hidaka:'日高昆布',
    nemuro:'根室産昆布',
    sanmae:'釧路産棹前昆布'
  };

  function v161GetShipment(product,id){
    if(product==='kushiro')return (state.shipments||[]).find(x=>x.id===id)||null;
    if(product==='hidaka')return (hState.shipments||[]).find(x=>x.id===id)||null;
    if(product==='nemuro')return (nState.shipments||[]).find(x=>x.id===id)||null;
    if(product==='sanmae')return (smState.shipments||[]).find(x=>x.id===id)||null;
    return null;
  }

  function v161StatusJa(status){
    return {
      draft:'下書き',
      confirmed:'確定・在庫反映済',
      shipped:'出荷済',
      cancelled:'取消済'
    }[status]||String(status||'');
  }

  function v161StatusNote(status){
    if(status==='draft')return 'まだ在庫には反映されていません。内容を確認してから確定してください。';
    if(status==='confirmed')return '在庫表へ反映済みです。次はPDF・送り状確認後に出荷済へ進めます。';
    if(status==='shipped')return '出荷済みです。入出庫履歴へ正式な出庫記録が作成されています。';
    if(status==='cancelled')return '取消済みです。';
    return '';
  }

  function v161DecorateShipmentDetail(product,id){
    const s=v161GetShipment(product,id);
    if(!s||!app)return;

    const firstCard=app.querySelector('section.card');
    if(!firstCard)return;

    if(document.getElementById('v161DetailStatusCard'))return;

    const total=(s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0);
    const status=document.createElement('section');
    status.id='v161DetailStatusCard';
    status.className='card';
    status.style.cssText='margin-top:12px;padding:14px';

    let badgeBg='#eef4fb',badgeColor='#173760';
    if(s.status==='draft'){badgeBg='#fff4d6';badgeColor='#7a4b00'}
    if(s.status==='confirmed'){badgeBg='#e8f5e9';badgeColor='#216e39'}
    if(s.status==='shipped'){badgeBg='#e7edf5';badgeColor='#102a43'}
    if(s.status==='cancelled'){badgeBg='#fee4e2';badgeColor='#b42318'}

    status.innerHTML=`
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <div>
          <div style="font-size:12px;color:#627d98;font-weight:800">現在の状態</div>
          <div style="font-size:20px;font-weight:900;margin-top:3px">${esc(v161StatusJa(s.status))}</div>
        </div>
        <span style="display:inline-block;padding:7px 12px;border-radius:999px;background:${badgeBg};color:${badgeColor};font-weight:900">
          ${esc(productLabel[product]||product)}　${esc(s.id||'')}
        </span>
      </div>
      <div class="note" style="margin-top:10px">${esc(v161StatusNote(s.status))}</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px">
        <div class="stat">出荷日<b style="font-size:17px">${esc(s.shipDate||'未指定')}</b></div>
        <div class="stat">合計数量<b style="font-size:17px">${fmt(total)}</b></div>
      </div>
    `;
    firstCard.parentNode.insertBefore(status,firstCard);

    // 下書きの「確定・在庫反映」だけ、実行直前に最終確認を追加。
    if(s.status==='draft'){
      const confirmIds=['confirmShipmentBtn','hconf','nconf','smconf'];
      const btn=confirmIds.map(x=>document.getElementById(x)).find(Boolean);

      if(btn&&!btn.dataset.v161Guarded){
        btn.dataset.v161Guarded='1';
        const original=btn.onclick;
        btn.textContent='✅ 確定・在庫反映';
        btn.onclick=function(ev){
          const latest=v161GetShipment(product,id);
          if(!latest||latest.status!=='draft'){
            alert('この出荷依頼はすでに処理されています。最新状態を表示します。');
            return globalThis.openGlobalShipment(product,id);
          }

          const src=product==='kushiro'
            ? shipmentSource(latest)
            : (latest.source||{});
          const dst=product==='kushiro'
            ? shipmentDest(latest)
            : (latest.dest||latest.destInfo||{});
          const q=(latest.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0);

          const ok=window.confirm(
            'この内容で出荷依頼を確定します。\n\n'+
            '昆布：'+(productLabel[product]||product)+'\n'+
            '出荷元：'+(src.name||'')+'\n'+
            '出荷先：'+(dst.name||'')+'\n'+
            '出荷日：'+(latest.shipDate||'')+'\n'+
            '合計数量：'+fmt(q)+'\n\n'+
            '確定すると在庫表へ反映されます。\nよろしいですか？'
          );
          if(!ok)return;

          btn.disabled=true;
          btn.textContent='確定処理中…';

          try{
            if(typeof original==='function')original.call(btn,ev);
          }finally{
            setTimeout(()=>{
              const now=v161GetShipment(product,id);
              if(now&&now.status==='draft'){
                btn.disabled=false;
                btn.textContent='✅ 確定・在庫反映';
              }
            },800);
          }
        };
      }
    }

    // 確定後は確定ボタンが存在しないことを保証し、状態を明示。
    if(s.status!=='draft'){
      ['confirmShipmentBtn','hconf','nconf','smconf'].forEach(x=>{
        const b=document.getElementById(x);
        if(b)b.remove();
      });
    }
  }

  const v161BaseOpenGlobalShipment=globalThis.openGlobalShipment;
  if(typeof v161BaseOpenGlobalShipment==='function'){
    globalThis.openGlobalShipment=function(product,id){
      const r=v161BaseOpenGlobalShipment.apply(this,arguments);
      v161DecorateShipmentDetail(product,id);
      return r;
    };
  }

  // 詳細画面内部から自分自身を再描画する場合にもStep4表示を維持する。
  const detailTargets=[
    ['shipmentDetail','kushiro'],
    ['hShipDetail','hidaka'],
    ['nShipDetail','nemuro'],
    ['smShipDetail','sanmae']
  ];
  detailTargets.forEach(([name,product])=>{
    const fn=globalThis[name];
    if(typeof fn!=='function')return;
    globalThis[name]=function(id){
      const r=fn.apply(this,arguments);
      v161DecorateShipmentDetail(product,id);
      return r;
    };
  });

  console.info('[KOMBU v161 Step4] 出荷依頼詳細・確定導線整理を有効化');
})();
/* ===== /v161 Step4 ===== */
/* ===== v161 Step5: 確定後 → 帳票 → 出荷済 → 履歴 導線整理 ===== */
(function(){
  'use strict';

  const labels={
    kushiro:'釧路産昆布',
    hidaka:'日高昆布',
    nemuro:'根室産昆布',
    sanmae:'釧路産棹前昆布'
  };

  function getShipment(product,id){
    if(product==='kushiro')return (state.shipments||[]).find(x=>x.id===id)||null;
    if(product==='hidaka')return (hState.shipments||[]).find(x=>x.id===id)||null;
    if(product==='nemuro')return (nState.shipments||[]).find(x=>x.id===id)||null;
    if(product==='sanmae')return (smState.shipments||[]).find(x=>x.id===id)||null;
    return null;
  }

  function findFirst(ids){
    return ids.map(id=>document.getElementById(id)).find(Boolean)||null;
  }

  function decorate(product,id){
    const s=getShipment(product,id);
    if(!s||!app)return;
    if(document.getElementById('v161Step5Flow'))return;

    const step=document.createElement('section');
    step.id='v161Step5Flow';
    step.className='card';
    step.style.cssText='margin-top:12px;padding:14px';

    const isConfirmed=s.status==='confirmed';
    const isShipped=s.status==='shipped';

    step.innerHTML=`
      <h3 style="margin:0 0 10px">⑤ 確定後の処理</h3>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        <div class="stat" style="${isConfirmed||isShipped?'border:2px solid #2f855a':''}">
          1. 在庫反映
          <b style="font-size:15px">${isConfirmed||isShipped?'完了':'未完了'}</b>
        </div>
        <div class="stat">
          2. 帳票確認
          <b style="font-size:15px">${isShipped?'確認済想定':'PDF/出荷指示書'}</b>
        </div>
        <div class="stat" style="${isShipped?'border:2px solid #2f855a':''}">
          3. 出荷処理
          <b style="font-size:15px">${isShipped?'出荷済':'未完了'}</b>
        </div>
      </div>
      <div class="note" style="margin-top:10px">
        ${isConfirmed
          ?'在庫反映は完了しています。帳票を確認してから「出荷済」にしてください。'
          :isShipped
            ?'出荷済みです。この出荷依頼は履歴から確認できます。'
            :'下書きのため、先に確定・在庫反映を行ってください。'}
      </div>
      <div id="v161Step5Actions" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"></div>
    `;

    const statusCard=document.getElementById('v161DetailStatusCard');
    if(statusCard&&statusCard.parentNode){
      statusCard.parentNode.insertBefore(step,statusCard.nextSibling);
    }else{
      app.insertBefore(step,app.firstChild);
    }

    const actions=document.getElementById('v161Step5Actions');

    const pdfBtn=findFirst([
      'pdfFaxBtn','pdfBtn','shipmentPdfBtn','shipPdfBtn',
      'hpdfs','npdfs','smpdfs'
    ]);

    const shippedBtn=findFirst([
      'shipped','hshipped','nshipped','smshipped'
    ]);

    if((isConfirmed||isShipped)&&pdfBtn){
      const b=document.createElement('button');
      b.className='btn secondary';
      b.type='button';
      b.textContent='📄 出荷指示書・PDFを確認';
      b.onclick=()=>pdfBtn.click();
      actions.appendChild(b);
    }

    if(isConfirmed&&shippedBtn){
      const b=document.createElement('button');
      b.className='btn';
      b.type='button';
      b.textContent='🚚 出荷済にする';
      b.onclick=()=>{
        const latest=getShipment(product,id);
        if(!latest||latest.status!=='confirmed'){
          alert('最新状態を確認します。');
          return globalThis.openGlobalShipment(product,id);
        }
        shippedBtn.click();
      };
      actions.appendChild(b);
    }

    if(isShipped){
      const hist=document.createElement('button');
      hist.className='btn';
      hist.type='button';
      hist.textContent='🕘 出荷依頼履歴を開く';
      hist.onclick=()=>{
        if(typeof window.v136ShipmentHistory==='function')window.v136ShipmentHistory();
        else globalThis.v76ShipmentMenu();
      };
      actions.appendChild(hist);

      const list=document.createElement('button');
      list.className='btn secondary';
      list.type='button';
      list.textContent='📋 出荷依頼一覧へ';
      list.onclick=()=>globalThis.v76ShipmentMenu();
      actions.appendChild(list);
    }

    // 確定済・出荷済では既存ボタンの文言も分かりやすくする。
    if(pdfBtn&&(isConfirmed||isShipped)){
      pdfBtn.textContent='📄 帳票表示・PDF';
    }
    if(shippedBtn&&isConfirmed){
      shippedBtn.textContent='🚚 出荷済';
    }

    // iPhoneでも縦1列になるよう追加CSS
    if(!document.getElementById('v161Step5Style')){
      const style=document.createElement('style');
      style.id='v161Step5Style';
      style.textContent='@media(max-width:700px){#v161Step5Flow>div[style*="grid-template-columns:repeat(3"]{grid-template-columns:1fr!important}#v161Step5Actions{grid-template-columns:1fr!important}}';
      document.head.appendChild(style);
    }
  }

  const baseOpen=globalThis.openGlobalShipment;
  if(typeof baseOpen==='function'){
    globalThis.openGlobalShipment=function(product,id){
      const r=baseOpen.apply(this,arguments);
      decorate(product,id);
      return r;
    };
  }

  [
    ['shipmentDetail','kushiro'],
    ['hShipDetail','hidaka'],
    ['nShipDetail','nemuro'],
    ['smShipDetail','sanmae']
  ].forEach(([name,product])=>{
    const fn=globalThis[name];
    if(typeof fn!=='function')return;
    globalThis[name]=function(id){
      const r=fn.apply(this,arguments);
      decorate(product,id);
      return r;
    };
  });

  console.info('[KOMBU v161 Step5] 確定後フロー整理を有効化');
})();
/* ===== /v161 Step5 ===== */
/* ===== v161 Step5.2: 確定後処理表示 高速化版 ===== */
(function(){
  'use strict';

  const LABELS={
    kushiro:'釧路産昆布',
    hidaka:'日高昆布',
    nemuro:'根室産昆布',
    sanmae:'釧路産棹前昆布'
  };

  function getShipment(product,id){
    if(product==='kushiro')return (state.shipments||[]).find(x=>x.id===id)||null;
    if(product==='hidaka')return (hState.shipments||[]).find(x=>x.id===id)||null;
    if(product==='nemuro')return (nState.shipments||[]).find(x=>x.id===id)||null;
    if(product==='sanmae')return (smState.shipments||[]).find(x=>x.id===id)||null;
    return null;
  }

  function findFirst(ids){
    for(const id of ids){
      const el=document.getElementById(id);
      if(el)return el;
    }
    return null;
  }

  function draw(product,id){
    const s=getShipment(product,id);
    if(!s||!window.app)return false;

    const old=document.getElementById('v161Step5Flow');
    if(old)old.remove();

    const detailStatus=document.getElementById('v161DetailStatusCard');
    const firstCard=app.querySelector('section.card');
    const anchor=detailStatus||firstCard;
    if(!anchor||!anchor.parentNode)return false;

    const confirmed=s.status==='confirmed';
    const shipped=s.status==='shipped';
    const draft=s.status==='draft';

    const box=document.createElement('section');
    box.id='v161Step5Flow';
    box.className='card';
    box.style.cssText='margin-top:12px;padding:14px';

    box.innerHTML=`
      <h3 style="margin:0 0 10px">⑤ 確定後の処理</h3>

      <div class="v161-step52-grid">
        <div class="stat" style="${confirmed||shipped?'outline:2px solid #2f855a':''}">
          ① 在庫反映
          <b style="font-size:15px">${confirmed||shipped?'完了':'未完了'}</b>
        </div>
        <div class="stat">
          ② 帳票確認
          <b style="font-size:15px">出荷指示書・PDF</b>
        </div>
        <div class="stat" style="${shipped?'outline:2px solid #2f855a':''}">
          ③ 出荷処理
          <b style="font-size:15px">${shipped?'出荷済':'未完了'}</b>
        </div>
      </div>

      <div class="note" style="margin-top:10px">
        ${draft
          ?'まだ下書きです。先に「確定・在庫反映」を行ってください。'
          :confirmed
            ?'在庫反映は完了しています。帳票を確認してから「出荷済」にしてください。'
            :shipped
              ?'出荷済みです。出荷依頼履歴から確認できます。'
              :'この出荷依頼は取消済みです。'}
      </div>

      <div id="v161Step52Actions" class="v161-step52-actions"></div>
    `;

    anchor.parentNode.insertBefore(box,anchor.nextSibling);

    const actions=document.getElementById('v161Step52Actions');

    const pdfBtn=findFirst([
      'pdf','hpdfs','npdfs','smpdfs',
      'pdfFaxBtn','pdfBtn','shipmentPdfBtn','shipPdfBtn'
    ]);

    const shippedBtn=findFirst([
      'shippedShipmentBtn','hshipped','nshipped','smshipped','shipped'
    ]);

    if((confirmed||shipped)&&pdfBtn){
      const b=document.createElement('button');
      b.className='btn secondary';
      b.type='button';
      b.textContent='📄 出荷指示書・PDFを確認';
      b.onclick=()=>pdfBtn.click();
      actions.appendChild(b);
    }

    if(confirmed&&shippedBtn){
      const b=document.createElement('button');
      b.className='btn';
      b.type='button';
      b.textContent='🚚 出荷済にする';
      b.onclick=()=>{
        const latest=getShipment(product,id);
        if(!latest||latest.status!=='confirmed'){
          alert('状態が更新されています。最新内容を表示します。');
          return globalThis.openGlobalShipment(product,id);
        }
        shippedBtn.click();
      };
      actions.appendChild(b);
    }

    if(shipped){
      const h=document.createElement('button');
      h.className='btn';
      h.type='button';
      h.textContent='🕘 出荷依頼履歴を開く';
      h.onclick=()=>{
        if(typeof window.v136ShipmentHistory==='function')window.v136ShipmentHistory();
        else globalThis.v76ShipmentMenu();
      };
      actions.appendChild(h);

      const l=document.createElement('button');
      l.className='btn secondary';
      l.type='button';
      l.textContent='📋 出荷依頼一覧へ';
      l.onclick=()=>globalThis.v76ShipmentMenu();
      actions.appendChild(l);
    }

    return true;
  }

  function drawOnceAfterCurrentRender(product,id){
    // 詳細画面の既存描画は同期処理なので、通常はその直後に1回だけ描画。
    // 万一まだDOMが無い場合だけ次フレームで1回再試行。
    if(!draw(product,id)){
      requestAnimationFrame(()=>draw(product,id));
    }
  }

  const baseOpen=globalThis.openGlobalShipment;
  if(typeof baseOpen==='function'){
    globalThis.openGlobalShipment=function(product,id){
      const r=baseOpen.apply(this,arguments);
      drawOnceAfterCurrentRender(product,id);
      return r;
    };
  }

  [
    ['shipmentDetail','kushiro'],
    ['hShipDetail','hidaka'],
    ['nShipDetail','nemuro'],
    ['smShipDetail','sanmae']
  ].forEach(([name,product])=>{
    const fn=globalThis[name];
    if(typeof fn!=='function')return;
    globalThis[name]=function(id){
      const r=fn.apply(this,arguments);
      drawOnceAfterCurrentRender(product,id);
      return r;
    };
  });

  if(!document.getElementById('v161Step52Style')){
    const st=document.createElement('style');
    st.id='v161Step52Style';
    st.textContent=`
      .v161-step52-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
      .v161-step52-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
      @media(max-width:700px){
        .v161-step52-grid,.v161-step52-actions{grid-template-columns:1fr}
      }`;
    document.head.appendChild(st);
  }

  console.info('[KOMBU v161 Step5.2] 高速化版 ready');
})();
/* ===== /v161 Step5.2 ===== */
/* ===== v161 Step5.3: 出荷済・取消済を履歴へ確実に反映 ===== */
(function(){
  'use strict';

  const HIST_KEY='kombu-v136-shipment-history';

  function loadHistory(){
    try{
      const v=JSON.parse(localStorage.getItem(HIST_KEY)||'[]');
      return Array.isArray(v)?v:[];
    }catch(_e){
      return [];
    }
  }

  function saveHistory(v){
    localStorage.setItem(HIST_KEY,JSON.stringify(v||[]));
  }

  function clone(v){
    return JSON.parse(JSON.stringify(v));
  }

  function sourceOf(product,s){
    if(product==='kushiro'){
      const x=shipmentSource(s);
      return {name:x.name||'',address:x.address||'',phone:x.phone||''};
    }
    const x=s?.source||{};
    return {name:x.name||'',address:x.address||'',phone:x.phone||''};
  }

  function destOf(product,s){
    if(product==='kushiro'){
      const x=shipmentDest(s);
      return {name:x.name||'',address:x.address||'',phone:x.phone||''};
    }
    const x=(s?.dest&&typeof s.dest==='object')?s.dest:(s?.destInfo||{});
    return {
      name:x.name||'',
      address:x.address||'',
      phone:x.phone||''
    };
  }

  function qtyOf(s){
    return (s?.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0);
  }

  function allShipments(){
    return [
      ...(state.shipments||[]).map(s=>({product:'kushiro',s})),
      ...(hState.shipments||[]).map(s=>({product:'hidaka',s})),
      ...(nState.shipments||[]).map(s=>({product:'nemuro',s})),
      ...(smState.shipments||[]).map(s=>({product:'sanmae',s}))
    ];
  }

  function archiveFinished(){
    const hist=loadHistory();
    const map=new Map(hist.map(x=>[x.key,x]));
    let changed=false;
    const now=new Date().toISOString();

    allShipments().forEach(({product,s})=>{
      if(!s||!(s.status==='shipped'||s.status==='cancelled'))return;

      const k=product+'::'+String(s.id||'');
      const old=map.get(k);

      const item={
        key:k,
        product,
        id:s.id||'',
        addedAt:s.shippedAt||s.cancelledAt||s.updatedAt||s.createdAt||now,
        archivedAt:old?.archivedAt||now,
        shipDate:s.shipDate||'',
        dest:destOf(product,s),
        source:sourceOf(product,s),
        qty:qtyOf(s),
        status:s.status,
        snapshot:clone(s)
      };

      /*
        既存履歴がある場合も、状態・数量・宛先などは最新状態へ更新。
        archivedAtだけは最初に履歴入りした時刻を維持。
      */
      const before=old?JSON.stringify(old):'';
      const after=JSON.stringify(item);

      if(before!==after){
        map.set(k,item);
        changed=true;
      }
    });

    if(changed){
      saveHistory([...map.values()]);
      console.info('[KOMBU v161 Step5.3] 出荷履歴同期完了');
    }

    return changed;
  }

  /*
    履歴画面を開く直前に、4種類すべての shipped / cancelled を
    履歴へ同期する。これによりFAX BOXを経由しない出荷でも履歴へ入る。
  */
  const baseHistory=window.v136ShipmentHistory;
  if(typeof baseHistory==='function'){
    window.v136ShipmentHistory=function(){
      archiveFinished();
      return baseHistory.apply(this,arguments);
    };
  }

  /*
    出荷済・取消処理後に各詳細画面が再描画されたタイミングでも同期。
    これで「出荷済」にした直後から履歴データへ保存される。
  */
  [
    'shipmentDetail',
    'hShipDetail',
    'nShipDetail',
    'smShipDetail'
  ].forEach(name=>{
    const fn=globalThis[name];
    if(typeof fn!=='function')return;

    globalThis[name]=function(){
      const r=fn.apply(this,arguments);
      archiveFinished();
      return r;
    };
  });

  /*
    一覧を開いた場合も同期しておく。
    旧v136のDOM行依存アーカイブを補完する。
  */
  const baseMenu=globalThis.v76ShipmentMenu;
  if(typeof baseMenu==='function'){
    globalThis.v76ShipmentMenu=function(){
      archiveFinished();
      return baseMenu.apply(this,arguments);
    };
  }

  // 既に出荷済の過去データも、この更新直後に一度だけ取り込む。
  archiveFinished();

  console.info('[KOMBU v161 Step5.3] 出荷履歴自動反映 ready');
})();
/* ===== /v161 Step5.3 ===== */
/* ===== v161.3: トップ画面のバージョン表示を最新版へ統一 ===== */
(function(){
  'use strict';
  const CURRENT_VERSION='v161.3';

  function setLatestVersion(){
    if(!window.app)return;
    const el=app.querySelector('.v106-version,.pill');
    if(el)el.textContent=CURRENT_VERSION;
  }

  const baseLanding=productLanding;
  productLanding=function(){
    const r=baseLanding.apply(this,arguments);
    setLatestVersion();
    requestAnimationFrame(setLatestVersion);
    return r;
  };
  try{globalThis.productLanding=productLanding}catch(_e){}

  /* 現在トップ画面が表示中の場合も、その場で最新版へ更新 */
  setLatestVersion();

  console.info('[KOMBU v161.3] 最新バージョン表示 ready');
})();
/* ===== /v161.3 version ===== */


/* ===== v2.20: top shipment button direct route ===== */
(function(){
  'use strict';

  function openShipmentEntryDirect(){
    try{
      // トップ用の古い固定ナビだけ除去。
      document.body.classList.remove('v107-landing-open','v106-settings-open');
      document.getElementById('v107LandingNav')?.remove();
      document.querySelector('.v106-settings-nav')?.remove();

      if(typeof globalThis.v161ShipmentEntryMenu!=='function'){
        throw new Error('出荷依頼トップ画面を読み込めません。');
      }

      // productChoicePage('shipment') は通さず直接開く。
      globalThis.v161ShipmentEntryMenu();
    }catch(e){
      console.error('[KOMBU v2.20] 出荷依頼を開けません',e);
      alert('出荷依頼画面を開けませんでした。\n'+String(e?.message||e));
    }
  }

  function bindTopShipmentButton(){
    const btn=
      document.getElementById('v106Shipment') ||
      document.getElementById('v105Shipment') ||
      document.getElementById('v73Shipment');

    if(btn){
      btn.onclick=openShipmentEntryDirect;
      btn.dataset.v220DirectShipment='1';
    }
  }

  // productLanding が何度描画されても最後に直接経路へ付け替える。
  const baseLanding=globalThis.productLanding;
  if(typeof baseLanding==='function'){
    globalThis.productLanding=function(){
      const r=baseLanding.apply(this,arguments);
      bindTopShipmentButton();
      requestAnimationFrame(bindTopShipmentButton);
      return r;
    };
  }

  window.kombuOpenShipmentEntryDirect=openShipmentEntryDirect;
  window.kombuBindTopShipmentButton=bindTopShipmentButton;

  bindTopShipmentButton();
  requestAnimationFrame(bindTopShipmentButton);

  console.info('[KOMBU v2.20] トップ→出荷依頼 直接経路 ready');
})();
/* ===== /v2.20 ===== */



/* ===== v2.23: history bottom nav full-width alignment ===== */
(function(){
  const st=document.createElement('style');
  st.id='v223-history-nav-style';
  st.textContent=`
    body[data-v119-nav-mode="shipment"] #v119ShipmentNav{
      position:fixed!important;
      left:0!important;
      right:auto!important;
      bottom:0!important;
      width:100vw!important;
      min-width:100vw!important;
      max-width:none!important;
      margin:0!important;
      border-radius:0!important;
      transform:none!important;
      grid-template-columns:repeat(4,minmax(0,1fr))!important;
      box-sizing:border-box!important;
    }
    body[data-v119-nav-mode="shipment"] #v119ShipmentNav > button{
      width:100%!important;
      min-width:0!important;
      max-width:none!important;
      margin:0!important;
      box-sizing:border-box!important;
    }
  `;
  document.head.appendChild(st);
})();



/* ===== v2.24 history dedicated nav style ===== */
(function(){
  const st=document.createElement('style');
  st.textContent=`
    #v224HistoryNav{
      position:fixed!important;
      left:0!important;
      right:0!important;
      bottom:0!important;
      width:100%!important;
      max-width:none!important;
      min-width:0!important;
      margin:0!important;
      display:grid!important;
      grid-template-columns:repeat(4,minmax(0,1fr))!important;
      border-radius:0!important;
      transform:none!important;
      box-sizing:border-box!important;
    }
  `;
  document.head.appendChild(st);
})();



/* ===== v2.25 出荷依頼履歴 PDF列拡張 ===== */
(function(){
  const st=document.createElement('style');
  st.id='v225-history-pdf-width';
  st.textContent=`
    .v159-history-table{
      width:100%!important;
      min-width:1180px!important;
      table-layout:fixed!important;
    }

    /* PDF列を大きく、その他を少しずつ圧縮 */
    .v159-history-table col.c1{width:10%!important}   /* 依頼日 */
    .v159-history-table col.c2{width:6%!important}    /* 昆布 */
    .v159-history-table col.c3{width:12%!important}   /* 出荷人 */
    .v159-history-table col.c4{width:12%!important}   /* 出荷先 */
    .v159-history-table col.c5{width:6%!important}    /* 個数 */
    .v159-history-table col.c6{width:8%!important}    /* 状態 */
    .v159-history-table col.c7{width:8%!important}    /* 送り状 */
    .v159-history-table col.c8{width:38%!important}   /* PDF */

    .v159-history-table th,
    .v159-history-table td{
      padding-left:4px!important;
      padding-right:4px!important;
    }

    .v215-history-pdf{
      width:100%!important;
      max-width:none!important;
      overflow:visible!important;
      text-overflow:clip!important;
      white-space:nowrap!important;
      font-size:11px!important;
      padding:7px 10px!important;
      text-align:left!important;
    }

    @media(max-width:900px){
      .v159-history-table{
        min-width:1120px!important;
      }
      .v159-history-table col.c8{width:36%!important}
      .v215-history-pdf{
        font-size:10px!important;
      }
    }
  `;
  document.head.appendChild(st);
})();



/* ===== v2.26 出荷依頼履歴 列幅バランス調整 ===== */
(function(){
  const old=document.getElementById('v226-history-width-balance');
  if(old)old.remove();

  const st=document.createElement('style');
  st.id='v226-history-width-balance';
  st.textContent=`
    .v159-history-table{
      width:100%!important;
      min-width:1060px!important;
      table-layout:fixed!important;
    }

    .v159-history-table col.c1{width:11%!important}   /* 依頼日 */
    .v159-history-table col.c2{width:7%!important}    /* 昆布 */
    .v159-history-table col.c3{width:14%!important}   /* 出荷人 */
    .v159-history-table col.c4{width:14%!important}   /* 出荷先 */
    .v159-history-table col.c5{width:7%!important}    /* 個数 */
    .v159-history-table col.c6{width:9%!important}    /* 状態 */
    .v159-history-table col.c7{width:9%!important}    /* 送り状 */
    .v159-history-table col.c8{width:29%!important}   /* PDF */

    .v159-history-table th,
    .v159-history-table td{
      padding-left:5px!important;
      padding-right:5px!important;
    }

    .v215-history-pdf{
      width:100%!important;
      max-width:100%!important;
      overflow:hidden!important;
      text-overflow:clip!important;
      white-space:nowrap!important;
      font-size:10.5px!important;
      padding:7px 8px!important;
      text-align:left!important;
    }

    @media(max-width:900px){
      .v159-history-table{
        min-width:1040px!important;
      }
      .v159-history-table col.c8{width:30%!important}
      .v215-history-pdf{font-size:10px!important}
    }
  `;
  document.head.appendChild(st);
})();



/* ===== v2.27 出荷依頼履歴 PDF列 最終コンパクト調整 ===== */
(function(){
  const st=document.createElement('style');
  st.id='v227-history-pdf-compact';
  st.textContent=`
    .v159-history-table col.c1{width:12%!important}
    .v159-history-table col.c2{width:7%!important}
    .v159-history-table col.c3{width:15%!important}
    .v159-history-table col.c4{width:15%!important}
    .v159-history-table col.c5{width:7%!important}
    .v159-history-table col.c6{width:9%!important}
    .v159-history-table col.c7{width:10%!important}
    .v159-history-table col.c8{width:25%!important}

    .v215-history-pdf{
      width:100%!important;
      max-width:100%!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:clip!important;
      font-size:10.5px!important;
      padding:7px 8px!important;
    }
  `;
  document.head.appendChild(st);
})();



/* ===== v2.28 出荷依頼履歴 PDF列20% ===== */
(function(){
  const st=document.createElement('style');
  st.id='v228-history-pdf20';
  st.textContent=`
    .v159-history-table col.c1{width:13%!important}
    .v159-history-table col.c2{width:8%!important}
    .v159-history-table col.c3{width:16%!important}
    .v159-history-table col.c4{width:16%!important}
    .v159-history-table col.c5{width:7%!important}
    .v159-history-table col.c6{width:9%!important}
    .v159-history-table col.c7{width:11%!important}
    .v159-history-table col.c8{width:20%!important}
  `;
  document.head.appendChild(st);
})();



/* ===== v2.29 出荷依頼履歴 PDF列15% ===== */
(function(){
  const st=document.createElement('style');
  st.id='v229-history-pdf15';
  st.textContent=`
    .v159-history-table col.c1{width:14%!important}
    .v159-history-table col.c2{width:8%!important}
    .v159-history-table col.c3{width:17%!important}
    .v159-history-table col.c4{width:17%!important}
    .v159-history-table col.c5{width:8%!important}
    .v159-history-table col.c6{width:9%!important}
    .v159-history-table col.c7{width:12%!important}
    .v159-history-table col.c8{width:15%!important}
  `;
  document.head.appendChild(st);
})();



/* ===== 2026-08-29: v2.29会社マスター Excel同時取込（既存出荷仕様は変更しない） ===== */
(function(){
  'use strict';
  const PAIR_KEY='kombu_company_pairs_v162';
  const IMPORT_MARK='v229-company-import';

  const esc2=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const yes=v=>{
    const s=String(v??'').trim().toLowerCase();
    return v===true||s==='はい'||s==='yes'||s==='true'||s==='1'||s==='○'||s==='〇';
  };
  const postal=v=>{
    const d=String(v??'').replace(/\D/g,'');
    return d.length===7?d.slice(0,3)+'-'+d.slice(3):String(v??'').trim();
  };
  const val=(row,names)=>{
    for(const n of names){
      if(Object.prototype.hasOwnProperty.call(row,n)&&String(row[n]??'').trim()!=='')return row[n];
    }
    return '';
  };
  const loadPairs=()=>{try{const x=JSON.parse(localStorage.getItem(PAIR_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return []}};
  const savePairs=x=>localStorage.setItem(PAIR_KEY,JSON.stringify(x));

  function loadSheetJS(){
    if(globalThis.XLSX)return Promise.resolve(globalThis.XLSX);
    return new Promise((resolve,reject)=>{
      const prev=document.getElementById('v229SheetJS');
      if(prev){prev.addEventListener('load',()=>resolve(globalThis.XLSX),{once:true});prev.addEventListener('error',()=>reject(new Error('Excel読込ライブラリを読み込めませんでした。')),{once:true});return;}
      const s=document.createElement('script');
      s.id='v229SheetJS';
      s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload=()=>globalThis.XLSX?resolve(globalThis.XLSX):reject(new Error('Excel読込ライブラリの初期化に失敗しました。'));
      s.onerror=()=>reject(new Error('Excel読込ライブラリを読み込めませんでした。インターネット接続を確認してください。'));
      document.head.appendChild(s);
    });
  }

  function parseCompany(row,i){
    const code=String(val(row,['会社ID（任意）','会社ID','会社コード','ID'])||'').trim();
    const name=String(val(row,['会社名【必須】','会社名','名称'])||'').trim();
    const p=postal(val(row,['郵便番号【必須】','郵便番号','〒']));
    const address=String(val(row,['住所【必須】','住所'])||'').trim();
    const phone=String(val(row,['電話番号【必須】','電話番号','TEL','電話'])||'').trim();
    const region=String(val(row,['地区【必須】','地区'])||'').trim();
    const toyamaRegion=String(val(row,['富山地区（該当時）','富山地区'])||'').trim();
    const useSourceRaw=val(row,['出荷人として使用']);
    const useDestRaw=val(row,['出荷先として使用']);
    const favRaw=val(row,['よく使う']);
    const favSourceRaw=val(row,['よく使う出荷人','出荷人よく使う','出荷人優先']);
    const favDestRaw=val(row,['よく使う出荷先','出荷先よく使う','出荷先優先']);
    const sortRaw=val(row,['表示順']);
    return {
      code,name,postal:p,address,phone,region,toyamaRegion,
      useSource:String(useSourceRaw).trim()===''?true:yes(useSourceRaw),
      useDestination:String(useDestRaw).trim()===''?true:yes(useDestRaw),
      favorite:yes(favRaw),
      favoriteSource:String(favSourceRaw).trim()===''?yes(favRaw):yes(favSourceRaw),
      favoriteDestination:String(favDestRaw).trim()===''?yes(favRaw):yes(favDestRaw),
      sortOrder:String(sortRaw).trim()===''?i+1:Number(sortRaw)||i+1,
      note:String(val(row,['備考'])||'').trim()
    };
  }

  function parsePair(row,i,companyByCode,companyByName){
    const sourceCode=String(val(row,['出荷人会社ID','出荷人ID'])||'').trim();
    const destCode=String(val(row,['出荷先会社ID','出荷先ID'])||'').trim();
    let source=String(val(row,['出荷人会社名【必須】','出荷人会社名','出荷人'])||'').trim();
    let dest=String(val(row,['出荷先会社名【必須】','出荷先会社名','出荷先'])||'').trim();
    if(!source&&sourceCode&&companyByCode.has(sourceCode))source=companyByCode.get(sourceCode).name;
    if(!dest&&destCode&&companyByCode.has(destCode))dest=companyByCode.get(destCode).name;
    const sortRaw=val(row,['表示順']);
    return {
      sourceCode,destCode,source,dest,
      favorite:yes(val(row,['よく使う'])),
      sortOrder:String(sortRaw).trim()===''?i+1:Number(sortRaw)||i+1,
      note:String(val(row,['備考'])||'').trim(),
      _sourceExists:companyByName.has(source),
      _destExists:companyByName.has(dest)
    };
  }

  async function importWorkbook(file,refresh){
    if(!file)return;
    try{
      const XLSX=await loadSheetJS();
      const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
      if(!wb.SheetNames.includes('会社マスター'))throw new Error('Excelに「会社マスター」シートがありません。');
      if(!wb.SheetNames.includes('出荷人×出荷先'))throw new Error('Excelに「出荷人×出荷先」シートがありません。');

      const companyRows=XLSX.utils.sheet_to_json(wb.Sheets['会社マスター'],{defval:'',raw:false});
      const parsed=companyRows.map(parseCompany).filter(c=>c.name||c.postal||c.address||c.phone);
      const errors=[];
      const seenNames=new Set();
      parsed.forEach((c,i)=>{
        const e=[];
        if(!c.name)e.push('会社名');
        if(!/^\d{3}-\d{4}$/.test(c.postal))e.push('郵便番号');
        if(!c.address)e.push('住所');
        if(!c.phone)e.push('電話番号');
        if(!c.region)e.push('地区');
        if(c.name&&seenNames.has(c.name))e.push('会社名重複');
        if(c.name)seenNames.add(c.name);
        if(e.length)errors.push(`会社マスター ${i+2}行目 ${c.name||'(会社名なし)'}：${e.join('、')}`);
      });

      const byCode=new Map(parsed.filter(c=>c.code).map(c=>[c.code,c]));
      const byName=new Map(parsed.filter(c=>c.name).map(c=>[c.name,c]));
      // 既存会社も組合せ照合対象に含める
      (Array.isArray(state.companies)?state.companies:[]).forEach(c=>{
        const n=String(c?.name||'').trim();
        const code=String(c?.code||'').trim();
        if(n&&!byName.has(n))byName.set(n,c);
        if(code&&!byCode.has(code))byCode.set(code,c);
      });

      const pairRows=XLSX.utils.sheet_to_json(wb.Sheets['出荷人×出荷先'],{defval:'',raw:false});
      const pairs=pairRows.map((r,i)=>parsePair(r,i,byCode,byName)).filter(p=>p.source||p.dest||p.sourceCode||p.destCode);
      pairs.forEach((p,i)=>{
        const e=[];
        if(!p.source)e.push('出荷人');
        if(!p.dest)e.push('出荷先');
        if(p.source&&!p._sourceExists)e.push(`出荷人「${p.source}」が会社マスターにありません`);
        if(p.dest&&!p._destExists)e.push(`出荷先「${p.dest}」が会社マスターにありません`);
        if(e.length)errors.push(`出荷人×出荷先 ${i+2}行目：${e.join('、')}`);
      });

      const current=Array.isArray(state.companies)?state.companies:[];
      let add=0,update=0;
      parsed.forEach(c=>{
        const hit=current.findIndex(x=>(c.code&&String(x?.code||'')===c.code)||String(x?.name||'').trim()===c.name);
        if(hit>=0)update++;else add++;
      });

      const overlay=document.createElement('div');
      overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:#0008;padding:16px;overflow:auto';
      overlay.innerHTML=`<div style="max-width:760px;margin:28px auto;background:#fff;border-radius:16px;padding:16px;box-shadow:0 20px 60px #0004">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h2 style="margin:0">Excel取込内容の確認</h2><button class="mini" id="v229ImpClose">閉じる</button></div>
        <div class="card" style="margin-top:12px;padding:12px;background:#f8fafc;line-height:1.8"><b>会社マスター：${parsed.length}件</b>（新規 ${add}件 / 更新 ${update}件）<br><b>出荷人×出荷先：${pairs.length}件</b><br><b>エラー：${errors.length}件</b></div>
        <div style="max-height:42vh;overflow:auto;margin-top:10px;padding:10px;border:1px solid #dbe4ee;border-radius:10px">${errors.length?errors.slice(0,100).map(x=>`<div style="margin:4px 0;color:#a61b12">${esc2(x)}</div>`).join(''):'<div>エラーはありません。2シートを同時に取り込みます。</div>'}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn" id="v229ImpGo" ${errors.length?'disabled':''}>取込実行</button><button class="btn secondary" id="v229ImpCancel">キャンセル</button></div>
      </div>`;
      document.body.appendChild(overlay);
      const close=()=>overlay.remove();
      overlay.querySelector('#v229ImpClose').onclick=close;
      overlay.querySelector('#v229ImpCancel').onclick=close;
      overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
      const go=overlay.querySelector('#v229ImpGo');
      if(go)go.onclick=()=>{
        const base=Array.isArray(state.companies)?state.companies:[];
        const used=new Set(),out=[];
        parsed.forEach(c=>{
          const hit=base.findIndex((x,j)=>!used.has(j)&&((c.code&&String(x?.code||'')===c.code)||String(x?.name||'').trim()===c.name));
          if(hit>=0){used.add(hit);out.push({...base[hit],...c});}
          else out.push({...c});
        });
        base.forEach((c,j)=>{if(!used.has(j))out.push(c)});
        state.companies=out;
        savePairs(pairs.map(({_sourceExists,_destExists,...p})=>p));
        save();
        close();
        alert(`Excel取込が完了しました。\n会社マスター ${parsed.length}件\n出荷人×出荷先 ${pairs.length}件`);
        refresh();
      };
    }catch(err){
      console.error('[v2.29 company import]',err);
      alert(err?.message||'Excelファイルを読み込めませんでした。');
    }
  }

  const baseCompanyMaster=companyMasterPage;
  function companyMasterWithExcelImport(){
    baseCompanyMaster();
    if(document.getElementById(IMPORT_MARK))return;
    const card=app.querySelector('section.card');
    if(!card)return;
    const marker=document.createElement('div');
    marker.id=IMPORT_MARK;
    marker.style.cssText='margin:12px 0 14px;padding:12px;border:1px solid #dbe4ee;border-radius:12px;background:#f8fafc';
    const pairCount=loadPairs().length;
    marker.innerHTML=`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button class="btn" id="v229ExcelImport" type="button">📥 Excel取込</button><span class="small">「会社マスター」＋「出荷人×出荷先」を同時取込</span></div><div class="small" style="margin-top:7px">出荷人×出荷先：<b>${pairCount}件取込済み</b> ${pairCount?'<button class="mini" id="v229PairCheck" type="button">内容確認</button>':''}</div><div id="v229PairList" style="display:none;margin-top:8px;max-height:220px;overflow:auto;border:1px solid #dbe4ee;border-radius:8px;background:#fff;padding:8px"></div><input id="v229ExcelFile" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" hidden>`;
    const firstH3=card.querySelector('h3');
    if(firstH3)card.insertBefore(marker,firstH3);else card.appendChild(marker);
    marker.querySelector('#v229ExcelImport').onclick=()=>marker.querySelector('#v229ExcelFile').click();
    const pairCheck=marker.querySelector('#v229PairCheck');
    if(pairCheck)pairCheck.onclick=()=>{
      const box=marker.querySelector('#v229PairList');
      if(box.style.display!=='none'){box.style.display='none';pairCheck.textContent='内容確認';return;}
      const rows=loadPairs();
      box.innerHTML=rows.map((p,i)=>`<div style="padding:5px 2px;border-bottom:1px solid #eef2f6"><b>${i+1}. ${esc2(p.source)}</b> → ${esc2(p.dest)}${p.sortOrder?` <span class="small">（表示順 ${esc2(p.sortOrder)}）</span>`:''}</div>`).join('')||'<div class="small">登録はありません。</div>';
      box.style.display='block';pairCheck.textContent='閉じる';
    };
    marker.querySelector('#v229ExcelFile').onchange=e=>{
      const f=e.target.files?.[0];
      importWorkbook(f,companyMasterWithExcelImport).finally(()=>{e.target.value=''});
    };
  }

  try{companyMasterPage=companyMasterWithExcelImport;globalThis.companyMasterPage=companyMasterWithExcelImport;}catch(e){console.error(e)}
  console.info('[KOMBU v2.29] 会社マスター同時取込＋よく使う出荷人/出荷先＋地区/組合せ候補');
})();
/* ===== /2026-08-29 company import only ===== */




/* ===== v164.5 出荷依頼履歴 月別締め・折りたたみ ===== */
(function(){
  const MONTH_OPEN_KEY='kombu_shipment_history_month_open_v1645';

  function monthKeyFromShipment(s){
    const raw = s?.shipDate || s?.createdAt || s?.updatedAt || '';
    if(!raw) return '';
    const d = String(raw).slice(0,10).replace(/\//g,'-');
    const m = d.match(/^(\d{4})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}` : '';
  }
  function currentMonthKey(){
    const parts=new Intl.DateTimeFormat('en-CA',{
      timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit'
    }).formatToParts(new Date());
    const o={}; parts.forEach(p=>{if(p.type!=='literal')o[p.type]=p.value});
    return `${o.year}-${o.month}`;
  }
  function monthLabel(k){
    const m=String(k||'').match(/^(\d{4})-(\d{2})$/);
    return m?`${Number(m[1])}年${Number(m[2])}月分`:k;
  }
  function loadOpen(){
    try{const x=JSON.parse(localStorage.getItem(MONTH_OPEN_KEY)||'{}');return x&&typeof x==='object'?x:{}}catch(_){return {}}
  }
  function saveOpen(x){localStorage.setItem(MONTH_OPEN_KEY,JSON.stringify(x||{}))}

  function getAllHistoryRows(){
    try{
      if(typeof globalShipmentRows==='function'){
        const rows=globalShipmentRows();
        return Array.isArray(rows)?rows:[];
      }
    }catch(e){console.warn('[v164.5] globalShipmentRows failed',e)}
    return [];
  }

  function renderMonthlyArchive(){
    const tbody=document.getElementById('gShipTbody') || document.querySelector('#gShipTable tbody');
    if(!tbody) return false;

    const rows=getAllHistoryRows();
    if(!rows.length) return false;

    const nowMonth=currentMonthKey();
    const current=[];
    const archives=new Map();

    rows.forEach(r=>{
      const s=r.shipment||r;
      const mk=monthKeyFromShipment(s);
      if(!mk || mk===nowMonth) current.push(r);
      else{
        if(!archives.has(mk))archives.set(mk,[]);
        archives.get(mk).push(r);
      }
    });

    if(!archives.size) return false;

    const open=loadOpen();
    const monthKeys=[...archives.keys()].sort((a,b)=>b.localeCompare(a));

    // Current month rows are already rendered by existing screen.
    // Append archive controls to the end only.
    monthKeys.forEach(mk=>{
      const items=archives.get(mk);
      const tr=document.createElement('tr');
      tr.className='v1645-month-row';
      tr.innerHTML=`<td colspan="12" style="padding:0">
        <button type="button" data-v1645-month="${mk}" style="width:100%;text-align:left;padding:12px 14px;border:0;background:#eef4fb;font-weight:900;cursor:pointer">
          <span data-v1645-arrow>${open[mk]?'▼':'▶'}</span>
          ${monthLabel(mk)}（${items.length}件）
        </button>
      </td>`;
      tbody.appendChild(tr);

      const detail=document.createElement('tr');
      detail.className='v1645-month-detail';
      detail.dataset.month=mk;
      detail.style.display=open[mk]?'table-row':'none';
      detail.innerHTML=`<td colspan="12" style="padding:0;background:#fafcff">
        <div style="padding:10px 12px">
          <table style="width:100%;min-width:0">
            <thead><tr>
              <th>状態</th><th>出荷人</th><th>出荷先</th><th>出荷日</th><th>希望着日</th><th>数量</th><th>PDF</th><th>操作</th>
            </tr></thead>
            <tbody>
              ${items.map(r=>{
                const s=r.shipment||r;
                const product=r.product||'';
                const status=(typeof shipmentStatusJa==='function'?shipmentStatusJa(s.status):s.status||'');
                let src='',dst='';
                try{
                  src=product==='kushiro'?shipmentSource(s).name:(s?.source?.name||'');
                  dst=product==='kushiro'?shipmentDest(s).name:(s?.dest?.name||s?.destInfo?.name||'');
                }catch(_){}
                const qty=(s?.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0);
                const openFn=`window.openGlobalShipment&&window.openGlobalShipment('${String(product).replace(/'/g,"\\'")}','${String(s.id||'').replace(/'/g,"\\'")}')`;
                return `<tr>
                  <td>${status}</td><td>${src}</td><td>${dst}</td>
                  <td>${s.shipDate||''}</td><td>${s.arrivalDate||''}</td><td>${qty}</td>
                  <td>${s.id?`<button class="mini" type="button" onclick="${openFn}">PDF/詳細</button>`:''}</td>
                  <td>${s.id?`<button class="mini" type="button" onclick="${openFn}">開く</button>`:''}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </td>`;
      tbody.appendChild(detail);

      const btn=tr.querySelector('[data-v1645-month]');
      btn.onclick=()=>{
        const show=detail.style.display==='none';
        detail.style.display=show?'table-row':'none';
        open[mk]=show;
        saveOpen(open);
        btn.querySelector('[data-v1645-arrow]').textContent=show?'▼':'▶';
      };
    });
    return true;
  }

  function stripPastMonthRowsFromMain(){
    const tbody=document.getElementById('gShipTbody') || document.querySelector('#gShipTable tbody');
    if(!tbody) return;
    const nowMonth=currentMonthKey();
    [...tbody.querySelectorAll('tr')].forEach(tr=>{
      if(tr.classList.contains('v1645-month-row')||tr.classList.contains('v1645-month-detail'))return;
      const txt=tr.textContent||'';
      const m=txt.match(/(\d{4})[\/-](\d{2})[\/-]\d{2}/);
      if(m){
        const mk=`${m[1]}-${m[2]}`;
        if(mk!==nowMonth)tr.remove();
      }
    });
  }

  function enhanceHistory(){
    const hasHistory =
      document.getElementById('gShipTbody') ||
      document.querySelector('#gShipTable tbody') ||
      document.getElementById('gShipSearch');
    if(!hasHistory) return;
    stripPastMonthRowsFromMain();
    renderMonthlyArchive();
  }

  const obs=new MutationObserver(()=>{
    clearTimeout(window.__v1645HistTimer);
    window.__v1645HistTimer=setTimeout(enhanceHistory,30);
  });
  const start=()=>{
    const app=document.getElementById('app');
    if(app)obs.observe(app,{childList:true,subtree:true});
    setTimeout(enhanceHistory,100);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  console.info('[KOMBU v164.5] 出荷依頼履歴 月別締め・折りたたみ');
})();
 /* ===== /v164.5 ===== */


/* ===== v164.6 テスト準備：完全バックアップ＋安全なテスト初期化 ===== */
(function(){
  'use strict';
  const PAIR_KEY='kombu_company_pairs_v162';

  function downloadJson(name,obj){
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function jpStamp(){
    const p=new Intl.DateTimeFormat('ja-JP',{
      timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',
      hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
    }).formatToParts(new Date());
    const o={};p.forEach(x=>{if(x.type!=='literal')o[x.type]=x.value});
    return `${o.year}${o.month}${o.day}_${o.hour}${o.minute}${o.second}`;
  }
  function pairs(){
    try{const x=JSON.parse(localStorage.getItem(PAIR_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return []}
  }
  function fullBackup(){
    const payload={
      backupType:'KOMBU_FULL_TEST_BACKUP',
      backupVersion:1,
      appVersion:'v164.6',
      exportedAt:new Date().toISOString(),
      state:JSON.parse(JSON.stringify(state)),
      companyPairs:pairs()
    };
    downloadJson(`昆布在庫管理_テスト前完全バックアップ_${jpStamp()}.json`,payload);
    alert(
      `完全バックアップを作成しました。\n\n`+
      `会社マスター：${Array.isArray(state.companies)?state.companies.length:0}件\n`+
      `出荷人×出荷先：${payload.companyPairs.length}件\n\n`+
      `ダウンロードしたJSONファイルを安全な場所に保管してください。`
    );
  }

  function testResetPreview(){
    const companies=Array.isArray(state.companies)?state.companies.length:0;
    const pairCount=pairs().length;
    const records=Array.isArray(state.records)?state.records.length:0;
    const shipments=Array.isArray(state.shipments)?state.shipments.length:0;
    const pdfImports=Array.isArray(state.pdfImports)?state.pdfImports.length:0;
    const faxbox=(()=>{try{const x=JSON.parse(localStorage.getItem('kombu-v99-fax-box')||'[]');return Array.isArray(x)?x.length:0}catch(_){return 0}})();

    const ok=confirm(
      `【テスト初期化・最終確認】\n\n`+
      `維持するデータ\n`+
      `・会社マスター：${companies}件\n`+
      `・出荷人×出荷先：${pairCount}件\n`+
      `・地区／よく使う会社設定：会社マスター内の設定を維持\n\n`+
      `初期化するデータ\n`+
      `・在庫／入出庫データ：${records}件\n`+
      `・出荷依頼／出荷履歴：${shipments}件\n`+
      `・PDF取込履歴：${pdfImports}件\n`+
      `・FAXBOX：${faxbox}件\n`+
      `・送り状の判定／未判定などテスト対象の保存データ\n\n`+
      `先に「完全バックアップ」を保存したことを確認してください。\n`+
      `本当にテスト用に初期化しますか？`
    );
    if(!ok)return;

    const typed=prompt('誤操作防止のため「テスト初期化」と入力してください。');
    if(typed!=='テスト初期化')return alert('初期化を中止しました。');

    // Preserve master data exactly.
    const keepCompanies=JSON.parse(JSON.stringify(Array.isArray(state.companies)?state.companies:[]));
    const keepCoops=JSON.parse(JSON.stringify(Array.isArray(state.coops)?state.coops:[]));
    const keepPairs=pairs();
    const keepYear=state.activeYear;

    // Clear only operational/test data.
    state.records=[];
    state.shipments=[];
    state.shipmentSeq=1;
    state.pdfImports=[];
    state.companies=keepCompanies;
    state.coops=keepCoops;
    state.activeYear=keepYear;
    localStorage.setItem(PAIR_KEY,JSON.stringify(keepPairs));

    // Known operational caches / queues. Do NOT touch company master or pair key.
    [
      'kombu-v99-fax-box',
      'kombu_shipment_history_month_open_v1645'
    ].forEach(k=>localStorage.removeItem(k));

    // Remove only keys whose names clearly indicate shipping-label judgement/unmatched caches.
    const protectedKeys=new Set([PAIR_KEY,'kombu_local_only_v2']);
    const remove=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i)||'';
      if(protectedKeys.has(k))continue;
      if(/(送り状|waybill|label.*(judge|match|unmatch|pending)|shipment.*(judge|match|unmatch|pending)|pdf.*(judge|match|unmatch|pending))/i.test(k))remove.push(k);
    }
    remove.forEach(k=>localStorage.removeItem(k));

    save();
    alert(
      `テスト初期化が完了しました。\n\n`+
      `会社マスター：${keepCompanies.length}件 維持\n`+
      `出荷人×出荷先：${keepPairs.length}件 維持\n\n`+
      `在庫・入出庫・出荷履歴・テスト対象PDF/送り状データを初期化しました。`
    );
    home();
  }

  function addTestTools(){
    const app=document.getElementById('app');
    if(!app || document.getElementById('v1646TestTools'))return;

    // v164.7: 下部ナビの表示文字やアイコンに依存せず、
    // 「在庫管理」「出荷依頼」の2ボタンがあるトップ画面だけで必ず表示する。
    const txt=(app.textContent||'').replace(/\s+/g,'');
    const isTop = txt.includes('在庫管理') && txt.includes('出荷依頼');
    if(!isTop)return;

    const box=document.createElement('section');
    box.id='v1646TestTools';
    box.className='card';
    box.style.cssText='margin-top:12px;padding:14px';
    box.innerHTML=`
      <h3 style="margin:0 0 8px">🧪 テスト準備</h3>
      <div class="small" style="margin-bottom:10px">
        会社マスター・出荷人×出荷先を維持したまま、8月テスト用の準備を行います。
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" id="v1646FullBackup" type="button">💾 完全バックアップ</button>
        <button class="btn secondary" id="v1646TestReset" type="button">🧹 テスト初期化</button>
      </div>
      <div class="small" style="margin-top:8px;color:#7a4b00">
        先に「完全バックアップ」を実行してください。確認前に「テスト初期化」は押さないでください。
      </div>`;
    app.appendChild(box);
    document.getElementById('v1646FullBackup').onclick=fullBackup;
    document.getElementById('v1646TestReset').onclick=testResetPreview;
  }

  const obs=new MutationObserver(()=>{
    clearTimeout(window.__v1646Timer);
    window.__v1646Timer=setTimeout(addTestTools,40);
  });
  const start=()=>{
    const app=document.getElementById('app');
    if(app)obs.observe(app,{childList:true,subtree:true});
    setTimeout(addTestTools,100);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();

  console.info('[KOMBU v164.7] 完全バックアップ＋安全なテスト初期化');
})();
 /* ===== /v164.6 ===== */


/* ===== v164.8 テストFAX完了（実FAX送信なし／本番完了処理を共用） ===== */
(function(){
  'use strict';

  function getShipment(product,id){
    if(product==='kushiro')return (state.shipments||[]).find(x=>String(x.id)===String(id))||null;
    if(product==='hidaka')return (hState.shipments||[]).find(x=>String(x.id)===String(id))||null;
    if(product==='nemuro')return (nState.shipments||[]).find(x=>String(x.id)===String(id))||null;
    if(product==='sanmae')return (smState.shipments||[]).find(x=>String(x.id)===String(id))||null;
    return null;
  }

  function addTestFaxButton(product,id){
    const s=getShipment(product,id);
    if(!s||!window.app)return;
    if(document.getElementById('v1648TestFaxDone'))return;
    if(s.status==='shipped'||s.status==='cancelled')return;

    const btn=document.createElement('button');
    btn.id='v1648TestFaxDone';
    btn.type='button';
    btn.className='btn';
    btn.style.cssText='margin-top:10px;background:#7a3e00;color:#fff';
    btn.textContent='🧪 テストFAX完了（送信しない）';

    const note=document.createElement('div');
    note.id='v1648TestFaxNote';
    note.className='note';
    note.style.marginTop='8px';
    note.textContent='テスト専用：実際のFAXは送信せず、本番のFAX送信完了と同じ在庫・履歴処理だけを実行します。';

    const flow=document.getElementById('v161Step5Flow');
    const actions=document.getElementById('v161Step5Actions');
    if(actions)actions.appendChild(btn);
    else if(flow)flow.appendChild(btn);
    else{
      const first=app.querySelector('section.card');
      if(first)first.appendChild(btn);else app.appendChild(btn);
    }
    btn.insertAdjacentElement('afterend',note);

    btn.onclick=()=>{
      const latest=getShipment(product,id);
      if(!latest)return alert('出荷依頼が見つかりません。');
      if(latest.status==='cancelled')return alert('取消済みの出荷依頼です。');
      if(latest.status==='shipped')return alert('すでにFAX完了／出荷済みです。');

      const qty=(latest.lines||[]).reduce((n,l)=>n+Number(l.qty||0),0);
      const src=latest?.source?.name||'';
      const dst=(product==='kushiro'
        ? (latest?.destInfo?.name||latest?.dest||'')
        : (latest?.dest?.name||latest?.destInfo?.name||''));

      if(!confirm(
        '【テストFAX完了】\n\n'+
        '実際のFAXは送信しません。\n'+
        '本番のFAX送信完了と同じ後処理を実行します。\n\n'+
        '出荷人：'+src+'\n'+
        '出荷先：'+dst+'\n'+
        '出荷日：'+(latest.shipDate||'')+'\n'+
        '数量：'+qty+'\n\n'+
        '在庫差引・入出庫履歴・出荷依頼履歴へ反映してよろしいですか？'
      ))return;

      btn.disabled=true;
      btn.textContent='テスト完了処理中…';
      try{
        // If still draft, use the existing FAXBOX confirmation path first.
        // This performs the same stock-availability validation as production.
        if(latest.status==='draft' && typeof window.kombuApplyFaxboxInventory==='function'){
          window.kombuApplyFaxboxInventory(product,id,'confirm',{
            jobId:'TEST-'+Date.now()
          });
        }
        if(typeof window.kombuFinalizeFaxboxShipment!=='function'){
          throw new Error('本番FAX完了処理が見つかりません。');
        }
        // IMPORTANT: call the production finalizer itself; do not duplicate its inventory/history logic.
        window.kombuFinalizeFaxboxShipment(product,id,{
          jobId:'TEST-'+Date.now(),
          sentAt:new Date().toISOString(),
          testMode:true
        });
        alert('テストFAX完了処理が完了しました。\n実際のFAXは送信していません。\n在庫・入出庫履歴・出荷依頼履歴を確認してください。');
        if(typeof globalThis.openGlobalShipment==='function')globalThis.openGlobalShipment(product,id);
      }catch(err){
        console.error('[v164.8 test fax]',err);
        btn.disabled=false;
        btn.textContent='🧪 テストFAX完了（送信しない）';
        alert('テストFAX完了処理に失敗しました。\n'+String(err?.message||err));
      }
    };
  }

  const baseOpen=globalThis.openGlobalShipment;
  if(typeof baseOpen==='function'){
    globalThis.openGlobalShipment=function(product,id){
      const r=baseOpen.apply(this,arguments);
      setTimeout(()=>addTestFaxButton(product,id),0);
      return r;
    };
  }

  [
    ['shipmentDetail','kushiro'],
    ['hShipDetail','hidaka'],
    ['nShipDetail','nemuro'],
    ['smShipDetail','sanmae']
  ].forEach(([name,product])=>{
    const fn=globalThis[name];
    if(typeof fn!=='function')return;
    globalThis[name]=function(id){
      const r=fn.apply(this,arguments);
      setTimeout(()=>addTestFaxButton(product,id),0);
      return r;
    };
  });

  console.info('[KOMBU v164.8] テストFAX完了を有効化（実送信なし）');
})();
 /* ===== /v164.8 ===== */
