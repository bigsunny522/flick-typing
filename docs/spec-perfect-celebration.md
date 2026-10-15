# パーフェクト演出

## 背景

タイムアタックをミスなしで打ち切っても、結果画面はふだんと同じで、ミスの欄に「0」が出るだけ。ある程度の量をノーミスで打てたことを、結果画面の演出ではっきり褒めたい。

オーナーが選んだ形:

- 条件: タイムアタックで **ミス 0 かつ 正しく打てた文字数 100 字以上**
- 演出: 結果画面を開いた瞬間に紙吹雪が数秒舞い、スコアの上に「PERFECT」の帯が出る。帯は残る
- 耐久モードには出さない(完走しても出さない)

```
┌──────────────────────────────┐
│ RESULT            *  ・ ▪    │  ← 紙吹雪(画面全体に降る。操作は邪魔しない)
│ フリックキーボード   ▪   *   │
│ ▰ P E R F E C T ▰            │  ← 新しい帯(ポンと拡大して出る)
│ 正しく打てた文字数            │
│            128 字             │
│ 自己ベスト更新                │  ← 既存。両方出ることもある
│ ミス 0   │ 正確率 100.0%      │
│ ...                           │
```

## 変更対象

触るファイル:

- `src/game/perfect.ts`(新規)— パーフェクトかどうかを決める純粋な関数としきい値
- `tests/perfect.test.ts`(新規)— 上の関数のテスト
- `src/screens/result.ts` — 帯と紙吹雪を出す
- `src/main.ts` — `renderResult` に `perfect` を渡す
- `src/style.css` — 帯と紙吹雪のスタイル・アニメーション

触らないファイル:

- `src/game/rules.ts`(`RULES` はサーバー側の再計算と `RULES_VERSION` に結びついているので、表示だけの値を混ぜない)
- `src/game/session.ts` ほか `src/game/**` の既存ファイル、`src/anticheat/**`、`src/keyboard/**`、`src/native/**`、`src/data/**`
- `src/screens/endurance-result.ts`・`endurance.ts`・`play.ts`・`title.ts`・`blocked.ts`・`reading-ticker.ts`
- `src/storage.ts`、`src/theme.ts`、`index.html`、`package.json`、既存の `tests/**`、`AGENTS.md` / `CLAUDE.md` / `docs/**`

## 仕様

### 1. 判定(`src/game/perfect.ts`)

```ts
export const PERFECT_MIN_CORRECT = 100;

export function isPerfectRun(correct: number, miss: number): boolean;
```

- `miss === 0 && correct >= PERFECT_MIN_CORRECT` のとき `true`、それ以外は `false`
- `src/game/` の決まり(DOM・`Date.now()`・`Math.random()` を使わない)を守る

テスト(`tests/perfect.test.ts`)は次の表の1行ごとに `it` を1つ書く。

| correct | miss | 期待    |
| ------- | ---- | ------- |
| 100     | 0    | `true`  |
| 250     | 0    | `true`  |
| 99      | 0    | `false` |
| 0       | 0    | `false` |
| 100     | 1    | `false` |
| 250     | 3    | `false` |

### 2. 結果画面に渡す値(`src/main.ts`・`src/screens/result.ts`)

- `ResultValues` に `perfect: boolean` を足す
- `main.ts` の `startGame` の `onFinish` で `perfect: isPerfectRun(final.correct, final.miss)` を `result` に入れる。デバッグモードでも同じ判定で出す(見た目の確認に使うため)
- 耐久モード(`startEndurance` → `renderEnduranceResult`)には何も足さない

### 3. PERFECT の帯

- `values.perfect` が `true` のとき、`result-mode` の段落の直後(`result-label` の前)に次を出す

  ```html
  <p class="ribbon perfect-ribbon">PERFECT</p>
  ```

- 見た目: 既存の `.ribbon` と同じ斜めの帯で、`.accent-ribbon` の配色(`--accent` / `--accent-ink`)を使う。文字は 22px 程度、`letter-spacing` は既存の帯と同じ 0.3em、上下の余白は `margin: 16px 0 8px` 程度
- 出るときのアニメーション: 0.5 秒ほどで、`scale(0.4)`・透明 → 少し大きく(`scale(1.15)`)→ `scale(1)` に落ち着く。既存の `skewX(-14deg)` は保つ(`transform` を上書きして斜めが消えないように、キーフレームの各段に `skewX(-14deg)` を含める)
- 帯はアニメーションの後もそのまま残す
- `values.perfect` が `false` のときは何も出さない(今の表示と1文字も変えない)

### 4. 紙吹雪

- `values.perfect` が `true` で、かつ `window.matchMedia("(prefers-reduced-motion: reduce)").matches` が `false` のときだけ出す
- `<main class="screen result-screen">` の中に、`<div class="confetti" aria-hidden="true">` を1つ置き、その中に `<i>` を 40 個入れる
- 各 `<i>` には、ランダムな値を CSS 変数として `style` 属性に入れる(画面側のコードなので `Math.random()` を使ってよい)

  | 変数         | 範囲                                                     | 用途                 |
  | ------------ | -------------------------------------------------------- | -------------------- |
  | `--x`        | 0〜100(%)                                                | 横の位置             |
  | `--delay`    | 0〜0.6(秒)                                               | 降り始めの遅れ       |
  | `--duration` | 1.8〜3.0(秒)                                             | 落ちきるまでの時間   |
  | `--drift`    | -40〜40(px)                                              | 落ちる間の横ずれ     |
  | `--spin`     | 360〜1080(deg)                                           | 落ちる間の回転       |
  | `--color`    | `var(--primary)` / `var(--accent)` / `var(--fg)` から1つ | 色(テーマに追従する) |

- スタイル:
  - `.confetti` は `position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index` はボタンより上。**ボタンのタップを邪魔しない**(`pointer-events: none`)
  - `<i>` は 6×10px 程度の長方形、`background: var(--color)`、`left: calc(var(--x) * 1%)`、画面の上端の外(`top: -12px`)から始まり、`translateY(110vh)` まで落ちる。横ずれ `--drift` と回転 `--spin` をかける。`animation-fill-mode: both` で、始まる前は見えず、落ちきったら見えない
- 一番長い紙吹雪が終わる頃(3.6 秒後)に、`.confetti` の要素を DOM から取り除く(`setTimeout`)。そのときすでに画面が切り替わっていて要素がなくても、エラーにしない(`remove()` は外れた要素に呼んでも安全)
- CSS 側でも `@media (prefers-reduced-motion: reduce)` で `.confetti { display: none; }` とし、帯のアニメーションも止める(帯そのものは出す)

### 5. 入力経路

紙吹雪・帯はどちらもフォーカスを受けない要素(`<div>` / `<i>` / `<p>`)で作る。`tabindex`・`<input>`・`keydown` のリスナーを足さない。

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通り、`tests/perfect.test.ts` に表の 6 行ぶんの `it` がある
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `git diff --stat` に出るファイルが「変更対象」の 5 つだけ
- [ ] (Claude Code が確認)ブラウザでミス 0・100 字以上の結果画面を出すと、PERFECT の帯がポンと出て、紙吹雪が約 3 秒降り、その後 `.confetti` が DOM から消える。降っている間も「もう一度」「タイトルへ」がタップできる
- [ ] (Claude Code が確認)ミスが 1 以上、または 99 字以下の結果画面は、変更前と同じ表示

## 対象外

- 耐久モード(完走も含む)の演出
- 効果音・振動
- プレイ中(時間切れの前)の演出や、結果画面の前に挟む全画面のカットイン
- パーフェクトの回数の記録・保存・ランキングへの反映
- しきい値の設定画面

## 想定される落とし穴

- `.ribbon` は `transform: skewX(-14deg)` を持っている。帯のアニメーションで `transform: scale(...)` だけを書くと斜めが消える
- 既存の `.result-screen .accent-ribbon { margin-top: 24px; }` があるので、`.perfect-ribbon` に `accent-ribbon` クラスを付けると余白が二重に効く。クラスは `ribbon perfect-ribbon` の2つにし、配色は `.perfect-ribbon` に直接書く
- `.result-screen` に `overflow` の指定があると、`position: fixed` の紙吹雪が切られることはないが、`transform` を持つ祖先があると `fixed` が祖先基準になる。`<main>` や `.screen` に `transform` を足さない
- 結果画面からすぐ「もう一度」を押すと `host.innerHTML` が置き換わる。`setTimeout` の中で `host.querySelector` し直さず、作ったときの要素を持っておいて `remove()` する
