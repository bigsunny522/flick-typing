# パーフェクト演出を派手にする

## 背景

`docs/spec-perfect-celebration.md` で、タイムアタックをミス 0・100 字以上で終えたときの演出を入れた(CSS の紙吹雪 40 個と PERFECT の帯)。オーナーから「もっと派手にしていい」と言われたので、演出を作り直す。

出す条件(`isPerfectRun`)と、出す場所(タイムアタックの結果画面だけ。耐久モードには出さない)は変えない。

## 演出の流れ

結果画面を描いた時点を 0 秒とする。

| 時刻         | 起きること                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 0〜0.45 秒   | 画面全体が `--accent` の色で一瞬光り、消えていく(フラッシュ)                                                                    |
| 0.1〜0.55 秒 | PERFECT の帯が大きく・ぼやけた状態から、スタンプを押すように叩きつけられる                                                      |
| 0.35 秒      | 叩きつけと同時に画面が揺れる(0.4 秒)。スコアの数字がポンと弾む。帯の後ろに光の筋(放射状の光)が広がる                            |
| 0.35 秒      | 画面の左下と右下から紙吹雪が斜め上に打ち上がり(クラッカー)、弧を描いて落ちてくる                                                |
| 0.6 秒〜     | 画面の上から紙吹雪が降る                                                                                                        |
| 〜5 秒       | 紙吹雪がすべて画面の外に出たら、紙吹雪の要素を取り除く                                                                          |
| ずっと       | 帯の上を光が斜めに走る(2.4 秒ごと)。帯のまわりで星がきらめく。帯の後ろの光の筋がゆっくり回る。スコアは2色のグラデーションのまま |

```
┌──────────────────────────────┐
│ RESULT        ・ ▪  ◦  ▪   │  ← 紙吹雪(canvas。操作は邪魔しない)
│ フリックキーボード     ✦     │
│  \  |  /                     │
│ ━ ▰ P E R F E C T ▰ ━  ✦    │  ← 帯を大きく。後ろに光の筋、まわりに星
│  /  |  \     ✦               │
│ 正しく打てた文字数            │
│            128 字             │  ← グラデーションの数字
│ ...                           │
│▪                            ▪│  ← 左下・右下から打ち上げ
```

## 変更対象

触るファイル:

- `src/screens/celebration.ts`(新規)— canvas の紙吹雪(打ち上げと降下)を動かす
- `src/screens/result.ts` — 帯まわりのマークアップ・フラッシュ・揺れ・スコアの見た目を足し、`celebration.ts` を呼ぶ。今の CSS 紙吹雪(`confettiMarkup`・`removeConfettiLater`・`CONFETTI_LIFETIME_MS`)は消す
- `src/style.css` — 帯・光の筋・星・フラッシュ・揺れ・スコアのスタイル。今の `.confetti`・`@keyframes confetti-fall` は消す

触らないファイル:

- `src/main.ts`(`perfect` の受け渡しはもうできている)
- `src/game/**`(`perfect.ts` も含む)、`src/anticheat/**`、`src/keyboard/**`、`src/native/**`、`src/data/**`
- `src/screens/` のほかの画面、`src/storage.ts`、`src/theme.ts`
- `tests/**`、`index.html`、`package.json`、`AGENTS.md` / `CLAUDE.md` / `docs/**`

## 仕様

### 1. 動きを減らす設定

`window.matchMedia("(prefers-reduced-motion: reduce)").matches` が `true` のとき:

- フラッシュ・揺れ・canvas の紙吹雪は出さない(要素も作らない・`startCelebration` を呼ばない)
- 帯・光の筋・星・スコアのグラデーションは出すが、すべて動かさない(CSS の `@media (prefers-reduced-motion: reduce)` で `animation: none`)。光の筋と星は止まった状態で見えていること(`opacity` が 0 のまま止まらないようにする)

以下、特に断りがなければ「動きを減らす設定ではない」ときの説明。

### 2. マークアップ(`src/screens/result.ts`)

`values.perfect` が `true` のとき、`host.innerHTML` を次の形にする。`false` のときは変更前(パーフェクト演出を入れる前)と1文字も変えない。

```html
<div class="celebration" aria-hidden="true"><div class="celebration-flash"></div></div>
<main class="screen result-screen perfect-result">
  ...(RESULT の帯・result-mode はそのまま)
  <div class="perfect-burst">
    <div class="perfect-rays"></div>
    <i class="perfect-star"></i> × 6
    <p class="ribbon perfect-ribbon">PERFECT</p>
  </div>
  <p class="result-label">正しく打てた文字数</p>
  <div class="score perfect-score">128<small>字</small></div>
  ...(以下そのまま)
</main>
```

- `.celebration` は `<main>` の**外**(兄弟)に置く。`<main>` を揺らす(`transform` がかかる)ので、中に置くと `position: fixed` が `<main>` 基準になってしまう
- 動きを減らす設定のときは `.celebration` を出さず、`<main>` に付けるクラスは `perfect-result` ではなく `perfect-result-static` にする(揺れを付けないため)。`perfect-burst` 以下とスコアのクラスはどちらでも同じ
- 星 6 個の位置は CSS 変数で `style` 属性に入れる。固定値でよい(下の表)

  | 星  | `--sx` | `--sy` | `--ss`(大きさ px) | `--sd`(遅れ 秒) |
  | --- | ------ | ------ | ----------------- | --------------- |
  | 1   | -8%    | -30%   | 14                | 0               |
  | 2   | 18%    | 105%   | 10                | 0.4             |
  | 3   | 48%    | -45%   | 12                | 0.9             |
  | 4   | 80%    | 110%   | 16                | 0.2             |
  | 5   | 102%   | -20%   | 10                | 1.2             |
  | 6   | 64%    | 120%   | 8                 | 0.7             |

  `--sx` / `--sy` は `.perfect-burst` の左上を基準にした位置(帯のまわりに散らばる)。

- 描いたあと、動きを減らす設定でなければ `startCelebration(host.querySelector(".celebration"))` を呼ぶ(下の 4)。フラッシュの要素は 0.6 秒後に `remove()` する(作ったときの要素の参照を持っておく)

### 3. スタイル(`src/style.css`)

ここに書く数値は目安。見た目を整えるために ±20% 程度は変えてよい。

**`.celebration`**: `position: fixed; inset: 0; z-index: 9; pointer-events: none; overflow: hidden;`。z-index は「縦向きにしてください」の表示(`#app::after` の z-index: 10)より下にする。

**`.celebration-flash`**: `position: absolute; inset: 0; background: var(--accent);`、0.45 秒で `opacity` 0.75 → 0(`ease-out`、`forwards`)。

**揺れ** `.perfect-result`: 0.35 秒遅れて 0.4 秒、`translate` で揺らす(例: 0 → (-7px, 3px) → (6px, -4px) → (-4px, 2px) → (3px, -1px) → 0)。`animation-fill-mode` は `none`(終わったら `transform` を残さない)。

**`.perfect-burst`**: `position: relative; align-self: flex-start; margin: 22px 0 12px; isolation: isolate;`

**`.perfect-ribbon`**(今のスタイルを置き換える):

- 配色は `--accent` / `--accent-ink`。文字は 34px、`letter-spacing: 0.3em`、`padding: 8px 18px`
- 金属っぽい光沢: `background` を `--accent` の単色ではなく、`linear-gradient(100deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #fff) 50%, var(--accent))` にする
- 影: `box-shadow: 0 6px 0 color-mix(in srgb, var(--accent) 55%, #000), 0 0 24px color-mix(in srgb, var(--accent) 60%, transparent)`
- 叩きつけ(`perfect-slam`、0.45 秒、0.1 秒遅れ、`both`): `scale(3)`・`blur(8px)`・透明 → 0.25 秒時点で `scale(0.9)`・ぼかしなし・不透明 → `scale(1.06)` → `scale(1)`。**各段に `skewX(-14deg)` を含める**(`.ribbon` の斜めを消さない)
- 光が走る: `.perfect-ribbon` に `position: relative; overflow: hidden;`、`::after` に幅 40% の斜めの白い帯(`linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent)`)を置き、`left: -60%` → `left: 130%` を 2.4 秒ごとに繰り返す(動いているのは最初の 0.7 秒、残りは止まって待つ。最初の1回は 0.6 秒遅れて始める)

**`.perfect-rays`**: `position: absolute; left: 50%; top: 50%; width: 340px; height: 340px; z-index: -1;` を中心に合わせる。

- `background: repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--accent) 45%, transparent) 0deg 10deg, transparent 10deg 30deg);`
- `mask-image: radial-gradient(circle, #000 15%, transparent 68%);`(`-webkit-mask-image` も書く)
- 出方(`perfect-rays-in`、0.35 秒遅れ、0.5 秒、`both`): `scale(0.2)`・透明 → `scale(1)`・不透明
- 回転(`perfect-rays-spin`、14 秒、`linear`、`infinite`)。出方と回転を1つの要素で両方やると `transform` がぶつかるので、出方は `opacity` と `scale` プロパティ、回転は `rotate` プロパティ(個別の変形プロパティ)で書く。中心合わせは `translate: -50% -50%`

**`.perfect-star`**: `position: absolute; left: var(--sx); top: var(--sy); width: calc(var(--ss) * 1px); height: calc(var(--ss) * 1px); background: var(--accent);` 4つの角を持つ星の形を `clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)` で作る。

- きらめき(`perfect-twinkle`、1.6 秒、`infinite`、`animation-delay: calc(0.5s + var(--sd) * 1s)`、`both`): `scale(0)`・透明 → 中間で `scale(1)`・`rotate(90deg)`・不透明 → `scale(0)`・透明
- 動きを減らす設定のときは `animation: none; opacity: 1;`

**`.perfect-score`**:

- 数字を2色のグラデーションにする: `background: linear-gradient(120deg, var(--primary), var(--accent)); -webkit-background-clip: text; background-clip: text; color: transparent;`。`<small>字</small>` も同じ見た目でよい
- 弾む(`perfect-score-pop`、0.35 秒遅れ、0.4 秒): `scale(1)` → `scale(1.12)` → `scale(1)`。`transform-origin: left bottom`

**動きを減らす設定**: `@media (prefers-reduced-motion: reduce)` の中で `.perfect-ribbon`・`.perfect-ribbon::after`・`.perfect-rays`・`.perfect-star`・`.perfect-score` の `animation` をすべて `none` にする。`::after`(走る光)は `display: none`。

消すもの: 今の `.confetti`・`.confetti i`・`@keyframes confetti-fall`・`@keyframes perfect-pop`、今の `@media (prefers-reduced-motion: reduce)` の中の `.confetti` / `.perfect-ribbon` の指定(新しい指定に置き換える)。

### 4. canvas の紙吹雪(`src/screens/celebration.ts`)

```ts
export function startCelebration(layer: HTMLElement): void;
```

- `layer` の中に `<canvas class="celebration-canvas">` を足す(`position: absolute; inset: 0; width: 100%; height: 100%;` を CSS に書く)
- canvas の解像度は `layer` の表示サイズ × `Math.min(window.devicePixelRatio, 2)`。描くときは `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` で CSS ピクセルの座標で描く
- `requestAnimationFrame` で動かす。1フレームの経過時間 `dt`(秒)は 1/30 秒を上限にする(タブを戻したときに一気に飛ばないように)
- 色: `getComputedStyle(document.documentElement)` から `--primary`・`--accent`・`--fg` を読み、`#ffd54a`(金)と `#ffffff` を足した5色から選ぶ(テーマに追従させるため)
- 乱数は `Math.random()` を使ってよい(画面側のコード)

**紙吹雪の種類**(1個ごとにランダムに決める):

| 形       | 割合 | 大きさ            |
| -------- | ---- | ----------------- |
| 長方形   | 60%  | 7〜10 × 11〜15 px |
| 丸       | 25%  | 半径 3〜5 px      |
| 細長い帯 | 15%  | 3 × 16〜22 px     |

**出し方**:

| 群           | 個数 | 出る時刻(0 秒 = `startCelebration` を呼んだ時) | 出る位置               | 初速                                                       |
| ------------ | ---- | ---------------------------------------------- | ---------------------- | ---------------------------------------------------------- |
| 左の打ち上げ | 70   | 0.35 秒(全部同時)                              | 左下の角 (0, H)        | 角度: 真上から右へ 15〜40 度。速さ: `H × (1.6〜2.4)` px/秒 |
| 右の打ち上げ | 70   | 0.35 秒                                        | 右下の角 (W, H)        | 左の打ち上げを左右反転                                     |
| 上から降る   | 60   | 0.6〜2.1 秒に1個ずつ散らす                     | x は 0〜W、y は -20 px | 横: -60〜60 px/秒、縦: 60〜180 px/秒                       |

W・H は `layer` の表示の幅と高さ(CSS ピクセル)。

**動き**(1フレームごと):

- 重力: `vy += 1500 * dt`
- 空気抵抗: `vx *= Math.exp(-2.2 * dt)`、`vy *= Math.exp(-2.2 * dt)`(下向きの最終速度が 700 px/秒前後になり、ひらひら落ちる)
- 揺らぎ: 位置の x に `Math.sin(経過時間 * 揺らぎの速さ + 位相) * 揺らぎの幅 * dt` を足す(揺らぎの速さ 3〜6、幅 20〜60 px/秒、位相 0〜2π を1個ごとに決める)
- 回転: 角度に `回転の速さ * dt` を足す(-8〜8 ラジアン/秒)
- 裏返り: 描くときに縦方向を `Math.cos(経過時間 * 裏返りの速さ + 位相)` 倍する(裏返りの速さ 4〜10)。紙がくるくる回って見えるように
- 目標: 打ち上げた紙吹雪の一番高いところが、画面の上から 10〜40% あたりに来ること。届かない・突き抜けるときは、初速の係数(`1.6〜2.4`)を直してよい

**終わり方**:

- 出る時刻を過ぎた紙吹雪がすべて画面の下(`y > H + 30`)に出たら、canvas を `remove()` してループを止める
- 呼んでから 6 秒たったら、残っていても canvas を `remove()` してループを止める
- 毎フレームの最初に `canvas.isConnected` を見て、`false`(結果画面から別の画面に切り替わった)ならループを止める

### 5. 入力経路

足す要素はどれもフォーカスを受けない(`<div>` / `<i>` / `<p>` / `<canvas>`)。`tabindex`・`<input>`・`keydown`・タッチのリスナーを足さない。`.celebration` は `pointer-events: none` で、ボタンのタップを邪魔しない。

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `git diff --stat` に出るファイルが「変更対象」の 3 つだけ
- [ ] `src/` に `confetti-fall`・`confettiMarkup`・`removeConfettiLater` が残っていない(`grep -rn` で 0 件)
- [ ] (Claude Code が確認)幅 390px のブラウザでミス 0・100 字以上の結果画面を出すと、上の「演出の流れ」の順に、フラッシュ → 帯の叩きつけと揺れ → 左右からの打ち上げ → 上からの紙吹雪が見える。演出中も「もう一度」がタップできる。6 秒後には `.celebration-canvas` が DOM にない
- [ ] (Claude Code が確認)ミスが 1 以上、または 99 字以下の結果画面は、パーフェクト演出を入れる前と同じ表示
- [ ] (Claude Code が確認)動きを減らす設定にすると、フラッシュ・揺れ・canvas はなく、帯・光の筋・星・グラデーションの数字が止まった状態で見える

## 対象外

- 効果音・振動
- 耐久モード(完走も含む)の演出
- 結果画面の前に挟む全画面のカットイン
- 条件(100 字・ミス 0)の変更
- canvas の描画のテスト(DOM と描画に頼るので、Vitest では書かない)

## 想定される落とし穴

- `.ribbon` は `transform: skewX(-14deg)` を持つ。`perfect-slam` の各段に `skewX(-14deg)` がないと斜めが消える。`filter: blur()` は `transform` と別のプロパティなので一緒に書いてよい
- `.result-screen .accent-ribbon` の余白が効かないよう、帯のクラスは `ribbon perfect-ribbon` のまま(`accent-ribbon` を付けない)
- `.perfect-rays` は出方と回転で同じ要素を動かす。`transform` を2つのアニメーションで書くと後のほうが前のほうを上書きする。`scale` / `rotate` / `translate` の個別プロパティに分ける
- `background-clip: text` は Safari で `-webkit-background-clip: text` が要る。`.score small` は `position: absolute` なので、グラデーションが `<small>` だけ別の範囲で描かれても、読めれば問題ない
- 揺れは `<main>` に `transform` をかける。`.celebration` を `<main>` の中に入れると、揺れている間 `position: fixed` が `<main>` 基準になる。必ず `<main>` の外に置く
- 結果画面からすぐ「もう一度」を押すと `host.innerHTML` が置き換わる。フラッシュの `remove()` と canvas のループは、作ったときの要素の参照で扱い、外れていてもエラーにしない
- canvas のサイズは `layer.getBoundingClientRect()` で取る。`layer` が `display: none` などで 0×0 のときは何もせずに終える
