/* 昆布在庫管理 表示バージョン同期 v1.0 */
(function(){
  'use strict';
  const me=document.currentScript;
  const VERSION=(me&&me.dataset&&me.dataset.version)||'v165.10.0';
  window.KOMBU_APP_VERSION=VERSION;
  function apply(){
    document.querySelectorAll('.v106-version,[data-app-version],.kombu-app-version').forEach(el=>{el.textContent=VERSION;});
    // 旧版でトップ右上が単なるpillの場合も、v165.x表記だけ更新する。
    document.querySelectorAll('.pill,span,div').forEach(el=>{
      if(el.children&&el.children.length)return;
      const t=String(el.textContent||'').trim();
      if(/^v165(?:\.\d+){1,3}$/.test(t))el.textContent=VERSION;
    });
  }
  const obs=new MutationObserver(()=>apply());
  function start(){apply();obs.observe(document.body,{subtree:true,childList:true});setInterval(apply,2000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
