# 標準キーボードのモード

## 背景

テストプレイで「iPhone では Safari のバーが下にあり、自前キーボードがいつものキーボードと違う位置に出て打ちにくい」「標準キーボードで打ちたい」という声があった。オーナーと相談し、**自前のフリックキーボードは残したまま、OS の標準キーボードでも遊べるモードを足す**ことにした。どちらで遊ぶかはタイトル画面で選ぶ。

標準キーボードでは、画面へのタッチ座標・押していた時間・指の動きがページに届かない。そのため、不正対策は自前キーボードより弱くなる(オーナー了承済み)。代わりに、入力欄の値の変化と `keydown` の値・表示領域の高さから、ペースト・変換・音声入力・物理キーボード・自動入力を見分ける。

### 実機の記録で分かったこと(Android 10 / Chrome 155 / Gboard 12キー、`?probe` の記録)

| 項目 | 記録の内容 |
|---|---|
| 画面キーボードの `keydown` | すべて `key: "Unidentified"`、`code: ""`、`keyCode: 229` |
| フリック入力 | `input` の `inputType` は `insertCompositionText`。入力欄の値は1文字ずつ増える。値が変わらない `input` も混ざる(同じ値がもう一度来る) |
| 変換候補を選んだとき | `insertCompositionText` のまま、変換中の文字列が「あいう」→「空いう」のように置き換わる(`insertReplacementText` ではない) |
| ペースト | `insertFromPaste`。長い文字列が一度に入る |
| 英字キーボード | 変換中の文字列に `b` `bl` のような英字が入る |
| 変換中に値を空にして入力欄 B へ `focus()`(シナリオ 8) | キーボードは閉じない。B では新しい変換が「い」から始まり、A の文字は戻ってこない |
| 変換中に `blur()` → 値を空に → `focus()`(シナリオ 9) | キーボードは閉じない。`compositionend` が先に来て、次の入力は空から始まる |
| 表示領域の高さ | `innerHeight` 734 に対し、キーボードが出ている間の `visualViewport.height` は 327(約 45%)。入力欄を切り替えた直後に 391 へ一瞬広がって 327 に戻る(予測変換のバーの出し入れと思われる)。ブラウザが入力欄を見せるために `visualViewport.offsetTop` を 0〜298 の間で動かす |

**iPhone の記録はまだない。** iPhone で違う動きをしそうな箇所は「想定される落とし穴」にまとめた。オーナーの iPhone で確かめてから公開する。

## 変更対象

触るファイル:

- `src/game/judge.ts` — 入力の種類に `replace` / `cancel` / `reject` を足す
- `src/game/session.ts` — ミスのときに `pending` を判定の結果で更新する(1行)
- `src/game/native-edit.ts` — 新規。入力欄の値の変化を判定の入力に変える純粋関数
- `src/anticheat/native.ts` — 新規。標準キーボードのモードの挙動分析(純粋関数)
- `src/anticheat/thresholds.ts` — 標準キーボード用のしきい値を足す
- `src/anticheat/log.ts` — ログにモードを足し、標準キーボードのログの再計算を足す
- `src/native/field.ts` — 新規。隠した入力欄2つの管理とイベントの受け取り(DOM)
- `src/screens/play.ts` — モードによって自前キーボードと入力欄を切り替える
- `src/screens/title.ts` — モードの選択
- `src/screens/result.ts` — モード名の表示
- `src/main.ts` — モードの受け渡し、モードごとの自己ベスト
- `src/storage.ts` — モードごとの自己ベスト、前回選んだモードの保存
- `src/debug/panel.ts` — 標準キーボードのモード用の表示
- `src/style.css` — モード選択と、標準キーボードのモードの play 画面
- `tests/judge.test.ts` / `tests/session.test.ts` / `tests/replay.test.ts` / `tests/no-os-input.test.ts` — 追記・変更
- `tests/native-edit.test.ts` / `tests/native-behavior.test.ts` — 新規

触らないファイル:

- `src/keyboard/**`、`src/anticheat/behavior.ts`、`src/anticheat/env.ts`、`src/game/kana.ts` / `prompts.ts` / `rules.ts` / `random.ts`、`src/data/**`、`src/probe/**`、`src/screens/reading-ticker.ts` / `blocked.ts`
- `index.html`、`package.json` などの設定、`AGENTS.md` / `CLAUDE.md` / `docs/**`

## 仕様

### 1. モードの名前と保存

- モードは `type PlayMode = "flick" | "native"`。`src/storage.ts` に置いて export する
- 画面に出す名前: `flick` →「フリックキーボード」、`native` →「スマホのキーボード」
- 前回選んだモードを `localStorage` のキー `flick-typing:mode:v1` に `"flick"` / `"native"` の文字列で保存する。読めない・値が不正なら `"flick"`
- 自己ベストはモードごとに分ける。`flick` は今までのキー `flick-typing:best:v1` をそのまま使う(既存の記録を残すため)。`native` は `flick-typing:best:native:v1`
- `loadBest(mode)` / `saveBest(mode, best)` / `loadMode()` / `saveMode(mode)` にする。読み書きは今までどおり `try/catch` で囲む

### 2. タイトル画面

- 「はじめる」の上に、2つのボタンでモードを選ぶ欄を置く(`フリックキーボード` / `スマホのキーボード`)。選んでいる方を強調する(`aria-pressed="true"`)
- 選ぶとすぐ `saveMode` し、自己ベストの表示をそのモードの値に変える
- `native` を選んでいるときは、説明の下に小さく「フリック入力で打ってください(トグル入力は使えません)」と出す
- `renderTitle` の引数は `(host, mode, loadBestFor: (mode) => Best | null, verdict, debug, onStart: (mode) => void)` のように、モードと自己ベストの読み出しを受け取る形にする

### 3. 判定(`judge.ts`)

入力の種類を足す。

```ts
export type JudgeInput =
  | { kind: "kana"; kana: string }
  | { kind: "modifier" }
  | { kind: "replace"; kana: string } // 最後の1文字が kana に置き換わった(゛゜小・トグル)
  | { kind: "cancel" } // 文字が消された
  | { kind: "reject" }; // 受け付けない入力(ペースト・変換・2文字以上・打てない文字)
export type JudgeResult = "advance" | "pending" | "cycle" | "miss" | "cancel";
```

`expected = target[index]` として、今までの表(MVP の仕様 4)に次の行を足す。今までの行の結果は変えない。

| 状態 | 入力 | 条件 | 結果 |
|---|---|---|---|
| 保留あり | 置換 `x` | `x === expected` | `advance`(index+1、pending = null) |
| 保留あり | 置換 `x` | `x !== expected` かつ `cycleOf(x)` に `expected` がある | `cycle`(pending = x) |
| 保留あり | 置換 `x` | それ以外 | `miss`(pending = null) |
| 保留なし | 置換 `x` | — | かな `x` と同じ扱い(保留なしの、かなの3行) |
| どちらでも | 取り消し | — | `cancel`(index はそのまま、pending = null) |
| どちらでも | 拒否 | — | `miss`(index はそのまま、pending = null) |

- 例: お題「ぱ」→ かな「は」で `pending`、置換「ば」で `cycle`、置換「ぱ」で `advance`。標準キーボードの「゛゜小」の切り替え順は端末ごとに違ってよい(置換後の文字だけで判定するため)
- 例: お題「あい」→ かな「あ」で `advance`、置換「い」(トグルで あ→い)で、保留なしなので かな「い」として `advance`

### 4. ゲーム進行(`session.ts`)

- `reduce` の `miss` の分岐で、`pending: judged.pending` を返す値に入れる。今までの判定では `miss` のとき pending は変わらないので、自前キーボードの挙動は変わらない
- `cancel` は今の `advance` 以外の分岐(状態を更新して返す)でそのまま扱える。コンボもミス数も変えない
- それ以外は変えない

### 5. 入力欄の値の変化を判定の入力にする(`src/game/native-edit.ts`、純粋関数)

```ts
export type NativeEdit = {
  t: number; // プレイ開始からの ms(input イベントの timeStamp - 開始時刻)
  inputType: string;
  before: string; // このイベントの前の入力欄の値
  after: string; // このイベントの後の入力欄の値
};
export function inputForEdit(edit: Pick<NativeEdit, "inputType" | "before" | "after">): JudgeInput | null;
```

`before` と `after` の先頭から一致する長さを `c` とし、`deleted = before.length - c`、`inserted = after.slice(c)` とする。上から順に調べ、最初に当てはまったものを返す。

| 条件 | 返す値 |
|---|---|
| `before === after` | `null`(何もしない。ログにも残さない) |
| `inputType` が `insertFrom` で始まる、または `historyUndo` / `historyRedo` | `reject` |
| `inserted === ""`(`deleted >= 1`) | `cancel` |
| `inserted` が2文字以上 | `reject` |
| `inserted` が `TYPEABLE` にない文字 | `reject` |
| `deleted === 0` | `{ kind: "kana", kana: inserted }` |
| `deleted === 1` | `{ kind: "replace", kana: inserted }` |
| それ以外(`deleted >= 2`) | `reject` |

テスト(`tests/native-edit.test.ts`)では、次の表の1行ごとに `it` を書く。

| before | after | inputType | 期待 |
|---|---|---|---|
| `""` | `"あ"` | `insertCompositionText` | かな「あ」 |
| `"あ"` | `"あい"` | `insertCompositionText` | かな「い」 |
| `"あ"` | `"あか"` | `insertText` | かな「か」 |
| `"か"` | `"が"` | `insertCompositionText` | 置換「が」 |
| `"か"` | `"き"` | `insertCompositionText` | 置換「き」 |
| `"あい"` | `"あい"` | `insertCompositionText` | `null` |
| `"あい"` | `"あ"` | `deleteContentBackward` | 取り消し |
| `"あいう"` | `""` | `deleteCompositionText` | 取り消し |
| `"あいう"` | `"空いう"` | `insertCompositionText` | 拒否 |
| `"あいう"` | `"あい空"` | `insertCompositionText` | 拒否 |
| `"あ"` | `"あいう"` | `insertCompositionText` | 拒否 |
| `""` | `"b"` | `insertCompositionText` | 拒否 |
| `"あ"` | `"あい"` | `insertFromPaste` | 拒否 |
| `"あい"` | `"う"` | `insertCompositionText` | 拒否(`deleted` が 2) |

### 6. 挙動分析(`src/anticheat/native.ts`、純粋関数)

```ts
export type NativeEditLog = NativeEdit & {
  trusted: boolean; // input イベントの isTrusted
  viewportRatio: number; // そのときの visualViewport.height / innerHeight
};
export type NativeKeyLog = { t: number; code: string; trusted: boolean }; // keydown
export function analyzeNative(edits: NativeEditLog[], keys: NativeKeyLog[]): BehaviorVerdict;
```

`BehaviorVerdict` は `behavior.ts` の型をそのまま使う。`edits` は `inputForEdit` が `null` 以外を返したものだけ(値が変わったものだけ)。しきい値は `thresholds.ts` に足す。

| 理由 | 条件 | しきい値の名前と値 |
|---|---|---|
| `untrusted` | `edits` か `keys` に `trusted === false` が1件でもある | — |
| `physical-key` | `keys` のうち `code !== ""` が N 件以上 | `NATIVE_PHYSICAL_KEYS = 3` |
| `no-soft-keyboard` | 直近 `WINDOW` 件の `edits` が `NATIVE_NO_KB_MIN` 件以上あり、そのうち `viewportRatio > NATIVE_SOFT_KB_RATIO` の割合が `NATIVE_NO_KB_SHARE` 以上 | `NATIVE_SOFT_KB_RATIO = 0.85`、`NATIVE_NO_KB_MIN = 10`、`NATIVE_NO_KB_SHARE = 0.8` |
| `too-fast` | `edits` が `MIN_STROKES` 件以上のとき、直近 `WINDOW` 件の `t` の間隔の中央値が `FAST_MEDIAN` 未満 | 既存の値 |
| `too-regular` | 同じ間隔の変動係数が `REGULAR_CV` 未満 | 既存の値 |

- `untrusted` / `physical-key` は件数によらず判定する(`edits` が少なくても出す)
- `metrics` に `medianInterval`、`viewportRatio`(直近の値)、`physicalKeys`(`code !== ""` の件数)を入れる
- テスト(`tests/native-behavior.test.ts`)で、各理由が単独で出ること、人の入力を想定した列(間隔 150〜400ms でばらつく、`viewportRatio` 0.45、`code` が空)では何も出ないことを確かめる。1つの `it` で1つの理由

### 7. 入力欄(`src/native/field.ts`、DOM)

```ts
export type NativeFieldHandlers = {
  onEdit: (edit: { inputType: string; before: string; after: string; timeStamp: number; trusted: boolean }) => void;
  onKey: (key: { code: string; timeStamp: number; trusted: boolean }) => void;
  onKeyboardChange: (shown: boolean) => void;
  onViewport: (view: { height: number; top: number; ratio: number }) => void;
};
export type NativeField = { focus(): void; clear(): void; destroy(): void };
export function mountNativeField(host: HTMLElement, handlers: NativeFieldHandlers): NativeField;
```

- `host` の中に `<input>` を2つ作る。属性は `?probe` の入力欄と同じ(`type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" lang="ja"`)。`aria-label="入力"` を付ける
- 見た目: `position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; font-size: 16px; caret-color: transparent; border: 0; padding: 0;`。`display: none` や `visibility: hidden` にはしない(フォーカスできなくなるため)
- 2つのうち「今の入力欄」を1つ持つ。各入力欄で直前の値(`before` に使う)を覚えておく
- `input` イベント: 今の入力欄のものだけ扱う。`onEdit({ inputType, before: 覚えていた値, after: input.value, timeStamp: event.timeStamp, trusted: event.isTrusted })` を呼んでから、覚えていた値を `after` にする。`before === after` でも呼ぶ(捨てるかは呼び出し側)
- `keydown` イベント: 両方の入力欄で `onKey({ code: event.code, timeStamp, trusted })` を呼ぶ。`preventDefault` はしない
- `clear()`: 今の入力欄の値を `""` にし、もう一方の入力欄の値も `""` にしてから、もう一方に `focus()` する。もう一方を「今の入力欄」にし、両方の覚えていた値を `""` にする。**`setTimeout` を使わず同期的に行う**(実機の記録で、`input` イベントの中で同期的に切り替えるとキーボードが閉じなかったため)
- `focus()`: 今の入力欄に `focus()` する
- キーボードの表示: 次のどちらかになったら `onKeyboardChange(false)`、両方とも解消したら `onKeyboardChange(true)` を呼ぶ(変わったときだけ)
  - どちらの入力欄にもフォーカスがない。`blur` の 100ms 後に `document.activeElement` を見て決める(`clear()` の切り替えで一瞬外れるのを無視するため)
  - `visualViewport.height / innerHeight > NATIVE_SOFT_KB_RATIO` が 300ms 続いた(Android の戻るボタンでキーボードだけ閉じたとき)
- `visualViewport` の `resize` / `scroll` で `onViewport({ height: vv.height, top: vv.offsetTop, ratio: vv.height / innerHeight })` を呼ぶ。`mountNativeField` の直後にも1回呼ぶ。`visualViewport` がない環境では `innerHeight` と 0 と 1 を渡す
- `destroy()`: 登録したリスナーをすべて外し、入力欄を `blur()` して取り除く。タイマーも止める
- このファイルは `src/game/` / `src/anticheat/` の外なので DOM と `setTimeout` を使ってよい

### 8. play 画面

`renderPlay` の `PlayOptions` に `mode: PlayMode` を足す。`onFinish` の2つ目の引数は、`flick` のとき今までどおり `KeyStroke[]`、`native` のとき `NativeEditLog[]` にする(`{ mode: "flick"; strokes } | { mode: "native"; edits }` のような判別できる形にする)。

`flick` のときは今までと同じ。`native` のときは次のとおり。

- `#keyboard` と「FLICK ONLY」を出さない。`.play` に `is-native` クラスを付ける
- **`renderPlay` の中で同期的に `mountNativeField` して `focus()` する。** タイトルの「はじめる」・結果の「もう一度」の `click` から同期的に呼ばれるので、iOS でもキーボードが開く。`await` や `setTimeout` を挟まない
- カウントダウン中の入力は判定しない・記録しない。カウントダウンが終わったら `clear()` してから始める
- `onEdit` を受けたら:
  1. 動いていなければ何もしない
  2. `inputForEdit` が `null` なら何もしない
  3. `NativeEditLog` を作って記録する(`t` は `timeStamp - startedAt`、`viewportRatio` は直近の `onViewport` の値)
  4. `reduce(state, { type: "stroke", t, input })` で進める
  5. `analyzeNative(edits, keys)` が `bot` で、計測モードでなければ、自前キーボードと同じように blocked 画面へ
  6. 文を打ち終えて `promptIndex` が変わったとき、または入力が `reject` だったときは `clear()` する
  7. 再描画する
- `onKey` は、動いている間だけ `NativeKeyLog` として記録する
- `onKeyboardChange(false)` のとき、画面の下半分に「タップしてキーボードを出す」ボタンを重ねる。押したら、今の入力欄を `blur()` してから `focus()` する(Android でフォーカスが残ったままキーボードだけ閉じていても開き直すため)。`NativeField` に `reopen()` を足してよい。**タイマーは止めない**(横向きの表示と同じ考え方)
- `onViewport` のとき、`.play` の `style` に `--vv-height`(px)と `--vv-top`(px)を入れる
- 画面のどこかをタップしても入力欄のフォーカスが外れないよう、`.play` の `pointerdown` で `preventDefault()` する。ただし「タップしてキーボードを出す」ボタンの上では呼ばない
- 画面を離れるとき(`stop`)は `destroy()` する
- 計測モードの表示は §10

### 9. 標準キーボードのモードの見た目(`style.css`)

- `.play.is-native` は `position: fixed; left: 0; right: 0; top: var(--vv-top, 0px); height: var(--vv-height, 100dvh);` にし、表示領域(キーボードの上の部分)にちょうど収める。`transition` は付けない
- 縦の並びは今と同じ(残り時間・時間のバー・お題・NEXT・コンボ)。お題の領域が伸び縮みし、他は高さを固定する
- **高さ 320px(Android の記録で 327px)でも、漢字・読みの行・コンボがすべて見えること。** 高さが足りないときは、NEXT を隠す → 装飾(`.deco`)を隠す → 余白を詰める、の順で削る。`@media` ではなく表示領域の高さで決まるので、`.play.is-native` の中は `flex` で縮むように書き、NEXT と装飾は `--vv-height` が 400px 未満のとき play.ts で `is-compact` クラスを付けて隠す
- 「タップしてキーボードを出す」ボタンは、既存の `primary-button` の見た目で、表示領域の中央に置く

### 10. 計測モード(`?debug`)

- タイトル画面: 今までの環境チェックの表示に加えて、変更なし
- play 画面(`native`): `renderNativeDebugPanel(host, verdict, edits, viewport)` を `debug/panel.ts` に足す。直近10件の `inputType` / `before` → `after` / 判定の結果(`lastResult`)/ `viewportRatio` を表にする。`verdict` と `metrics` は自前キーボードと同じ形で出す。描画時間の計測は `native` では出さなくてよい
- 判定の結果を表に出すため、`NativeEditLog` とは別に、play.ts の中で直近の結果を一緒に持ってよい(ログの型は変えない)

### 11. 入力ログと再計算(`log.ts`)

```ts
export type PlayLog = {
  rulesVersion: number;
  mode: PlayMode;
  seed: number;
  promptIds: string[];
  strokes: (KeyStroke & { result: JudgeResult })[]; // native のときは []
  edits: (NativeEditLog & { result: JudgeResult })[]; // flick のときは []
  final: { correct: number; miss: number; maxCombo: number; endTimeMs: number };
  env: EnvSnapshot;
  debug: boolean;
};
export function replay(seed: number, prompts: Prompt[], strokes: KeyStroke[]): PlayLog; // mode: "flick"
export function replayNative(seed: number, prompts: Prompt[], edits: NativeEditLog[]): PlayLog; // mode: "native"
```

- `replayNative` は各 `edit` を `inputForEdit` で変え、`null` は飛ばし、`edit.t >= state.endTimeMs` や終了後は飛ばす(`replay` と同じ)
- 入力欄の `clear()` は再計算に影響しない(`before` / `after` がログに残っているため)
- `RULES_VERSION` は変えない(自前キーボードのルールは変わっていない)
- テスト(`tests/replay.test.ts`)に、`replayNative` で `final` が play と同じ値になること(お題を1文打ち切る列で確かめる)と、`reject` がミスに数えられることを足す

### 12. main.ts と結果画面

- `startGame(mode)` にし、`renderPlay` に `mode` を渡す。結果画面の「もう一度」は同じモードで始める
- 自己ベストの読み書きは、そのプレイのモードで行う
- 計測モードの「ログを保存」は、`flick` なら `replay`、`native` なら `replayNative` の結果を保存する
- 結果画面の `ResultValues` に `mode` を足し、「正しく打てた文字数」の上に小さくモードの名前を出す

### 13. OS の入力の検査(`tests/no-os-input.test.ts`)

- 走査から除く場所に `src/native/` を足す(`src/probe/` と同じ扱い)
- 新しい `it` を足し、`src/` の下で `/<(input|textarea|select)\b/i`・`createElement\(\s*["']input["']`・`addEventListener\(\s*["'](keydown|input)["']` のどれかに一致するファイルが、`src/native/field.ts` と `src/probe/probe.ts` だけであることを確かめる

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `tests/judge.test.ts` に仕様 3 の表の6行が1行ずつある。今までのテストは変えずに通る
- [ ] `tests/native-edit.test.ts` に仕様 5 の表の14行が1行ずつある
- [ ] `tests/native-behavior.test.ts` に仕様 6 の5つの理由と、人の入力で何も出ない場合がある
- [ ] `tests/session.test.ts` に、保留ありで `reject` を受けると pending が null になるテストがある
- [ ] `grep -rn "Date.now\|Math.random\|document\.\|window\." src/game src/anticheat` が `src/anticheat/env.ts` 以外を出さない
- [ ] 以下は Claude Code がブラウザで確かめる(実装担当は不要): `?debug` のタイトルでモードを切り替えると自己ベストの表示が変わり、再読み込みしても選んだモードが残る。`native` で始めると入力欄にフォーカスがあり、文字を入れると判定が進む
- [ ] 以下はオーナーが実機で確かめる: iPhone Safari と Android Chrome で、`native` のモードが開始から結果まで遊べる。お題が変わってもキーボードが閉じない

## 対象外

- トグル入力への正式な対応(置換の扱いで一部は通るが、「あ」をトグルで「い」にする途中の「あ」はミスになる)
- 自前キーボードの位置や大きさの変更
- スコアの送信・ランキング・サーバー側の検証
- 横向きでの利用
- 標準キーボードのモードで「`reject` が続いたら止める」などの追加の罰(今はミス1回として数えるだけ)

## 想定される落とし穴

- **iPhone の動きは未確認。** 次は Android の記録だけで決めている。iPhone で違ったら仕様を直す(実装担当は Android の記録どおりに作ればよい)
  - iOS の画面キーボードの `keydown` の `code` が空か(空でなければ `physical-key` で誤って止まる)
  - iOS の `innerHeight` がキーボードで縮まないか(縮むと `viewportRatio` が 1 に近くなり、`no-soft-keyboard` で誤って止まる)
  - iOS で、`input` イベントの中の `focus()` でもう一方の入力欄へ移ったとき、キーボードが閉じないか。変換中の文字が戻ってこないか
  - iOS の「゛゜小」が `insertCompositionText` の置換で来るか(`insertReplacementText` で来る場合も、`inputType` ではなく値の差で判定するので動くはず)
- Gboard は値が変わらない `input` を送ってくる。`inputForEdit` の `null` で捨て、挙動分析の間隔にも入れない(入れると `too-fast` で誤って止まる。記録では 15ms 間隔で来ていた)
- `clear()` の中で今の入力欄の `blur` が起きる。キーボードの表示の判定(100ms 待つ)と、`stop` 後の処理で誤動作しないようにする
- `src/game/` と `src/anticheat/` では DOM・`Date.now()`・`Math.random()` を使わない。`native-edit.ts` と `native.ts` に `visualViewport` などを読ませず、値は引数で受け取る
- `PlayLog` に `mode` と `edits` を足すので、`replay` のテストで `PlayLog` 全体を比べている箇所があれば合わせて直す
- `body` の `user-select: none` と `touch-action: none` は入力欄の入力には影響しない(調査ページで確認済み)。入力欄に `user-select` を戻す必要はない
- 自己ベストのキーを変えないこと(`flick-typing:best:v1` は `flick` のまま)
