# 回転寿司へいお待ち！

回転寿司のレーンを使ったブラウザゲームです。

## 遊び方
- お客さんの頭の上に **食べたい寿司** が浮かびます。
- 画面下の **具材ボタン**（またはキーボード 1〜9・0）を押すと、その寿司を食べたいお客さんの前のレーンに皿が置かれます。
- お客さんの前にすでに皿がある場合は、その **後ろの空いているところ** に置かれます。
- お客さんが取れるのは **目の前を流れてきた皿だけ**。食べたい寿司ならそのまま取ってくれます。
- 誰も注文していない寿司を出すと、そのまま回転寿司として流れ続けます（2周すると廃棄 −20円）。
- 待たせすぎるとお客さんは怒って帰ります。5人怒らせると閉店。制限時間は90秒。
- トップ10に入ると名前を登録してランキングに残せます（記録はそのブラウザに保存）。
- スマホを縦持ちすると、縦長の大きい画面レイアウトになります。
- 結果画面から X・LINE・共有メニュー（またはリンクのコピー）でシェアできます。
- 英語にも対応しています。ブラウザが日本語以外なら英語版が開きます（各ページの「EN／日本語」で切り替え）。
- 画面右上の「❚❚」ボタン（または P キー）で一時停止。BGM の ON/OFF は一時停止画面（または M キー）で切り替えます。

## 具材（10種類）
| キー | 具材 | 種類 | 値段 |
|---|---|---|---|
| 1 | マグロ | 握り | 150 |
| 2 | ハマチ | 握り | 150 |
| 3 | サーモン | 握り | 120 |
| 4 | いくら | 軍艦 | 250 |
| 5 | うに | 軍艦 | 300 |
| 6 | 数の子 | 握り | 200 |
| 7 | イワシ | 握り | 120 |
| 8 | 味噌汁 | サイド | 180 |
| 9 | カリフォルニアロール | 巻物 | 200 |
| 0 | 穴子 | 握り | 200 |

## お客さん
奥のカウンターに5席、手前のカウンターに5席、最大10人が座ります。
手前のお客さんは後ろ姿で、注文の吹き出しはレーンの内側に出ます。

## ファイル構成
| ファイル | 内容 |
|---|---|
| `index.html` | トップページ |
| `howto.html` | 遊び方ページ |
| `game.html` / `game.js` / `style.css` | ゲーム本体 |
| `ranking.html` / `ranking.js` | ランキング（ブラウザの localStorage に保存） |
| `en/` | 英語版のトップ・遊び方・ランキング |
| `i18n.js` | 言語の判定（日本語／英語） |
| `pages.css` | トップ・遊び方ページのスタイル |
| `assets/` | ページ用のゲーム画面画像（`assets/app/` はアプリのアイコン・起動画面の元画像） |
| `ads.js` / `ads-config.js` / `build-info.js` | 広告とバージョン表示（Android アプリのときだけ動く） |
| `android/` | Android アプリのプロジェクト（Capacitor） |
| `docs/store/` | Google Play の掲載文の下書き（`listing.md`）とストア用の画像 |

## 公開（GitHub Pages）
https://techgymjp.github.io/sushi/

`main` にプッシュすると `.github/workflows/pages.yml` が自動で GitHub Pages にデプロイします。
ローカルでは `index.html` をブラウザで開くだけで遊べます。

## Android アプリ

[Capacitor](https://capacitorjs.com/) でゲームのファイルをアプリに同梱し、Android アプリにしています（オフラインで遊べます）。
構成は techgymjp/jet-fighter の `docs/ANDROID_PORTING.md`、techgymjp/jackal と同じです。

- パッケージ名: `jp.techgym.sushi`
- アプリ名: ストアは「回転寿司へいお待ち！」（英語 Conveyor Sushi: Hei Omachi!）、ホーム画面は「へいお待ち」（英語の端末では Hei Omachi）
- 縦画面固定・全画面・プレイ中は画面を消さない
- アプリでは `game.html` をそのまま `index.html` として使い、トップ画面に「開店する」「あそびかた」「ランキング」を出す（あそびかた・ランキングはアプリ内の画面）
- 戻るボタン: プレイ中は一時停止（一時停止中なら再開）、あそびかたはトップへ、トップ・結果画面ではアプリを終了
- 別アプリに切り替えると自動で一時停止して音を止める
- シェアは Android の共有メニュー
- 広告（AdMob）
  - バナー: トップ・あそびかた・一時停止・結果画面の下中央（プレイ中はボタンと重なるので出さない）
  - 全画面広告（インタースティシャル）: 「開店する」（トップ・あそびかたから）、「トップに戻る」（あそびかた・一時停止・結果から）、一時停止からの「再開」、結果画面の「もう一度」のたびに毎回
  - リワード広告（チート）: 5 人目を怒らせて閉店になるとき、「広告を見て呼び戻す」で最後に怒って帰ったお客さんが同じ注文で戻ってきて営業を続けられる（1 ゲーム 3 回まで。帰っていく様子を見届けられるよう 2.5 秒後に出し、6 秒で自動的に閉店）。使ったことは結果画面とシェア文に「呼び戻し N 回」と出る
  - EU など同意が必要な地域ではトップ画面に「広告の設定」
- トップ画面にバージョン（ビルド番号）とプライバシーポリシーへのリンク

ビルドは GitHub Actions（`.github/workflows/android.yml`）で行います。

1. `npm ci` → `npm run build`（`www/` に Web ファイルをコピーし、`ads-config.js` と `build-info.js` を生成）→ `npx cap sync android` → `./gradlew assembleDebug`
2. 既定ブランチなら、Release `android-latest` の `sushi.apk` を差し替え（動作確認用・テスト広告）
   - リリース画面: https://github.com/techgymjp/sushi/releases/tag/android-latest （QR コード: `docs/apk-qr.png`）
   - APK 直接: https://github.com/techgymjp/sushi/releases/latest/download/sushi.apk
3. GitHub Secrets に署名鍵（`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD`）があれば、本番広告で署名付き AAB を作り Artifact（`sushi-release-aab`）に上げる

![動作確認用 APK のリリース画面の QR コード](docs/apk-qr.png)

AdMob のアプリ ID は `android/app/src/main/res/values/strings.xml` の `admob_app_id`、本番の広告ユニット ID は `ads.js` の `UNITS.android.production`（今はバナーだけ。インタースティシャルとリワードは空）にあります。
動作確認用 APK はどれもテスト広告、Google Play 用の AAB は本番の広告です（広告ユニット ID が空の種類は出さない）。

手元で試すとき: `npm install` → `npm run android:sync` → `npm run android:open`（Android Studio が必要）。
アイコンと起動画面は `assets/app/` の元画像から `npx @capacitor/assets generate --android --assetPath assets/app` で生成しています。

## ライセンス

著作権はテックジム株式会社に帰属します（All rights reserved）。許可なく複製・改変・再配布すること、Web サイトやアプリとして公開・販売すること、名前・ロゴ・アイコン・画像を使うことを禁止します。
テックジムの受講生が学習目的で複製・改変することは許可しますが、アプリストアでの公開・広告の掲載・販売などの商用利用は禁止し、著作権表示を残してください。詳しくは `LICENSE` を見てください。
