# オンクラスエンハンサー

オンクラス（THE ONLINE CLASS）の機能を拡張するChrome拡張機能です。

## 機能

### カテゴリ自動移動
新規作成したカテゴリを自動で先頭に移動します。

- ポップアップで「カテゴリ自動移動」をONにする
- カテゴリ管理画面で新規カテゴリを作成
- 自動で先頭に移動してページがリロードされる

### 感想エクスポート
受講者の感想を一括でエクスポートできます。

- 期間指定によるフィルタリング
- 全ページ一括取得
- JSON/CSV形式でダウンロード

## インストール

1. このリポジトリをクローン
   ```bash
   git clone https://github.com/atani/onclass-enhancer.git
   ```

2. 依存関係をインストール（テスト実行用）
   ```bash
   cd onclass-enhancer
   npm install
   ```

3. Chromeで `chrome://extensions` を開く

4. 「デベロッパーモード」をONにする

5. 「パッケージ化されていない拡張機能を読み込む」をクリック

6. `onclass-enhancer` ディレクトリを選択

## 使い方

### カテゴリ自動移動
1. 拡張機能のアイコンをクリックしてポップアップを開く
2. 「カテゴリ自動移動」のトグルをONにする
3. オンクラス管理画面でカテゴリを新規作成する
4. 自動で先頭に移動される

### 感想エクスポート
1. オンクラス管理画面の感想ページを開く
2. 拡張機能のアイコンをクリックしてポップアップを開く
3. 必要に応じて期間を指定
4. 「全ページ一括取得」または「このページのみ」をクリック

## 開発

### テスト実行
```bash
npm test
```

### ファイル構成
```
onclass-enhancer/
├── manifest.json      # 拡張機能の設定
├── popup.html         # ポップアップUI
├── popup.js           # ポップアップのロジック
├── injector.js        # ページスクリプト注入用Content Script
├── page-script.js     # カテゴリ自動移動（ページコンテキスト）
├── content.js         # 感想エクスポート機能
├── utils.js           # ユーティリティ関数
├── utils.test.js      # テスト
├── icons/             # アイコン画像
└── README.md
```

## サポート

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-%E2%9D%A4-ea4aaa?logo=github)](https://github.com/sponsors/atani)

## ライセンス

MIT
