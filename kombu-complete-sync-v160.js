/* =========================================================
   昆布在庫管理 完全同期 v160.3
   Supabase = 正本 / localStorage = 互換キャッシュ
   ---------------------------------------------------------
   ・既存v159のlocalStorage保存を自動捕捉してSupabaseへ保存
   ・PC/iPhoneとも同じSupabase状態を取得
   ・Realtimeで別端末の変更を即時反映
   ・バックアップデータを含む業務用localStorageキーも同期
   ・Supabase側で更新前状態を履歴保存
   ========================================================= */

(function () {
  'use strict';

  const TABLE = 'kombu_app_state';
  const MIGRATION_KEY = 'kombu_v1603_complete_sync_ready';

  const DO_NOT_SYNC = new Set([
    'kombu_sync_token_v1',
    'kombu_v160_local_reset_done',
    MIGRATION_KEY
  ]);

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  let applyingRemote = false;
  let started = false;
  let channel = null;
  let pending = new Map();
  let flushTimer = null;
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
    return result?.data?.session || null;
  }

  async function pushOne(key, rawValue) {
    const c = client();
    if (!c) return;

    const session = await getSession();
    if (!session) return;

    // RealtimeがHTTP応答より先に返る場合があるため、
    // Supabase送信前に「自端末の変更」として記録する。
    recentLocalWrites.set(key, {
      rawValue: rawValue,
      at: Date.now()
    });

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

  function isOwnRecentRealtime(key, rawValue) {
    const hit = recentLocalWrites.get(key);
    if (!hit) return false;

    const fresh = (Date.now() - hit.at) < 8000;
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

  async function flushPending() {
    clearTimeout(flushTimer);

    const work = Array.from(pending.entries());
    pending.clear();

    for (const [key, rawValue] of work) {
      try {
        await pushOne(key, rawValue);
        console.info(
          '[KOMBU v160.3] Supabase保存:',
          key
        );
      } catch (error) {
        console.error(
          '[KOMBU v160.3] Supabase保存失敗:',
          key,
          error
        );

        // 一時的な通信エラーなら次回再試行できるよう戻す
        pending.set(key, rawValue);
      }
    }

    if (pending.size) {
      flushTimer = setTimeout(flushPending, 3000);
    }
  }

  function queuePush(key, rawValue) {
    if (!shouldSyncKey(key)) return;
    pending.set(key, rawValue);

    clearTimeout(flushTimer);
    flushTimer = setTimeout(flushPending, 250);
  }

  function installStorageHooks() {
    Storage.prototype.setItem = function (key, value) {
      originalSetItem.call(this, key, value);

      if (
        this === localStorage &&
        !applyingRemote &&
        shouldSyncKey(key)
      ) {
        queuePush(String(key), String(value));
      }
    };

    Storage.prototype.removeItem = function (key) {
      originalRemoveItem.call(this, key);

      if (
        this === localStorage &&
        !applyingRemote &&
        shouldSyncKey(key)
      ) {
        queuePush(String(key), null);
      }
    };
  }

  function applyRow(row) {
    if (!row?.storage_key) return;
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
      originalRemoveItem.call(localStorage, key);
    } finally {
      applyingRemote = false;
    }
  }

  async function pullAll() {
    const c = client();
    if (!c) return false;

    const session = await getSession();
    if (!session) return false;

    const result = await c
      .from(TABLE)
      .select('storage_key,raw_value,revision,updated_at')
      .order('storage_key');

    if (result.error) {
      console.error(
        '[KOMBU v160.3] Supabase読込失敗',
        result.error
      );
      return false;
    }

    const remoteKeys = new Set();

    applyingRemote = true;

    try {
      (result.data || []).forEach(row => {
        if (!shouldSyncKey(row.storage_key)) return;

        remoteKeys.add(row.storage_key);

        originalSetItem.call(
          localStorage,
          row.storage_key,
          row.raw_value
        );
      });

      // Supabaseを正本にするため、
      // 業務用キーでSupabaseに存在しないローカル値は削除する。
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);

        if (
          shouldSyncKey(key) &&
          !remoteKeys.has(key)
        ) {
          originalRemoveItem.call(localStorage, key);
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
      '[KOMBU v160.3] Supabase正本 → 端末同期完了',
      (result.data || []).length + ' keys'
    );

    window.dispatchEvent(
      new CustomEvent('kombu:v160-complete-sync', {
        detail: {
          count: (result.data || []).length,
          syncedAt: new Date().toISOString()
        }
      })
    );

    return true;
  }

  function reloadVisibleAppSoon() {
    clearTimeout(window.__kombuV160ReloadTimer);

    window.__kombuV160ReloadTimer =
      setTimeout(function () {
        // v160.3:
        // Realtime受信時に location.reload() は行わない。
        // これにより入力中・閲覧中にトップ画面へ戻ることを防ぐ。
        // localStorageの互換キャッシュは既に更新済みなので、
        // 次の画面遷移・再表示・アプリ再開時に最新データを利用できる。
        window.dispatchEvent(
          new CustomEvent('kombu:v160-remote-change', {
            detail: {
              receivedAt: new Date().toISOString()
            }
          })
        );

        console.info(
          '[KOMBU v160.3] 別端末変更を受信。自動再読込は行いません。'
        );
      }, 250);
  }

  function subscribeRealtime() {
    const c = client();
    if (!c || channel) return;

    channel = c
      .channel('kombu-v1603-app-state')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLE
        },
        function (payload) {
          const key = payload.new?.storage_key;
          const raw = payload.new?.raw_value;

          applyRow(payload.new);

          if (isOwnRecentRealtime(key, raw)) {
            console.info(
              '[KOMBU v160.3] 自端末Realtime反映のため再読込スキップ:',
              key
            );
            return;
          }

          reloadVisibleAppSoon();
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
          const key = payload.new?.storage_key;
          const raw = payload.new?.raw_value;

          applyRow(payload.new);

          if (isOwnRecentRealtime(key, raw)) {
            console.info(
              '[KOMBU v160.3] 自端末Realtime反映のため再読込スキップ:',
              key
            );
            return;
          }

          reloadVisibleAppSoon();
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
          const key = payload.old?.storage_key;

          removeRemoteKey(key);

          if (isOwnRecentRealtime(key, null)) {
            console.info(
              '[KOMBU v160.3] 自端末Realtime削除のため再読込スキップ:',
              key
            );
            return;
          }

          reloadVisibleAppSoon();
        }
      )
      .subscribe(function (status) {
        console.info(
          '[KOMBU v160.3] Realtime:',
          status
        );
      });
  }

  async function seedIfSupabaseEmpty() {
    const c = client();
    if (!c) return;

    const session = await getSession();
    if (!session) return;

    const countResult = await c
      .from(TABLE)
      .select('storage_key', {
        count: 'exact',
        head: true
      });

    if (countResult.error) {
      throw countResult.error;
    }

    if ((countResult.count || 0) > 0) {
      return;
    }

    // 初期化直後なので通常は0件。
    // 万一この端末に正式データがある場合のみ初回Supabaseへ送る。
    const seeds = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (!shouldSyncKey(key)) continue;

      const raw = localStorage.getItem(key);
      if (raw == null) continue;

      seeds.push({
        storage_key: key,
        raw_value: raw,
        payload: parseJson(raw),
        updated_by: session.user.id
      });
    }

    if (!seeds.length) return;

    const result = await c
      .from(TABLE)
      .upsert(seeds, {
        onConflict: 'storage_key'
      });

    if (result.error) throw result.error;

    console.info(
      '[KOMBU v160.3] 初回Supabase登録:',
      seeds.length + ' keys'
    );
  }

  async function start() {
    if (started) return;
    started = true;

    try {
      await seedIfSupabaseEmpty();
      await pullAll();
      subscribeRealtime();

      document.addEventListener(
        'visibilitychange',
        function () {
          if (!document.hidden) {
            pullAll();
          }
        }
      );

      window.addEventListener('focus', function () {
        pullAll();
      });

    } catch (error) {
      console.error(
        '[KOMBU v160.3] 完全同期開始失敗',
        error
      );
      started = false;
    }
  }

  installStorageHooks();

  window.kombuV160SyncNow = pullAll;
  window.kombuV160FlushNow = flushPending;

  window.addEventListener(
    'kombu:supabase-login',
    start
  );

  window.addEventListener(
    'load',
    function () {
      setTimeout(async function () {
        const session = await getSession();
        if (session) start();
      }, 800);
    }
  );

})();
