/* =========================================================
   昆布在庫管理 v165.7 UI/在庫表示 patch
   - 新規出荷依頼の釧路産棹前昆布で、
     画面の選択値と内部明細値がずれた場合に同期
   - 出荷可能在庫表示を現在のDOM選択値から再計算
   ========================================================= */
(function(){
  'use strict';

  function fmt(v){
    try { return Number(v || 0).toLocaleString('ja-JP'); }
    catch(_) { return String(v ?? ''); }
  }

  function getLineValues(box){
    var out = {};
    if(!box) return out;
    box.querySelectorAll('[data-f]').forEach(function(el){
      out[el.dataset.f] = el.value;
    });
    var productSel = box.querySelector('[data-v114-product]');
    out.product = productSel ? productSel.value : '';
    return out;
  }

  function calcSanmaeFromDom(box){
    var v = getLineValues(box);
    if(v.product !== 'sanmae') return null;

    var gi = String(v.gi || '').split('|');
    var filters = {
      year: v.year || 'R7',
      coop: v.coop || '',
      season: v.season || '',
      group: gi[0] || '',
      item: gi[1] || ''
    };

    try{
      var inv = window.KombuRefactor && window.KombuRefactor.Inventory;
      if(inv && typeof inv.getAvailableQuantity === 'function'){
        return inv.getAvailableQuantity('sanmae', filters, null);
      }
    }catch(_){}

    try{
      if(typeof smAvail === 'function'){
        return smAvail(
          filters.year,
          filters.coop,
          filters.season,
          filters.group,
          filters.item,
          null
        );
      }
    }catch(_){}

    return null;
  }

  function refreshBox(box){
    if(!box) return;
    var v = getLineValues(box);
    if(v.product !== 'sanmae') return;

    var av = calcSanmaeFromDom(box);
    if(av === null || av === undefined || !Number.isFinite(Number(av))) return;

    var span = box.querySelector('.v114-avail');
    if(!span) return;

    var qtyEl = box.querySelector('[data-f="qty"]');
    var qty = Number(qtyEl ? qtyEl.value : 0) || 0;
    var over = qty > Number(av || 0);
    var text = '出荷可能在庫：' + fmt(av) + (over ? '　⚠ 在庫不足' : '');

    if(span.textContent !== text) span.textContent = text;
    span.style.color = over ? '#b42318' : '';
    span.style.fontWeight = over ? '900' : '';
  }

  function refreshAll(){
    document.querySelectorAll('[data-v114-line]').forEach(refreshBox);
  }

  /*
   * 画面値がプログラム側から書き換えられ、
   * 元の onchange が発火していない場合に、
   * 既存ハンドラを呼んで内部 lines[] と同期する。
   */
  function syncInternalLinesFromDom(){
    var snapshots = [];
    document.querySelectorAll('[data-v114-line]').forEach(function(box){
      var fields = Array.from(box.querySelectorAll('[data-f]'));
      snapshots.push(fields);
    });

    snapshots.forEach(function(fields){
      fields.forEach(function(el){
        try{
          if(typeof el.onchange === 'function'){
            el.onchange.call(el);
          }
        }catch(e){
          console.warn('[v165.7] 明細同期:', e);
        }
      });
    });

    setTimeout(refreshAll, 0);
  }

  // プレビュー・保存・PDF/FAX処理の直前に必ず内部値を同期
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest ? e.target.closest('#v114Preview,#v114Save,#v114PdfFlow') : null;
    if(!t) return;
    syncInternalLinesFromDom();
  }, true);

  // ユーザー操作の直後に表示を再計算
  document.addEventListener('change', function(e){
    if(e.target && e.target.closest && e.target.closest('[data-v114-line]')){
      setTimeout(refreshAll, 0);
    }
  }, true);

  document.addEventListener('input', function(e){
    if(e.target && e.target.matches && e.target.matches('[data-v114-line] [data-f="qty"]')){
      setTimeout(refreshAll, 0);
    }
  }, true);

  // 既存コードの再描画後にも正しい表示へ補正
  var timer = null;
  var observer = new MutationObserver(function(){
    clearTimeout(timer);
    timer = setTimeout(refreshAll, 0);
  });
  observer.observe(document.documentElement, {subtree:true, childList:true});

  refreshAll();
  console.log('[KOMBU v165.7] shipment availability DOM sync patch ready');
})();
