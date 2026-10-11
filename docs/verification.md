# 検証記録

## 範囲

Orbitのライト／ダーク両テーマの4画面、共通シェル、新規作成・検索ダイアログ、Inspect UIを対象に、Nuxt 4 / Nuxt UI 4 / json-render 0.21.0の実装と描画を確認しました。デザイン規約は`AGENTS.md`、依存関係と既存設定を参照しています。初期プロジェクトに独自のデザインシステム文書はありませんでした。

## 検証結果

| コマンド                                                  | 結果                                                        |
| --------------------------------------------------------- | ----------------------------------------------------------- |
| `vp check --fix`                                          | フォーマット・lint・TypeScriptチェック成功                  |
| `vp run typecheck`                                        | Vue SFCを含む型チェック成功、exit 0                         |
| `vp run build`                                            | CSRクライアントとNitro APIの本番ビルド成功、exit 0          |
| `vp exec playwright test tests/browser/inspector.spec.ts` | Inspect UIの3テスト成功、exit 0                             |
| `vp exec playwright test tests/browser/theme.spec.ts`     | テーマの3テスト成功、exit 0                                 |
| `vp exec playwright test`                                 | 本番ビルドをBunで自動起動し、Chromiumの16テスト成功、exit 0 |
| `git diff --check`                                        | 空白エラーなし                                              |

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
- Inspect UIでのJSON・画面構造編集、Apply前の非反映、Apply後のリロードなしの反映、Actionの維持。
- 不正JSON・参照・Actionの拒否、サーバーSpecへの復元、閉じる操作後のフォーカス復帰。
- Inspect UIの4画面への追従と320px幅、画面移動後の適用済みSpec保持、再読み込み後の破棄、サーバーSpecの不変と書き込みリクエストがないこと。
- ライト／ダークの4画面、検索・作成ダイアログ、Inspect UIと320px幅、テーマ選択の再読み込み後の保持。
- テーマ切り替え中のフィルター・適用済みSpecの維持とサーバーSpecの不変。
- 両テーマの代表文字、アバター、選択行・hover、作成ボタン、Inspect UIのエラー文字のコントラスト比が4.5:1以上であること。半透明のアバター背景は親背景と合成して測定。
- 全クライアントJSチャンクが500,000 bytes以下であること。
- Inspect UI・新規作成モーダルの実装コードが初期取得したJSに含まれず、初回に開くと取得されること。再度開いてもJSリクエストが増えないこと。

Playwrightはポート3100の既存サーバーを再利用せず、検査対象の`.output`をBunで起動します。

スクリーンショットは`test-results/all-issues.png`、`issue-detail.png`、`projects.png`、`mobile.png`です。開発サーバーのスクリーンショットを目視確認し、本番版でも同じテストを実行しています。ライト／ダークの代表スクリーンショットも目視確認しました。テーマの画像は`test-results/theme-{light,dark}-{issues,projects,detail,modal,inspector,mobile}.png`に保存し、撮影時はアニメーションを完了状態にしています。主フローではJavaScript例外・console errorが発生しないことも検証しています。

## UIレビューのカバレッジ

| Domain        | Evidence inspected                                                                            | Result                                               |
| ------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Accessibility | 操作テストは実施。専門Skillは利用できない                                                     | Not reviewed（専門監査は未実施）                     |
| Layout        | `app/assets/css/main.css`、4画面のスクリーンショット、320px / 720pxでのレイアウト検証         | Clear（検証範囲内）                                  |
| Writing       | 専門Skillは利用できない                                                                       | Not reviewed                                         |
| Typography    | 専門Skillは利用できない                                                                       | Not reviewed                                         |
| Colors        | `theme.css`、両テーマのスクリーンショットと`theme.spec.ts`による代表文字の測定                | Partial（確認箇所は4.5:1以上。網羅的な監査は未実施） |
| UI polish     | `AppShell.vue`、`NewIssueModal.vue`、`main.css`のhover・focus・選択・reduced-motion定義と描画 | Clear（検証範囲内）                                  |

No actionable interface findings（上記の確認済み範囲内）。

RTL、翻訳文字列、実ブラウザのズーム倍率変更、スクリーンリーダー、アニメーションの低速再生はNot verifiedです。720px幅テストは実際の200%ズーム操作を行ったものではありません。

## 注意事項

- 既存のVite Plus設定を維持しているため、Nuxtの開発時に外部`vite.config.ts`の警告が出ます。Nuxtの設定は`nuxt.config.ts`に記述しています。
- 本番ビルドの最大クライアントJSチャンクは約288kB（ビルド表示のgzip約79kB）で、500kB超過の警告はありません。分割は総転送量や初期表示速度の改善を保証するものではありません。
- データはブラウザ内のモックです。複数タブ・端末間の同期、認証・権限、実データAPIは対象外です。

## Verdict

Approve（確認済みのLayout / UI polishのみ）。Colorsは代表文字の部分的な測定、Accessibility / Writing / TypographyはNot reviewedであり、包括的なアクセシビリティ・デザイン監査を保証するものではありません。
