昆布在庫管理 v165.10.1 フリーズ修正

変更点:
- バージョン表示用のDOM全体MutationObserverを廃止
- 取消解除用のDOM全体MutationObserverと1.5秒間隔の再描画監視を廃止
- 低頻度・差分更新だけにして「ページが応答しません」を防止
- v165.10.0の取消解除、送り状要確認、候補紐付け機能は維持
- 表示バージョンを v165.10.1 に更新

GitHub上書き:
1. index.html
2. sw-v160.js
3. kombu-cancel-restore-v1.js
4. kombu-version-v1.js
