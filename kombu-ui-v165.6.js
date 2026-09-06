/* =========================================================
   昆布在庫管理 v165.6 UI patch
   - 入出庫履歴: フィルタ / ソート / 条件クリア / 表示件数
   - トップ画面: app-v159.js?v=... と連動した自動バージョン表示
   ========================================================= */
(function(){
  'use strict';

  function escapeHtml(v){
    return String(v ?? '').replace(/[&<>"']/g, function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];
    });
  }

  function numberFmt(v){
    try { return Number(v || 0).toLocaleString('ja-JP'); }
    catch(_) { return String(v ?? ''); }
  }

  function uniq(arr){
    return [...new Set(arr.filter(function(v){ return v !== undefined && v !== null && String(v) !== ''; }).map(String))]
      .sort(function(a,b){ return a.localeCompare(b, 'ja'); });
  }

  function optionHtml(values, selected, allLabel){
    return '<option value="">' + escapeHtml(allLabel || 'すべて') + '</option>' +
      values.map(function(v){
        return '<option value="' + escapeHtml(v) + '"' + (String(v) === String(selected || '') ? ' selected' : '') + '>' +
          escapeHtml(v) + '</option>';
      }).join('');
  }

  function currentAppVersion(){
    var scripts = Array.from(document.scripts || []);
    var appScript = scripts.find(function(s){
      return /(?:^|\/)app-v159\.js(?:\?|$)/.test(String(s.src || ''));
    });
    if(appScript){
      try{
        var u = new URL(appScript.src, location.href);
        var v = u.searchParams.get('v');
        if(v) return 'v' + v.replace(/^v/i,'');
      }catch(_){}
      var m = String(appScript.src || '').match(/[?&]v=([^&#]+)/);
      if(m) return 'v' + decodeURIComponent(m[1]).replace(/^v/i,'');
    }
    return 'v165.6';
  }

  function syncVersionLabel(){
    var version = currentAppVersion();
    document.querySelectorAll('.v106-version').forEach(function(el){
      el.textContent = version;
    });
  }

  // 古い v161.3 のラッパーがトップ画面を再描画しても、最後に現行版へ戻す。
  try{
    var oldLanding = (typeof productLanding === 'function') ? productLanding : null;
    if(oldLanding){
      productLanding = function(){
        var r = oldLanding.apply(this, arguments);
        syncVersionLabel();
        requestAnimationFrame(syncVersionLabel);
        setTimeout(syncVersionLabel, 0);
        return r;
      };
      try { globalThis.productLanding = productLanding; } catch(_){}
    }
  }catch(_){}

  var versionObserver = new MutationObserver(function(){
    var el = document.querySelector('.v106-version');
    if(el && el.textContent !== currentAppVersion()) el.textContent = currentAppVersion();
  });
  versionObserver.observe(document.documentElement, {subtree:true, childList:true});
  syncVersionLabel();

  function installHistoryFilter(cfg){
    var stateObj = cfg.state;
    if(!stateObj || !Array.isArray(stateObj.records)) return null;

    return function(){
      var filterOpen = false;
      var sortOpen = false;
      var filters = {
        keyword:'',
        type:'',
        year:'',
        f1:'',
        f2:'',
        group:'',
        item:'',
        from:'',
        to:''
      };
      var sortMode = 'date_desc';

      function getRecords(){
        var rows = stateObj.records.slice();

        rows = rows.filter(function(r){
          if(filters.keyword){
            var hay = [
              r.date, r.type === 'in' ? '入庫' : '出庫', r.year,
              r[cfg.f1Key], r[cfg.f2Key], r[cfg.groupKey], r[cfg.itemKey],
              r.memo
            ].join(' ').toLowerCase();
            if(!hay.includes(filters.keyword.toLowerCase())) return false;
          }
          if(filters.type && r.type !== filters.type) return false;
          if(filters.year && String(r.year || '') !== filters.year) return false;
          if(filters.f1 && String(r[cfg.f1Key] || '') !== filters.f1) return false;
          if(filters.f2 && String(r[cfg.f2Key] || '') !== filters.f2) return false;
          if(filters.group && String(r[cfg.groupKey] || '') !== filters.group) return false;
          if(filters.item && String(r[cfg.itemKey] || '') !== filters.item) return false;
          if(filters.from && String(r.date || '') < filters.from) return false;
          if(filters.to && String(r.date || '') > filters.to) return false;
          return true;
        });

        rows.sort(function(a,b){
          var ad = String(a.date || ''), bd = String(b.date || '');
          var aq = Number(a.qty || 0), bq = Number(b.qty || 0);
          if(sortMode === 'date_asc') return ad.localeCompare(bd);
          if(sortMode === 'qty_desc') return bq - aq || bd.localeCompare(ad);
          if(sortMode === 'qty_asc') return aq - bq || bd.localeCompare(ad);
          return bd.localeCompare(ad);
        });
        return rows;
      }

      function values(key){
        return uniq(stateObj.records.map(function(r){ return r[key]; }));
      }

      function renderShell(){
        app.innerHTML =
          '<section class="card">' +
            '<div class="row" style="align-items:center;flex-wrap:wrap">' +
              '<h2 style="margin-right:auto">' + escapeHtml(cfg.title) + '</h2>' +
              '<span id="v1656Count" class="pill">表示：0件</span>' +
            '</div>' +

            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">' +
              '<button class="mini" id="v1656FilterBtn">🔍 フィルタ</button>' +
              '<button class="mini" id="v1656SortBtn">↕ ソート</button>' +
              '<button class="mini" id="v1656ClearBtn">条件クリア</button>' +
            '</div>' +

            '<div id="v1656FilterPanel" style="display:none;background:#f4f7fb;border-radius:12px;padding:12px;margin-bottom:10px">' +
              '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">' +
                '<label>キーワード<input id="v1656Keyword" class="search" style="margin:4px 0 0" placeholder="備考など"></label>' +
                '<label>入庫・出庫<select id="v1656Type"><option value="">すべて</option><option value="in">入庫</option><option value="out">出庫</option></select></label>' +
                '<label>生産年度<select id="v1656Year"></select></label>' +
                '<label>' + escapeHtml(cfg.f1Label) + '<select id="v1656F1"></select></label>' +
                '<label>' + escapeHtml(cfg.f2Label) + '<select id="v1656F2"></select></label>' +
                '<label>' + escapeHtml(cfg.groupLabel) + '<select id="v1656Group"></select></label>' +
                '<label>' + escapeHtml(cfg.itemLabel) + '<select id="v1656Item"></select></label>' +
                '<label>開始日<input id="v1656From" type="date"></label>' +
                '<label>終了日<input id="v1656To" type="date"></label>' +
              '</div>' +
            '</div>' +

            '<div id="v1656SortPanel" style="display:none;background:#f4f7fb;border-radius:12px;padding:12px;margin-bottom:10px">' +
              '<label>並び順<select id="v1656Sort">' +
                '<option value="date_desc">日付：新しい順</option>' +
                '<option value="date_asc">日付：古い順</option>' +
                '<option value="qty_desc">数量：多い順</option>' +
                '<option value="qty_asc">数量：少ない順</option>' +
              '</select></label>' +
            '</div>' +

            '<div class="tablewrap">' +
              '<table style="min-width:' + (cfg.minWidth || 1100) + 'px">' +
                '<thead><tr>' + cfg.headers.map(function(h){ return '<th>' + escapeHtml(h) + '</th>'; }).join('') + '</tr></thead>' +
                '<tbody id="v1656Body"></tbody>' +
              '</table>' +
            '</div>' +
            '<button class="btn secondary" id="v1656Back" style="margin-top:10px">戻る</button>' +
          '</section>';

        var $ = function(id){ return document.getElementById(id); };
        $('v1656Year').innerHTML = optionHtml(values('year'), filters.year, 'すべて');
        $('v1656F1').innerHTML = optionHtml(values(cfg.f1Key), filters.f1, 'すべて');
        $('v1656F2').innerHTML = optionHtml(values(cfg.f2Key), filters.f2, 'すべて');
        $('v1656Group').innerHTML = optionHtml(values(cfg.groupKey), filters.group, 'すべて');
        refreshItemOptions();

        $('v1656FilterBtn').onclick = function(){
          filterOpen = !filterOpen;
          $('v1656FilterPanel').style.display = filterOpen ? 'block' : 'none';
        };
        $('v1656SortBtn').onclick = function(){
          sortOpen = !sortOpen;
          $('v1656SortPanel').style.display = sortOpen ? 'block' : 'none';
        };
        $('v1656ClearBtn').onclick = function(){
          filters = {keyword:'',type:'',year:'',f1:'',f2:'',group:'',item:'',from:'',to:''};
          sortMode = 'date_desc';
          renderShell();
          renderRows();
        };
        $('v1656Back').onclick = cfg.backFn;

        $('v1656Keyword').oninput = function(){ filters.keyword = this.value.trim(); renderRows(); };
        $('v1656Type').onchange = function(){ filters.type = this.value; renderRows(); };
        $('v1656Year').onchange = function(){ filters.year = this.value; renderRows(); };
        $('v1656F1').onchange = function(){ filters.f1 = this.value; renderRows(); };
        $('v1656F2').onchange = function(){ filters.f2 = this.value; renderRows(); };
        $('v1656Group').onchange = function(){
          filters.group = this.value;
          filters.item = '';
          refreshItemOptions();
          renderRows();
        };
        $('v1656Item').onchange = function(){ filters.item = this.value; renderRows(); };
        $('v1656From').onchange = function(){ filters.from = this.value; renderRows(); };
        $('v1656To').onchange = function(){ filters.to = this.value; renderRows(); };
        $('v1656Sort').onchange = function(){ sortMode = this.value; renderRows(); };
      }

      function refreshItemOptions(){
        var el = document.getElementById('v1656Item');
        if(!el) return;
        var rows = stateObj.records.filter(function(r){
          return !filters.group || String(r[cfg.groupKey] || '') === filters.group;
        });
        el.innerHTML = optionHtml(uniq(rows.map(function(r){ return r[cfg.itemKey]; })), filters.item, 'すべて');
      }

      function renderRows(){
        var body = document.getElementById('v1656Body');
        var count = document.getElementById('v1656Count');
        if(!body || !count) return;

        var rows = getRecords();
        count.textContent = '表示：' + rows.length + '件';

        body.innerHTML = rows.map(function(r){
          return cfg.rowHtml(r);
        }).join('') || '<tr><td colspan="' + cfg.headers.length + '" class="empty">条件に一致する履歴はありません</td></tr>';

        body.onclick = function(e){
          var editId = e.target && e.target.dataset ? e.target.dataset.v1656Edit : '';
          var delId  = e.target && e.target.dataset ? e.target.dataset.v1656Del : '';

          if(editId){
            cfg.editFn(editId);
            return;
          }
          if(delId && confirm('この入出庫を削除しますか？')){
            stateObj.records = stateObj.records.filter(function(r){ return String(r.id) !== String(delId); });
            cfg.saveFn();
            renderRows();
          }
        };
      }

      renderShell();
      renderRows();
    };
  }

  // 釧路産昆布
  try{
    logs = installHistoryFilter({
      state: state,
      title: '釧路産昆布 入出庫履歴',
      f1Key:'coop', f1Label:'漁協',
      f2Key:'season', f2Label:'季節',
      groupKey:'group', groupLabel:'大分類',
      itemKey:'item', itemLabel:'細分類',
      headers:['日付','区分','生産年度','漁協','季節','大分類','細分類','数量','備考','操作'],
      minWidth:1100,
      rowHtml:function(r){
        return '<tr><td>'+escapeHtml(r.date)+'</td><td>'+(r.type==='in'?'入庫':'出庫')+'</td><td>'+
          escapeHtml(r.year || DEFAULT_YEAR)+'年産</td><td>'+escapeHtml(r.coop)+'</td><td>'+escapeHtml(r.season)+'</td><td>'+
          escapeHtml(r.group)+'</td><td>'+escapeHtml(r.item)+'</td><td>'+numberFmt(r.qty)+'</td><td>'+escapeHtml(r.memo || '')+
          '</td><td><div class="record-actions"><button class="mini" data-v1656-edit="'+escapeHtml(r.id)+'">修正</button>'+
          '<button class="mini danger" data-v1656-del="'+escapeHtml(r.id)+'">削除</button></div></td></tr>';
      },
      editFn:function(id){ form(null,id); },
      saveFn:function(){ save(); },
      backFn:function(){ home(); }
    });
    try { globalThis.logs = logs; } catch(_){}
  }catch(e){ console.warn('[v165.6] 釧路履歴パッチ:', e); }

  // 日高昆布
  try{
    hLogs = installHistoryFilter({
      state: hState,
      title: '日高昆布 入出庫履歴',
      f1Key:'location', f1Label:'産地',
      f2Key:'section', f2Label:'区分',
      groupKey:'section', groupLabel:'区分',
      itemKey:'grade', itemLabel:'等級',
      headers:['日付','区分','年度','産地','区分','等級','数量','備考','操作'],
      minWidth:1000,
      rowHtml:function(r){
        return '<tr><td>'+escapeHtml(r.date)+'</td><td>'+(r.type==='in'?'入庫':'出庫')+'</td><td>'+
          escapeHtml(r.year)+'</td><td>'+escapeHtml(r.location)+'</td><td>'+escapeHtml(r.section)+'</td><td>'+
          escapeHtml(r.grade)+'</td><td>'+numberFmt(r.qty)+'</td><td>'+escapeHtml(r.memo || '')+
          '</td><td><button class="mini" data-v1656-edit="'+escapeHtml(r.id)+'">修正</button> '+
          '<button class="mini danger" data-v1656-del="'+escapeHtml(r.id)+'">削除</button></td></tr>';
      },
      editFn:function(id){ hForm(null,id); },
      saveFn:function(){ hSave(); },
      backFn:function(){ hHome(); }
    });
    try { globalThis.hLogs = hLogs; } catch(_){}
  }catch(e){ console.warn('[v165.6] 日高履歴パッチ:', e); }

  // 根室産昆布
  try{
    nLogs = installHistoryFilter({
      state: nState,
      title: '根室産昆布 入出庫履歴',
      f1Key:'coop', f1Label:'漁協',
      f2Key:'season', f2Label:'季節',
      groupKey:'group', groupLabel:'分類',
      itemKey:'item', itemLabel:'細分類',
      headers:['日付','区分','年度','漁協','季節','分類','細分類','数量','備考','操作'],
      minWidth:1050,
      rowHtml:function(r){
        return '<tr><td>'+escapeHtml(r.date)+'</td><td>'+(r.type==='in'?'入庫':'出庫')+'</td><td>'+
          escapeHtml(r.year)+'</td><td>'+escapeHtml(r.coop)+'</td><td>'+escapeHtml(r.season)+'</td><td>'+
          escapeHtml(r.group)+'</td><td>'+escapeHtml(r.item)+'</td><td>'+numberFmt(r.qty)+'</td><td>'+escapeHtml(r.memo || '')+
          '</td><td><button class="mini" data-v1656-edit="'+escapeHtml(r.id)+'">修正</button> '+
          '<button class="mini danger" data-v1656-del="'+escapeHtml(r.id)+'">削除</button></td></tr>';
      },
      editFn:function(id){ nForm(null,id); },
      saveFn:function(){ nSave(); },
      backFn:function(){ nHome(); }
    });
    try { globalThis.nLogs = nLogs; } catch(_){}
  }catch(e){ console.warn('[v165.6] 根室履歴パッチ:', e); }

  // 釧路産棹前昆布
  try{
    smLogs = installHistoryFilter({
      state: smState,
      title: '釧路産棹前昆布 入出庫履歴',
      f1Key:'coop', f1Label:'漁協',
      f2Key:'season', f2Label:'区分',
      groupKey:'group', groupLabel:'分類',
      itemKey:'item', itemLabel:'等級',
      headers:['日付','区分','年度','漁協','区分','分類','等級','数量','備考','操作'],
      minWidth:1050,
      rowHtml:function(r){
        return '<tr><td>'+escapeHtml(r.date)+'</td><td>'+(r.type==='in'?'入庫':'出庫')+'</td><td>'+
          escapeHtml(r.year)+'</td><td>'+escapeHtml(r.coop)+'</td><td>'+escapeHtml(r.season)+'</td><td>'+
          escapeHtml(r.group)+'</td><td>'+escapeHtml(r.item)+'</td><td>'+numberFmt(r.qty)+'</td><td>'+escapeHtml(r.memo || '')+
          '</td><td><button class="mini" data-v1656-edit="'+escapeHtml(r.id)+'">修正</button> '+
          '<button class="mini danger" data-v1656-del="'+escapeHtml(r.id)+'">削除</button></td></tr>';
      },
      editFn:function(id){ smForm(null,id); },
      saveFn:function(){ smSave(); },
      backFn:function(){ smHome(); }
    });
    try { globalThis.smLogs = smLogs; } catch(_){}
  }catch(e){ console.warn('[v165.6] 棹前履歴パッチ:', e); }

  console.info('[KOMBU v165.6] history filter/sort + auto version ready');
})();
