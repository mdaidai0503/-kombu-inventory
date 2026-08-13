"use strict";
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
state.companies=state.companies.filter(c=>c&&String(c.name||'').trim()).map(c=>({name:String(c.name||'').trim(),address:String(c.address||''),phone:String(c.phone||'')}));
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
function home(){app.innerHTML=`<section class="card"><div class="row"><h2>在庫状況</h2><select id="homeYear" style="width:auto;padding:8px;border:1px solid #ccd6e2;border-radius:9px;background:#fff;font-size:15px">${yearOptions(state.activeYear)}</select></div><div class="stats"><div class="stat">${esc(state.activeYear)}年産 総在庫<b>${fmt(total(state.activeYear))}</b></div><div class="stat">漁協数<b>${state.coops.length}</b></div><div class="stat">細分類数<b>${allItems().length}</b></div><div class="stat">登録履歴<b>${state.records.filter(r=>(r.year||DEFAULT_YEAR)===state.activeYear).length}件</b></div></div></section><section class="grid"><button class="action" id="shipHome" style="border-left:6px solid #e05a47">📦 出荷指示<small>生産年度指定・PDF・FAX</small></button><button class="action orange" id="c">▦ 在庫表<small>生産年度別に表示</small></button><button class="action purple" id="d">≡ 入出庫履歴<small>年度を含めて修正・削除</small></button><button class="action green" id="a">↓ 入庫登録<small>生産年度・季節・分類・数量</small></button><button class="action gray" id="moreHome">⋯ その他<small>その他の機能</small></button><button class="action blue" id="b">↑ 出庫登録<small>生産年度別の在庫から減算</small></button><button class="action gray" id="e">⇩ データ出力<small>Excel・CSV・バックアップ</small></button><button class="action gray" id="f">⚙ マスター設定<small>漁協・細分類を確認</small></button></section><section class="card"><h2>生産年度</h2><div class="note">在庫は R3年産〜R10年産を別々に管理します。入庫・出庫・PDF取込・出荷指示のすべてに生産年度が付きます。</div></section>`;homeYear.onchange=()=>{setActiveYear(homeYear.value);home()};a.onclick=()=>form('in');b.onclick=()=>form('out');c.onclick=stock;d.onclick=logs;e.onclick=exportsPage;f.onclick=masters;shipHome.onclick=shipments;moreHome.onclick=exportsPage}
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
  if(!window.pdfjsLib)throw new Error('PDF読取ライブラリを読み込めませんでした。インターネット接続を確認してください。');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const data=new Uint8Array(await file.arrayBuffer());
  const pdf=await pdfjsLib.getDocument({data}).promise;
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
 let html=`<section class="card"><div class="row"><h2>在庫集計表（PDF準拠）</h2><select id="stockYear" style="width:auto;padding:8px;border:1px solid #ccd6e2;border-radius:9px;background:#fff;font-size:15px">${yearOptions(year)}</select></div><div class="toolbar"><button class="btn smallbtn" id="ex">Excel出力</button><button class="btn smallbtn" id="cs">CSV出力</button><button class="btn smallbtn" id="ps">PDF出力</button><button class="btn secondary smallbtn" id="x">ホーム</button><button class="btn secondary smallbtn" id="r">更新</button></div><style>.stock-report{border-collapse:collapse}.stock-report th,.stock-report td{border:.45px solid #333;font-size:13px}.stock-report td{font-size:15.5px;font-weight:400}.stock-report th{font-weight:600}.stock-report tr.coop-end th,.stock-report tr.coop-end td{border-bottom:1.6px solid #111}.stock-report tr.stock-subtotal th,.stock-report tr.stock-subtotal td{font-size:14.5px;font-weight:400;background:#fff;border-left-color:transparent;border-right-color:transparent}.stock-report tr.stock-subtotal td:first-child{border-left-color:#333}.stock-report tr.stock-subtotal td:last-child{border-right-color:#333}.stock-report tfoot th,.stock-report tfoot td{border-top:1.6px solid #111}.stock-report tfoot td,.stock-report tfoot th{font-weight:400}</style><div class="tablewrap" style="margin-top:12px"><table class="stock-report"><tr><th rowspan="2">組合名</th><th rowspan="2">区分</th>`;
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
 const xCoop=tableX+coopW,xSeason=xCoop+seasonW,xData=xSeason;ctx.fillStyle='#f1f1f1';ctx.fillRect(tableX,tableY,tableW,h1+h2);ctx.fillStyle='#000';box(tableX,tableY,tableW,tableH);[xCoop,xSeason,xData+dataW].forEach(x=>{ctx.beginPath();ctx.moveTo(x,tableY);ctx.lineTo(x,tableY+tableH);ctx.stroke()});
 text('組合名',tableX+coopW/2,tableY+(h1+h2)/2,14,'center',true);text('区分',xCoop+seasonW/2,tableY+(h1+h2)/2,14,'center',true);text('計',xData+dataW+totalW/2,tableY+(h1+h2)/2,14,'center',true);
 let ci=0;GROUPS.forEach(g=>{const gx=xData+ci*itemW,gw=g.items.length*itemW;box(gx,tableY,gw,h1);fit(g.name,gx,tableY+h1/2,gw,13,true);g.items.forEach((it,j)=>{const ix=gx+j*itemW;box(ix,tableY+h1,itemW,h2);fit(it,ix,tableY+h1+h2/2,itemW,12,true)});ci+=g.items.length});
 let y=tableY+h1+h2;state.coops.forEach(coop=>{
  ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();ctx.lineWidth=.55;
  SEASONS.forEach((season,si)=>{ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();if(si===0)fit(coop,tableX,y+rowH/2,coopW,13,true);fit(season,xCoop,y+rowH/2,seasonW,14,true);let rt=0;cols.forEach((c,j)=>{const q=m[[year,coop,c.group,c.item,season].join('|')]||0;rt+=q;const xx=xData+j*itemW;ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+rowH);ctx.stroke();if(q)fit(fmt(q),xx,y+rowH/2,itemW,18,false)});if(rt)fit(fmt(rt),xData+dataW,y+rowH/2,totalW,18,false);y+=rowH});
  ctx.fillStyle='#fff';ctx.fillRect(tableX,y,tableW,rowH);ctx.fillStyle='#000';ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();fit('小計',xCoop,y+rowH/2,seasonW,13,false);let ct=0;cols.forEach((c,j)=>{const q=SEASONS.reduce((a,se)=>a+(m[[year,coop,c.group,c.item,se].join('|')]||0),0);ct+=q;const xx=xData+j*itemW;if(q)fit(fmt(q),xx,y+rowH/2,itemW,16,false)});if(ct)fit(fmt(ct),xData+dataW,y+rowH/2,totalW,16,false);y+=rowH;
 });
 ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();fit('合計',tableX,y+footH/2,coopW+seasonW,14,true);cols.forEach((c,j)=>{const q=state.coops.reduce((a,coop)=>a+SEASONS.reduce((b,se)=>b+(m[[year,coop,c.group,c.item,se].join('|')]||0),0),0);const xx=xData+j*itemW;ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+footH);ctx.stroke();if(q)fit(fmt(q),xx,y+footH/2,itemW,16,false)});const grand=total(year);if(grand)fit(fmt(grand),xData+dataW,y+footH/2,totalW,16,false);
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
 saveCompanies.onclick=()=>{const arr=state.companies.map((c,i)=>{const q=f=>document.querySelector(`[data-company-i="${i}"][data-company-field="${f}"]`);return {name:(q('name')?.value||'').trim(),address:(q('address')?.value||'').trim(),phone:(q('phone')?.value||'').trim()}}).filter(c=>c.name);if(new Set(arr.map(c=>c.name)).size!==arr.length)return alert('会社名が重複しています。');state.companies=arr;save();renderCompanies();alert('会社情報を保存しました')};
 x.onclick=home;
}

if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));home();

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

function shipmentDetail(id){
 const s=state.shipments.find(x=>x.id===id);if(!s)return shipments();
 const statusName={draft:'下書き',confirmed:'確定・在庫反映済',shipped:'出荷済',cancelled:'取消'}[s.status]||s.status;
 const totalQ=s.lines.reduce((a,l)=>a+Number(l.qty||0),0),src=shipmentSource(s),dst=shipmentDest(s);
 const shipmentYears=[...new Set(s.lines.map(l=>l.year||s.baseYear||DEFAULT_YEAR))].sort((a,b)=>YEARS.indexOf(a)-YEARS.indexOf(b));
 app.innerHTML=`<section class="card"><div class="row"><h2>📦 出荷指示書 ${esc(s.id)}</h2><span class="pill">${statusName}</span></div><div class="subgrid"><div class="card" style="margin:0;padding:10px;background:#f8fafc"><b>出荷元</b><br>${esc(src.name)}<br><span class="small">${esc(src.address||'')} ${src.phone?'／ TEL '+esc(src.phone):''}</span></div><div class="card" style="margin:0;padding:10px;background:#f8fafc"><b>出荷先</b><br>${esc(dst.name)}<br><span class="small">${esc(dst.address||'')} ${dst.phone?'／ TEL '+esc(dst.phone):''}</span></div></div><p><b>出荷日：</b>${esc(s.shipDate||'')}　　<b>希望着日：</b>${esc(s.arrivalDate||'未指定')}</p><p><b>生産年度：</b>${esc(shipmentYears.map(y=>y+'年産').join('・'))}　　<b>合計：</b>${fmt(totalQ)}</p><div class="tablewrap"><table style="min-width:900px"><tr><th>生産年度</th><th>漁協</th><th>季節</th><th>大分類</th><th>細分類</th><th>数量</th><th>備考</th></tr>${s.lines.map(l=>`<tr><td>${esc(l.year||DEFAULT_YEAR)}年産</td><td>${esc(l.coop)}</td><td>${esc(l.season)}</td><td>${esc(l.group)}</td><td>${esc(l.item)}</td><td>${fmt(l.qty)}</td><td>${esc(l.memo||'')}</td></tr>`).join('')}</table></div><p class="muted">備考：${esc(s.memo||'')}</p><div class="note">下書きでは在庫は変わりません。「出荷指示を確定して在庫反映」を押すと在庫表から即時差し引き、取消時は自動で在庫へ戻します。出荷済みにすると入出庫履歴へ正式な出庫記録を作成します。</div><div class="toolbar"><button class="btn" id="pdf">📄 PDF・FAX用</button>${s.status==='draft'?'<button class="btn" id="confirm">出荷指示を確定して在庫反映</button>':''}${s.status==='confirmed'?'<button class="btn" id="shipped">出荷済にする</button>':''}${s.status==='draft'?'<button class="btn secondary" id="edit">修正</button>':''}${s.status!=='shipped'&&s.status!=='cancelled'?'<button class="btn danger" id="cancel">取消</button>':''}<button class="btn secondary" id="back">一覧へ</button></div></section>`;
 pdf.onclick=()=>openShipmentPdfDirect(s.id);
 if(s.status==='draft')confirm.onclick=()=>{for(const l of s.lines){const av=available(l.year||DEFAULT_YEAR,l.coop,l.season,l.group,l.item);const reservedOther=state.shipments.filter(x=>x.id!==s.id&&x.status==='confirmed').reduce((a,x)=>a+x.lines.filter(y=>key(y)===key(l)).reduce((b,y)=>b+Number(y.qty||0),0),0);if(Number(l.qty)>Math.max(0,av-reservedOther))return alert(`${l.year||DEFAULT_YEAR}年産 ${l.coop} ${l.season} ${l.group} ${l.item} の出荷可能在庫は ${fmt(Math.max(0,av-reservedOther))} です。`)}s.status='confirmed';s.confirmedAt=new Date().toISOString();save();alert('出荷指示を確定し、在庫表へ反映しました');shipmentDetail(s.id)};
 if(s.status==='confirmed')shipped.onclick=()=>{if(!confirm('出荷済みにしますか？ 在庫は確定時にすでに反映されています。'))return;for(const l of s.lines){state.records.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),type:'out',year:l.year||DEFAULT_YEAR,coop:l.coop,season:l.season,group:l.group,item:l.item,qty:Number(l.qty),date:s.shipDate||today(),memo:`出荷指示 ${s.id} / ${shipmentDest(s).name}`})}s.status='shipped';s.shippedAt=new Date().toISOString();save();alert('出荷済みにしました。入出庫履歴へ出庫記録を作成しました。');shipmentDetail(s.id)};
 if(s.status==='draft')edit.onclick=()=>shipmentForm(s.id);
 if(s.status!=='shipped'&&s.status!=='cancelled')cancel.onclick=()=>{if(confirm(s.status==='confirmed'?'取消すると在庫表へ数量を戻します。よろしいですか？':'この出荷指示を取消しますか？')){s.status='cancelled';s.cancelledAt=new Date().toISOString();save();alert('出荷指示を取消しました');shipmentDetail(s.id)}};
 back.onclick=shipments;
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
 [[src,'出荷元'],[dst,'出荷先']].forEach(([c,label],i)=>{const x=margin+i*half;box(x,infoY,half,infoH);text(`${label}：${c.name||''}`,x+10,infoY+18,16,'left',true);text(`住所：${c.address||''}`,x+10,infoY+40,14);text(`電話：${c.phone||''}`,x+10,infoY+60,14)});
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
  SEASONS.forEach((season,si)=>{ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();if(first){fit(year+'年産',tableX,y+rowH/2,yearW,13,true);first=false}if(si===0)fit(coop,xYear,y+rowH/2,coopW,13,true);fit(season,xCoop,y+rowH/2,seasonW,14,true);let rt=0;cols.forEach((c,j)=>{const q=lines.filter(l=>l.coop===coop&&l.season===season&&l.group===c.group&&l.item===c.item).reduce((a,l)=>a+Number(l.qty||0),0);rt+=q;const xx=xData+j*itemW;ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+rowH);ctx.stroke();if(q)fit(fmt(q),xx,y+rowH/2,itemW,18,false)});if(rt)fit(fmt(rt),xData+dataW,y+rowH/2,totalW,18,false);y+=rowH});
  ctx.fillStyle='#fff';ctx.fillRect(xYear,y,tableW-yearW,rowH);ctx.fillStyle='#000';ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();fit('小計',xCoop,y+rowH/2,seasonW,13,false);let ct=0;cols.forEach((c,j)=>{const q=lines.filter(l=>l.coop===coop&&l.group===c.group&&l.item===c.item).reduce((a,l)=>a+Number(l.qty||0),0);ct+=q;const xx=xData+j*itemW;ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+rowH);ctx.stroke();if(q)fit(fmt(q),xx,y+rowH/2,itemW,16,false)});if(ct)fit(fmt(ct),xData+dataW,y+rowH/2,totalW,16,false);y+=rowH;
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
 const rows=printYears.flatMap(y=>state.coops.flatMap(c=>{const seasonRows=SEASONS.map((season,si)=>{const lns=s.lines.filter(x=>(x.year||DEFAULT_YEAR)===y&&x.coop===c&&x.season===season);const rowTotal=lns.reduce((a,x)=>a+Number(x.qty||0),0);return `<tr><th>${si===0?esc(y)+'年産':''}</th><th class="coop">${si===0?esc(c):''}</th><th class="season">${esc(season)}</th>${cols.map(ci=>`<td>${fmtBlankZero(lns.filter(x=>x.group===ci.group&&x.item===ci.item).reduce((a,x)=>a+Number(x.qty||0),0))}</td>`).join('')}<td>${fmtBlankZero(rowTotal)}</td></tr>`});const cl=s.lines.filter(x=>(x.year||DEFAULT_YEAR)===y&&x.coop===c);const subtotal=`<tr class="total"><th></th><th></th><th>小計</th>${cols.map(ci=>`<td>${fmtBlankZero(cl.filter(x=>x.group===ci.group&&x.item===ci.item).reduce((a,x)=>a+Number(x.qty||0),0))}</td>`).join('')}<td>${fmtBlankZero(cl.reduce((a,x)=>a+Number(x.qty||0),0))}</td></tr>`;return [...seasonRows,subtotal]})).join('');
 const w=window.open('','_blank');if(!w)return alert('ポップアップがブロックされました。Safariのポップアップ設定を確認してください。');
 w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>出荷指示書 ${esc(s.id)}</title><style>@page{size:297mm 210mm;margin:8mm}html,body{width:281mm;min-height:194mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif;color:#000;margin:0;font-size:9px}.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #000;padding-bottom:4px}.title{font-size:22px;font-weight:700;letter-spacing:5px}.meta{text-align:right;line-height:1.6}.info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:7px 0}.box{border:1px solid #000;padding:5px;min-height:25px}.label{font-weight:700}.table{width:100%;border-collapse:collapse;table-layout:fixed}.table th,.table td{border:.45px solid #333;padding:2px;text-align:center;height:19px;font-weight:400;overflow:hidden;white-space:nowrap}.table td{font-size:11px}.table tbody tr:nth-child(4n) th,.table tbody tr:nth-child(4n) td{border-bottom:1.6px solid #111;font-weight:400}.table thead th{background:#eee}.table .coop{width:55px}.table .season{width:24px}.foot{display:grid;grid-template-columns:1fr 2fr 1fr;margin-top:8px;gap:8px}.sign{height:38px;border:1px solid #000;padding:5px}.total{font-weight:400}.note{margin-top:6px;border:1px solid #000;padding:5px;min-height:28px}button{padding:10px 16px;font-size:16px}</style></head><body><div id="sheet"><div class="head"><div class="title">出 荷 指 示 書</div><div class="meta">指示番号：${esc(s.id)}<br>作成日：${esc(today())}</div></div><div class="info"><div class="box"><span class="label">出荷元：</span>${esc(shipmentSource(s).name)}<br>住所：${esc(shipmentSource(s).address)}<br>電話：${esc(shipmentSource(s).phone)}</div><div class="box"><span class="label">出荷先：</span>${esc(shipmentDest(s).name)} 御中<br>住所：${esc(shipmentDest(s).address)}<br>電話：${esc(shipmentDest(s).phone)}</div><div class="box"><span class="label">出荷日：</span>${esc(s.shipDate||'')}<br><span class="label">希望着日：</span>${esc(s.arrivalDate||'')}</div></div><div class="box" style="margin-bottom:6px"><span class="label">生産年度：</span>${esc(printYears.map(y=>y+'年産').join('・'))}　　<span class="label">区分：</span>${esc(seasons)}　　<span class="label">合計：</span>${fmt(s.lines.reduce((a,l)=>a+Number(l.qty||0),0))}</div><table class="table"><thead><tr><th rowspan="2">生産年度</th><th class="coop" rowspan="2">組合名</th><th class="season" rowspan="2">区分</th>${GROUPS.map(g=>`<th colspan="${g.items.length}">${esc(g.name)}</th>`).join('')}<th rowspan="2">計</th></tr><tr>${GROUPS.map(g=>g.items.map(i=>`<th>${esc(i)}</th>`).join('')).join('')}</tr></thead><tbody>${rows}</tbody><tfoot><tr class="total"><th colspan="3">合計</th>${cols.map(ci=>`<td>${fmtBlankZero(s.lines.filter(l=>l.group===ci.group&&l.item===ci.item).reduce((a,x)=>a+Number(x.qty||0),0))}</td>`).join('')}<td>${fmtBlankZero(s.lines.reduce((a,l)=>a+Number(l.qty||0),0))}</td></tr></tfoot></table><div class="note"><b>備考：</b>${esc(s.memo||'')}${s.lines.some(l=>l.memo)?'　明細備考：'+esc(s.lines.filter(l=>l.memo).map(l=>l.memo).join('／')):''}</div><div class="foot"><div class="sign">出荷元：${esc(shipmentSource(s).name)}</div><div class="sign">受注・配送指示：</div><div class="sign">FAX送信欄：</div></div></div><div style="margin-top:12px;text-align:center;display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button id="printPdfBtn" type="button">横向きPDFを作成</button><button id="returnBtn" type="button">元の画面に戻る</button><div id="msg" style="width:100%;font-size:13px;color:#627d98">PDF自体をA4横向きで作成するため、iPhoneの印刷方向設定に左右されません。</div></div><script>(function(){var p=document.getElementById('printPdfBtn'),r=document.getElementById('returnBtn'),m=document.getElementById('msg');if(p)p.onclick=async function(){var pw=window.open('about:blank','_blank');if(!pw){alert('PDF表示用の画面を開けませんでした。Safariのポップアップ設定を確認してください。');return;}pw.document.write('<meta name="viewport" content="width=device-width"><div style="font-family:-apple-system;padding:30px;text-align:center">A4横向きPDFを作成しています…</div>');p.disabled=true;p.textContent='作成中…';m.textContent='横向きPDFを生成しています。';try{var opener=window.opener;if(!opener||!opener._shipmentPdfBlobById)throw new Error('PDF作成機能を呼び出せませんでした。');var blob=await opener._shipmentPdfBlobById(${JSON.stringify(s.id)});var url=URL.createObjectURL(blob);pw.location.replace(url);m.textContent='A4横向きPDFを開きました。PDF画面から共有・印刷してください。';}catch(e){try{pw.close()}catch(_e){}alert('横向きPDFを作成できませんでした。\\n'+(e&&e.message?e.message:e));m.textContent='PDF作成に失敗しました。';}finally{p.disabled=false;p.textContent='横向きPDFを作成';}};if(r)r.onclick=function(){if(window.opener){window.close()}else{history.back()}}})();<\/script></body></html>`);w.document.close();setTimeout(()=>w.focus(),300);
}
/* ナビ・その他を更新 */
const shipNavBtnEl=document.getElementById('shipNavBtn');
const stockNavBtnEl=document.getElementById('stockNavBtn');
const logsNavBtnEl=document.getElementById('logsNavBtn');
const inNavBtnEl=document.getElementById('inNavBtn');
const moreBtnEl=document.getElementById('moreBtn');
if(shipNavBtnEl)shipNavBtnEl.onclick=shipments;
if(stockNavBtnEl)stockNavBtnEl.onclick=stock;
if(logsNavBtnEl)logsNavBtnEl.onclick=logs;
if(inNavBtnEl)inNavBtnEl.onclick=()=>form('in');
if(moreBtnEl)moreBtnEl.onclick=exportsPage;
home();


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
    for(const l of s.lines){const av=available(l.year||DEFAULT_YEAR,l.coop,l.season,l.group,l.item);const reservedOther=state.shipments.filter(x=>x.id!==s.id&&x.status==='confirmed').reduce((a,x)=>a+x.lines.filter(y=>key(y)===key(l)).reduce((b,y)=>b+Number(y.qty||0),0),0);if(Number(l.qty)>Math.max(0,av-reservedOther))return alert(`${l.coop} ${l.season} ${l.group} ${l.item} の出荷可能在庫が不足しています。`)}
    if(!confirm('出荷済みにすると、明細数量を在庫から出庫します。よろしいですか？'))return;
    for(const l of s.lines){state.records.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),type:'out',year:l.year||DEFAULT_YEAR,coop:l.coop,season:l.season,group:l.group,item:l.item,qty:Number(l.qty),date:s.shipDate||today(),memo:`出荷指示 ${s.id} / ${s.dest}`})}
    s.status='shipped';s.shippedAt=new Date().toISOString();save();alert('出荷済みとして在庫から減算しました');shipmentDetail(s.id);
  };
};
