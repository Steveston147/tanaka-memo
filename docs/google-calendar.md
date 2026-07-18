# Google Calendar 一方向連携

## 確定方針

- Work Boardを予定の管理元とする
- 日付を設定したメモのうち、利用者が選んだものだけGoogle Calendarへ反映する
- Google Calendar側で行った変更はWork Boardへ自動反映しない
- Outlook連携は今回の対象外とする
- Googleへの反映に失敗しても、Work Board内のメモは保持する

## 初期実装の範囲

1. Google Calendarへの接続と切断
2. 新規イベント作成
3. Work Boardで変更した予定の更新
4. 削除時にGoogle側も削除するか確認
5. 同期状態（未同期・処理中・同期済み・エラー）の表示
6. エラー時の再同期

## メモに追加する予定の項目

```ts
syncToGoogle?: boolean;
googleCalendarId?: string;
googleEventId?: string;
googleEventUrl?: string;
googleSyncStatus?: "not-synced" | "pending" | "synced" | "error";
googleLastSyncedAt?: string;
googleSyncError?: string;
```

既存データとの互換性を保つため、すべて任意項目とする。

## 認証方式

現在のWork Boardはデータベースやユーザーログインを持たず、メモをブラウザのlocalStorageに保存している。この構成を維持し、Google Identity Servicesのブラウザ向けOAuthトークン方式を使う。

- Client IDのみを `NEXT_PUBLIC_GOOGLE_CLIENT_ID` として設定する
- Client secretは使用しない
- アクセストークンはメモやlocalStorageへ保存しない
- ページ再読み込み後は必要に応じて再接続する

## Google Cloud側で必要な設定

1. Google Cloudプロジェクトを作成
2. Google Calendar APIを有効化
3. OAuth同意画面を設定
4. OAuth 2.0 Client IDを「ウェブ アプリケーション」で作成
5. 承認済みJavaScript生成元に開発用URLとVercelの本番URLを登録
6. Vercelの環境変数に `NEXT_PUBLIC_GOOGLE_CLIENT_ID` を設定

## 次のコード修正

`app/page.tsx` に次を追加する。

- Google接続状態
- 登録・編集フォームの「Google Calendarへ反映」チェック
- 新規・更新・削除時のCalendar API呼び出し
- カード上の同期状態と「Google Calendarで開く」リンク

API失敗とWork Boardへの保存を分離し、先にローカル保存を成功させてからGoogleへ反映する。
