# 公開前の仕上げ(問い合わせ先・結果の画面の詰め・お題の行の固定・お題の入れ替え)

## 背景

一般公開の前に、オーナーから次の4つを頼まれた(2026-10-17)。

1. **タイトルに問い合わせ先がない。** 不具合の連絡先は、ランキング画面の「記録と名前について」の中にしか書いていない
2. **結果の画面の一番下の広告が見切れる。** `html, body` が `touch-action: none` なので結果の画面はスクロールできず、画面の高さに収まらない分が切れる
3. **お題が2行になると、読みの行(ティッカー)が下にずれる。** `.kanji` の高さが1行と2行で変わり、その下の `.reading-ticker-host` が押し下げられる
4. **お題が少なく、似たものが多い。** 今は60問で、「朝の空は青い。」「春の風は暖かい。」のような自然の描写が多い。最近の流行に合わせた短めの文に入れ替える

オーナーと決めたこと:

| 項目             | 決めたこと                                                                        |
| ---------------- | --------------------------------------------------------------------------------- |
| 問い合わせ先     | X の `@xyzack271`(`src/about.ts` の `CONTACT_X` をそのまま使う)                   |
| 結果の画面       | 全体を上に詰めて、広告まで1画面に収める                                           |
| お題の行         | 2行分の高さを最初から取っておき、1行のときも読みの行の位置を変えない              |
| お題             | 120問(難しさ 1・2・3 を 40 問ずつ)。読みは 10〜20 字前後(2026-10-17 にオーナーが「短すぎる」と指摘して見直し)。元データは Claude Code が `docs/` に用意した |

## 変更対象

触るファイル:

- `src/screens/title.ts` — ランキングのボタンの下に問い合わせ先を足す
- `src/data/prompts.json` — `docs/prompts-source.txt` から作り直す
- `src/style.css` — タイトルの問い合わせ先の見た目・結果の画面の余白と大きさ・`.kanji` の高さ・スクロール
- `tests/prompts.test.ts` — 問題数の数字を変える

触らないファイル:

- `docs/prompts-source.txt`(お題の元データ。中身を変えたいときは止めて聞く)
- `src/about.ts`(`CONTACT_X` を import するだけ)
- `src/game/**`(`prompts.ts` の `difficulty`・`choosePrompts` は今のまま)
- `src/data/endurance.json`、`src/screens/play.ts`、`src/screens/endurance.ts`
- `src/screens/result.ts`、`src/screens/endurance-result.ts`(CSS だけで直す)
- `worker/**`、`wrangler.jsonc`、`migrations/**`、`package.json`、`index.html`

## 仕様

### 1. タイトルの問い合わせ先(`src/screens/title.ts`)

- `import { CONTACT_X } from "../about";` を足す
- `#ranking` のボタンの直後(`.title-actions` の中の最後)に、次の HTML を足す:

```html
<p class="title-contact">
  不具合のご報告・お問い合わせは X の
  <a href="https://x.com/${CONTACT_X}" target="_blank" rel="noopener noreferrer">@${CONTACT_X}</a>
  まで
</p>
```

- 実際のコードは既存の書き方どおり、文字列を `+` でつなぐ。改行や余計な空白を文に入れない(画面では1文として続けて表示する)
- CSS(`src/style.css`、`.title-actions` の近く):

```css
.title-contact {
  margin: 14px 0 0;
  color: var(--subtle);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}
.title-contact a {
  color: var(--primary-strong);
}
```

### 2. 結果の画面を上に詰める(`src/style.css`)

タイムアタックと耐久の結果の画面(どちらも `.result-screen`)に効く。次の値に変える。

| セレクタ                     | プロパティ   | 今     | 変更後 |
| ---------------------------- | ------------ | ------ | ------ |
| `.result-screen`             | `padding-top` | `80px` | `32px` |
| `.result-screen .score`(新規) | `font-size` | `132px`(`.score` の値) | `104px` |
| `.result-screen .accent-ribbon` | `margin-top` | `24px` | `14px` |
| `.result-screen .result-grid`(新規) | `margin-top` | `30px` | `18px` |
| `.result-screen .result-grid p`(新規) | `padding` | `12px 8px` | `8px 8px` |
| `.result-screen .result-grid strong`(新規) | `font-size` | `30px` | `26px` |
| `.result-screen .duration`(新規) | `margin` | ブラウザの既定(`1em 0`) | `10px 0 14px` |
| `.ad-slot`                   | `margin-top` | `16px` | `10px` |

- `.score` / `.result-grid` / `.duration` 自体は変えず、`.result-screen` を前に付けたセレクタを足して上書きする(シェア画像など、ほかで使っていても影響しないように)
- `.score` は `font` の一括指定なので、上書きは `font-size` だけにする(太さ・行の高さ・書体はそのまま)
- 小さい画面でも広告まで見えるよう、結果の画面ではスクロールを許す。今ある `:is(html, body):has(.ranking-screen)` などの並びに `:is(html, body):has(.result-screen)` を足す(`touch-action: auto`)

### 3. お題の行の高さを固定する(`src/style.css`)

- `.kanji` に `min-height: calc(2em * 1.45);` を足す(`font-size: 23px`・`line-height: 1.45` の2行分)
- これで1行のお題でも2行分の高さを取り、読みの行(`.reading-ticker-host`)はいつも2行のときの位置に出る
- 今ある2つの `.kanji` のルールのうち、1つ目(`margin`・`font-size` などがある方)に足す

### 4. お題を入れ替える(`src/data/prompts.json`)

`docs/prompts-source.txt` から `src/data/prompts.json` を作り直す。

元データの形式:

- `#` で始まる行と空行は飛ばす
- 1行が1問。文節を `|` で区切り、各文節は `表記:読み`
- 例: `推しは:おしは|今日も:きょうも|尊い。:とうとい。`

作る JSON(今の `prompts.json` と同じ形):

```json
{
  "id": "p001",
  "text": "推しは今日も尊い。",
  "reading": "おしはきょうもとうとい。",
  "chunks": [
    ["推しは", "おしは"],
    ["今日も", "きょうも"],
    ["尊い。", "とうとい。"]
  ]
}
```

- `id` はファイルの上から順に `p001` 〜 `p120`
- `text` は各文節の表記をつないだもの、`reading` は読みをつないだもの
- 変換は使い捨ての Node.js スクリプトで行い、スクリプトはリポジトリに残さない(UTF-8 で読み書きする)
- 書き出したら `npm.cmd run format` で整える

`tests/prompts.test.ts` の数字を変える:

| テスト                                         | 今   | 変更後 |
| ---------------------------------------------- | ---- | ------ |
| `contains 60 prompts`                          | 60   | 120(名前も `contains 120 prompts`) |
| `has unique ids`                               | 60   | 120    |
| `has unique text`                              | 60   | 120    |
| `has 20 prompts in each difficulty level`      | `[20, 20, 20]` | `[40, 40, 40]`(名前も `40`) |
| `uses every prompt before repeating in 60 selections` | 60 | 120(名前も `120`) |

ほかのテストはそのまま通ること(読みが打てる文字だけか、文節から元に戻せるか、など)。

## 受け入れ条件

- [ ] `npx.cmd tsc --noEmit` が通る
- [ ] `npm.cmd test` が通る
- [ ] `npm.cmd run build` が通る
- [ ] `npm.cmd run format:check` が通る
- [ ] `src/data/prompts.json` が120問で、1問目が `推しは今日も尊い。`、120問目が `雨の日はおうちでボードゲーム。`
- [ ] (手で確認)`npm run dev` の画面を幅 390・高さ 844 で開き、タイトルの一番下に「不具合のご報告・お問い合わせは X の @xyzack271 まで」が出て、リンクが `https://x.com/xyzack271` を新しいタブで開く
- [ ] (手で確認)幅 390・高さ 844 で、タイムアタックの結果の画面の広告の置き場所(`.ad-slot`)の下端が画面の中に収まる。自己ベスト更新のリボンが出るときも同じ
- [ ] (手で確認)幅 375・高さ 667 で、結果の画面を縦にスクロールして広告まで見られる
- [ ] (手で確認)プレイ中、1行のお題と2行のお題で、読みの行の縦の位置が変わらない

## 対象外

- 耐久モードのお題(`src/data/endurance.json`)は変えない。耐久の文が3行以上になるときのずれも今回は直さない
- 「記録と名前について」(`src/about.ts`)の文面は変えない
- お題の選び方(`choosePrompts`)・難しさの決め方(`difficulty`)は変えない
- ランキング画面・集計ページの見た目

## 想定される落とし穴

- **標準キーボードのモードで画面が低いとき(`.play.is-native.is-compact`)。** `.kanji` が1行分高くなるので、`.prompt-area`(`overflow: hidden`)の中で読みの行が切れないか、幅 390・高さ 380 くらいで確かめる。切れるときは、自分で余白を削って決めずに止めて聞く
- **`touch-action` を緩める範囲。** 足すのは `.result-screen` だけ。プレイ画面(`.play`)は `touch-action: none` のままにする(スクロールやダブルタップでの拡大がフリックの邪魔になるため)
- **`.score small` は `position: absolute`。** `.score` の `font-size` を変えても「字」の位置がずれないか、見た目で確かめる
- **お題の文字コード。** 「？」「！」は全角。`prompts-source.txt` の「AIに」の `AI` は半角英字のまま `text` に入れる(読みは `えーあいに`)
- **JSON の整形。** Prettier が `src/data/prompts.json` も整えるので、`format:check` が通るまで `format` をかける
