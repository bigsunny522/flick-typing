# flick_typing

スマホ専用のフリック入力タイピングゲーム。物理キーボード・外部入力ツール・自動入力スクリプトを弾き、画面上のフリック操作だけで遊べるようにする。自前のフリックキーボードと、OS の標準キーボードの2つのモードがある。

このファイルは Claude Code と実装担当(実装を受け持つコーディングエージェント)の共通ガイド。リポジトリの事実(構成・コマンド・規約)はここに書き、Claude Code 固有の指示は `CLAUDE.md` に書く。同じことを2か所に書かない。

## プロジェクト

- 絶対パス: `G:\myApp\flick_typing`
- スタック: Vite + TypeScript(フレームワークなし)、テストは Vitest。配信は Cloudflare Workers(静的アセット + `worker/`、GitHub 連携の Workers Builds)

## 構成

```
docs/            仕様書(docs/spec-<機能名>.md)
src/screens/     画面(タイトル・プレイ・結果・ブロック)
src/keyboard/    フリックキーボードの配列・読み取り・描画
src/game/        判定・ゲーム進行・お題(DOM に触れない純粋な関数)
src/anticheat/   環境チェック・挙動分析・入力ログ(DOM に触れない純粋な関数)
src/native/      標準キーボードのモードの隠した入力欄(DOM)
src/data/        お題の JSON
src/stats/       結果の送信データのチェック・集計(DOM に触れない純粋な関数。Worker でも使う)
src/ranking/     ランキングの名前・期間・API の型(DOM に触れない純粋な関数。Worker でも使う)
src/stats-page/  集計ページ(/stats)の描画
worker/          Cloudflare Worker の入口(/api/* を処理し、ほかは dist の静的アセットを返す)
migrations/      D1 のテーブル定義
tests/           Vitest
```

## 役割分担

設計とレビューは Claude Code、実装と修正は実装担当が担当する(`~/.claude/CLAUDE.md` のとおり)。

1. Claude Code が `docs/spec-<機能名>.md` を書く
2. 実装担当が仕様書のとおりに実装し、「確認コマンド」を通す
3. Claude Code が `git diff` を読んでレビューし、指摘を `ファイル:行` / 事象 / 再現条件 / 根拠 の形で返す
4. 実装担当が指摘を直す。2〜4 を繰り返す
5. Claude Code がコミットする

仕様書にない判断が要るときは、実装で決めずに止めて聞く。

## 確認コマンド

実装を終えたら、次をすべて実行して通すこと(2026-09-25 にツールが動くことを確認済み)。Windows の PowerShell では `npm.cmd` / `npx.cmd` を使う。

```
npx.cmd tsc --noEmit
npm.cmd test
npm.cmd run build
npm.cmd run format:check
```

`worker/` を触ったとき(`docs/spec-result-stats.md` の実装以降)は、`npm.cmd run typecheck:worker` も通すこと。

## 守ること

- コミット・push・デプロイはしない(レビュー後に Claude Code が行う)
- ファイルは UTF-8 のまま保つ。ソース編集は `apply_patch` を優先し、PowerShell のテキスト入出力で書き戻さない
- 依存の追加が要るときは、実装を止めて聞く
- 整形は `npm.cmd run format`(Prettier)でそろえる。コードは人が読む前提で書く。インデントは2スペース、1行に1文、1行はおおむね100文字以内。複数の文を1行に詰めたり、圧縮したような書き方をしたりしない
- テストは1つの `it` で1つの振る舞いを確かめる。仕様書に表があるときは、表の1行ごとにテストを書く
- `src/game/` と `src/anticheat/` では DOM・`Date.now()`・`Math.random()` を使わない(サーバー側で同じコードを使って入力ログを再計算するため)。例外はブラウザから値を集める `src/anticheat/env.ts` の `collectEnv` だけ
- `src/stats/` と `src/ranking/` では上に加えて localStorage・`import.meta.env` も使わない(Cloudflare Workers の上で動かすため)。`src/storage.ts` などブラウザ側のファイルからは型も含めて import しない(`PlayMode` は `src/game/mode.ts` にある)
- `wrangler.jsonc` は変えない(Claude Code が管理する。Worker 名・D1 のバインディングが書いてあり、GitHub からのデプロイがこれを使う)
- 入力は自前のフリックキーボード UI と、標準キーボードのモードの `src/native/field.ts` からだけ受け付ける。それ以外の場所で OS の IME・`<input>`/`<textarea>`・`keydown` を入力経路にしない(例外は開発用の `src/probe/` と、ランキングのニックネームを入れる `src/screens/name-form.ts`。後者はゲームの判定に何もつながない)
