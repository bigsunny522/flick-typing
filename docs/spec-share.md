# 結果のシェア(X でシェア・画像で共有・OGP 画像)

## 背景

結果を人に見せる手段がない。友達に広めてもらうために、結果画面から次の2つをできるようにし、URL を共有したときのカードも大きな画像付きにする。

1. **X でシェア** — 文字数・順位・ハッシュタグ入りの投稿画面を開く
2. **画像で共有** — 結果のカード画像を作り、スマホの共有シートで渡す(写真に保存・X や LINE に画像付きで投稿)。共有シートが使えないブラウザでは画像をダウンロードする
3. **OGP 画像** — サイト共通の 1200×630 の画像を `og:image` にして、X では大きなカード(`summary_large_image`)で出す

オーナーと決めたこと:

| 項目         | 決めたこと                                                          |
| ------------ | ------------------------------------------------------------------- |
| 画像の渡し方 | 共有シート(Web Share API)。使えなければダウンロード                 |
| OGP 画像     | サイト共通の1枚(`public/ogp.png`。Claude Code が用意する)           |
| ハッシュタグ | `#ふりっくタイピング`                                               |
| 共有する URL | 本番の `https://flicktypinggame.xyzack271.com/`(プレビューでも同じ) |

## 変更対象

触るファイル:

- `src/share/text.ts`(新規) — 投稿の文・X の投稿画面の URL・画像のファイル名(純粋な関数)
- `src/share/card-content.ts`(新規) — カード画像に書く中身(純粋な関数)
- `src/share/card.ts`(新規) — カード画像を canvas に描いて PNG にする(DOM)
- `src/share/bind.ts`(新規) — 結果画面のシェアのボタンをつなぐ(DOM)
- `src/screens/result.ts`、`src/screens/endurance-result.ts` — ボタンを足し、`bindShare` を呼ぶ
- `src/style.css` — ボタンの並び
- `index.html`、`stats.html` — `og:image` などの `<meta>`
- `tests/share-text.test.ts`(新規)、`tests/share-card-content.test.ts`(新規)

触らないファイル:

- `public/ogp.png` — Claude Code が先に置いてある(元の HTML は `docs/ogp/ogp.html`)
- `src/screens/rank-offer.ts` — 順位の行とポップアップは今のまま
- `src/main.ts` — `renderResult` / `renderEnduranceResult` の引数は変えない
- `worker/**`、`wrangler.jsonc`、`migrations/**`、`package.json`(依存は足さない)

## 仕様

### 1. 投稿の文(`src/share/text.ts`)

```ts
/** 共有する URL(本番) */
export const SITE_URL = "https://flicktypinggame.xyzack271.com/";

/** ハッシュタグ(# なし) */
export const HASHTAG = "ふりっくタイピング";

/** シェアする結果 */
export type ShareSource =
  | {
      kind: "timeattack";
      correct: number;
      miss: number;
      maxCombo: number;
      endTimeMs: number;
      perfect: boolean;
      bestUpdated: boolean;
    }
  | {
      kind: "endurance";
      correct: number;
      title: string;
      author: string;
      progress: number; // 進んだ割合(%)。画面と同じ値
      complete: boolean; // 完走したか(end === "complete")
      bestUpdated: boolean;
    };

/** 投稿の文。`rank` は今期(今週 / 今日)の順位。分からなければ null */
export function shareText(source: ShareSource, rank: number | null): string;

/** X の投稿画面の URL */
export function xIntentUrl(text: string): string;

/** 画像のファイル名。`date` は端末の時刻(ローカル時刻で書く) */
export function imageFileName(date: Date): string;
```

`shareText` は「1行目 + 改行 + `#ふりっくタイピング`」。1行目は次のとおり(`{n}` は数字):

| 種目           | 条件       | 1行目                                               |
| -------------- | ---------- | --------------------------------------------------- |
| タイムアタック | 普通       | `タイムアタックで{correct}字打ちました!`            |
| タイムアタック | `perfect`  | `タイムアタックでノーミス{correct}字打ちました!`    |
| 耐久           | 完走でない | `今日の耐久「{title}」で{correct}字打ちました!`     |
| 耐久           | `complete` | `今日の耐久「{title}」を完走しました!({correct}字)` |

順位があるときは1行目の最後に足す:

- タイムアタック・耐久(完走でない): `(今週{rank}位)` / `(今日{rank}位)` を足す
- 耐久(完走): 括弧の中に足して `({correct}字・今日{rank}位)` にする

`!` `(` `)` は半角(表の文字のまま。結果画面の「完走!」と同じ)。`・`(U+30FB)と `「」` は全角。

`xIntentUrl(text)` は `https://x.com/intent/post?text=<encodeURIComponent(text)>&url=<encodeURIComponent(SITE_URL)>`。

`imageFileName(date)` は `flick-typing-YYYYMMDD-HHMM.png`(月・日・時・分は2桁)。

`src/share/text.ts` と `src/share/card-content.ts` では DOM・`Date.now()`・`new Date()`・`Math.random()`・localStorage を使わない(時刻は引数で受け取る)。

### 2. テスト(`tests/share-text.test.ts`)

表の1行ごとに `it` を1つ書く。`base` はタイムアタックの `{ correct: 123, miss: 2, maxCombo: 40, endTimeMs: 60000, perfect: false, bestUpdated: false }`、`meros` は耐久の `{ correct: 456, title: "走れメロス", author: "太宰治", progress: 12, complete: false, bestUpdated: false }`。

`shareText`(期待の `\n` は改行):

| 入力                                       | rank   | 期待                                                                            |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------- |
| `base`                                     | `3`    | `タイムアタックで123字打ちました!(今週3位)\n#ふりっくタイピング`                |
| `base`                                     | `null` | `タイムアタックで123字打ちました!\n#ふりっくタイピング`                         |
| `base` に `perfect: true`                  | `1`    | `タイムアタックでノーミス123字打ちました!(今週1位)\n#ふりっくタイピング`        |
| `meros`                                    | `12`   | `今日の耐久「走れメロス」で456字打ちました!(今日12位)\n#ふりっくタイピング`     |
| `meros` に `complete: true, correct: 2000` | `null` | `今日の耐久「走れメロス」を完走しました!(2000字)\n#ふりっくタイピング`          |
| `meros` に `complete: true, correct: 2000` | `2`    | `今日の耐久「走れメロス」を完走しました!(2000字・今日2位)\n#ふりっくタイピング` |

`xIntentUrl`:

| text      | 期待                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------ |
| `a b\n#c` | `https://x.com/intent/post?text=a%20b%0A%23c&url=https%3A%2F%2Fflicktypinggame.xyzack271.com%2F` |

`imageFileName`:

| date                             | 期待                             |
| -------------------------------- | -------------------------------- |
| `new Date(2026, 9, 7, 9, 5)`     | `flick-typing-20261007-0905.png` |
| `new Date(2026, 11, 31, 23, 59)` | `flick-typing-20261231-2359.png` |

### 3. カードに書く中身(`src/share/card-content.ts`)

```ts
export type CardContent = {
  modeLabel: string; // "タイムアタック" / "今日の耐久"
  score: number; // correct
  rankLabel: string | null; // "今週 5位" / "今日 3位"。rank が null なら null
  badges: string[]; // 下の表の順
  stats: [string, string][]; // [見出し, 値]
  dateLabel: string; // "2026/10/07"
  footer: string; // "flicktypinggame.xyzack271.com"(SITE_URL から https:// と最後の / を除いたもの)
};

export function cardContent(source: ShareSource, rank: number | null, date: Date): CardContent;
```

| 種目           | badges(この順。当てはまるものだけ) | stats                                                           |
| -------------- | ---------------------------------- | --------------------------------------------------------------- |
| タイムアタック | `PERFECT`、`自己ベスト更新`        | `ミス` / `正確率`(`97.6%`)/ `1秒あたり`(`2.00字`)/ `最大コンボ` |
| 耐久           | `完走`、`今日のベスト更新`         | `作品`(`{title} / {author}`)/ `進んだ割合`(`{progress}%`)       |

- 正確率は結果画面と同じ計算(`correct / (correct + miss)`、0 件なら 0)で、小数1桁 + `%`
- 1秒あたりは `correct / (endTimeMs / 1000)` を小数2桁 + `字`

### 4. テスト(`tests/share-card-content.test.ts`)

表の1行ごとに `it` を1つ書く(`base`・`meros` は 2 と同じ。`date` は `new Date(2026, 9, 7, 9, 5)`)。

| 入力                                           | rank   | 確かめること  | 期待                                                                                                                     |
| ---------------------------------------------- | ------ | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `base` に `correct: 120, miss: 3`              | `5`    | stats         | `[["ミス","3"],["正確率","97.6%"],["1秒あたり","2.00字"],["最大コンボ","40"]]`                                           |
| `base`                                         | `5`    | 種目と順位    | `modeLabel` が `タイムアタック`、`rankLabel` が `今週 5位`                                                               |
| `base`                                         | `null` | 順位なし      | `rankLabel` が `null`                                                                                                    |
| `base` に `perfect: true, bestUpdated: true`   | `null` | badges        | `["PERFECT","自己ベスト更新"]`                                                                                           |
| `base` に `correct: 0, miss: 0`                | `null` | 0 件の正確率  | stats の2つ目が `["正確率","0.0%"]`                                                                                      |
| `meros` に `bestUpdated: true`                 | `3`    | 耐久          | `modeLabel` が `今日の耐久`、`rankLabel` が `今日 3位`、stats が `[["作品","走れメロス / 太宰治"],["進んだ割合","12%"]]` |
| `meros` に `complete: true, bestUpdated: true` | `null` | 耐久の badges | `["完走","今日のベスト更新"]`                                                                                            |
| `base`                                         | `null` | 日付と URL    | `dateLabel` が `2026/10/07`、`footer` が `flicktypinggame.xyzack271.com`                                                 |

### 5. カード画像(`src/share/card.ts`)

```ts
/** カード画像を描いて PNG にする。描けなければ null */
export async function drawCard(content: CardContent): Promise<Blob | null>;
```

- 大きさは **1200×675**(X のタイムラインで切れない 16:9)。`canvas.toBlob(…, "image/png")`
- 色は描くときに `getComputedStyle(document.documentElement)` から読む(`--bg`、`--fg`、`--muted`、`--primary`、`--primary-ink`、`--primary-strong`、`--accent`、`--line`)。テーマの色がそのまま出る
- 文字は画面と同じ `"LINE Seed JP"` と `Outfit`。描く前に `document.fonts.load()` で、使う太さと**書く文字列**を指定して読み込む(Google Fonts の日本語は文字ごとに分けて配られるので、文字列を渡さないと豆腐やほかの書体になる)。読み込みに失敗しても `sans-serif` で描く
- 配置(だいたいの位置。重ならず、はみ出さなければ数ピクセルはずれてよい。余白は 64):
  - 左上: `ふりっくタイピング`(700 36px LINE Seed JP、`--fg`)。右上: `dateLabel`(400 28px、`--muted`、右寄せ)
  - 左の列(x = 64〜640):
    - `modeLabel`(700 32px、`--primary-strong`)
    - `score`(italic 300 200px Outfit、`--fg`)と、その右に `字`(700 48px LINE Seed JP)
    - `rankLabel`(700 40px、`--fg`)。null なら書かない
    - `badges` を横に並べた帯(塗り `--primary`、文字 `--primary-ink`、700 26px)
  - 右の列(x = 700〜1136): `stats` を上から1行ずつ。見出しは 700 24px `--muted`、値は 500 44px Outfit `--fg`。行の間に `--line` の線。耐久の「作品」の値は 700 30px LINE Seed JP で、幅に入らなければ末尾を `…` にして詰める
  - 下: 左に `footer`(400 26px、`--muted`)、右に `#ふりっくタイピング`(700 26px、`--primary-strong`、右寄せ)
- 背景は `--bg` で塗り、上端に高さ 12 の `--primary` の帯を引く
- 外部の画像は読み込まない(canvas が汚れて `toBlob` が失敗するため)

### 6. ボタンをつなぐ(`src/share/bind.ts`)

```ts
/**
 * 結果画面の「X でシェア」と「画像で共有」をつなぐ。
 * `rank` は `POST /api/results` の返事(送っていなければ null に解決する)
 */
export function bindShare(
  host: HTMLElement,
  source: ShareSource,
  rank: Promise<ResultsResponse | null>,
): void;
```

- 中で今期の順位 `periodRank: number | null`(最初は null)と、作り終えた画像 `file: File | null` を持つ
- `refresh()`:
  1. `#share-x` の `href` を `xIntentUrl(shareText(source, periodRank))` にする(プロパティで入れる。innerHTML に混ぜない)
  2. `drawCard(cardContent(source, periodRank, new Date()))` で画像を作り、`new File([blob], imageFileName(date), { type: "image/png" })` を `file` に入れる。前の `refresh()` の画像が後から届いても上書きしないよう、呼んだ回数の番号で古いものを捨てる
  3. 画像ができたら `#share-image` の `disabled` を外す(最初は `disabled`)
- 最初に1回 `refresh()`
- `rank` が解決し、`response?.chances?.period.rank` が数字なら `periodRank` に入れて `refresh()`。`host` の `#share-x` がもう画面に無ければ何もしない
- `.theme-tap` の `click` でも `refresh()`(テーマを変えたら画像の色も変える)。画面の `bindThemeTap(host)` の**あと**で登録する(テーマが先に変わるように)
- `#share-image` の `click`:
  - `file` が null なら何もしない
  - `navigator.canShare?.({ files: [file] })` が true なら `navigator.share({ files: [file] })`。**`click` の中で `await` を挟まずに呼ぶ**(先に画像を作っておくのはこのため。iOS は操作の直後でないと共有を断る)
  - `share` が `AbortError`(利用者が閉じた)で失敗したら何もしない。それ以外の失敗と、`canShare` が無い・false のときはダウンロードする
  - ダウンロード: `URL.createObjectURL(file)` の `<a download="ファイル名">` を作ってクリックし、少し後に `revokeObjectURL` する
  - 共有には文を入れない(`files` だけ)。iOS で「画像を保存」が出るようにするため

### 7. 結果画面(`src/screens/result.ts`、`src/screens/endurance-result.ts`)

`.result-actions` の中を次の形にする(画面の高さが増えないよう、2つずつ横に並べる。「ログを保存」は今のまま `もう一度` の次):

```html
<div class="result-actions">
  <button id="again" class="primary-button">もう一度</button>
  {saveButton}
  <div class="result-actions-row">
    <button id="title" class="secondary-button">タイトルへ</button>
    <button id="ranking" class="secondary-button">ランキング</button>
  </div>
  <div class="result-actions-row">
    <a id="share-x" class="secondary-button" target="_blank" rel="noopener noreferrer"
      >X でシェア</a
    >
    <button id="share-image" class="secondary-button" disabled>画像で共有</button>
  </div>
</div>
```

- `bindThemeTap(host)` のあとで `bindShare(host, source, rank)` を呼ぶ
- タイムアタックの `source`: `values` の `correct`・`miss`・`maxCombo`・`endTimeMs`・`perfect`・`bestUpdated`
- 耐久の `source`: `correct`・`title`・`author`・`progress`・`complete: values.end === "complete"`・`bestUpdated`

### 8. 見た目(`src/style.css`)

- `.result-actions-row`: `display: grid; grid-template-columns: 1fr 1fr; gap: 10px;`
- `a.secondary-button`: ボタンと同じ見た目にする(`display: flex; align-items: center; justify-content: center; text-decoration: none;`)
- `.secondary-button:disabled`: `opacity: 0.5;`
- 色は既存の CSS 変数だけを使う

### 9. OGP(`index.html`、`stats.html`)

両方の `<meta property="og:locale" …>` のあとに:

```html
<meta property="og:url" content="https://flicktypinggame.xyzack271.com/" />
<meta property="og:image" content="https://flicktypinggame.xyzack271.com/ogp.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

- `stats.html` の `og:url` は `https://flicktypinggame.xyzack271.com/stats`
- 両方の `twitter:card` を `summary` から `summary_large_image` に変える

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る(`tests/share-text.test.ts` の9件と `tests/share-card-content.test.ts` の8件を含む)
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `grep -c "summary_large_image" dist/index.html dist/stats.html` がどちらも 1
- [ ] `ls dist/ogp.png` でファイルがある
- [ ] `grep -n "bindShare" src/screens/result.ts src/screens/endurance-result.ts` が両方のファイルで出る
- [ ] 以下は Claude Code が確かめる(実装担当は不要)
  - 結果画面で「X でシェア」が、文と URL の入った X の投稿画面を開く
  - 「画像で共有」で、テーマの色のカード画像が共有シート(パソコンではダウンロード)で出る。日本語が豆腐にならない

## 対象外

- 結果ごとの OGP 画像(シェアした URL に記録のカードを出すこと)
- ランキング画面・タイトル画面からのシェア
- 共有に文を添えること(画像だけ渡す)
- ニックネームを画像に入れること

## 想定される落とし穴

- **共有は操作の直後でないと断られる。** `click` の中で `toBlob` や `fetch` を待ってから `navigator.share` を呼ぶと、iOS Safari が `NotAllowedError` を出す。画像は画面を出したとき・順位が届いたとき・テーマを変えたときに先に作っておく
- **フォントの読み込み。** `document.fonts.ready` だけでは、まだ画面に出ていない文字(数字の大きな Outfit、カードにだけ出る文字)が読み込まれていないことがある。`document.fonts.load(font, text)` を使う
- **`no-os-input` のテスト。** `<a>` と `<button>` だけを使い、`<input>` などを足さない
- **画面の高さ。** 結果画面はスクロールしない。ボタンを縦に1つずつ足さず、7 の形で2つずつ並べる
- **`href` の中身。** 作品名などが入るので、文字列をつないだ HTML ではなく `a.href = …` で入れる
- **debug 中。** 結果を送らないので `rank` は null に解決する。順位なしの文と画像になればよい
- **1行100文字。** 長い文字列は `+` でつなぐ
