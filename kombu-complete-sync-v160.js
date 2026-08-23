/* =========================================================
   昆布在庫管理 完全同期 v160.4
   Supabase = 正本 / localStorage = 互換キャッシュ
   ---------------------------------------------------------
   ・アプリ本体を起動する前にSupabaseの最新状態を取得
   ・PC / iPhone の保存をSupabaseへ即時同期
   ・Realtimeで別端末変更を受信
   ・入力中の強制リロードはしない
   ・別端末変更時は「最新データを反映」通知を表示
   ========================================================= */

(function () {
  'use strict';

  const TABLE = 'kombu_app_state';
  const MIGRATION_KEY = 'kombu_v1604_complete_sync_ready';

  const DO_NOT_SYNC = new Set([
    'kombu_sync_token_v1',
    'kombu_v160_local_reset_done',
    'kombu_v1601_complete_sync_ready',
    'kombu_v1602_complete_sync_ready',
    'kombu_v1603_complete_sync_ready',
    MIGRATION_KEY
  ]);

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  let applyingRemote = false;
  let started = false;
  let startPromise = null;
  let channel = null;
  let pending = new Map();
  let flushTimer = null;
  let remoteDirty = false;

  const recentLocalWrites = new Map();

  function client() {
    return window.kombuSupabase || null;
  }

  function shouldSyncKey(key) {
    if (!key || DO_NOT_SYNC.has(key)) return false;

    const k = String(key).toLowerCase();

    return (
      k.startsWith('kombu_') ||
      k.startsWith('inventory') ||
      k.startsWith('shipment') ||
      k.startsWith('faxbox') ||
      k.startsWith('order') ||
      k.startsWith('backup') ||
      k.startsWith('company') ||
      k.startsWith('master')
    );
  }

  function parseJson(raw) {
    if (raw == null) return null;

    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  async function getSession() {
    const c = client();
    if (!c) return null;

    const result = await c.auth.getSession();

    return result &&
      result.data &&
      result.data.session
        ? result.data.session
        : null;
  }

  function markOwnWrite(key, rawValue) {
    recentLocalWrites.set(key, {
      rawValue: rawValue,
      at: Date.now()
    });
  }

  function isOwnRecentRealtime(key, rawValue) {
    const hit = recentLocalWrites.get(key);

    if (!hit) return false;

    const fresh = (Date.now() - hit.at) < 12000;
    const same = hit.rawValue === rawValue;

    if (!fresh) {
      recentLocalWrites.delete(key);
      return false;
    }

    if (same) {
      recentLocalWrites.delete(key);
      return true;
    }

    return false;
  }

  async function pushOne(key, rawValue) {
    const c = client();
    if (!c) return;

    const session = await getSession();
    if (!session) return;

    markOwnWrite(key, rawValue);

    if (rawValue == null) {
      const result = await c
        .from(TABLE)
        .delete()
        .eq('storage_key', key);

      if (result.error) throw result.error;
      return;
    }

    const result = await c
      .from(TABLE)
      .upsert({
        storage_key: key,
        raw_value: rawValue,
        payload: parseJson(rawValue),
        updated_by: session.user.id
      }, {
        onConflict: 'storage_key'
      });

    if (result.error) throw result.error;
  }

  async function flushPending() {
    clearTimeout(flushTimer);

    const work = Array.from(pending.entries());
    pending.clear();

    for (const pair of work) {
      const key = pair[0];
      const rawValue = pair[1];

      try {
        await pushOne(key, rawValue);

        console.info(
          '[KOMBU v160.4] Supabase保存:',
          key
        );

      } catch (error) {
        console.error(
          '[KOMBU v160.4] Supabase保存失敗:',
          key,
          error
        );

        pending.set(key, rawValue);
      }
    }

    if (pending.size) {
      flushTimer = setTimeout(
        flushPending,
        3000
      );
    }
  }

  function queuePush(key, rawValue) {
    if (!shouldSyncKey(key)) return;

    pending.set(key, rawValue);

    clearTimeout(flushTimer);

    flushTimer = setTimeout(
      flushPending,
      250
    );
  }

  function installStorageHooks() {
    Storage.prototype.setItem =
      function (key, value) {
        originalSetItem.call(
          this,
          key,
          value
        );

        if (
          this === localStorage &&
          !applyingRemote &&
          shouldSyncKey(key)
        ) {
          queuePush(
            String(key),
            String(value)
          );
        }
      };

    Storage.prototype.removeItem =
      function (key) {
        originalRemoveItem.call(
          this,
          key
        );

        if (
          this === localStorage &&
          !applyingRemote &&
          shouldSyncKey(key)
        ) {
          queuePush(
            String(key),
            null
          );
        }
      };
  }

  function applyRow(row) {
    if (!row || !row.storage_key) return;
    if (!shouldSyncKey(row.storage_key)) return;

    applyingRemote = true;

    try {
      originalSetItem.call(
        localStorage,
        row.storage_key,
        row.raw_value
      );
    } finally {
      applyingRemote = false;
    }
  }

  function removeRemoteKey(key) {
    if (!shouldSyncKey(key)) return;

    applyingRemote = true;

    try {
      originalRemoveItem.call(
        localStorage,
        key
      );
    } finally {
      applyingRemote = false;
    }
  }

  async function pullAll() {
    const c = client();

    if (!c) {
      console.warn(
        '[KOMBU v160.4] Supabase client待機中'
      );
      return false;
    }

    const session = await getSession();

    if (!session) {
      return false;
    }

    const result = await c
      .from(TABLE)
      .select(
        'storage_key,raw_value,revision,updated_at'
      )
      .order('storage_key');

    if (result.error) {
      console.error(
        '[KOMBU v160.4] Supabase読込失敗',
        result.error
      );
      return false;
    }

    const rows = Array.isArray(result.data)
      ? result.data
      : [];

    const remoteKeys = new Set();

    applyingRemote = true;

    try {
      rows.forEach(function (row) {
        if (!shouldSyncKey(row.storage_key)) {
          return;
        }

        remoteKeys.add(row.storage_key);

        originalSetItem.call(
          localStorage,
          row.storage_key,
          row.raw_value
        );
      });

      /*
       * Supabaseを唯一の正本にする。
       * Supabaseに存在しない業務用ローカルキーは削除。
       * これによりiPhoneに残った古いテストデータも持ち込まない。
       */
      for (
        let i = localStorage.length - 1;
        i >= 0;
        i--
      ) {
        const key = localStorage.key(i);

        if (
          shouldSyncKey(key) &&
          !remoteKeys.has(key)
        ) {
          originalRemoveItem.call(
            localStorage,
            key
          );
        }
      }

      originalSetItem.call(
        localStorage,
        MIGRATION_KEY,
        '1'
      );

    } finally {
      applyingRemote = false;
    }

    console.info(
      '[KOMBU v160.4] 起動前同期完了:',
      rows.length + ' keys'
    );

    window.dispatchEvent(
      new CustomEvent(
        'kombu:v160-complete-sync',
        {
          detail: {
            count: rows.length,
            syncedAt:
              new Date().toISOString()
          }
        }
      )
    );

    return true;
  }

  function createRemoteUpdateBanner() {
    let banner = document.getElementById(
      'kombuV160RemoteUpdate'
    );

    if (banner) return banner;

    banner = document.createElement('div');
    banner.id = 'kombuV160RemoteUpdate';

    banner.style.position = 'fixed';
    banner.style.left = '12px';
    banner.style.right = '12px';
    banner.style.top =
      'calc(8px + env(safe-area-inset-top))';
    banner.style.zIndex = '100000';
    banner.style.background = '#0b2b55';
    banner.style.color = '#fff';
    banner.style.borderRadius = '12px';
    banner.style.padding = '10px 12px';
    banner.style.boxShadow =
      '0 4px 18px rgba(0,0,0,.25)';
    banner.style.display = 'none';
    banner.style.alignItems = 'center';
    banner.style.justifyContent =
      'space-between';
    banner.style.gap = '10px';
    banner.style.fontSize = '13px';

    banner.innerHTML =
      '<span>🔄 他の端末でデータが更新されました</span>' +
      '<button id="kombuV160ApplyRemote" ' +
      'style="' +
      'border:0;' +
      'border-radius:8px;' +
      'padding:8px 10px;' +
      'font-weight:700;' +
      'background:#fff;' +
      'color:#0b2b55;' +
      'white-space:nowrap' +
      '">' +
      '最新データを反映' +
      '</button>';

    document.body.appendChild(banner);

    const button = document.getElementById(
      'kombuV160ApplyRemote'
    );

    if (button) {
      button.onclick = async function () {
        button.disabled = true;
        button.textContent = '同期中…';

        try {
          await pullAll();

          /*
           * ここだけはユーザーが明示的に押した時の再読込。
           * 入力途中に勝手にトップへ戻ることはない。
           * 再読込時はv160.4の起動前同期が先に完了する。
           */
          location.reload();

        } catch (error) {
          console.error(
            '[KOMBU v160.4] 手動反映失敗',
            error
          );

          button.disabled = false;
          button.textContent =
            '最新データを反映';
        }
      };
    }

    return banner;
  }

  function showRemoteUpdateBanner() {
    remoteDirty = true;

    const banner =
      createRemoteUpdateBanner();

    banner.style.display = 'flex';

    console.info(
      '[KOMBU v160.4] 別端末変更を受信'
    );
  }

  function hideRemoteUpdateBanner() {
    remoteDirty = false;

    const banner = document.getElementById(
      'kombuV160RemoteUpdate'
    );

    if (banner) {
      banner.style.display = 'none';
    }
  }

  function subscribeRealtime() {
    const c = client();

    if (!c || channel) return;

    channel = c
      .channel(
        'kombu-v1604-app-state'
      )

      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLE
        },
        function (payload) {
          const row = payload.new;
          const key =
            row && row.storage_key;
          const raw =
            row && row.raw_value;

          applyRow(row);

          if (
            isOwnRecentRealtime(
              key,
              raw
            )
          ) {
            console.info(
              '[KOMBU v160.4] 自端末Realtime反映:',
              key
            );
            return;
          }

          showRemoteUpdateBanner();
        }
      )

      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: TABLE
        },
        function (payload) {
          const row = payload.new;
          const key =
            row && row.storage_key;
          const raw =
            row && row.raw_value;

          applyRow(row);

          if (
            isOwnRecentRealtime(
              key,
              raw
            )
          ) {
            console.info(
              '[KOMBU v160.4] 自端末Realtime反映:',
              key
            );
            return;
          }

          showRemoteUpdateBanner();
        }
      )

      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: TABLE
        },
        function (payload) {
          const key =
            payload.old &&
            payload.old.storage_key;

          removeRemoteKey(key);

          if (
            isOwnRecentRealtime(
              key,
              null
            )
          ) {
            console.info(
              '[KOMBU v160.4] 自端末Realtime削除:',
              key
            );
            return;
          }

          showRemoteUpdateBanner();
        }
      )

      .subscribe(function (status) {
        console.info(
          '[KOMBU v160.4] Realtime:',
          status
        );
      });
  }

  function announceReady() {
    if (window.__KOMBU_V160_READY__) {
      return;
    }

    window.__KOMBU_V160_READY__ = true;

    window.dispatchEvent(
      new CustomEvent(
        'kombu:v160-ready',
        {
          detail: {
            version: '160.4'
          }
        }
      )
    );

    console.info(
      '[KOMBU v160.4] アプリ起動許可'
    );
  }

  async function start() {
    if (startPromise) {
      return startPromise;
    }

    startPromise = (async function () {
      if (started) {
        announceReady();
        return true;
      }

      const session = await getSession();

      if (!session) {
        /*
         * 未ログイン時はauth画面を表示したまま待機。
         * kombu:supabase-login 後にもう一度startする。
         */
        startPromise = null;
        return false;
      }

      started = true;

      try {
        /*
         * 最重要:
         * app-v159.js を読み込む前に必ずSupabaseを先に読む。
         */
        await pullAll();

        subscribeRealtime();
        hideRemoteUpdateBanner();
        announceReady();

        document.addEventListener(
          'visibilitychange',
          function () {
            if (!document.hidden) {
              /*
               * PWA復帰時はキャッシュだけ最新化。
               * 表示中画面は勝手に遷移させない。
               */
              pullAll().then(function () {
                if (remoteDirty) {
                  showRemoteUpdateBanner();
                }
              });
            }
          }
        );

        return true;

      } catch (error) {
        console.error(
          '[KOMBU v160.4] 完全同期開始失敗',
          error
        );

        started = false;
        startPromise = null;

        return false;
      }
    })();

    return startPromise;
  }

  installStorageHooks();

  window.kombuV160SyncNow =
    async function () {
      const ok = await pullAll();

      if (ok) {
        hideRemoteUpdateBanner();
      }

      return ok;
    };

  window.kombuV160FlushNow =
    flushPending;

  window.kombuV160Start =
    start;

  window.addEventListener(
    'kombu:supabase-login',
    function () {
      start();
    }
  );

  /*
   * authスクリプトより後に読み込まれた時や、
   * 既にログイン済みのPC/PWAにも対応。
   */
  setTimeout(function () {
    start();
  }, 0);

})();
