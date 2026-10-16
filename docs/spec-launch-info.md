# 一般公開の前の表示(記録と名前の説明・NG ワード・ページの説明文)

## 背景

ランキングを入れて一般に宣伝する前に、次の3つを直す(`docs/spec-launch-hardening.md` の続き)。

1. **集めているものの説明がない。** 端末ごとの匿名の番号とプレイ結果を集めていて、ランキングに載せた記録とニックネームは誰でも見られる。これをどこにも書いていない。名前や記録を消してほしい人の連絡先もない
2. **NG ワードに漢字がない。** `src/ranking/ng-words.ts` はひらがなと英字だけなので、「死ね」「殺す」などの漢字の名前が通る
3. **ページの説明文がない。** `index.html` と `stats.html` に `<title>` しかなく、SNS で URL を共有したときに説明が出ない。ファビコンもない(毎回 `/favicon.ico` が 404 になる)

オーナーと決めたこと:

| 項目           | 決めたこと                                                                        |
| -------------- | --------------------------------------------------------------------------------- |
| 連絡先         | X の `@xyzack271`(`https://x.com/xyzack271`)                                      |
| 説明を置く場所 | ランキング画面の下と、集計ページ(`/stats`)の下。同じ文を1か所で定義して両方で使う |
| NG ワード      | 漢字の暴言を足す(運営のなりすまし・ローマ字の下ネタは今回は足さない)              |

## 変更対象

触るファイル:

- `src/about.ts`(新規) — 「記録と名前について」の HTML を返す関数
- `src/screens/ranking.ts` — 画面の下に説明を足す
- `src/stats-page/main.ts` — ページの下に説明を足す
- `src/screens/name-form.ts` — 入力欄の下の小さな文を変える
- `src/style.css` — 説明の見た目
- `src/ranking/ng-words.ts` — 漢字の言葉を足す
- `tests/ranking-name.test.ts` — 漢字の NG のテストを足す
- `tests/about.test.ts`(新規)
- `index.html`、`stats.html` — 説明文・OGP・ファビコンの `<meta>` / `<link>`
- `public/favicon.svg`(新規)

触らないファイル:

- `src/ranking/name.ts` — 照合のしかた(NFKC・カタカナをひらがなに・部分一致)は今のまま
- `worker/**`、`wrangler.jsonc`、`migrations/**`、`package.json`
- `src/screens/title.ts`、`src/screens/result.ts`、`src/screens/endurance-result.ts`、`src/screens/rank-offer.ts`

## 仕様

### 1. 「記録と名前について」(`src/about.ts`)

```ts
/** 連絡先(X のアカウント) */
export const CONTACT_X = "xyzack271";

/** 「記録と名前について」の HTML。中身は固定の文だけ(利用者の入力を混ぜない) */
export function aboutHtml(): string;
```

返す HTML(この文面のとおりにする。`<details>` は最初は閉じている):

```html
<details class="about">
  <summary>記録と名前について</summary>
  <ul>
    <li>
      遊んだ結果(打てた文字数・ミスの数・コンボ・時間)を、端末ごとに作る匿名の番号といっしょに集めています。入力した文字そのものや、メールアドレスなどの個人情報は集めていません
    </li>
    <li>集めた結果は、ランキングと「みんなの記録」の集計に使います</li>
    <li>ランキングに載せた記録とニックネームは、だれでも見られます</li>
    <li>自己ベストや設定は、この端末のブラウザの中にだけ保存しています</li>
    <li>画面の文字は Google Fonts から読み込んでいます</li>
    <li>不適切な名前や、不正と思われる記録は、予告なく消すことがあります</li>
    <li>
      名前や記録を消してほしいときは、X の
      <a href="https://x.com/xyzack271" target="_blank" rel="noopener noreferrer">@xyzack271</a>
      までご連絡ください
    </li>
  </ul>
</details>
```

- URL とアカウント名は `CONTACT_X` から組み立てる
- 1行は100文字以内にする(文字列を `+` でつなぐ。今の画面のファイルと同じ書き方)

### 2. テスト(`tests/about.test.ts`)

表の1行ごとに `it` を1つ書く。`aboutHtml()` の戻り値を文字列として調べる(DOM は使わない)。

| 確かめること     | 期待                                                    |
| ---------------- | ------------------------------------------------------- |
| 見出し           | `<summary>記録と名前について</summary>` を含む          |
| 連絡先の URL     | `href="https://x.com/xyzack271"` を含む                 |
| 別のタブで開く   | `target="_blank"` と `rel="noopener noreferrer"` を含む |
| 項目の数         | `<li>` がちょうど7個                                    |
| 入力欄を置かない | `<input` と `<textarea` を含まない                      |

### 3. ランキング画面(`src/screens/ranking.ts`)

- `SHELL` の `.ranking-actions`(「戻る」)の**あと**、`</main>` の前に `aboutHtml()` を入れる
- 一覧を読み直しても(`load()`)説明は描き直さない(`SHELL` に入れるだけ)

### 4. 集計ページ(`src/stats-page/main.ts`)

- `shell(body)` の `${body}` のあと、`</main>` の前に `aboutHtml()` を入れる(読み込み中・エラーの画面にも出る)

### 5. 名前の入力欄の小さな文(`src/screens/name-form.ts`)

- `.name-form-hint` の文を「10文字まで。記号・絵文字は使えません。ランキングでだれでも見られます」にする

### 6. 説明の見た目(`src/style.css`)

`src/style.css` に書く(集計ページも `src/stats-page/main.ts` で `src/style.css` を読み込んでいるので、`stats.css` には書かない):

- `.about`: `margin-top: 24px; padding-top: 12px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; line-height: 1.7;`
- `.about summary`: `cursor: pointer; font-weight: 700; color: var(--fg); font-size: 13px;`
- `.about ul`: `margin: 8px 0 0; padding-left: 1.2em;`
- `.about a`: `color: var(--primary-strong);`
- 色は既存の CSS 変数だけを使う(`#` で始まる色を書かない)
- ランキング画面の `.ranking-actions` は `margin-top: auto` で下に寄せているので、説明はその下に出る。画面が短いときはスクロールで見えればよい

### 7. NG ワード(`src/ranking/ng-words.ts`)

- 次の言葉を、今の一覧の英字の前に足す: `"死ね"`、`"氏ね"`、`"殺す"`、`"殺せ"`、`"糞"`、`"変態"`、`"池沼"`、`"基地外"`、`"消えろ"`
- 一覧の上のコメントを「弾く言葉。ひらがな・漢字・小文字の英字で書く。オーナーがあとから足す」に変える
- 照合は今のまま(`checkName` は NFKC で正規化してから部分一致で比べる。漢字はそのまま比べる)

### 8. NG ワードのテスト(`tests/ranking-name.test.ts`)

今のテストは残し、次の表の1行ごとに `it` を1つ足す。期待はすべて `{ ok: false, error: "ng" }`、最後の行だけ `{ ok: true, name: "変身ヒーロー" }`。

| 入力           | 確かめること               |
| -------------- | -------------------------- |
| `死ね`         | 漢字そのもの               |
| `お前死ね`     | 前に文字がある             |
| `殺すぞ`       | 後ろに文字がある           |
| `糞野郎`       | 1文字の言葉                |
| `変身ヒーロー` | 似た字を含むが NG ではない |

### 9. ページの説明文とファビコン(`index.html`、`stats.html`、`public/favicon.svg`)

`index.html` の `<title>` のあとに:

```html
<meta
  name="description"
  content="フリック入力だけで遊ぶスマホ用のタイピングゲーム。60秒のタイムアタックと、青空文庫の名作で競う「今日の耐久」。"
/>
<meta property="og:type" content="website" />
<meta property="og:site_name" content="ふりっくタイピング" />
<meta property="og:title" content="ふりっくタイピング" />
<meta
  property="og:description"
  content="フリック入力だけで遊ぶスマホ用のタイピングゲーム。60秒のタイムアタックと、青空文庫の名作で競う「今日の耐久」。"
/>
<meta property="og:locale" content="ja_JP" />
<meta name="twitter:card" content="summary" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
```

`stats.html` は同じ形で、`og:title` を「みんなの記録 | ふりっくタイピング」、説明文を「ふりっくタイピングのみんなの記録。打てた文字数の分布と平均。」にする。`link rel="icon"` も同じものを入れる。

`public/favicon.svg`(この中身のとおり):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#1d4ed8"/>
  <text x="32" y="45" font-size="38" font-weight="700" text-anchor="middle" fill="#ffffff" font-family="sans-serif">ふ</text>
</svg>
```

- ファビコンはブラウザの外で使われるので、CSS 変数ではなく色を直接書く(6 の「`#` を書かない」は CSS だけの決まり)
- `public/` は Vite がそのまま `dist/` に写すので、`vite.config.ts` は変えない

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る(`tests/about.test.ts` の5件と、`tests/ranking-name.test.ts` に足した5件を含む)
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `ls dist/favicon.svg` でファイルがある
- [ ] `grep -c "og:description" dist/index.html dist/stats.html` がどちらも 1
- [ ] `grep -n "aboutHtml" src/screens/ranking.ts src/stats-page/main.ts` が両方のファイルで1行以上出る
- [ ] 以下は Claude Code がブラウザで確かめる(実装担当は不要)
  - ランキング画面と `/stats` の下に「記録と名前について」が閉じた状態で出て、タップで開く。リンクが X を別のタブで開く
  - 名前の入力欄で「死ね」を入れると、今の NG と同じエラーが出る

## 対象外

- 運営のなりすまし(運営・公式・admin など)とローマ字の下ネタの NG ワード
- OGP の画像(`og:image`)と `og:url`
- 利用規約のページ、Cookie の同意バナー(Cookie は使っていない)
- タイトル画面への説明の追加

## 想定される落とし穴

- **`no-os-input` のテスト。** `<details>` と `<a>` は入力欄ではないが、`<input>`・`<textarea>` を足さないこと(2 のテストでも確かめる)
- **`body` の `touch-action: none`。** ランキング画面と `/stats` はすでにスクロールできるようにしてある(`:is(html, body):has(.ranking-screen)`、`html.stats`)。`<summary>` のタップもそのまま効くはず。効かない場合は止めて聞く
- **部分一致の誤爆。** NG ワードは名前の中に含まれていれば弾く。1文字の「糞」は、ほかの名前を巻き込みにくい字として選んだ。「変」「死」のような1文字は足さない
- **説明文の中の `「」`。** `content="…"` の中に `"` を入れない。`「」` はそのままでよい
