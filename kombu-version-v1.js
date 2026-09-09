/* 昆布在庫管理 表示バージョン同期 v1.1
   v165.10.1: DOM全体MutationObserverを廃止し、フリーズを防止 */
(function(){
  'use strict';
  const me=document.currentScript;
  const VERSION=(me&&me.dataset&&me.dataset.version)||'v165.10.1';
  window.KOMBU_APP_VERSION=VERSION;

  function setIfDifferent(el){
    if(el && String(el.textContent||'').trim()!==VERSION) el.textContent=VERSION;
  }
  function apply(){
    document.querySelectorAll('.v106-version,[data-app-version],.kombu-app-version').forEach(setIfDifferent);
    // 旧UI互換: v165.x と表示されている葉ノードだけ更新。
    document.querySelectorAll('.pill,span,div').forEach(el=>{
      if(el.children && el.children.length) return;
      const t=String(el.textContent||'').trim();
      if(/^v165(?:\.\d+){1,3}$/.test(t) && t!==VERSION) el.textContent=VERSION;
    });
  }
  function start(){
    apply();
    // DOM監視はしない。画面切替後の表示だけ低頻度で補正する。
    window.addEventListener('hashchange',()=>setTimeout(apply,50));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(apply,50);});
    setInterval(apply,15000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
