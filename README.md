# Orbit — Issue Tracker with Server-Composed Views

Linearに着想を得た、ライト・ダーク両テーマ対応のローカルIssue管理PoCです。Nuxt 4 / Vue 3 / Nuxt UI 4 / json-render 0.21.xを使用しています。Issue一覧・My issues・Projects・Issue詳細の主要画面は、サーバー配信のjson-render Specで構成します。サイドバーとアプリシェルはVueのままです。Issueと履歴はNuxtサーバーのローカルファイルに保存します。利用者は1人で、Employee / Manager / Guestは権限とUI差を確認するためのデモ用ペルソナです。選択はHttpOnly Cookieでサーバーへ伝えますが、本人確認を行わないため、実認証・実運用の認可境界ではありません。AI API・LLM SDK・外部サービスは使用しません。

## 起動とチェック

BunとVite Plusを使用します。タスクは`package.json`ではなく、既存の`vite.config.ts`の`run.tasks`に定義しています。

```sh
vp install
vp run postinstall
vp run dev -- --host 127.0.0.1
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

`vp run test`は先に本番ビルドを実行し、Playwrightが専用の`http://127.0.0.1:3100`でビルド済みサーバーをBunで自動起動します。再起動テストは`3101`も使います。既存サーバーは再利用しないため、この2つのポートを空けて実行してください。テストは専用の`test-results/records`を毎回初期化し、通常の`.data`には触れません。スクリーンショットと失敗時のトレースも、Git管理外の`test-results/`に保存されます。

Nuxtは外部の`vite.config.ts`に警告を出しますが、このファイルはVite Plusのタスク・lint・format設定として維持しています。Nuxt固有の設定は`nuxt.config.ts`にあります。

## 実装の責務

| レイヤー        | ファイル                                             | 責務                                                                                                        |
| --------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Static shell    | `app/components/AppShell.vue`                        | サイドバー、ワークスペース選択、ナビゲーション、コマンドパレット、デモペルソナ切り替え                      |
| Vue components  | `app/components/tracker/`                            | Specから使うページ見出し、フィルター、Issue行、Projectカード、詳細要素の表示部品                            |
| Catalog         | `shared/catalog.ts`                                  | Page、filter、Issue / Project / Activity repeat、detail、commentとworkflowの部品/action契約                 |
| Registry        | `app/utils/registry.ts`                              | Catalog部品をVue実装へ結び、Spec actionをtracker handlerへ接続                                              |
| UI Spec         | `server/utils/view-specs.ts`                         | `getIssueListSpec`・`getProjectsSpec`・`getIssueDetailSpec`で各画面の順序・repeat・visibility・eventsを構成 |
| Views API       | `server/api/views/[view].get.ts`                     | `issues`・`my-issues`・`projects`・読取可能なIssueの`issue-detail` Specを返す                               |
| Renderer host   | `app/app.vue`                                        | 現在のview Specを取得・検証・描画し、stale request・エラー・再試行・詳細Inspectorを処理                     |
| Mock records    | `shared/mock-data.ts`                                | 22件のIssue、4プロジェクト、5人の担当者、コメント・変更履歴の初期データ                                     |
| State / Actions | `app/composables/useTracker.ts`                      | Persona Cookieに沿うフィルター済み状態、検索、URL、API呼び出しと保存結果の反映                              |
| Records API     | `server/api/workspaces/` / `server/utils/records.ts` | ワークスペース別の取得・保存、入力検証、Workflow遷移、変更履歴の生成                                        |
| Demo policy     | `server/utils/personas.ts`                           | Guestの読取範囲、書き込み可否、Manager承認、共通の可視Issue・Project判定                                    |
| Spec validation | `shared/validate-view.ts`                            | 全view Catalogの構造・props・repeat参照・Action名をサーバーとクライアントで検証                             |

新規作成ダイアログは共通アプリ操作として`NewIssueModal.vue`に実装しています。Issue一覧・My issues・Projects・Issue詳細の構成と順序はサーバーSpecが管理します。見出し、フィルター、Issue行、Projectカード、Activity行、comment composer、propertiesなどは小さなVueコンポーネントとしてRegistryに登録し、画面全体を単一Catalog componentに隠しません。

## コードとチャンクの分割

json-renderのRegistryはPage layout/header、filter toolbar、status group、個別Issue row、project card、個別Activity row、detail section、comment composer、property fields、workflow panelなどを登録します。サーバーSpecが構成・順序・repeat・Guest向けread-only表示と編集UIのvisibilityを宣言します。Inspect UIでSpecを編集してもCatalogにない部品・Actionは使えません。Inspect UIは表示・Actionのプレビューであり、サーバーの認可や入力検証を迂回できません。

`nuxt.config.ts`の`vite.$client`でVueランタイム、Nuxt UI関連、json-render / Zodの依存チャンクを分離します。サーバービルドのentryは変更しません。Inspect UIと新規Issue作成のコンポーネントJS・CSSは初回に開いたときに読み込み、新規作成モーダルは以後マウントを維持して閉じるアニメーションを完了させます。共通依存は初回から必要なため、この分割は総転送量の削減を保証するものではありません。

`tests/browser/bundle.spec.ts`で本番JSの500kB上限と機能コードの遅延読み込み・再利用を検証します。

## Specの取得と画面構成

| API                                                            | json-renderが管理する構造                                                           |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `GET /api/views/issues?workspace=…` / `my-issues` / `projects` | Issue一覧・My issues・Projectsの構成、repeat、filters / navigation actions          |
| `GET /api/views/issue-detail?workspace=…&issue=…`              | 詳細セクション構成・activity repeat・visibility・comment/property・Workflow actions |
| `GET /api/workspaces/:workspace/records`                       | ペルソナから読めるIssueと、そのIssueに紐づく履歴だけ                                |
| `GET /api/workspaces/:workspace/projects`                      | ペルソナから読めるProjectsと可視Issue件数だけ                                       |

全ての主要画面Specは、データ本体を含めず既存tracker stateへのbindingとrepeatを使って表示します。詳細Specは読取可能なIssueをサーバーで検証し、PersonaとStatusに基づくWorkflow panel、およびコメント・プロパティのvisibilityを返します。クライアントのstate bindingsは表示と入力を同期しますが、API認可の代わりにはなりません。

```text
Vue shell/sidebar → route, workspace and persona state
                         ↓
GET issues / my-issues / projects Spec → validateViewSpec → Renderer ← filtered records state
GET issue-detail Spec → validateViewSpec → Renderer ← selected issue / activity state
                         ↓
       declared navigation, filter, comment/property/workflow actions → tracker handlers / authorized APIs
```

json-render 0.21.0のVueスキーマの検証結果には`on`が含まれないため、検証後も元のSpecをRendererへ渡します。全view Specは`validateViewSpec`でCatalog・構造・repeat・Action allowlistを検証します。InspectorはIssue detail Specのみ編集できます。[公式Vue API](https://json-render.dev/docs/api/vue)とインストール済みの型・実装を確認しています。

## 操作と保存

- サイドバーからMy issues / All issues / Projectsへ移動できます。
- Issue選択、検索、Status / Priority / Assigneeの複合フィルター、Active / Completedへの切り替えができます。
- Issue詳細では本文・Activity・Priority / Assignee / Projectを表示し、通常のプロパティ更新とコメント投稿ができます。
- 上部のユーザーメニューでEmployee / Manager / Guestを切り替えられます。これは単一ユーザーPoC内のシミュレーションで、ログインや本人確認ではありません。
- Backlog / Todo → In progress（Start work）、In progress → In review（Request review）はEmployeeとManagerが実行できます。In review → Done（Approve issue）はManagerのみが実行できます。Statusの直接PATCHは拒否し、サーバー側Workflow APIだけが遷移を行います。
- Guestは読み取り専用です。Design Systemプロジェクトと所属Issueは一覧・Projects・検索・詳細Specの全てから除外され、直接指定した読取・コメント・更新も拒否または404になります。
- 新規Issue作成とコメント投稿ができます。
- プロジェクトからそのプロジェクトのIssueへ移動できます。
- `⌘ K` / `Ctrl K`で、現在のフィルターに関係なく全Issueを検索できます。
- Orbit / Orbit Sandboxは同じ初期サンプルから始まる独立したワークスペースです。編集内容は混ざりません。
- URLの`view`・`issue`・`project`に画面状態を反映し、再読み込みとブラウザの戻る操作に対応しています。

Issueとコメント・変更履歴の保存先は、起動時の作業ディレクトリ配下の`.data/orbit.json`と`.data/sandbox.json`です。`ORBIT_DATA_DIR`に絶対パスを指定すると、開発サーバーと本番サーバーで保存先を固定できます。ファイルがないワークスペースのみ初期サンプルを作成します。既存ファイルの破損や読み取り失敗はエラーになり、サンプルで上書きしません。

```sh
ORBIT_DATA_DIR=/absolute/path/to/orbit-data vp run dev -- --host 127.0.0.1
# 本番ビルド後
ORBIT_DATA_DIR=/absolute/path/to/orbit-data NITRO_HOST=127.0.0.1 bun .output/server/index.mjs
```

保存処理は同じディレクトリの一時ファイルを書いてからrenameで置き換えます。1つのサーバープロセス内では同期的に読み取り・変更・保存を行い、Issueと履歴を一緒に保存します。ブラウザやサーバーを再起動してもレコードは残ります。小規模な1人用PoCでは、Bun専用SQLiteへの依存や追加パッケージを避け、NuxtのNode/Bunどちらでも動くJSONファイルを使用しています。複数サーバープロセス、リアルタイムのタブ間同期、停電時の耐久性保証には対応しません。

バックアップはサーバーを停止して保存ディレクトリをコピーしてください。復元時も停止中に同じ場所へ戻します。認証がないため、サーバーは`127.0.0.1`に限定し、インターネットや共有ネットワークに公開しないでください。静的生成だけではレコードAPIが動きません。

| API                                                   | 処理                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `GET /api/demo/persona`                               | HttpOnly Cookieが選択するデモペルソナと選択肢を返す                       |
| `POST /api/demo/persona`                              | `{ "persona": "employee" }`等でブラウザのデモペルソナを切り替える         |
| `GET /api/workspaces/:workspace/records`              | ペルソナから読めるIssueと履歴だけを返す                                   |
| `GET /api/workspaces/:workspace/projects`             | ペルソナから読めるProjectsとIssue件数を返す                               |
| `GET /api/views/issue-detail?workspace=…&issue=…`     | 読取可能なIssueの詳細構成・編集visibility・Workflow panelを含むSpecを返す |
| `POST /api/workspaces/:workspace/issues/:id/workflow` | `{ "action": "request-review" }`等を状態・役割検証後に実行                |
| `POST /api/workspaces/:workspace/issues`              | Issueを作成。`title`は必須。Statusはサーバー既定のTodo                    |
| `PATCH /api/workspaces/:workspace/issues/:id`         | Priority / Assignee / Project等を更新。Statusフィールドは拒否             |
| `POST /api/workspaces/:workspace/issues/:id/comments` | `{ "text": "コメント" }`を追加                                            |

`:workspace`は`orbit`または`sandbox`です。APIのペルソナ選択にはHttpOnly / SameSite Cookieを使いますが、デモユーザー自身が選び直せる値なので認証ではありません。サーバーの`server/utils/personas.ts`が読取可否、書き込み可否、Workflow遷移とManager承認を一元的に判定します。UIのボタン表示は補助であり、直接APIを呼んでも同じ検証が行われます。`GET records`と`GET projects`はフィルター済みデータだけを返し、Project不許可のIssue IDを直接指定したSpec読取・PATCH・コメントは404にします。読み取り可能なGuestによる書き込みは403です。型・選択値・空文字・長さ・未知フィールドを検証し、不正なリクエストには400、無効なWorkflow状態には409を返します。ID、作成日時、履歴の著者・本文はサーバーが生成します。保存成功後に返されたレコードで画面を更新し、失敗時には通知して入力を保持します。

承認の確認には初期データの`ENG-102`（In review）が使えます。Guestから隠れるDesign Systemは`ENG-117`〜`ENG-121`を含みます。Manager / Guestに切り替えても同じワークスペースの保存データを共有します。

localStorageには選択ワークスペースの設定`orbit:active-workspace`のみを保存します。旧ブラウザ保存のIssue・履歴は読み込まず、自動移行もしません。

## テーマ

トップバーの太陽・月アイコンでライト／ダークを切り替えます。初期設定はダークで、選択はNuxt Color Modeがブラウザに保存し、再読み込み後も維持します。切り替えにリロードは不要で、フィルターや適用済みのUI Specは保持されます。

配色は`app/assets/css/theme.css`の意味別トークンに集約しています。シェル、Registry、検索・新規作成ダイアログ、Inspect UI、およびNuxt UIの背景・文字・枠線が同じトークンを参照します。配色を調整する際はライト用の`:root`とダーク用の`:root.dark`を更新してください。テーマはクライアント設定であり、サーバーのSpecは変更しません。

## Inspect UI

Issue詳細を開いたときだけトップバーに現れるコードアイコン（Inspect UI）から、完全なIssue detail SpecをJSONで確認・編集できます。`Apply`または`⌘ / Ctrl + Enter`で構造・Catalog・Action名を検証し、リロードなしでRendererへ反映します。Issue一覧・My issues・ProjectsのSpecはInspectorの対象外です。無効なJSONやSpecはエラーを表示し、表示中のSpecは変更しません。

適用済みの編集は`app/app.vue`のメモリに保持されます。`Restore server spec`で元のSpecに戻し、未適用の入力も破棄できます。Issue / Persona / Workflow状態が変わると、サーバーからSpecを取り直し一時上書きを破棄します。上書きはlocalStorageにもサーバーにも保存せず、ページの再読み込みで消えます。SpecのActionをクライアントで改変しても、対象Issue・現在Status・選択Personaはサーバーで再検証します。

## 動的配信への拡張

1. view Specを拡張するときは`server/utils/view-specs.ts`の生成結果と`shared/catalog.ts`の許可リストを一緒に更新します。
2. 複数ユーザー運用に転用する前に実認証・セッション保護・CSRF対策・サーバー側の信頼できるIdentityを導入します。このPoCのCookie値を本番の権限根拠にしてはいけません。
3. 複数プロセスや利用者に拡張する場合は`server/utils/records.ts`のファイル保存をDB / トランザクションへ置き換え、同じサーバーpolicyをサービス層で維持します。

ブラウザテストでは、サーバーSpecによるIssue一覧・Projects・詳細構成、repeat rows/cards/activity、Persona / Issue状態ごとのvisibility、クライアント限定Inspect編集、stale request保護とWorkflow再取得を検証します。APIテストではGuestの読取範囲と、直接Issue・Project・コメント・Status・承認APIを呼ぶ権限迂回を検証します。レコードAPIの入力検証・ファイルへの保存・ワークスペース分離・サーバー再起動後の保持・破損ファイルの保護と、画面での保存失敗時の入力保持も検証しています。
