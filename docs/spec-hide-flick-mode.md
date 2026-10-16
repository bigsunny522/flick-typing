# フリックキーボードのモードを画面から隠す

## 背景

ランキング(`docs/spec-ranking.md`)を作るにあたり、オーナーと相談して、遊ぶ人が少なそうなフリックキーボードのモードをいったん画面から隠すことにした。スマホのキーボード(`native`)だけで遊ぶ形にする。

**コードは消さない。** あとで戻せるように、フリックキーボードの実装(`src/keyboard/**`、`play.ts` / `endurance.ts` の flick の分岐、`replay` など)はそのまま残す。タイトル画面から選べなくするだけ。

## 変更対象

触るファイル:

- `src/screens/title.ts` — モードの切り替えボタンをなくし、常に `native` で始める
- `src/main.ts` — タイトルに渡すモードを常に `native` にする
- `src/screens/result.ts`、`src/screens/endurance-result.ts` — モード名の表示(`.result-mode`)を消す
- `src/style.css` — 使わなくなった `.mode-select` まわりのスタイルを消す

触らないファイル:

- `src/keyboard/**`、`src/game/**`、`src/anticheat/**`、`src/native/**`、`src/screens/play.ts`、`src/screens/endurance.ts`
- `src/storage.ts`(`loadMode` / `saveMode` は残す。呼ばなくなってもよい)
- `worker/**`、`tests/**`、`index.html`、`package.json`

## 仕様

1. タイトル画面
   - `.mode-select`(フリックキーボード / スマホのキーボードのボタン)を出さない
   - `.native-hint`(「フリック入力で打ってください(トグル入力は使えません)」)は**常に出す**(`hidden` を付けない)
   - 自己ベスト・今日のベストは `native` の値を出す
   - 「はじめる」「挑戦する」は `native` で始める
   - `renderTitle` の引数から `mode` を消してよい。消す場合は `main.ts` の呼び出しも合わせる
2. `main.ts`
   - `loadMode()` を使わず、タイトルにもゲームにも `"native"` を渡す
   - 「もう一度」も `native` で始まる(今は直前のモードを引き継いでいるので、そのままでよい)
3. 結果画面(タイムアタック・耐久)
   - `<p class="result-mode">…</p>` を出さない。`modeLabel` 関数が使われなくなったら消す
   - `ResultValues.mode` などの型は残してよい(`main.ts` の変更を小さくするため)
4. `style.css`
   - `.mode-select` と `.title-actions .mode-select` のルールを消す
   - `.result-mode` のルールも、使う場所がなくなれば消す

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `grep -rn "mode-select" src` が何も出さない
- [ ] 以下は Claude Code がブラウザで確かめる: タイトル画面にモードの切り替えがなく、ヒントが出ている。「はじめる」でスマホのキーボードのモード(隠した入力欄にフォーカス)が始まる。結果画面にモード名が出ない

## 対象外

- フリックキーボードの実装の削除
- localStorage に残っている `flick` の自己ベストの削除・移行(残したままでよい)
- ランキング(`docs/spec-ranking.md`)

## 想定される落とし穴

- localStorage のモードが `flick` のままの人がいる。`loadMode()` を使わないので影響はない
- タイトル画面のレイアウトは、モード切り替えの分だけ縦に詰まる。カードの位置が大きく崩れないかはブラウザで確かめる(Claude Code)
