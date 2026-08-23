/* =========================================================
   昆布在庫管理 共通出荷依頼 試作版 Step 1
   v160.7互換 / Prototype v0.2
   ---------------------------------------------------------
   目的:
   ・現行4系統の出荷処理は残したまま、新しい共通入力UIを試す
   ・PC: 横並び / iPhone: 1明細=1カード
   ・現在庫を表示
   ・下書き保存 / 内容確認まで
   ・「確定・在庫反映」はまだ接続しない
   ========================================================= */
(function () {
  'use strict';

  const VERSION = '0.2';
  const PROTO_KEY = 'kombu_common_shipment_proto_v1';

  const PRODUCTS = {
    kushiro: { label: '釧路産昆布' },
    hidaka:  { label: '日高昆布' },
    nemuro:  { label: '根室産昆布' },
    sanmae:  { label: '釧路産棹前昆布' }
  };

  let model = null;

  function uid() {
    if (crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return String(Date.now()) + '-' + Math.random().toString(36).slice(2);
  }

  function esc2(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) {
      return {
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      }[m];
    });
  }

  function today2() {
    return new Date().toLocaleDateString('sv-SE');
  }

  function uniq(arr) {
    return Array.from(new Set((arr || []).filter(function (x) {
      return String(x == null ? '' : x).trim() !== '';
    }).map(function (x) {
      return String(x).trim();
    })));
  }

  function safeArray(v) {
    return Array.isArray(v) ? v : [];
  }

  function getStore(product) {
    try {
      if (product === 'kushiro' && typeof state !== 'undefined') return state;
      if (product === 'hidaka' && typeof hState !== 'undefined') return hState;
      if (product === 'nemuro' && typeof nState !== 'undefined') return nState;
      if (product === 'sanmae' && typeof smState !== 'undefined') return smState;
    } catch (_) {}
    return { records: [], shipments: [] };
  }

  function allExistingLines(product) {
    const st = getStore(product);
    const fromShipments = safeArray(st.shipments).flatMap(function (s) {
      return safeArray(s.lines);
    });
    return safeArray(st.records).concat(fromShipments);
  }

  function fallbackYears() {
    try {
      if (typeof YEARS !== 'undefined' && Array.isArray(YEARS)) return YEARS.slice();
    } catch (_) {}
    return ['R3','R4','R5','R6','R7','R8','R9','R10'];
  }

  function groupItemsFromConstant(product) {
    try {
      let groups = null;
      if (product === 'kushiro' && typeof GROUPS !== 'undefined') groups = GROUPS;
      if (product === 'nemuro' && typeof N_GROUPS !== 'undefined') groups = N_GROUPS;
      if (product === 'sanmae' && typeof S_GROUPS !== 'undefined') groups = S_GROUPS;

      if (Array.isArray(groups)) {
        return groups.flatMap(function (g) {
          return safeArray(g.items).map(function (item) {
            return {
              group: String(g.name || ''),
              item: String(item || '')
            };
          });
        });
      }
    } catch (_) {}
    return [];
  }

  function choices(product, line) {
    const rows = allExistingLines(product);
    const years = uniq(
      fallbackYears().concat(rows.map(function (r) { return r.year; }))
    );

    if (product === 'hidaka') {
      let locations = uniq(rows.map(function (r) { return r.location; }));
      let sections = uniq(rows.map(function (r) { return r.section; }));
      let grades = uniq(rows.map(function (r) { return r.grade; }));

      try {
        if (typeof H_LOCATIONS !== 'undefined' && Array.isArray(H_LOCATIONS)) {
          locations = uniq(H_LOCATIONS.concat(locations));
        }
      } catch (_) {}

      return {
        years: years,
        dim1: locations,
        dim2: sections,
        dim3: grades,
        dim1Label: '産地',
        dim2Label: '区分',
        dim3Label: '等級'
      };
    }

    let coops = uniq(rows.map(function (r) { return r.coop || r.location; }));
    let seasons = uniq(rows.map(function (r) { return r.season; }));
    let pairs = groupItemsFromConstant(product);

    if (!pairs.length) {
      pairs = uniq(rows.map(function (r) {
        return [r.group || '', r.item || ''].join('\u0001');
      })).map(function (v) {
        const p = v.split('\u0001');
        return { group: p[0] || '', item: p[1] || '' };
      }).filter(function (x) {
        return x.group || x.item;
      });
    }

    try {
      if (product === 'kushiro') {
        if (typeof state !== 'undefined' && Array.isArray(state.coops)) {
          coops = uniq(state.coops.concat(coops));
        }
        if (typeof SEASONS !== 'undefined' && Array.isArray(SEASONS)) {
          seasons = uniq(SEASONS.concat(seasons));
        }
      }
      if (product === 'nemuro') {
        if (typeof N_COOPS !== 'undefined' && Array.isArray(N_COOPS)) {
          coops = uniq(N_COOPS.concat(coops));
        }
        if (typeof N_SEASONS !== 'undefined' && Array.isArray(N_SEASONS)) {
          seasons = uniq(N_SEASONS.concat(seasons));
        }
      }
      if (product === 'sanmae') {
        if (typeof S_COOPS !== 'undefined' && Array.isArray(S_COOPS)) {
          coops = uniq(S_COOPS.concat(coops));
        }
        if (typeof S_SEASONS !== 'undefined' && Array.isArray(S_SEASONS)) {
          seasons = uniq(S_SEASONS.concat(seasons));
        }
      }
    } catch (_) {}

    return {
      years: years,
      dim1: coops,
      dim2: seasons,
      pairs: pairs,
      dim1Label: '漁協',
      dim2Label: '区分',
      dim3Label: '分類'
    };
  }

  function defaultLine(product) {
    const c = choices(product, {});
    const line = {
      id: uid(),
      product: product,
      year: c.years[0] || 'R7',
      qty: '',
      memo: ''
    };

    if (product === 'hidaka') {
      line.location = c.dim1[0] || '';
      line.section = c.dim2[0] || '';
      line.grade = c.dim3[0] || '';
    } else {
      line.coop = c.dim1[0] || '';
      line.season = c.dim2[0] || '';
      line.group = c.pairs && c.pairs[0] ? c.pairs[0].group : '';
      line.item = c.pairs && c.pairs[0] ? c.pairs[0].item : '';
    }
    return line;
  }

  function newModel() {
    return {
      protoVersion: VERSION,
      id: 'P' + String(Date.now()).slice(-8),
      status: 'draft',
      shipDate: today2(),
      arrivalDate: '',
      source: { name: '', address: '', phone: '' },
      dest: { name: '', address: '', phone: '' },
      memo: '',
      lines: [defaultLine('kushiro')],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function loadDraft() {
    try {
      const v = JSON.parse(localStorage.getItem(PROTO_KEY) || 'null');
      if (v && typeof v === 'object' && Array.isArray(v.lines)) return v;
    } catch (_) {}
    return null;
  }

  function saveDraft(showMessage) {
    model.updatedAt = new Date().toISOString();
    localStorage.setItem(PROTO_KEY, JSON.stringify(model));
    if (showMessage) alert('試作版の下書きを保存しました。\n在庫は変更していません。');
  }

  function optionHtml(values, selected) {
    return safeArray(values).map(function (v) {
      return '<option value="' + esc2(v) + '" ' +
        (String(v) === String(selected) ? 'selected' : '') +
        '>' + esc2(v) + '</option>';
    }).join('');
  }

  function pairOptionHtml(pairs, line) {
    return safeArray(pairs).map(function (p) {
      const value = String(p.group || '') + '\u0001' + String(p.item || '');
      const selected = String(p.group || '') === String(line.group || '') &&
                       String(p.item || '') === String(line.item || '');
      const label = [p.group, p.item].filter(Boolean).join(' / ');
      return '<option value="' + esc2(value) + '" ' + (selected ? 'selected' : '') + '>' +
        esc2(label || '未設定') + '</option>';
    }).join('');
  }

  function availableQty(line) {
    try {
      if (line.product === 'kushiro' && typeof stockAvailableForShipment === 'function') {
        return Number(stockAvailableForShipment(
          line.year, line.coop, line.season, line.group, line.item, null
        ));
      }
      if (line.product === 'hidaka' && typeof hAvail === 'function') {
        return Number(hAvail(
          line.year, line.location, line.section, line.grade, null
        ));
      }
      if (line.product === 'nemuro' && typeof nAvail === 'function') {
        return Number(nAvail(
          line.year, line.coop, line.season, line.group, line.item, null
        ));
      }
      if (line.product === 'sanmae' && typeof smAvail === 'function') {
        return Number(smAvail(
          line.year, line.coop, line.season, line.group, line.item, null
        ));
      }
    } catch (e) {
      console.warn('[COMMON SHIPMENT PROTO] 在庫取得失敗', e);
    }
    return null;
  }

  function lineTitle(line) {
    const p = PRODUCTS[line.product] || PRODUCTS.kushiro;
    return p.label;
  }

  function lineDescription(line) {
    if (line.product === 'hidaka') {
      return [line.year, line.location, line.section, line.grade]
        .filter(Boolean).join(' / ');
    }
    return [line.year, line.coop, line.season, line.group, line.item]
      .filter(Boolean).join(' / ');
  }

  function totalQty() {
    return safeArray(model.lines).reduce(function (sum, l) {
      return sum + Number(l.qty || 0);
    }, 0);
  }

  function ensureStyles() {
    if (document.getElementById('v161ProtoStyle')) return;

    const style = document.createElement('style');
    style.id = 'v161ProtoStyle';
    style.textContent = `
      .v161-proto{max-width:1180px;margin:0 auto}
      .v161-head{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}
      .v161-status{background:#fff4d6;color:#7a4b00;border-radius:99px;padding:6px 10px;font-weight:800;font-size:12px}
      .v161-section-title{font-size:17px;font-weight:800;margin:0 0 12px}
      .v161-basic-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .v161-party-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .v161-party{background:#f7f9fc;border:1px solid #d9e2ec;border-radius:14px;padding:12px}
      .v161-party label{display:block;margin-bottom:9px;font-weight:700}
      .v161-party input,.v161-basic-grid input,.v161-memo{
        width:100%;padding:11px;border:1px solid #ccd6e2;border-radius:10px;background:#fff;font-size:16px;margin-top:4px
      }
      .v161-lines-head{display:grid;grid-template-columns:1.25fr .7fr 1fr .9fr 1.4fr .65fr .7fr 54px;gap:7px;padding:0 9px 7px;font-size:12px;font-weight:800;color:#52667a}
      .v161-line{display:grid;grid-template-columns:1.25fr .7fr 1fr .9fr 1.4fr .65fr .7fr 54px;gap:7px;align-items:end;background:#f7f9fc;border:1px solid #d9e2ec;border-radius:14px;padding:10px;margin-bottom:9px}
      .v161-line label{font-size:11px;color:#52667a;font-weight:800}
      .v161-line select,.v161-line input{width:100%;padding:10px 7px;border:1px solid #ccd6e2;border-radius:9px;background:#fff;font-size:14px;margin-top:4px}
      .v161-stock{min-height:41px;display:flex;align-items:center;font-size:17px;font-weight:900;padding:0 4px}
      .v161-stock.bad{color:#b42318}
      .v161-del{border:0;border-radius:9px;background:#fee4e2;color:#b42318;height:41px;font-size:18px;font-weight:900}
      .v161-summary{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:10px}
      .v161-total{font-size:18px;font-weight:900}
      .v161-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .v161-preview-item{border:1px solid #d9e2ec;background:#f7f9fc;border-radius:13px;padding:12px;margin-bottom:9px}
      .v161-warning{color:#b42318;font-weight:800;margin-top:6px}
      .v161-proto-tag{font-size:12px;color:#627d98}
      @media(max-width:699px){
        .v161-basic-grid,.v161-party-grid,.v161-actions{grid-template-columns:1fr}
        .v161-lines-head{display:none}
        .v161-line{grid-template-columns:1fr 1fr}
        .v161-line>label:first-child{grid-column:1/-1}
        .v161-line .v161-wide{grid-column:1/-1}
        .v161-stock{background:#fff;border:1px solid #ccd6e2;border-radius:9px;padding:10px}
        .v161-del{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  function productSelect(line) {
    return Object.keys(PRODUCTS).map(function (key) {
      return '<option value="' + key + '" ' + (line.product === key ? 'selected' : '') + '>' +
        esc2(PRODUCTS[key].label) + '</option>';
    }).join('');
  }

  function renderLine(line, index) {
    const c = choices(line.product, line);
    const avail = availableQty(line);
    const qty = Number(line.qty || 0);
    const over = avail != null && qty > avail;

    let dims = '';

    if (line.product === 'hidaka') {
      dims = `
        <label>${esc2(c.dim1Label)}
          <select data-line="${index}" data-field="location">${optionHtml(c.dim1, line.location)}</select>
        </label>
        <label>${esc2(c.dim2Label)}
          <select data-line="${index}" data-field="section">${optionHtml(c.dim2, line.section)}</select>
        </label>
        <label class="v161-wide">${esc2(c.dim3Label)}
          <select data-line="${index}" data-field="grade">${optionHtml(c.dim3, line.grade)}</select>
        </label>`;
    } else {
      dims = `
        <label>${esc2(c.dim1Label)}
          <select data-line="${index}" data-field="coop">${optionHtml(c.dim1, line.coop)}</select>
        </label>
        <label>${esc2(c.dim2Label)}
          <select data-line="${index}" data-field="season">${optionHtml(c.dim2, line.season)}</select>
        </label>
        <label class="v161-wide">${esc2(c.dim3Label)}
          <select data-line="${index}" data-field="pair">${pairOptionHtml(c.pairs, line)}</select>
        </label>`;
    }

    return `
      <div class="v161-line" data-line-row="${index}">
        <label class="v161-wide">昆布種類
          <select data-line="${index}" data-field="product">${productSelect(line)}</select>
        </label>
        <label>年産
          <select data-line="${index}" data-field="year">${optionHtml(c.years, line.year)}</select>
        </label>
        ${dims}
        <label>現在庫
          <div class="v161-stock ${over ? 'bad' : ''}">${avail == null ? '—' : Number(avail).toLocaleString('ja-JP')}</div>
        </label>
        <label>数量
          <input data-line="${index}" data-field="qty" type="number" min="0" step="1" inputmode="numeric" value="${esc2(line.qty)}">
          ${over ? '<div class="v161-warning">在庫不足</div>' : ''}
        </label>
        <button type="button" class="v161-del" data-delete="${index}" title="明細削除">🗑</button>
      </div>`;
  }

  function bindModelField(id, getter, setter) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = getter() || '';
    el.oninput = function () { setter(el.value); };
    el.onchange = function () { setter(el.value); };
  }

  function showPrototype() {
    ensureStyles();

    if (!model) model = loadDraft() || newModel();

    try {
      if (typeof setHeader === 'function') setHeader('新規出荷依頼（試作）');
      if (typeof setNavVisible === 'function') setNavVisible(true);
      if (typeof bindNav === 'function') bindNav();
    } catch (_) {}

    const appEl = document.getElementById('app');
    if (!appEl) return;

    appEl.innerHTML = `
      <div class="v161-proto">
        <section class="card">
          <div class="v161-head">
            <div>
              <h2 style="margin:0">📦 新規出荷依頼</h2>
              <div class="v161-proto-tag">共通出荷依頼 試作版 v${VERSION} / No. ${esc2(model.id)}</div>
            </div>
            <span class="v161-status">📝 下書き</span>
          </div>
          <div class="note" style="margin-top:12px">試作版です。下書き保存と内容確認のみ動作します。現在庫は表示しますが、在庫の増減は行いません。</div>
        </section>

        <section class="card">
          <h3 class="v161-section-title">① 日程</h3>
          <div class="v161-basic-grid">
            <label>出荷日<input id="v161ShipDate" type="date"></label>
            <label>希望着日<input id="v161ArrivalDate" type="date"></label>
          </div>
        </section>

        <section class="card">
          <h3 class="v161-section-title">② 出荷元・出荷先</h3>
          <div class="v161-party-grid">
            <div class="v161-party">
              <b>出荷元</b>
              <label>会社名<input id="v161SrcName" type="text"></label>
              <label>住所<input id="v161SrcAddress" type="text"></label>
              <label>電話<input id="v161SrcPhone" type="tel"></label>
            </div>
            <div class="v161-party">
              <b>出荷先</b>
              <label>会社名<input id="v161DstName" type="text"></label>
              <label>住所<input id="v161DstAddress" type="text"></label>
              <label>電話<input id="v161DstPhone" type="tel"></label>
            </div>
          </div>
        </section>

        <section class="card">
          <h3 class="v161-section-title">③ 出荷明細</h3>
          <div class="v161-lines-head">
            <span>昆布種類</span><span>年産</span><span>漁協/産地</span><span>区分</span>
            <span>等級/分類</span><span>現在庫</span><span>数量</span><span></span>
          </div>
          <div id="v161Lines">${model.lines.map(renderLine).join('')}</div>
          <div class="v161-summary">
            <button type="button" class="btn secondary" id="v161AddLine" style="width:auto">＋ 明細を追加</button>
            <div class="v161-total">合計数量：<span id="v161Total">${totalQty().toLocaleString('ja-JP')}</span></div>
          </div>
        </section>

        <section class="card">
          <h3 class="v161-section-title">④ 備考</h3>
          <textarea id="v161Memo" class="v161-memo" rows="4"></textarea>
        </section>

        <section class="card">
          <div class="v161-actions">
            <button type="button" class="btn secondary" id="v161Save">💾 下書き保存</button>
            <button type="button" class="btn" id="v161Preview">👁 内容確認へ</button>
          </div>
          <button type="button" class="btn secondary" id="v161BackOld" style="margin-top:10px">← 現行の出荷依頼へ戻る</button>
        </section>
      </div>`;

    bindModelField('v161ShipDate', function(){ return model.shipDate; }, function(v){ model.shipDate = v; });
    bindModelField('v161ArrivalDate', function(){ return model.arrivalDate; }, function(v){ model.arrivalDate = v; });
    bindModelField('v161SrcName', function(){ return model.source.name; }, function(v){ model.source.name = v; });
    bindModelField('v161SrcAddress', function(){ return model.source.address; }, function(v){ model.source.address = v; });
    bindModelField('v161SrcPhone', function(){ return model.source.phone; }, function(v){ model.source.phone = v; });
    bindModelField('v161DstName', function(){ return model.dest.name; }, function(v){ model.dest.name = v; });
    bindModelField('v161DstAddress', function(){ return model.dest.address; }, function(v){ model.dest.address = v; });
    bindModelField('v161DstPhone', function(){ return model.dest.phone; }, function(v){ model.dest.phone = v; });
    bindModelField('v161Memo', function(){ return model.memo; }, function(v){ model.memo = v; });

    document.querySelectorAll('[data-line][data-field]').forEach(function (el) {
      const idx = Number(el.dataset.line);
      const field = el.dataset.field;

      const handler = function () {
        const line = model.lines[idx];
        if (!line) return;

        if (field === 'product') {
          model.lines[idx] = defaultLine(el.value);
          renderLinesOnly();
          return;
        }

        if (field === 'pair') {
          const pair = String(el.value || '').split('\u0001');
          line.group = pair[0] || '';
          line.item = pair[1] || '';
        } else if (field === 'qty') {
          line.qty = el.value;
        } else {
          line[field] = el.value;
        }

        renderLinesOnly();
      };

      el.onchange = handler;
      if (field === 'qty') el.oninput = handler;
    });

    document.querySelectorAll('[data-delete]').forEach(function (b) {
      b.onclick = function () {
        const idx = Number(b.dataset.delete);
        if (model.lines.length <= 1) {
          alert('明細は1件以上必要です。');
          return;
        }
        model.lines.splice(idx, 1);
        renderLinesOnly();
      };
    });

    document.getElementById('v161AddLine').onclick = function () {
      model.lines.push(defaultLine('kushiro'));
      renderLinesOnly();
    };

    document.getElementById('v161Save').onclick = function () {
      saveDraft(true);
    };

    document.getElementById('v161Preview').onclick = function () {
      saveDraft(false);
      showPreview();
    };

    document.getElementById('v161BackOld').onclick = function () {
      if (typeof window.v76ShipmentMenu === 'function') {
        window.v76ShipmentMenu();
      } else if (typeof window.productChoicePage === 'function') {
        window.productChoicePage('shipment');
      }
    };
  }

  function renderLinesOnly() {
    const wrap = document.getElementById('v161Lines');
    if (!wrap) return showPrototype();

    wrap.innerHTML = model.lines.map(renderLine).join('');

    const totalEl = document.getElementById('v161Total');
    if (totalEl) totalEl.textContent = totalQty().toLocaleString('ja-JP');

    document.querySelectorAll('[data-line][data-field]').forEach(function (el) {
      const idx = Number(el.dataset.line);
      const field = el.dataset.field;

      const handler = function () {
        const line = model.lines[idx];
        if (!line) return;

        if (field === 'product') {
          model.lines[idx] = defaultLine(el.value);
          return renderLinesOnly();
        }

        if (field === 'pair') {
          const pair = String(el.value || '').split('\u0001');
          line.group = pair[0] || '';
          line.item = pair[1] || '';
        } else if (field === 'qty') {
          line.qty = el.value;
        } else {
          line[field] = el.value;
        }

        renderLinesOnly();
      };

      el.onchange = handler;
      if (field === 'qty') el.oninput = handler;
    });

    document.querySelectorAll('[data-delete]').forEach(function (b) {
      b.onclick = function () {
        const idx = Number(b.dataset.delete);
        if (model.lines.length <= 1) {
          alert('明細は1件以上必要です。');
          return;
        }
        model.lines.splice(idx, 1);
        renderLinesOnly();
      };
    });
  }

  function validateForPreview() {
    const errors = [];

    if (!String(model.source.name || '').trim()) errors.push('出荷元会社名');
    if (!String(model.dest.name || '').trim()) errors.push('出荷先会社名');
    if (!model.shipDate) errors.push('出荷日');

    safeArray(model.lines).forEach(function (line, i) {
      if (!(Number(line.qty || 0) > 0)) {
        errors.push('明細' + (i + 1) + 'の数量');
      }
      const avail = availableQty(line);
      if (avail != null && Number(line.qty || 0) > avail) {
        errors.push('明細' + (i + 1) + 'は在庫不足');
      }
    });

    return errors;
  }

  function showPreview() {
    ensureStyles();

    const errors = validateForPreview();
    if (errors.length) {
      alert('確認してください。\n\n・' + errors.join('\n・'));
      return;
    }

    try {
      if (typeof setHeader === 'function') setHeader('出荷依頼 内容確認（試作）');
    } catch (_) {}

    const appEl = document.getElementById('app');

    appEl.innerHTML = `
      <div class="v161-proto">
        <section class="card">
          <div class="v161-head">
            <div>
              <h2 style="margin:0">👁 出荷依頼 内容確認</h2>
              <div class="v161-proto-tag">No. ${esc2(model.id)} / 試作版 v${VERSION}</div>
            </div>
            <span class="v161-status">📝 下書き</span>
          </div>
        </section>

        <section class="card">
          <h3 class="v161-section-title">日程</h3>
          <p><b>出荷日：</b>${esc2(model.shipDate || '')}</p>
          <p><b>希望着日：</b>${esc2(model.arrivalDate || '未指定')}</p>
        </section>

        <section class="card">
          <div class="v161-party-grid">
            <div class="v161-party">
              <b>出荷元</b><br>
              ${esc2(model.source.name)}<br>
              <span class="small">${esc2(model.source.address)} ${model.source.phone ? '／ TEL ' + esc2(model.source.phone) : ''}</span>
            </div>
            <div class="v161-party">
              <b>出荷先</b><br>
              ${esc2(model.dest.name)}<br>
              <span class="small">${esc2(model.dest.address)} ${model.dest.phone ? '／ TEL ' + esc2(model.dest.phone) : ''}</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h3 class="v161-section-title">出荷明細</h3>
          ${model.lines.map(function (line, i) {
            const avail = availableQty(line);
            return `
              <div class="v161-preview-item">
                <b>${i + 1}. ${esc2(lineTitle(line))}</b><br>
                ${esc2(lineDescription(line))}<br>
                <b>数量：</b>${Number(line.qty || 0).toLocaleString('ja-JP')}
                <span class="muted">　現在庫：${avail == null ? '—' : Number(avail).toLocaleString('ja-JP')}</span>
              </div>`;
          }).join('')}
          <div class="v161-total">合計数量：${totalQty().toLocaleString('ja-JP')}</div>
        </section>

        <section class="card">
          <h3 class="v161-section-title">備考</h3>
          <div>${esc2(model.memo || 'なし')}</div>
        </section>

        <section class="card">
          <div class="v161-actions">
            <button class="btn secondary" id="v161Edit">← 修正する</button>
            <button class="btn" id="v161ConfirmDemo" disabled style="opacity:.55">✅ 確定・在庫反映</button>
          </div>
          <div class="note" style="margin-top:10px">Step 1では「確定・在庫反映」は未接続です。画面・操作性の確認後、Step 2で安全に接続します。</div>
        </section>
      </div>`;

    document.getElementById('v161Edit').onclick = showPrototype;
  }

  function installPrototypeEntryButton() {
    const appEl = document.getElementById('app');
    if (!appEl) return false;
    if (document.getElementById('v161PrototypeEntry')) return true;

    const btn = document.createElement('button');
    btn.id = 'v161PrototypeEntry';
    btn.className = 'btn';
    btn.type = 'button';
    btn.style.marginTop = '10px';
    btn.textContent = '🧪 新しい共通出荷依頼（試作）';
    btn.onclick = function () {
      model = loadDraft() || newModel();
      showPrototype();
    };

    const card = appEl.querySelector('.card');
    if (!card) return false;
    card.appendChild(btn);
    return true;
  }

  // v0.2は起動時に既存関数を書き換えない・画面監視しない。
  // 明示的に呼ばれたときだけ試作画面を開く。
  window.v161ShipmentPrototype = function () {
    model = loadDraft() || newModel();
    showPrototype();
  };

  // 現在表示中の画面へ入口ボタンだけを明示的に追加する。
  window.v161InstallPrototypeButton = installPrototypeEntryButton;

  window.v161ClearShipmentPrototypeDraft = function () {
    localStorage.removeItem(PROTO_KEY);
    model = null;
    console.info('[COMMON SHIPMENT PROTO] 試作下書きを削除しました');
  };

  console.info('[COMMON SHIPMENT PROTO v0.2] standby');

})();
