# 標準キーボードの挙動を実機で記録する調査ページ

## 背景

テストプレイで「iPhone の標準キーボードで打ちたい」という声があった。オーナーと相談し、**自前のフリックキーボードは残したまま、標準キーボードでも遊べるモードを足す**ことにした(タイトル画面で選ぶ)。

標準キーボードのモードでは、不正対策を次の手がかりで組み立てる予定。ただし、どれも今の iOS の実機で確かめていない。

| 不正の手口 | 予定している検出方法 | 実機で確かめること |
|---|---|---|
| 物理キーボード | 画面キーボードが出ていれば `visualViewport.height` が大きく縮む。物理キーの `keydown` には `code` が付く | 画面キーボードの `keydown` の `code` が空か。`visualViewport` がどれだけ縮むか(Safari の下のバーがあるとき・ないとき) |
| 物理キーボードのローマ字入力 | 変換中の文字列に英字が混ざる | 画面キーボードのかな入力では英字が混ざらないか |
| ペースト・予測変換・ユーザー辞書 | `beforeinput` の `inputType` で拒否する | 変換候補を選んだとき・ペーストしたときの `inputType` と `isComposing` |
| 音声入力 | 1回のイベントで2文字以上増えたら拒否する | 音声入力で何文字ずつ入るか |

さらに、ゲームの進め方を決めるために、次も確かめる必要がある。

- フリック・トグル入力・「゛゜小」キーで、`input` イベントと入力欄の値がどう変わるか
- **変換中(未確定)のまま、プログラムから入力欄を空にできるか**。お題が変わるたびとミスしたときに空にしたい。iOS では変換中に `value` を書き換えると、次の入力で古い文字列が戻ってくることがある
- 空にできない場合の代わりの手: もう1つの入力欄にフォーカスを移す、`blur()` してすぐ `focus()` する。キーボードが閉じずに続けられるか

この仕様書では、**そのための記録用ページだけ**を作る。オーナーが iPhone で操作し、記録した JSON をもとに、標準キーボードのモードの仕様書(`docs/spec-native-keyboard.md`)を書く。

## 変更対象

触るファイル:

- `src/probe/probe.ts` — 新規。記録用ページ
- `src/main.ts` — 開発サーバーで `?probe` を付けて開いたときだけ、記録用ページを出す
- `src/style.css` — 記録用ページの最低限の見た目(末尾に足す)
- `tests/no-os-input.test.ts` — `src/probe/` を検査の対象から外す

触らないファイル:

- `src/game/**`、`src/anticheat/**`、`src/keyboard/**`、`src/screens/**`、`src/data/**`、`src/debug/**`
- `index.html`、`package.json` などの設定、`AGENTS.md` / `CLAUDE.md` / `docs/**`

## 仕様

### 1. 開き方

- `src/main.ts` の最初で、`import.meta.env.DEV && new URLSearchParams(location.search).has("probe")` のときだけ、`import("./probe/probe")` で読み込んで `renderProbe(root)` を呼ぶ。そのときは環境チェックもタイトル画面も出さない
- `import.meta.env.DEV` の条件の中で動的 import するので、`npm run build` の成果物には入らない
- オーナーは Mac で `npm run dev`(`--host` 付き)を動かし、同じ Wi-Fi の iPhone の Safari から `http://<Mac の IP>:5173/?probe` を開く

### 2. 画面の構成

上から次の順に並べる。縦にスクロールできるようにする(このページだけ `touch-action` と `overflow` の制限を外す。`.probe` に `touch-action: auto; overflow: auto; height: auto;` などを指定する)。

1. **状態の行**: `innerHeight`、`visualViewport.height`、`visualViewport.offsetTop` を表示する。`visualViewport` の `resize` / `scroll` で更新する
2. **シナリオのボタン**: 次の9つ。押すと、そのシナリオ名を「今のシナリオ」として記録に付ける。押したボタンは見た目で分かるようにする
   - `1 フリック`、`2 トグル入力`、`3 変換候補`、`4 ペースト`、`5 音声入力`、`6 物理キーボード`、`7 3文字で空にする`、`8 3文字で入力欄Bへ`、`9 3文字でblur→focus`
3. **入力欄 A**(`<input id="probe-a">`)と**入力欄 B**(`<input id="probe-b">`)
   - 両方に `autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" lang="ja"` を付ける
   - フォントの大きさは 16px 以上(iOS が自動で拡大しないように)
4. **ボタン**: `記録を保存`(JSON をダウンロード)、`記録をコピー`(`navigator.clipboard.writeText`)、`記録を消す`
5. **記録の表示**: 新しい順に最大 40 件。1件1行。等幅の小さい字

### 3. 記録するもの

入力欄 A と B の両方で、次のイベントを記録する。

`keydown` / `keyup` / `beforeinput` / `input` / `compositionstart` / `compositionupdate` / `compositionend` / `focus` / `blur`

1件の形:

```ts
type ProbeRecord = {
  scenario: string; // 今のシナリオ名。未選択なら ""
  field: "a" | "b" | "viewport";
  type: string; // イベント名。visualViewport の変化は "vv"
  t: number; // event.timeStamp(小数第1位まで)
  isTrusted: boolean;
  key?: string;
  code?: string;
  keyCode?: number;
  inputType?: string;
  data?: string | null;
  isComposing?: boolean;
  value: string; // イベント時点の入力欄の値(vv のときは "")
  selectionStart?: number | null;
  innerHeight: number;
  vvHeight: number;
  vvOffsetTop: number;
};
```

- `visualViewport` の `resize` / `scroll` も `field: "viewport"`, `type: "vv"` で記録する
- 記録は配列にすべてためる(件数の上限はなし)。表示は直近 40 件だけ
- 保存する JSON の形: `{ userAgent, screen: { width, height }, records: ProbeRecord[] }`。ファイル名は `probe-<ISO 日時>.json`

### 4. シナリオ 7〜9 の自動操作

入力欄 A の `input` イベントで、入力欄の値が3文字以上になったら、シナリオに応じて次をする。シナリオ 1〜6 のときは何もしない。

| シナリオ | すること | 記録に足すもの |
|---|---|---|
| 7 3文字で空にする | `a.value = ""` | `type: "probe-reset"` を1件 |
| 8 3文字で入力欄Bへ | `a.value = ""` の後、すぐ `b.focus()` | `type: "probe-swap"` を1件 |
| 9 3文字でblur→focus | `a.blur()`、`a.value = ""`、`a.focus()` の順に続けて | `type: "probe-refocus"` を1件 |

- どれも `input` イベントのハンドラの中で同期的に行う(`setTimeout` を使わない)
- 入力欄 B でも同じように3文字で A へ戻す(シナリオ 8 のときだけ。`b.value = ""` の後に `a.focus()`)。行き来を繰り返して試せるようにする

### 5. ボタンが入力欄のフォーカスを奪わないようにする

- シナリオのボタンを押しても入力欄のフォーカスが外れないよう、シナリオのボタンの `pointerdown` で `event.preventDefault()` を呼ぶ
- これが iOS で効くかは分からない。効かなくても構わない(オーナーが入力欄をタップし直す)

### 6. テスト

- `tests/no-os-input.test.ts` の `walk` で集めるファイルから、`src/probe/` の下を除く。それ以外の検査はそのまま残す
- 記録用ページ自体のテストは不要

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `npm run build` の後、`grep -r "probe-a" dist` が何も出さない(成果物に記録用ページが入っていない)
- [ ] `src/` のうち、`<input`・`addEventListener("input"` などが出てくるのは `src/probe/` の下だけ
- [ ] 以下は Claude Code がブラウザで確かめる(実装担当は不要): `npm run dev` で `/?probe` を開くと記録用ページが出る。入力欄に打つと記録が増える。`/` を開くと今までどおりタイトル画面が出る

## 対象外

- 標準キーボードでのゲーム本体(調査の結果を見て `docs/spec-native-keyboard.md` で決める)
- タイトル画面でのモード選択
- 本番の成果物への記録用ページの同梱

## 想定される落とし穴

- `import.meta.env.DEV` は `tsconfig.json` の `"types": ["vite/client"]` で型が付く(設定済み)
- `body` に `touch-action: none` と `user-select: none` がかかっている。入力欄で文字の選択・ペーストをするため、`.probe` の中では `user-select: text` と `-webkit-user-select: text` に戻す
- `document` の `contextmenu` を `preventDefault` しているので、iOS の長押しメニュー(ペースト)が出ないかもしれない。記録用ページを出すときは、`main.ts` の末尾にある `contextmenu` / `gesturestart` の登録と `showTitle()` を実行しない(`if (probe) { … } else { 今までの3行 }` のように分ける)
- `navigator.clipboard.writeText` は HTTP の LAN アドレス(安全でない接続)では使えないことがある。失敗したら記録の表示の先頭に「コピーできませんでした」と出し、保存ボタンを使ってもらう
- 記録の表示は件数が増えても重くならないよう、表示する 40 件だけを作り直す
