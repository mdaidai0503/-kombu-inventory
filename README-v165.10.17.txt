昆布在庫管理 v165.10.17

出荷依頼履歴の添付済み送り状PDFに「削除」を追加。
削除はPDF本体を消さず、その出荷依頼との紐付けだけを解除します。
複数PDFがある場合は1件ずつ解除できます。全PDFを解除すると未着に戻り、別PDFを選択できます。

同時に waybill-manual-link Edge Function v13 が必要です。
unlink に app_shipment_id / kombu_type を渡した場合は、その1リンクだけ解除する仕様です。
