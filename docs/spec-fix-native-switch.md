# 標準キーボードで、お題が切り替わった直後に「使えない入力」になる問題を直す

## 背景

iPhone の標準キーボードのモードで、お題(耐久モードでは文のかたまり)が次に切り替わった直後に、ミスが1回数えられる。耐久モードの結果画面には「『(次の文の1文字目)』を打つところで使えない入力(変換・貼り付けなど)」と出る。つまり、次のお題の1文字目の位置で `reject` が判定されている。最後の文字が「。」でも「、」でも起きる。

`docs/spec-fix-native-commit.md`(コミット `0dc72bc`)で、切り替えた後の新しい入力欄に古い値が丸ごと戻ってくる場合は直した。しかし、次の2つの経路が残っている。

### 経路 1: 切り替えの途中に、古い入力欄の `input` を今の入力欄として受け取っている

`src/native/field.ts` の `clear()` は、次の順で動く。

1. 古い欄の値を `""` にする
2. 新しい欄に `focus()` する
3. `current` を新しい欄に変える

2 の `focus()` で古い欄から `blur` するとき、iOS は変換中の文字を確定し、古い欄に `input` を送ることがある(同期的に来る)。このときはまだ `current` が古い欄を指しているので、`handleInput` はその `input` を受け取ってしまう。古い欄の値は 1 で空にされているため、iOS が戻した文字列(変換中だった部分)と前回の値を比べることになり、差が2文字以上になって `reject` になる。このときゲームは次のお題に進んだ後なので、「次のお題の1文字目で使えない入力」と判定される。

### 経路 2: 新しい欄に、古い値の「後ろの一部」だけが戻ってくる

iOS が戻すのは変換中だった部分だけ(例: 古い欄が `きょうはいいてんきです、` で、変換中だったのは `てんきです、` だけ)のことがある。`0dc72bc` の判定は「戻ってきた値が古い値で始まる」ときしか古い値とみなさないので、`てんきです、` や `てんきです、あ` は `reject` になる。

### 直し方

- 経路 1: `clear()` で、`focus()` を呼ぶ前に `current` と状態を切り替える。こうすれば、切り替えの途中に古い欄から来た `input` は `index !== current` で捨てられる
- 経路 2: 新しい欄に最初に来た2文字以上の値について、「古い値の末尾と一致する部分は戻ってきた文字列」とみなす

どちらも、戻ってきた文字列を判定に入れないだけなので、かなが勝手に進むことはない。

## 変更対象

触るファイル:

- `src/native/field.ts` — `clear()` の順番
- `src/game/native-edit.ts` — `resolveEdit` の `stale` の扱い
- `tests/native-edit.test.ts` — `resolveEdit` の表を直し、行を足す

触らないファイル:

- `src/screens/play.ts` / `src/screens/endurance.ts`
- `src/game/judge.ts` / `src/game/session.ts` / `src/anticheat/**`
- ほかのすべてのファイル

## 仕様

### 1. `clear()` の順番(`src/native/field.ts`)

次の順にする。

1. `old`(古い欄の `bases[current].remembered`)を取っておく
2. `next = 1 - current`
3. 両方の欄の値を `""` にする
4. `bases` を両方とも空に戻し、`bases[next]` だけ `stale: old`(`old` が `""` なら `null`)にする
5. `current = next`
6. `fields[next].focus()`

`focus()` を最後にすることだけが変わる。ほかの処理は今のまま。

### 2. `resolveEdit` の `stale`(`src/game/native-edit.ts`)

`inputType` が `deleteCompositionText` 以外のときの `before` の決め方のうち、`stale` の部分を次に置き換える。`commitBase` の扱い、`deleteCompositionText` のとき、`next` の値は変えない。

- 条件: `base.stale` が `null` でも `""` でもなく、`before === ""` で、`after` の文字数(`[...after].length`)が2以上
- 条件を満たすとき、文字の配列 `chars = [...after]` について:
  1. `base.stale.endsWith(after)` なら、`before = after`(戻ってきただけ。`inputForEdit` で `null` になる)
  2. そうでなく、`base.stale.endsWith(chars.slice(0, -1).join(""))` なら、`before = chars.slice(0, -1).join("")`(戻ってきた文字列に、新しい1文字が足された)
  3. どちらでもなければ `before` は `""` のまま
- 今の「`after.startsWith(base.stale)` なら `before = base.stale`」は削除する(2 が、古い値の全体にかなが1文字足された場合も含む)

`resolveEdit` の表(`tests/native-edit.test.ts`)。`commitBase` はどの行も `null`。1行ごとに `it` を1つ書く。

| #   | `remembered` | `stale`        | `inputType`             | `after`        | 期待する `before` |
| --- | ------------ | -------------- | ----------------------- | -------------- | ----------------- |
| 1   | `""`         | `きょうは。`   | `insertCompositionText` | `きょうは。`   | `きょうは。`      |
| 2   | `""`         | `きょうは。`   | `insertCompositionText` | `きょうは。あ` | `きょうは。`      |
| 3   | `""`         | `いいてんき、` | `insertCompositionText` | `てんき、`     | `てんき、`        |
| 4   | `""`         | `いいてんき、` | `insertCompositionText` | `てんき、あ`   | `てんき、`        |
| 5   | `""`         | `いいてんき、` | `insertText`            | `、あ`         | `、`              |
| 6   | `""`         | `あ`           | `insertCompositionText` | `あ`           | `""`              |
| 7   | `""`         | `きょうは。`   | `insertCompositionText` | `か`           | `""`              |
| 8   | `""`         | `きょうは。`   | `insertCompositionText` | `かき`         | `""`              |
| 9   | `""`         | `いいてんき、` | `insertCompositionText` | `てんき、あい` | `""`              |

- 1・2 は `0dc72bc` の表の 6・7 行目と同じ結果になる(既存のテストはそのまま通ること)
- 6: 1文字だけのときは古い値とみなさない(今のまま)
- 8・9: 古い値の末尾と合わないもの、新しい文字が2文字以上あるものは今までどおり(`inputForEdit` で `reject`)
- どの行も `next` は `{ remembered: after, commitBase: null, stale: null }`

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る(上の表の9行を、1行ごとに `it` で含む)
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `git diff --stat` に「触るファイル」の3つ以外が出ていない
- [ ] `tests/native-edit.test.ts` の既存のテストを消したり期待値を変えたりしていない(表と同じ内容の既存テストと重なるのは構わない)

## 対象外

- iPhone の実機での確認(オーナーが本番で確かめる)
- 耐久モードへの `?debug` パネルの追加
- Safari で NEXT が隠れる件

## 想定される落とし穴

- `clear()` は `onEdit` の中(`input` イベントの処理中)から呼ばれる。`handleInput` は `onEdit` を呼ぶ前に `bases[index] = next` を済ませているので、`clear()` の `old` は最新の値になる。この順番を崩さない
- `focus()` を最後にしても、`focus()` の中で来た古い欄の `input` は `index !== current` で捨てられる。新しい欄の `focus` / `blur` の処理(`handleFocus` / `handleBlur`)は `current` を見ないので影響しない
- 文字数は `[...after]` で数える(`after.length` は使わない)。`slice(0, -1)` も文字の配列に対して行う
