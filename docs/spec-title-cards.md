# タイトル画面を2枚のカードに組み替える

## 背景

耐久モードの区画を足したため、タイトル画面が縦に詰まって見にくい(オーナーの指摘)。`body` に `touch-action: none` があり、スマホではタイトル画面をスクロールできない。iPhone の Safari でバーが出ている高さ(640〜660px 程度)にすべてを収める必要がある。そのため、高さ 700px 以下の画面では余白を削っていた。

余白を広げるだけでは高さが足りない。今のモード(タイムアタック)と耐久モードを同じ形のカードにして左右に並べ、縦の余裕を作る(オーナーが選んだ形)。

```
FLICK TYPING
ふりっく
タイピング
フリックだけで打つタイピング。

            (空き)

[フリックキーボード][スマホのキーボード]
フリック入力で打ってください(…)  ← native のときだけ

┌─────────────┐ ┌─────────────┐
│ タイムアタック│ │ 今日の耐久   │
│ 60秒から開始 │ │ 走れメロス / │
│ 連続正解で…  │ │ 太宰治       │
│ 自己ベスト   │ │ 今日のベスト │
│   123 字     │ │    45 字     │
│ [ はじめる ] │ │ [ 挑戦する ] │
└─────────────┘ └─────────────┘
```

## 変更対象

触るファイル:

- `src/screens/title.ts` — 画面の HTML を組み替える
- `src/style.css` — タイトル画面のスタイルを組み替える

触らないファイル:

- `src/main.ts`(`renderTitle` の引数は変えない)
- ほかの画面(`play.ts`・`result.ts`・`endurance.ts`・`endurance-result.ts`・`blocked.ts`)と、そのスタイル
- `src/game/**`、`src/anticheat/**`、`src/keyboard/**`、`src/native/**`、`src/data/**`、`src/storage.ts`、`src/theme.ts`
- `index.html`、`package.json`、`AGENTS.md` / `CLAUDE.md` / `docs/**`

## 仕様

### 1. HTML(`src/screens/title.ts`)

`<main class="screen title-screen">` の中身を、上から次の順にする。

1. `.deco` と `.theme-tap`(今と同じ)
2. `<p class="ribbon">FLICK TYPING</p>`(今と同じ)
3. `<h1>ふりっく<br />タイピング</h1>`(今と同じ)
4. `<p class="intro">フリックだけで打つタイピング。</p>`(2行目「ミスせず続けると時間が増える。」は消す。カードの説明に移す)
5. `debug` のときの `<pre class="debug">…</pre>`(今と同じ内容)
6. `<div class="title-actions">` の中に次を入れる
   - `<div class="mode-select">…</div>`(今と同じボタン2つ)
   - `<p class="native-hint">…</p>`(今と同じ文言と `hidden` の扱い。位置だけ `.mode-select` の直後に移す)
   - `<div class="game-cards">` の中にカード2枚(下の表)

カードの形(2枚とも同じ):

```html
<section class="game-card">
  <p class="game-card-label">(見出し)</p>
  <p class="game-card-sub">(1行目)<br />(2行目)</p>
  <div class="game-card-best">
    <span>(記録の名前)</span>
    <strong><span id="(id)">(数字か —)</span><small>字</small></strong>
  </div>
  <button id="(id)" class="(class)">(ボタンの文言)</button>
</section>
```

| 部分           | 1枚目(左)                | 2枚目(右)                                  |
| -------------- | ------------------------ | ------------------------------------------ |
| 見出し         | `タイムアタック`         | `今日の耐久`                               |
| 1行目          | `60秒から開始`           | `${endurance.title} / ${endurance.author}` |
| 2行目          | `連続正解で時間が増える` | `1回ミスしたら終了`                        |
| 記録の名前     | `自己ベスト`             | `今日のベスト`                             |
| 数字の id      | `best-value`             | `endurance-best-value`                     |
| ボタンの id    | `start`                  | `start-endurance`                          |
| ボタンの class | `primary-button`         | `secondary-button`                         |
| ボタンの文言   | `はじめる`               | `挑戦する`                                 |

- 今の `.best`・`.endurance-box`・`.endurance-box-label`・`.endurance-work`・`.endurance-best`・`.endurance-note` の要素はなくす
- id(`best-value`・`endurance-best-value`・`start`・`start-endurance`)は今と同じなので、入力方法を切り替えたときの書き換えとボタンのクリックの処理は変えない
- HTML の文字列は、1行に詰め込まず要素ごとに分けて書く(`endurance-result.ts` のように `+` でつなぐ形でよい)

### 2. スタイル(`src/style.css`)

消すもの:

- `.best`・`.best strong`・`.endurance-box` 系・`.endurance-best` 系・`.endurance-note`・`.title-screen #start-endurance`・`.title-screen .endurance-work` のルール
- `.best small, .score small { … }` は `.score small` だけに直す(結果画面の見た目は変えない)
- `.title-screen .primary-button { margin-top: auto; }`
- 前回 `@media (max-height: 700px)` の1つ目のブロックに足したタイトル画面の指定(`.title-screen` で始まるもの全部)

足すもの:

| セレクタ                           | 指定                                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `.title-screen`                    | `padding-top: 56px`(今は `80px`)                                                                                       |
| `.title-screen h1`                 | 今のまま(`margin: 28px 0 18px; font-size: 44px; line-height: 1.2`)                                                     |
| `.title-actions`                   | `margin-top: auto; padding-top: 24px`                                                                                  |
| `.title-actions .mode-select`      | `margin-top: 0`                                                                                                        |
| `.game-cards`                      | `display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px`                                           |
| `.game-card`                       | `display: flex; flex-direction: column; padding: 14px 12px 12px; border: 1px solid var(--line); background: var(--bg)` |
| `.game-card-label`                 | `margin: 0; color: var(--primary-strong); font-size: 13px; font-weight: 800; letter-spacing: 0.08em`                   |
| `.game-card-sub`                   | `margin: 6px 0 0; min-height: 3em; color: var(--muted); font-size: 11px; font-weight: 700; line-height: 1.5`           |
| `.game-card-best`                  | `margin-top: 12px; color: var(--muted); font-size: 11px; font-weight: 700`                                             |
| `.game-card-best strong`           | `display: block; margin-top: 2px; color: var(--fg); font: 300 40px/1 Outfit, sans-serif; font-style: italic`           |
| `.game-card-best small`            | `margin-left: 4px; font: 800 14px "LINE Seed JP", sans-serif; font-style: normal`                                      |
| `.game-card button`                | `height: 48px; margin-top: auto`(カードの高さがそろったとき、ボタンが下端にそろうように)                               |
| `.game-card .primary-button`       | `font-size: 15px`                                                                                                      |
| `.game-card-best` の下とボタンの間 | `.game-card-best` に `margin-bottom: 12px`                                                                             |

高さ 700px 以下(既存の `@media (max-height: 700px)` の1つ目のブロックに置く):

| セレクタ           | 指定                                   |
| ------------------ | -------------------------------------- |
| `.title-screen`    | `padding-top: 36px`                    |
| `.title-screen h1` | `margin: 18px 0 12px; font-size: 40px` |
| `.title-actions`   | `padding-top: 16px`                    |

- `.game-card-sub` の1行目が長くて3行になる作品があってもよい(`min-height` は2行分。カードは `grid` の行で高さがそろう)
- `.intro` のルールは変えない

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `git diff --stat` に `src/screens/title.ts` と `src/style.css` 以外が出ていない
- [ ] `grep -n "endurance-box\|endurance-note\|\.best " src/style.css src/screens/title.ts` が何も出さない
- [ ] 以下は Claude Code がブラウザで確かめる(実装担当は不要): 幅 390px で高さ 640px・844px のとき、カードのボタン2つが画面内にあり、要素どうしが重ならない。入力方法を切り替えると両方の記録の表示が変わる。結果画面の大きな数字と「字」の見た目が変わっていない

## 対象外

- タイトル画面以外の見た目
- 文言の変更(上の表にあるもの以外)
- カードを押したときのアニメーション
- 横向きの画面への対応

## 想定される落とし穴

- `.score small` は結果画面の大きな数字の「字」で、`position: absolute` を別のルールで足している。`.best small, .score small` を分けるとき、`.score small` 側の `margin-left` と `font` を消さない
- `.primary-button` には `clip-path`(斜めの形)がかかっている。カードの幅(約 166px)では斜めの部分の割合が大きく見えるが、そのままでよい
- `.native-hint` は `hidden` 属性で出し入れしている。位置を移しても `hint` の取り出し(`querySelector(".native-hint")`)はそのまま動く
- `debug` の `<pre>` は長い1行で、画面の高さを押し上げる。デバッグ時だけなので、はみ出してもよい
