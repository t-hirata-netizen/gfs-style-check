# 投資スタイル診断

> **【2026-10-13 移転】投資スタイル診断の本番は https://t-hirata-netizen.github.io/gfs-kabu-shindan/ （リポジトリ `t-hirata-netizen/gfs-kabu-shindan`、作業場所 `~/gfs-style-check-chara`、ブランチ `chara`）に移りました。**
> このリポジトリの `index.html` は、古いURLを開いた人を新しいURLへ移すだけのページです（`?…` と `#…` も引き継ぐ）。
> 診断を直すときは `~/gfs-style-check-chara` の CLAUDE.md を読んでください。下の内容は、移転前の記録として残しています。
> `score.js` は、移転の直後にブラウザに古いページが残っている人のために置いたままにしています（消さない）。


GFSの講義「あなたの株式投資はテクニカル？ファンダメンタルズ？」の補助ツールです。
22問の4段階回答で、テクニカル派／ファンダメンタルズ派を判定し（判定に使うのは20問）、次に見る講義を案内します。

- `index.html` と `score.js`（判定ロジック）だけで動きます。サーバー・ビルド不要
- 判定はブラウザ内で行います。途中経過は端末のブラウザに保存します
- 診断の改善のため、結果（タイプ・割合・各問の回答・日付）を匿名で Googleスプレッドシートに集計しています。名前・会員ID・メールなど、個人を特定できる情報は集めません（`tools/collect.gs`）
- GitHub Pages で公開: Settings → Pages → Branch: `main` / `(root)`

## 手直しする場所（index.html 内）
- 質問文：`const Q=[` の配列（`[軸番号, "Aの文", "Bの文"]`）
- タイプ名・説明：`const TYPES={`
- 講義の一覧（講師名・URL）：`const COURSES={`
- 4つの軸の名前：`const AXES=[`
- 判定ロジック・どの講義を出すか：`score.js`
- 軸ごとの解説文：`const AXES=[` の `na` / `nb` / `nm`
- LINE などで URL を送ったときの画像：`og/default.png`（`sh tools/make-og.sh` で作り直す）
- GFS 生徒向けのため、シェア機能は置かず、検索結果にも出さない（`noindex`）

## テスト
判定ロジックの単体テスト（Node 18 以上）：`npm test`
