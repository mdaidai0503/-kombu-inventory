/* =====================================================
   R8 根室産昆布「長昆布積込明細書」一括入庫対応 v1.0
   対象PDF SHA-256:
   32900e4e11d7522e0820650604ac39e3907ac2165c49cadcfd0c32f214c038ca
   ===================================================== */
(function(){
  'use strict';

  if (typeof nParsePdf !== 'function' || typeof sha256File !== 'function') {
    console.warn('[KOMBU R8 NEMURO] nParsePdf/sha256File が見つからないためパッチを適用できません。');
    return;
  }

  const baseNParsePdf = nParsePdf;
  const TARGET_HASH = '32900e4e11d7522e0820650604ac39e3907ac2165c49cadcfd0c32f214c038ca';

  const makeRows = () => [
    // 落石漁協 夏 / 春茎
    {year:'R8', coop:'落石漁協', season:'夏', group:'春茎', item:'①', qty:210, page:1},
    {year:'R8', coop:'落石漁協', season:'夏', group:'春茎', item:'②', qty:45,  page:1},
    {year:'R8', coop:'落石漁協', season:'夏', group:'春茎', item:'③', qty:35,  page:1},
    {year:'R8', coop:'落石漁協', season:'夏', group:'春茎', item:'④', qty:30,  page:1},

    // 歯舞漁協 夏 / 貝殻棹前
    {year:'R8', coop:'歯舞漁協', season:'夏', group:'貝殻棹前', item:'棹①', qty:25, page:1},
    {year:'R8', coop:'歯舞漁協', season:'夏', group:'貝殻棹前', item:'元①', qty:8,  page:1},
    {year:'R8', coop:'歯舞漁協', season:'夏', group:'貝殻棹前', item:'③',   qty:12, page:1},
    {year:'R8', coop:'歯舞漁協', season:'夏', group:'貝殻棹前', item:'④',   qty:12, page:1},

    // 歯舞漁協 夏 / 加工2 → アプリの「加工用 ②」へ対応
    {year:'R8', coop:'歯舞漁協', season:'夏', group:'加工用', item:'②', qty:3, page:1}
  ];

  nParsePdf = async function(file){
    if (!file) return baseNParsePdf(file);

    let hash;
    try {
      hash = await sha256File(file);
    } catch (e) {
      return baseNParsePdf(file);
    }

    if (hash !== TARGET_HASH) {
      return baseNParsePdf(file);
    }

    if (nState && Array.isArray(nState.pdfImports) && nState.pdfImports.some(x => x.hash === hash)) {
      throw Error('このPDFはすでに根室産昆布へ取り込み済みです。');
    }

    const rows = makeRows();
    const total = rows.reduce((a, r) => a + Number(r.qty || 0), 0);
    if (total !== 380) {
      throw Error('R8根室産昆布の数量確認に失敗しました。');
    }

    console.info('[KOMBU R8 NEMURO] 長昆布積込明細書をR8年度・根室産昆布として認識しました。合計:', total);

    return {
      rows,
      date: '2026-08-07',
      matched: [1],
      matchedPages: [1],
      pageCount: 1,
      years: ['R8'],
      hash,
      specialParser: 'nemuro-r8-loading-statement-v1'
    };
  };

  globalThis.nParsePdf = nParsePdf;
  globalThis.__KOMBU_NEMURO_R8_IMPORT_V1__ = true;
})();
