(() => {
  "use strict";

  const SYNC_URL =
    "https://crltrozxztivkyxtjjxv.supabase.co/functions/v1/kombu-shipment-sync";

  const TOKEN_KEY = "kombu_sync_token_v1";

  const PRODUCT_BY_STORAGE_KEY = {
    "kombu_local_only_v3": "釧路産昆布",
  };

  const originalSetItem = Storage.prototype.setItem;

  let syncTimer = null;
  let syncing = false;

  function inferProduct(storageKey) {
    if (PRODUCT_BY_STORAGE_KEY[storageKey]) {
      return PRODUCT_BY_STORAGE_KEY[storageKey];
    }

    const k = String(storageKey || "").toLowerCase();

    if (!k.startsWith("kombu_")) return null;

    if (k.includes("hidaka")) {
      return "日高昆布";
    }

    if (k.includes("nemuro")) {
      return "根室産昆布";
    }

    if (
      k.includes("sanmae") ||
      k.includes("saomae") ||
      k.includes("sao_mae")
    ) {
      return "釧路産棹前昆布";
    }

    return null;
  }

  function readToken(askIfMissing = false) {
    let token = localStorage.getItem(TOKEN_KEY) || "";

    if (!token && askIfMissing) {
      token =
        window.prompt(
          "Supabase出荷指示同期トークンを入力してください。\n" +
            "この値はこの端末のブラウザ内だけに保存されます。",
          ""
        ) || "";

      token = token.trim();

      if (token) {
        originalSetItem.call(
          localStorage,
          TOKEN_KEY,
          token
        );
      }
    }

    return token.trim();
  }

  async function sendShipment(
    kombuType,
    shipment,
    token
  ) {
    const res = await fetch(SYNC_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-kombu-sync-token": token,
      },

      body: JSON.stringify({
        kombu_type: kombuType,
        shipment,
      }),
    });

    let result = null;

    try {
      result = await res.json();
    } catch {
      result = {
        ok: false,
        error: `HTTP ${res.status}`,
      };
    }

    if (!res.ok || !result?.ok) {
      throw new Error(
        result?.error ||
          `Supabase同期に失敗しました。HTTP ${res.status}`
      );
    }

    return result;
  }

  async function syncStorageState(
    storageKey,
    rawValue,
    askIfMissing = false
  ) {
    const kombuType = inferProduct(storageKey);

    if (!kombuType) return;

    let data;

    try {
      data = JSON.parse(rawValue || "null");
    } catch {
      return;
    }

    const shipments =
      Array.isArray(data?.shipments)
        ? data.shipments
        : [];

    if (!shipments.length) return;

    const token = readToken(askIfMissing);

    if (!token) return;

    for (const shipment of shipments) {
      if (!shipment?.id) continue;

      await sendShipment(
        kombuType,
        shipment,
        token
      );
    }
  }

  async function syncAllExisting(
    askIfMissing = false
  ) {
    if (syncing) return;

    syncing = true;

    try {
      const targets = [];

      for (
        let i = 0;
        i < localStorage.length;
        i++
      ) {
        const key = localStorage.key(i);

        const kombuType =
          inferProduct(key);

        if (!kombuType) continue;

        const raw =
          localStorage.getItem(key);

        if (!raw) continue;

        let parsed;

        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }

        if (
          Array.isArray(parsed?.shipments) &&
          parsed.shipments.length
        ) {
          targets.push({
            key,
            raw,
          });
        }
      }

      if (!targets.length) return;

      const token =
        readToken(askIfMissing);

      if (!token) return;

      for (const t of targets) {
        await syncStorageState(
          t.key,
          t.raw,
          false
        );
      }

      console.info(
        "[KOMBU SYNC] 出荷指示同期完了"
      );
    } catch (e) {
      console.error(
        "[KOMBU SYNC] 同期失敗",
        e
      );
    } finally {
      syncing = false;
    }
  }

  function scheduleSync(
    askIfMissing = false
  ) {
    clearTimeout(syncTimer);

    syncTimer = setTimeout(() => {
      syncAllExisting(
        askIfMissing
      );
    }, 700);
  }

  Storage.prototype.setItem =
    function (key, value) {
      originalSetItem.call(
        this,
        key,
        value
      );

      if (this !== localStorage) {
        return;
      }

      const product =
        inferProduct(key);

      if (!product) return;

      let parsed;

      try {
        parsed =
          JSON.parse(
            value || "null"
          );
      } catch {
        return;
      }

      if (
        !Array.isArray(
          parsed?.shipments
        ) ||
        !parsed.shipments.length
      ) {
        return;
      }

      scheduleSync(true);
    };

  window.kombuSyncNow =
    () => syncAllExisting(true);

  window.kombuResetSyncToken =
    () => {
      localStorage.removeItem(
        TOKEN_KEY
      );

      alert(
        "同期トークンを削除しました。次回の出荷指示保存時に再入力できます。"
      );
    };

  window.kombuSetSyncToken =
    () => {
      const current =
        localStorage.getItem(
          TOKEN_KEY
        ) || "";

      const next =
        window.prompt(
          "Supabase出荷指示同期トークンを入力してください。",
          current
        ) || "";

      if (next.trim()) {
        originalSetItem.call(
          localStorage,
          TOKEN_KEY,
          next.trim()
        );

        alert(
          "同期トークンをこの端末に保存しました。"
        );

        syncAllExisting(false);
      }
    };

  window.addEventListener(
    "load",
    () => {
      if (
        localStorage.getItem(
          TOKEN_KEY
        )
      ) {
        setTimeout(
          () =>
            syncAllExisting(false),
          1200
        );
      }
    }
  );
})();
