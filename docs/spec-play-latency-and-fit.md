# プレイ画面の描画遅れと、小さい画面での重なりの修正

## 背景

テストプレイの感想から、次の2点を直す。

1. **入力に描画が追いついていない感じがする**
   - 読みのティッカーが1文字進むたびに `transition: transform 0.14s ease-out` で滑る。1文字あたり 0.14 秒より速く打つと、滑り終わる前に次の文字へ進む。そのため今の文字が常に動いている途中になり、遅れて見える
   - `paint()` が毎フレーム(rAF、60〜120回/秒)呼ばれ、`#stats`・`#combo-gauge`・`#next`・`#perfect` を `innerHTML` で作り直している。値が変わっていなくても DOM の作り直しとレイアウトの計算が毎フレーム走る。コンボのゲージも毎回作り直されるので、`.gauge i` の `transition` が効いていない
   - ティッカーの `position()` は入力のたびに `offsetLeft` / `offsetWidth` を読む。クラスを書き換えた直後なので、レイアウトの計算がその場で強制的に走る
   - キーボードの `pointermove` は、指が動くたびに `getBoundingClientRect()` と `querySelectorAll()` を呼んでいる
2. **小さい画面でお題が見えない**(Playwright で計測。2026-10-15)
   - 375×553(iPhone SE の Safari 相当): `.prompt-area` の高さが 44px しかなく、漢字の文と読みのティッカーがまったく表示されない
   - 393×659(iPhone 15 の Safari で下にバーがある状態の相当): ティッカー(231〜311px)が `.prompt-area` の下端(277px)で切れる
   - 原因
     - キーボードは `position: fixed` で高さが `100vw × 0.58` に固定されている。画面の高さが足りなくても縮まない
     - `.play` の下の余白が `60vw + 40px + 24px` で、キーボードの実際の高さ(`58vw`)と食い違っている
     - その余白に `env(safe-area-inset-bottom)` が入っていない。ホームバーのある iPhone の実機では、キーボードが余白より 34px ほど上にはみ出し、コンボのゲージに重なるはず(実機では未確認)

判定・進行・不正対策・お題のデータは変えない。

## 変更対象

触るファイル:

- `src/screens/play.ts` — 毎フレームの描画を、変わった部分だけを書き換える形に分ける
- `src/screens/reading-ticker.ts` — 文字の位置を計測してためておく。入力のたびにはレイアウトを読まない
- `src/keyboard/view.ts` — `pointermove` / `pointerup` でレイアウトを読まない
- `src/debug/panel.ts` — デバッグ表示に「入力から描画までの時間」を足す
- `src/style.css` — ティッカーの transition をなくす。キーボードの高さと下の余白を同じ変数から計算する。低い画面向けの詰めた配置を足す

触らないファイル:

- `src/game/**`、`src/anticheat/**`、`src/data/**`、`src/keyboard/layout.ts`、`src/keyboard/gesture.ts`、`src/keyboard/guide.ts`
- `tests/**` — 既存のテストはそのまま通ること。新しいテストは不要(今回の変更は DOM と CSS だけ)
- `index.html`、`package.json` などの設定、`AGENTS.md` / `CLAUDE.md` / `docs/**`

## 仕様

### 1. ティッカーを滑らせない

- `src/style.css` の `.reading-ticker-line` から `transition: transform 0.14s ease-out` を消す。今の文字は入力と同じフレームで基準の位置(幅 × 0.28)に移る
- `@media (prefers-reduced-motion: reduce)` の `.reading-ticker-line` の指定は不要になるので消す
- `reading-ticker.ts` の `setTransition` も不要になるので消す

### 2. ティッカーで入力のたびにレイアウトを読まない

`src/screens/reading-ticker.ts`:

- 文字ごとの `offsetLeft` / `offsetWidth` と、`host.clientWidth` を配列と変数にためておく
- 計測するのは次のときだけ: `setReading()` の直後、`relayout()`(フォント読み込み後)、`resize`
- `update()` はクラスと `data-pending` を書き換え、ためておいた値で `transform` と目印の幅を設定する。`offsetLeft` / `offsetWidth` / `clientWidth` を読まない
- 文字の状態が変わっても幅は変わらない作りなので(`docs/spec-reading-ticker.md`)、ためた値は文が変わるまで使える

### 3. 毎フレームの描画を、変わった部分だけにする

`src/screens/play.ts`:

- `#stats`・`#combo-gauge`・`#next` の中身の DOM は、`renderPlay` の最初に1回だけ作る。以降は、中の要素の `textContent`・`style.width`・`classList` だけを書き換える
- 書き換えるのは、前回と値が違うときだけ。前回の値を変数に持っておき、比べる
  - 残り時間(`toFixed(1)` の文字列)、`urgent` かどうか、正解数、`+1秒` の表示
  - タイムバーの幅
  - コンボ数、「あと N字で +1秒」、ゲージの幅
  - NEXT の文(`promptIndex` が変わったときだけ)
  - PERFECT(`state.lastPerfect` が変わったときだけ)
- 画面の見た目(要素の構成・クラス名・文言)は今と同じにする。CSS のセレクタ(`#stats > span:last-child`、`.remaining.urgent`、`#bonus:not(:empty)`、`.combo-row > span:last-child` など)がそのまま効くこと
- ゲージの要素は作り直さないので、`.gauge i` の `transition: width 0.2s` が効くようになる。これは意図どおり

### 4. キーボードで指が動くたびにレイアウトを読まない

`src/keyboard/view.ts`:

- `pointerdown` で取った `host.getBoundingClientRect()` の `left` / `top` / `width` を `PointerState` に入れておく。`pointermove` / `pointerup` ではその値を使い、`getBoundingClientRect()` を呼ばない
- `pointerdown` で作ったフリックガイドの要素を `PointerState` に配列で持っておく。`pointermove` ではその配列のクラスを切り替える。`pointerup` / `pointercancel` ではその配列の要素を消す。`querySelectorAll` で探さない
- `KeyStroke` に入れる座標・時刻・方向の値は今と同じにする(押している途中で画面がずれることはないので、`pointerdown` 時点の位置を使ってよい)

### 5. 入力から描画までの時間をデバッグ表示に出す

`?debug` のときだけ動かす。実機(iPhone)で遅れを数字で確かめるため。

- `src/keyboard/view.ts` の `pointerup` の `event.timeStamp` を、`KeyStroke` とは別の経路で `play.ts` に渡す(`onStroke` の第2引数に `upTimeStamp: number` を足すなど。`KeyStroke` の型と入力ログには入れない)
- `play.ts` は入力を受け付けて `paint()` した後、`requestAnimationFrame` のコールバックで `performance.now() - upTimeStamp` を測る。直近 20 回の値を持っておく
- `src/debug/panel.ts` の `renderDebugPanel` に引数を1つ足し、直近 20 回の中央値と最大値を「描画 中央値 XXms / 最大 XXms」の1行で出す。表示の位置は今のデバッグ表示の先頭
- `?debug` でないときは計測もしない

### 6. キーボードの高さと下の余白を同じ変数から計算する

`src/style.css`:

- `:root` に `--kb-height: calc(100vw * var(--kb-height-ratio));` を足す
- `.keyboard` の `height` を `var(--kb-height)` にする
- `.play` の `padding-bottom` を `calc(var(--kb-height) + var(--kb-bottom-offset) + env(safe-area-inset-bottom) + 24px)` にする(今の `60vw` をやめる)

### 7. 低い画面では詰めて並べる

`src/style.css` に `@media (max-height: 700px)` を足し、その中で次を指定する。375×553 と 393×659 の両方に効く。

| 対象 | 今 | 低い画面 |
|---|---|---|
| `:root` の `--kb-height-ratio` | 0.58 | 0.52 |
| `:root` の `--kb-bottom-offset` | 40px | 12px |
| `.play` の上の余白(`padding-top`) | 36px | 12px |
| `.play-header` の `margin-top` / `min-height` | 32px / 48px | 8px / 40px |
| `.time-bar` の `margin-top` | 18px | 10px |
| `.prompt-area` の `padding-top` | 22px | 8px |
| `#next` の `min-height` / `padding` | 44px / 14px 0 10px | 32px / 8px 0 6px |
| `.combo-row` の `margin-bottom` | 8px | 4px |
| `.flick-only` | 表示 | `display: none`(キーボードと重なるため) |
| `.deco` | 表示 | `display: none`(上の余白を詰めると残り時間に重なるため) |

- `.play` の `padding-bottom` は6の式のままでよい(変数が変わるので自動で小さくなる)
- 700px より高い画面の見た目は今と同じにする

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `src/screens/play.ts` の `paint()`(またはそこから呼ぶ関数)に `innerHTML` の代入が残っていない。ただし文が変わるときの `promptView.innerHTML` は残してよい
- [ ] `src/screens/reading-ticker.ts` の `update()` から `offsetLeft` / `offsetWidth` / `clientWidth` を読んでいない
- [ ] `src/keyboard/view.ts` の `pointermove` / `pointerup` のハンドラに `getBoundingClientRect` と `querySelectorAll` がない
- [ ] 以下は Claude Code がレビュー時にブラウザで確かめる(実装担当は不要)
  - 375×553・393×659・430×800 で `?debug` を開いてプレイを始めたとき、`.kanji` と `.reading-ticker-host` の下端が `.prompt-area` の下端以内にある
  - 同じ3サイズで、`#combo-gauge` の下端が `#keyboard` の上端以下にある
  - 430×932 の見た目が変更前と同じ

## 対象外

- iPhone の標準キーボードでの入力(別の仕様書 `docs/spec-native-keyboard.md` で扱う)
- 自前キーボードを画面の下端に寄せる、PWA にする
- 判定・進行・不正対策・お題・結果画面・タイトル画面

## 想定される落とし穴

- `#stats` の中の `#bonus` は今 `paint()` のたびに作り直されている。最初に1回だけ作る形にしても、`#bonus:not(:empty)` で表示を切り替えているので、空にするときは `textContent = ""` にする
- ティッカーの計測は、フォントが読み込まれる前だと幅が違う。今の `document.fonts.ready.then(() => readingTicker.relayout())` を残し、`relayout()` で計測し直すこと
- `setReading()` で計測するときは、新しい `<span>` を並べた後に1回だけ読む。文字ごとに読み書きを交互にしない
- `pointerdown` 時点の位置を使うので、押している途中でページがスクロールすると座標がずれる。`html, body` は `touch-action: none` と `overscroll-behavior: none` でスクロールしないので、問題にならない想定
- `env(safe-area-inset-bottom)` は `index.html` の `viewport-fit=cover` があるときだけ値が入る(すでに入っている)
- 入力から描画までの時間を測る `requestAnimationFrame` は入力ごとに1回だけ。毎フレーム回す `tick` のループとは別にする
