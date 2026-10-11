# Orbit — Server-Driven Issue Tracker

Linearに着想を得た、ダークテーマの業務アプリケーションモックです。Nuxt 4 / Vue 3 / Nuxt UI 4 / json-render 0.21.xを使用しています。CSR専用で、AI API・LLM SDK・認証・データベースは使用しません。

## 起動とチェック

BunとVite Plusを使用します。タスクは`package.json`ではなく、既存の`vite.config.ts`の`run.tasks`に定義しています。

```sh
vp install
vp run postinstall
vp run dev
```

`http://localhost:3000`を開いてください。

```sh
vp check --fix
vp run typecheck
vp exec playwright install chromium
vp run test
vp run build
vp run preview
```

`vp run test`は先に本番ビルドを実行し、Playwrightが専用の`http://127.0.0.1:3100`でビルド済みサーバーをBunで自動起動します。既存サーバーは再利用せず、同ポートが使用中の場合は停止してから実行してください。スクリーンショットと失敗時のトレースは、Git管理外の`test-results/`に保存されます。

Nuxtは外部の`vite.config.ts`に警告を出しますが、このファイルはVite Plusのタスク・lint・format設定として維持しています。Nuxt固有の設定は`nuxt.config.ts`にあります。

## 実装の責務

| レイヤー        | ファイル                                        | 責務                                                                                     |
| --------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Static shell    | `app/components/AppShell.vue`                   | サイドバー、ワークスペース選択、ナビゲーション、コマンドパレット、ユーザーメニュー       |
| Catalog         | `shared/catalog.ts`                             | 20個の部品のprops、slots、events、および7個のActionの契約                                |
| Registry        | `app/utils/registry.ts` / `app/utils/registry/` | 共通・Issue一覧・詳細・Projectの型付き部品定義を合成し、Actionを接続。画面構造は持たない |
| UI Spec         | `server/utils/view-specs.ts`                    | ヘッダー、ツールバー、グループ、繰り返し、詳細の領域、表示条件、イベントとActionの接続   |
| Views API       | `server/api/views/[view].get.ts`                | 指定された静的Specを検証しJSONとして返す                                                 |
| Renderer host   | `app/app.vue`                                   | Specを取得し、共通ProvidersとRendererで描画。ロード・エラー・再試行を処理                |
| Mock records    | `shared/mock-data.ts`                           | 22件のIssue、4プロジェクト、5人の担当者、コメント・変更履歴の初期データ                  |
| State / Actions | `app/composables/useTracker.ts`                 | 外部StateStore、フィルターからの派生データ、変更処理、履歴、URL、ローカル保存            |
| Spec validation | `shared/validate-view.ts`                       | Catalogの構造・props、参照構造、Action名をサーバーとクライアントで検証                   |

新規作成ダイアログは共通アプリ操作として`NewIssueModal.vue`に実装しています。主要な4画面をまとめたページコンポーネントはありません。

## コードとチャンクの分割

Registryの描画定義は`common.ts`、`issues.ts`、`detail.ts`、`projects.ts`に分け、共通のアイコン・アバターなどを`presentation.ts`で共有します。各定義はCatalogの型で検査され、`registry.ts`で全20部品を登録します。画面ごとに登録部品を制限しないため、Inspect UIでもCatalog内の部品を自由に組み合わせられます。

`nuxt.config.ts`の`vite.$client`でVueランタイム、Nuxt UI関連、json-render / Zodの依存チャンクを分離します。サーバービルドのentryは変更しません。Inspect UIと新規Issue作成のコンポーネントJS・CSSは初回に開いたときに読み込み、新規作成モーダルは以後マウントを維持して閉じるアニメーションを完了させます。共通依存は初回から必要なため、この分割は総転送量の削減を保証するものではありません。

`tests/browser/bundle.spec.ts`で本番JSの500kB上限と機能コードの遅延読み込み・再利用を検証します。

## Specの取得と画面構成

| API                           | json-renderが管理する構造                                                        |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `GET /api/views/my-issues`    | 見出し、スコープ切り替え、検索・フィルター、ステータスグループ、IssueRow、空状態 |
| `GET /api/views/all-issues`   | 同じ一覧部品と構造を再利用。対象データはState側で全件に切り替える                |
| `GET /api/views/issue-detail` | 戻る操作、Issue見出し、説明、履歴、コメント欄、プロパティ編集を組み合わせる      |
| `GET /api/views/projects`     | 見出し、カードのGrid、プロジェクトの繰り返し、進捗、関連IssueへのAction          |

Specのヘッダーや配置には固定値を使い、レコードや検索条件には`$state`、`$bindState`、`$item`を使います。一覧はSpec内のネストした`repeat`でグループとIssueRowを展開します。RegistryのIssueRowは単一のIssueを描画するだけで、一覧のループやフィルタリングは担当しません。

```text
Server UI Spec → GET /api/views/:view → validateViewSpec → Renderer
                                                        ↓
                          Catalog → Registry → Nuxt UI components
                                                        ↕
                    StateProvider → external StateStore ← Actions
```

json-render 0.21.0のVueスキーマの検証結果には`on`が含まれないため、検証後も元のSpecをRendererへ渡します。Action内の`$item`は値ではなくJSON Pointerになる仕様に合わせ、`idPath`・`projectPath`をAction側で読み取っています。[公式Vue API](https://json-render.dev/docs/api/vue)とインストール済みの型・実装を確認しています。

## 操作と保存

- サイドバーからMy issues / All issues / Projectsへ移動できます。
- Issue選択、検索、Status / Priority / Assigneeの複合フィルター、Active / Completedへの切り替えができます。
- 詳細でステータス・優先度・担当者・プロジェクトを変更すると、一覧と履歴も更新されます。
- 新規Issue作成とコメント投稿ができます。
- プロジェクトからそのプロジェクトのIssueへ移動できます。
- `⌘ K` / `Ctrl K`で、現在のフィルターに関係なく全Issueを検索できます。
- Orbit / Orbit Sandboxは同じ初期サンプルから始まる独立したモックワークスペースです。編集内容は混ざりません。
- URLの`view`・`issue`・`project`に画面状態を反映し、再読み込みとブラウザの戻る操作に対応しています。

Issueと履歴はブラウザのlocalStorageに保存します。Orbitは`linear-mock-tracker:v1`、Sandboxは`linear-mock-tracker:sandbox:v1`、選択ワークスペースは`orbit:active-workspace`です。保存値を検証し、不正なデータはサンプルにフォールバックします。保存失敗は画面に通知します。複数端末やタブ間の同期は行いません。

## Inspect UI

トップバーのコードアイコン（Inspect UI）から、現在の画面のUI SpecをJSONで確認・編集できます。`Apply`または`⌘ / Ctrl + Enter`で構造・Catalog・Action名を検証し、リロードなしでRendererへ反映します。無効なJSONやSpecはエラーを表示し、表示中のSpecは変更しません。

適用済みの編集は`app/app.vue`の画面別メモリに保持され、画面を切り替えて戻っても利用できます。`Restore server spec`で元のSpecに戻し、未適用の入力も破棄できます。閉じる操作・画面移動で未適用の入力は破棄されます。上書きはlocalStorageにもサーバーにも保存せず、ページの再読み込みで消えます。`SpecInspector.vue`は開発者向けの編集パネルのみを担当し、業務画面は引き続きSpecから描画します。

## 動的配信への拡張

1. `getViewSpec()`の静的マップをAPI・DB・バージョン付きSpecリポジトリの取得処理に置き換えます。クライアントのRendererはそのまま利用できます。
2. Issue取得・更新・コメント追加をデータAPIへ置き換え、返却レコードを同じStateStoreへ反映します。Specとレコードを別々に配信できます。
3. Catalogを許可リストとして維持し、Specバージョン・互換性・認証・権限・Actionパラメーターの実行時検証を追加します。UIの表示条件を権限チェックの代わりにしません。
4. 新しい業務部品を追加する場合のみCatalog / Registryを拡張します。既存部品の配置、繰り返し、Binding、Actionの組み替えはSpecの変更だけで提供できます。

ブラウザテストでは、APIのSpecだけを変更して見出しを変え、タブを取り除いても、同じクライアント実装で描画・操作できることを検証しています。
