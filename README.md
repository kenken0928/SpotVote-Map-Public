# みんなで選べるスポットマップ

## リポジトリの役割

このリポジトリは、Cloudflare Pages / Pages Functions / D1 / R2 を利用して構築する「みんなで選べるスポットマップ」アプリのソースコード一式を管理するためのリポジトリです。

本アプリは、管理者が登録したスポットを公開マップ上に表示し、必要に応じて複数のスポットを候補にした投票イベントURLを発行できるWebアプリです。

フロントエンド、Pages Functions API、D1 SQLスキーマ、初期データSQLを同一リポジトリで管理します。

## 全体構成

本アプリは、以下の構成で動作します。

- 静的フロントエンドは `public/` に配置
- APIは Cloudflare Pages Functions として `functions/api/` に配置
- スポット、カテゴリ、投票イベント、投票結果、一時投稿コードは Cloudflare D1 に保存
- 画像ファイルは Cloudflare R2 に保存
- 管理画面と管理APIは Cloudflare Access のメール認証で保護
- npm install は不要
- D1 SQL の作成・実行は Cloudflare Dashboard 上の Console で実施

## 技術スタック

| 領域 | 使用技術 |
|---|---|
| ホスティング | Cloudflare Pages |
| バックエンド | Cloudflare Pages Functions |
| データベース | Cloudflare D1 |
| 画像保存 | Cloudflare R2 |
| 認証 | Cloudflare Access |
| 地図 | Leaflet + OpenStreetMap |
| フロントエンド | HTML / CSS / JavaScript |


## ディレクトリ構成

```txt
spotvote-map/
├─ public/
│  ├─ index.html
│  ├─ pin.html
│  ├─ vote.html
│  ├─ admin.html
│  ├─ post.html
│  ├─ css/
│  │  └─ style.css
│  └─ js/
│     ├─ api.js
│     ├─ map.js
│     ├─ app.js
│     ├─ pin.js
│     ├─ vote.js
│     ├─ admin.js
│     └─ post.js
├─ functions/
│  └─ api/
│     ├─ _utils.js
│     ├─ pins.js
│     ├─ pin/
│     │  └─ [id].js
│     ├─ vote/
│     │  └─ [slug].js
│     ├─ temp-post.js
│     ├─ upload-url.js
│     └─ admin/
│        ├─ pins.js
│        ├─ pins/
│        │  └─ [id].js
│        ├─ vote-events.js
│        ├─ vote-events/
│        │  └─ [id].js
│        ├─ temp-code.js
│        ├─ cleanup-expired-events.js
│        └─ upload-url.js
├─ schema/
│  ├─ schema.sql
│  └─ seed.sql
└─ README.md
```

## セットアップ手順

## 1. GitHubリポジトリを作成する

推奨リポジトリ名は以下です。

- `spotvote-map-public`

このリポジトリに、`public/`、`functions/`、`schema/`、`README.md` を配置します。

## 2. Cloudflare Pages プロジェクトを作成する

Cloudflare Dashboard で以下の手順を実行します。

1. Cloudflare Dashboard にログイン
2. `Workers & Pages` を開く
3. `Create application` を選択
4. `Pages` を選択
5. GitHubリポジトリ `spotvote-map-public` を接続
6. Build settings を以下のように設定

| 項目 | 設定値 |
|---|---|
| Framework preset | None |
| Build command | 空欄 |
| Build output directory | `public` |

7. Deploy を実行

## 3. D1 データベースを作成する

Cloudflare Dashboard で以下の手順を実行します。

1. `Workers & Pages` を開く
2. `D1 SQL Database` を開く
3. `Create database` を選択
4. Database name に以下を入力

| 項目 | 推奨値 |
|---|---|
| D1 database name | `spotvote_map_db-public` |

5. 作成した D1 データベースを開く
6. `Console` を開く
7. `schema/schema.sql` の全文を貼り付けて実行
8. 必要に応じて `schema/seed.sql` の全文を貼り付けて実行

## 4. R2 バケットを作成する

Cloudflare Dashboard で以下の手順を実行します。

1. `R2 Object Storage` を開く
2. `Create bucket` を選択
3. Bucket name に以下を入力

| 項目 | 推奨値 |
|---|---|
| R2 bucket name | `spotvote-map-media-public` |

4. バケットを作成

## 5. Pages Functions の Bindings を設定する

Cloudflare Pages プロジェクトに D1 と R2 を接続します。

1. Cloudflare Dashboard を開く
2. `Workers & Pages` を開く
3. 対象の Pages プロジェクトを開く
4. `Settings` を開く
5. `Functions` を開く
6. `D1 database bindings` を追加
7. `R2 bucket bindings` を追加

設定値は以下です。

| Binding種別 | Variable name | 接続先 |
|---|---|---|
| D1 database | `DB` | `spotvote_map_db-public` |
| R2 bucket | `MEDIA_BUCKET` | `spotvote-map-media-public` |

設定後、Pages プロジェクトを再デプロイしてください。

## 6. Cloudflare Access を設定する

管理画面と管理APIは Cloudflare Access で保護します。

保護対象は以下です。

| 対象 | パス |
|---|---|
| 管理画面 | `/admin` |
| 管理画面 | `/admin.html` |
| 管理API | `/js/admin.js` |
| 管理API | `/api/admin/*` |

Cloudflare Dashboard で以下の手順を実行します。

1. `Zero Trust` を開く
2. `Access controls` を開く
3. `Applications` を開く
4. `Create new application` をクリック
6. `Self-hosted and private` を選択
7. `Continue with Self-hosted and private` を選択

| 項目 | 推奨値 |
|---|---|
| Subdomain | 空欄でOK |
| Domain | 自分のサイトのドメインを選択 例:`spot-vote-map-public.pages.dev` |
| Path | `admin` |
| Path | `admin.html` |
| Path | `js/admin.js` |
| Path | `/api/admin/*` |

注. + Add public hostname をクリックし、Pathを追加してください。
　　`admin.html`と`js/admin.js`と`/api/admin/*` を設定します。
8. Access policesの中央の(`No polices added`の部分)で、`Create new policy`をクリック

| 項目 | 推奨値 |
|---|---|
| Policy name | `admin-only` |
| Action | Allow |

9. `Add include`をクリックし、`Emails`を選択し、自分のメールアドレスを入力
    (Excludeは空でOK。Requireは空でOK）

| 項目 | 推奨値 |
|---|---|
| Exclude | `admin-only` |
| Action | Allow |

10. 保存する
11. Authenticationの箇所に、`Accept all available identity providers`が表示されている（ONのままでOK）
12. 最下部のDetailsの箇所

| 項目 | 推奨値 |
|---|---|
| Name | `spot-vote-map-public.pages.dev` |
| Session Duration | 24hours |

13. 右下の`Create`をクリック
14. Save

念の為、シークレットモードでアクセスして、認証が掛かっているか確認してください。


## 7. 動作確認

公開マップは以下で確認します。

- `/`

スポット詳細は以下で確認します。

- `/pin.html?id=1`

管理画面は以下で確認します。

- `/admin.html`

投票ページは以下で確認します。

- `/vote.html?slug=xxxxxxxx`

一時投稿ページは以下で確認します。

- `/post.html`

## 環境変数・Bindings の説明

このアプリでは、通常の環境変数ではなく Cloudflare Pages Functions の Bindings を利用します。

## DB

| 項目 | 内容 |
|---|---|
| Binding name | `DB` |
| 種別 | Cloudflare D1 |
| 推奨DB名 | `spotvote_map_db-public` |
| 用途 | スポット、カテゴリ、表示設定、投票イベント、投票結果、一時投稿コードの保存 |

Pages Functions では以下のように参照されます。

- `env.DB`

## MEDIA_BUCKET

| 項目 | 内容 |
|---|---|
| Binding name | `MEDIA_BUCKET` |
| 種別 | Cloudflare R2 |
| 推奨バケット名 | `spotvote-map-media-public` |
| 用途 | スポット画像の保存 |

Pages Functions では以下のように参照されます。

- `env.MEDIA_BUCKET`

## Cloudflare Access ヘッダー

Cloudflare Access で保護されたリクエストでは、認証済みユーザーのメールアドレスが以下のヘッダーで渡されます。

| ヘッダー | 用途 |
|---|---|
| `Cf-Access-Authenticated-User-Email` | 管理者認証済みかどうかの確認 |

管理APIでは、このヘッダーが存在しない場合、管理者向け操作を拒否します。

## D1 SQL の実行について

このプロジェクトでは、D1 SQL のセットアップに `wrangler` は使用しません。

Cloudflare Dashboard 上の D1 Console で、以下の順番でSQLを実行してください。

1. `schema/schema.sql`
2. `schema/seed.sql`

`schema.sql` はテーブル、インデックス、外部キーを作成します。

`seed.sql` は初期カテゴリとサンプルスポットを登録します。

## 画像アップロードについて

画像はブラウザ側で圧縮した上で、Pages Functions 経由で R2 に保存します。

対応形式は以下です。

- JPEG
- PNG
- WebP
- HEIC


R2 に保存された画像は、`/api/upload-url?key=...` 経由で取得します。

## 投票イベントについて

管理者は管理画面から複数の公開スポットを選択し、投票イベントを作成できます。

投票イベント作成時に、推測困難なランダムslugが生成されます。

投票ページURLは以下の形式です。

- `/vote.html?slug=xxxxxxxx`

投票期限を過ぎたイベントは、投票ページ・候補一覧・投票APIのすべてで利用できなくなります。

## 一時投稿コードについて

管理者は管理画面から6桁の一時投稿コードを発行できます。

一時投稿コードの仕様は以下です。

| 項目 | 内容 |
|---|---|
| 桁数 | 6桁 |
| 有効期限 | 10分 |
| 使用回数 | 1回のみ |
| 保存形式 | SHA-256 ハッシュ |
| 使用後 | `used_at` を記録して無効化 |

投稿ページは以下です。

- `/post.html`

## 運用上の注意

OpenStreetMap の公式タイルサーバは、小規模PoCや学習用途を前提として利用してください。

アクセス数が増える場合は、Mapbox などのタイル提供サービスへの切り替えを検討してください。

画像はR2容量を圧迫しないよう、ブラウザ側で圧縮してからアップロードします。

投票イベントを削除しても、スポット本体は削除されません。

期限切れイベント削除では、以下のみ削除されます。

- `vote_events`
- `vote_event_pins`
- `votes`

スポット本体である `pins` は削除されません。

## 推奨リソース名まとめ

| 種別 | 推奨名 |
|---|---|
| GitHub repository | `spotvote-map-public` |
| Cloudflare Pages project | `spotvote-map-public` |
| D1 database | `spotvote_map_db-public` |
| D1 binding | `DB` |
| R2 bucket | `spotvote-map-media-public` |
| R2 binding | `MEDIA_BUCKET` |
| Cloudflare Access application | `spotvote-map-admin-public` |

## 今後の改善候補

- 投票の重複制限
- 管理者メールアドレスの厳密チェック
- R2画像削除処理の追加
- R2独自公開ドメイン対応
- Cron Triggers による期限切れイベント自動削除
- 投票結果のCSV出力
- カテゴリ管理画面
- UI/UXの追加改善
- Mapbox 等へのタイル切り替え
