# プレイ中のリトライボタン

## 背景

プレイ中に出だしでつまずいても、今は最後まで打ち切るか、時間切れを待つしかない。結果画面の「もう一度」までたどり着かないとやり直せない。

プレイ中の画面(タイムアタックと耐久モードの両方)にリトライボタンを置き、確認を挟んでから最初からやり直せるようにする(オーナーが選んだ形)。

```
┌──────────────────────────────┐
│ 42.3秒  +1秒   正解 12 [↻]   │  ← .play-header の右端にボタン
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│        (お題)                 │
│        ...                    │
```

確認中の表示:

```
┌──────────────────────────────┐
│   (画面全体を半透明で覆う)    │
│                               │
│   最初からやり直しますか?     │
│   [ やり直す ]                │
│   [ 続ける ]                  │
│                               │
└──────────────────────────────┘
```

## 変更対象

触るファイル:

- `src/screens/play.ts` — タイムアタックのプレイ画面にボタンと確認表示を足す
- `src/screens/endurance.ts` — 耐久モードのプレイ画面に同じものを足す
- `src/main.ts` — `onRetry` を渡す
- `src/style.css` — ボタンと確認表示のスタイル

触らないファイル:

- `src/screens/result.ts`・`src/screens/endurance-result.ts`(結果画面の「もう一度」は今のまま)
- `src/screens/title.ts`・`blocked.ts`・`reading-ticker.ts`
- `src/game/**`、`src/anticheat/**`、`src/keyboard/**`、`src/native/**`、`src/data/**`、`src/storage.ts`、`src/theme.ts`
- `tests/**`、`index.html`、`package.json`、`AGENTS.md` / `CLAUDE.md` / `docs/**`

## 仕様

### 1. オプションの追加

`PlayOptions`(`play.ts`)と `EnduranceOptions`(`endurance.ts`)に、次を足す。

```ts
onRetry: () => void;
```

`src/main.ts` では次を渡す。

| 呼び出し                                   | `onRetry`                                  |
| ------------------------------------------ | ------------------------------------------ |
| `startGame` の `renderPlay`                | `() => startGame(mode)`                    |
| `startEnduranceRound` の `renderEndurance` | `() => startEnduranceRound(mode, dateKey)` |

`startGame` は新しい seed でお題を選び直す(結果画面の「もう一度」と同じ)。耐久モードは同じ `dateKey` の同じ文章で始め直す。

### 2. ボタン(両画面共通)

`.play-header` の中、`#stats` の後ろに置く。

```html
<button type="button" class="retry-button" aria-label="最初からやり直す">↻</button>
```

- 見た目: 文字は `↻`、`var(--muted)` 色、背景なし・枠なし。押せる範囲は 44×44px 以上
- `.play-header` は `align-items: end` なので、ボタンもヘッダーの下端にそろう。`#stats` との間は `margin-left: 12px`
- カウントダウン中(`is-counting`)も表示し、押せる

### 3. 確認表示(両画面共通)

`<main class="screen play ...">` の直下(`.reopen-overlay` と同じ階層)に置く。

```html
<div class="retry-confirm" id="retry-confirm">
  <div class="retry-confirm-box">
    <p>最初からやり直しますか?</p>
    <button type="button" class="primary-button retry-yes">やり直す</button>
    <button type="button" class="secondary-button retry-no">続ける</button>
  </div>
</div>
```

- 初めは非表示(`display: none`)。`.is-open` が付いたら表示する(`.reopen-overlay` と同じ作り)
- `position: absolute; inset: 0;` で画面全体を覆い、`.reopen-overlay`(z-index 5)より上に出す(z-index 6)。背景は `var(--bg)` を半透明にしたもの(`color-mix(in srgb, var(--bg) 85%, transparent)` など)。フリックキーボードも覆うので、確認中にキーボードには触れない
- ブラウザの `confirm()` は使わない(AGENTS.md の方針と、Claude in Chrome のダイアログ問題のため)

### 4. 振る舞い

| 操作                   | 結果                                                                            |
| ---------------------- | ------------------------------------------------------------------------------- |
| `.retry-button` を押す | `#retry-confirm` に `.is-open` を付ける                                         |
| `.retry-no` を押す     | `.is-open` を外す。ゲームはそのまま続く                                         |
| `.retry-yes` を押す    | `stop(options.onRetry)` を呼ぶ(入力ログ・記録は捨てる。ベストは保存しない)      |
| ゲーム終了後に押す     | 何もしない(`transitioned` か `state.finished` が真なら handler の先頭で return) |

- **確認中もゲームは止めない。** タイマーは進み続け、標準キーボードのモードでは入力も受け付ける。一時停止を入れると、入力ログを再計算するサーバー側と経過時間がずれるうえ、時間を止める抜け道になるため
- 確認中に時間切れなどでゲームが終わったら、いつも通り結果画面へ進む(`stop` が `transitioned` を立てるので二重遷移しない)
- 耐久モードでミスや時間切れの後の待ち時間(`MISS_HOLD_MS` / `TIMEOUT_HOLD_MS`)中は `state.finished` が真なので、リトライは効かない

### 5. 画面を離れた後のタイマー

今の `play.ts` / `endurance.ts` は、カウントダウンの `setTimeout`(1秒・2秒・3秒)を画面を離れても止めない。カウントダウン中にリトライすると、古い画面の `start()` が3秒後に走り、`active = true` にして古い画面の `requestAnimationFrame` の `tick` を回し続けてしまう。

両画面とも、次のように防ぐ。

- `start()` の先頭に `if (transitioned) return;` を足す(カウントダウンの数字を書き換える2つの `setTimeout` は、外れた DOM を書き換えるだけなので害はないが、同じく `transitioned` で止めてよい)

### 6. 標準キーボードのモード

- `playView` の `pointerdown` で `preventDefault()` しているのは今のまま。これで隠した入力欄のフォーカスが外れず、キーボードが出たまま確認表示を押せる。`preventDefault()` しても `click` は発火するので、除外リストに足す必要はない
- `stop()` が古い `field` を `destroy()` し、`onRetry` で作られた新しい画面が `field.focus()` する。押した操作の中で同期的に呼ばれるので、iOS でもフォーカスが通る想定(未確認。実機で確かめる)
- 確認表示は `.play` の中にあり、`.play.is-native` の高さは `--vv-height` なので、キーボードが出ていても見える範囲に収まる

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る(既存の `tests/no-os-input.test.ts` を含む)
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `git diff --stat` に出るファイルが「変更対象」の4つだけ
- [ ] (手で確認)タイムアタックのプレイ中に ↻ → 「続ける」で、確認が消えてゲームがそのまま続く
- [ ] (手で確認)タイムアタックのプレイ中に ↻ → 「やり直す」で、カウントダウン 3 から始まり、お題が変わる
- [ ] (手で確認)耐久モードで同じ操作をすると、同じ文章の最初からカウントダウン 3 で始まる
- [ ] (手で確認)カウントダウン中に「やり直す」を押しても、新しいカウントダウンが 3→2→1 と1回だけ進み、残り時間の表示が二重に動かない
- [ ] (手で確認)確認中に時間切れになると、結果画面に進む

## 対象外

- 結果画面の「もう一度」の変更
- 一時停止
- タイトルに戻るボタン
- リトライ回数の記録やサーバーへの送信

## 想定される落とし穴

- 5 のタイマーの件を直さないと、カウントダウン中のリトライで古い `tick` が残る。見た目では分かりにくいので、コードで `start()` のガードを確かめる
- `#stats > span:last-child { margin-left: auto; }` で「正解」を右に寄せている。ボタンは `#stats` の外(`.play-header` の直下)に置くこと。`#stats` の中に入れると `:last-child` がずれる
- `.play.is-native.is-compact .play-header` は高さ 40px。ボタンの押せる範囲(44px)がはみ出しても、上に余白があるのでレイアウトは崩れない想定。崩れるなら `.retry-button` 側を `margin-block: -2px` などで調整する(ヘッダーの高さは変えない)
- 入力経路を増やさない。確認表示のボタンは `click` だけを使い、`keydown` などは足さない(`tests/no-os-input.test.ts`)
