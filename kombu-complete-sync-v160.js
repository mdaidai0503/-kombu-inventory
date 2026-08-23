/* =========================================================
   昆布在庫管理 完全同期ブリッジ v160.0
   Supabase = 正本 / localStorage = 互換キャッシュ
   ---------------------------------------------------------
   Step 3A:
   ・PC/iPhoneの初回ローカルテストデータを自動初期化
   ・Supabase inventory / movements / shipments / masters を取得
   ・Supabase Realtime変更時に全端末を再読込
   ・既存v159を壊さないためlocalStorageは画面互換キャッシュとして残す
   ========================================================= */

(function () {
  'use strict';

  const MIGRATION_KEY = 'kombu_v160_local_reset_done';
  const TOKEN_KEY = 'kombu_sync_token_v1';

  const PRODUCT_KEYS = {
    kushiro: 'kombu_local_only_v3',
    hidaka: 'kombu_hidaka_local_v1',
    nemuro: 'kombu_nemuro_local_v1',
    sanmae: 'kombu_kushiro_sanmae_local_v1'
  };

  const TABLES = [
    'kombu_inventory',
    'kombu_stock_movements',
    'kombu_company_master',
    'kombu_union_master',
    'kombu_shipping_party_master',
    'kombu_shipments',
    'kombu_shipment_items',
    'kombu_fax_history'
  ];

  let started = false;
  let channel = null;
  let refreshTimer = null;

  function client() {
    return window.kombuSupabase || null;
  }

  function localResetOnce() {
    if (localStorage.getItem(MIGRATION_KEY) === '1') return;

    const keep = new Set([TOKEN_KEY]);

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || keep.has(key)) continue;

      if (
        key.startsWith('kombu_') ||
        key.startsWith('inventory') ||
        key.startsWith('shipment') ||
        key.startsWith('faxbox') ||
        key.startsWith('order')
      ) {
        localStorage.removeItem(key);
      }
    }

    localStorage.setItem(MIGRATION_KEY, '1');
    console.info('[KOMBU v160] 初回ローカル初期化完了');
  }

  function yearText(n) {
    return 'R' + Number(n || 0);
  }

  function emptyProductState(productCode) {
    return {
      version: 160,
      syncMode: 'supabase',
      productCode: productCode,
      inventory: [],
      logs: [],
      shipments: [],
      companyMaster: [],
      shippingPartyMaster: [],
      unionMaster: [],
      faxHistory: [],
      syncedAt: new Date().toISOString()
    };
  }

  function writeCompatCache(productCode, all) {
    const key = PRODUCT_KEYS[productCode];
    if (!key) return;

    const state = emptyProductState(productCode);

    state.inventory = (all.inventory || [])
      .filter(x => x.product_code === productCode)
      .map(x => ({
        id: x.id,
        year: yearText(x.production_year),
        productionYear: yearText(x.production_year),
        union: x.union_name,
        unionName: x.union_name,
        category: x.category,
        grade: x.grade,
        quantity: Number(x.quantity || 0),
        revision: x.revision,
        updatedAt: x.updated_at
      }));

    state.logs = (all.movements || [])
      .filter(x => x.product_code === productCode)
      .map(x => ({
        id: x.id,
        year: yearText(x.production_year),
        productionYear: yearText(x.production_year),
        union: x.union_name,
        unionName: x.union_name,
        category: x.category,
        grade: x.grade,
        type: x.movement_type,
        quantity: Number(x.quantity || 0),
        date: x.movement_date,
        note: x.note || '',
        createdAt: x.created_at
      }));

    const shipmentIds = new Set();
    (all.items || []).forEach(item => {
      if (item.product_code === productCode) {
        shipmentIds.add(item.shipment_id);
      }
    });

    state.shipments = (all.shipments || [])
      .filter(x => shipmentIds.has(x.id))
      .map(sh => {
        const items = (all.items || [])
          .filter(i => i.shipment_id === sh.id)
          .map(i => ({
            id: i.id,
            lineNo: i.line_no,
            productCode: i.product_code,
            productionYear: yearText(i.production_year),
            union: i.union_name,
            category: i.category,
            grade: i.grade,
            quantity: Number(i.quantity || 0)
          }));

        return {
          id: sh.app_shipment_id,
          supabaseId: sh.id,
          shipDate: sh.ship_date,
          desiredArrivalDate: sh.desired_arrival_date,
          sourceName: sh.source_name || '',
          destinationName: sh.destination_name || '',
          status: sh.status,
          faxDone: !!sh.fax_done,
          slipDone: !!sh.slip_done,
          note: sh.note || '',
          items: items,
          updatedAt: sh.updated_at
        };
      });

    state.companyMaster = all.companies || [];
    state.shippingPartyMaster = all.parties || [];
    state.unionMaster = (all.unions || [])
      .filter(x => x.product_code === productCode);
    state.faxHistory = all.faxes || [];

    localStorage.setItem(key, JSON.stringify(state));
  }

  async function selectAll(table, columns) {
    const c = client();
    const result = await c
      .from(table)
      .select(columns || '*');

    if (result.error) throw result.error;
    return result.data || [];
  }

  async function refreshFromSupabase() {
    const c = client();
    if (!c) return;

    const sessionResult = await c.auth.getSession();
    if (!sessionResult?.data?.session) return;

    try {
      const [
        inventory,
        movements,
        companies,
        unions,
        parties,
        shipments,
        items,
        faxes
      ] = await Promise.all([
        selectAll('kombu_inventory'),
        selectAll('kombu_stock_movements'),
        selectAll('kombu_company_master'),
        selectAll('kombu_union_master'),
        selectAll('kombu_shipping_party_master'),
        selectAll('kombu_shipments'),
        selectAll('kombu_shipment_items'),
        selectAll('kombu_fax_history')
      ]);

      const all = {
        inventory, movements, companies, unions,
        parties, shipments, items, faxes
      };

      Object.keys(PRODUCT_KEYS).forEach(code => {
        writeCompatCache(code, all);
      });

      window.dispatchEvent(new CustomEvent(
        'kombu:v160-synced',
        { detail: { syncedAt: new Date().toISOString() } }
      ));

      console.info('[KOMBU v160] Supabase → 端末同期完了');

    } catch (error) {
      console.error('[KOMBU v160] 読込同期失敗', error);
      window.dispatchEvent(new CustomEvent(
        'kombu:v160-sync-error',
        { detail: { error: String(error?.message || error) } }
      ));
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshFromSupabase, 350);
  }

  function subscribeRealtime() {
    const c = client();
    if (!c || channel) return;

    channel = c.channel('kombu-v160-complete-sync');

    TABLES.forEach(table => {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table
        },
        scheduleRefresh
      );
    });

    channel.subscribe(status => {
      console.info('[KOMBU v160] Realtime:', status);
    });
  }

  async function start() {
    if (started) return;
    started = true;

    localResetOnce();
    await refreshFromSupabase();
    subscribeRealtime();

    // iPhone PWAをバックグラウンドから戻した時も最新化
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) scheduleRefresh();
    });

    window.addEventListener('focus', scheduleRefresh);
  }

  window.kombuV160SyncNow = refreshFromSupabase;

  window.addEventListener('kombu:supabase-login', start);

  window.addEventListener('load', function () {
    setTimeout(async function () {
      const c = client();
      if (!c) return;

      const r = await c.auth.getSession();
      if (r?.data?.session) start();
    }, 900);
  });

})();
