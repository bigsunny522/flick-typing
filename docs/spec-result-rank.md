# 結果画面にその回の順位を出す(ランキング 1段階目)

## 背景

オーナーの方針(2026-10-16):

- `/stats` は統計だけにする。順位の行は外す
- 結果画面で、その回のプレイが全体の中で何位かを出す。比べる相手は**全プレイ**(1人1枠にしない)
- 結果画面から集計のページへ飛べるようにする(これまでは、ゲーム画面からは `/stats` へリンクしない方針だった。それをやめる)
- 期間は **今週** と **全期間**。耐久は文章が毎日変わるので **今日** だけ
- ニックネーム付きの上位100の表は2段階目(別の仕様書)。この仕様書では作らない

## 変更対象

- `src/stats/summary.ts`: 週の始まりの関数、順位のレスポンスの型と読み取り。`rankOf`・`topPercent` を消す
- `worker/results.ts`: 保存したあとに順位を数えて返す
- `src/report.ts`: レスポンスから順位を読んで返す
- `src/main.ts`: 順位を結果画面に渡す
- `src/screens/result-rank.ts`(新規): 順位の行とリンクの HTML と、あとから順位を埋める関数
- `src/screens/result.ts`・`src/screens/endurance-result.ts`: 順位の行とリンクを置く
- `src/style.css`: 順位の行とリンクの見た目
- `src/stats-page/main.ts`: 順位の行を外す
- `tests/stats-summary.test.ts`

触らないもの: `wrangler.jsonc`、`migrations/`(テーブルは変えない)、`worker/index.ts`、`worker/stats.ts`、`src/stats/payload.ts`、`src/stats-page/chart.ts`。

## 仕様

### 1. 週の始まり(`src/stats/summary.ts`)

週は **日本時間の月曜 0:00** に始まる。D1 の `created_at` は `datetime('now')`(UTC、`YYYY-MM-DD HH:MM:SS`)なので、週の始まりを同じ形の UTC の文字列で返す。

```ts
/** nowMs を含む週(日本時間の月曜 0:00 始まり)の始まりを、UTC の "YYYY-MM-DD HH:MM:SS" で返す */
export function jstWeekStartUtc(nowMs: number): string;
```

| nowMs(UTC) | 日本時間の曜日 | 返り値 |
|---|---|---|
| `2026-10-16T03:00:00Z`(1792119600000) | 金 | `2026-10-11 15:00:00` |
| `2026-10-18T14:59:59Z`(1792335599000) | 日 | `2026-10-11 15:00:00` |
| `2026-10-18T15:00:00Z`(1792335600000) | 月 0:00 | `2026-10-18 15:00:00` |
| `2026-10-19T00:00:00Z`(1792368000000) | 月 | `2026-10-18 15:00:00` |

`Date.now()` は使わず、引数で受け取る(`src/stats/` の規約)。

### 2. 順位のレスポンス(`src/stats/summary.ts`)

```ts
export type RankResponse =
  | { kind: "timeattack"; week: number; all: number }
  | { kind: "endurance"; today: number };

/** /api/results のレスポンスの JSON を読む。形が違えば null */
export function parseRankResponse(value: unknown): RankResponse | null;
```

- 順位はすべて 1 以上の整数。そうでなければ `null`
- `kind` が `timeattack` なら `week` と `all`、`endurance` なら `today` が要る。足りなければ `null`

| value | 返り値 |
|---|---|
| `{ kind: "timeattack", week: 3, all: 12 }` | そのまま |
| `{ kind: "endurance", today: 5 }` | そのまま |
| `{ kind: "timeattack", week: 3 }` | `null` |
| `{ kind: "timeattack", week: 0, all: 12 }` | `null` |
| `{ kind: "timeattack", week: 1.5, all: 12 }` | `null` |
| `{ kind: "endurance", today: "5" }` | `null` |
| `{ kind: "other", today: 5 }` | `null` |
| `null` | `null` |

`rankLabel` はそのまま使う(100位まで `○位`、それより下は `TOP200` など)。`rankOf` と `topPercent` はどこからも使わなくなるので、関数とテストを消す。

### 3. API(`worker/results.ts`)

保存に成功したあと、順位を数えて **200** で JSON を返す(今は 204)。順位は「同じ条件で、`correct` がこの回より大きい行の数 + 1」。同じ `correct` は同じ順位。いま保存した行も数える対象に入るが、`correct` が同じなので順位は変わらない。

| 種類 | 共通の条件 | 返す順位 |
|---|---|---|
| タイムアタック | `kind = 'timeattack' AND rules_version = ? AND mode = ?` | `all`: 条件のみ / `week`: 条件 + `created_at >= jstWeekStartUtc(Date.now())` |
| 耐久 | `kind = 'endurance' AND rules_version = ? AND mode = ? AND date_key = ?`(送られてきた `dateKey`) | `today` |

- タイムアタックは1つの SQL でまとめて数える(サブクエリ2つの `SELECT`)。`.first()` で読む
- 順位を数える SQL が失敗したら、保存は済んでいるので **204** を返す(順位なし)。保存が失敗したら今と同じ 500
- バリデーションやサイズの扱いは今と同じ
- `Content-Type: application/json`。キャッシュのヘッダーは付けない

### 4. 送信(`src/report.ts`)

```ts
export function reportResult(payload: ResultPayload, debug: boolean): Promise<RankResponse | null>;
```

- `debug` または `import.meta.env.DEV` のときは送らず、`Promise.resolve(null)` を返す
- `keepalive: true` は今のまま
- 状態が 200 なら JSON を `parseRankResponse` で読み、その結果を返す。204・エラーの状態・通信の失敗・JSON の読み取り失敗は、すべて `null`(例外を外に出さない)
- 返ってきた `kind` が送った `payload.kind` と違うときも `null`

### 5. 結果画面(`src/screens/result-rank.ts` ほか)

結果の数値の下、ボタン(`result-actions`)のすぐ上に、順位の行と集計ページへのリンクを置く。タイムアタックと耐久の両方。

```
┌──────────────────────────┐
│  ミス 3   正確率 95.0%    │  ← result-grid(今のまま)
│  今週 12位・全期間 TOP200 │  ← 順位の行(届くまで隠す)
│     みんなの記録を見る ›   │  ← /stats へのリンク
│  [ もう一度 ] [タイトルへ] │
└──────────────────────────┘
```

`src/screens/result-rank.ts`:

```ts
/** 順位の行(最初は hidden)と /stats へのリンクの HTML */
export function rankSlotHtml(): string;
/** host の中の順位の行に順位を入れて表示する。行が見つからなければ何もしない */
export function fillRank(host: HTMLElement, rank: RankResponse): void;
/** 順位の行の文字列 */
export function rankText(rank: RankResponse): string;
```

- `rankSlotHtml` は `<p class="result-rank" hidden></p>` と `<p class="result-links"><a href="/stats">みんなの記録を見る ›</a></p>` を返す
- `rankText`: タイムアタックは `今週 ${rankLabel(week)}・全期間 ${rankLabel(all)}`、耐久は `今日 ${rankLabel(today)}`
- `fillRank` は `.result-rank` に `rankText` を入れて `hidden` を外す
- リンクは同じタブで開く(`target` を付けない)

`src/main.ts`:

- `reportResult(...)` の戻り値(Promise)を受け取り、結果画面を描いたあとに順位を埋める
- 順位が届く前に「もう一度」「タイトルへ」で画面が替わっていたら、何もしない。描いた直後に `root.querySelector(".result-rank")` で行を取っておき、届いた時点で `isConnected` が false なら捨てる(`fillRank` には `root` ではなく、取っておいた結果画面の `main` 要素を渡すなどして、別の画面の行を埋めないようにする)
- `null` のときは行を隠したままにする(debug・開発中・通信失敗)

### 6. 集計ページ(`src/stats-page/main.ts`)

- 順位の行(`rankLineHtml`・`stats-top`)を外す。`sectionHtml` の引数から `rank` を外す
- `rankOf`・`rankLabel` の import を外す
- 「あなたの自己ベスト」「あなたの今日の記録」の行と、グラフの `あなた` の印は残す

## 受け入れ条件

- `npx tsc --noEmit` / `npm run typecheck:worker` / `npm test` / `npm run build` / `npm run format:check` がすべて通る
- `tests/stats-summary.test.ts` に、1章と2章の表の1行ごとの `it` がある
- `tests/stats-summary.test.ts` に `rankOf`・`topPercent` のテストが残っていない。`rankLabel` のテストは残っている
- `grep -rnE "localStorage|import\.meta|Date\.now|storage" src/stats` が空
- `grep -rn "stats-top\|rankOf\|topPercent" src worker` が空
- `git diff --stat` が「変更対象」のファイルだけを含む

## 対象外

- ニックネームの登録・上位100の表・ランキングのページ(2段階目)
- 順位の推移や、自己ベストでの順位
- D1 のインデックスの追加(今の件数では要らない。件数が増えたら `(kind, rules_version, mode, correct)` を検討)

## 想定される落とし穴

- `created_at` は UTC。`>=` で比べるので、`jstWeekStartUtc` の返り値の形(`YYYY-MM-DD HH:MM:SS`、`T` も `Z` も付けない)を `datetime('now')` と完全に合わせる
- 古い版のページを開いたままの人は、レスポンスを読まない。200 に変えても困らない
- 結果画面の `innerHTML` は1本の長い文字列で組んでいる。`rankSlotHtml()` は `result-actions` の直前に差し込む(タイムアタックは `duration` の行のあと、耐久は `result-grid` の閉じタグのあと)
- 開発中(`npm run dev`)は送らないので、順位の行は出ない。これが正しい動き
