# 標準キーボードで、お題の最後の「。」がミスになる問題を直す

## 背景

一部の iPhone で、標準キーボードのモードでお題の最後の「。」を打つと、ミスと数えられるのに次のお題へ進む、という報告があった。報告者は「。」を「、。?!」キーの左フリックで出している(2回タップではない)。Android では起きていない。

iPhone の実機の記録は取れていない。原因の候補は次の2つで、どちらでも「ミス1回 + 次へ進む」になる。**今回は両方を直す。**

### 候補 1: 「。」を打った瞬間に、iOS が変換中の文字を確定する

iOS の WebKit では、確定のときに次の `input` が続けて来ることがある。

| 順  | `inputType`             | 入力欄の値                             | 今の判定                                                        |
| --- | ----------------------- | -------------------------------------- | --------------------------------------------------------------- |
| 1   | `deleteCompositionText` | `きょうは` → `""`                      | `cancel`(害はない)                                              |
| 2   | `insertFromComposition` | `""` → `きょうは`(または `きょうは。`) | `insertFrom` で始まるので `reject` → **ミス**、入力欄を空にする |
| 3   | `insertText` など       | `""` → `。`                            | 空の新しい入力欄に「。」 → **正解で次へ進む**                   |

### 候補 2: 入力欄を切り替えた直後に、iOS が古い文字列を戻す

お題の最後の文字で正解になると、`field.clear()` で入力欄を A から B へ切り替える。iOS では変換中に入力欄を変えると、次の入力で古い文字列が戻ってくることがある(`docs/spec-native-keyboard-probe.md` の調査の動機)。B に `""` → `きょうはいいてんきです。` のような2文字以上の値が入り、`reject` → **ミス**になる。お題の最後の文字の直後にだけ起きるので、「。」(や「!」)のときだけミスに見える。

### 直し方

- **候補 1:** 確定(`deleteCompositionText` → `insertFromComposition`)を、値の差としては見ない。確定の前の値と後の値を比べ、1文字増えた・最後の1文字が変わったときだけ判定に回す。それ以外は無視する(ミスにしない)
- **候補 2:** 入力欄を切り替えた直後の最初の `input` で、空の欄に、切り替える前の欄の値で始まる2文字以上の値が入ったら、その古い値を「前の値」とみなして差を取る

どちらの処理も、かなが1文字進むことはない(戻ってきた古い文字列や確定は判定に入れない)ので、不正に先へ進む手段にはならない。

## 変更対象

触るファイル:

- `src/game/native-edit.ts` — `inputForEdit` の `insertFromComposition` の扱いを変える。新しい純粋関数 `resolveEdit` を足す
- `src/native/field.ts` — `handleInput` と `clear` で `resolveEdit` を使う
- `tests/native-edit.test.ts` — 下の表のテストを足す

触らないファイル:

- `src/screens/play.ts` / `src/screens/endurance.ts`(`onEdit` の受け取り方は変えない)
- `src/game/judge.ts` / `src/game/session.ts` / `src/anticheat/**`
- ほかのすべてのファイル

## 仕様

### 1. `inputForEdit` の `insertFromComposition`(`src/game/native-edit.ts`)

- `insertFromComposition` を、`insertFrom` で始まるものの `reject` から外す(`insertFromPaste` などはそのまま `reject`)
- `insertFromComposition` のときは、今までと同じように差を取る。結果が `kana` / `replace` ならそのまま返す。`cancel` か `reject` になるときは `null` を返す(無視する)
- 値が変わらないときは今までどおり `null`
- `deleteCompositionText` の扱いは変えない(今までどおり `cancel`)。下の `resolveEdit` によって、この `inputType` は `inputForEdit` に届かなくなる。古いログの再計算のために残す

### 2. `resolveEdit`(`src/game/native-edit.ts` に足す。DOM に触れない純粋関数)

入力欄1つぶんの状態から、`onEdit` に渡す `before` を決める。

`""``ts
export type EditBase = {
remembered: string; // 前回の input の後の値
commitBase: string | null; // deleteCompositionText の直前の値。確定の途中でなければ null
stale: string | null; // 切り替える前の入力欄の値。切り替えた直後の最初の input まで持つ
};

export function resolveEdit(
base: EditBase,
inputType: string,
after: string,
): { before: string | null; next: EditBase };
`""``

- `before` が `null` のときは `onEdit` を呼ばない
- 処理(上から順に):
  1. `inputType === "deleteCompositionText"` のとき: `before: null`。`next` は `{ remembered: after, commitBase: base.remembered, stale: base.stale }`
  2. それ以外: まず `before` を決める
     - `inputType === "insertFromComposition"` かつ `base.commitBase !== null` なら `base.commitBase`。そうでなければ `base.remembered`
     - さらに、`base.stale` が `null` でも `""` でもなく、`before === ""` で、`after` の文字数(`[...after].length`)が2以上で、`after.startsWith(base.stale)` なら、`before` を `base.stale` にする
     - `next` は `{ remembered: after, commitBase: null, stale: null }`

| #   | `base`(remembered / commitBase / stale) | `inputType`             | `after`        | 期待する `before` | 期待する `next`(remembered / commitBase / stale) |
| --- | --------------------------------------- | ----------------------- | -------------- | ----------------- | ------------------------------------------------ |
| 1   | `あ` / null / null                      | `insertCompositionText` | `あい`         | `あ`              | `あい` / null / null                             |
| 2   | `きょうは` / null / null                | `deleteCompositionText` | `""`           | null              | `""` / `きょうは` / null                         |
| 3   | `""` / `きょうは` / null                | `insertFromComposition` | `きょうは`     | `きょうは`        | `きょうは` / null / null                         |
| 4   | `""` / `きょうは` / null                | `insertFromComposition` | `きょうは。`   | `きょうは`        | `きょうは。` / null / null                       |
| 5   | `""` / `きょうは` / null                | `insertCompositionText` | `あ`           | `""`              | `あ` / null / null                               |
| 6   | `""` / null / `きょうは。`              | `insertCompositionText` | `きょうは。`   | `きょうは。`      | `きょうは。` / null / null                       |
| 7   | `""` / null / `きょうは。`              | `insertCompositionText` | `きょうは。あ` | `きょうは。`      | `きょうは。あ` / null / null                     |
| 8   | `""` / null / `あ`                      | `insertCompositionText` | `あ`           | `""`              | `あ` / null / null                               |
| 9   | `""` / null / `きょうは。`              | `insertCompositionText` | `か`           | `""`              | `か` / null / null                               |
| 10  | `""` / null / `きょうは。`              | `deleteCompositionText` | `""`           | null              | `/` / `きょうは。`                               |

- 8 行目: 1文字だけのときは古い値とみなさない(切り替えた直後に、前と同じかなを打つことはある)

### 3. `inputForEdit` の表(`tests/native-edit.test.ts` に足す)

| `before`   | `after`      | `inputType`             | 期待する結果                             |
| ---------- | ------------ | ----------------------- | ---------------------------------------- |
| `きょうは` | `きょうは`   | `insertFromComposition` | `null`                                   |
| `きょうは` | `きょうは。` | `insertFromComposition` | `{ kind: "kana", kana: "。" }`           |
| `きょうは` | `今日は`     | `insertFromComposition` | `null`                                   |
| `""`       | `きょうは`   | `insertFromComposition` | `null`                                   |
| `きょうは` | `""`         | `insertFromComposition` | `null`                                   |
| `あ`       | `あいう`     | `insertFromPaste`       | `{ kind: "reject" }`(既存のテストのまま) |

### 4. `field.ts` で使う

- 入力欄ごとの `remembered` を、入力欄ごとの `EditBase` に置き換える(初期値は `{ remembered: "", commitBase: null, stale: null }`)
- `handleInput`: `index !== current` なら今までどおり何もしない。`resolveEdit(bases[index], inputType, after)` を呼び、`bases[index] = next` にする。`before` が `null` でなければ、その `before` で `handlers.onEdit` を呼ぶ(`after`・`timeStamp`・`trusted` は今までどおり)
- `clear()`: 切り替える前の欄の値(`bases[current].remembered`)を `old` として取っておく。両方の欄を `{ remembered: "", commitBase: null, stale: null }` に戻したあと、新しく使う欄だけ `stale: old`(`old` が `""` なら `null`)にする。値を空にする・フォーカスを移す処理と順番は今のまま
- ログ(`NativeEdit` の `before`)には、`resolveEdit` が決めた `before` が入る。再計算(`replayNative`)は記録された `before` / `after` で `inputForEdit` を呼ぶので、画面の判定と一致する

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る(2 の表の10行と、3 の表の新しい5行を、1行ごとに `it` で含む)
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `git diff --stat` に「触るファイル」の3つ以外が出ていない
- [ ] 既存の `tests/native-edit.test.ts` / `tests/replay.test.ts` / `tests/native-behavior.test.ts` のテストを消したり期待値を変えたりしていない

## 対象外

- iPhone の実機での確認(オーナーが本番で確かめる)
- 「、。?!」キーの2回タップ(トグル入力)で「、」が一度ミスになる件
- `?debug` のパネルに、無視したイベントを出すこと
- Safari で NEXT が隠れる件(仕様どおり。`docs/spec-native-keyboard.md` の高さ 400px 未満で隠す)

## 想定される落とし穴

- `src/game/` の規約: `resolveEdit` に DOM・`Date.now()`・`Math.random()` を使わない。値は引数で受け取る
- `stale` は「切り替えた直後の最初の `input`」で必ず消す(表の9行目)。残すと、あとで同じ文字列で始まる値が来たときに誤って差を取る
- `deleteCompositionText` のあと、`insertFromComposition` 以外のイベントが来たときは、`commitBase` を使わずに `remembered`(削除の後の値)と比べる(表の5行目)。消えた文字列との差を取ると `reject` になる
- `insertFromComposition` を無視しても `field.clear()` は呼ばれないので、入力欄に確定済みの文字列が残る。次のかなは「最後に1文字増えた」として読めるので問題ない
- `NativeEditLog` の挙動分析(`analyzeNative`)は、届く `edits` が減るだけ。しきい値は変えない
