# 読みを1行で流す表示(ティッカー)

## 背景

`docs/spec-prompt-fit.md` で読みを文節で改行し、枠に合わせて縮めるようにしたが、実機では長い文で改行が崩れる場面が残った。オーナーと相談して、**読みは改行しない1行にし、今打つ文字を決まった位置に置いたまま、行のほうを左へ流す**表示に変える。

モックアップ: https://claude.ai/artifact/EfgcS4ATUCq1ohT7tK9nTj の「案L — プレイ中」(自動で打ち進むデモ)。**この仕様書が正で、モックは参考**。

判定・進行・不正対策・お題のデータは変えない。

## 変更対象

触るファイル:

- `src/screens/reading-ticker.ts` — 新規。読みの1行表示の部品
- `src/screens/play.ts` — 読みの描き方をティッカーに置き換える。文字の大きさの自動調整をなくす
- `src/style.css` — ティッカーの見た目。`--reading-size` / `--kanji-size` の自動調整用の指定を整理する

触らないファイル:

- `src/game/**`(`breakIndexes` もそのまま残す。漢字の文の改行で使い続ける)、`src/anticheat/**`、`src/keyboard/**`、`src/data/**`
- `tests/**` — 既存のテストはそのまま通ること
- `package.json` などの設定、`AGENTS.md` / `CLAUDE.md` / `docs/**`

## 仕様

### 1. 画面の中の配置

お題の枠(`.prompt-area`)の中を、上から次の順にする。

```
── No. 07
雨上がりの空に大きな虹が見えた。      ← 漢字の文(今までどおり。文節で改行)
                                          (12px)
|░░あめあがりのそらに[お]おきなにじがみ░░|  ← ティッカー(画面の横幅いっぱい)
                    ━━                    ← 目印の線
```

- 漢字の文は今までどおり 23px 700 `--muted`。改行は `breakIndexes` の位置だけ(ゼロ幅スペース+`word-break: keep-all`)。**自動で縮める処理はなくす**
- ティッカーは画面の左右の余白(24px)を打ち消して、**画面の横幅いっぱい**に広げる(`margin-inline: -24px` など)
- ティッカーの下に、今の文字の位置を示す線(高さ 3px、`--primary`、角丸 2px)。幅は今の文字の幅と同じ

### 2. ティッカーの見た目

- 高さ 80px、`overflow: hidden`
- 左右の端をフェードさせる: `mask-image: linear-gradient(90deg, transparent 0, #000 26%, #000 84%, transparent 100%)`(`-webkit-mask-image` も書く)
- 中の1行: `display: flex`、折り返さない。読みの1文字を1つの `<span>` にする
- 文字: LINE Seed JP 800 **46px**、高さ 64px、行の高さ 64px、左右の余白 1px、角丸 10px
  - 打ち終えた文字: `--typed`
  - 今の文字: 主色の面+`--primary-ink`
  - これから打つ文字: `--fg`
  - ミスしたとき: 今の文字の面を 0.2 秒 `--miss`(今の仕組みのまま)
  - 状態が変わっても文字の幅が変わらないこと(余白・枠の太さを全部の文字で同じにして、色と面だけを切り替える)
- 保留中の文字(`pending`): 今の文字の `<span>` の上に小さく出す(16px 800 `--primary-strong`)。`data-pending` 属性と `::before { content: attr(data-pending) }` で出すとよい

### 3. 流れる動き

- **基準の位置** = ティッカーの幅 × 0.28(左端から)
- 今の文字の左端が基準の位置に来るように、1行を `translateX(基準の位置 − 今の文字の offsetLeft)` で動かす
- `transition: transform 0.14s ease-out`
- 文が変わったとき: 1行を作り直し、**動きなしで**1文字目を基準の位置に置く(`transition: none` で位置を決め、再描画させてから `transition` を戻す)
- 画面の大きさが変わったとき(`resize`)と、フォントの読み込みが終わったとき(`document.fonts.ready`)に、位置を計算し直す
- `prefers-reduced-motion: reduce` のときは `transition: none`
- 目印の線も、今の文字の幅に合わせる(位置は基準の位置で固定)

### 4. 部品の分け方と描き直しの頻度

`src/screens/reading-ticker.ts` に部品として切り出す:

```ts
export type ReadingTicker = {
  /** 新しい文を表示する(1行を作り直し、動きなしで1文字目に合わせる) */
  setReading(reading: string): void;
  /** 状態を反映する(文字のクラスと位置の更新だけ。1行は作り直さない) */
  update(index: number, pending: string | null, miss: boolean): void;
  /** resize などで位置を計算し直す */
  relayout(): void;
  destroy(): void;
};
export function createReadingTicker(host: HTMLElement): ReadingTicker;
```

- `play.ts` は、**文が変わったときだけ** `setReading` を呼び、漢字の文と「No. 07」も作り直す
- 打鍵などで状態が変わったときは `update` だけを呼ぶ。今の `paint()` のように、毎フレーム読みの `innerHTML` を書き換えない(書き換えると `transition` が効かない)
- 毎フレームの `paint()` で更新してよいのは、タイマー・バー・ボーナス・コンボ・PERFECT・NEXT など、ティッカー以外の部分
- `update` の中で、同じ値なら何もしない(毎フレーム呼ばれても DOM を触らない)
- プレイが終わるとき(`stop`)に `destroy` で `resize` のリスナーを外す
- 今の `adjustPromptSize`、`measuredPromptIndex`、読みのゼロ幅スペースの処理は消す

## 受け入れ条件

実装担当が確かめること:

- [ ] `npx.cmd tsc --noEmit` / `npm.cmd test` / `npm.cmd run build` / `npm.cmd run format:check` が通る
- [ ] `src/game/**`、`src/anticheat/**`、`src/keyboard/**`、`src/data/**`、`tests/**` に差分がない
- [ ] `play.ts` の毎フレームの処理(`requestAnimationFrame` から呼ばれる経路)で、ティッカーの `innerHTML` を書き換えていない
- [ ] `src/style.css` の色の値は `:root` の変数だけ(マスクの `#000` と既存の影の `rgba` は例外)

Claude Code とオーナーが実機で確かめること:

- [ ] 今打つ文字がいつも同じ位置にあり、打つたびに行が左へ流れる
- [ ] 長い文でも改行せず、NEXT・コンボがキーボードに隠れない
- [ ] 文が変わったとき、行が流れずに1文字目がすぐ基準の位置に出る
- [ ] 「゛゜小」で保留中の文字が、今の文字の上に出る

## 対象外

- 判定・進行・お題のデータの変更
- 漢字の文を流す表示にすること(漢字の文は今までどおり改行する)
- 効果音

## 想定される落とし穴

- **`transition` が効かない**: 1行の DOM を作り直すと動きが出ない。状態の反映はクラスの付け替えと `transform` の変更だけにする
- **文字の幅の変化**: 今の文字だけ余白や枠が違うと、打つたびに行の長さが変わってずれる。全部の文字で同じ余白にする
- **測るタイミング**: `offsetLeft` はフォントの読み込み前後で変わる。`document.fonts.ready` のあとにも `relayout` する
- **全幅に広げる**: `.screen` の左右の余白 24px を打ち消すとき、横スクロールが出ないようにする(`.play` は `overflow: hidden` 済み)
