# お題の改行位置と文字の大きさの自動調整

## 背景

`docs/spec-design-l.md` で読みを 38px にした結果、実機で次の問題が出た。

- 文字単位で折り返すので、「あめあがりのそらに|にじが…」のように言葉の途中で改行される
- 長い文は読みが3行以上になり、play 画面の高さが決まっていないので、NEXT とコンボがページごと押し下げられて、固定されたキーボードの裏に回り込む

あわせて、`src/data/prompts.json` の 60 件のうち 34 件が同じ文の繰り返しだった。これは Claude Code が作り直し済み(60 件すべて別の文、難易度 1〜3 が 20 件ずつ、文節の区切り付き)。

## 変更対象

触るファイル:

- `src/game/prompts.ts` — `Prompt` 型に `chunks` を足す。改行してよい位置を返す純粋関数を足す
- `src/screens/play.ts` — 文節の区切りで改行する描き方と、文字の大きさの自動調整
- `src/style.css` — play 画面の高さの固定と、改行の指定
- `tests/prompts.test.ts` — データの検査を足す

触らないファイル:

- `src/data/prompts.json` — Claude Code が作成済み。**中身を変えない**(テストが落ちたら止めて報告する)
- `src/game/session.ts`・`judge.ts` ほか `src/game/**` の判定と進行、`src/anticheat/**`、`src/keyboard/**`
- `package.json` などの設定、`AGENTS.md` / `CLAUDE.md` / `docs/**`

## 仕様

### 1. お題のデータ

`prompts.json` の1件はこの形になっている:

```json
{
  "id": "p044",
  "text": "雨上がりの空に大きな虹が見えた。",
  "reading": "あめあがりのそらにおおきなにじがみえた。",
  "chunks": [
    ["雨上がりの", "あめあがりの"],
    ["空に", "そらに"],
    ["大きな", "おおきな"],
    ["虹が", "にじが"],
    ["見えた。", "みえた。"]
  ]
}
```

- `chunks` は文節ごとの `[漢字かな混じり, 読み]`。1つ目をつなげると `text`、2つ目をつなげると `reading` になる
- `Prompt` 型: `{ id: string; text: string; reading: string; chunks: [string, string][] }`
- 判定と進行は、今までどおり `reading` だけを使う(`chunks` は表示専用)

`src/game/prompts.ts` に純粋関数を足す:

```ts
/** 改行してよい位置(その文字の直前で改行してよい index)。先頭の 0 は含めない */
export function breakIndexes(chunks: string[]): number[];
```

- 例: `breakIndexes(["あめあがりの", "そらに", "にじが"])` → `[6, 9]`
- 読みにも漢字の文にも使う(`chunks.map(c => c[1])` と `chunks.map(c => c[0])`)

### 2. 文節の区切りで改行する

- 読み・漢字の文とも、`breakIndexes` の位置にだけゼロ幅スペース(U+200B)を挟んで描く
- `.reading` と `.kanji` に `word-break: keep-all; overflow-wrap: anywhere;` を指定する。これで改行はゼロ幅スペースの位置だけで起き、1つの文節が1行に入りきらないときだけ文節の途中で折り返す
- 読みの色分け(打ち終えた文字・今の文字・残り)は、今までどおり1文字ずつ。ゼロ幅スペースは今の文字の強調の中に入れない(文字と文字の**間**に置く)
- 保留中の文字(`pending`)の出し方は変えない

### 3. 文字の大きさの自動調整

- 読みの大きさを CSS 変数 `--reading-size`(既定 38px)、漢字の文を `--kanji-size`(既定 23px)にする。どちらも `.prompt-area` に置く
- お題が変わったとき(`promptIndex` が変わったとき)と、画面の大きさが変わったとき(`resize`)に、次の手順で合わせる:
  1. `--reading-size: 38px`、`--kanji-size: 23px` に戻す
  2. お題の中身がお題の枠(`.prompt-area`)に収まっていなければ(`scrollHeight > clientHeight`)、読みを 2px 小さくし、漢字の文を `round(読み × 23 / 38)` にする。収まるか、読みが 24px になるまで繰り返す
- 毎フレームの描き直しでは測らない(お題が変わったときだけ)
- カウントダウン中(お題が見えていないとき)も、1文目の大きさはこの手順で決めておく

### 4. play 画面の高さを固定する

- `.play` の高さを画面の高さに固定する(`height: 100dvh`、`overflow: hidden`)。`min-height` で伸びないようにする
- `.prompt-area` は伸び縮みする部分(`flex: 1; min-height: 0; overflow: hidden`)。NEXT とコンボはその下で、常にキーボードのすぐ上に見える
- キーボードの大きさと位置(`--kb-height-ratio`・`--kb-bottom-offset`)は変えない

## 受け入れ条件

実装担当が確かめること:

- [ ] `npx.cmd tsc --noEmit` / `npm.cmd test` / `npm.cmd run build` / `npm.cmd run format:check` が通る
- [ ] `tests/prompts.test.ts` に次を足し、通る:
  - `text` が 60 件すべて異なる
  - どの件も、`chunks` の1つ目をつなげると `text`、2つ目をつなげると `reading` になる
  - `chunks` の要素に空文字がない
  - 難易度 1〜3 がそれぞれ 20 件
  - `breakIndexes` の例(上の例と、1文節だけのときは `[]`)
- [ ] `src/data/prompts.json`、`src/game/session.ts`、`src/game/judge.ts`、`src/anticheat/**`、`src/keyboard/**` に差分がない

Claude Code とオーナーが実機で確かめること:

- [ ] 改行が文節の区切りだけで起きる
- [ ] 長い文(例: p041「新しい靴で近所の道をゆっくり歩いた。」、読み 25 字)でも、NEXT とコンボがキーボードに隠れない
- [ ] 短い文は 38px のまま

## 対象外

- お題の中身の変更(作成済み)
- ゲームのルール、判定、不正対策の変更
- 横向き・タブレットでの見え方

## 想定される落とし穴

- **ゼロ幅スペースと判定**: ゼロ幅スペースは表示にだけ入れる。`reading` の文字列や判定の index に混ぜない
- **測る前の描画**: 大きさを測るのは、お題の DOM を描いたあと(同じフレーム内で `paint()` のあとに測ってよい)。フォント(LINE Seed JP)の読み込みが終わると幅が変わるので、`document.fonts.ready` のあとにも一度合わせ直す
- **`100dvh` の対応**: 古いブラウザ向けに、`height: 100vh` を先に書いてから `height: 100dvh` で上書きする
