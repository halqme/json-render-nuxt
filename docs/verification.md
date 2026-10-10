# 検証記録

## 範囲

Orbitの4画面、共通シェル、新規作成・検索ダイアログを対象に、Nuxt 4 / Nuxt UI 4 / json-render 0.21.0の実装と描画を確認しました。デザイン規約は`AGENTS.md`、依存関係と既存設定を参照しています。初期プロジェクトに独自のデザインシステム文書はありませんでした。

## 検証結果

| コマンド           | 結果                                                       |
| ------------------ | ---------------------------------------------------------- |
| `vp check --fix`   | フォーマット・lint・TypeScriptチェック成功                 |
| `vp run typecheck` | Vue SFCを含む型チェック成功、exit 0                        |
| `vp run build`     | CSRクライアントとNitro APIの本番ビルド成功、exit 0         |
| `vp run test`      | 本番ビルドをBunで自動起動し、Chromiumの8テスト成功、exit 0 |
| `git diff --check` | 空白エラーなし                                             |

ブラウザテストの内容は次の通りです。

- 4つのSpec API、未知のViewの404、Specのイベント・ネストしたrepeatの保持、未知のActionと不正参照の拒否。
- APIから渡すSpecのみを変更した見出し・タブ構造の差し替えと、新規作成Actionの動作。
- My issues / All issues / Projects間の遷移、詳細、検索と複合フィルター、選択、作成、プロジェクトのIssueへの遷移。
- ステータス・担当者の変更、履歴、コメント、再読み込み後の永続化。
- コマンドパレットの全件検索とキーボード操作、ブラウザの戻る操作。
- Orbit / Orbit Sandbox間のデータ分離、選択ワークスペースの永続化。
- 320px幅の一覧・詳細・プロジェクト・作成ダイアログ、横方向のページあふれがないこと。
- 1440px幅を200%にした場合に相当する720px幅のレイアウト。
- API失敗時のエラー表示とRetryによる復帰。

スクリーンショットは`test-results/all-issues.png`、`issue-detail.png`、`projects.png`、`mobile.png`です。開発サーバーのスクリーンショットを目視確認し、本番版でも同じテストを実行しています。主フローではJavaScript例外・console errorが発生しないことも検証しています。

## UIレビューのカバレッジ

| Domain        | Evidence inspected                                                                            | Result                                           |
| ------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Accessibility | 操作テストは実施。専門Skillは利用できない                                                     | Not reviewed（専門監査は未実施）                 |
| Layout        | `app/assets/css/main.css`、4画面のスクリーンショット、320px / 720pxでのレイアウト検証         | Clear（検証範囲内）                              |
| Writing       | 専門Skillは利用できない                                                                       | Not reviewed                                     |
| Typography    | 専門Skillは利用できない                                                                       | Not reviewed                                     |
| Colors        | 専門Skillは利用できない                                                                       | Not reviewed（網羅的なコントラスト測定は未実施） |
| UI polish     | `AppShell.vue`、`NewIssueModal.vue`、`main.css`のhover・focus・選択・reduced-motion定義と描画 | Clear（検証範囲内）                              |

No actionable interface findings（上記の確認済み範囲内）。

RTL、翻訳文字列、実ブラウザのズーム倍率変更、スクリーンリーダー、アニメーションの低速再生はNot verifiedです。720px幅テストは実際の200%ズーム操作を行ったものではありません。

## 注意事項

- 既存のVite Plus設定を維持しているため、Nuxtの開発時に外部`vite.config.ts`の警告が出ます。Nuxtの設定は`nuxt.config.ts`に記述しています。
- 本番ビルドには500kBを超えるクライアントチャンクの警告が残っています（約753kB、gzip約219kB）。機能テストとビルドは成功しています。
- データはブラウザ内のモックです。複数タブ・端末間の同期、認証・権限、実データAPIは対象外です。

## Verdict

Approve（確認済みのLayout / UI polishのみ）。Accessibility / Writing / Typography / ColorsはNot reviewedであり、包括的なアクセシビリティ・デザイン監査を保証するものではありません。
