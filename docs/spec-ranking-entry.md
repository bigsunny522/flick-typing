# ランキングに載せるかを結果画面で聞く

## 背景

プレビュー版(`feature/ranking`)を見たオーナーの要望:

1. 名前を付ける場所がランキング画面にしかない。100位以内に入ったら、結果画面でポップアップを出して「ランキングに載せますか?」と聞き、そこから名前を付けてランキング画面へ移れるようにする
2. 右上の模様(`.deco`)がある画面では、テーマカラーの切り替え(`docs/spec-theme-color.md`)が使えるようにする。プレイ中の画面は今のままでよい。集計ページ(`/stats`)には模様がないので、模様と切り替えを足す
3. スタイルが効いていないところを直す

オーナーと決めたこと:

| 項目                       | 決めたこと                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| ランキングに載る記録       | **「載せる」を押した記録だけ。** 今は送った結果がすべて自動で載るが、これをやめる。押さなかった記録は載らない(集計ページの集計には今までどおり入る) |
| 今までの記録               | 載せない(`ranked = 0`)。本番の `main` にはまだランキングを出していないので、困る人はいない                                                          |
| ポップアップを出すとき     | その記録を載せると、今期(今週 / 今日)か歴代のどちらかで **100位以内** に入り、しかも **自分の載っている記録より良い** とき                          |
| 名前を付けていない人       | 「名前を付けて載せる」で名前の入力欄を開く。名前を決めたら記録を載せ、ランキング画面に移る                                                          |
| 名前を付けている人         | 「載せる」で記録を載せ、ランキング画面に移る                                                                                                        |
| ランキングの一覧           | 上位 50 人から **上位 100 人** に増やす                                                                                                             |
| プレイ画面のテーマ切り替え | 足さない                                                                                                                                            |

この仕様書は `docs/spec-ranking.md` の「結果はすべてランキングに載る」「上位 50 人」「名前を付けると…の小さな文」を置き換える。ほかの部分(名前の検査・期間・不正対策)は `docs/spec-ranking.md` のまま。

## 実装の段階

実装担当には、次の2回に分けて渡す。各段階の終わりで確認コマンドをすべて通す。

| 段階 | 内容                                                      | 主なファイル                                                               |
| ---- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| A    | 型・判定の関数・Worker・D1                                | `src/ranking/**`、`tests/**`、`worker/**`、`migrations/0003_ranked.sql`    |
| B    | 画面(ポップアップ・結果画面・名前の入力・集計ページ・CSS) | `src/screens/**`、`src/main.ts`、`src/stats-page/main.ts`、`src/style.css` |

## 変更対象

触るファイル:

- 段階A
  - `migrations/0003_ranked.sql`(新規)
  - `src/ranking/types.ts` — `ResultsResponse` を変える。`RankChance` などを足す
  - `src/ranking/offer.ts`(新規) — ポップアップを出すかの判定
  - `tests/ranking-offer.test.ts`(新規)
  - `worker/ranking.ts` — 一覧を `ranked = 1` の記録だけにする。100 人に増やす。送った記録の順位(載せたら何位か)を求める
  - `worker/results.ts` — 返す値を変える
  - `worker/entry.ts`(新規) — `POST /api/ranking/entry`
  - `worker/index.ts` — 上の経路を足す
- 段階B
  - `src/screens/rank-offer.ts`(新規) — ポップアップ
  - `src/screens/result.ts`、`src/screens/endurance-result.ts` — 順位の行・ポップアップ
  - `src/screens/name-form.ts` — 見出しを引数で変えられるようにする
  - `src/main.ts` — 結果画面から開くランキングの種目を引数で受け取る
  - `src/stats-page/main.ts` — 右上の模様と切り替え
  - `src/style.css`、`src/stats-page/stats.css`

触らないファイル:

- `src/game/**`、`src/anticheat/**`、`src/native/**`、`src/keyboard/**`、`src/stats/**`
- `src/screens/play.ts`、`src/screens/endurance.ts`(プレイ中の画面にテーマ切り替えは足さない)
- `src/report.ts`(返ってきた JSON をそのまま渡しているので、型が変わるだけで中身は変えなくてよい。型のエラーが出たときだけ直す)
- `src/theme.ts`、`src/storage.ts`
- `migrations/0001_*.sql`、`migrations/0002_*.sql`(すでに本番に入っているので変えない)
- `wrangler.jsonc`、`index.html`、`stats.html`、`package.json`

## 仕様

### 1. D1(`migrations/0003_ranked.sql`)

```sql
ALTER TABLE results ADD COLUMN ranked INTEGER NOT NULL DEFAULT 0;
```

- `ranked = 1` がランキングに載せた記録。今までの行はすべて 0 になる
- リモートへの反映は Claude Code が行う(実装担当は `--remote` を実行しない)

### 2. 型(`src/ranking/types.ts`)

```ts
/** 送った記録を載せたときの、ある期間での順位 */
export type RankChance = {
  rank: number; // 載せたら何位か(自分のほかの記録は数えない)
  improves: boolean; // 自分がその期間に載せている記録より良いか(載せていなければ true)
};

/** 今期(タイムアタックは今週、耐久はその日)と歴代 */
export type RankChances = { period: RankChance; alltime: RankChance };

/** `POST /api/results` の返す値 */
export type ResultsResponse = {
  resultId: number; // 入れた行の results.id
  chances: RankChances | null; // ランキングの対象外(flick・古いルール・ban)なら null
};

/** `POST /api/ranking/entry` に送る値 */
export type EntryRequest = { playerId: string; resultId: number };
```

- 今の `Ranks` 型はなくす(`RankChances` に置き換える)
- `RankingResponse.entries` のコメントを「上位 100 人」に直す

### 3. ポップアップを出すかの判定(`src/ranking/offer.ts`)

```ts
export const OFFER_MAX_RANK = 100;

/** ポップアップに出す期間。出さないときは [] */
export function offerPeriods(chances: RankChances | null): ("period" | "alltime")[];
```

- `period`、`alltime` の順に見て、`improves` が true で `rank <= OFFER_MAX_RANK` のものを返す
- DOM・`Date.now()`・`localStorage` を使わない(`src/ranking/` の規約)

### 4. テスト(`tests/ranking-offer.test.ts`)

表の1行ごとに `it` を1つ書く。`c(rank, improves)` は `{ rank, improves }` の略。

| 確かめること                   | 入力                                            | 期待                    |
| ------------------------------ | ----------------------------------------------- | ----------------------- |
| null                           | `null`                                          | `[]`                    |
| 両方に入る                     | `period: c(3, true)`、`alltime: c(12, true)`    | `["period", "alltime"]` |
| 今期だけ入る                   | `period: c(3, true)`、`alltime: c(150, true)`   | `["period"]`            |
| 100位ちょうど                  | `period: c(100, true)`、`alltime: c(200, true)` | `["period"]`            |
| 101位                          | `period: c(101, true)`、`alltime: c(101, true)` | `[]`                    |
| 自分の記録より良くない         | `period: c(3, false)`、`alltime: c(12, false)`  | `[]`                    |
| 歴代だけ自分の記録より良くない | `period: c(3, true)`、`alltime: c(12, false)`   | `["period"]`            |

### 5. ランキングの一覧(`worker/ranking.ts`)

- `rankedSql` の条件に `r.ranked = 1` を足す。一覧・`me` は載せた記録だけで求める
- `TOP_ENTRIES` を 100 にする
- 今の `resultRanks` は消し、6 の `resultChances` に置き換える

### 6. 送った記録の順位(`worker/ranking.ts` の `resultChances`)

```ts
export async function resultChances(
  env: Env,
  payload: ResultPayload,
  resultId: number,
  nowMs: number,
): Promise<RankChances | null>;
```

- 今の `resultRanks` と同じく、`payload.mode !== "native"` か、ルールの版が今のものでなければ `null`
- その `playerId` が `players.banned = 1` なら `null`
- 今期と歴代のそれぞれで、次の2つを求める。期間の絞り方は今の `windowFor` と同じ(耐久のその日は `payload.dateKey`)
  - **`rank`** = 1 + 「自分以外で、その期間に `ranked = 1` の記録を持つ人(ban を除く)のうち、その人の一番良い記録が送った記録以上の人の数」
  - **`improves`** = 「自分がその期間に載せている(`ranked = 1`)記録のうち、送った記録以上のものがない」
- 「以上」の比べ方は一覧の並べ方と同じ。タイムアタックは `correct` が大きいほど上、同じなら `miss` が小さいほど上。耐久は `correct` が大きいほど上、同じなら `end_ms` が小さいほど上。両方同じなら、先に入った記録(`id` が小さい)が上。送った記録は一番新しいので、**両方同じ記録は送った記録より上として数える**
  - つまり、相手の記録 `x` が送った記録 `s` 以上 ⇔ `x.correct > s.correct OR (x.correct = s.correct AND x.tiebreak <= s.tiebreak)`
- 送った記録の行(`id = resultId`)はまだ `ranked = 0` なので、どちらの集計にも入らない
- SQL の書き方は任せる。`rankedSql` の条件の組み立て(種目・mode・ルールの版・期間・ban)を使い回すこと

### 7. `POST /api/results`(`worker/results.ts`)

- 入れた行の id を `statement.run()` の `meta.last_row_id` から取る
- 200 で `{ resultId, chances }` を返す。`resultChances` が投げたら `chances: null`
- 送る本文・範囲チェック・413 / 400 / 500 は今のまま

### 8. `POST /api/ranking/entry`(`worker/entry.ts`、`worker/index.ts`)

- 本文は `EntryRequest`。512 バイトを超えたら 413
- JSON でない → 400 `{ "error": "json" }`。`playerId` が UUID の形でない(`worker/ranking.ts` の `UUID_PATTERN` と同じ)、`resultId` が正の整数でない → 400 `{ "error": "body" }`
- 次の SQL で載せる

  ```sql
  UPDATE results SET ranked = 1
  WHERE id = ?1 AND player_id = ?2 AND mode = 'native'
    AND ((kind = 'timeattack' AND rules_version = ?3)
      OR (kind = 'endurance' AND rules_version = ?4))
  ```

  `?3` は `RULES_VERSION`、`?4` は `ENDURANCE_RULES_VERSION`

- 1 行以上変わったら 200 `{ "ok": true }`。0 行なら 404 `{ "error": "result" }`(他人の記録・ない記録・対象外の記録)。DB のエラーは 500
- 同じ記録を2回載せても 200(すでに 1 の行も「変わった行」に数えられる)
- `POST` 以外は 405
- 名前の有無はサーバーでは見ない

### 9. ポップアップ(`src/screens/rank-offer.ts`)

```ts
export function openRankOffer(
  host: HTMLElement,
  options: {
    kind: "timeattack" | "endurance";
    resultId: number;
    chances: RankChances;
    periods: ("period" | "alltime")[]; // offerPeriods の結果。空なら呼ばない
    onOpenRanking: (board: RankingBoard) => void;
  },
): void;
```

`host` の上に全面のオーバーレイ(`.rank-offer`)を重ねて出す。中身(`.rank-offer-box`):

1. 見出し「ランキングに入れます」
2. `periods` の順位を1行で。期間の名前はタイムアタックが「今週」「歴代」、耐久が「今日」「歴代」。例「今週 3位 ・ 歴代 12位」、今期だけなら「今週 3位」
3. 名前の状態によって分ける(`loadName()`)
   - 未設定(`null`): 「名前を付けてランキングに載せますか?」/ ボタン「名前を付けて載せる」(`primary-button`)・「載せない」(`secondary-button`)
   - 設定済み: 「『○○』で載せますか?」(○○ は名前。`textContent` で入れる)/ ボタン「載せる」(`primary-button`)・「載せない」(`secondary-button`)
4. エラーの行(`.rank-offer-error`、最初は空)

動き:

- 「載せない」: オーバーレイを閉じる。何も送らない
- 「載せる」: ボタンを2つとも `disabled` にして `POST /api/ranking/entry` に `{ playerId: loadPlayerId(), resultId }` を送る
  - 200: オーバーレイを閉じ、`onOpenRanking(移る先)` を呼ぶ
  - それ以外・通信失敗: エラーの行に「送れませんでした。時間をおいて試してください」を出し、ボタンを戻す。閉じない
- 「名前を付けて載せる」: `openNameForm(host, null, onDone, "名前を付ける")` を開く。ポップアップは閉じずに後ろに残す
  - 名前が決まったら(`onDone`)、上の「載せる」と同じ送信をする。失敗したときは、ポップアップを名前が設定済みの表示に描き直してからエラーを出す(もう一度押すと名前は聞かずに送る)
  - 名前の入力欄で「やめる」を押したら、ポップアップに戻る
- 移る先: `periods[0]` が `"period"` ならタイムアタックは `timeattack-weekly`、耐久は `endurance-daily`。`"alltime"` なら `timeattack-alltime` / `endurance-alltime`
- 名前は必ず `textContent` で入れる。`innerHTML` に混ぜない

### 10. 結果画面(`result.ts`、`endurance-result.ts`)

- 引数の `rank: Promise<ResultsResponse | null>` はそのまま。`onRanking` を `(board: RankingBoard) => void` に変える
- 「ランキング」ボタンは今と同じ種目で開く(タイムアタックは `timeattack-weekly`、耐久は `endurance-daily`)
- 返事が来たら(今の `showRank`):
  - 画面が替わっていたら何もしない(今のまま)
  - `chances` があれば、順位の行に「今週 3位 ・ 歴代 12位」(耐久は「今日 …」)を出す。値は `chances.period.rank` と `chances.alltime.rank`。「載せたら何位か」の値だが、表示の文は今のままでよい
  - 「名前を付けるとランキングに名前が出ます」の小さな文(`.result-rank-hint`)は**なくす**(ポップアップに置き換える)
  - `offerPeriods(chances)` が空でなければ `openRankOffer` を呼ぶ
- 2画面で同じ `showRank` を書いているので、`rank-offer.ts` か新しいファイルに1つにまとめてよい(期間の名前だけ引数で渡す)

### 11. 名前の入力(`name-form.ts`)

- `openNameForm` に4つ目の引数 `title = "名前を変える"` を足し、見出しに使う。ランキング画面からの呼び出しは変えない
- `.name-form`(z-index 30)は `.rank-offer` より前に出すこと

### 12. `main.ts`

- 結果画面に渡す `onRanking` を `(board) => openRanking(board)` にする
- ランキング画面から「戻る」はタイトル(今のまま)

### 13. 集計ページの右上(`src/stats-page/main.ts`、`stats.css`)

- `shell()` の `<main>` の中、先頭に `<div class="deco" aria-hidden="true"></div>` と `<button type="button" class="theme-tap" aria-label="テーマカラーを変える"></button>` を置く(タイトル画面と同じ)
- `host.innerHTML` に入れたあと、毎回 `bindThemeTap(host)` を呼ぶ(読み込み中・エラー・モードを切り替えて描き直すとき。描き直すたびに中身が作り直されるため)
- 「ゲームへ戻る」のリンクや見出しと重ならないことを確かめる。重なる場合は止めて聞く

### 14. スタイルの直し(`src/style.css`)

iPhone の Safari は `<button>` と `<input>` に角丸や内側の影を付ける。今は `.primary-button` と `.secondary-button` だけで打ち消しているので、ランキング画面と名前の入力欄で効いていない。

| 場所                       | 今                                                                          | 直し方                                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| すべての `button`          | iPhone で角が丸くなる(ランキング画面の種目・期間の切り替え)                 | 既存の `button { … }` に `border-radius: 0;` を足す。フリックのキーなど角丸を付けているものは、クラスの指定のほうが強いので変わらない                |
| 名前の入力欄 `#name-input` | iPhone で角丸と内側の影が付く。フォーカスすると青い枠(ブラウザの既定)が出る | `appearance: none; -webkit-appearance: none; border-radius: 0;` を足す。`#name-input:focus` に `outline: none; border-color: var(--primary-strong);` |
| 名前の入力欄のボタン       | 「決める」(56px)と「やめる」(48px)の高さがそろわない                        | `.name-form-actions button { height: 48px; }`                                                                                                        |
| 耐久の結果画面             | 順位の行のすぐ下に終わった理由の行が詰まって出る                            | `.result-rank + .endurance-reason { margin-top: 12px; }`                                                                                             |

ポップアップの見た目(新規):

- `.rank-offer`: `.name-form` と同じ全面のオーバーレイ(`position: fixed; inset: 0;`、背景は `color-mix(in srgb, var(--bg) 88%, transparent)`)。`z-index: 20`
- `.rank-offer-box`: `.name-form-box` と同じ枠・背景・幅。中の要素は縦に並べ、間を 12px
- 見出し 17px 800。順位の行は `--primary-strong` の 22px 800。問いかけの文は 14px 700 `--fg`
- ボタンは2つを縦に並べる(`display: grid; gap: 10px;`)。高さは 48px にそろえる
- エラーの行は `.name-form-error` と同じ見た目。空のときは出さない
- `:is(html, body):has(.rank-offer)` も `.name-form` と同じく `touch-action: auto` に戻す
- 色は既存の CSS 変数だけを使う(`#` で始まる色を書かない)

## 受け入れ条件

段階A:

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る(`tests/ranking-offer.test.ts` の7件を含む)
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `npm run typecheck:worker` が通る
- [ ] `grep -n "ranked = 1" worker/ranking.ts` が1行以上出る
- [ ] `grep -rn "resultRanks" src worker` と `grep -rnw "Ranks" src worker` がどちらも何も出さない

段階B:

- [ ] 上の5つのコマンドが通る
- [ ] `grep -rn "result-rank-hint" src` が何も出さない
- [ ] `grep -n "theme-tap" src/stats-page/main.ts` が1行出る
- [ ] `grep -n "innerHTML" src/screens/rank-offer.ts` の行に名前(`loadName()` の値)が混ざっていない
- [ ] 以下は Claude Code が `wrangler dev` とブラウザで確かめる(実装担当は不要)
  - 結果を送ると `{ resultId, chances }` が返る。載せる前のランキングには出ず、`POST /api/ranking/entry` のあとに出る
  - 他人の `resultId` を送ると 404
  - 100位以内ならポップアップが出る。名前なし → 名前の入力 → ランキング画面に移り、自分の行がある
  - 名前ありなら「載せる」でランキング画面に移る。「載せない」で閉じる
  - 自分の載せた記録より悪い記録では、ポップアップが出ない
  - 集計ページの右上をタップすると色が変わり、ゲームに戻っても残る
  - 名前の入力欄・ランキング画面のボタンの見た目(角・高さ・フォーカスの枠)

## 対象外

- プレイ中の画面のテーマ切り替え
- 載せた記録をあとから取り消すこと
- ポップアップを閉じたあとに、同じ記録を結果画面から載せ直すこと
- 今までの記録をランキングに載せること
- 本番の D1 への migration と `main` への反映(Claude Code がオーナーに確認してから行う)

## 想定される落とし穴

- **送った記録はまだ載っていない。** `rank` を今の `rankedSql` でそのまま求めると、送った記録が `ranked = 0` なので出てこない。6 のとおり「自分以外で、送った記録以上の人の数 + 1」で数える
- **自分の古い記録を数えない。** 自分がもっと良い記録を載せていても、`rank` は送った記録の順位にする。その場合は `improves` が false になり、ポップアップは出ない
- **ban の人。** `rank` を数えるときは ban の人の記録を除く(一覧に出ないため)。送った本人が ban なら `chances: null`
- **D1 の `last_row_id`。** `statement.run()` の戻り値の `meta.last_row_id` で取る。取れなかったら(0 や undefined)500 にしてよい
- **ポップアップと名前の入力欄の重なり。** 名前の入力欄は `host`(`#app`)に足すので、ポップアップのあとに足されて手前に出る。z-index も 30 > 20 にしておく
- **結果画面を離れたあとの返事。** 「もう一度」をすぐ押すと、返事が来たときには結果画面がない。今と同じく、順位の行が DOM になければポップアップも出さない
- **`no-os-input` のテスト。** `rank-offer.ts` には `<input>` を置かない。名前の入力は既存の `name-form.ts` を使う
- **耐久のその日。** ポップアップから開く `endurance-daily` は、ランキング画面側で今日の日付になる。日付をまたいだ直後は、送った記録の日と違う日の一覧になることがあるが、今回はそのままでよい
