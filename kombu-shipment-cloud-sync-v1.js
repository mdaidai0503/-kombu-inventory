/* =========================================================
   昆布在庫管理 出荷依頼→送り状照合用同期 v1.1
   ---------------------------------------------------------
   目的:
   - 4種類の出荷依頼を kombu_shipment_sync へ自動同期
   - 9月以降も送り状候補・自動照合に最新の出荷依頼を使う
   - 取消済みも status=cancelled として同期し候補から除外
   ========================================================= */
(function () {
  'use strict';

  const ENDPOINT =
    'https://crltrozxztivkyxtjjxv.supabase.co/functions/v1/kombu-shipment-sync';

  const REMATCH_ENDPOINT =
    'https://crltrozxztivkyxtjjxv.supabase.co/functions/v1/waybill-rematch-pending';

  const TOKEN_KEYS = [
    'kombu_sync_token_v1',
    'kombu_waybill_token_shared_v1'
  ];

  const STORES = [
    { key: 'kombu_local_only_v3', product: 'kushiro' },
    { key: 'kombu_hidaka_local_v1', product: 'hidaka' },
    { key: 'kombu_nemuro_local_v1', product: 'nemuro' },
    { key: 'kombu_kushiro_sanmae_local_v1', product: 'sanmae' }
  ];

  let running = false;
  let lastSignature = '';
  let retryTimer = null;

  function readToken() {
    for (const key of TOKEN_KEYS) {
      const value = String(localStorage.getItem(key) || '').trim();
      if (value) return value;
    }
    return '';
  }

  function readStore(key) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || 'null');
      return data && typeof data === 'object' ? data : null;
    } catch (_) {
      return null;
    }
  }

  function collectShipments() {
    const rows = [];

    for (const storeInfo of STORES) {
      const store = readStore(storeInfo.key);
      const shipments = Array.isArray(store && store.shipments)
        ? store.shipments
        : [];

      for (const shipment of shipments) {
        if (!shipment || !shipment.id) continue;
        rows.push({
          product: storeInfo.product,
          shipment: shipment
        });
      }
    }

    return rows;
  }

  function signatureOf(rows) {
    return rows
      .map(({ product, shipment }) => [
        product,
        shipment.id || '',
        shipment.status || '',
        shipment.shipDate || '',
        shipment.updatedAt || '',
        shipment.faxboxStatus || '',
        Array.isArray(shipment.lines)
          ? shipment.lines.map(x => `${x.qty || 0}:${x.year || ''}:${x.coop || x.location || ''}:${x.group || ''}:${x.item || x.grade || ''}`).join(',')
          : ''
      ].join('|'))
      .sort()
      .join('\n');
  }

  async function postOne(token, product, shipment) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kombu-sync-token': token
      },
      body: JSON.stringify({
        kombu_type: product,
        shipment: shipment
      })
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok || !data || data.ok !== true) {
      throw new Error(
        (data && data.error) ||
        `HTTP ${response.status}`
      );
    }

    return data;
  }


  async function rematchPending(token) {
    const response = await fetch(REMATCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kombu-sync-token': token
      },
      body: JSON.stringify({
        since: '2026-09-01T00:00:00+09:00',
        limit: 120
      })
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok || !data || data.ok !== true) {
      throw new Error(
        (data && data.error) ||
        `再照合 HTTP ${response.status}`
      );
    }

    console.info(
      `[KOMBU waybill rematch] ${data.processed || 0}件を再照合 / matched=${data.matched || 0} / 要確認=${data.needs_review || 0} / 不一致=${data.unmatched || 0}`
    );

    window.dispatchEvent(new CustomEvent('kombu:waybill-rematch-complete', {
      detail: data
    }));

    return data;
  }

  async function syncRows(rows, token) {
    const queue = rows.slice();
    const errors = [];
    let success = 0;
    const workers = [];
    const concurrency = Math.min(4, Math.max(1, queue.length));

    async function worker() {
      while (queue.length) {
        const row = queue.shift();
        if (!row) break;

        try {
          await postOne(token, row.product, row.shipment);
          success += 1;
        } catch (error) {
          errors.push({
            product: row.product,
            id: row.shipment && row.shipment.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }

    for (let i = 0; i < concurrency; i += 1) {
      workers.push(worker());
    }

    await Promise.all(workers);

    return { success, errors };
  }

  async function syncNow(force) {
    if (running) return;

    const token = readToken();
    if (!token) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => syncNow(true), 5000);
      return;
    }

    const rows = collectShipments();
    const signature = signatureOf(rows);

    if (!force && signature === lastSignature) return;

    running = true;

    try {
      const result = await syncRows(rows, token);

      if (result.errors.length === 0) {
        lastSignature = signature;
        console.info(
          `[KOMBU shipment sync] ${result.success}件を送り状照合用に同期しました。`
        );
        window.dispatchEvent(new CustomEvent('kombu:shipment-cloud-sync-complete', {
          detail: { count: result.success }
        }));

        // 出荷依頼の同期後、すでにGmailから取り込み済みで
        // 「要確認／不一致」になっている送り状を最新の出荷依頼で再照合。
        try {
          await rematchPending(token);
        } catch (error) {
          console.warn(
            '[KOMBU waybill rematch] 再照合に失敗しました。',
            error
          );
        }
      } else {
        console.warn(
          '[KOMBU shipment sync] 一部同期に失敗しました。',
          result.errors
        );
      }
    } finally {
      running = false;
    }
  }

  // 起動時は必ず全件同期。8月テスト状態から9月以降へ自動追従させる。
  setTimeout(() => syncNow(true), 1200);

  // 他端末から最新データを反映した直後にも同期。
  window.addEventListener('kombu:v160-ready', () => {
    setTimeout(() => syncNow(true), 800);
  });

  window.addEventListener('storage', (event) => {
    if (STORES.some(x => x.key === event.key)) {
      setTimeout(() => syncNow(false), 500);
    }
  });

  // 同一タブの保存は storage イベントが発火しないため定期確認。
  setInterval(() => syncNow(false), 15000);

  window.kombuSyncShipmentsForWaybill = function () {
    return syncNow(true);
  };

  window.kombuRematchPendingWaybills = async function () {
    const token = readToken();
    if (!token) throw new Error('同期トークンが見つかりません。');
    return rematchPending(token);
  };
})();
