# 耐久モード(デイリー・1ミスで終了)

## 背景

オーナーの要望。今のモード(60秒+ボーナスで何文字打てるか)に加えて、小説の文章を「1回間違えたら終了」で何文字打てるかを競うモードを足す。決まっていること:

- 文章は著作権の切れた小説(青空文庫)。読み仮名はオーナーが完成後に確認する
- 時間の扱いは「残り時間があり、正しく打つと少し回復する」(速く正確に打つほど長く続く)
- 文章は日替わり(全員が同じ日に同じ文章を打つ)。毎日来る理由にする
- 自前のフリックキーボードと、標準キーボードのモード(`native`)の両方で遊べる。タイトル画面で選んでいる入力方法をそのまま使う

将来、この結果をランキングに送り、サーバーで入力ログを再計算して検証する。そのため進行は今のモードと同じく「文章+打鍵の列」から完全に再現できる純粋な関数で書く。

## 変更対象

触るファイル:

- `src/data/endurance.json` — 新規。7作品の文章(仕様 1)
- `src/game/endurance.ts` — 新規。ルール・日替わりの選び方・進行(純粋な関数)
- `src/game/rules.ts` — 耐久モードのルールの定数を足す
- `src/anticheat/log.ts` — `replayEndurance` を足す
- `src/storage.ts` — 耐久モードの今日のベストの読み書きを足す(入力方法ごと)
- `src/screens/endurance.ts` — 新規。耐久モードのプレイ画面
- `src/screens/endurance-result.ts` — 新規。耐久モードの結果画面
- `src/screens/title.ts` — 耐久モードの入口を足す
- `src/main.ts` — 耐久モードの開始と終了の流れを足す
- `src/style.css` — 新しい画面に必要な分だけ足す
- `tests/endurance.test.ts`、`tests/endurance-data.test.ts`、`tests/endurance-replay.test.ts` — 新規

触らないファイル:

- `src/game/session.ts`・`judge.ts`・`kana.ts`・`prompts.ts` — 今のモードの判定と進行は変えない(`judge` と `TYPEABLE`・`breakIndexes` は import して使う)
- `src/screens/play.ts`・`result.ts`・`reading-ticker.ts` — 今のモードの画面は変えない(`createReadingTicker` は import して使う)
- `src/anticheat/behavior.ts`・`native.ts`・`env.ts`・`thresholds.ts`、`src/keyboard/**`、`src/native/**`、`src/probe/**`(どれも import して使うだけ)
- `src/game/native-edit.ts`(`inputForEdit` を import して使うだけ)
- `src/data/prompts.json`
- `index.html`、`package.json`、`AGENTS.md` / `CLAUDE.md` / `docs/**`(`docs/endurance-source/` の原文も変えない)

## 仕様

### 1. 文章のデータ(`src/data/endurance.json`)

#### 原文

原文は Claude Code が青空文庫から取ってきて `docs/endurance-source/` に UTF-8 で置いてある。**文章は必ずこのファイルから取る。記憶から書かない。**

| id          | 作品名           | 著者       | 原文ファイル    | 図書カード                                               |
| ----------- | ---------------- | ---------- | --------------- | -------------------------------------------------------- |
| `melos`     | 走れメロス       | 太宰治     | `melos.txt`     | https://www.aozora.gr.jp/cards/000035/card1567.html      |
| `kumo`      | 蜘蛛の糸         | 芥川竜之介 | `kumo.txt`      | https://www.aozora.gr.jp/cards/000879/card92.html        |
| `chumon`    | 注文の多い料理店 | 宮沢賢治   | `chumon.txt`    | https://www.aozora.gr.jp/cards/000081/card43754.html     |
| `tebukuro`  | 手袋を買いに     | 新美南吉   | `tebukuro.txt`  | https://www.aozora.gr.jp/cards/000121/card637.html       |
| `yume`      | 夢十夜           | 夏目漱石   | `yume.txt`      | https://www.aozora.gr.jp/cards/000148/card799.html       |
| `toshishun` | 杜子春           | 芥川竜之介 | `toshishun.txt` | https://www.aozora.gr.jp/cards/000879/card43015.html     |
| `yodaka`    | よだかの星       | 宮沢賢治   | `yodaka.txt`    | https://www.aozora.gr.jp/cards/000081/card473.html       |

JSON の配列もこの表の順に並べる(日替わりの順番になる)。

#### 使う範囲

- 本文の先頭から使う。原文ファイルの冒頭(作品名・著者・`-----` で囲まれた記号の説明)は使わない
- 見出し(`［＃８字下げ］一［＃「一」は中見出し］` など)は使わない。`yume` は「第一夜」の本文から始める
- 読みの合計が **1200 字以上になった最初の文末**で切る。読みの合計は 1800 字を超えないこと

#### 原文の記号の扱い

| 原文                                   | 表示用の文(`text`)                            | 読み(`reading`)                     |
| -------------------------------------- | ----------------------------------------------- | ----------------------------------- |
| `漢字《かんじ》`(ルビ)               | `漢字`(`《…》` を消す)                        | ルビの読みを使う                    |
| `｜`(ルビの始まり)                    | 消す                                            | —                                   |
| `［＃…字下げ］` などの組版の注記       | 消す                                            | —                                   |
| `※［＃「特のへん＋廴＋聿」…］`        | `犍`                                            | 前後とあわせて読む(`犍陀多` は `かんだた`) |
| `※［＃「目＋爭」…］`                  | `睜`                                            | 前後とあわせて読む                  |
| 行頭の全角スペース・改行               | 消す                                            | —                                   |

上の表にない `※［＃…］` が使う範囲に出てきたら、止めて聞く。

#### 読みの決まり

- 読みに使える文字は `TYPEABLE`(`src/game/kana.ts`)だけ。ひらがな、`ー`、`、。？！`
- カタカナはひらがなにする(`メロス` → `めろす`、`タンタアーン` → `たんたあーん`)。長音の `ー` はそのまま残す
- `、` `。` `？` `！` は文と同じ位置で読みにも入れる。全角の `！` `？` が原文にあればそのまま
- `「」『』（）…―・` など打てない記号は、文には残し、読みからは除く
- ルビがあるところはルビに従う。ただし旧仮名のルビは今の仮名に直す(`水晶《すいしよう》` → `すいしょう`)
- ルビがないところは、その作品の新字新仮名の版として自然な読みにする。漢数字は読む(`十六` → `じゅうろく`)
- 読みが2通り以上考えられる語(例: `今日` の `きょう` / `こんにち`、`何` の `なに` / `なん`)は、文脈で決めたうえで、**完了報告にすべて列挙する**(オーナーが確認する)

#### 1件の形

```json
{
  "id": "melos",
  "title": "走れメロス",
  "author": "太宰治",
  "cardUrl": "https://www.aozora.gr.jp/cards/000035/card1567.html",
  "prompts": [
    {
      "id": "melos-001",
      "text": "メロスは激怒した。",
      "reading": "めろすはげきどした。",
      "chunks": [
        ["メロスは", "めろすは"],
        ["激怒した。", "げきどした。"]
      ]
    }
  ]
}
```

- `prompts` は今のお題と同じ `Prompt` 型(`src/game/prompts.ts`)。`id` は `<作品id>-<3桁の連番>`
- 1件の `text` は **32 字以内**。文末(`。` `！` `？`、閉じかぎ `」`)で区切り、32 字を超える文は `、` か文節の区切りでさらに分ける
- `chunks` は文節ごと。1つ目をつなげると `text`、2つ目をつなげると `reading` になる
- 型は `src/game/endurance.ts` に置く:

  ```ts
  export type Passage = {
    id: string;
    title: string;
    author: string;
    cardUrl: string;
    prompts: Prompt[];
  };
  export const PASSAGES = data as Passage[];
  ```

### 2. ルール(`src/game/rules.ts`)

既存の `RULES` / `RULES_VERSION` は変えずに、次を足す。

```ts
export const ENDURANCE_RULES_VERSION = 1;

export const ENDURANCE_RULES = {
  startMs: 10000, // 開始時の残り時間
  maxMs: 10000, // 残り時間の上限
  // 正しく打った1文字ごとに回復する時間。打った文字数(この文字を打つ前の数)が from 以上の行を使う
  gains: [
    { from: 0, gainMs: 800 },
    { from: 100, gainMs: 600 },
    { from: 300, gainMs: 450 },
    { from: 600, gainMs: 350 },
    { from: 1000, gainMs: 250 },
  ],
} as const;
```

- 「1秒あたり何字打てば時間が減らないか」は、800ms なら 1.25 字/秒、250ms なら 4 字/秒。後半ほど速さが要る
- `、` `。` も1文字として数える(今のモードと同じ)

### 3. 進行(`src/game/endurance.ts`)

DOM・`Date.now()`・`Math.random()` を使わない。

```ts
export type EnduranceEnd = "miss" | "timeout" | "complete";

export type EnduranceState = {
  prompts: Prompt[];
  promptIndex: number;
  index: number; // 今の文の読みの何文字目か
  pending: string | null;
  correct: number;
  deadlineMs: number; // 開始からこの時刻(ms)で時間切れ
  finished: boolean;
  end: EnduranceEnd | null;
  endMs: number | null; // 終わった時刻(開始からの ms)
  miss: { expected: string; typed: string | null } | null; // typed が null は「受け付けない入力」
  lastResult: JudgeResult | null;
};

export function gainFor(correct: number): number;
export function createEndurance(prompts: Prompt[]): EnduranceState;
export function reduceEndurance(state: EnduranceState, action: Action): EnduranceState;
```

`Action` は `src/game/session.ts` の型を import して使う。

- `createEndurance`: `deadlineMs = ENDURANCE_RULES.startMs`、ほかは 0 / null / false
- `gainFor(correct)`: `gains` のうち `from <= correct` を満たす最後の行の `gainMs`
- `reduceEndurance`:
  1. `finished` なら何もしない
  2. `action.t >= deadlineMs` なら `finished: true`、`end: "timeout"`、`endMs: deadlineMs`(打鍵でも tick でも同じ。その打鍵は判定しない)
  3. tick ならここで終わり
  4. `judge(今の文の reading, index, pending, input)` で判定する
  5. `miss` なら `finished: true`、`end: "miss"`、`endMs: action.t`、`miss: { expected, typed }`。`expected` は読みの今の文字。`typed` は入力が `kana` / `replace` ならその文字、`modifier` なら `"゛゜小"`、`reject`(標準キーボードでの貼り付け・変換・2文字以上・打てない文字)なら `null`
  6. `pending` / `cycle` / `cancel` なら `pending` だけ更新する(時間は回復しない。標準キーボードで文字を消した `cancel` はミスにしない)
  7. `advance` なら `deadlineMs = min(action.t + maxMs, deadlineMs + gainFor(correct))` にしてから `correct + 1`
  8. 文の最後まで打ったら次の文へ(`index: 0`、`pending: null`)。最後の文の最後まで打ったら `finished: true`、`end: "complete"`、`endMs: action.t`
- 今のモードと違い、文を一周して先頭に戻ることはない

日替わりの選び方も同じファイルに置く:

```ts
/** "2026-10-15" のような日付から、2026-01-01 を 0 とした通し日数を返す */
export function dayNumber(dateKey: string): number;
/** その日の文章。dayNumber を passages.length で割った余り(負の日も 0 以上にする) */
export function passageFor(dateKey: string, passages: Passage[]): Passage;
```

- `dayNumber` は `Date.UTC(年, 月 - 1, 日)` との差を 86400000 で割って求める(`Date.UTC` は現在時刻を使わないので規約に反しない)
- 日付の文字列(日本時間)を作るのは `main.ts` の役目。`new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)`
- 2026-10-15 は `dayNumber` が 287、7作品なら `287 % 7 = 0` で `melos`

### 4. 入力ログ(`src/anticheat/log.ts`)

今の `replay` と同じ考え方で足す。

```ts
export type EnduranceLog = {
  rulesVersion: number; // ENDURANCE_RULES_VERSION
  kind: "endurance";
  mode: PlayMode;
  dateKey: string;
  passageId: string;
  strokes: (KeyStroke & { result: JudgeResult })[]; // native のときは []
  edits: (NativeEditLog & { result: JudgeResult })[]; // flick のときは []
  final: { correct: number; end: EnduranceEnd; endMs: number };
  env: EnvSnapshot;
  debug: boolean;
};

export function replayEndurance(
  dateKey: string,
  passage: Passage,
  input: { mode: "flick"; strokes: KeyStroke[] } | { mode: "native"; edits: NativeEditLog[] },
): EnduranceLog;
```

- `flick` は打鍵ごとに `inputForStroke` → `reduceEndurance`(時刻は `up.t`)。`native` は変化ごとに `inputForEdit` → `reduceEndurance`(時刻は `t`)。`null` になる入力は飛ばす(今の `replay` / `replayNative` と同じ)
- `finished` になった後の入力はログに入れない
- 最後の打鍵の後に時間切れになっている場合(打鍵が止まって時間切れ)は、最後に `{ type: "tick", t: deadlineMs }` を流して `timeout` にする
- `env` は今の `emptyEnv()` を使い、呼び出し側で上書きする(今の `replay` と同じ)

### 5. 保存(`src/storage.ts`)

- 入力方法ごとに分ける。キーは `flick` が `"flick-typing:endurance:v1"`、`native` が `"flick-typing:endurance:native:v1"`。値は `{ dateKey: string; passageId: string; correct: number; date: string }`
- `loadEnduranceBest(mode: PlayMode, dateKey: string): EnduranceBest | null` — 保存値の `dateKey` が違えば `null`(前の日の記録は見せない)
- `saveEnduranceBest(mode: PlayMode, best: EnduranceBest): void`
- 既存の関数と同じく `try` / `catch` で囲む

### 6. タイトル画面(`src/screens/title.ts`)

今の「はじめる」ボタンの下に、耐久モードの区画を足す。

```
┌────────────────────────────┐
│ 今日の耐久チャレンジ        │
│ 走れメロス / 太宰治         │
│ 今日のベスト  123 字        │  ← まだなら「—」
│ [ 耐久チャレンジ ]          │
│ 1回ミスしたら終了。         │
└────────────────────────────┘
```

- `renderTitle` の引数に `endurance: { title: string; author: string; loadBest: (mode: PlayMode) => number | null }` と `onStartEndurance: (mode: PlayMode) => void` を足す
- 耐久モードは、入力方法の切替(フリックキーボード / スマホのキーボード)で今選んでいる方で遊ぶ
- 入力方法を切り替えたら、今のモードの自己ベストと同じく「今日のベスト」の表示もその入力方法の値に変える
- `native` を選んでいるときに出る「フリック入力で打ってください(トグル入力は使えません)」は、耐久モードにもそのまま当てはまる(トグル入力の途中の文字はミスになり、耐久モードでは即終了する)。文言は変えなくてよい
- 小さい画面(高さ 640px 程度)でも、今の「はじめる」ボタンが画面外に押し出されないこと。収まらなければ止めて聞く

### 7. プレイ画面(`src/screens/endurance.ts`)

`renderEndurance(host, passage, options)` を作る。`options` は `{ mode: PlayMode; debug: boolean; onFinish(state, payload): void; onBlocked(): void }`。`payload` は `play.ts` と同じ `{ mode: "flick"; strokes } | { mode: "native"; edits }`。

`play.ts` を参考に、次の部品を同じように使う: カウントダウン(3・2・1)、`createReadingTicker`、文節での改行(`breakIndexes`)、`performance.now()` を基準にした時刻、変わったときだけ DOM を書き換える描き方。

入力方法ごとの部分も `play.ts` と同じにする:

- `flick`: `mountKeyboard`、`analyze(strokes)` で自動入力を検出(`bot` かつ `debug` でなければ `onBlocked`)、「FLICK ONLY」
- `native`: `.play.is-native`、`mountNativeField`(`onEdit` / `onKey` / `onKeyboardChange` / `onViewport`)、`inputForEdit`、`analyzeNative(edits, keys)` で自動入力を検出、キーボードが閉じたときの「タップしてキーボードを出す」、`--vv-height` / `--vv-top` と `is-compact`、文が変わったときと `reject` のときの `field.clear()`、`pointerdown` の `preventDefault`
- プレイ画面の外側のクラス(`screen play` / `is-native` / `is-counting` など)は `play.ts` と同じ名前を使い、既存の CSS がそのまま効くようにする。耐久モードだけの見た目は `.endurance` のような追加のクラスで足す
- `play.ts` から共通部分を切り出す書き換えはしない(今のモードの挙動を変えないため)。同じような処理が2か所にあってよい

今のモードとの違い:

| 部分         | 耐久モード                                                                 |
| ------------ | -------------------------------------------------------------------------- |
| ヘッダー     | 残り秒数(小数1桁)と、打った文字数「123 字」                               |
| 時間バー     | 幅は `残り / maxMs`。残り 3 秒以下で今の `urgent` と同じ見た目             |
| 文の上       | 作品名と、進んだ割合(打った文字数 ÷ 読みの合計。整数の %)                |
| コンボ・PERFECT・+1秒 | 出さない                                                          |
| NEXT         | 今のモードと同じく次の文を出す。最後の文では出さない                       |

終わり方:

- `miss`: キーボードを止め、読みの今の文字を `is-miss` の見た目にしたまま **1.2 秒**止めてから `onFinish` を呼ぶ(何を間違えたか見えるように)
- `timeout`: 残りを `0.0` にして 0.6 秒止めてから `onFinish`
- `complete`: すぐ `onFinish`
- 止めている間の打鍵は受け付けない(`active = false`)

### 8. 結果画面(`src/screens/endurance-result.ts`)

`renderEnduranceResult(host, values, onAgain, onTitle, onSave?)`。

- 大きく「打てた文字数」(`correct` 字)
- 入力方法(「フリックキーボード」/「スマホのキーボード」。今の結果画面と同じ表示)
- 終わり方: `miss` なら「「く」を打つところで「け」を入力」(`typed` が `null` なら「「く」を打つところで使えない入力(変換・貼り付けなど)」)、`timeout` なら「時間切れ」、`complete` なら「完走!」
- 作品名 / 著者、進んだ割合(%)
- 今日のベストを更新したら、今の結果画面と同じ「自己ベスト更新」のリボン(文言は「今日のベスト更新」)
- ボタン: 「もう一度」(同じ日の同じ文章で最初から)・「タイトルへ」。`debug` のときは「ログを保存」
- 画面の下に小さく「出典: 青空文庫」。`cardUrl` へのリンクにする(`target="_blank" rel="noopener"`)
- 右上のテーマ切替(`bindThemeTap`)も今の結果画面と同じく置く

### 9. 開始と終了(`src/main.ts`)

- `startEndurance(mode: PlayMode)` を足す。最初に今の `startGame` と同じく `checkEnv(collectEnv())` を確かめる
- 日付は開始時に1回だけ決める(プレイ中に日付が変わっても、その回は開始時の文章のまま)
- 終わったら:
  - `debug` でなく、その入力方法の今日のベストより多ければ `saveEnduranceBest`
  - 結果画面を出す。「もう一度」は同じ入力方法・同じ文章で始める。「ログを保存」は `replayEndurance(...)` に `env: collectEnv()`・`debug` を足して `downloadLog` に渡す(今のモードと同じ。`downloadLog` の引数の型が合わなければ、`PlayLog | EnduranceLog` を受け取れるように `src/debug/panel.ts` の型だけ広げてよい)

### 10. テスト

1つの `it` で1つの振る舞いを確かめる。表の1行ごとに `it` を書く。

`tests/endurance.test.ts`(テスト用に小さな `Prompt[]` を作って使う。本物のデータに依存しない):

| 確かめること                     | 入力                                                     | 期待                                                        |
| -------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| 回復量: 0 字                     | `gainFor(0)`                                             | `800`                                                       |
| 回復量: 99 字                    | `gainFor(99)`                                            | `800`                                                       |
| 回復量: 100 字                   | `gainFor(100)`                                           | `600`                                                       |
| 回復量: 300 字                   | `gainFor(300)`                                           | `450`                                                       |
| 回復量: 600 字                   | `gainFor(600)`                                           | `350`                                                       |
| 回復量: 1000 字以上              | `gainFor(5000)`                                          | `250`                                                       |
| 正しい1文字で回復                | 読み `"あい"`、t=2000 で `あ`                            | `correct: 1`、`deadlineMs: 10800`                           |
| 上限で頭打ち                     | 読み `"あい"`、t=500 で `あ`                             | `deadlineMs: 10500`(`500 + 10000`)                        |
| 1ミスで終了                      | 読み `"あい"`、t=1000 で `か`                            | `finished`、`end: "miss"`、`miss: { expected: "あ", typed: "か" }`、`endMs: 1000` |
| 濁点待ちはミスにならない         | 読み `"が"`、`か` → `modifier`                           | 1打目 `pending`、2打目で `correct: 1`、`finished`・`end: "complete"` |
| 濁点待ちで時間は回復しない       | 読み `"がい"`、t=3000 で `か`                            | `deadlineMs: 10000` のまま                                  |
| 待ちなしの `modifier` はミス     | 読み `"あ"`、`modifier`                                  | `end: "miss"`、`typed: "゛゜小"`                            |
| 置換で濁点(標準キーボード)     | 読み `"が"`、`kana か` → `replace が`                    | `correct: 1`、`end: "complete"`                             |
| 置換の誤りはミス                 | 読み `"が"`、`kana か` → `replace こ`                    | `end: "miss"`、`typed: "こ"`                                |
| 受け付けない入力はミス           | 読み `"あ"`、`reject`                                    | `end: "miss"`、`typed: null`                                |
| 文字を消してもミスにならない     | 読み `"あい"`、`あ` → `cancel`                           | `finished: false`、`correct: 1`                             |
| 時間切れ(tick)                 | tick t=10000                                             | `end: "timeout"`、`endMs: 10000`                            |
| 時間切れ後の打鍵は判定しない     | t=10000 で正しい文字                                     | `correct: 0`、`end: "timeout"`                              |
| 次の文へ進む                     | 文 `["あ", "い"]`、`あ`                                  | `promptIndex: 1`、`index: 0`                                |
| 最後まで打つと完走               | 文 `["あ", "い"]`、`あ` → `い`                           | `end: "complete"`                                           |
| 終了後は何もしない               | 終了した状態に打鍵                                       | 同じ状態が返る                                              |
| 通し日数                         | `dayNumber("2026-01-01")`                                | `0`                                                         |
| 通し日数(今日)                 | `dayNumber("2026-10-15")`                                | `287`                                                       |
| 日替わり                         | `passageFor("2026-10-15", 7件)`                          | 1件目                                                       |
| 日替わり(翌日)                 | `passageFor("2026-10-16", 7件)`                          | 2件目                                                       |
| 日替わり(2026年より前)         | `passageFor("2025-12-31", 7件)`                          | 7件目                                                       |

`tests/endurance-data.test.ts`(本物のデータを検査する):

| 確かめること                 | 期待                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| 作品の数と順番               | `id` が表の順に7件                                           |
| 文の id が重ならない         | 全作品を通して `prompts[].id` が重複しない                   |
| 読みは打てる文字だけ         | すべての `reading` の文字が `TYPEABLE` に入っている          |
| 文節をつなぐと文になる       | `chunks` の1つ目をつなげると `text`、2つ目で `reading`       |
| 文の長さ                     | すべての `text` が 32 字以内(`[...text].length`)          |
| 読みの合計                   | 作品ごとに 1200 字以上 1800 字以下                           |
| 原文の記号が残っていない     | `text` に `《` `》` `｜` `［` `※` が入っていない             |

`tests/endurance-replay.test.ts`:

| 確かめること                 | 期待                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------- |
| 再計算が一致する(flick)     | 打鍵の列を `reduceEndurance` で進めた結果と `replayEndurance` の `final` が同じ |
| 再計算が一致する(native)    | 入力欄の変化の列で、同じく `final` が一致し、`mode: "native"`・`strokes: []` |
| 値が変わらない変化は飛ばす   | `before === after` の変化を混ぜても `edits` に入らず、`final` が変わらない   |
| ミスの後の打鍵はログに入らない | ミスの後に打鍵を足しても `strokes` の数が変わらない                        |
| 打鍵が止まると時間切れ       | 数文字打って止めた列で `final.end` が `"timeout"`                            |

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る(上の3ファイルを含む)
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `git diff --stat` に「触らないファイル」が出ていない(`src/debug/panel.ts` の型の変更だけは可)
- [ ] 完了報告に、読みが2通り以上考えられる語の一覧(作品・文の id・語・選んだ読み)がある
- [ ] 以下は Claude Code とオーナーが実機で確かめる(実装担当は不要): タイトル画面に今日の作品が出る。耐久チャレンジで1回ミスすると、間違えた文字が見えたまま止まり、結果画面に「「○」を打つところで「×」を入力」と出る。打つのを止めると時間切れになる。今日のベストがタイトルに出て、入力方法を切り替えると表示が変わる
- [ ] 以下はオーナーが実機で確かめる: iPhone Safari と Android Chrome で、スマホのキーボードの耐久モードが開始から結果まで遊べる。文が変わってもキーボードが閉じない

## 対象外

- ランキング・スコアの送信・サーバー
- 結果の共有(SNS 投稿用の文やボタン)
- 標準キーボードのトグル入力への対応(今のモードと同じく、トグル入力の途中の文字はミスになる)
- 全期間のベスト・過去の日の記録
- iPhone でブラウザのバーを消す工夫(全画面・ホーム画面に追加)。別の仕様書で扱う
- 8作品目以降の追加(7作品で1週間ごとに一周する)

## 想定される落とし穴

- `judge` は読みの文字と打った文字が違っても、同じ行の濁点・小文字の候補なら `pending` を返す(`か` を打って `が` を待つなど)。これをミスと数えないこと。ミスは `judge` が `miss` を返したときだけ
- 今の `play.ts` は `reduce` の `endTimeMs` を前提に時間バーを描いている。耐久モードは `deadlineMs` が回復で伸び縮みするので、`play.ts` を書き換えずに別の画面として作る
- 読みのデータは量が多く、誤りがあると「正しく打ったのにミスで終了」という理不尽な結果になる。ルビは必ず使い、迷った語は報告に出す
- 原文には `「…」と言いました。` のように閉じかぎの後に文が続く箇所がある。`」` で区切ったときに `と言いました。` だけが短く残ってもよい
- `走れメロス` の原文の冒頭は1段落が長い。32 字の制限で細かく分かれるが、それでよい
- 日付は日本時間で作る。`new Date().toISOString()` だけだと UTC になり、朝 9 時まで前の日の文章になる
- 標準キーボードでは、Gboard などが値の変わらない `input` イベントを送ってくる。`inputForEdit` が `null` を返すので、判定にもログにも入れない(今のモードと同じ)。これをミスにしないこと
- 標準キーボードで1文字ずつ消す `cancel` はミスにしない。ただし貼り付け・変換・予測変換の確定などは `reject` になり、耐久モードでは即終了する。仕様どおりの動きなので変えない
- 標準キーボードでは、ミスで止めている 1.2 秒の間もキーボードは開いたまま入力が届く。`active = false` で判定に入れないこと
- `src/game/endurance.ts` は JSON を import するが、`dayNumber`・`passageFor`・`reduceEndurance` は引数で受け取った値だけを使う(テストで小さなデータを渡せるように)
