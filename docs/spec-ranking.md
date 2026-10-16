# ランキング

## 背景

一般公開に向けて、ランキングを作る。オーナーと決めたこと:

| 項目           | 決めたこと                                                                                                                                                       |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 対象           | スマホのキーボード(`native`)だけ。フリックキーボードは画面から隠す(`docs/spec-hide-flick-mode.md`。先に実装する)                                                 |
| タイムアタック | **歴代**と**今週**(日本時間の月曜 0:00 から日曜 24:00)                                                                                                           |
| 今日の耐久     | **その日**(同じ文章で競う)と**歴代**(文章を問わず、1回で打てた文字数)                                                                                            |
| 名前           | ログインなし。端末ごとの匿名 ID(既存の `playerId`)にニックネームを付ける。不適切な言葉は弾く。消すときはオーナーが SQL で消す(管理画面は作らない)                |
| データベース   | **今のデータベースをそのまま使う。** 結果は今の `results` 表に今の形で入っているものを使う。`results` 表は変えない。ニックネームを置く `players` 表だけを足す    |
| 不正対策       | **機械による操作かどうかは、プレイ中に端末で判定する(今の仕組みのまま)。** 送る内容は今の数値のままで、サーバーは今の `validatePayload` の範囲チェックだけをする |

今の作り:

- プレイ中、`play.ts` / `endurance.ts` は入力のたびに `analyzeNative` を呼び、機械と判定したらプレイを止めてブロック画面を出す。このとき `onFinish` は呼ばれず、結果は送られない
- プレイを終えると、`src/report.ts` が結果の数値を `POST /api/results` に送り、Worker(`worker/results.ts`)が `validatePayload` で範囲を確かめて `results` 表に入れる(204 を返す)
- `results.created_at` は `datetime('now')`(UTC の `"YYYY-MM-DD HH:MM:SS"`)。耐久は `date_key`(日本時間の日付)を持つ。タイムアタックは日付の列を持たないので、週は `created_at` で絞る

## 実装の段階

実装担当には、次の3回に分けて渡す。各段階の終わりで確認コマンドをすべて通す。

| 段階 | 内容                                             | 主なファイル                                                                        |
| ---- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1    | 純粋な関数(名前・期間・API の型)とテスト         | `src/ranking/**`、`tests/**`                                                        |
| 2    | Worker と D1                                     | `worker/**`、`migrations/0002_players.sql`                                          |
| 3    | 画面(結果画面の順位・ランキング画面・名前の入力) | `src/report.ts`、`src/screens/**`、`src/main.ts`、`src/storage.ts`、`src/style.css` |

## 変更対象

触るファイル:

- 段階1
  - `src/ranking/period.ts`(新規) — 週の範囲
  - `src/ranking/name.ts`(新規) — ニックネームの正規化と検査
  - `src/ranking/ng-words.ts`(新規) — 弾く言葉の一覧
  - `src/ranking/types.ts`(新規) — API の型(端末と Worker で共有)
  - `tests/ranking-period.test.ts`、`tests/ranking-name.test.ts`(新規)
- 段階2
  - `migrations/0002_players.sql`(新規)
  - `worker/index.ts`、`worker/results.ts`
  - `worker/ranking.ts`、`worker/name.ts`(新規)
- 段階3
  - `src/report.ts`
  - `src/main.ts`
  - `src/storage.ts` — ニックネームの保存
  - `src/screens/result.ts`、`src/screens/endurance-result.ts` — 順位の表示と「ランキング」ボタン
  - `src/screens/title.ts` — 「ランキング」ボタン
  - `src/screens/ranking.ts`(新規) — ランキング画面
  - `src/screens/name-form.ts`(新規) — ニックネームの入力
  - `src/style.css`
  - `tests/no-os-input.test.ts` — `name-form.ts` を例外に足す

触らないファイル:

- `src/game/**`、`src/anticheat/**`、`src/native/**`、`src/keyboard/**`
- `src/screens/play.ts`、`src/screens/endurance.ts`(プレイ中の判定は今のまま)
- `src/stats/**`(`validatePayload` は今のまま使う)、`src/stats-page/**`、`stats.html`、`worker/stats.ts`
- `migrations/0001_results.sql`(適用済みなので書き換えない)
- `wrangler.jsonc`、`package.json`、`index.html`、`AGENTS.md` / `CLAUDE.md` / `docs/**`

## 仕様

### 1. 週の範囲(`src/ranking/period.ts`)

```ts
export type WeekRange = {
  weekKey: string; // その週の月曜日の日付(日本時間)。例 "2026-10-12"
  startUtc: string; // 月曜 0:00(日本時間)を UTC で表した "YYYY-MM-DD HH:MM:SS"。例 "2026-10-11 15:00:00"
  endUtc: string; // 次の月曜 0:00(日本時間)を同じ形で。例 "2026-10-18 15:00:00"
};
export function jstWeekRange(nowMs: number): WeekRange;
export function weekRangeLabel(weekKey: string): string; // "10/12〜10/18"
export function dayLabel(dateKey: string): string; // "2026-10-16" → "10/16"
```

- `startUtc` / `endUtc` は `results.created_at` と文字列で比べるための値(`created_at >= startUtc AND created_at < endUtc`)
- `Date.now()` を使わない(引数で受け取る)。`new Date(ms)` で曜日を求めるのはよい
- `src/stats/` と同じ規約(DOM・localStorage・`import.meta.env` を使わない。`src/storage.ts` を import しない)。Worker からも使う

### 2. ニックネーム(`src/ranking/name.ts`、`src/ranking/ng-words.ts`)

```ts
export type NameCheck =
  { ok: true; name: string } | { ok: false; error: "length" | "chars" | "ng" };
export function checkName(raw: string): NameCheck;
export const DEFAULT_NAME = "名無しさん";
```

`checkName` の手順:

1. `raw.normalize("NFKC").trim()` を名前とする
2. 文字数(コードポイント数)が 1〜10 でなければ `length`
3. 1文字ずつ見て、次のどれでもない文字があれば `chars`: 文字(`\p{L}`)、数字(`\p{N}`)、`ー`、`・`、`_`、`-`。空白・記号・絵文字は使えない
4. 照合用の文字列を作る: 英字を小文字にし、カタカナをひらがなにし(`ァ`〜`ヶ` を 0x60 引く)、`ー`・`・`・`_`・`-` を取り除く
5. 照合用の文字列に `NG_WORDS` のどれかが含まれていれば `ng`
6. どれにも当たらなければ `{ ok: true, name }`(1 の名前)

`NG_WORDS`(`ng-words.ts`): ひらがな・小文字の英字で書いた文字列の配列。最初は次を入れる。オーナーがあとから足す。

```
しね, ころす, ころせ, ちんこ, ちんぽ, まんこ, うんこ, せっくす, おっぱい, れいぷ, きちがい, がいじ, fuck, shit, sex, nigger, penis
```

### 3. API の型(`src/ranking/types.ts`)

```ts
export type RankingBoard =
  "timeattack-weekly" | "timeattack-alltime" | "endurance-daily" | "endurance-alltime";

export type Ranks = { period: number; alltime: number };

export type ResultsResponse = { ranks: Ranks | null };

export type RankingEntry = { rank: number; name: string; correct: number; mine: boolean };

export type RankingResponse = {
  board: RankingBoard;
  period: string | null; // weekly は "10/12〜10/18"、daily は "10/16"、alltime は null
  passage: { title: string; author: string } | null; // endurance-daily だけ
  entries: RankingEntry[]; // 上位 50 人
  me: { rank: number; correct: number } | null; // X-Player-Id の人。記録がなければ null
};

export function isRankingBoard(value: unknown): value is RankingBoard;
```

### 4. D1 の表(`migrations/0002_players.sql`)

```sql
CREATE TABLE IF NOT EXISTS players (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  banned INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS results_player ON results (kind, mode, rules_version, player_id);
```

`results` 表の列は変えない。今までに入っている結果も、そのままランキングに出る。

### 5. 順位の数え方(`worker/ranking.ts`)

対象にする行:

- `mode = 'native'`、`rules_version` が今の値(タイムアタックは `RULES_VERSION`、耐久は `ENDURANCE_RULES_VERSION`)
- `players.banned = 1` の人を除く
- `timeattack-weekly`: `created_at >= startUtc AND created_at < endUtc`(`jstWeekRange(Date.now())`)
- `endurance-daily`: `date_key = jstDateKey(Date.now())`
- `*-alltime`: 期間で絞らない

並べ方:

- 1人1行。その人のベストの行を使う
- タイムアタック: `correct` が多い順 → `miss` が少ない順 → `id` が小さい順(先に出した人が上)
- 耐久: `correct` が多い順 → `end_ms` が小さい順 → `id` が小さい順
- 順位は 1, 2, 3, …(同点でも上の並べ方で順番が付くので、同じ順位は出ない)

SQL はウィンドウ関数でよい(D1 は SQLite)。形の例(タイムアタックの今週):

```sql
WITH best AS (
  SELECT r.player_id, r.correct, r.miss, r.id,
         ROW_NUMBER() OVER (PARTITION BY r.player_id ORDER BY r.correct DESC, r.miss ASC, r.id ASC) AS rn
  FROM results r LEFT JOIN players p ON p.player_id = r.player_id
  WHERE r.kind = 'timeattack' AND r.mode = 'native' AND r.rules_version = ?1
    AND COALESCE(p.banned, 0) = 0
    AND r.created_at >= ?2 AND r.created_at < ?3
),
ranked AS (
  SELECT player_id, correct, miss,
         ROW_NUMBER() OVER (ORDER BY correct DESC, miss ASC, id ASC) AS rank
  FROM best WHERE rn = 1
)
SELECT ranked.rank, ranked.correct, ranked.player_id, players.name
FROM ranked LEFT JOIN players ON players.player_id = ranked.player_id
WHERE ranked.rank <= 50 OR ranked.player_id = ?4
ORDER BY ranked.rank;
```

この「対象の行・並べ方・順位」を求める関数を1つにまとめ、6 と 7 の両方で使う。

### 6. 送信を受ける(`worker/results.ts`、`POST /api/results`)

- 受け取る本文・検査・保存は今のまま(`validatePayload`)
- 保存のあと、204 ではなく 200 で `ResultsResponse` を返す
  - `ranks.period`: タイムアタックは今週、耐久は送られた `dateKey` の日の順位。`ranks.alltime`: 歴代の順位。どちらも、この人の**その期間のベスト**の順位(今回のプレイの順位ではない)
  - 次のときは `ranks: null`: `mode` が `"native"` でない、`rulesVersion` が今の値でない、`players.banned = 1`
  - 耐久の `dateKey` が前日のとき(日付をまたいで送られた)も、その日の順位を返す
- 順位を求めるところで失敗しても、保存できていれば 200 `{ ranks: null }` を返す

### 7. ランキングを返す(`worker/ranking.ts`、`GET /api/ranking`)

- クエリ `board`。`isRankingBoard` で確かめ、違えば 400 `{ "error": "board" }`
- ヘッダー `X-Player-Id`(任意): 自分の行(`mine`)と `me` を返すため。UUID の形でなければ無視する
- **`playerId` はレスポンスに一切含めない**(他人の ID が分かると、その人の名前を書き換えられるため)
- 返す値は `RankingResponse`
  - `name` は `players.name`。行がなければ `DEFAULT_NAME`(「名無しさん」)
  - `period`: `timeattack-weekly` は `weekRangeLabel(weekKey)`、`endurance-daily` は `dayLabel(今日)`、ほかは `null`
  - `passage`: `endurance-daily` だけ、今日の文章(`passageFor(今日, PASSAGES)`)の題名と作者
- `Cache-Control: no-store` を付ける

### 8. ニックネームを受ける(`worker/name.ts`、`PUT /api/name`)

- 本文: `{ playerId: string, name: string }`。本文は 1024 バイトまで(超えたら 413)
- `playerId` が UUID の形でなければ 400 `{ "error": "playerId" }`
- `checkName(name)` が失敗したら 400 `{ "error": "length" | "chars" | "ng" }`
- 成功したら `players` に upsert(`INSERT … ON CONFLICT(player_id) DO UPDATE SET name = excluded.name, updated_at = datetime('now')`)。**`banned` は書き換えない**
- 200 `{ "name": 正規化した名前 }`

### 9. ルーティング(`worker/index.ts`)

| パス           | メソッド | 処理 | 違うメソッド |
| -------------- | -------- | ---- | ------------ |
| `/api/results` | POST     | 6    | 405          |
| `/api/ranking` | GET      | 7    | 405          |
| `/api/name`    | PUT      | 8    | 405          |
| `/api/stats`   | GET      | 既存 | 405          |

### 10. 端末からの送信(`src/report.ts`、`main.ts`)

- `reportResult(payload: ResultPayload, debug: boolean): Promise<ResultsResponse | null>` に変える
  - 送る本文は今のまま。`keepalive` も今のまま
  - `debug` のとき、`import.meta.env.DEV` のとき、通信や本文の読み取りに失敗したとき、200 以外のときは `null`
- `main.ts`: 結果画面は**すぐに出す**。送信の結果を待たない。`reportResult` の `Promise` を結果画面に渡す(11)

### 11. 結果画面(`result.ts`、`endurance-result.ts`)

- 引数に `rank: Promise<ResultsResponse | null>` と `onRanking: () => void` を足す
- スコアの下に `<p class="result-rank">` を置く。最初は空
  - `ranks` が返ったら: タイムアタックは「今週 3位 ・ 歴代 12位」、耐久は「今日 3位 ・ 歴代 12位」
  - `ranks: null` または `null` が返ったら: 何も出さない
  - 端末のニックネームが未設定(`loadName()` が `null`)なら、順位の下に「名前を付けるとランキングに名前が出ます」と小さく出す(`ranks` があるときだけ)
- 「ランキング」ボタン(`secondary-button`)を、「もう一度」「タイトル」と同じ並びに足す。押すと `onRanking()`
- 結果画面を離れたあとに `Promise` が解決しても、エラーにならないようにする(要素が DOM になければ何もしない)

### 12. タイトル画面(`title.ts`)

- カードの下に「ランキング」ボタン(`secondary-button`)を足す。押すとランキング画面

### 13. ランキング画面(`src/screens/ranking.ts`)

```ts
export function renderRanking(
  host: HTMLElement,
  initialBoard: RankingBoard,
  onBack: () => void,
): void;
```

上から:

1. `.deco` とテーマ切り替えのボタン(`bindThemeTap`)。リボン `RANKING`
2. 種目の切り替え: 「タイムアタック」「今日の耐久」(2つのボタン、`aria-pressed`)
3. 期間の切り替え: タイムアタックなら「今週」「歴代」、耐久なら「今日」「歴代」。種目を切り替えたときは期間の側を保つ(「今週」⇔「今日」、「歴代」⇔「歴代」)
4. 期間の表示: `period`(例「10/12〜10/18」)。耐久の今日なら文章の題名と作者も
5. 一覧: `順位 名前 文字数`。自分の行(`mine`)は色を付ける。0 件なら「まだ記録がありません」
6. 自分の順位: `me` があれば「あなた 12位 ・ 123字」。上位 50 人に入っていても出す。なければ「あなたの記録はまだありません」
7. 名前: 「名前: ○○」(未設定なら「名無しさん」)と「名前を変える」ボタン → 14 のフォームを開く。決めたら表示を更新し、一覧も読み直す
8. 「戻る」ボタン → `onBack()`

- 切り替えるたびに `GET /api/ranking?board=…` を `X-Player-Id: loadPlayerId()` 付きで呼ぶ。読み込み中は一覧に「読み込み中…」、失敗したら「読み込めませんでした」
- 先に押した切り替えの応答があとから届いても、表示を上書きしない(最後に頼んだ `board` の応答だけを使う)
- **名前は必ず `textContent` で入れる。`innerHTML` に名前を混ぜない**
- 画面は縦にスクロールできるようにする(`/stats` と同じく、この画面だけ `touch-action` と `overflow` を戻す)
- 開発サーバー(`npm run dev`)では Worker が動かないので、一覧は「読み込めませんでした」になってよい

`main.ts`: タイトルの「ランキング」は `timeattack-weekly` で開き、戻るとタイトル。結果画面の「ランキング」は、タイムアタックなら `timeattack-weekly`、耐久なら `endurance-daily` で開き、戻るとタイトル。

### 14. ニックネームの入力(`src/screens/name-form.ts`)

```ts
export function openNameForm(
  host: HTMLElement,
  current: string | null,
  onDone: (name: string) => void,
): void;
```

- `host` の上に重ねて出す(`.name-form` の全面のオーバーレイ)
- `<input type="text" id="name-input" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">`。フォントは 16px 以上(iPhone で拡大されないため)。`user-select: text`
- 「決める」「やめる」の2つのボタン。入力欄の下に「10文字まで。記号・絵文字は使えません」
- 「決める」(または Enter): まず `checkName` を端末でもかけ、だめなら理由を出す。よければ `PUT /api/name` に送る
  - 200: `saveName(返ってきた name)`、オーバーレイを閉じて `onDone(name)`
  - 400: `error` に応じて「1〜10文字にしてください」「使えない文字が入っています」「その名前は使えません」
  - 通信失敗: 「送れませんでした。時間をおいて試してください」
- 「やめる」: 何もせずに閉じる
- 開いたら入力欄にフォーカスする

**この入力欄はゲームの入力経路ではない。** ランキング画面からしか開かず、ゲームの判定に何もつながない。`tests/no-os-input.test.ts` の「OS の入力を使ってよいファイル」に `src/screens/name-form.ts` を足す。

### 15. ニックネームの保存(`src/storage.ts`)

- キー `"flick-typing:name:v1"`。`loadName(): string | null`、`saveName(name: string): void`。既存の関数と同じく `try` / `catch` で囲む
- 端末の値は表示用。正しい値はサーバーの `players` にある

### 16. テスト

`tests/ranking-period.test.ts`:

| 確かめること         | 入力                            | 期待                                                                                           |
| -------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------- |
| 月曜 0:00(日本時間)  | 2026-10-12T00:00+09:00 の ms    | `weekKey` `"2026-10-12"`、`startUtc` `"2026-10-11 15:00:00"`、`endUtc` `"2026-10-18 15:00:00"` |
| 日曜 23:59(日本時間) | 2026-10-18T23:59:59+09:00 の ms | `weekKey` `"2026-10-12"`                                                                       |
| 次の月曜             | 2026-10-19T00:00+09:00 の ms    | `weekKey` `"2026-10-19"`                                                                       |
| UTC では日曜         | 2026-10-12T08:00+09:00 の ms    | `weekKey` `"2026-10-12"`                                                                       |
| 月をまたぐ週の表示   | `weekRangeLabel("2026-09-28")`  | `"9/28〜10/4"`                                                                                 |
| 日の表示             | `dayLabel("2026-10-06")`        | `"10/6"`                                                                                       |

`tests/ranking-name.test.ts`:

| 確かめること       | 入力                       | 期待               |
| ------------------ | -------------------------- | ------------------ |
| ふつうの名前       | `"たいぴすと"`             | ok、`"たいぴすと"` |
| 前後の空白を除く   | `"  abc  "`                | ok、`"abc"`        |
| 全角英数を半角に   | `"ＡＢＣ１"`               | ok、`"ABC1"`       |
| 空                 | `""`                       | `length`           |
| 11文字             | `"あいうえおかきくけこさ"` | `length`           |
| 記号               | `"a<b"`                    | `chars`            |
| 空白を含む         | `"a b"`                    | `chars`            |
| 絵文字             | `"abc😀"`                  | `chars`            |
| NG(ひらがな)       | `"しねしね"`               | `ng`               |
| NG(カタカナ)       | `"ウンコ"`                 | `ng`               |
| NG(大文字・区切り) | `"F-U-C-K"`                | `ng`               |

## 受け入れ条件

段階ごと:

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] 段階2・3: `npm run typecheck:worker` が通る

全体(Claude Code が確かめる。実装担当は不要):

- [ ] `npx wrangler d1 migrations apply flick-typing --local` と `npm run build && npx wrangler dev` で、次が動く
  - `POST /api/results` に結果を送ると 200 で `ranks` が返り、`GET /api/ranking` に出る
  - 同じ人が2回送ると、ランキングにはベストの1行だけが出る
  - `mode: "flick"` の結果はランキングに出ない
  - `PUT /api/name` で名前を付けるとランキングの名前が変わる。NG の名前は 400
  - `GET /api/ranking` のレスポンスに `player_id` / `playerId` が含まれない
- [ ] `grep -rn "<input" src` が `src/native/field.ts`、`src/probe/probe.ts`、`src/screens/name-form.ts` だけを出す

## 対象外

- `results` 表の変更、送る内容の変更、サーバーでのプレイの記録の再判定(機械による操作の判定はプレイ中に端末で行う)
- 管理画面(名前や記録を消すときは、オーナーが下の SQL を `npx wrangler d1 execute flick-typing --remote --command "…"` で実行する)
  - 名前を消す: `DELETE FROM players WHERE name = '…';`
  - ランキングから外す: `INSERT INTO players (player_id, name, banned) VALUES ('…', '名無しさん', 1) ON CONFLICT(player_id) DO UPDATE SET banned = 1;`
- 送信の回数制限(レート制限)。一般公開の準備として別の仕様書で扱う
- フリックキーボードのランキング
- 月間・日間(タイムアタック)のランキング
- 結果画面からのニックネーム入力(ランキング画面からだけ)

## 想定される落とし穴

- **不正の限界(オーナー了承済み)。** 端末を改造したり、API に直接数値を送ったりすれば、範囲チェックの内側の値は通る。今回はプレイ中の判定と `validatePayload` の範囲チェックまでとし、目立つ記録はオーナーが SQL で外す
- **`created_at` は UTC。** `datetime('now')` は UTC なので、日本時間の週の境目(月曜 0:00)は UTC の日曜 15:00 になる。`jstWeekRange` の `startUtc` / `endUtc` で比べる。日本時間の文字列と比べない
- **Worker から `src/` を import するときの型チェック。** `worker/tsconfig.json` は `lib: ["ES2022"]` と Workers の型だけで、DOM の型がない。`src/ranking/` に DOM や localStorage を使うファイルを混ぜない。`src/storage.ts` を import しない
- **`playerId` は他人に見せない。** ランキングの API が `player_id` を返すと、その ID で `PUT /api/name` を送って他人の名前を書き換えられる。SQL で取ってきても、レスポンスには入れない
- **名前の HTML。** 名前は利用者が入れる文字列なので、`innerHTML` に混ぜると表示が壊れたりスクリプトが動いたりする。`textContent` で入れる
- **`body` の `touch-action: none` と `user-select: none`。** 名前の入力欄とランキングの一覧のスクロールで戻す必要がある。`/stats` で同じことをしているので、そのやり方に合わせる
- **D1 のマイグレーションの本番への適用。** `0002` は、デプロイの前に `npx wrangler d1 migrations apply flick-typing --remote` で適用する必要がある(`players` 表がないと `/api/ranking` が 500 になる)。これは Claude Code がオーナーに確認してから行う(実装担当はしない)
- **今までの記録。** 今までに入っている `native` の結果も歴代ランキングに出る。名前はまだないので「名無しさん」になる
