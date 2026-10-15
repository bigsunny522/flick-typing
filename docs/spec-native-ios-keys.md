# iPhone の Safari で標準キーボードが physical-key と判定される問題を直す

## 背景

標準キーボードのモードで、iPhone の Safari では3文字ほど打つとブロック画面になる。`?debug` で確かめると、理由は `physical-key` だった(オーナーが確認。Android では起きない)。

`src/anticheat/native.ts` の `analyzeNative` は、`keydown` の `code` が空でないものを物理キーとして数え、3回で `physical-key` にする。Android の Gboard は `code` を空で送るが、iOS の画面のキーボードは `code` に値を入れて送ってくる。そのため、画面のキーボードで打っていても物理キーと数えられる。

直し方: **画面のキーボードが出ていないときの `keydown` だけを物理キーとして数える。** 入力欄の編集(`NativeEditLog`)と同じように、`keydown` にもそのときの `viewportRatio`(`visualViewport.height / innerHeight`)を記録する。比率が `NATIVE_SOFT_KB_RATIO`(0.85)より大きい、つまり画面のキーボードが出ていないときの `keydown` だけを数える。

- iPhone に Bluetooth キーボードをつなぐと画面のキーボードは隠れるので、その場合は今まで通り `physical-key` になる
- `no-soft-keyboard` の判定はそのまま残る

## 変更対象

触るファイル:

- `src/anticheat/native.ts`
- `src/screens/play.ts`(`onKey` の1か所)
- `src/screens/endurance.ts`(`onKey` の1か所)
- `tests/native-behavior.test.ts`

触らないファイル:

- `src/anticheat/thresholds.ts`(値は変えない)
- `src/native/field.ts`、`src/anticheat/log.ts`、ほかのすべてのファイル

## 仕様

### 1. 型と判定(`src/anticheat/native.ts`)

- `NativeKeyLog` に `viewportRatio: number` を足す。コメントは `NativeEditLog` と同じく「そのときの visualViewport.height / innerHeight」
- `physicalKeys` の数え方を次にする:
  `code !== ""` かつ `viewportRatio > thresholds.NATIVE_SOFT_KB_RATIO` の `keydown` の数
- `untrusted` の判定(`keys.some((key) => !key.trusted)`)は変えない。比率に関係なく、すべての `keydown` を見る
- ほかの判定・`metrics` は変えない

### 2. 記録(`src/screens/play.ts`・`src/screens/endurance.ts`)

`onKey` で `keys` に足すオブジェクトに `viewportRatio: lastViewport.ratio` を加える(`onEdit` と同じ値)。ほかは変えない。

### 3. テスト(`tests/native-behavior.test.ts`)

- 既存のテストの `NativeKeyLog` に `viewportRatio` を足して型を通す
  - 「flags physical keys」は `viewportRatio: 1`(画面のキーボードなし)にする。期待値は今のまま
  - 「flags nothing for human-like typing」は `viewportRatio: 0.45` にする
- 次の表を足す。1行ごとに `it` を1つ書く。`edits` はどの行も `makeEdits(3)`(比率 0.45)を使う

| keydown(3回とも同じ)                        | 期待する `reasons` | 期待する `metrics.physicalKeys` |
| ------------------------------------------- | ------------------ | ------------------------------- |
| `code: "KeyA"`, 比率 0.45                   | `[]`               | 0                               |
| `code: "KeyA"`, 比率 0.85                   | `[]`               | 0                               |
| `code: "KeyA"`, 比率 0.9                    | `["physical-key"]` | 3                               |
| `code: ""`, 比率 1                          | `[]`               | 0                               |
| `code: "KeyA"`, 比率 0.45, `trusted: false` | `["untrusted"]`    | 0                               |

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る(上の表の5行を含む)
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `git diff --stat` に「触るファイル」の4つ以外が出ていない

## 対象外

- `thresholds.ts` の値の調整
- iOS の `keydown` の `code` の中身の調査・記録
- サーバー側の再計算(`keys` はまだ送信していない)

## 想定される落とし穴

- `lastViewport` の初期値は `ratio: 0`。`visualViewport` の通知が来る前の `keydown` は「画面のキーボードが出ている」側に数えられ、物理キーとしては数えない。カウントダウンの間は `active` が偽で `keydown` を記録しないので、実害は小さい
- 比率がちょうど 0.85 のときは数えない(`>` で比べる。`no-soft-keyboard` と同じ向き)
