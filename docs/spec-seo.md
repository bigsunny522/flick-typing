# 検索エンジン向けの対策(SEO)

## 背景

オーナーの要望。検索から人が来るようにしたい。

今の状態:

- `index.html` / `stats.html` には `title`・`description`・OGP がすでにある
- `robots.txt`・`sitemap.xml`・`<link rel="canonical">`・構造化データ(JSON-LD)がない
- `<body>` は `<div id="app"></div>` だけで、JavaScript が動くまで本文が1文字もない
- 同じ中身が `*.workers.dev`(本番の Worker の既定 URL と、ブランチごとのプレビュー URL)からも見えるので、正規の URL を示さないと重複扱いされうる
- タイトルが「ふりっくタイピング」だけで、検索されそうな語(フリック入力・タイピングゲーム・練習・スマホ)が入っていない

正規の URL は `https://flicktypinggame.xyzack271.com/`(OGP の `og:url` と同じ)。

## 変更対象

触るファイル:

- `index.html` — タイトル・説明文・canonical・Twitter 用タグ・JSON-LD・`<noscript>` を足す
- `stats.html` — canonical・Twitter 用タグを足す
- `public/robots.txt` — 新規
- `public/sitemap.xml` — 新規
- `tests/seo.test.ts` — 新規

触らないファイル:

- `src/**`(画面の見た目・文言は変えない)
- `worker/**`、`wrangler.jsonc`(ホスト名でヘッダーを変える対応は今回しない。対象外を参照)
- `package.json`、`AGENTS.md` / `CLAUDE.md` / `docs/**`

## 仕様

### 1. `index.html` の `<head>`

次の値にそろえる。既存のタグは値だけ書き換え、重複させない。

| タグ | 値 |
|---|---|
| `<title>` | `ふりっくタイピング｜スマホのフリック入力タイピングゲーム` |
| `meta name="description"` | `フリック入力だけで遊ぶスマホ用のタイピングゲーム。60秒のタイムアタックでフリック入力の速さを練習できます。青空文庫の名作で競う「今日の耐久」とランキングも。無料・登録不要。` |
| `og:title` | `<title>` と同じ |
| `og:description` | `description` と同じ |
| `link rel="canonical"` | `https://flicktypinggame.xyzack271.com/`(新規) |
| `meta name="twitter:title"` | `<title>` と同じ(新規) |
| `meta name="twitter:description"` | `description` と同じ(新規) |
| `meta name="twitter:image"` | `https://flicktypinggame.xyzack271.com/ogp.png`(新規) |

- 区切りの「｜」は全角の縦棒(U+FF5C)
- `og:site_name` は `ふりっくタイピング` のまま
- `canonical` は `<link rel="icon">` の直前に置く

### 2. `index.html` の JSON-LD

`<head>` の最後(フォントの `<link>` の後)に、次の内容をそのまま置く。

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "ふりっくタイピング",
    "url": "https://flicktypinggame.xyzack271.com/",
    "description": "フリック入力だけで遊ぶスマホ用のタイピングゲーム。60秒のタイムアタックでフリック入力の速さを練習できます。青空文庫の名作で競う「今日の耐久」とランキングも。無料・登録不要。",
    "applicationCategory": "GameApplication",
    "operatingSystem": "iOS, Android",
    "inLanguage": "ja",
    "image": "https://flicktypinggame.xyzack271.com/ogp.png",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "JPY" }
  }
</script>
```

- `description` は 1. の `description` と同じ文字列
- Vite のビルドで `type="application/ld+json"` の `<script>` はそのまま残る(モジュールとして扱われない)。`dist/index.html` に残っていることを受け入れ条件で確かめる

### 3. `index.html` の `<noscript>`

`<div id="app"></div>` の直後に置く。JavaScript が動かない環境と、描画前のクローラーに本文を見せるため。

```html
<noscript>
  <main>
    <h1>ふりっくタイピング</h1>
    <p>
      フリック入力だけで遊ぶスマホ用のタイピングゲームです。60秒のタイムアタックでフリック入力の速さを練習できます。青空文庫の名作で競う「今日の耐久」とランキングもあります。
    </p>
    <p>遊ぶには JavaScript を有効にしてください。</p>
  </main>
</noscript>
```

- `#app` の中には何も足さない(起動時に `innerHTML` で上書きされ、一瞬だけ別の表示が出るため)
- `<noscript>` 用の CSS は書かない

### 4. `stats.html` の `<head>`

| タグ | 値 |
|---|---|
| `link rel="canonical"` | `https://flicktypinggame.xyzack271.com/stats`(新規。`og:url` と同じ) |
| `meta name="twitter:title"` | `og:title` と同じ(新規) |
| `meta name="twitter:description"` | `og:description` と同じ(新規) |
| `meta name="twitter:image"` | `https://flicktypinggame.xyzack271.com/ogp.png`(新規) |

`<title>`・`description` は今のまま変えない。

### 5. `public/robots.txt`

```
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://flicktypinggame.xyzack271.com/sitemap.xml
```

### 6. `public/sitemap.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://flicktypinggame.xyzack271.com/</loc>
  </url>
  <url>
    <loc>https://flicktypinggame.xyzack271.com/stats</loc>
  </url>
</urlset>
```

`lastmod`・`changefreq`・`priority` は書かない(手で更新し忘れて古い値が残るのを避ける。Google は `changefreq`・`priority` を使わない)。

### 7. `tests/seo.test.ts`

`node:fs` でリポジトリのファイルを文字列として読み、次を1つの `it` で1つずつ確かめる。DOM のライブラリは足さない(正規表現や文字列検索でよい)。

| 対象 | 確かめること |
|---|---|
| `index.html` | `<title>` が 1. の値 |
| `index.html` | canonical が `https://flicktypinggame.xyzack271.com/` |
| `index.html` | `description`・`og:description`・`twitter:description` が同じ文字列 |
| `index.html` | JSON-LD を `JSON.parse` でき、`@type` が `WebApplication`、`url` が canonical と同じ |
| `index.html` | JSON-LD の `description` が `meta name="description"` と同じ |
| `index.html` | `<noscript>` の中に `<h1>` がある |
| `stats.html` | canonical が `og:url` と同じ |
| `public/robots.txt` | `Disallow: /api/` と `Sitemap: https://flicktypinggame.xyzack271.com/sitemap.xml` の行がある |
| `public/sitemap.xml` | `<loc>` が `https://flicktypinggame.xyzack271.com/` と `https://flicktypinggame.xyzack271.com/stats` の2つだけ |

## 受け入れ条件

- [ ] `AGENTS.md` の「確認コマンド」がすべて通る(`npx tsc --noEmit` / `npm test` / `npm run build` / `npm run format:check`)
- [ ] `npm run build` の後、`dist/robots.txt` と `dist/sitemap.xml` がある
- [ ] `npm run build` の後、`dist/index.html` に `application/ld+json` の `<script>` と `rel="canonical"` が残っている
- [ ] `git diff --stat` に「変更対象」以外のファイルが出ない

## 対象外

- `*.workers.dev` への `X-Robots-Tag: noindex` の付与(静的アセットは Worker を通らないため、`run_worker_first` の変更が要る。canonical で足りるかをまず見る。必要になったら別の仕様書にする)
- 本番の `*.workers.dev` URL の無効化(ダッシュボードの設定。Claude Code がオーナーに確認して行う)
- Google Search Console への登録・サイトマップの送信(オーナーの作業)
- `apple-touch-icon`・PNG の favicon(画像を作る必要がある)
- 解説ページなど、検索向けのコンテンツページの追加
- `viewport` の `user-scalable=no` の変更(ゲーム中の誤ズームを防ぐために入れている)

## 想定される落とし穴

- `og:title` などの値を書き換えると、X や LINE で共有したときのカードの文言も変わる(意図どおり)
- Prettier が `index.html` の JSON-LD を整形し直すことがある。`npm run format` の結果をそのまま受け入れてよいが、JSON として壊れていないことはテストで確かめる
- `tests/no-os-input.test.ts` が `index.html` を検査している場合、`<noscript>` の追加で落ちないか確認する(`<input>` などは足さないので通るはず)
- テストで HTML の属性を正規表現で取るとき、Prettier の改行で属性が複数行に分かれる(`content="..."` が次の行に来る)。`\s+` で改行を許す
