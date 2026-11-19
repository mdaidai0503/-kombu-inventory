const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/kombu-next-readonly.html','utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
for(const s of scripts)new vm.Script(s);
class Canvas{
 constructor(){this.width=0;this.height=0;this.ops=[];this.style={};}
 getContext(){const canvas=this;return new Proxy({canvas,measureText:s=>({width:String(s).length*8}),fillText(t,x,y){canvas.ops.push({t:String(t),x,y});},drawImage(src,...a){if(!src.ops)return;let sx=0,sy=0,sw=src.width,sh=src.height,dx=0,dy=0,dw=sw,dh=sh;if(a.length===2)[dx,dy]=a;else if(a.length===4)[dx,dy,dw,dh]=a;else [sx,sy,sw,sh,dx,dy,dw,dh]=a;for(const o of src.ops)if(o.x>=sx&&o.x<=sx+sw&&o.y>=sy&&o.y<=sy+sh)canvas.ops.push({t:o.t,x:dx+(o.x-sx)*dw/sw,y:dy+(o.y-sy)*dh/sh});}},{get(o,k){return k in o?o[k]:()=>{};}});}
}
const sandbox={console,structuredClone,crypto:require('node:crypto').webcrypto,TextEncoder,Blob,Image:class{decode(){return Promise.resolve();}},document:{createElement:t=>new Canvas()}};
sandbox.window=sandbox;vm.createContext(sandbox);
for(const i of [0,1,3])vm.runInContext(scripts[i],sandbox);
vm.runInContext(fs.readFileSync(__dirname+'/kombu-shipment-cells.js','utf8'),sandbox);
const M=sandbox.KombuModel,C=sandbox.KombuShipmentCells;
assert.equal(C.number('１,０００.'),1000);assert.ok(Number.isNaN(C.number('')));assert.ok(Number.isNaN(C.number('10kg')));
assert.equal(C.quantity({count:'3',quantity:'45'},'kushiro',''),3);
assert.equal(C.quantity({count:'3',quantity:'45'},'rausu_normal','kg'),45);
assert.equal(C.quantity({count:'3',quantity:'45'},'rausu_long','本'),3);
// Every input rectangle is centered on the original PDF's quantity text, including
// Hidaka's stretched upper rows and Rausu continuation tables.
for(const p of ['kushiro','nemuro','hidaka','sanmae']){
 const cells=C.regularCells(p,'R8'),lines=cells.map((c,i)=>({...c.line,qty:100000+i}));
 const [canvas]=sandbox.KombuOriginalPdf.canvases(p,{id:'TEST',lines});
 assert.equal(new Set(cells.map(c=>M.key(p,c.line))).size,cells.length);
 for(const [i,c]of cells.entries()){
  const op=canvas.ops.find(o=>o.t===(100000+i).toLocaleString('ja-JP'));
  assert.ok(op,p+' cell '+i+' is printed');assert.ok(Math.abs(op.x-c.x-c.w/2)<.001,p+' x '+i);assert.ok(Math.abs(op.y-c.y-c.h/2)<.001,p+' y '+i);
 }
 console.log(p+': '+cells.length+' PDF cell centers matched');
}
for(const p of ['rausu_normal','rausu_long']){
 const db=M.empty();db.products[p].records=[{year:'R8',coop:'天然',season:'元揃（走）',group:'1等',item:'黒',unit:'kg',qty:100,type:'in'},{year:'R8',coop:'天然',season:'追加品名',group:'1等',item:'赤',unit:'kg',qty:20,type:'in'}];
 const layouts=C.rausuPages(p,'R8','kg',db,[]),lines=layouts.flatMap(pg=>pg.cells).map((c,i)=>({...c.line,qty:100000+i}));
 const canvases=sandbox.KombuOriginalPdf.canvases(p,{id:'TEST',lines});let i=0;
 assert.equal(canvases.length,layouts.length);
 for(const [n,pg]of layouts.entries())for(const c of pg.cells){const expected=(100000+i++).toLocaleString('ja-JP'),op=canvases[n].ops.find(o=>o.t===expected);assert.ok(op,p+' quantity printed '+(i-1)+' '+JSON.stringify(c.line)+' PAGE '+n+' '+canvases[n].ops.filter(x=>/^100/.test(x.t)).slice(-8).map(x=>x.t));assert.ok(Math.abs(op.x-c.x-c.w/2)<.001,p+' x');assert.ok(Math.abs(op.y-c.y-c.h/2)<.001,p+' y');}
 console.log(p+': '+layouts.length+' PDF pages and continuation cell centers matched');
}
// Clear, duplicate consolidation, fractional units, reservation, cancellation and
// shipment completion must affect one inventory key exactly once for every kind.
for(const p of Object.keys(M.PRODUCTS)){
 const db=M.empty(),line=p.startsWith('rausu_')?{year:'R8',coop:'天然',season:'元揃（走）',group:'1等',item:'黒',unit:'kg'}:C.regularCells(p,'R8')[0].line;
 const lines=[{...line,product:p,qty:2},{...line,product:p,qty:3}];C.setQuantity(lines,p,line,4.5);assert.equal(lines.length,1);assert.equal(lines[0].qty,4.5);C.setQuantity(lines,p,line,0);assert.equal(lines.length,0);assert.throws(()=>C.setQuantity(lines,p,line,-1));
 db.products[p].records.push({...line,id:'IN',type:'in',qty:20});
 const s=M.createShipment(db,p,[{...line,qty:4.5}],'出荷人','出荷先','2026-11-19');assert.equal(M.stock(db,p)[0].qty,20);
 M.confirmShipment(db,p,s,'2026-11-19');assert.equal(M.stock(db,p)[0].qty,15.5);
 M.cancelShipment(db,p,s);assert.equal(M.stock(db,p)[0].qty,20);
 const t=M.createShipment(db,p,[{...line,qty:4.5}],'出荷人','出荷先','2026-11-19');M.confirmShipment(db,p,t,'2026-11-19');M.completeShipment(db,p,t,'2026-11-19');assert.equal(M.stock(db,p)[0].qty,15.5);M.completeShipment(db,p,t,'2026-11-19');assert.equal(M.stock(db,p)[0].qty,15.5);
 console.log(p+': draft/reservation/cancel/completion balance OK');
}
{
 const db=M.empty(),quote={quoteId:'TEST-QUOTE'},stocks=[],rows=[];
 for(const [i,p]of ['kushiro','rausu_normal','rausu_long'].entries()){
  const line=p.startsWith('rausu_')?{year:'R8',coop:'天然',season:'元揃（走）',group:'1等',item:'黒',unit:'kg'}:C.regularCells(p,'R8')[0].line;
  db.products[p].records.push({...line,type:'in',id:'in',qty:100});const stock=M.stock(db,p)[0],key=p+':'+M.key(p,line);stocks.push({p,line:stock,key});rows.push({index:i,item:{name:p},allocations:[{stock:key,qty:i?30:3}]});
 }
 const imported=C.allocateQuote(db,[],quote,rows,stocks);assert.equal(imported.count,3);assert.equal(imported.lines[0].qty,3);assert.equal(imported.lines[1].qty,30);assert.equal(imported.lines[1].unit,'kg');assert.equal(imported.lines[1].quoteRefs[0].quoteId,'TEST-QUOTE');assert.ok(!imported.lines[1].id&&!imported.lines[1].type&&!imported.lines[1].stockKey);
 assert.throws(()=>C.allocateQuote(db,imported.lines,quote,rows,stocks),/すでに/);
 const before=JSON.stringify(imported.lines),bad=structuredClone(rows);bad[2].allocations[0].qty=101;assert.throws(()=>C.allocateQuote(db,[],quote,bad,stocks),/超え/);assert.equal(JSON.stringify(imported.lines),before);
 const edit=[{...imported.lines[0],qty:'3',quoteRefs:[]}],another=C.allocateQuote(db,edit,{quoteId:'ANOTHER'},[rows[0]],stocks);assert.equal(another.lines[0].qty,6);
 const split=structuredClone(rows[0]);split.allocations=[{stock:stocks[0].key,qty:2},{stock:stocks[0].key,qty:1}];assert.equal(C.allocateQuote(db,[],quote,[split],stocks).lines[0].qty,3);
 assert.throws(()=>C.allocateQuote(db,[],quote,[{...rows[0],allocations:[{stock:'',qty:3}]}],stocks));
 console.log('Quote import: units/references/duplicate/atomic failure/split allocation OK');
}
console.log('All shipment cell checks passed');
