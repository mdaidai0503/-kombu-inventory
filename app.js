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
const DELETED_GROUPS=new Set(["コケ","特長・特特"]);
state.records=state.records.filter(r=>!DELETED_GROUPS.has(r.group));
save();
function allItems(){return GROUPS.flatMap(g=>g.items.map(item=>({group:g.name,item})));}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function fmt(n){return Number(n||0).toLocaleString('ja-JP')}
function today(){return new Date().toLocaleDateString('sv-SE')}
function key(r){return [r.year||DEFAULT_YEAR,r.coop,r.group,r.item,r.season||"夏"].join("|")}
function matrix(){const m={};state.records.forEach(r=>{const k=key(r);m[k]=(m[k]||0)+(r.type==='out'?-Number(r.qty):Number(r.qty))});return m}
function total(year=state.activeYear){return state.records.filter(r=>(r.year||DEFAULT_YEAR)===year).reduce((s,r)=>s+(r.type==='out'?-Number(r.qty):Number(r.qty)),0)}
function yearOptions(selected){return YEARS.map(y=>`<option value="${y}" ${y===(selected||state.activeYear)?'selected':''}>${y}年産</option>`).join('')}
function setActiveYear(y){if(YEARS.includes(y)){state.activeYear=y;save();}}
function home(){app.innerHTML=`<section class="card"><div class="row"><h2>在庫状況</h2><select id="homeYear" style="width:auto;padding:8px;border:1px solid #ccd6e2;border-radius:9px;background:#fff;font-size:15px">${yearOptions(state.activeYear)}</select></div><div class="stats"><div class="stat">${esc(state.activeYear)}年産 総在庫<b>${fmt(total(state.activeYear))}</b></div><div class="stat">漁協数<b>${state.coops.length}</b></div><div class="stat">細分類数<b>${allItems().length}</b></div><div class="stat">登録履歴<b>${state.records.filter(r=>(r.year||DEFAULT_YEAR)===state.activeYear).length}件</b></div></div></section><section class="grid"><button class="action green" id="a">↓ 入庫登録<small>生産年度・季節・分類・数量</small></button><button class="action blue" id="b">↑ 出庫登録<small>生産年度別の在庫から減算</small></button><button class="action orange" id="c">▦ PDF型在庫表<small>生産年度別に表示</small></button><button class="action purple" id="d">≡ 入出庫履歴<small>年度を含めて修正・削除</small></button><button class="action gray" id="e">⇩ データ出力<small>Excel・CSV・バックアップ</small></button><button class="action gray" id="f">⚙ マスター設定<small>漁協・細分類を確認</small></button><button class="action" id="shipHome" style="border-left:6px solid #e05a47">📦 出荷指示<small>生産年度指定・PDF・FAX</small></button></section><section class="card"><h2>生産年度</h2><div class="note">在庫は R3年産〜R10年産を別々に管理します。入庫・出庫・PDF取込・出荷指示のすべてに生産年度が付きます。</div></section>`;homeYear.onchange=()=>{setActiveYear(homeYear.value);home()};a.onclick=()=>form('in');b.onclick=()=>form('out');c.onclick=stock;d.onclick=logs;e.onclick=exportsPage;f.onclick=masters;shipHome.onclick=shipments}
function itemOptions(selectedGroup,selectedItem){return GROUPS.map(g=>`<optgroup label="${esc(g.name)}">${g.items.map(i=>`<option value="${esc(g.name)}|${esc(i)}" ${(g.name===selectedGroup&&i===selectedItem)?'selected':''}>${esc(i)}</option>`).join('')}</optgroup>`).join('')}
function form(type,editId=null){
 const r=editId?state.records.find(x=>x.id===editId):null;
 const g=r?.group||GROUPS[0].name,i=r?.item||GROUPS[0].items[0],yr=r?.year||state.activeYear;
 const pdfButton=(!r&&type==='in')?`<button class="btn secondary" id="pdfImportBtn" type="button">📄 PDFから入庫</button><input id="pdfImportFile" type="file" accept="application/pdf,.pdf" hidden><div class="note">50〜60ページ程度のPDFから「釧路産昆布」だけを抽出し、生産年度・漁協・区分・細分類ごとに合算します。同じPDFの二重登録は自動で防止します。</div>`:'';
 app.innerHTML=`<section class="card"><h2>${r?'入出庫修正':type==='in'?'入庫登録':'出庫登録'}</h2><div class="form">${pdfButton}<label>区分<select id="t"><option value="in" ${r?.type==='in'?'selected':''}>入庫</option><option value="out" ${r?.type==='out'?'selected':''}>出庫</option></select></label><label>生産年度<select id="y">${yearOptions(yr)}</select></label><label>漁協<select id="c">${state.coops.map(x=>`<option ${x===r?.coop?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>季節区分<select id="s">${SEASONS.map(x=>`<option ${x===(r?.season||'夏')?'selected':''}>${x}</option>`).join('')}</select></label><label>大分類＋細分類<select id="gi">${itemOptions(g,i)}</select></label><label>数量<input id="q" type="number" min="0" step="0.01" inputmode="decimal" value="${r?esc(r.qty):''}"></label><label>日付<input id="d" type="date" value="${r?.date||today()}"></label><label>備考<input id="memo" type="text" maxlength="100" value="${esc(r?.memo||'')}"></label><button class="btn" id="saveBtn">${r?'修正を保存':'登録する'}</button><button class="btn secondary" id="back">戻る</button></div></section>`;
 back.onclick=()=>r?logs():home;
 if(!r&&type==='in'){pdfImportBtn.onclick=()=>pdfImportFile.click();pdfImportFile.onchange=()=>{const f=pdfImportFile.files?.[0];if(f)importInventoryPdf(f)}}
 saveBtn.onclick=()=>{
   const n=Number(q.value);if(!n||n<0)return alert('数量を入力してください');
   const [group,item]=gi.value.split('|'),year=y.value;
   if(r){const idx=state.records.findIndex(x=>x.id===r.id);state.records[idx]={...r,type:t.value,year,coop:c.value,season:s.value,group,item,qty:n,date:d.value,memo:memo.value}}
   else{if(t.value==='out'){const avail=stockAvailableForShipment(year,c.value,s.value,group,item);if(n>avail)return alert(`${year}年産 ${c.value} ${s.value} ${group} ${item} の出荷可能在庫は ${fmt(avail)} です。`)}state.records.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),type:t.value,year,coop:c.value,season:s.value,group,item,qty:n,date:d.value,memo:memo.value})}
   setActiveYear(year);save();alert(r?'修正しました':t.value==='in'?'入庫しました':'出庫しました');r?logs():stock();
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
 let html=`<section class="card"><div class="row"><h2>在庫集計表（PDF準拠）</h2><select id="stockYear" style="width:auto;padding:8px;border:1px solid #ccd6e2;border-radius:9px;background:#fff;font-size:15px">${yearOptions(year)}</select></div><div class="toolbar"><button class="btn smallbtn" id="ex">Excel出力</button><button class="btn smallbtn" id="cs">CSV出力</button><button class="btn secondary smallbtn" id="x">ホーム</button><button class="btn secondary smallbtn" id="r">更新</button></div><div class="tablewrap" style="margin-top:12px"><table><tr><th rowspan="2">組合名</th><th rowspan="2">区分</th>`;
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
   html+=`<tr class="total"><td></td><td>小計</td>`;
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
 html+=`<th>${total(year)?fmt(total(year)):''}</th></tr></table></div><p class="muted">${esc(year)}年産の在庫です。0は空欄表示します。</p></section>`;
 app.innerHTML=html;
 stockYear.onchange=()=>{setActiveYear(stockYear.value);stock()};
 x.onclick=home;r.onclick=stock;ex.onclick=downloadExcel;cs.onclick=downloadCSV;
}
function logs(){const arr=state.records.slice().reverse();app.innerHTML=`<section class="card"><h2>入出庫履歴</h2><input class="search" id="search" placeholder="年度・漁協・季節・分類・備考を検索"><div class="tablewrap"><table style="min-width:1100px"><tr><th>日付</th><th>区分</th><th>生産年度</th><th>漁協</th><th>季節</th><th>大分類</th><th>細分類</th><th>数量</th><th>備考</th><th>操作</th></tr><tbody id="tb"></tbody></table></div><button class="btn secondary" id="x" style="margin-top:10px">ホームへ戻る</button></section>`;const render=()=>{const t=search.value.trim().toLowerCase();tb.innerHTML=arr.filter(r=>[r.date,r.type==='in'?'入庫':'出庫',r.year||DEFAULT_YEAR,r.coop,r.season,r.group,r.item,r.memo].join(' ').toLowerCase().includes(t)).map(r=>`<tr><td>${esc(r.date)}</td><td>${r.type==='in'?'入庫':'出庫'}</td><td>${esc(r.year||DEFAULT_YEAR)}年産</td><td>${esc(r.coop)}</td><td>${esc(r.season)}</td><td>${esc(r.group)}</td><td>${esc(r.item)}</td><td>${fmt(r.qty)}</td><td>${esc(r.memo||'')}</td><td><div class="record-actions"><button class="mini" data-edit="${r.id}">修正</button><button class="mini danger" data-del="${r.id}">削除</button></div></td></tr>`).join('')||'<tr><td colspan="10" class="empty">履歴はありません</td></tr>'};render();search.oninput=render;tb.onclick=e=>{const ed=e.target.dataset.edit,del=e.target.dataset.del;if(ed)form(null,ed);if(del&&confirm('この入出庫を削除しますか？')){state.records=state.records.filter(r=>r.id!==del);save();logs()}};x.onclick=home}
function flatRows(){const m=matrix(),rows=[];YEARS.forEach(y=>state.coops.forEach(c=>SEASONS.forEach(se=>GROUPS.forEach(g=>g.items.forEach(i=>rows.push([y,c,se,g.name,i,m[[y,c,g.name,i,se].join('|')]||0]))))));return rows}
function download(name,content,type){const blob=new Blob([content],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function downloadCSV(){const rows=[['生産年度','組合名','区分','大分類','細分類','在庫'],...flatRows()];download('昆布在庫_年度別_'+today()+'.csv','\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n'),'text/csv;charset=utf-8')}
function downloadExcel(){let h='<html><head><meta charset="UTF-8"></head><body><table border="1"><tr><th>生産年度</th><th>組合名</th><th>区分</th><th>大分類</th><th>細分類</th><th>在庫</th></tr>';flatRows().forEach(r=>{h+=`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`});h+='</table></body></html>';download('昆布在庫_年度別_'+today()+'.xls','\uFEFF'+h,'application/vnd.ms-excel;charset=utf-8')}
function exportsPage(){app.innerHTML=`<section class="card"><h2>データ出力・バックアップ</h2><div class="toolbar"><button class="btn" id="ex">Excel形式</button><button class="btn" id="cs">CSV</button><button class="btn secondary" id="bk">バックアップ保存</button><button class="btn secondary" id="rs">バックアップ復元</button></div><input id="file" type="file" accept="application/json,.json" hidden><p class="muted">出力・バックアップにはR3〜R10の生産年度情報も含まれます。</p><button class="btn secondary" id="x">ホームへ戻る</button></section>`;ex.onclick=downloadExcel;cs.onclick=downloadCSV;bk.onclick=backup;rs.onclick=()=>file.click();file.onchange=()=>restore(file.files[0]);x.onclick=home}
function backup(){download('昆布在庫管理_年度別バックアップ_'+today()+'.json',JSON.stringify({app:'昆布在庫管理',version:5,groups:GROUPS,seasons:SEASONS,years:YEARS,exportedAt:new Date().toISOString(),...state},null,2),'application/json;charset=utf-8')}
function restore(file){if(!file)return;const fr=new FileReader();fr.onload=()=>{try{const d=JSON.parse(fr.result);if(!Array.isArray(d.records)||!Array.isArray(d.coops))throw Error();if(!confirm('現在のデータをバックアップ内容に置き換えます。よろしいですか？'))return;state={records:d.records.map(r=>({...r,year:YEARS.includes(r.year)?r.year:DEFAULT_YEAR})),coops:d.coops,shipments:Array.isArray(d.shipments)?d.shipments:[],shipmentSeq:Number(d.shipmentSeq||1),pdfImports:Array.isArray(d.pdfImports)?d.pdfImports:[],activeYear:YEARS.includes(d.activeYear)?d.activeYear:DEFAULT_YEAR};save();alert('復元しました');home()}catch(e){alert('バックアップを読み込めませんでした')}};fr.readAsText(file)}
function masters(){app.innerHTML=`<section class="card"><h2>マスター設定</h2><p class="muted">生産年度はR3〜R10で固定しています。PDF準拠の細分類も固定し、漁協名のみ編集できます。</p><div class="master-list" id="cl"></div><button class="btn secondary" id="ac">＋ 漁協を追加</button><button class="btn" id="sm" style="margin-top:10px">保存</button><button class="btn secondary" id="x" style="margin-top:8px">戻る</button><hr><h3>PDF準拠の細分類</h3><div id="defs"></div></section>`;const render=()=>{cl.innerHTML=state.coops.map((v,i)=>`<div class="master-item"><input value="${esc(v)}" data-c="${i}"><button class="mini danger" data-r="${i}">削除</button></div>`).join('');defs.innerHTML=GROUPS.map(g=>`<p><b>${esc(g.name)}</b>：${g.items.map(esc).join('・')}</p>`).join('')};render();ac.onclick=()=>{state.coops.push('新しい漁協');render()};cl.onclick=e=>{const i=e.target.dataset.r;if(i!==undefined){if(state.coops.length<=1)return alert('漁協は1件以上必要です');state.coops.splice(i,1);render()}};sm.onclick=()=>{const old=[...state.coops];document.querySelectorAll('[data-c]').forEach(x=>state.coops[+x.dataset.c]=x.value.trim());if(state.coops.some(x=>!x)||new Set(state.coops).size!==state.coops.length){state.coops=old;return alert('空欄や重複は使えません')}save();alert('保存しました');home()};x.onclick=home}
homeBtn.onclick=home;inBtn.onclick=()=>form('in');outBtn.onclick=()=>form('out');stockBtn.onclick=stock;moreBtn.onclick=exportsPage;if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));home();

/* ===== 出荷指示機能 v1 ===== */
state.shipments=Array.isArray(state.shipments)?state.shipments:[];
state.shipments=state.shipments.map(s=>({...s,lines:Array.isArray(s.lines)?s.lines.filter(l=>!DELETED_GROUPS.has(l.group)).map(l=>({...l,year:YEARS.includes(l.year)?l.year:DEFAULT_YEAR})):[]}));
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
  app.innerHTML=`<section class="card"><h2>📦 ${s?'出荷指示修正':'新規出荷指示'}</h2>
  <div class="form">
  <div class="subgrid"><label>出荷先<input id="dest" value="${esc(s?.dest||'')}" placeholder="例：山三商事㈱"></label><label>出荷日<input id="shipDate" type="date" value="${s?.shipDate||today()}"></label></div>
  <div class="subgrid"><label>希望着日<input id="arrivalDate" type="date" value="${s?.arrivalDate||''}"></label><label>備考<input id="shipMemo" value="${esc(s?.memo||'')}" placeholder="配送・梱包等の指示"></label></div>
  <div id="shipLines"></div>
  <button class="btn secondary" id="addLine">＋ 明細を追加</button>
  <div class="toolbar"><button class="btn" id="saveDraft">下書き保存</button><button class="btn secondary" id="backShip">戻る</button></div>
  </div></section>`;
  function renderLines(){
    shipLines.innerHTML=lines.map((l,idx)=>`<div class="card" style="margin:10px 0;padding:12px;background:#f8fafc"><div class="row"><b>明細 ${idx+1}</b><button class="mini danger" data-del-line="${idx}">削除</button></div><div class="form" style="margin-top:8px"><div class="subgrid"><label>生産年度<select data-f="year" data-i="${idx}">${yearOptions(l.year||state.activeYear)}</select></label><label>漁協<select data-f="coop" data-i="${idx}">${state.coops.map(c=>`<option ${c===l.coop?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>季節<select data-f="season" data-i="${idx}">${SEASONS.map(x=>`<option ${x===(l.season||'夏')?'selected':''}>${x}</option>`).join('')}</select></label></div><label>大分類・細分類<select data-f="gi" data-i="${idx}">${itemOptions(l.group||GROUPS[0].name,l.item||GROUPS[0].items[0])}</select></label><div class="subgrid"><label>数量<input data-f="qty" data-i="${idx}" type="number" min="0.01" step="0.01" value="${esc(l.qty||'')}"></label><label>明細備考<input data-f="memo" data-i="${idx}" value="${esc(l.memo||'')}"></label></div></div></div>`).join('')||'<div class="empty">明細を追加してください。</div>';
    shipLines.querySelectorAll('[data-f]').forEach(el=>el.onchange=()=>{const i=+el.dataset.i,f=el.dataset.f;if(f==='gi'){[lines[i].group,lines[i].item]=el.value.split('|')}else lines[i][f]=el.value});
    shipLines.querySelectorAll('[data-del-line]').forEach(b=>b.onclick=()=>{lines.splice(+b.dataset.delLine,1);renderLines()});
  }
  addLine.onclick=()=>{lines.push({year:state.activeYear,coop:state.coops[0],season:'夏',group:GROUPS[0].name,item:GROUPS[0].items[0],qty:'',memo:''});renderLines()};
  saveDraft.onclick=()=>{
    if(!dest.value.trim())return alert('出荷先を入力してください');
    if(!lines.length)return alert('明細を1件以上追加してください');
    for(const l of lines){const q=Number(l.qty);if(!q||q<=0)return alert('数量を入力してください');const av=stockAvailableForShipment(l.year||DEFAULT_YEAR,l.coop,l.season,l.group,l.item,s?.id);if(q>av)return alert(`${l.year||DEFAULT_YEAR}年産 ${l.coop} ${l.season} ${l.group} ${l.item} の出荷可能在庫は ${fmt(av)} です。`)}
    const obj=s||{id:shipmentId(),status:'draft',createdAt:new Date().toISOString()};Object.assign(obj,{dest:dest.value.trim(),shipDate:shipDate.value,arrivalDate:arrivalDate.value,memo:shipMemo.value,lines,updatedAt:new Date().toISOString()});if(!s)state.shipments.push(obj);save();alert('出荷指示を保存しました');shipmentDetail(obj.id)
  };
  backShip.onclick=shipments;
  renderLines();
}
function shipmentDetail(id){
 const s=state.shipments.find(x=>x.id===id);if(!s)return shipments();
 const statusName={draft:'下書き',confirmed:'確定・引当済',shipped:'出荷済',cancelled:'取消'}[s.status]||s.status;
 const totalQ=s.lines.reduce((a,l)=>a+Number(l.qty||0),0);
 app.innerHTML=`<section class="card"><div class="row"><h2>📦 出荷指示書 ${esc(s.id)}</h2><span class="pill">${statusName}</span></div><p><b>出荷先：</b>${esc(s.dest)}　　<b>出荷日：</b>${esc(s.shipDate||'')}</p><p><b>希望着日：</b>${esc(s.arrivalDate||'未指定')}　　<b>合計：</b>${fmt(totalQ)}</p><div class="tablewrap"><table style="min-width:900px"><tr><th>生産年度</th><th>漁協</th><th>季節</th><th>大分類</th><th>細分類</th><th>数量</th><th>備考</th></tr>${s.lines.map(l=>`<tr><td>${esc(l.year||DEFAULT_YEAR)}年産</td><td>${esc(l.coop)}</td><td>${esc(l.season)}</td><td>${esc(l.group)}</td><td>${esc(l.item)}</td><td>${fmt(l.qty)}</td><td>${esc(l.memo||'')}</td></tr>`).join('')}</table></div><p class="muted">備考：${esc(s.memo||'')}</p><div class="toolbar"><button class="btn" id="pdf">📄 PDF・FAX用</button>${s.status==='draft'?'<button class="btn" id="confirm">確定して引当</button>':''}${s.status==='confirmed'?'<button class="btn" id="shipped">出荷済にする</button>':''}${s.status==='draft'?'<button class="btn secondary" id="edit">修正</button>':''}${s.status!=='shipped'&&s.status!=='cancelled'?'<button class="btn danger" id="cancel">取消</button>':''}<button class="btn secondary" id="back">一覧へ</button></div></section>`;
 pdf.onclick=()=>printShipment(s.id);
 if(s.status==='draft')confirm.onclick=()=>{for(const l of s.lines){const av=stockAvailableForShipment(l.year||DEFAULT_YEAR,l.coop,l.season,l.group,l.item,s.id);if(Number(l.qty)>av)return alert(`${l.year||DEFAULT_YEAR}年産 ${l.coop} ${l.season} ${l.group} ${l.item} の出荷可能在庫は ${fmt(av)} です。`)}s.status='confirmed';s.confirmedAt=new Date().toISOString();save();shipmentDetail(s.id)};
 if(s.status==='confirmed')shipped.onclick=()=>{if(!confirm('出荷済みにすると、明細数量を在庫から出庫します。よろしいですか？'))return;for(const l of s.lines){state.records.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),type:'out',year:l.year||DEFAULT_YEAR,coop:l.coop,season:l.season,group:l.group,item:l.item,qty:Number(l.qty),date:s.shipDate||today(),memo:`出荷指示 ${s.id} / ${s.dest}`})}s.status='shipped';s.shippedAt=new Date().toISOString();save();alert('出荷済みとして在庫から減算しました');shipmentDetail(s.id)};
 if(s.status==='draft')edit.onclick=()=>shipmentForm(s.id);
 if(s.status!=='shipped'&&s.status!=='cancelled')cancel.onclick=()=>{if(confirm('この出荷指示を取消しますか？')){s.status='cancelled';save();shipmentDetail(s.id)}};
 back.onclick=shipments;
}
function shipments(){
 const arr=state.shipments.slice().reverse();
 app.innerHTML=`<section class="card"><div class="row"><h2>📦 出荷指示一覧</h2><button class="mini" id="newS">＋新規</button></div><input class="search" id="ss" placeholder="指示番号・出荷先・状態で検索"><div class="tablewrap"><table style="min-width:900px"><tr><th>指示番号</th><th>生産年度</th><th>出荷先</th><th>出荷日</th><th>希望着日</th><th>数量</th><th>状態</th><th>操作</th></tr><tbody id="stb"></tbody></table></div><button class="btn secondary" id="sx" style="margin-top:10px">ホームへ戻る</button></section>`;
 const render=()=>{const q=ss.value.trim().toLowerCase();stb.innerHTML=arr.filter(s=>[s.id,...s.lines.map(l=>l.year||DEFAULT_YEAR),s.dest,s.shipDate,s.arrivalDate,s.status].join(' ').toLowerCase().includes(q)).map(s=>`<tr><td>${esc(s.id)}</td><td>${esc([...new Set(s.lines.map(l=>(l.year||DEFAULT_YEAR)+'年産'))].join('・'))}</td><td>${esc(s.dest)}</td><td>${esc(s.shipDate||'')}</td><td>${esc(s.arrivalDate||'')}</td><td>${fmt(s.lines.reduce((a,l)=>a+Number(l.qty||0),0))}</td><td>${{draft:'下書き',confirmed:'確定・引当済',shipped:'出荷済',cancelled:'取消'}[s.status]||s.status}</td><td><button class="mini" data-open="${s.id}">開く</button></td></tr>`).join('')||'<tr><td colspan="8" class="empty">出荷指示はありません</td></tr>'};render();ss.oninput=render;stb.onclick=e=>{if(e.target.dataset.open)shipmentDetail(e.target.dataset.open)};newS.onclick=()=>shipmentForm();sx.onclick=home;
}
function printShipment(id){
 const s=state.shipments.find(x=>x.id===id);if(!s)return;
 const cols=allItems();const by={};s.lines.forEach(l=>by[[l.group,l.item].join('|')]=(by[[l.group,l.item].join('|')]||0)+Number(l.qty||0));
 const printYears=[...new Set(s.lines.map(l=>l.year||DEFAULT_YEAR))].sort((a,b)=>YEARS.indexOf(a)-YEARS.indexOf(b));
 const rows=printYears.flatMap(y=>state.coops.flatMap(c=>SEASONS.map((season,si)=>{const lns=s.lines.filter(x=>(x.year||DEFAULT_YEAR)===y&&x.coop===c&&x.season===season);const rowTotal=lns.reduce((a,x)=>a+Number(x.qty||0),0);return `<tr><th>${si===0?esc(y)+'年産':''}</th><th class="coop">${si===0?esc(c):''}</th><th class="season">${esc(season)}</th>${cols.map(ci=>`<td>${fmt(lns.filter(x=>x.group===ci.group&&x.item===ci.item).reduce((a,x)=>a+Number(x.qty||0),0)||'')}</td>`).join('')}<td>${fmt(rowTotal||'')}</td></tr>`}))).join('');
 const seasons=[...new Set(s.lines.map(x=>x.season))].join('・');
 const w=window.open('','_blank');
 if(!w)return alert('ポップアップがブロックされました。Safariのポップアップ設定を確認してください。');
 w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>出荷指示書 ${esc(s.id)}</title><style>@page{size:A4 landscape;margin:8mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif;color:#000;margin:0;font-size:9px}.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #000;padding-bottom:4px}.title{font-size:22px;font-weight:700;letter-spacing:5px}.meta{text-align:right;line-height:1.6}.info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:7px 0}.box{border:1px solid #000;padding:5px;min-height:25px}.label{font-weight:700}.table{width:100%;border-collapse:collapse;table-layout:fixed}.table th,.table td{border:1px solid #000;padding:2px;text-align:center;height:19px;overflow:hidden;white-space:nowrap}.table thead th{background:#eee}.table .coop{width:55px}.table .season{width:24px}.foot{display:grid;grid-template-columns:1fr 2fr 1fr;margin-top:8px;gap:8px}.sign{height:38px;border:1px solid #000;padding:5px}.total{font-weight:700}.note{margin-top:6px;border:1px solid #000;padding:5px;min-height:28px}@media print{.no-print{display:none}}button{padding:8px 16px;font-size:16px}</style></head><body><div class="head"><div class="title">出 荷 指 示 書</div><div class="meta">指示番号：${esc(s.id)}<br>作成日：${esc(today())}</div></div><div class="info"><div class="box"><span class="label">出荷先：</span>${esc(s.dest)} 御中</div><div class="box"><span class="label">出荷日：</span>${esc(s.shipDate||'')}</div><div class="box"><span class="label">希望着日：</span>${esc(s.arrivalDate||'')}</div></div><div class="box" style="margin-bottom:6px"><span class="label">生産年度：</span>${esc([...new Set(s.lines.map(l=>(l.year||DEFAULT_YEAR)+'年産'))].join('・'))}　　<span class="label">区分：</span>${esc(seasons)}　　<span class="label">合計：</span>${fmt(s.lines.reduce((a,l)=>a+Number(l.qty||0),0))}</div><table class="table"><thead><tr><th rowspan="2">生産年度</th><th class="coop" rowspan="2">組合名</th><th class="season" rowspan="2">区分</th>${GROUPS.map(g=>`<th colspan="${g.items.length}">${esc(g.name)}</th>`).join('')}<th rowspan="2">計</th></tr><tr>${GROUPS.map(g=>g.items.map(i=>`<th>${esc(i)}</th>`).join('')).join('')}</tr></thead><tbody>${rows}</tbody><tfoot><tr class="total"><th colspan="3">合計</th>${cols.map(ci=>`<td>${fmt(s.lines.filter(l=>l.group===ci.group&&l.item===ci.item).reduce((a,x)=>a+Number(x.qty||0),0)||'')}</td>`).join('')}<td>${fmt(s.lines.reduce((a,l)=>a+Number(l.qty||0),0))}</td></tr></tfoot></table><div class="note"><b>備考：</b>${esc(s.memo||'')}${s.lines.some(l=>l.memo)?'　明細備考：'+esc(s.lines.filter(l=>l.memo).map(l=>l.memo).join('／')):''}</div><div class="foot"><div class="sign">出荷元：㈱浜中運輸</div><div class="sign">受注・配送指示：</div><div class="sign">FAX送信欄：</div></div><div class="no-print" style="margin-top:12px;text-align:center"><button onclick="window.print()">印刷／PDF保存</button></div></body></html>`);w.document.close();setTimeout(()=>w.focus(),300);
}
/* ナビ・その他を更新 */
moreBtn.onclick=shipments;
homeBtn.onclick=home;inBtn.onclick=()=>form('in');outBtn.onclick=()=>form('out');stockBtn.onclick=stock;
home();


/* 出荷機能の安全性・復元対応 */
const _backupV4=backup;
backup=function(){download('昆布在庫管理_業務バックアップ_'+today()+'.json',JSON.stringify({app:'昆布在庫管理',version:5,groups:GROUPS,seasons:SEASONS,years:YEARS,exportedAt:new Date().toISOString(),...state},null,2),'application/json;charset=utf-8')};
restore=function(file){if(!file)return;const fr=new FileReader();fr.onload=()=>{try{const d=JSON.parse(fr.result);if(!Array.isArray(d.records)||!Array.isArray(d.coops))throw Error();if(!confirm('現在のデータをバックアップ内容に置き換えます。よろしいですか？'))return;state={records:d.records.map(r=>({...r,year:YEARS.includes(r.year)?r.year:DEFAULT_YEAR})),coops:d.coops,shipments:Array.isArray(d.shipments)?d.shipments.map(s=>({...s,lines:Array.isArray(s.lines)?s.lines.map(l=>({...l,year:YEARS.includes(l.year)?l.year:DEFAULT_YEAR})):[]})):[],shipmentSeq:Number(d.shipmentSeq||1),pdfImports:Array.isArray(d.pdfImports)?d.pdfImports:[],activeYear:YEARS.includes(d.activeYear)?d.activeYear:DEFAULT_YEAR};save();alert('復元しました');home()}catch(e){alert('バックアップを読み込めませんでした')}};fr.readAsText(file)};
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
