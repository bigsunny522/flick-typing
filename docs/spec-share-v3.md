# シェアの手直し(X の文の改行・画像を保存)

## 背景

`docs/spec-share-v2.md` をプレビューで触ったオーナーの指摘。

1. **X の投稿画面で、文の先頭に空行が入る。** `shareText` の戻り値は改行で始まっていないので、`x.com/intent/post` に `url=` を別に渡していることが原因と考える(未確認)。URL を文の最後に入れ、`url=` を渡さないようにして様子を見る
2. **「この記録、抜ける?」の前に空行がほしい。** 耐久の「今日中なら同じ文章で勝負できる!」も同じ扱いにする
3. **「画像で共有」を「画像を保存」にしたい。** 共有シートは使わず、押したら PNG をそのままダウンロードする(iPhone では「ファイル」アプリに入る。オーナー了承済み)。X のボタンは今のまま(文だけ。画像は付けない)

## 変更対象

触るファイル:

- `src/share/text.ts`
- `src/share/bind.ts`
- `src/screens/result.ts`、`src/screens/endurance-result.ts` — ボタンの文字だけ
- `tests/share-text.test.ts`

触らないファイル: 上記以外すべて(`src/share/card.ts`、`src/share/card-content.ts`、`src/style.css` も触らない)

## 仕様

### 1. 誘いの一言の前に空行(`src/share/text.ts`)

`shareText` の3行目(誘いの一言)の前に空行を1つ入れる。ほかの行は今のまま。

```
フリック入力60秒タイムアタックで123字!
今週のランキングで暫定3位(10/7時点)

この記録、抜ける?
#ふりっくタイピング
```

順位がないときも、1行目と誘いの一言の間に空行が1つ入る。

### 2. URL を文の最後に入れる(`src/share/text.ts`)

```ts
/** X の投稿画面の URL。URL は `url=` ではなく文の最後の行に入れる */
export function xIntentUrl(text: string): string;
```

- 戻り値は `https://x.com/intent/post?text=` + `encodeURIComponent(`${text}\n${SITE_URL}`)`
- `&url=` は付けない

### 3. 画像を保存(`src/share/bind.ts`、画面2つ)

- ボタンの文字を `画像で共有` から `画像を保存` にする(`id="share-image"` と `disabled` は今のまま)
- click では `navigator.canShare` / `navigator.share` を使わず、作ってある画像を `downloadFile(image)` で保存するだけにする
- 共有シート用の文の変数(`shareTextWithUrl`)と `isAbortError`、`SITE_URL` の import は使わなくなるので消す
- コメントの「画像で共有」も「画像を保存」に直す

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `tests/share-text.test.ts` の `shareText` の7件の期待を、誘いの一言の前に `\n` を1つ足した形に直す(例: `…(10/7時点)\n\nこの記録、抜ける?\n#ふりっくタイピング`、順位なし `…123字!\n\nこの記録、抜ける?\n#ふりっくタイピング`)
- [ ] `xIntentUrl` のテストの期待を `https://x.com/intent/post?text=a%20b%0A%23c%0Ahttps%3A%2F%2Fflicktypinggame.xyzack271.com%2F` にする
- [ ] `grep -rn "navigator.share\|canShare\|画像で共有" src` が何も出さない

## 対象外

- X の投稿に画像を付けること
- カード画像・ボタンの並び・色

## 想定される落とし穴

- **空行は誘いの一言の前だけ。** ハッシュタグの前には入れない
- **`downloadFile` はそのまま使う。** 今の作り(`<a download>` を一時的に足して click)を変えない
