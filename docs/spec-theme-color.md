# テーマカラーを切り替える隠し機能

## 背景

オーナーの要望。タイトル画面と結果画面の右上をタップするたびに、テーマカラーが順番に変わる隠し機能を足す。色は今の水色をもとに6色用意する。選んだ色は次に開いたときも残す。

右上には飾りの `.deco`(線とひし形)がある。ここをタップの的にする。画面上に説明は出さない(隠し機能)。

## 変更対象

触るファイル:

- `src/theme.ts` — 新規。テーマの一覧・次のテーマ・保存値の読み取り・適用
- `src/storage.ts` — `loadTheme` / `saveTheme` を足す
- `src/main.ts` — 起動時に保存済みのテーマを適用する
- `src/screens/title.ts`、`src/screens/result.ts` — 右上にタップ用のボタンを置く
- `src/style.css` — テーマごとの色、タップ用ボタンの見た目、色を直接書いている1か所の置き換え
- `tests/theme.test.ts` — 新規

触らないファイル:

- `src/screens/play.ts`、`src/screens/blocked.ts`(プレイ中・ブロック画面にはボタンを置かない。色は CSS 変数なので自動で変わる)
- `src/game/**`、`src/anticheat/**`、`src/keyboard/**`、`src/native/**`、`src/data/**`、`src/debug/**`、`src/probe/**`
- `index.html`、`package.json`、`AGENTS.md` / `CLAUDE.md` / `docs/**`

## 仕様

### 1. テーマの一覧(`src/theme.ts`)

```ts
export type ThemeId = "sky" | "sakura" | "leaf" | "lavender" | "aqua" | "mono";
export const THEMES: readonly ThemeId[] = ["sky", "sakura", "leaf", "lavender", "aqua", "mono"];
export const DEFAULT_THEME: ThemeId = "sky";
export function nextTheme(current: ThemeId): ThemeId; // 一覧の次。最後の次は最初に戻る
export function parseTheme(value: string | null): ThemeId; // 一覧にない値・null は DEFAULT_THEME
export function applyTheme(theme: ThemeId): void; // document.documentElement.dataset.theme = theme
```

- `sky` は今の色そのもの。`:root` に書いてある値を変えない
- `applyTheme("sky")` のときも `data-theme="sky"` を付けてよい(CSS 側は `sky` 用のブロックを書かず、`:root` の値がそのまま使われる)

### 2. 色の値(`src/style.css`)

`:root` の直後に、テーマごとに次の変数だけを上書きするブロックを足す。形は `:root[data-theme="sakura"] { … }`。

`--glow` は新しい変数。`:root`(= sky)にも `--glow: rgba(123, 171, 255, 0.45);` を足す。`.flick-guide.is-active` の `box-shadow: 0 6px 16px rgba(123, 171, 255, 0.45);` を `box-shadow: 0 6px 16px var(--glow);` に置き換える。

| 変数 | sky(今の値) | sakura | leaf | lavender | aqua | mono |
|---|---|---|---|---|---|---|
| `--primary` | `#7babff` | `#ff8fb8` | `#6fd39a` | `#b39bff` | `#5fd0e0` | `#b5b5b5` |
| `--primary-ink` | `#0b1120` | `#2a0a17` | `#06200f` | `#160b2e` | `#052126` | `#111111` |
| `--primary-strong` | `#1d4ed8` | `#db2777` | `#15803d` | `#6d28d9` | `#0e7490` | `#404040` |
| `--primary-tint` | `#eef4ff` | `#fff0f6` | `#ecfbf2` | `#f4f0ff` | `#ecfbfd` | `#f5f5f5` |
| `--primary-line` | `#d6e4ff` | `#ffd6e7` | `#ccf2dc` | `#e2d9ff` | `#c9f0f5` | `#e0e0e0` |
| `--typed` | `#9fc1ff` | `#ffb3cf` | `#9be2b9` | `#cbbcff` | `#93e0ea` | `#cfcfcf` |
| `--deco` | `#c9dbff` | `#ffd1e2` | `#c4efd6` | `#ddd3ff` | `#c2eef4` | `#dedede` |
| `--grid` | `rgba(123, 171, 255, 0.13)` | `rgba(255, 143, 184, 0.13)` | `rgba(111, 211, 154, 0.13)` | `rgba(179, 155, 255, 0.13)` | `rgba(95, 208, 224, 0.13)` | `rgba(181, 181, 181, 0.13)` |
| `--glow` | `rgba(123, 171, 255, 0.45)` | `rgba(255, 143, 184, 0.45)` | `rgba(111, 211, 154, 0.45)` | `rgba(179, 155, 255, 0.45)` | `rgba(95, 208, 224, 0.45)` | `rgba(181, 181, 181, 0.45)` |

- `--accent`・`--miss`・`--bg`・`--fg` などそれ以外の変数は、どのテーマでも変えない

### 3. 保存(`src/storage.ts`)

- キーは `"flick-typing:theme:v1"`
- `loadTheme(): string | null` と `saveTheme(theme: string): void` を足す。既存の `loadMode` / `saveMode` と同じく `try` / `catch` で囲み、失敗したら `null` を返す・何もしない
- 文字列をテーマに直すのは `theme.ts` の `parseTheme` の役目(`storage.ts` から `theme.ts` を import しない)

### 4. 起動時(`src/main.ts`)

- 最初の画面を出す前に `applyTheme(parseTheme(loadTheme()))` を呼ぶ。`?probe` の分岐より前でも後でもよいが、タイトル画面が出る前に必ず適用されていること

### 5. タップ用のボタン(`title.ts` / `result.ts`)

- 両画面の `<main>` の中、`.deco` の直後に次を置く

  ```html
  <button type="button" class="theme-tap" aria-label="テーマカラーを変える"></button>
  ```

- クリックで次をする

  ```ts
  const next = nextTheme(parseTheme(document.documentElement.dataset.theme ?? null));
  applyTheme(next);
  saveTheme(next);
  ```

- 2画面で同じ処理を書かないよう、`theme.ts` に `bindThemeTap(host: HTMLElement): void`(`host` の中の `.theme-tap` に上の処理を登録する)を置いてもよい。この関数だけは DOM に触れてよい(`theme.ts` は `src/game/`・`src/anticheat/` の外なので規約の対象外)

### 6. タップ用ボタンの見た目(`style.css`)

```css
.theme-tap {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 2;
  width: 88px;
  height: 80px;
  padding: 0;
  border: 0;
  background: transparent;
  -webkit-tap-highlight-color: transparent;
}
```

- 見た目は何も出さない(右上の `.deco` が透けて見え、色が変わることで反応が分かる)
- `.title-screen` と `.result-screen` は `.screen` の `position: relative` の中なので、右上に重なる。既存のボタンやリボンと重ならないことを確かめる(重なる場合は止めて質問する)

### 7. テスト(`tests/theme.test.ts`)

表の1行ごとに `it` を1つ書く。

| 確かめること | 入力 | 期待 |
|---|---|---|
| 次のテーマ | `nextTheme("sky")` | `"sakura"` |
| 最後の次は最初 | `nextTheme("mono")` | `"sky"` |
| 6回で1周 | `"sky"` から `nextTheme` を6回 | `"sky"` |
| 一覧にある値 | `parseTheme("leaf")` | `"leaf"` |
| 一覧にない値 | `parseTheme("red")` | `"sky"` |
| null | `parseTheme(null)` | `"sky"` |

`applyTheme` と `bindThemeTap` のテストは不要(DOM を使うため)。

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る(`tests/theme.test.ts` の6件を含む)
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `grep -n "rgba(123, 171, 255" src/style.css` が `:root` の中の2行(`--grid` と `--glow`)だけを出す
- [ ] 以下は Claude Code がブラウザで確かめる(実装担当は不要): タイトル画面の右上をタップするたびに色が sky → sakura → leaf → lavender → aqua → mono → sky と変わる。リロードしても色が残る。結果画面の右上でも変わる。プレイ画面にはボタンがない

## 対象外

- プレイ画面・ブロック画面からの切り替え
- `--accent`(オレンジ)や `--miss`(赤)の色をテーマで変えること
- ダークテーマ
- 切り替えたときのアニメーションや通知の表示
- `<meta name="theme-color">` の追加

## 想定される落とし穴

- `body` に `touch-action: none` がかかっている。`button` には既存の `touch-action: manipulation` が効くので、追加の指定は要らない
- `.deco` は `transform: rotate(-25deg)` がかかった小さな要素で、そのままだと的が小さい。`.deco` 自体にクリックを付けず、上に透明なボタンを重ねる
- `.theme-tap` は既存の `button` のスタイル(`font: inherit` など)を引き継ぐ。枠線や背景が出ないよう、上の CSS のとおり打ち消す
- タイトル画面はモード切替のたびに作り直さない(今の実装は `select` で一部だけ書き換える)が、結果画面からタイトルに戻ると `innerHTML` で作り直す。そのたびに `bindThemeTap` を呼ぶこと
- `dataset.theme` が未設定のとき(起動時の適用前など)は `parseTheme(null)` で `sky` 扱いになる
