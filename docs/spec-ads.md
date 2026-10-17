# 結果の画面の広告(Adsterra のバナー)

## 背景

オーナーの判断で、流行っているうちに少しでも収益を得られるよう、広告を早めに入れる(2026-10-17)。

オーナーと決めたこと:

| 項目     | 決めたこと                                                     |
| -------- | -------------------------------------------------------------- |
| サービス | Adsterra の Banner 320×50(Popunder・Social Bar などは使わない) |
| 置く場所 | タイムアタックと耐久の結果の画面の下だけ。プレイ中は出さない   |
| 出す環境 | 本番の URL(`flicktypinggame.xyzack271.com`)だけ                |

広告のスクリプトは `sandbox` を付けた `<iframe srcdoc>` の中で読み込み、結果の画面にだけ置く。

## 変更対象

触るファイル:

- `src/ads/allow.ts`(新規) — 広告を出してよい場所か(純粋な関数)
- `src/ads/banner.ts`(新規) — 広告の iframe を作って置く(DOM)
- `src/screens/result.ts`、`src/screens/endurance-result.ts` — 広告の置き場所を足して、`mountAd` を呼ぶ
- `src/about.ts` — 広告の説明を1行足す
- `src/style.css` — 広告の置き場所の見た目
- `tests/ads-allow.test.ts`(新規)
- `tests/about.test.ts` — 項目の数を 8 にする

触らないファイル:

- `index.html`(広告のスクリプトをページに直接入れない)
- `worker/**`、`wrangler.jsonc`、`migrations/**`、`package.json`
- `src/screens/title.ts`、`src/screens/ranking.ts`、`src/screens/play.ts`、`src/screens/endurance.ts`
- `src/game/**`、`src/anticheat/**`、`src/native/**`

## 仕様

### 1. 出してよい場所(`src/ads/allow.ts`)

```ts
/** 広告を出す本番のホスト名 */
export const AD_HOSTNAME = "flicktypinggame.xyzack271.com";

/** 広告を出してよい場所か。`hostname` は `location.hostname` */
export function isAdAllowed(hostname: string): boolean;
```

- `hostname === AD_HOSTNAME` のときだけ true。DOM・`import.meta.env` は使わない

### 2. 広告の iframe(`src/ads/banner.ts`)

```ts
/** 結果の画面の `.ad-slot` に広告を置く。出してはいけない場所なら `.ad-slot` ごと消す */
export function mountAd(host: HTMLElement): void;
```

- `host.querySelector(".ad-slot")` がなければ何もしない
- `isAdAllowed(location.hostname)` が false なら、`.ad-slot` を `remove()` して終わる
- true なら `<iframe>` を作って `.ad-slot` に入れる:
  - `title = "広告"`、`width = "320"`、`height = "50"`
  - `sandbox = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"`(`allow-top-navigation` は**付けない**。広告からページを移せないようにする。`allow-same-origin` は Adsterra のスクリプトが `document.cookie` を読むために要る。2026-10-17 に Claude Code が確認して追記)
  - `srcdoc` に下の HTML を入れる
- `srcdoc` の HTML(`atOptions` はオーナーから受け取ったコードのまま):

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: transparent;
      }
    </style>
  </head>
  <body>
    <script>
      atOptions = {
        key: "4e0928acfd10444c6d71a0612761f108",
        format: "iframe",
        height: 50,
        width: 320,
        params: {},
      };
    </script>
    <script src="https://layinghypothesis.com/4e0928acfd10444c6d71a0612761f108/invoke.js"></script>
  </body>
</html>
```

- key とスクリプトの URL は定数(`AD_KEY`、`AD_SCRIPT_URL`)にして、そこから組み立てる。1行は100文字以内にする(文字列を `+` でつなぐ)
- 結果の画面を離れると `host.innerHTML` が置き換わり、iframe も消える。消すための処理は足さない

### 3. 結果の画面(`src/screens/result.ts`、`src/screens/endurance-result.ts`)

- `.result-actions` の `</div>` の**すぐあと**に、次を入れる(耐久は「出典: 青空文庫」の前になる):

```html
<div class="ad-slot"><p class="ad-label">広告</p></div>
```

- `bindShare(...)` を呼んだあとに `mountAd(host)` を呼ぶ。ランキングから戻ったとき(`revisit`)も同じに呼ぶ

### 4. 見た目(`src/style.css`)

- `.ad-slot`: `display: flex; flex-direction: column; align-items: center; gap: 4px; margin-top: 16px;`
- `.ad-label`: `margin: 0; color: var(--muted); font-size: 10px;`
- `.ad-slot iframe`: `display: block; max-width: 100%; border: 0;`
- 色は既存の CSS 変数だけを使う

### 5. 説明の文(`src/about.ts`、`tests/about.test.ts`)

- 「画面の文字は Google Fonts から読み込んでいます」の**次**に、次の `<li>` を足す:
  `結果の画面に Adsterra の広告を表示しています。広告の配信元が Cookie などを使って、閲覧の情報を集めることがあります`
- `tests/about.test.ts` の「項目の数」の期待を 7 から 8 にする

### 6. テスト(`tests/ads-allow.test.ts`)

表の1行ごとに `it` を1つ書く。

| 入力                                                                 | 期待    |
| -------------------------------------------------------------------- | ------- |
| `flicktypinggame.xyzack271.com`                                      | `true`  |
| `bigsunny522-re-launch-checklist-flick-typing.xyzack271.workers.dev` | `false` |
| `localhost`                                                          | `false` |
| `flicktypinggame.xyzack271.com.example.com`                          | `false` |
| `""`                                                                 | `false` |

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る(`tests/ads-allow.test.ts` の5件を含む)
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `grep -rn "layinghypothesis" src index.html` が `src/ads/banner.ts` だけを出す
- [ ] `grep -n "allow-top-navigation" src/ads/banner.ts` が何も出さない
- [ ] `grep -n "mountAd" src/screens/result.ts src/screens/endurance-result.ts` が両方のファイルで出る
- [ ] 以下は Claude Code が確かめる(実装担当は不要)
  - 開発環境・プレビューの結果の画面に `.ad-slot` が残らない
  - 本番に出したあと、結果の画面に広告が出て、タップすると別のタブで開く

## 対象外

- タイトル・ランキング・プレイの画面の広告
- Popunder・Social Bar・Direct Link などのほかの形式
- 広告を消す課金

## 想定される落とし穴

- **`allow-same-origin` は付けるしかない。** 付けないと Adsterra の `invoke.js` が `document.cookie` を読んだところで SecurityError になり、広告が出ない(2026-10-17 に開発環境で確認)。付けると中のスクリプトが親の画面に触れられるようになる。広告の iframe は結果の画面にしか置かず、画面を離れると消えるので、プレイ中に広告のスクリプトは動かない。スコアの正しさはサーバー側の再計算で守る
- **広告の出る・出ないは Adsterra 側の都合。** 中が空でもエラーにしない。置き場所の高さを固定しないので、空ならラベルだけが出る
- **`.ad-slot` は入力の経路にしない。** iframe はフォーカスできる要素だが、結果の画面にしか置かず、プレイ中の画面には何も足さない
- **プレビューで広告を確かめられない。** 本番だけで出すため。プレビューでは `.ad-slot` が消えることだけを確かめる
