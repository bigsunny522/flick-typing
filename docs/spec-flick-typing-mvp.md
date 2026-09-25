# フリックタイピング MVP

## 背景

スマホ専用の、フリック入力で遊ぶタイピングゲームを作る。PC のタイピングゲーム(寿司打など)のフリック入力版。

- OS のキーボードで打たせると、ローマ字入力・物理キーボード・音声入力・貼り付けと区別がつかない。そのため **フリックキーボードをゲーム側で描画し、その上のタッチ操作だけを入力として受け付ける**
- PC のブラウザ・タブレット・自動操作ツール(AI エージェント、Playwright、DevTools のエミュレーションなど)からの操作は弾く
- 将来ランキングとタイムアタックを足す。そのとき入力ログをサーバーで再計算して検証できるよう、ゲームの進行は「乱数の種+打鍵の列」から完全に再現できる純粋な関数で書く

## 変更対象

作るファイル:

- `index.html` — viewport の設定と `#app` だけ
- `src/main.ts` — 画面の切り替え、`?debug` の判定
- `src/style.css` — 全体のスタイル
- `src/screens/title.ts` / `play.ts` / `result.ts` / `blocked.ts` — 各画面
- `src/keyboard/layout.ts` — キー配列とフリック方向の対応表
- `src/keyboard/gesture.ts` — 指の軌跡からキーと方向を決める純粋関数
- `src/keyboard/view.ts` — キーボードの描画と Pointer Events の処理
- `src/keyboard/guide.ts` — フリックのガイドのマスの位置を計算する純粋関数
- `src/game/kana.ts` — 「゛゜小」の切り替え表、打てる文字の集合
- `src/game/judge.ts` — 1打鍵ごとの判定(純粋関数)
- `src/game/session.ts` — タイマー・コンボ・ボーナス・スコアを持つゲーム進行(純粋な reducer)
- `src/game/rules.ts` — ルールの定数と `RULES_VERSION`
- `src/game/prompts.ts` — 難易度の計算、乱数、お題の選び方
- `src/game/random.ts` — 種つき乱数(mulberry32)
- `src/anticheat/env.ts` — 環境チェック(純粋関数+ブラウザから値を集める関数)
- `src/anticheat/behavior.ts` — 挙動分析(純粋関数)
- `src/anticheat/thresholds.ts` — 挙動分析のしきい値
- `src/anticheat/log.ts` — 入力ログの型と組み立て
- `src/debug/panel.ts` — 計測モードの表示とログのダウンロード
- `src/storage.ts` — 自己ベストの保存と読み込み
- `src/data/prompts.json` — お題 60 件
- `tests/*.test.ts` — Vitest のテスト

触らないファイル:

- `package.json` / `package-lock.json` / `tsconfig.json` — 依存とスクリプトは Claude Code が用意済み。依存の追加が要るなら止めて聞く
- `AGENTS.md` / `CLAUDE.md` / `docs/**`

`vite.config.ts` は作らない(既定の設定で動く)。

## 仕様

### 1. 画面の流れ

```
起動 → 環境チェック ─NG→ blocked 画面
          │OK
          ▼
        title ─開始→ (環境チェックをもう一度) → play(カウントダウン 3 秒 → 本番)
                                                   │時間切れ         │挙動分析で bot 判定
                                                   ▼                  ▼
                                                 result           blocked 画面
                                                   │もう一度
                                                   └→ play
```

- **blocked 画面**: 理由ごとに文言を変える。`notPhone` →「スマホで開いてください」、`automation` と挙動分析の bot 判定 →「正しく操作できませんでした」。判定の理由は画面に出さない(計測モードのときだけ出す)。blocked 画面から先へ進むボタンは置かない(再読み込みで最初から)
- **title 画面**: タイトル、遊び方の短い説明(フリックだけで打つ、ミスせず続けると時間が増える)、自己ベスト、開始ボタン
- **play 画面**: 後述
- **result 画面**: 正しく打てた文字数(大きく)、ミス数、正確率、1 秒あたりの文字数、最大コンボ、自己ベスト更新の表示、「もう一度」「タイトルへ」ボタン
- **横向き**: `(orientation: landscape)` のとき、全画面に「縦向きにしてください」を重ねる。play 中でもタイマーは止めない。blocked 画面と、タッチ非対応の環境(PC)では重ねない(「スマホで開いてください」を隠さないため)

### 2. OS の入力を寄せつけない

- `<input>` / `<textarea>` / `<select>` / `contenteditable` を一切使わない。フォーカスできる要素はボタンだけ
- `keydown` / `keyup` / `keypress` / `input` / `beforeinput` / `paste` / `compositionstart` のリスナーを登録しない(入力経路にしない)
- `index.html` の viewport: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`
- CSS: `html, body` に `touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; overscroll-behavior: none;`。ボタンだけ `touch-action: manipulation`
- `contextmenu` と、iOS の `gesturestart` は `preventDefault()` する
- テスト(`tests/no-os-input.test.ts`)で `src/**` と `index.html` を読み、次の正規表現のどれにも一致しないことを確かめる(`JudgeInput` のような識別子には反応しないようにする。走査対象に `tests/` は含めない):
  - `/<(input|textarea|select)\b/i`
  - `/contenteditable/i`
  - `/createElement\(\s*["'](input|textarea|select)["']/`
  - `/addEventListener\(\s*["'](keydown|keyup|keypress|input|beforeinput|paste|compositionstart)["']/`
  - `/\.on(keydown|keyup|keypress|input|beforeinput|paste)\s*=/`

### 3. キーボード

#### 配列(`layout.ts`)

横 5 列 × 縦 4 行。キーの大きさを標準キーボード(iPhone の日本語かな、Gboard)に合わせるため、**使わない左右の列も枠として残す**。

```
[空] [あ] [か] [さ] [空]
[空] [た] [な] [は] [空]
[空] [ま] [や] [ら] [空]
[空] [゛゜小] [わ] [、。？！] [空]
```

- 空キーは押しても何も起きない(ログにも残さない)。見た目は背景よりわずかに濃い無地
- キー幅 = (画面幅 − 左右の余白 − 列間のすき間 × 4) ÷ 5
- キーボードの高さ = 画面幅 × 0.58(4 行+すき間)。この値は CSS 変数 `--kb-height-ratio` に置き、実機で標準キーボードと見比べて調整できるようにする
- 画面の下端に固定し、`env(safe-area-inset-bottom)` の分だけ下に余白を取る

#### フリック方向の対応

方向は `tap` / `left` / `up` / `right` / `down`。`—` はその方向に文字がない(何も入力しない。ミスにもしない)。

| キー | tap | left | up | right | down |
|---|---|---|---|---|---|
| あ | あ | い | う | え | お |
| か | か | き | く | け | こ |
| さ | さ | し | す | せ | そ |
| た | た | ち | つ | て | と |
| な | な | に | ぬ | ね | の |
| は | は | ひ | ふ | へ | ほ |
| ま | ま | み | む | め | も |
| や | や | — | ゆ | — | よ |
| ら | ら | り | る | れ | ろ |
| わ | わ | を | ん | ー | — |
| 、。？！ | 、 | 。 | ？ | ！ | — |
| ゛゜小 | 切替 | 切替 | 切替 | 切替 | 切替 |

- 「？」「！」は全角(U+FF1F、U+FF01)。「ー」は長音記号 U+30FC
- 「゛゜小」キーはどの方向でも「切替」1 回として扱う
- **トグル入力はしない。** 同じキーを続けてタップしても、毎回その行の「あ段」の文字が出る

#### 「゛゜小」の切り替え表(`kana.ts`)

直前の文字を、次の順に1つずつ進める(最後の次は最初に戻る)。

- `あ→ぁ` `い→ぃ` `う→ぅ` `え→ぇ` `お→ぉ`
- か行・さ行・た行(つ以外)の濁音: `か→が` `き→ぎ` … `ち→ぢ` `て→で` `と→ど`
- `つ→っ→づ`
- は行: `は→ば→ぱ` `ひ→び→ぴ` `ふ→ぶ→ぷ` `へ→べ→ぺ` `ほ→ぼ→ぽ`
- `や→ゃ` `ゆ→ゅ` `よ→ょ`
- 上にない文字は切り替わらない

`kana.ts` は次を公開する:

- `cycleOf(kana: string): string[]` — その文字を含む切り替えの列(なければ `[kana]`)
- `nextVariant(kana: string): string` — 1 つ進めた文字
- `TYPEABLE: ReadonlySet<string>` — キーボードで打てる文字すべて(配列の文字+切り替えで作れる文字)

#### 指の軌跡の読み取り(`gesture.ts`、純粋関数)

```ts
type Direction = "tap" | "left" | "up" | "right" | "down";
function readDirection(dx: number, dy: number, keyWidth: number): Direction;
```

- `Math.hypot(dx, dy) < keyWidth * 0.3` なら `tap`
- それ以外は `|dx| >= |dy|` なら左右、そうでなければ上下(画面の y は下向きが正)
- どのキーかは、指を置いた位置で決める(離した位置ではない)

#### Pointer Events の処理(`view.ts`)

- キーボードの要素で `pointerdown` / `pointermove` / `pointerup` / `pointercancel` を受ける。`pointerType !== "touch"` のイベントは無視する
- `pointerId` ごとに状態を持ち、複数の指を同時に追う(前の指を離す前に次のキーを押せる)
- `pointerdown` で `setPointerCapture` する。指を置いた座標・時刻(`event.timeStamp`)・`width`・`height`・`pressure` を記録する
- `pointermove` の回数を数える。指を置いている間は、フリックのガイド(下記)を出す
- **文字を確定するのは `pointerup`**。`pointercancel` は何も入力しない
- 確定した打鍵は `KeyStroke`(後述)としてゲームに渡す。方向に文字がない場合と空キーは渡さない
- Android では確定のたびに `navigator.vibrate?.(8)` を呼ぶ(対応していない環境では何もしない)

#### フリックのガイド(`guide.ts` / `view.ts`)

iPhone の日本語かなキーボードと同じ、十字型のガイドにする。

```
        [う]
   [い] [あ] [え]
        [お]
```

- 指を置いたキーを中心に、**キー1つと同じ大きさのマス**を5つ、十字に並べる。中心が tap、左・上・右・下がそれぞれの方向の文字
- 位置は `position: absolute` でキーボード要素(`position: fixed`)を基準に置く。**グリッドの流れには入れない**(キーの並びを崩さない)。`pointer-events: none`、キーより手前(`z-index`)に出す
- 上の行のキーの「上」マスは、キーボードの外(お題の側)にはみ出してよい
- 方向に文字がない(`—`)マスは出さない。「゛゜小」キーは中心のマスだけ(ラベル「゛゜小」)
- 今の方向のマスを強調する(アクセント色の背景に白文字)。それ以外のマスは白背景で、薄い影をつける
- `pointermove` のたびに `readDirection(dx, dy, keyWidth)` で今の方向を求め、強調するマスを切り替える。指を置いた直後は `tap`(中心)が強調されている
- `pointerup` / `pointercancel` でそのポインターのガイドを消す。複数の指を同時に使うときは、ポインターごとに別のガイドを出す
- マスの位置の計算は純粋関数にして `src/keyboard/guide.ts` に置く:
  ```ts
  type Rect = { x: number; y: number; width: number; height: number };
  function guideCells(key: Rect, values: string[]): { dir: Direction; label: string; rect: Rect }[];
  ```
  `key` はキーボード要素の左上を原点としたキーの矩形。`values` は `keyValues(id)` の結果(tap, left, up, right, down の順)。`—` の方向は返さない。左右のマスは `key.x ∓ key.width`、上下のマスは `key.y ∓ key.height`(列・行のすき間は含めなくてよい)
- テスト(`tests/guide.test.ts`): 5方向の位置、`—` の方向が返らないこと、「や」キーで左右が出ないこと

### 4. 判定(`judge.ts`、純粋関数)

状態は「今の文の何文字目か(`index`)」と「保留中の文字(`pending: string | null`)」。入力は「かな 1 文字」か「切替」。

```ts
type JudgeInput = { kind: "kana"; kana: string } | { kind: "modifier" };
type JudgeResult = "advance" | "pending" | "cycle" | "miss";
function judge(target: string, index: number, pending: string | null, input: JudgeInput)
  : { result: JudgeResult; index: number; pending: string | null };
```

`expected = target[index]` として:

| 状態 | 入力 | 条件 | 結果 |
|---|---|---|---|
| 保留なし | かな `k` | `k === expected` | `advance`(index+1) |
| 保留なし | かな `k` | `k !== expected` かつ `cycleOf(k)` に `expected` がある | `pending`(pending = k) |
| 保留なし | かな `k` | それ以外 | `miss`(状態は変えない) |
| 保留なし | 切替 | — | `miss` |
| 保留あり | 切替 | `nextVariant(pending) === expected` | `advance`(index+1、pending = null) |
| 保留あり | 切替 | それ以外 | `cycle`(pending = nextVariant(pending)。ミスではない) |
| 保留あり | かな | — | `miss`(pending はそのまま) |

- 例: お題「ぱ」→「は」で `pending`、切替で「ば」`cycle`、切替で「ぱ」`advance`
- 文字の比較は 1 文字(UTF-16 の 1 コード単位)単位。読みに使う文字はすべて BMP 内なので問題ない

### 5. ゲーム進行(`session.ts`、純粋な reducer)

```ts
type Action =
  | { type: "stroke"; t: number; input: JudgeInput }   // t はプレイ開始からのミリ秒(指を離した時刻 = KeyStroke.up.t)
  | { type: "tick"; t: number };
function createSession(seed: number, prompts: Prompt[]): SessionState;
function reduce(state: SessionState, action: Action): SessionState;
```

- `SessionState` に持つもの: 今のお題、`index`、`pending`、正しく打てた文字数、ミス数、今のコンボ、最大コンボ、今の文でミスしたか、終了時刻(ms)、もらったボーナスの一覧(演出用)、終わったかどうか、出したお題の id の列、乱数の状態
- 開始時の終了時刻は `RULES.baseTimeMs`(60000)
- `advance` のたび: 正しく打てた文字数 +1、コンボ +1、最大コンボを更新。コンボが `RULES.comboStep`(20)の倍数になったら終了時刻 +`RULES.comboBonusMs`(1000)
- 文を打ち終えたら: その文でミスがなければ終了時刻 +`RULES.perfectBonusMs`(1000)。次のお題に進む
- `miss` のたび: ミス数 +1、コンボを 0 に、今の文を「ミスあり」にする
- `t >= 終了時刻` の `stroke` / `tick` を受けたら終了にする。その `stroke` の判定はしない。終了後の action は無視する
- 残り時間に上限はない
- 同じ種・同じ action の列からは、必ず同じ状態になる(`Date.now()` や `Math.random()` を使わない)
- 画面側は `requestAnimationFrame` ごとに `tick` を送る。`t` はプレイ開始(カウントダウン終了)の `performance.now()` からの差。打鍵の `t` も同じ基準(`event.timeStamp` は `performance.now()` と同じ時間軸)

スコアの計算(result 画面とログで使う):

- 正確率 = 正しく打てた文字数 ÷ (正しく打てた文字数 + ミス数)。どちらも 0 なら 0
- 1 秒あたりの文字数 = 正しく打てた文字数 ÷ (終了時刻 ÷ 1000)

`rules.ts`:

```ts
export const RULES_VERSION = 1;
export const RULES = { baseTimeMs: 60000, comboStep: 20, comboBonusMs: 1000, perfectBonusMs: 1000 } as const;
```

### 6. お題(`prompts.json` / `prompts.ts` / `random.ts`)

`prompts.json` は配列。1 件は `{ "id": "p001", "text": "桜の花が咲きました。", "reading": "さくらのはながさきました。" }`。

お題の条件:

- 日常的な短い文。固有名詞・時事ネタ・人を傷つける内容は入れない
- `reading` は `TYPEABLE` の文字だけ。助詞は表記どおり(「は」「へ」「を」)。漢字・カタカナ・数字・英字・スペースを入れない(カタカナ語もひらがなで書く。例: 「こーひー」)
- `text` は自然な漢字かな混じり。`reading` は `text` の正しい読み
- 60 件。下の難易度で各レベル 15 件以上
- id は一意

難易度(`difficulty(reading): 1 | 2 | 3`):

- `len` = `reading` の文字数、`mod` = 切替が要る文字(濁音・半濁音・小書き文字)の数
- `len <= 12 && mod <= 1` → 1、`len >= 20 || mod >= 4` → 3、それ以外 → 2

お題の選び方:

- 乱数は `random.ts` の mulberry32(種は 32 bit 整数)。通常のプレイでは種を `crypto.getRandomValues` で作る
- 1〜3 文目はレベル 1、4〜6 文目はレベル 2、7 文目以降はレベル 3 から、まだ出していないものを等確率で選ぶ
- そのレベルに残りがなければ、レベル 3 → 2 → 1 の順に残りがあるレベルから選ぶ。すべて出し切ったら、出した記録を空にしてやり直す

### 7. play 画面

上から:

1. **残り時間**(小数 1 桁、大きく)。ボーナスをもらったら横に「+1秒」を 0.8 秒出す
2. **コンボ数**と、次のボーナスまでのゲージ(`combo % 20` / 20)。ミスでコンボが切れたらゲージが空になる演出。パーフェクトで文を終えたら「PERFECT」を出す
3. **正しく打てた文字数**
4. **お題**: 上段に `text`、下段に `reading`。`reading` は打ち終えた文字の色を変え、今の文字に下線を引く。保留中の文字があれば、今の文字の上に小さく出す。ミスしたら今の文字を 0.2 秒赤く光らせる
5. **キーボード**(画面の下端)

- カウントダウン中(3, 2, 1)はキーボードの入力を無視する
- 終了したら result 画面へ。bot 判定で止めたら blocked 画面へ(スコアと自己ベストは保存しない)

### 8. 環境チェック(`env.ts`)

ブラウザから値を集める関数と、判定する純粋関数を分ける。

```ts
type EnvSnapshot = {
  userAgent: string;
  maxTouchPoints: number;
  coarsePointer: boolean;            // matchMedia("(pointer: coarse)").matches
  webdriver: boolean;                // navigator.webdriver === true
  uaData: { mobile: boolean; platform: string } | null;  // navigator.userAgentData(ない環境は null)
  screenWidth: number;               // screen.width
  screenHeight: number;              // screen.height
};
type EnvVerdict = { kind: "ok" | "notPhone" | "automation"; reasons: string[] };
function collectEnv(): EnvSnapshot;
function checkEnv(s: EnvSnapshot): EnvVerdict;
```

`checkEnv` は上から順に調べ、当てはまった理由を `reasons` にすべて入れる。`automation` の理由が1つでもあれば `automation`、そうでなく `notPhone` の理由があれば `notPhone`、なければ `ok`。

| 理由 | 条件 | 種別 |
|---|---|---|
| `webdriver` | `webdriver === true` | automation |
| `no-touch` | `maxTouchPoints === 0` または `coarsePointer === false` | notPhone |
| `not-mobile-ua` | UA が `/iPhone/` にも `/Android.+Mobile/` にも一致しない | notPhone |
| `ipad-desktop-ua` | UA に `Macintosh` を含み、`maxTouchPoints > 1` | notPhone |
| `tablet-size` | `Math.min(screenWidth, screenHeight) > 500` | notPhone |
| `uadata-not-mobile` | `uaData !== null && uaData.mobile === false` | notPhone |
| `ios-with-uadata` | UA が iPhone なのに `uaData !== null`(iOS のブラウザはすべて WebKit で、`userAgentData` を持たない。持っているのは PC の Chrome がエミュレーションしている場合) | notPhone |
| `android-platform-mismatch` | UA が Android なのに `uaData !== null && uaData.platform !== "Android"` | notPhone |

- 起動時と、開始ボタンを押したときの 2 回調べる
- テスト(`tests/env.test.ts`)で、実機を想定した値(iPhone Safari、Android Chrome)が `ok`、PC の Chrome・PC の Chrome の iPhone エミュレーション・iPad・Android タブレット・webdriver が期待どおりに弾かれることを確かめる

### 9. 挙動分析(`behavior.ts` / `thresholds.ts`)

```ts
type KeyStroke = {
  key: KeyId;               // layout.ts の id: "a" | "ka" | "sa" | "ta" | "na" | "ha" | "ma" | "ya" | "ra" | "wa" | "mod" | "punct"
  dir: Direction;
  down: { x: number; y: number; t: number };   // キーボード要素の左上からの CSS px、t はプレイ開始からの ms
  up: { x: number; y: number; t: number };
  moves: number;            // pointermove の回数
  width: number; height: number; pressure: number;   // pointerdown 時の値
};
type BehaviorVerdict = { bot: boolean; reasons: string[]; metrics: Record<string, number> };
function analyze(strokes: KeyStroke[]): BehaviorVerdict;
```

- 打鍵が `MIN_STROKES`(10)未満なら判定しない(`bot: false`)。それ以上なら直近 `WINDOW`(20)件で判定する
- 打鍵のたびに呼ぶ

判定に使う規則(**どの端末でも人の指ではまず起きないものだけ**):

| 理由 | 条件 |
|---|---|
| `instant-press` | `up.t - down.t < 8` の打鍵が窓の 80% 以上 |
| `teleport-flick` | `dir !== "tap"` の打鍵が 5 件以上あり、そのうち `moves === 0` が 80% 以上 |
| `same-point` | 同じ `key` で `down.x`・`down.y` が完全に一致する打鍵が 8 件以上 |
| `too-fast` | 連続する打鍵の `down.t` の間隔の中央値が 40 ms 未満 |
| `too-regular` | 同じ間隔の変動係数(標準偏差 ÷ 平均)が 0.05 未満 |

- 数値はすべて `thresholds.ts` に置く
- 接触面の大きさ(`width`/`height`)と圧力(`pressure`)は、端末ごとの値の出方が分からないので **判定には使わない**。`metrics` に「窓の中で値が一種類しかないか」を入れ、計測モードで見られるようにするだけ
- `bot: true` になったら play 画面はその場で終わり、blocked 画面(「正しく操作できませんでした」)へ
- テスト(`tests/behavior.test.ts`)で、各規則が単独で発動すること、人の指を想定したばらつきのある打鍵列では発動しないことを確かめる

### 10. 入力ログ(`log.ts`)

```ts
type PlayLog = {
  rulesVersion: number;
  seed: number;
  promptIds: string[];                          // 出たお題の順
  strokes: (KeyStroke & { result: JudgeResult })[];
  final: { correct: number; miss: number; maxCombo: number; endTimeMs: number };
  env: EnvSnapshot;
  debug: boolean;
};
```

- 今回は送信しない。計測モードのダウンロードでだけ使う
- `replay(seed, prompts, strokes)` で `final` と同じ値が出ることをテスト(`tests/replay.test.ts`)で確かめる。`KeyStroke` から `JudgeInput` への変換(layout の対応表を引く)も `log.ts` か `layout.ts` の純粋関数にしておく

### 11. 計測モード(`?debug`)

- URL に `debug` パラメータがあれば有効
- 環境チェックの結果(`reasons` を含む)を title 画面に出す。**`notPhone` / `automation` でも blocked にせず遊べる**(PC で画面を確かめるため)。ただし `pointerType === "touch"` 以外は無視するのは同じ
- 挙動分析は動かすが、`bot: true` でも止めない。直近の判定と `metrics` を画面の隅に小さく出す
- 各打鍵の値(key, dir, 押していた時間, moves, width, height, pressure)を直近 10 件、半透明の表で出す
- result 画面に「ログを保存」ボタン。`PlayLog` を JSON で `flick-typing-log-<日時>.json` としてダウンロードさせる
- 計測モードのプレイは自己ベストに保存しない

### 12. 自己ベスト(`storage.ts`)

- `localStorage` のキー `flick-typing:best:v1` に `{ correct, accuracy, cps, date }` を保存
- 正しく打てた文字数が多いほうをベストとする
- `localStorage` の読み書きは `try/catch` で囲み、失敗してもゲームは動くようにする

### 13. 見た目

- 背景は明るい無地、文字は濃い色。キーは標準キーボードに近い見た目(角丸、軽い影)
- 日本語はシステムフォント(`-apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif`)
- 外部のフォントや画像は読み込まない
- 画面幅 320〜440 CSS px で崩れないこと

## 受け入れ条件

実装担当が確かめること:

- [ ] `npx.cmd tsc --noEmit` がエラーなしで終わる
- [ ] `npm.cmd test` がすべて通る。少なくとも次のテストファイルがある: `judge` / `gesture` / `guide` / `session` / `prompts` / `env` / `behavior` / `replay` / `no-os-input`
- [ ] `npm.cmd run build` が通り、`dist/` ができる
- [ ] `tests/judge.test.ts` が仕様 4 の表の全行と、「ぱ」「っ」「づ」の例を含む
- [ ] `tests/session.test.ts` が、20 コンボごとの +1 秒、パーフェクトの +1 秒、ミスでのコンボのリセット、終了時刻を過ぎた打鍵を無視することを含む
- [ ] `tests/prompts.test.ts` が、60 件・id の一意性・`reading` がすべて `TYPEABLE`・各レベル 15 件以上・同じ種で同じお題の順になることを確かめる

Claude Code とオーナーが実機で確かめること(実装担当は対象外):

- [ ] iPhone Safari と Android Chrome で、開始から結果まで遊べる
- [ ] キーの大きさが標準キーボードとほぼ同じ
- [ ] PC の Chrome で開くと「スマホで開いてください」、DevTools の iPhone エミュレーションでも同じ
- [ ] 計測モードで実機の打鍵の値が見られ、ログを保存できる

## 対象外

- ランキング、サーバー、スコアの送信
- タイムアタック、フィーバー
- 効果音、BGM
- デプロイ(Cloudflare Pages)
- PWA(manifest、Service Worker)
- 接触面の大きさ・圧力を使った判定(実機の計測後に別の仕様書で決める)

## 想定される落とし穴

- **`pointerup` の順番と打鍵の順番**: 複数の指を同時に使うとき、確定の順は `pointerup` の順。`pointerdown` の順で並べ直さない
- **iOS Safari のスクロールと拡大**: `touch-action: none` を付け忘れると、フリックでページが動いたりダブルタップで拡大したりする。`gesturestart` の `preventDefault` も必要
- **`event.timeStamp` の基準**: `performance.now()` と同じ時間軸だが、プレイ開始からの相対時刻に直してから reducer に渡す
- **`navigator.userAgentData` の型**: TypeScript の DOM 型に入っていない場合がある。自前で最小限の型を書く(`any` で逃げない)
- **お題の読みの誤り**: 読み間違いがあるとゲームとして成立しない。自信のない読みの文は入れない
- **テストの走査対象**: `no-os-input` のテストが自分自身の文字列に反応しないようにする
- **ファイルの文字コード**: お題の JSON と日本語を含むソースは UTF-8(BOM なし)で保つ
