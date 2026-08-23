/* =========================================================
   昆布在庫管理 → FAXBOX専用アプリ 連携ブリッジ v1.2
   ---------------------------------------------------------
   移行テスト用:
   ・既存の昆布在庫管理内 FAX BOX はまだ残す
   ・既存FAX BOX内の出荷指示を送信先ごとにまとめる
   ・既存PDF生成処理をそのまま利用
   ・生成PDFを Supabase Storage faxbox-documents へ保存
   ・faxbox_jobs へ queued 登録
   ・source_app = kombu_inventory を記録
   ・成功後も旧FAX BOX項目は消さず、専用FAXBOX job idだけ記録
   ========================================================= */

(function () {
  'use strict';

  const OLD_FAX_KEY = 'kombu-v99-fax-box';
  const SOURCE_APP = 'kombu_inventory';
  const SOURCE_TYPE = 'shipment';
  const STORAGE_BUCKET = 'faxbox-documents';

  let sending = false;

  function stageError(stage, error) {
    const detail = String(
      error?.message ||
      error?.error_description ||
      error ||
      '不明なエラー'
    );

    console.error(
      '[FAXBOX BRIDGE v1.2][' + stage + ']',
      error
    );

    const e = new Error(
      '【' + stage + '】' + detail
    );
    e.stage = stage;
    e.original = error;
    return e;
  }

  async function runStage(stage, fn) {
    console.info(
      '[FAXBOX BRIDGE v1.2][' + stage + '] 開始'
    );

    try {
      const result = await fn();

      console.info(
        '[FAXBOX BRIDGE v1.2][' + stage + '] 成功'
      );

      return result;
    } catch (error) {
      throw stageError(stage, error);
    }
  }

  function sb() {
    return window.kombuSupabase || null;
  }

  function readOldBox() {
    try {
      const x = JSON.parse(
        localStorage.getItem(OLD_FAX_KEY) || '[]'
      );
      return Array.isArray(x) ? x : [];
    } catch (e) {
      return [];
    }
  }

  function saveOldBox(items) {
    localStorage.setItem(
      OLD_FAX_KEY,
      JSON.stringify(items)
    );
  }

  function clean(v) {
    return String(v == null ? '' : v).trim();
  }

  function productLabel(p) {
    return {
      kushiro: '釧路産昆布',
      hidaka: '日高昆布',
      nemuro: '根室産昆布',
      sanmae: '釧路産棹前昆布'
    }[p] || p || '昆布';
  }

  function destinationKey(item) {
    const d = item?.dest || {};
    return [
      clean(d.name),
      clean(d.phone)
    ].join('\u0001');
  }

  function groupByDestination(items) {
    const map = new Map();

    items.forEach(function (item) {
      const key = destinationKey(item);

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push(item);
    });

    return Array.from(map.values());
  }

  async function session() {
    const c = sb();

    if (!c) {
      throw new Error(
        'Supabaseへ接続できません。'
      );
    }

    const r = await c.auth.getSession();
    const s = r?.data?.session || null;

    if (!s) {
      throw new Error(
        'Supabaseへログインしてください。'
      );
    }

    return s;
  }

  async function captureExistingPdfBlob(items) {
    if (
      typeof window.v159OpenItemsPdf !== 'function'
    ) {
      throw new Error(
        '既存の出荷指示PDF生成機能を確認できません。'
      );
    }

    const originalCreateObjectURL =
      URL.createObjectURL.bind(URL);

    let capturedPdf = null;

    URL.createObjectURL = function (obj) {
      if (
        obj instanceof Blob &&
        (
          obj.type === 'application/pdf' ||
          String(obj.type || '').includes('pdf')
        )
      ) {
        capturedPdf = obj;
      }

      return originalCreateObjectURL(obj);
    };

    try {
      await window.v159OpenItemsPdf(items);
    } finally {
      URL.createObjectURL =
        originalCreateObjectURL;
    }

    if (!capturedPdf) {
      throw new Error(
        'PDFデータを取得できませんでした。'
      );
    }

    return capturedPdf;
  }

  function filenameFor(items) {
    const ids = items
      .map(x => clean(x.id))
      .filter(Boolean);

    const date =
      clean(items[0]?.shipDate) ||
      new Date().toLocaleDateString('sv-SE');

    if (ids.length === 1) {
      return (
        '出荷指示_' +
        ids[0] +
        '_' +
        date +
        '.pdf'
      );
    }

    return (
      '出荷指示_まとめ_' +
      date +
      '_' +
      ids.length +
      '件.pdf'
    );
  }

  function normalizeRecipientName(name) {
    return clean(name)
      .replace(/\s+/g, '')
      .replace(/（株）/g, '(株)')
      .replace(/㈱/g, '(株)')
      .replace(/株式会社/g, '(株)')
      .replace(/（有）/g, '㈲')
      .replace(/\(有\)/g, '㈲')
      .toLowerCase();
  }

  async function findFaxboxRecipientByName(name) {
    const c = sb();
    const target = normalizeRecipientName(name);

    if (!target) {
      throw new Error(
        '送信先名が未設定です。'
      );
    }

    const result = await c
      .from('faxbox_recipients')
      .select(
        'id,district,recipient_name,fax_number,favorite,sort_order,active'
      )
      .eq('active', true);

    if (result.error) {
      throw new Error(
        'FAXBOX送信先マスター取得失敗: ' +
        result.error.message
      );
    }

    const rows = Array.isArray(result.data)
      ? result.data
      : [];

    const matches = rows.filter(function (row) {
      return normalizeRecipientName(
        row.recipient_name
      ) === target;
    });

    if (!matches.length) {
      throw new Error(
        'FAXBOX送信先マスターに「' +
        name +
        '」が見つかりません。'
      );
    }

    matches.sort(function (a, b) {
      return (
        Number(Boolean(b.favorite)) -
          Number(Boolean(a.favorite))
      ) || (
        Number(a.sort_order || 100) -
        Number(b.sort_order || 100)
      );
    });

    const hit = matches[0];

    if (!clean(hit.fax_number)) {
      throw new Error(
        'FAXBOX送信先マスターの「' +
        hit.recipient_name +
        '」にFAX番号がありません。'
      );
    }

    return hit;
  }

  async function registerGroup(items) {
    const c = sb();

    const s = await runStage(
      '1 Supabaseログイン確認',
      async function () {
        return await session();
      }
    );

    const first = items[0];
    const dest = first?.dest || {};
    const originalRecipientName =
      clean(dest.name);

    if (!originalRecipientName) {
      throw stageError(
        '2 送信先名確認',
        new Error('送信先名が未設定です。')
      );
    }

    const recipient =
      await runStage(
        '2 FAXBOX送信先マスター検索',
        async function () {
          return await findFaxboxRecipientByName(
            originalRecipientName
          );
        }
      );

    const recipientName =
      clean(recipient.recipient_name);

    const faxNumber =
      clean(recipient.fax_number);

    const pdfBlob =
      await runStage(
        '3 出荷指示PDF生成',
        async function () {
          return await captureExistingPdfBlob(
            items
          );
        }
      );

    const jobId =
      crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) +
          '-' +
          Math.random()
            .toString(36)
            .slice(2);

    const filePath =
      s.user.id +
      '/' +
      jobId +
      '/document.pdf';

    await runStage(
      '4 faxbox-documentsへPDF保存',
      async function () {
        const upload = await c.storage
          .from(STORAGE_BUCKET)
          .upload(
            filePath,
            pdfBlob,
            {
              contentType: 'application/pdf',
              upsert: false
            }
          );

        if (upload.error) {
          throw new Error(
            'FAXBOX PDF保存失敗: ' +
            upload.error.message
          );
        }

        return upload;
      }
    );

    const sourceIds = items
      .map(x => clean(x.id))
      .filter(Boolean);

    const products = Array.from(
      new Set(
        items
          .map(x => clean(x.product))
          .filter(Boolean)
      )
    );

    const body = {
      id: jobId,
      user_id: s.user.id,
      recipient_id: recipient.id,
      district: recipient.district || null,
      recipient_name: recipientName,
      fax_number: faxNumber,
      file_path: filePath,
      original_filename:
        filenameFor(items),
      scheduled_at:
        new Date().toISOString(),
      status: 'queued',
      memo:
        '昆布在庫管理から登録',
      dedupe_key:
        'kombu:' +
        sourceIds.join(',') +
        ':' +
        jobId,
      source_app: SOURCE_APP,
      source_type: SOURCE_TYPE,
      source_record_id:
        sourceIds.length === 1
          ? sourceIds[0]
          : sourceIds.join(','),
      source_meta: {
        shipment_ids: sourceIds,
        products: products,
        product_labels:
          products.map(productLabel),
        ship_dates: items
          .map(x => clean(x.shipDate))
          .filter(Boolean),
        quantity_total:
          items.reduce(
            (sum, x) =>
              sum + Number(x?.qty || 0),
            0
          ),
        original_destination_name:
          originalRecipientName,
        faxbox_recipient_id:
          recipient.id
      }
    };

    const insert = await runStage(
      '5 faxbox_jobsへ登録',
      async function () {
        const r = await c
          .from('faxbox_jobs')
          .insert(body)
          .select('id,status')
          .single();

        if (r.error) {
          throw new Error(
            'FAXBOX登録失敗: ' +
            r.error.message
          );
        }

        return r;
      }
    ).catch(async function (error) {
      try {
        await c.storage
          .from(STORAGE_BUCKET)
          .remove([filePath]);
      } catch (_) {}

      throw error;
    });

    return {
      jobId: jobId,
      items: items
    };
  }

  async function sendOldBoxToDedicated() {
    if (sending) return;

    const oldBox = readOldBox();

    const unsent = oldBox.filter(function (x) {
      return !x.dedicatedFaxboxJobId;
    });

    if (!unsent.length) {
      alert(
        '専用FAXBOXへ送る未登録データはありません。'
      );
      return;
    }

    const groups =
      groupByDestination(unsent);

    const ok = confirm(
      groups.length +
      '送信先・' +
      unsent.length +
      '件を専用FAXBOXへ登録します。\n\n' +
      '既存の昆布在庫管理内FAX BOXは、移行確認が終わるまで残します。'
    );

    if (!ok) return;

    sending = true;

    const btn =
      document.getElementById(
        'kombuDedicatedFaxboxSend'
      );

    if (btn) {
      btn.disabled = true;
      btn.textContent =
        '専用FAXBOXへ登録中…';
    }

    const succeeded = [];
    const failed = [];

    try {
      for (const group of groups) {
        try {
          const result =
            await registerGroup(group);

          succeeded.push(result);

          const ids = new Set(
            group.map(x => x.key)
          );

          const current =
            readOldBox();

          current.forEach(function (item) {
            if (ids.has(item.key)) {
              item.dedicatedFaxboxJobId =
                result.jobId;
              item.dedicatedFaxboxAt =
                new Date().toISOString();
            }
          });

          saveOldBox(current);

        } catch (e) {
          failed.push({
            destination:
              clean(group[0]?.dest?.name) ||
              '送信先未設定',
            error:
              String(e?.message || e),
            stage:
              e?.stage || '不明'
          });
        }
      }

      let msg =
        '専用FAXBOX登録結果\n\n' +
        '成功: ' +
        succeeded.length +
        '送信先';

      if (failed.length) {
        msg +=
          '\n失敗: ' +
          failed.length +
          '送信先\n\n' +
          failed
            .map(
              x =>
                x.destination +
                '\n' +
                '段階: ' +
                x.stage +
                '\n' +
                '内容: ' +
                x.error
            )
            .join('\n\n') +
          '\n\nF12 → Consoleにも詳細ログを出しています。';
      } else {
        msg +=
          '\n\nFAXBOX専用アプリの「送信待ち一覧」を確認してください。';
      }

      alert(msg);

    } finally {
      sending = false;

      if (btn) {
        btn.disabled = false;
        btn.textContent =
          '📤 専用FAXBOXへ送る';
      }

      injectButton();
    }
  }

  function isOldFaxBoxPage() {
    const header =
      clean(
        document.querySelector('header')
          ?.textContent
      );

    const appText =
      clean(
        document.getElementById('app')
          ?.textContent
      );

    return (
      header.includes('FAX BOX') ||
      (
        appText.includes('FAX BOX') &&
        appText.includes('PDF')
      )
    );
  }

  function injectButton() {
    if (!isOldFaxBoxPage()) return;

    if (
      document.getElementById(
        'kombuDedicatedFaxboxSend'
      )
    ) {
      return;
    }

    const app =
      document.getElementById('app');

    if (!app) return;

    const firstCard =
      app.querySelector(
        'section.card'
      );

    if (!firstCard) return;

    const btn =
      document.createElement('button');

    btn.id =
      'kombuDedicatedFaxboxSend';
    btn.className =
      'btn secondary';
    btn.style.cssText =
      'width:100%;' +
      'margin:10px 0 4px;' +
      'background:#0b2b55;' +
      'color:#fff;' +
      'font-weight:800';

    const count =
      readOldBox().filter(
        x => !x.dedicatedFaxboxJobId
      ).length;

    btn.textContent =
      '📤 専用FAXBOXへ送る' +
      (count ? ' (' + count + ')' : '');

    btn.onclick =
      sendOldBoxToDedicated;

    firstCard.appendChild(btn);
  }

  const observer =
    new MutationObserver(function () {
      injectButton();
    });

  observer.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );

  window
    .kombuSendOldFaxboxToDedicated =
      sendOldBoxToDedicated;

  window
    .kombuFaxboxBridgeVersion =
      '1.2';

  setTimeout(
    injectButton,
    500
  );

})();
