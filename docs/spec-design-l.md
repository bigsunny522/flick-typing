# デザイン案L(爽やか・透明感)の反映

## 背景

MVP(`docs/spec-flick-typing-mvp.md`)は動くようになったが、見た目は仮のまま(青いボタン、角丸と影、中央寄せ)で、「AI が作った感じ」が強い。オーナーとモックアップを見比べ、次の方向に決めた。

- **案L 爽やか・透明感**: 白地に細い線と小さな幾何学の飾り、斜めに傾けたラベル
- **配色**: オーナーのサイト(ざっくらぼ、xyzack271.com)に合わせる。主色 `#7BABFF`、差し色 `#F59E0B`、背景に主色の細い方眼
- **フォント**: 日本語は読みやすさを優先して LINE Seed JP、英数字は Outfit
- **画面の優先順位**: 遊んでいる間に見続けるのはお題の読み。**読みのかなを最大**にし、タイマーは小さく上にまとめる(残り 10 秒で強調)
- **NEXT**: 次のお題を小さく先に見せる

完成形のモックアップ: https://claude.ai/artifact/EfgcS4ATUCq1ohT7tK9nTj (「案L」の2枚。案N は比較用で対象外)。**この仕様書が正で、モックは参考**。寸法はモックの 390px 幅での値。

ゲームのルール・判定・不正対策・入力ログは一切変えない。

## 変更対象

触るファイル:

- `index.html` — Google Fonts の読み込み
- `src/style.css` — ほぼ全面的に書き直す
- `src/screens/title.ts` / `play.ts` / `result.ts` / `blocked.ts` — マークアップ
- `src/keyboard/view.ts` — キーに種類のクラスを付けるだけ(入力処理は変えない)
- `src/debug/panel.ts` — 見た目のクラスだけ(中身は変えない)
- `src/main.ts` — result に渡す値の追加が要る場合だけ

触らないファイル:

- `src/game/**`、`src/anticheat/**`、`src/keyboard/layout.ts` / `gesture.ts` / `guide.ts`、`src/data/**`、`src/storage.ts` — ロジックは変えない
- `tests/**` — 既存のテストはそのまま通ること(`no-os-input` を含む)
- `package.json` / `package-lock.json` / `tsconfig.json` / `.prettierrc.json`
- `AGENTS.md` / `CLAUDE.md` / `docs/**`

## 仕様

### 1. フォント

`index.html` の `<head>` に追加する:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=LINE+Seed+JP:wght@400;700;800&family=Outfit:wght@300;400;500;600&display=swap"
/>
```

- 日本語(本文・お題・キー): `"LINE Seed JP", -apple-system, "Hiragino Sans", sans-serif`
- 数字と英字のラベル(タイマー、スコア、`COMBO`、`NEXT`、`RESULT` など): `Outfit, sans-serif`
- フォントの読み込みに失敗しても、フォールバックで遊べること

### 2. 色と共通の値(`style.css` の `:root`)

```css
:root {
  --bg: #ffffff;
  --fg: #171717;
  --muted: #4a5565;      /* ラベル・漢字の文 */
  --subtle: #6a7282;     /* NEXT の文 */
  --faint: #99a1af;      /* FLICK ONLY */
  --primary: #7babff;
  --primary-ink: #0b1120;    /* 主色の面の上の文字。主色の上に白文字は置かない(コントラスト不足) */
  --primary-strong: #1d4ed8; /* 主色系の文字(COMBO・NEXT・機能キー) */
  --primary-tint: #eef4ff;   /* 機能キーの面 */
  --primary-line: #d6e4ff;   /* 機能キーの枠・NEXT の区切り */
  --typed: #9fc1ff;          /* 打ち終えた読み */
  --deco: #c9dbff;           /* 飾りの斜線 */
  --grid: rgba(123, 171, 255, 0.13);
  --accent: #f59e0b;         /* ボーナス・自己ベスト・残り10秒 */
  --accent-ink: #1e1b0f;
  --miss: #f87171;
  --line: #e5e7eb;
  --key-empty: #f3f4f6;
  --kb-height-ratio: 0.58;   /* 既存の値を保つ */
  --kb-bottom-offset: 40px;  /* 既存の値を保つ */
}
```

- `body` の背景: `var(--bg)` に 40px 間隔の方眼(`linear-gradient(var(--grid) 1px, transparent 1px)` を縦横に重ねる)
- 画面の上端に、主色の帯(高さ 4px)
- 右上に飾りの斜線2本と、線だけの小さな三角(インラインの `<svg aria-hidden="true">`、線の色 `--deco`、三角は `--primary`)。play・title・result で使う
- 「斜めのラベル」: `transform: skewX(-14deg)` をかけた小さな帯。塗り(主色の面+`--primary-ink` の文字、または差し色の面+`--accent-ink` の文字)と、枠だけ(1px `--primary` の枠+`--primary-strong` の文字)の2種類
- 絵文字は使わない

### 3. play 画面

縦に次の順で並べる。お題の読みが長くて行数が増えても、下の要素と重ならないこと。

```
[上端の帯]                                 [飾り]
42.3 秒 [+1秒]                        正解 128      ← ヘッダー
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━      ← 残り時間のバー
── No. 07                              [PERFECT]
雨上がりの空に虹が見えた。                          ← 漢字の文
あめあがりのそらに[に]じがみえた。                  ← 読み(主役)
          (空き。長い文のときはここが縮む)
- - - - - - - - - - - - - - - - - - - - - - - -
NEXT  電車の窓から海が見える。
[COMBO] 17                      あと3字で +1秒
━━━━━━━━━━━━━━━━━━━━━━━━◆────
[キーボード]
             FLICK ONLY
```

- 画面の左右の余白は 24px。上から「ヘッダー → バー → お題」、キーボードのすぐ上に「NEXT → コンボ」を置き、お題と NEXT の間の空きを伸び縮みさせる(flex で組む。`position: absolute` の固定座標で組まない)

#### ヘッダー
- 残り時間: Outfit 500 斜体 36px、`--fg`。小数1桁。右に「秒」(13px 700 `--muted`)
- ボーナスをもらったら、「秒」の右に斜めのラベル「+1秒」(差し色の面)を 0.8 秒出す。出ても消えても、ほかの要素の位置が動かないこと
- 右端に「正解」(12px 700 `--muted`)と正しく打てた文字数(Outfit 500 22px)
- **残り 10 秒以下**(`endTimeMs - 経過 <= 10000`): 数字を 64px にして `--accent` 色にする。バーも `--accent` にする。これでヘッダーの高さが変わるのは許す(お題は下にずれてよい)

#### 残り時間のバー
- 高さ 4px、地は `--line`、中身は `--fg`(残り 10 秒以下は `--accent`)
- 長さの比率 = `min(1, 残り時間 / 60000)`

#### お題
- 1行目: 主色の短い線(18×2px)と「No. 07」(Outfit 600 11px、字間 0.24em、`--muted`)。番号はこのプレイで何文目か(2桁)
- 1行目の右端に、パーフェクトで文を終えたとき斜めのラベル「PERFECT」(主色の面)を出す。いつ消すかは今の実装どおり(次の打鍵まで)。出ても消えても、ほかの要素の位置が動かないこと
- 漢字の文: 23px 700、`--muted`、行の高さ 1.45
- 読み: **38px 800**、字間 0.03em、行の高さ 1.45、`--fg`
  - 打ち終えた文字: `--typed`
  - 今の文字: 主色の面(角丸 6px、左右の余白 3px)+`--primary-ink` の文字
  - ミスしたとき: 今の文字の面を 0.2 秒 `--miss` にする
  - 保留中の文字(`pending`): 今の文字の上に 16px 800 `--primary-strong` で小さく出す(今の実装と同じ位置関係)
- カウントダウン中は、お題の位置に「3」「2」「1」を Outfit 300 斜体 120px `--fg` で出す

#### NEXT
- 上に 1px の点線(`--primary-line`)、その下に 14px の余白
- 「NEXT」(Outfit 600 11px、字間 0.24em、`--primary-strong`)と、次のお題の漢字の文(16px 700 `--subtle`)を横に並べる。読みは出さない
- 次のお題は `state.prompts[state.promptIndex + 1]`。ない場合は行ごと出さない

#### コンボ
- 左: 枠だけの斜めのラベル「COMBO」(Outfit 600 11px、字間 0.2em)と、コンボ数(Outfit 500 斜体 22px)
- 右: 「あと N字で +1秒」(12px 700 `--muted`)。`N = 20 - combo % 20`
- ゲージ: 地の線 2px `--line`、中身 4px `--primary`、中身の右端に主色の小さなひし形(10px の正方形を 45 度回して 0.75 倍)。長さの比率 = `(combo % 20) / 20`。ミスで 0 に戻るとき、幅が 0.2 秒で縮む

#### キーボード
大きさ・位置(`--kb-height-ratio`・`--kb-bottom-offset`)と入力処理は変えない。

- `view.ts` で、キーに種類のクラスを付ける: 文字キー `key`、空きキー `key key--empty`、「゛゜小」と「、。？！」は `key key--func`
- 文字キー: 白の面、1px `--line` の枠、角丸 8px、下に `0 2px 0 var(--line)` の影、LINE Seed JP 700 21px `--fg`
- 空きキー: `--key-empty` の面、枠なし、影なし
- 機能キー: `--primary-tint` の面、1px `--primary-line` の枠、同じ色の下の影、800、`--primary-strong`。「゛゜小」は 14px、「、。？！」は 15px
- 押している間: 押しているキーの面を `--primary-tint` にする(`:active` でよい)
- フリックのガイドのマス: 白の面、1.5px `--primary` の枠、角丸 8px、22px 700。選んでいる方向のマス: 主色の面、`--primary-ink`、25px 800、影 `0 6px 16px rgba(123, 171, 255, 0.45)`
- キーボードの下の `--kb-bottom-offset` の帯の中央に「FLICK ONLY」(Outfit 600 10px、字間 0.4em、`--faint`)

### 4. result 画面

モックの「案L — 結果」のとおり。上から:

- 上端の帯と飾り(飾りの丸1つは `--accent`)
- 斜めのラベル「RESULT」(主色の面、Outfit 600 12px、字間 0.3em)
- 「正しく打てた文字数」(13px 700 `--muted`)
- 文字数: Outfit 300 斜体 132px、行の高さ 0.85。右下に「字」(20px 800)
- 自己ベストを更新したときだけ、斜めのラベル「自己ベスト更新」(差し色の面)
- 2列×2行の表(上の線と各行の下の線は 1px `--line`、右の列は左に 1px の線): ミス / 正確率(%) / 1秒あたり(字) / 最大コンボ。ラベル 12px 700 `--muted`、値 Outfit 500 30px
- 「プレイ時間 78.5秒(ボーナス +18.5秒)」(12px 700 `--muted`)。プレイ時間 = `endTimeMs / 1000`、ボーナス = `(endTimeMs - 60000) / 1000`(小数1桁)
- ボタン: 「もう一度」は主色の面+`--primary-ink`、高さ 56px、17px 800、字間 0.1em、`clip-path: polygon(4% 0, 100% 0, 96% 100%, 0 100%)` で平行四辺形にする。「タイトルへ」は白の面+1px `--line` の枠、高さ 48px、15px 700。どちらも横幅いっぱい
- 計測モードの「ログを保存」は「タイトルへ」と同じ見た目

### 5. title 画面(モックはない。同じ部品で組む)

- 上端の帯と飾り
- 斜めのラベル「FLICK TYPING」(主色の面)
- タイトル「ふりっく」「タイピング」を2行で(LINE Seed JP 800 44px、行の高さ 1.2)
- 説明を2行(15px 700 `--muted`): 「フリックだけで打つタイピング。」「ミスせず続けると時間が増える。」
- 自己ベスト: ラベル「自己ベスト」(12px 700 `--muted`)と値(Outfit 300 斜体 64px +「字」)。記録がなければ「—」
- 画面の下のほう(キーボードがある高さ)に「はじめる」ボタン(result の「もう一度」と同じ見た目)
- 計測モードの環境チェックの表示は、小さい等幅の文字で残す

### 6. blocked 画面と横向きの表示

- blocked: 上端の帯、斜めのラベル「FLICK TYPING」、メッセージ(22px 800 `--fg`)を画面の中央より少し上に。ボタンは置かない
- 横向きの「縦向きにしてください」: 背景は `--bg` と方眼、文字は 20px 800 `--fg`。表示する条件は今の実装のまま(`pointer: coarse` かつ blocked 画面ではないとき)

### 7. 計測モードのパネル

中身と位置(画面の上部、`pointer-events: none`)は変えない。文字は Outfit / 等幅 10px、背景は白の 85% 不透明にする。

## 受け入れ条件

実装担当が確かめること:

- [ ] `npx.cmd tsc --noEmit` が通る
- [ ] `npm.cmd test` が通る(既存のテストを変えずに)
- [ ] `npm.cmd run build` が通る
- [ ] `npm.cmd run format:check` が通る
- [ ] `src/style.css` の色の値は `:root` の変数だけにある(`:root` の外に `#` で始まる色を直接書かない。`rgba(123, 171, 255, 0.45)` の影だけは例外)
- [ ] `src/game/**`、`src/anticheat/**`、`tests/**` に差分がない(`git diff --stat` で確かめる)

Claude Code とオーナーが実機で確かめること:

- [ ] play 画面で、読みのかながいちばん大きく見え、タイマーは上に小さくまとまっている
- [ ] 残り 10 秒でタイマーとバーが差し色になり大きくなる
- [ ] 「+1秒」「PERFECT」が出ても、お題が上下に動かない
- [ ] 読みが3行になる長い文でも、NEXT・コンボと重ならない
- [ ] NEXT に次のお題が出る
- [ ] result・title・blocked 画面がモックと同じ雰囲気
- [ ] 画面幅 320〜440px で崩れない

## 対象外

- ゲームのルール、判定、不正対策、ログの変更
- 効果音、振動の変更
- 案N のデザイン
- アニメーションの作り込み(今回は「+1秒」の表示時間、ミスの色、ゲージの幅の変化だけ)

## 想定される落とし穴

- **主色の上の白い文字**: `#7BABFF` に白い文字はコントラストが足りない。主色の面の文字は必ず `--primary-ink`
- **表示が出たときのレイアウトのずれ**: 「+1秒」「PERFECT」は場所を先に確保するか、ほかの要素に影響しない置き方にする(前回、PERFECT が出るたびにお題が下にずれて直した)
- **LINE Seed JP の読み込み**: 日本語フォントは大きい。`display=swap` で、読み込み前はフォールバックで表示されてよい
- **`no-os-input` テスト**: マークアップに `<input>` などを入れない
- **キーの大きさ**: `grid` のすき間や枠線でキーの大きさが今と変わらないこと(`box-sizing: border-box`)
- **ガイドのマスの位置**: `guide.ts` は触らない。ガイドの見た目は CSS だけで変える
