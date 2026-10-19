# 検索エンジン向けの対策 その2(クローラーに見せる本文)

## 背景

オーナーの要望。「ふりっくタイピング」で検索したときに上位に出るようにしたい。

`docs/spec-seo.md`(タイトル・canonical・JSON-LD・sitemap)は本番に出ている。2026-10-19 に調べた結果:

- `site:flicktypinggame.xyzack271.com` ではトップページがインデックスされている(`/stats` は出ない)
- 「ふりっくタイピング」で検索すると、Google が「次の検索結果を表示しています: フリックタイピング」と**カタカナに直して**検索する。1ページ目に出ない。上位はフリック入力の練習サイト(じゃがいもタイピング、フリックチャレンジ by プロ検、タイピングチューブなど)で、どれも本文に説明文がある
- **Google のリッチリザルト テスト(スマートフォンの Googlebot で描画)のスクリーンショットは「FLICK TYPING / スマホで開いてください」だけだった。** `checkEnv` が Googlebot を `notPhone` と判定し、`renderBlocked` が `#app` を上書きしている。JavaScript が動くので `<noscript>` の本文も使われない。Google から見ると、本文が「スマホで開いてください」の1行しかないページになっている

直すこと:

1. `notPhone` のときのブロック画面を、ゲームの説明が読めるページにする。PC で開いた人にも何のサイトか伝わるようにする(Googlebot だけに別の中身を見せるのではなく、スマホ以外で開いた人全員が同じものを見る。クローキングにはならない)
2. Google が「ふりっくタイピング」をサイト名として扱えるように、JSON-LD に `WebSite` と別名(`alternateName`)を足す

## 変更対象

触るファイル:

- `src/landing.ts` — 新規。説明ページの HTML を返す純粋な関数 `landingHtml()`
- `src/screens/blocked.ts` — `notPhone` のとき `landingHtml()` を使う
- `src/style.css` — 説明ページ(`.landing`)のスタイルを足す
- `index.html` — JSON-LD を書き換える
- `tests/landing.test.ts` — 新規
- `tests/seo.test.ts` — JSON-LD の変更に合わせて直し、項目を足す

触らないファイル:

- `src/anticheat/**`(判定は変えない。Googlebot を特別扱いしない)
- `src/main.ts`(`renderBlocked(root, verdict.kind)` の呼び方は変えない)
- `src/screens/title.ts`(スマホで見るタイトル画面は変えない)
- `stats.html`、`public/**`、`worker/**`、`wrangler.jsonc`、`package.json`
- `AGENTS.md` / `CLAUDE.md` / `docs/**`

## 仕様

### 1. `src/landing.ts`

`src/about.ts` と同じ形で、固定の文だけを持つ HTML を文字列で返す。利用者の入力や日付で変わる値は入れない。

```ts
export const SITE_URL = "https://flicktypinggame.xyzack271.com/";

/** スマホ以外で開いたときの説明ページの HTML */
export function landingHtml(): string
```

返す HTML は次の構造にする(文言はこのとおり。改行と字下げは Prettier に合わせてよいが、文字列は変えない)。`CONTACT_X` は `src/about.ts` から import する。

```html
<main class="screen blocked landing">
  <p class="ribbon">FLICK TYPING</p>
  <h1>ふりっくタイピング</h1>
  <p class="landing-lead">スマホのフリック入力で遊ぶタイピングゲーム</p>
  <p class="landing-notice">スマホで開いてください</p>
  <p class="landing-url">${SITE_URL}</p>

  <section class="landing-section">
    <h2>ふりっくタイピングとは</h2>
    <p>
      ふりっくタイピング(フリックタイピング)は、スマホのフリック入力だけで遊ぶ無料のタイピングゲームです。画面に出るお題を、いつものスマホのキーボードでフリック入力します。登録もアプリのインストールもいりません。ブラウザで開けばすぐ遊べます。
    </p>
  </section>

  <section class="landing-section">
    <h2>遊べるモード</h2>
    <h3>タイムアタック</h3>
    <p>
      60秒から始まり、正解を続けると時間が増えます。時間切れまでに打てた文字数で競います。お題は毎日の暮らしで使う短い文と、いま話題のことばです。
    </p>
    <h3>今日の耐久</h3>
    <p>
      青空文庫の名作の一節を、1回ミスするまで打ち続けます。お題は毎日変わります。
    </p>
    <h3>ランキング</h3>
    <p>
      タイムアタックと今日の耐久の記録は、ニックネームを付けてランキングに載せられます。みんなの記録の分布は<a href="/stats">集計ページ</a>で見られます。
    </p>
  </section>

  <section class="landing-section">
    <h2>よくある質問</h2>
    <h3>パソコンやタブレットでは遊べますか</h3>
    <p>
      遊べません。スマホの画面でフリック入力する速さを競うゲームなので、パソコン・タブレット・外付けキーボードでは開けないようにしています。
    </p>
    <h3>トグル入力やローマ字入力でも遊べますか</h3>
    <p>
      フリック入力で打ってください。同じキーを何度も押すトグル入力は使えません。キーボードはかな入力(12キー)にしてください。
    </p>
    <h3>お金はかかりますか</h3>
    <p>無料です。会員登録もいりません。</p>
  </section>

  <p class="landing-contact">
    不具合のご報告・お問い合わせは X の
    <a href="https://x.com/${CONTACT_X}" target="_blank" rel="noopener noreferrer">@${CONTACT_X}</a>
    まで
  </p>
</main>
```

- `class="screen blocked landing"` の `blocked` は残す(`src/style.css` の横向きの注意 `#app:not(:has(.blocked))::after` が、この画面では出ないようにするため)
- 見出しは `h1` を1つだけにする

### 2. `src/screens/blocked.ts`

- `reason === "notPhone"` のときは `host.innerHTML = landingHtml()` にする。`debug` が真なら、`landingHtml()` の `<p class="landing-notice">…</p>` の直後に今と同じ `<pre class="debug">${reasons.join(", ")}</pre>` を入れる(文字列の置き換えでよい)
- `reason === "automation"` のときは今のまま(`<h1>正しく操作できませんでした</h1>` の短い画面)。不正を疑った画面に説明ページは出さない
- 関数のシグネチャは変えない

### 3. `src/style.css` の `.landing`

既存の `.blocked`(中央寄せ)を、説明ページでは上寄せ・左寄せの読み物にする。色は既存の CSS 変数(`--fg`・`--primary` など、今あるもの)だけを使い、新しい色を足さない。

- `.landing`: `justify-content: flex-start`、`align-items: stretch`、`text-align: left`、`max-width: 640px`、`margin: 0 auto`。`touch-action: pan-y` と `user-select: text`(`body` の `touch-action: none` / `user-select: none` を打ち消し、タブレットでもスクロール・選択できるようにする)
- `touch-action` は祖先との積で効くので、`.landing` だけでは足りない。既存の `:is(html, body):has(.ranking-screen), …` の並び(`touch-action: auto` / `user-select: auto` / `overscroll-behavior: auto`)に `:is(html, body):has(.landing)` を足す
- `.landing h1`: 既存の `.blocked h1` の `font-size: 22px` を上書きして `28px`
- `.landing-notice`: 太字、`var(--primary)` の枠線か背景で目立たせる。中央寄せ
- `.landing-url`: 小さめの文字、`overflow-wrap: anywhere`、中央寄せ
- `.landing-section`: 上に `28px` ほどの余白。`h2` は `18px`、`h3` は `15px`、本文は `14px`・行間 `1.8` 程度
- スマホ幅(360px)でも横スクロールが出ないこと

細かい値は上の範囲で決めてよい。

### 4. `index.html` の JSON-LD

今の `WebApplication` 1つを、`@graph` で `WebSite` と `WebApplication` の2つにする。`description` は今の `meta name="description"` と同じ文字列のまま。

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "name": "ふりっくタイピング",
        "alternateName": ["フリックタイピング", "Flick Typing"],
        "url": "https://flicktypinggame.xyzack271.com/",
        "inLanguage": "ja"
      },
      {
        "@type": "WebApplication",
        "name": "ふりっくタイピング",
        "alternateName": ["フリックタイピング", "Flick Typing"],
        "url": "https://flicktypinggame.xyzack271.com/",
        "description": "(今の description と同じ)",
        "applicationCategory": "GameApplication",
        "operatingSystem": "iOS, Android",
        "inLanguage": "ja",
        "image": "https://flicktypinggame.xyzack271.com/ogp.png",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "JPY" }
      }
    ]
  }
</script>
```

`<title>`・`description`・OGP・`<noscript>` は変えない。

### 5. `tests/landing.test.ts`

`landingHtml()` の文字列を確かめる。1つの `it` で1つの振る舞い。

| 確かめること |
|---|
| `<h1>ふりっくタイピング</h1>` を含み、`<h1` がちょうど1つ |
| 「スマホで開いてください」を含む |
| 「フリックタイピング」(カタカナ)を含む |
| `<h2>` が3つ(とは・遊べるモード・よくある質問) |
| `href="/stats"` を含む |
| `href="https://x.com/xyzack271"` と `rel="noopener noreferrer"` を含む |
| `class="screen blocked landing"` を含む |
| `<input`・`<textarea`・`<select` を含まない |

`renderBlocked` を DOM で確かめるテストは書かない(DOM のライブラリは足さない)。

### 6. `tests/seo.test.ts`

既存の JSON-LD の項目を `@graph` に合わせて直す。

| 確かめること |
|---|
| JSON-LD を `JSON.parse` でき、`@graph` に `@type` が `WebSite` と `WebApplication` の要素が1つずつある |
| `WebSite` の `name` が `ふりっくタイピング`、`alternateName` に `フリックタイピング` を含む |
| `WebSite` と `WebApplication` の `url` が canonical と同じ |
| `WebApplication` の `description` が `meta name="description"` と同じ |

それ以外の既存の項目はそのまま残す。

## 受け入れ条件

- [ ] `AGENTS.md` の「確認コマンド」がすべて通る(`npx tsc --noEmit` / `npm test` / `npm run build` / `npm run format:check`)
- [ ] `npm run build` の後、`dist/index.html` の JSON-LD に `"@graph"` と `"alternateName"` がある
- [ ] `git diff --stat` に「変更対象」以外のファイルが出ない
- [ ] (Claude Code が確認)PC の Chrome で `npm run dev` のページを開くと、説明ページが出て、マウスホイールで最後(問い合わせの行)までスクロールできる。幅 360px でも横スクロールが出ない
- [ ] (Claude Code が確認)プレビュー URL をリッチリザルト テストにかけ、スクリーンショットに説明ページが写る

## 対象外

- 判定(`checkEnv`)の変更。Googlebot の User-Agent を見て分岐することはしない
- スマホのタイトル画面への説明文の追加
- 説明ページへの QR コードの表示(依存の追加か画像の用意が要る)
- `<title>`・`description`・OGP の文言の変更
- `*.workers.dev` への `noindex`(`docs/spec-seo.md` の対象外のまま)
- Search Console への登録・サイトマップ送信・再クロールの依頼、外部からのリンク(オーナーの作業)

## 想定される落とし穴

- `.blocked` は `justify-content: center` / `align-items: center` / `text-align: center`。`.landing` で上書きしないと、長い本文が中央寄せで縦にはみ出す
- `body` に `touch-action: none` / `user-select: none` がある。`.landing` で打ち消さないと、タッチ操作の端末でスクロールできない
- `tests/no-os-input.test.ts` は `src/` 全体の文字列を検査する。説明文に `<input` などの文字列を書かない
- `landingHtml()` の中の `<a href="/stats">` は `/stats` が Worker の静的アセット(`stats.html`)で返ることに頼っている。パスを変えない
- Prettier が `index.html` の JSON-LD を整形し直す。JSON として壊れていないことはテストで確かめる
