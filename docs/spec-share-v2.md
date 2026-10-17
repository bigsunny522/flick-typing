# シェアの見直し(カード画像・投稿の文・ボタンの並び・ランキングから結果に戻る)

## 背景

`docs/spec-share.md` で入れたシェアを、オーナーがプレビューで触って次の点を指摘した。

1. **カード画像の左右に余白がなく見にくい。** 左の列と右の列に分かれていて、端まで文字がある。中央に寄せたデザインにする
2. **「画像で共有」から SNS を選ぶと文が入らない。** 今は `navigator.share({ files })` だけで `text` を渡していない
3. **X に投稿する文に魅力がない。** 記録を書くだけで、見た人が遊びたくなる一言がない
4. **順位は変わる。** 今の順位は送った時点のもので、あとから抜かれることがある。それが分かる書き方にする
5. **シェアのボタンが目立たない。** 一番下の段にあり、ほかのボタンと同じ見た目
6. **ランキング画面から結果に戻れない。** 「ランキングに載せますか?」→「載せる」でランキング画面に移り、ニックネームを付けたあと「戻る」を押すとタイトルに戻る。結果の画面が消えるので、シェアできない

## 変更対象

触るファイル:

- `src/share/text.ts` — 投稿の文
- `src/share/card-content.ts` — カードの順位の書き方
- `src/share/card.ts` — カードの描き方(中央寄せ)
- `src/share/bind.ts` — 共有シートに文を渡す・日付を渡す
- `src/screens/result.ts`、`src/screens/endurance-result.ts` — ボタンの並び・戻ってきたときの表示
- `src/screens/rank-offer.ts` — ポップアップを出さない指定
- `src/screens/ranking.ts` — 戻るボタンの文字を変えられるようにする
- `src/main.ts` — 結果からランキングに行ったら、結果に戻す
- `src/style.css` — シェアのボタンの見た目
- `tests/share-text.test.ts`、`tests/share-card-content.test.ts`

触らないファイル:

- `worker/**`、`wrangler.jsonc`、`migrations/**`、`package.json`
- `src/ranking/**`、`src/stats/**`、`src/game/**`、`src/anticheat/**`
- `index.html`、`stats.html`、`public/**`、`docs/ogp/**`

## 仕様

### 1. 投稿の文(`src/share/text.ts`)

署名を変える。`date` は端末の時刻(ローカル時刻で書く。`imageFileName` と同じ)。

```ts
/** 投稿の文。`rank` は今期(今週 / 今日)の順位。分からなければ null */
export function shareText(source: ShareSource, rank: number | null, date: Date): string;
```

文は「1行目(記録)」「2行目(順位。`rank` が null なら行ごと出さない)」「3行目(誘いの一言)」「4行目(ハッシュタグ)」を `\n` でつなぐ。URL は入れない(X は `xIntentUrl` の `url=` で、共有シートは 2 で足す)。

1行目:

| 条件                      | 1行目                                            |
| ------------------------- | ------------------------------------------------ |
| タイムアタック            | `フリック入力60秒タイムアタックで{n}字!`         |
| タイムアタック・`perfect` | `フリック入力60秒タイムアタックでノーミス{n}字!` |
| 耐久・完走でない          | `今日の耐久「{title}」を{n}字({p}%)まで打った!`  |
| 耐久・`complete`          | `今日の耐久「{title}」を{n}字で完走!`            |

- `{n}` は `correct`、`{p}` は `progress`
- `bestUpdated` が true のときは、1行目の最後に `自己ベスト更新!`(耐久は `今日のベスト更新!`)を空白なしでつなぐ。例: `…で123字!自己ベスト更新!`

2行目(`rank` が数のときだけ):

| 種類           | 2行目                                      |
| -------------- | ------------------------------------------ |
| タイムアタック | `今週のランキングで暫定{r}位({M}/{D}時点)` |
| 耐久           | `今日のランキングで暫定{r}位({M}/{D}時点)` |

- `{M}` `{D}` は `date` の月と日。0 で埋めない(`10/7`)
- 「暫定」と日付で、あとから順位が変わることを示す

3行目:

| 種類           | 3行目                             |
| -------------- | --------------------------------- |
| タイムアタック | `この記録、抜ける?`               |
| 耐久           | `今日中なら同じ文章で勝負できる!` |

4行目: `#ふりっくタイピング`(`#${HASHTAG}`)

記号の決まりは `docs/spec-share.md` と同じ(`!()?` は半角、`「」` は全角)。

### 2. 共有シートに文を渡す(`src/share/bind.ts`)

- `refresh()` で作る日付(`const date = new Date()`)を、画像と文の両方に使う。`shareText(source, periodRank, date)` にする
- 共有シートには画像と文を渡す。文は `shareText(...)` のあとに `\n` と `SITE_URL` をつなげたもの。`refresh()` のときに作って、画像と一緒に変数に持っておく(click の中で待たない今の作りを保つ)

```ts
const data: ShareData = { files: [image], text: shareTextWithUrl };
if (navigator.canShare?.(data)) {
  navigator.share(data).catch(/* 今と同じ */);
  return;
}
downloadFile(image);
```

- `url` は渡さない(iOS で別の項目になり、アプリによって画像が落ちるため。URL は文の中に入れる)
- 共有先のアプリによっては文を無視する(Instagram など)。それはアプリの仕様なので対処しない

### 3. カードの順位(`src/share/card-content.ts`)

- `rankLabel` を `今週 暫定{r}位` / `今日 暫定{r}位` にする(今の `今週 {r}位` に「暫定」を足す)。null のときは今のまま null
- カードには日付(`dateLabel`)が入るので、順位の横に日付は書かない

### 4. カードの描き方(`src/share/card.ts`)

大きさは今のまま 1200×675。2列をやめ、すべて中央(x = 600)にそろえる。位置は下の表のとおり(y は上端。`textBaseline = "top"`)。

| 部分       | 描き方                                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 外側       | 全体を `--primary-tint` で塗る                                                                                                                                                                                                  |
| 板         | x 56〜1144、y 40〜635 を `--bg` で塗り、`--primary-line` の 2px の枠を付ける                                                                                                                                                    |
| 板の上の帯 | 板の上端から高さ 10px を `--primary` で塗る                                                                                                                                                                                     |
| 名前       | y 78。`700 30px` 日本語、`--fg`、`ふりっくタイピング`                                                                                                                                                                           |
| 種類       | y 124。`modeLabel` を `700 26px` 日本語で、`--primary` の帯(高さ 42、文字の左右に 18px)に `--primary-ink` で書く。帯ごと中央に置く                                                                                              |
| 文字数     | y 182。数字は `italic 300 170px` Outfit、`--fg`。右に `字`(`700 48px` 日本語、y は数字の y + 112)。数字の幅 + 10 + 「字」の幅を合わせて中央に置く                                                                               |
| 順位       | y 360。`700 38px` 日本語、`--primary-strong`。`rankLabel` が null なら描かない(下の部分は動かさない)                                                                                                                            |
| バッジ     | y 414。今の描き方(高さ 40、左右 16px)で、全部の幅(間 12px)を合わせて中央に置く。ないときは描かない                                                                                                                              |
| 区切り線   | y 478。x 136〜1064、高さ 1px、`--line`                                                                                                                                                                                          |
| 数値       | x 136〜1064 を `stats` の数で等分し、各区画の中央に書く。見出しは y 498 `700 22px` 日本語 `--muted`。値は y 530 `500 38px` Outfit `--fg`。`作品` の値だけ `700 28px` 日本語で、区画の幅 - 24 に入らなければ今の `clip` で詰める |
| 下の行     | y 592。`400 22px` 日本語、`--muted`。`{dateLabel}  {footer}  #ふりっくタイピング`(間は半角の空白2つ)                                                                                                                            |

- 今の `MARGIN` / `RIGHT_COLUMN_START` / `drawLeftColumn` / `drawStats` / `drawHeader` / `drawFooter` は、新しい描き方に合わせて作り直してよい
- 色はすべて CSS 変数から読む(`readPalette` に `primaryTint` と `primaryLine` を足す)。`#` で始まる色を書かない
- `loadFonts` の一覧も、使う太さ・大きさに合わせて直す
- 幅を測るときは、その文字を書くフォントに切り替えてから `measureText` する(前回のレビューで直した点)

### 5. ボタンの並び(`src/screens/result.ts`、`src/screens/endurance-result.ts`、`src/style.css`)

`.result-actions` の中を、上から次の順にする(2つの画面で同じ)。

1. シェアの段 `.result-actions-row.share-row`: 左に X、右に画像
2. `もう一度`(`primary-button`)
3. `ログを保存`(debug のときだけ。今のまま)
4. `タイトルへ` | `ランキング` の段(今のまま)

X のボタン:

```html
<a id="share-x" class="share-x-button" target="_blank" rel="noopener noreferrer">
  <svg class="share-x-logo" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
    />
  </svg>
  でポスト
</a>
```

画像のボタン: `<button id="share-image" class="secondary-button" disabled>画像で共有</button>`(今のまま)

`src/style.css`:

- `.share-x-button`: `display: flex; align-items: center; justify-content: center; gap: 6px; height: 48px; color: var(--bg); font-size: 15px; font-weight: 700; text-decoration: none; background: var(--fg);`
- `.share-x-logo`: `width: 18px; height: 18px;`
- 今の `a.secondary-button` の決まりは使わなくなるので消す
- 色は既存の CSS 変数だけを使う

### 6. ランキングから結果に戻る(`src/main.ts`、`src/screens/ranking.ts`、`src/screens/result.ts`、`src/screens/endurance-result.ts`、`src/screens/rank-offer.ts`)

**結果の画面から開いたランキング画面は、「戻る」で同じ結果の画面に戻る。** 「ランキングに載せますか?」から移ったときも、結果の画面の「ランキング」ボタンから移ったときも同じ。

`src/screens/ranking.ts`:

- `renderRanking(host, initialBoard, onBack, askName = false, backLabel = "戻る")` にする。`#ranking-back` の文字を `backLabel` にする(`textContent` で入れる)

`src/main.ts`:

- `openRanking(board, askName = false, onBack = showTitle, backLabel = "戻る")` にして、`renderRanking` にそのまま渡す。タイトルからはこれまでどおり `openRanking("timeattack-weekly")`
- `startGame` の `onFinish` の中で、結果を描く関数を作る:

```ts
const showResult = (revisit: boolean): void =>
  renderResult(
    root,
    result,
    () => startGame(mode),
    showTitle,
    rank,
    (board, askName) => openRanking(board, askName, () => showResult(true), "結果に戻る"),
    save,
    revisit,
  );
showResult(false);
```

- `startEnduranceRound` も同じ形にする(`renderEnduranceResult`)
- 戻るときは結果を**送り直さない**(`reportResult` を呼ばない)。最初に作った `rank` の Promise をそのまま使う。自己ベストの保存も繰り返さない(今どおり `onFinish` の最初で1回だけ)

`renderResult` / `renderEnduranceResult`:

- 最後の引数に `revisit = false` を足す
- `revisit` が true のとき:
  - 「ランキングに入れます」のポップアップを出さない(`showResultRank` に `offer: false` を渡す)
  - 紙吹雪を出さない(`renderResult` だけ)
  - それ以外(順位の行・自己ベストのリボン・シェア)は最初と同じに出す。`rank` はもう解決しているので、順位の行とシェアの順位はすぐ入る

`src/screens/rank-offer.ts`:

- `showResultRank` の `options` に `offer: boolean` を足す。false のときは順位の行だけ書き、`openRankOffer` を呼ばない

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `tests/share-text.test.ts` に、次の表の1行ごとに `it` が1つある(今の `shareText` のテストは置き換える。`xIntentUrl`・`imageFileName` のテストは残す)。`date` は `new Date(2026, 9, 7, 21, 5)`

| 入力                                          | 期待                                                                                                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| タイムアタック 123字、順位 3                  | `フリック入力60秒タイムアタックで123字!\n今週のランキングで暫定3位(10/7時点)\nこの記録、抜ける?\n#ふりっくタイピング`                                 |
| タイムアタック 123字、順位 null               | `フリック入力60秒タイムアタックで123字!\nこの記録、抜ける?\n#ふりっくタイピング`                                                                      |
| タイムアタック `perfect`、順位 1              | `フリック入力60秒タイムアタックでノーミス123字!\n今週のランキングで暫定1位(10/7時点)\nこの記録、抜ける?\n#ふりっくタイピング`                         |
| タイムアタック `bestUpdated`、順位 null       | `フリック入力60秒タイムアタックで123字!自己ベスト更新!\nこの記録、抜ける?\n#ふりっくタイピング`                                                       |
| 耐久「走れメロス」456字・12%、順位 12         | `今日の耐久「走れメロス」を456字(12%)まで打った!\n今日のランキングで暫定12位(10/7時点)\n今日中なら同じ文章で勝負できる!\n#ふりっくタイピング`         |
| 耐久 `complete` 3800字、順位 null             | `今日の耐久「走れメロス」を3800字で完走!\n今日中なら同じ文章で勝負できる!\n#ふりっくタイピング`                                                       |
| 耐久 `complete`・`bestUpdated` 3800字、順位 2 | `今日の耐久「走れメロス」を3800字で完走!今日のベスト更新!\n今日のランキングで暫定2位(10/7時点)\n今日中なら同じ文章で勝負できる!\n#ふりっくタイピング` |

- [ ] `tests/share-card-content.test.ts` の `rankLabel` の期待が `今週 暫定5位` / `今日 暫定3位` になっている
- [ ] `grep -n "a.secondary-button" src/style.css` が何も出さない
- [ ] `grep -n "share-x-button" src/screens/result.ts src/screens/endurance-result.ts src/style.css` が3つのファイルすべてで出る
- [ ] 以下は Claude Code がブラウザで確かめる(実装担当は不要)
  - カード画像が中央寄せで、左右に余白がある(タイムアタック・耐久、順位あり・なし)
  - 結果の画面で、シェアの段が「もう一度」の上にあり、X のボタンが黒地(テーマの `--fg`)
  - 「載せる」→ ランキング画面 → 名前を付ける →「結果に戻る」で同じ結果の画面に戻り、ポップアップが出ず、X でシェアできる
  - 結果の「ランキング」→「結果に戻る」でも同じ
  - タイトルから開いたランキング画面の「戻る」はタイトルに戻る

## 対象外

- 画像を X に直接付けて投稿すること(X の投稿画面の URL では画像を渡せない)
- 共有先のアプリが文を無視すること
- 結果ごとの OGP 画像
- ランキング画面以外(タイトル・プレイ)の変更

## 想定される落とし穴

- **共有シートは click の中ですぐ呼ぶ。** iOS は `await` を挟むと共有シートを開かない。文も画像も `refresh()` で先に作っておく
- **`canShare` に渡すものと `share` に渡すものを同じにする。** `text` を足したら両方に足す
- **戻ったときに `showResultRank` がポップアップを出し直さない。** 出し直すと「載せる」で同じ記録をもう一度送ることになる
- **戻ったときに `rank` の Promise を作り直さない。** `reportResult` を呼ぶと結果がもう一度保存される
- **`backLabel` は固定の文だけ。** 利用者の入力は入らないが、`textContent` で入れる
- **「字」の幅を測るフォント。** 数字と「字」で幅を足すとき、それぞれのフォントにしてから測る
- **耐久の作品名が長い。** `作品` の区画は幅が半分なので、`clip` で詰める
