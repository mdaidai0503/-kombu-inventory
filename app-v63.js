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
 const xCoop=tableX+coopW,xSeason=xCoop+seasonW,xData=xSeason;ctx.fillStyle='#f1f1f1';ctx.fillRect(tableX,tableY,tableW,h1+h2);ctx.fillStyle='#000';box(tableX,tableY,tableW,tableH);[xCoop,xSeason,xData+dataW].forEach(x=>{ctx.beginPath();ctx.moveTo(x,tableY);ctx.lineTo(x,tableY+tableH);ctx.stroke()});
 const shHead=!!window.__v63ShipmentHeaderLarge; text('組合名',tableX+coopW/2,tableY+(h1+h2)/2,shHead?18:14,'center',true);text('区分',xCoop+seasonW/2,tableY+(h1+h2)/2,shHead?18:14,'center',true);text('計',xData+dataW+totalW/2,tableY+(h1+h2)/2,shHead?18:14,'center',true);
 let ci=0;GROUPS.forEach(g=>{const gx=xData+ci*itemW,gw=g.items.length*itemW;box(gx,tableY,gw,h1);fit(g.name,gx,tableY+h1/2,gw,shHead?17:13,true);g.items.forEach((it,j)=>{const ix=gx+j*itemW;box(ix,tableY+h1,itemW,h2);fit(it,ix,tableY+h1+h2/2,itemW,shHead?16:12,true)});ci+=g.items.length});
 let y=tableY+h1+h2;state.coops.forEach(coop=>{
  ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();ctx.lineWidth=.55;
  SEASONS.forEach((season,si)=>{ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();if(si===0)fit(coop,tableX,y+(window.__v58ShipmentCoopLower?rowH*1.7:rowH/2),coopW,13,true);fit(season,xCoop,y+rowH/2,seasonW,14,true);let rt=0;cols.forEach((c,j)=>{const q=m[[year,coop,c.group,c.item,season].join('|')]||0;rt+=q;const xx=xData+j*itemW;ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+rowH);ctx.stroke();if(q)fit(fmt(q),xx,y+rowH/2,itemW,20,false)});if(rt)fit(fmt(rt),xData+dataW,y+rowH/2,totalW,20,false);y+=rowH});
  ctx.fillStyle='#fff';ctx.fillRect(tableX,y,tableW,rowH);ctx.fillStyle='#000';ctx.beginPath();ctx.moveTo(tableX,y);ctx.lineTo(tableX+tableW,y);ctx.stroke();fit('小計',xCoop,y+rowH/2,seasonW,13,false);let ct=0;cols.forEach((c,j)=>{const q=SEASONS.reduce((a,se)=>a+(m[[year,coop,c.group,c.item,se].join('|')]||0),0);ct+=q;const xx=xData+j*itemW;if(q)fit(fmt(q),xx,y+rowH/2,itemW,13,false)});if(ct)fit(fmt(ct),xData+dataW,y+rowH/2,totalW,13,false);y+=rowH;
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
 app.innerHTML=`<section class="card"><div class="row"><h2>📦 出荷指示書 ${esc(s.id)}</h2><span class="pill">${statusName}</span></div><div class="subgrid"><div class="card" style="margin:0;padding:10px;background:#f8fafc"><b>出荷元</b><br>${esc(src.name)}<br><span class="small">${esc(src.address||'')} ${src.phone?'／ TEL '+esc(src.phone):''}</span></div><div class="card" style="margin:0;padding:10px;background:#f8fafc"><b>出荷先</b><br>${esc(dst.name)}<br><span class="small">${esc(dst.address||'')} ${dst.phone?'／ TEL '+esc(dst.phone):''}</span></div></div><p><b>出荷日：</b>${esc(s.shipDate||'')}　　<b>希望着日：</b>${esc(s.arrivalDate||'未指定')}</p><p><b>生産年度：</b>${esc(shipmentYears.map(y=>y+'年産').join('・'))}　　<b>合計：</b>${fmt(totalQ)}</p><div class="tablewrap"><table style="min-width:900px"><tr><th>生産年度</th><th>漁協</th><th>季節</th><th>大分類</th><th>細分類</th><th>数量</th><th>備考</th></tr>${s.lines.map(l=>`<tr><td>${esc(l.year||DEFAULT_YEAR)}年産</td><td>${esc(l.coop)}</td><td>${esc(l.season)}</td><td>${esc(l.group)}</td><td>${esc(l.item)}</td><td>${fmt(l.qty)}</td><td>${esc(l.memo||'')}</td></tr>`).join('')}</table></div><p class="muted">備考：${esc(s.memo||'')}</p><div class="note">下書きでは在庫は変わりません。「出荷指示を確定して在庫反映」を押すと在庫表から即時差し引き、取消時は自動で在庫へ戻します。出荷済みにすると入出庫履歴へ正式な出庫記録を作成します。</div><div class="toolbar"><button class="btn" id="pdf">📄 PDF・FAX用</button>${s.status==='draft'?'<button class="btn" id="confirmShipmentBtn">出荷指示を確定して在庫反映</button>':''}${s.status==='confirmed'?'<button class="btn" id="shippedShipmentBtn">出荷済にする</button>':''}${s.status==='draft'?'<button class="btn secondary" id="editShipmentBtn">修正</button>':''}${s.status!=='shipped'&&s.status!=='cancelled'?'<button class="btn danger" id="cancelShipmentBtn">取消</button>':''}<button class="btn secondary" id="backShipmentBtn">一覧へ</button></div></section>`;
 const pdfBtn=document.getElementById('pdf');if(pdfBtn)pdfBtn.onclick=()=>openShipmentPdfDirect(s.id);
 if(s.status==='draft'){
  const confirmBtn=document.getElementById('confirmShipmentBtn');if(confirmBtn)confirmBtn.onclick=()=>{for(const l of s.lines){const av=stockAvailableForShipment(l.year||DEFAULT_YEAR,l.coop,l.season,l.group,l.item,s.id);if(Number(l.qty)>av)return alert(`${l.year||DEFAULT_YEAR}年産 ${l.coop} ${l.season} ${l.group} ${l.item} の出荷可能在庫は ${fmt(av)} です。`)}s.status='confirmed';s.confirmedAt=new Date().toISOString();save();alert('出荷指示を確定し、在庫表へ反映しました');shipmentDetail(s.id)};
  const editBtn=document.getElementById('editShipmentBtn');if(editBtn)editBtn.onclick=()=>shipmentForm(s.id);
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
    for(const l of s.lines){const av=available(l.year||DEFAULT_YEAR,l.coop,l.season,l.group,l.item);const reservedOther=state.shipments.filter(x=>x.id!==s.id&&x.status==='confirmed').reduce((a,x)=>a+x.lines.filter(y=>key(y)===key(l)).reduce((b,y)=>b+Number(y.qty||0),0),0);if(Number(l.qty)>Math.max(0,av-reservedOther))return alert(`${l.coop} ${l.season} ${l.group} ${l.item} の出荷可能在庫が不足しています。`)}
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
function hStockCanvas(y){const W=1684,H=1191,m=35,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);x.strokeStyle='#222';x.fillStyle='#000';const font=(z,b=false)=>`${b?'700 ':'400 '}${z}px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif`;const txt=(t,xx,yy,z=14,a='center',b=false)=>{x.font=font(z,b);x.textAlign=a;x.textBaseline='middle';x.fillText(String(t??''),xx,yy)};const rows=H_SECTIONS.flatMap(s=>s.items.map(g=>({section:s.name,grade:g}))),mt=hMatrix();txt('日 高 昆 布　在 庫 集 計 表',m,45,30,'left',true);txt(`${y}年産`,W-m,45,18,'right',true);const tx=m,ty=80,tw=W-m*2,secW=70,gradeW=95,totalW=60,colW=(tw-secW-gradeW-totalW)/H_LOCATIONS.length,rowH=26,headH=48; x.lineWidth=.55;x.strokeRect(tx,ty,tw,headH+rows.length*rowH+32);[tx+secW,tx+secW+gradeW,tx+tw-totalW].forEach(xx=>{x.beginPath();x.moveTo(xx,ty);x.lineTo(xx,ty+headH+rows.length*rowH+32);x.stroke()});const shHead=!!window.__v63ShipmentHeaderLarge;txt('区分',tx+secW/2,ty+headH/2,shHead?17:13);txt('等級',tx+secW+gradeW/2,ty+headH/2,shHead?17:13);H_LOCATIONS.forEach((l,i)=>{const xx=tx+secW+gradeW+i*colW;x.beginPath();x.moveTo(xx,ty);x.lineTo(xx,ty+headH+rows.length*rowH+32);x.stroke();txt(l,xx+colW/2,ty+headH/2,shHead?14:10)});txt('計',tx+tw-totalW/2,ty+headH/2,shHead?16:12);let yy=ty+headH,last=null;rows.forEach(r=>{if(r.section!==last){x.lineWidth=1.6;x.beginPath();x.moveTo(tx,yy);x.lineTo(tx+tw,yy);x.stroke();x.lineWidth=.55}if(r.section!==last){const sectionY=window.__v59HidakaSectionCentered?yy+rowH*(H_SECTIONS.find(z=>z.name===r.section)?.items.length||1)/2:yy+rowH/2;txt(r.section,tx+secW/2,sectionY,12)}txt(r.grade,tx+secW+gradeW/2,yy+rowH/2,11);let rt=0;H_LOCATIONS.forEach((l,i)=>{const q=mt[[y,l,r.section,r.grade].join('|')]||0,xx=tx+secW+gradeW+i*colW;rt+=q;x.beginPath();x.moveTo(xx,yy);x.lineTo(xx,yy+rowH);x.stroke();if(q)txt(fmt(q),xx+colW/2,yy+rowH/2,14)});if(rt)txt(fmt(rt),tx+tw-totalW/2,yy+rowH/2,14);x.beginPath();x.moveTo(tx,yy+rowH);x.lineTo(tx+tw,yy+rowH);x.stroke();yy+=rowH;last=r.section});x.lineWidth=1.6;x.beginPath();x.moveTo(tx,yy);x.lineTo(tx+tw,yy);x.stroke();x.lineWidth=.55;txt('合計',tx+(secW+gradeW)/2,yy+16,13,'center',true);H_LOCATIONS.forEach((l,i)=>{const q=rows.reduce((a,r)=>a+(mt[[y,l,r.section,r.grade].join('|')]||0),0);if(q)txt(fmt(q),tx+secW+gradeW+i*colW+colW/2,yy+16,13)});txt(fmt(hTotal(y)),tx+tw-totalW/2,yy+16,13);return c}
async function hOpenStockPdf(y){const w=window.open('about:blank','_blank');if(!w)return alert('PDF画面を開けません。');try{const b=await _singleCanvasPdfBlob(hStockCanvas(y)),u=URL.createObjectURL(b);w.location.replace(u);setTimeout(()=>URL.revokeObjectURL(u),600000)}catch(e){w.close();alert('PDF作成に失敗しました。')}}
function hLogs(){const a=hState.records.slice().reverse();app.innerHTML=`<section class="card"><h2>日高昆布 入出庫履歴</h2><div class="tablewrap"><table style="min-width:900px"><tr><th>日付</th><th>区分</th><th>年度</th><th>産地</th><th>区分</th><th>等級</th><th>数量</th><th>操作</th></tr>${a.map(r=>`<tr><td>${r.date}</td><td>${r.type==='in'?'入庫':'出庫'}</td><td>${r.year}</td><td>${r.location}</td><td>${r.section}</td><td>${r.grade}</td><td>${fmt(r.qty)}</td><td><button class="mini" data-he="${r.id}">修正</button> <button class="mini danger" data-hd="${r.id}">削除</button></td></tr>`).join('')}</table></div><button class="btn secondary" id="hlb">戻る</button></section>`;app.querySelectorAll('[data-he]').forEach(b=>b.onclick=()=>hForm(null,b.dataset.he));app.querySelectorAll('[data-hd]').forEach(b=>b.onclick=()=>{if(confirm('削除しますか？')){hState.records=hState.records.filter(r=>r.id!==b.dataset.hd);hSave();hLogs()}});hlb.onclick=hHome}
function hShipId(){return 'H'+String(hState.shipmentSeq++).padStart(5,'0')}
function hShipments(){app.innerHTML=`<section class="card"><div class="row"><h2>日高昆布 出荷指示</h2><button class="mini" id="hnew">＋新規</button></div><div class="tablewrap"><table><tr><th>番号</th><th>出荷元</th><th>出荷先</th><th>出荷日</th><th>数量</th><th>状態</th><th></th></tr>${hState.shipments.slice().reverse().map(s=>`<tr><td>${s.id}</td><td>${esc(s.source?.name||'')}</td><td>${esc(s.dest?.name||'')}</td><td>${s.shipDate||''}</td><td>${fmt((s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0))}</td><td>${s.status}</td><td><button class="mini" data-hs="${s.id}">開く</button></td></tr>`).join('')}</table></div><button class="btn secondary" id="hsb">戻る</button></section>`;hnew.onclick=()=>hShipForm();app.querySelectorAll('[data-hs]').forEach(b=>b.onclick=()=>hShipDetail(b.dataset.hs));hsb.onclick=hHome}
function hShipForm(id=null){const s=id?hState.shipments.find(x=>x.id===id):null;let lines=s?.lines?.map(x=>({...x}))||[];app.innerHTML=`<section class="card"><h2>日高昆布 ${s?'出荷指示修正':'新規出荷指示'}</h2><div class="form"><label>出荷元 会社名<input id="hsrc" value="${esc(s?.source?.name||'㈱浜中運輸')}"></label><label>出荷元 住所<input id="hsrca" value="${esc(s?.source?.address||'')}"></label><label>出荷元 電話<input id="hsrcp" value="${esc(s?.source?.phone||'')}"></label><label>出荷先 会社名<input id="hdst" value="${esc(s?.dest?.name||'')}"></label><label>出荷先 住所<input id="hdsta" value="${esc(s?.dest?.address||'')}"></label><label>出荷先 電話<input id="hdstp" value="${esc(s?.dest?.phone||'')}"></label><div class="subgrid"><label>出荷日<input id="hsd" type="date" value="${s?.shipDate||today()}"></label><label>希望着日<input id="had" type="date" value="${s?.arrivalDate||''}"></label></div><div id="hsl"></div><button class="btn secondary" id="hala">＋明細追加</button><button class="btn" id="hssv">保存</button><button class="btn secondary" id="hsfb">戻る</button></div></section>`;function rend(){hsl.innerHTML=lines.map((l,i)=>`<div class="card" style="background:#f8fafc"><label>年度<select data-hi="${i}" data-hf="year">${hYearOptions(l.year)}</select></label><label>産地<select data-hi="${i}" data-hf="location">${H_LOCATIONS.map(x=>`<option ${x===l.location?'selected':''}>${x}</option>`).join('')}</select></label><label>区分・等級<select data-hi="${i}" data-hf="sg">${hGradeOptions(l.section,l.grade)}</select></label><label>数量<input type="number" value="${esc(l.qty||'')}" data-hi="${i}" data-hf="qty"></label><button class="mini danger" data-hr="${i}">削除</button></div>`).join('');hsl.querySelectorAll('[data-hf]').forEach(e=>e.onchange=()=>{const i=+e.dataset.hi;if(e.dataset.hf==='sg'){[lines[i].section,lines[i].grade]=e.value.split('|')}else lines[i][e.dataset.hf]=e.value});hsl.querySelectorAll('[data-hr]').forEach(e=>e.onclick=()=>{lines.splice(+e.dataset.hr,1);rend()})}hala.onclick=()=>{lines.push({year:hState.activeYear,location:H_LOCATIONS[0],section:'走り',grade:'1等',qty:''});rend()};hssv.onclick=()=>{if(!hdst.value.trim()||!lines.length)return alert('出荷先と明細を入力してください。');for(const l of lines){l.qty=Number(l.qty);if(!l.qty||l.qty>hAvail(l.year,l.location,l.section,l.grade,s?.id))return alert(`${l.location} ${l.section} ${l.grade} の在庫が不足しています。`)}const o=s||{id:hShipId(),status:'draft',createdAt:new Date().toISOString()};Object.assign(o,{source:{name:hsrc.value,address:hsrca.value,phone:hsrcp.value},dest:{name:hdst.value,address:hdsta.value,phone:hdstp.value},shipDate:hsd.value,arrivalDate:had.value,lines});if(!s)hState.shipments.push(o);hSave();hShipDetail(o.id)};hsfb.onclick=hShipments;rend()}
function hShipDetail(id){const s=hState.shipments.find(x=>x.id===id);if(!s)return hShipments();app.innerHTML=`<section class="card"><div class="row"><h2>日高昆布 出荷指示 ${s.id}</h2><span class="pill">${s.status}</span></div><p><b>出荷先：</b>${esc(s.dest?.name||'')}　<b>出荷元：</b>${esc(s.source?.name||'')}</p><p><b>出荷日：</b>${s.shipDate||''}　<b>合計：</b>${fmt((s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0))}</p><div class="toolbar"><button class="btn" id="hpdfs">PDF・FAX用</button>${s.status==='draft'?'<button class="btn" id="hconf">確定・在庫反映</button><button class="btn secondary" id="hedit">修正</button>':''}${s.status==='confirmed'?'<button class="btn" id="hshipped">出荷済</button>':''}<button class="btn secondary" id="hback">一覧へ</button></div></section>`;const pdf=document.getElementById('hpdfs');if(pdf)pdf.onclick=()=>hOpenShipPdf(s);if(s.status==='draft'){const c=document.getElementById('hconf');if(c)c.onclick=()=>{for(const l of s.lines)if(Number(l.qty)>hAvail(l.year,l.location,l.section,l.grade,s.id))return alert('在庫不足があります。');s.status='confirmed';s.confirmedAt=new Date().toISOString();hSave();alert('出荷指示を確定し、在庫表へ反映しました。');hShipDetail(id)};const e=document.getElementById('hedit');if(e)e.onclick=()=>hShipForm(id)}if(s.status==='confirmed'){const sh=document.getElementById('hshipped');if(sh)sh.onclick=()=>{if(!window.confirm('出荷済みにしますか？'))return;s.lines.forEach(l=>hState.records.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),type:'out',year:l.year,location:l.location,section:l.section,grade:l.grade,qty:Number(l.qty),date:s.shipDate||today(),memo:`出荷指示 ${s.id}`}));s.status='shipped';s.shippedAt=new Date().toISOString();hSave();hShipDetail(id)}}const b=document.getElementById('hback');if(b)b.onclick=hShipments}
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
 {name:'貝殻棹前',items:['元①','棹①','③','④']},
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
function nReportCanvas(y,ship=null){const W=1684,H=1191,margin=34,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),cols=nItems(),title=ship?'出 荷 指 示 書（根室産昆布）':'根 室 産 昆 布　在 庫 集 計 表';x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#000';x.strokeStyle='#222';const f=(z,b=false)=>`${b?'700 ':'400 '}${z}px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif`,t=(v,xx,yy,z=13,a='center',b=false)=>{x.font=f(z,b);x.textAlign=a;x.textBaseline='middle';x.fillText(String(v??''),xx,yy)};t(title,margin,38,28,'left',true);t(`${y}年産`,W-margin,38,16,'right',true);if(ship){t(`指示番号：${ship.id}　出荷日：${ship.shipDate||''}`,W-margin,62,13,'right');t(`出荷先：${ship.dest?.name||''}　${ship.dest?.address||''}　TEL ${ship.dest?.phone||''}`,margin,62,12,'left')}const ty=ship?85:70,tw=W-margin*2,coopW=92,seasonW=45,totalW=58,dataW=tw-coopW-seasonW-totalW,colW=dataW/cols.length,h1=28,h2=28,rowH=39,footH=34,tableH=h1+h2+N_COOPS.length*4*rowH+footH;x.lineWidth=.55;x.strokeRect(margin,ty,tw,tableH);const xData=margin+coopW+seasonW;[margin+coopW,xData,xData+dataW].forEach(xx=>{x.beginPath();x.moveTo(xx,ty);x.lineTo(xx,ty+tableH);x.stroke()});const shHead=!!window.__v63ShipmentHeaderLarge;t('組合名',margin+coopW/2,ty+(h1+h2)/2,shHead?16:12);t('区分',margin+coopW+seasonW/2,ty+(h1+h2)/2,shHead?16:12);t('計',xData+dataW+totalW/2,ty+(h1+h2)/2,shHead?16:12);let ci=0;N_GROUPS.forEach(g=>{const gx=xData+ci*colW,gw=g.items.length*colW;x.strokeRect(gx,ty,gw,h1);t(g.name,gx+gw/2,ty+h1/2,shHead?14:10,'center',true);g.items.forEach((it,j)=>{const xx=gx+j*colW;x.strokeRect(xx,ty+h1,colW,h2);t(it,xx+colW/2,ty+h1+h2/2,shHead?12:8)});ci+=g.items.length});const mt=nMatrix(),lines=ship?.lines||null;const qFor=(coop,se,c)=>lines?lines.filter(l=>l.year===y&&l.coop===coop&&l.season===se&&l.group===c.group&&l.item===c.item).reduce((a,l)=>a+Number(l.qty||0),0):(mt[[y,coop,se,c.group,c.item].join('|')]||0);let yy=ty+h1+h2;for(const coop of N_COOPS){x.lineWidth=1.5;x.beginPath();x.moveTo(margin,yy);x.lineTo(margin+tw,yy);x.stroke();x.lineWidth=.55;for(let si=0;si<N_SEASONS.length;si++){const se=N_SEASONS[si];if(si===0)t(coop,margin+coopW/2,yy+(window.__v58ShipmentCoopLower?rowH*1.7:rowH/2),12,'center',true);t(se,margin+coopW+seasonW/2,yy+rowH/2,13,'center',true);let rt=0;cols.forEach((cc,j)=>{const q=qFor(coop,se,cc),xx=xData+j*colW;rt+=q;x.beginPath();x.moveTo(xx,yy);x.lineTo(xx,yy+rowH);x.stroke();if(q)t(fmt(q),xx+colW/2,yy+rowH/2,13)});if(rt)t(fmt(rt),xData+dataW+totalW/2,yy+rowH/2,13);x.beginPath();x.moveTo(margin,yy+rowH);x.lineTo(margin+tw,yy+rowH);x.stroke();yy+=rowH}t('小計',margin+coopW+seasonW/2,yy+rowH/2,11);let st=0;cols.forEach((cc,j)=>{const q=N_SEASONS.reduce((a,se)=>a+qFor(coop,se,cc),0),xx=xData+j*colW;st+=q;if(q)t(fmt(q),xx+colW/2,yy+rowH/2,11)});if(st)t(fmt(st),xData+dataW+totalW/2,yy+rowH/2,11);x.beginPath();x.moveTo(margin,yy+rowH);x.lineTo(margin+tw,yy+rowH);x.stroke();yy+=rowH}x.lineWidth=1.5;x.beginPath();x.moveTo(margin,yy);x.lineTo(margin+tw,yy);x.stroke();x.lineWidth=.55;t('合計',margin+(coopW+seasonW)/2,yy+footH/2,12,'center',true);let gt=0;cols.forEach((cc,j)=>{const q=N_COOPS.reduce((a,co)=>a+N_SEASONS.reduce((b,se)=>b+qFor(co,se,cc),0),0),xx=xData+j*colW;gt+=q;if(q)t(fmt(q),xx+colW/2,yy+footH/2,12)});if(gt)t(fmt(gt),xData+dataW+totalW/2,yy+footH/2,12);return c}
async function nOpenStockPdf(y){const w=window.open('about:blank','_blank');if(!w)return alert('PDF画面を開けません。');try{const b=await _singleCanvasPdfBlob(nReportCanvas(y)),u=URL.createObjectURL(b);w.location.replace(u);setTimeout(()=>URL.revokeObjectURL(u),600000)}catch(e){w.close();alert('PDF作成に失敗しました。')}}
function nLogs(){const a=nState.records.slice().reverse();app.innerHTML=`<section class="card"><h2>根室産昆布 入出庫履歴</h2><div class="tablewrap"><table style="min-width:950px"><tr><th>日付</th><th>区分</th><th>年度</th><th>漁協</th><th>季節</th><th>分類</th><th>細分類</th><th>数量</th><th>操作</th></tr>${a.map(r=>`<tr><td>${r.date}</td><td>${r.type==='in'?'入庫':'出庫'}</td><td>${r.year}</td><td>${r.coop}</td><td>${r.season}</td><td>${esc(r.group)}</td><td>${esc(r.item)}</td><td>${fmt(r.qty)}</td><td><button class="mini" data-ne="${r.id}">修正</button> <button class="mini danger" data-nd="${r.id}">削除</button></td></tr>`).join('')}</table></div><button class="btn secondary" id="nlb">戻る</button></section>`;app.querySelectorAll('[data-ne]').forEach(b=>b.onclick=()=>nForm(null,b.dataset.ne));app.querySelectorAll('[data-nd]').forEach(b=>b.onclick=()=>{if(confirm('削除しますか？')){nState.records=nState.records.filter(r=>r.id!==b.dataset.nd);nSave();nLogs()}});nlb.onclick=nHome}
function nShipId(){return 'N'+String(nState.shipmentSeq++).padStart(5,'0')}
function nShipments(){app.innerHTML=`<section class="card"><div class="row"><h2>根室産昆布 出荷指示</h2><button class="mini" id="nnew">＋新規</button></div><div class="tablewrap"><table><tr><th>番号</th><th>出荷元</th><th>出荷先</th><th>出荷日</th><th>数量</th><th>状態</th><th></th></tr>${nState.shipments.slice().reverse().map(s=>`<tr><td>${s.id}</td><td>${esc(s.source?.name||'')}</td><td>${esc(s.dest?.name||'')}</td><td>${s.shipDate||''}</td><td>${fmt((s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0))}</td><td>${s.status}</td><td><button class="mini" data-ns="${s.id}">開く</button></td></tr>`).join('')}</table></div><button class="btn secondary" id="nsb">戻る</button></section>`;nnew.onclick=()=>nShipForm();app.querySelectorAll('[data-ns]').forEach(b=>b.onclick=()=>nShipDetail(b.dataset.ns));nsb.onclick=nHome}
function nShipForm(id=null){const s=id?nState.shipments.find(x=>x.id===id):null;let lines=s?.lines?.map(x=>({...x}))||[];app.innerHTML=`<section class="card"><h2>根室産昆布 ${s?'出荷指示修正':'新規出荷指示'}</h2><div class="form"><label>出荷元 会社名<input id="nsrc" value="${esc(s?.source?.name||'㈱浜中運輸')}"></label><label>出荷元 住所<input id="nsrca" value="${esc(s?.source?.address||'')}"></label><label>出荷元 電話<input id="nsrcp" value="${esc(s?.source?.phone||'')}"></label><label>出荷先 会社名<input id="ndst" value="${esc(s?.dest?.name||'')}"></label><label>出荷先 住所<input id="ndsta" value="${esc(s?.dest?.address||'')}"></label><label>出荷先 電話<input id="ndstp" value="${esc(s?.dest?.phone||'')}"></label><div class="subgrid"><label>出荷日<input id="nsd" type="date" value="${s?.shipDate||today()}"></label><label>希望着日<input id="nad" type="date" value="${s?.arrivalDate||''}"></label></div><div id="nsl"></div><button class="btn secondary" id="nala">＋明細追加</button><button class="btn" id="nssv">保存</button><button class="btn secondary" id="nsfb">戻る</button></div></section>`;function rend(){nsl.innerHTML=lines.map((l,i)=>`<div class="card" style="background:#f8fafc"><label>年度<select data-ni="${i}" data-nf="year">${nYearOptions(l.year)}</select></label><label>漁協<select data-ni="${i}" data-nf="coop">${N_COOPS.map(x=>`<option ${x===l.coop?'selected':''}>${x}</option>`).join('')}</select></label><label>区分<select data-ni="${i}" data-nf="season">${N_SEASONS.map(x=>`<option ${x===l.season?'selected':''}>${x}</option>`).join('')}</select></label><label>分類<select data-ni="${i}" data-nf="gi">${nItemOptions(l.group,l.item)}</select></label><label>数量<input type="number" value="${esc(l.qty||'')}" data-ni="${i}" data-nf="qty"></label><button class="mini danger" data-nr="${i}">削除</button></div>`).join('');nsl.querySelectorAll('[data-nf]').forEach(e=>e.onchange=()=>{const i=+e.dataset.ni;if(e.dataset.nf==='gi'){[lines[i].group,lines[i].item]=e.value.split('|')}else lines[i][e.dataset.nf]=e.value});nsl.querySelectorAll('[data-nr]').forEach(e=>e.onclick=()=>{lines.splice(+e.dataset.nr,1);rend()})}nala.onclick=()=>{lines.push({year:nState.activeYear,coop:N_COOPS[0],season:'夏',group:N_GROUPS[0].name,item:N_GROUPS[0].items[0],qty:''});rend()};nssv.onclick=()=>{if(!ndst.value.trim()||!lines.length)return alert('出荷先と明細を入力してください。');for(const l of lines){l.qty=Number(l.qty);if(!l.qty||l.qty>nAvail(l.year,l.coop,l.season,l.group,l.item,s?.id))return alert(`${l.coop} ${l.season} ${l.group} ${l.item} の在庫が不足しています。`)}const o=s||{id:nShipId(),status:'draft',createdAt:new Date().toISOString()};Object.assign(o,{source:{name:nsrc.value,address:nsrca.value,phone:nsrcp.value},dest:{name:ndst.value,address:ndsta.value,phone:ndstp.value},shipDate:nsd.value,arrivalDate:nad.value,lines});if(!s)nState.shipments.push(o);nSave();nShipDetail(o.id)};nsfb.onclick=nShipments;rend()}
function nShipDetail(id){const s=nState.shipments.find(x=>x.id===id);if(!s)return nShipments();app.innerHTML=`<section class="card"><div class="row"><h2>根室産昆布 出荷指示 ${s.id}</h2><span class="pill">${s.status}</span></div><p><b>出荷先：</b>${esc(s.dest?.name||'')}　<b>出荷元：</b>${esc(s.source?.name||'')}</p><p><b>出荷日：</b>${s.shipDate||''}　<b>合計：</b>${fmt((s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0))}</p><div class="toolbar"><button class="btn" id="npdfs">帳票表示・PDF/FAX</button>${s.status==='draft'?'<button class="btn" id="nconf">確定・在庫反映</button><button class="btn secondary" id="nedit">修正</button>':''}${s.status==='confirmed'?'<button class="btn" id="nshipped">出荷済</button>':''}<button class="btn secondary" id="nback">一覧へ</button></div></section>`;const pdf=document.getElementById('npdfs');if(pdf)pdf.onclick=()=>nOpenShipPdf(s);if(s.status==='draft'){const c=document.getElementById('nconf');if(c)c.onclick=()=>{for(const l of s.lines)if(Number(l.qty)>nAvail(l.year,l.coop,l.season,l.group,l.item,s.id))return alert('在庫不足があります。');s.status='confirmed';s.confirmedAt=new Date().toISOString();nSave();alert('出荷指示を確定し、在庫表へ反映しました。');nShipDetail(id)};const e=document.getElementById('nedit');if(e)e.onclick=()=>nShipForm(id)}if(s.status==='confirmed'){const sh=document.getElementById('nshipped');if(sh)sh.onclick=()=>{if(!window.confirm('出荷済みにすると、明細数量を在庫から出庫します。よろしいですか？'))return;s.lines.forEach(l=>nState.records.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),type:'out',year:l.year,coop:l.coop,season:l.season,group:l.group,item:l.item,qty:Number(l.qty),date:s.shipDate||today(),memo:`出荷指示 ${s.id}`}));s.status='shipped';s.shippedAt=new Date().toISOString();nSave();nShipDetail(id)}}const b=document.getElementById('nback');if(b)b.onclick=nShipments}
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
function smReportCanvas(y,ship=null){const W=1684,H=1191,margin=34,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),cols=smItems(),title=ship?'出 荷 指 示 書（釧路産棹前昆布）':'釧 路 産 棹 前 昆 布　在 庫 集 計 表';x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#000';x.strokeStyle='#222';const f=(z,b=false)=>`${b?'700 ':'400 '}${z}px -apple-system,BlinkMacSystemFont,"Hiragino Sans",sans-serif`,t=(v,xx,yy,z=13,a='center',b=false)=>{x.font=f(z,b);x.textAlign=a;x.textBaseline='middle';x.fillText(String(v??''),xx,yy)};t(title,margin,38,28,'left',true);t(`${y}年産`,W-margin,38,16,'right',true);if(ship){t(`指示番号：${ship.id}　出荷日：${ship.shipDate||''}`,W-margin,62,13,'right');t(`出荷先：${ship.dest?.name||''}　${ship.dest?.address||''}　TEL ${ship.dest?.phone||''}`,margin,62,12,'left')}const ty=ship?85:70,tw=W-margin*2,coopW=92,seasonW=45,totalW=58,dataW=tw-coopW-seasonW-totalW,colW=dataW/cols.length,h1=28,h2=28,rowH=39,footH=34,tableH=h1+h2+S_COOPS.length*(S_SEASONS.length+1)*rowH+footH;x.lineWidth=.55;x.strokeRect(margin,ty,tw,tableH);const xData=margin+coopW+seasonW;[margin+coopW,xData,xData+dataW].forEach(xx=>{x.beginPath();x.moveTo(xx,ty);x.lineTo(xx,ty+tableH);x.stroke()});const shHead=!!window.__v63ShipmentHeaderLarge;t('組合名',margin+coopW/2,ty+(h1+h2)/2,shHead?16:12);t('区分',margin+coopW+seasonW/2,ty+(h1+h2)/2,shHead?16:12);t('計',xData+dataW+totalW/2,ty+(h1+h2)/2,shHead?16:12);let ci=0;S_GROUPS.forEach(g=>{const gx=xData+ci*colW,gw=g.items.length*colW;x.strokeRect(gx,ty,gw,h1);t(g.name,gx+gw/2,ty+h1/2,shHead?14:10,'center',true);g.items.forEach((it,j)=>{const xx=gx+j*colW;x.strokeRect(xx,ty+h1,colW,h2);t(it,xx+colW/2,ty+h1+h2/2,shHead?12:8)});ci+=g.items.length});const mt=smMatrix(),lines=ship?.lines||null;const qFor=(coop,se,c)=>lines?lines.filter(l=>l.year===y&&l.coop===coop&&l.season===se&&l.group===c.group&&l.item===c.item).reduce((a,l)=>a+Number(l.qty||0),0):(mt[[y,coop,se,c.group,c.item].join('|')]||0);let yy=ty+h1+h2;for(const coop of S_COOPS){x.lineWidth=1.5;x.beginPath();x.moveTo(margin,yy);x.lineTo(margin+tw,yy);x.stroke();x.lineWidth=.55;for(let si=0;si<S_SEASONS.length;si++){const se=S_SEASONS[si];if(si===0)t(coop,margin+coopW/2,yy+(window.__v58ShipmentCoopLower?rowH*1.7:rowH/2),12,'center',true);t(se,margin+coopW+seasonW/2,yy+rowH/2,13,'center',true);let rt=0;cols.forEach((cc,j)=>{const q=qFor(coop,se,cc),xx=xData+j*colW;rt+=q;x.beginPath();x.moveTo(xx,yy);x.lineTo(xx,yy+rowH);x.stroke();if(q)t(fmt(q),xx+colW/2,yy+rowH/2,13)});if(rt)t(fmt(rt),xData+dataW+totalW/2,yy+rowH/2,13);x.beginPath();x.moveTo(margin,yy+rowH);x.lineTo(margin+tw,yy+rowH);x.stroke();yy+=rowH}t('小計',margin+coopW+seasonW/2,yy+rowH/2,11);let st=0;cols.forEach((cc,j)=>{const q=S_SEASONS.reduce((a,se)=>a+qFor(coop,se,cc),0),xx=xData+j*colW;st+=q;if(q)t(fmt(q),xx+colW/2,yy+rowH/2,11)});if(st)t(fmt(st),xData+dataW+totalW/2,yy+rowH/2,11);x.beginPath();x.moveTo(margin,yy+rowH);x.lineTo(margin+tw,yy+rowH);x.stroke();yy+=rowH}x.lineWidth=1.5;x.beginPath();x.moveTo(margin,yy);x.lineTo(margin+tw,yy);x.stroke();x.lineWidth=.55;t('合計',margin+(coopW+seasonW)/2,yy+footH/2,12,'center',true);let gt=0;cols.forEach((cc,j)=>{const q=S_COOPS.reduce((a,co)=>a+S_SEASONS.reduce((b,se)=>b+qFor(co,se,cc),0),0),xx=xData+j*colW;gt+=q;if(q)t(fmt(q),xx+colW/2,yy+footH/2,12)});if(gt)t(fmt(gt),xData+dataW+totalW/2,yy+footH/2,12);return c}
async function smOpenStockPdf(y){const w=window.open('about:blank','_blank');if(!w)return alert('PDF画面を開けません。');try{const b=await _singleCanvasPdfBlob(smReportCanvas(y)),u=URL.createObjectURL(b);w.location.replace(u);setTimeout(()=>URL.revokeObjectURL(u),600000)}catch(e){w.close();alert('PDF作成に失敗しました。')}}
function smLogs(){const a=smState.records.slice().reverse();app.innerHTML=`<section class="card"><h2>釧路産棹前昆布 入出庫履歴</h2><div class="tablewrap"><table style="min-width:950px"><tr><th>日付</th><th>区分</th><th>年度</th><th>漁協</th><th>季節</th><th>分類</th><th>細分類</th><th>数量</th><th>操作</th></tr>${a.map(r=>`<tr><td>${r.date}</td><td>${r.type==='in'?'入庫':'出庫'}</td><td>${r.year}</td><td>${r.coop}</td><td>${r.season}</td><td>${esc(r.group)}</td><td>${esc(r.item)}</td><td>${fmt(r.qty)}</td><td><button class="mini" data-ne="${r.id}">修正</button> <button class="mini danger" data-nd="${r.id}">削除</button></td></tr>`).join('')}</table></div><button class="btn secondary" id="nlb">戻る</button></section>`;app.querySelectorAll('[data-ne]').forEach(b=>b.onclick=()=>smForm(null,b.dataset.ne));app.querySelectorAll('[data-nd]').forEach(b=>b.onclick=()=>{if(confirm('削除しますか？')){smState.records=smState.records.filter(r=>r.id!==b.dataset.nd);smSave();smLogs()}});nlb.onclick=smHome}
function smShipId(){return 'S'+String(smState.shipmentSeq++).padStart(5,'0')}
function smShipments(){app.innerHTML=`<section class="card"><div class="row"><h2>釧路産棹前昆布 出荷指示</h2><button class="mini" id="nnew">＋新規</button></div><div class="tablewrap"><table><tr><th>番号</th><th>出荷元</th><th>出荷先</th><th>出荷日</th><th>数量</th><th>状態</th><th></th></tr>${smState.shipments.slice().reverse().map(s=>`<tr><td>${s.id}</td><td>${esc(s.source?.name||'')}</td><td>${esc(s.dest?.name||'')}</td><td>${s.shipDate||''}</td><td>${fmt((s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0))}</td><td>${s.status}</td><td><button class="mini" data-ns="${s.id}">開く</button></td></tr>`).join('')}</table></div><button class="btn secondary" id="nsb">戻る</button></section>`;nnew.onclick=()=>smShipForm();app.querySelectorAll('[data-ns]').forEach(b=>b.onclick=()=>smShipDetail(b.dataset.ns));nsb.onclick=smHome}
function smShipForm(id=null){const s=id?smState.shipments.find(x=>x.id===id):null;let lines=s?.lines?.map(x=>({...x}))||[];app.innerHTML=`<section class="card"><h2>釧路産棹前昆布 ${s?'出荷指示修正':'新規出荷指示'}</h2><div class="form"><label>出荷元 会社名<input id="nsrc" value="${esc(s?.source?.name||'㈱浜中運輸')}"></label><label>出荷元 住所<input id="nsrca" value="${esc(s?.source?.address||'')}"></label><label>出荷元 電話<input id="nsrcp" value="${esc(s?.source?.phone||'')}"></label><label>出荷先 会社名<input id="ndst" value="${esc(s?.dest?.name||'')}"></label><label>出荷先 住所<input id="ndsta" value="${esc(s?.dest?.address||'')}"></label><label>出荷先 電話<input id="ndstp" value="${esc(s?.dest?.phone||'')}"></label><div class="subgrid"><label>出荷日<input id="nsd" type="date" value="${s?.shipDate||today()}"></label><label>希望着日<input id="nad" type="date" value="${s?.arrivalDate||''}"></label></div><div id="nsl"></div><button class="btn secondary" id="nala">＋明細追加</button><button class="btn" id="nssv">保存</button><button class="btn secondary" id="nsfb">戻る</button></div></section>`;function rend(){nsl.innerHTML=lines.map((l,i)=>`<div class="card" style="background:#f8fafc"><label>年度<select data-ni="${i}" data-nf="year">${smYearOptions(l.year)}</select></label><label>漁協<select data-ni="${i}" data-nf="coop">${S_COOPS.map(x=>`<option ${x===l.coop?'selected':''}>${x}</option>`).join('')}</select></label><label>区分<select data-ni="${i}" data-nf="season">${S_SEASONS.map(x=>`<option ${x===l.season?'selected':''}>${x}</option>`).join('')}</select></label><label>分類<select data-ni="${i}" data-nf="gi">${smItemOptions(l.group,l.item)}</select></label><label>数量<input type="number" value="${esc(l.qty||'')}" data-ni="${i}" data-nf="qty"></label><button class="mini danger" data-nr="${i}">削除</button></div>`).join('');nsl.querySelectorAll('[data-nf]').forEach(e=>e.onchange=()=>{const i=+e.dataset.ni;if(e.dataset.nf==='gi'){[lines[i].group,lines[i].item]=e.value.split('|')}else lines[i][e.dataset.nf]=e.value});nsl.querySelectorAll('[data-nr]').forEach(e=>e.onclick=()=>{lines.splice(+e.dataset.nr,1);rend()})}nala.onclick=()=>{lines.push({year:smState.activeYear,coop:S_COOPS[0],season:'採り',group:S_GROUPS[0].name,item:S_GROUPS[0].items[0],qty:''});rend()};nssv.onclick=()=>{if(!ndst.value.trim()||!lines.length)return alert('出荷先と明細を入力してください。');for(const l of lines){l.qty=Number(l.qty);if(!l.qty||l.qty>smAvail(l.year,l.coop,l.season,l.group,l.item,s?.id))return alert(`${l.coop} ${l.season} ${l.group} ${l.item} の在庫が不足しています。`)}const o=s||{id:smShipId(),status:'draft',createdAt:new Date().toISOString()};Object.assign(o,{source:{name:nsrc.value,address:nsrca.value,phone:nsrcp.value},dest:{name:ndst.value,address:ndsta.value,phone:ndstp.value},shipDate:nsd.value,arrivalDate:nad.value,lines});if(!s)smState.shipments.push(o);smSave();smShipDetail(o.id)};nsfb.onclick=smShipments;rend()}
function smShipDetail(id){const s=smState.shipments.find(x=>x.id===id);if(!s)return smShipments();app.innerHTML=`<section class="card"><div class="row"><h2>釧路産棹前昆布 出荷指示 ${s.id}</h2><span class="pill">${s.status}</span></div><p><b>出荷先：</b>${esc(s.dest?.name||'')}　<b>出荷元：</b>${esc(s.source?.name||'')}</p><p><b>出荷日：</b>${s.shipDate||''}　<b>合計：</b>${fmt((s.lines||[]).reduce((a,l)=>a+Number(l.qty||0),0))}</p><div class="toolbar"><button class="btn" id="smpdfs">帳票表示・PDF/FAX</button>${s.status==='draft'?'<button class="btn" id="smconf">確定・在庫反映</button><button class="btn secondary" id="smedit">修正</button>':''}${s.status==='confirmed'?'<button class="btn" id="smshipped">出荷済</button>':''}<button class="btn secondary" id="smback">一覧へ</button></div></section>`;const pdf=document.getElementById('smpdfs');if(pdf)pdf.onclick=()=>smOpenShipPdf(s);if(s.status==='draft'){const c=document.getElementById('smconf');if(c)c.onclick=()=>{for(const l of s.lines)if(Number(l.qty)>smAvail(l.year,l.coop,l.season,l.group,l.item,s.id))return alert('在庫不足があります。');s.status='confirmed';s.confirmedAt=new Date().toISOString();smSave();alert('出荷指示を確定し、在庫表へ反映しました。');smShipDetail(id)};const e=document.getElementById('smedit');if(e)e.onclick=()=>smShipForm(id)}if(s.status==='confirmed'){const sh=document.getElementById('smshipped');if(sh)sh.onclick=()=>{if(!window.confirm('出荷済みにすると、明細数量を在庫から出庫します。よろしいですか？'))return;s.lines.forEach(l=>smState.records.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),type:'out',year:l.year,coop:l.coop,season:l.season,group:l.group,item:l.item,qty:Number(l.qty),date:s.shipDate||today(),memo:`出荷指示 ${s.id}`}));s.status='shipped';s.shippedAt=new Date().toISOString();smSave();smShipDetail(id)}}const b=document.getElementById('smback');if(b)b.onclick=smShipments}
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
  const draw=()=>{
    app.innerHTML=`<section class="card" style="margin-top:22px"><div class="row"><h2>会社マスター</h2><span class="pill">v37</span></div><p class="muted">出荷指示で使用する会社名・住所・電話番号を登録します。釧路産昆布では会社名を選ぶと住所・電話番号を自動入力できます。</p><div id="globalCompanyList" class="master-list"></div><button class="btn secondary" id="globalAddCompany" style="margin-top:10px">＋ 会社を追加</button><button class="btn" id="globalSaveCompanies" style="margin-top:10px">会社マスターを保存</button><button class="btn secondary" id="globalMasterBack" style="margin-top:10px">← 昆布選択画面へ戻る</button></section>`;
    const list=document.getElementById('globalCompanyList');
    list.innerHTML=state.companies.map((v,i)=>`<div class="card" style="margin:6px 0;padding:10px;background:#f8fafc"><div class="form"><label>会社名<input value="${esc(v.name)}" data-gcf="name" data-gci="${i}"></label><label>住所<input value="${esc(v.address||'')}" data-gcf="address" data-gci="${i}"></label><label>電話番号<input value="${esc(v.phone||'')}" data-gcf="phone" data-gci="${i}" inputmode="tel"></label><button class="mini danger" data-gcd="${i}" type="button">削除</button></div></div>`).join('')||'<div class="empty">会社はまだ登録されていません。</div>';
    list.onclick=e=>{const i=e.target.dataset.gcd;if(i!==undefined){state.companies.splice(+i,1);save();draw()}};
    document.getElementById('globalAddCompany').onclick=()=>{state.companies.push({name:'',address:'',phone:''});save();draw()};
    document.getElementById('globalSaveCompanies').onclick=()=>{const arr=state.companies.map((c,i)=>{const q=f=>document.querySelector(`[data-gci="${i}"][data-gcf="${f}"]`);return {name:(q('name')?.value||'').trim(),address:(q('address')?.value||'').trim(),phone:(q('phone')?.value||'').trim()}}).filter(c=>c.name);if(new Set(arr.map(c=>c.name)).size!==arr.length)return alert('会社名が重複しています。');state.companies=arr;save();alert('会社マスターを保存しました。');draw()};
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
  app.innerHTML=`<section class="card" style="margin-top:22px"><div class="row"><h2>${title}</h2><span class="pill">v38</span></div><p class="muted">${lead}</p><div class="grid" style="margin-top:16px"><button class="action orange" id="v38K"><b style="font-size:20px">釧路産昆布</b><small>${detail}</small></button><button class="action green" id="v38H"><b style="font-size:20px">日高昆布</b><small>${detail}</small></button><button class="action blue" id="v38N"><b style="font-size:20px">根室産昆布</b><small>${detail}</small></button><button class="action purple" id="v38S"><b style="font-size:20px">釧路産棹前昆布</b><small>${detail}</small></button></div><button class="btn secondary" id="v38Back" style="margin-top:16px">← 最初のトップ画面へ</button></section>`;
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
  app.innerHTML=`<section class="card" style="margin-top:22px"><div class="row"><h2>📄 4種類 PDF一括入庫</h2><span class="pill">v61</span></div><p><b>${esc(file.name)}</b></p><div class="note">PDFを1回読み込み、釧路産昆布・日高昆布・根室産昆布・釧路産棹前昆布を自動判別しています。</div><p id="v42Progress" style="margin-top:16px;font-weight:700">PDFを準備しています…</p></section>`;
  const progress=document.getElementById('v42Progress');
  try{
    const hash=await sha256File(file),dups=v42ImportAlready(hash,file);
    const results=[];
    results.push(await v42ParseOne('釧路産昆布',parseInventoryPdf,file,dups.kushiro,progress));
    results.push(await v42ParseOne('日高昆布',hParsePdf,file,dups.hidaka,progress));
    results.push(await v42ParseOne('根室産昆布',nParsePdf,file,dups.nemuro,progress));
    results.push(await v42ParseOne('釧路産棹前昆布',smParsePdf,file,dups.sanmae,progress));
    const metas=results.map(v42ResultMeta),importable=results.filter(x=>x.status==='ok');
    const grandCount=metas.reduce((a,x)=>a+x.count,0),grandTotal=metas.reduce((a,x)=>a+x.total,0);
    const cards=results.map((r,i)=>{const m=metas[i];return `<div class="card" style="margin:0;padding:12px;background:#f8fafc"><b style="font-size:17px">${esc(r.label)}</b><div style="margin-top:7px"><span class="pill">${esc(m.statusText)}</span></div><div class="small" style="margin-top:8px">生産年度：${esc(m.years)}<br>対象ページ：${esc(m.pages)}<br>明細：${m.count}件 ／ 合計：${fmt(m.total)}</div>${r.status==='error'?`<div class="warning" style="margin-top:8px">${esc(r.error&&r.error.message?r.error.message:String(r.error))}</div>`:''}</div>`}).join('');
    app.innerHTML=`<section class="card" style="margin-top:22px"><div class="row"><h2>📄 PDF一括入庫 内容確認</h2><span class="pill">v61</span></div><p><b>PDF：</b>${esc(file.name)}</p><div class="stats"><div class="stat">入庫対象<b>${importable.length}種類</b></div><div class="stat">明細合計<b>${grandCount}件</b></div><div class="stat">数量合計<b>${fmt(grandTotal)}</b></div><div class="stat">PDFハッシュ<b style="font-size:12px">${esc(hash.slice(0,12))}…</b></div></div><div class="subgrid" style="margin-top:14px">${cards}</div><div class="warning" style="margin-top:14px">まだ在庫には反映されていません。「4種類へ一括反映」を押すと、入庫対象になった昆布だけを一度に登録します。取込済みの種類は二重登録しません。</div><div class="toolbar" style="margin-top:14px"><button class="btn" id="v42Commit" ${importable.length?'':'disabled'}>4種類へ一括反映</button><button class="btn secondary" id="v42Cancel">キャンセル</button></div></section>`;
    const commit=document.getElementById('v42Commit'),cancel=document.getElementById('v42Cancel');
    cancel.onclick=()=>productChoicePage('inventory');
    if(commit)commit.onclick=()=>{
      if(!confirm(`PDFの入庫対象 ${importable.length}種類・${grandCount}件・合計${fmt(grandTotal)}を在庫へ反映します。よろしいですか？`))return;
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
        alert(`${importable.length}種類、${grandCount}件、合計${fmt(grandTotal)}を一括入庫しました。`);productChoicePage('inventory');
      }catch(err){commit.disabled=false;commit.textContent='4種類へ一括反映';alert('一括入庫中にエラーが発生しました。\n'+(err&&err.message?err.message:String(err)))}
    };
  }catch(err){
    app.innerHTML=`<section class="card" style="margin-top:22px"><h2>PDFを読み込めませんでした</h2><div class="warning">${esc(err&&err.message?err.message:String(err))}</div><button class="btn secondary" id="v42ErrorBack" style="margin-top:14px">在庫管理へ戻る</button></section>`;document.getElementById('v42ErrorBack').onclick=()=>productChoicePage('inventory');
  }
}

const _v41ProductChoiceForV42=productChoicePage;
productChoicePage=function(mode){
  _v41ProductChoiceForV42(mode);
  const pill=app.querySelector('.pill');if(pill)pill.textContent='v61';
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
productLanding=function(){_v41LandingForV42();const pill=app.querySelector('.pill');if(pill)pill.textContent='v61'};
const _v41CompanyForV42=companyMasterPage;
companyMasterPage=function(){_v41CompanyForV42();const pill=app.querySelector('.pill');if(pill)pill.textContent='v61'};

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
    window.__v58ShipmentCoopLower=true;window.__v63ShipmentHeaderLarge=true;try{return v55RetitleStockCanvas(_stockCanvasPage(y),'釧路産昆布　出 荷 依 頼 書',y,s,112,44);}finally{window.__v58ShipmentCoopLower=false;window.__v63ShipmentHeaderLarge=false;}
  }finally{state.records=rec;state.shipments=ships}
}
function v55CanvasHidaka(s,y){
  const rec=hState.records,ships=hState.shipments;
  try{
    hState.records=(s.lines||[]).filter(l=>(l.year||hState.activeYear)===y).map(l=>({
      ...l,type:'in',year:y,qty:Number(l.qty||0)
    }));
    hState.shipments=[];
    window.__v59HidakaSectionCentered=true;window.__v63ShipmentHeaderLarge=true;try{return v55RetitleStockCanvas(hStockCanvas(y),'日高昆布　出 荷 依 頼 書',y,s,80,35);}finally{window.__v59HidakaSectionCentered=false;window.__v63ShipmentHeaderLarge=false;}
  }finally{hState.records=rec;hState.shipments=ships}
}
function v55CanvasNemuro(s,y){
  const rec=nState.records,ships=nState.shipments;
  try{
    nState.records=(s.lines||[]).filter(l=>(l.year||nState.activeYear)===y).map(l=>({
      ...l,type:'in',year:y,qty:Number(l.qty||0)
    }));
    nState.shipments=[];
    window.__v58ShipmentCoopLower=true;window.__v63ShipmentHeaderLarge=true;try{return v55RetitleStockCanvas(nReportCanvas(y,null),'根室産昆布　出 荷 依 頼 書',y,s,70,34);}finally{window.__v58ShipmentCoopLower=false;window.__v63ShipmentHeaderLarge=false;}
  }finally{nState.records=rec;nState.shipments=ships}
}
function v55CanvasSanmae(s,y){
  const rec=smState.records,ships=smState.shipments;
  try{
    smState.records=(s.lines||[]).filter(l=>(l.year||smState.activeYear)===y).map(l=>({
      ...l,type:'in',year:y,qty:Number(l.qty||0)
    }));
    smState.shipments=[];
    window.__v58ShipmentCoopLower=true;window.__v63ShipmentHeaderLarge=true;try{return v55RetitleStockCanvas(smReportCanvas(y,null),'釧路産棹前昆布　出 荷 依 頼 書',y,s,70,34);}finally{window.__v58ShipmentCoopLower=false;window.__v63ShipmentHeaderLarge=false;}
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
      .v55page{width:296mm!important;height:209mm!important;margin:0!important;padding:0!important;box-shadow:none!important;display:flex!important;align-items:flex-start!important;justify-content:flex-start!important;break-after:auto!important;page-break-after:auto!important;overflow:hidden!important}
      .v55page:not(:last-child){break-after:page!important;page-break-after:always!important}
      .v55page canvas{display:block!important;width:296mm!important;height:209mm!important;max-width:296mm!important;max-height:209mm!important;object-fit:contain!important;margin:0!important;padding:0!important}
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

v55RetitleStockCanvas=function(sourceCanvas, title, year, shipment, tableY, tableX){
  const W=sourceCanvas.width,H=sourceCanvas.height;
  tableY=Number(tableY)||70; tableX=Number(tableX)||35;
  const headerBottom=230;
  const c=document.createElement('canvas');c.width=W;c.height=H+(headerBottom-tableY);
  const x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);

  /* 在庫集計表は縮小せず、そのまま下へ移動。これで上部枠と表の左右端が完全一致する。 */
  x.drawImage(sourceCanvas,0,tableY,W,H-tableY,0,headerBottom,W,H-tableY);

  const dest=v57ShipmentParty(shipment,'dest');
  const src=v57ShipmentParty(shipment,'source');
  const font=(z,b=false)=>`${b?'700 ':'400 '}${z}px -apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif`;
  const text=(t,xx,yy,z=18,a='left',b=false)=>{x.fillStyle='#000';x.font=font(z,b);x.textAlign=a;x.textBaseline='middle';x.fillText(String(t??''),xx,yy)};

  const productName=String(title||'').replace(/　?出 荷 指 示 書/g,'').replace(/　?出 荷 依 頼 書/g,'').trim();
  const mainTitle='出 荷 依 頼 書';
  text(mainTitle,tableX,29,27,'left',true);
  x.font=font(27,true); const titleW=x.measureText(mainTitle).width;
  text(`${year}年産`,tableX+titleW+24,29,27,'left',true);
  if(productName)text(productName,tableX,49,13,'left',true);
  text(`依頼番号：${shipment?.id||''}　出荷日：${shipment?.shipDate||''}`,W-tableX,48,12,'right',false);

  const boxY=62,boxH=145,boxW=(W-tableX*2)/2;
  x.strokeStyle='#111';x.lineWidth=1.5;
  x.strokeRect(tableX,boxY,boxW,boxH);
  x.strokeRect(tableX+boxW,boxY,boxW,boxH);
  const drawParty=(left,label,p)=>{
    text(label,left+14,boxY+22,15,'left',true);
    text(p.name||'',left+14,boxY+59,28,'left',true);
    text(`住所：${p.address||''}`,left+14,boxY+96,18,'left',false);
    text(`電話：${p.phone||''}`,left+14,boxY+124,18,'left',false);
  };
  drawParty(tableX,'出荷先',dest);
  drawParty(tableX+boxW,'出荷元',src);
  return c;
};


/* v59: 出荷指示書表示調整：釧路・根室・釧路産棹前の組合名をv58より少し下へ。日高の走り・后採・拾い・雑を各区分ブロック中央へ。 */
