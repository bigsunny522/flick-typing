# ランキング

## 背景

一般公開に向けて、ランキングを作る。オーナーと決めたこと:

| 項目           | 決めたこと                                                                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 対象           | スマホのキーボード(`native`)だけ。フリックキーボードは画面から隠す(`docs/spec-hide-flick-mode.md`。先に実装する)                                                                                      |
| タイムアタック | **歴代**と**今週**(日本時間の月曜 0:00 から日曜 24:00)                                                                                                                                                |
| 今日の耐久     | **その日**(同じ文章で競う)と**歴代**(文章を問わず、1回で打てた文字数)                                                                                                                                 |
| 名前           | ログインなし。端末ごとの匿名 ID(既存の `playerId`)にニックネームを付ける。不適切な言葉は弾く。消すときはオーナーが SQL で消す(管理画面は作らない)                                                     |
| 不正対策       | 「機械で入力しているか」が判定できればよい。プレイの記録(入力のたびの記録)を送り、サーバーで**スコアを計算し直し**、**挙動分析(`analyzeNative`)をかけ直す**。機械と判定した記録はランキングに載せない |

今の作り:

- プレイを終えると、`src/report.ts` が結果の**数値だけ**を `POST /api/results` に送り、Worker(`worker/results.ts`)が D1 の `results` 表に入れている。集計ページ `/stats` がそれを使う
- 入力の記録(`NativeEditLog[]` と `NativeKeyLog[]`)は端末の中で取っているが、送っていない
- 記録からスコアを計算し直す関数(`replayNative` / `replayEndurance`)と、挙動分析(`analyzeNative`)は `src/` にあり、DOM・`Date.now()`・`Math.random()` を使わない。Worker からそのまま import できる(`worker/stats.ts` がすでに `src/` を import している)

この仕様書のあと、送る内容を**数値から記録に変える**。サーバーは記録から計算した値だけを信じる。

## 実装の段階

実装担当には、次の3回に分けて渡す。各段階の終わりで確認コマンドをすべて通す。

| 段階 | 内容                                                   | 主なファイル                                                                        |
| ---- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1    | 純粋な関数(検証・計算し直し・名前・期間)とテスト       | `src/ranking/**`、`src/stats/payload.ts`、`tests/**`                                |
| 2    | Worker と D1                                           | `worker/**`、`migrations/0002_ranking.sql`                                          |
| 3    | 画面(送信・結果画面の順位・ランキング画面・名前の入力) | `src/report.ts`、`src/screens/**`、`src/main.ts`、`src/storage.ts`、`src/style.css` |

## 変更対象

触るファイル:

- 段階1
  - `src/ranking/period.ts`(新規) — 週のキー
  - `src/ranking/name.ts`(新規) — ニックネームの正規化と検査
  - `src/ranking/ng-words.ts`(新規) — 弾く言葉の一覧
  - `src/ranking/verify.ts`(新規) — 記録からスコアを計算し直し、挙動分析をかけ直す
  - `src/stats/payload.ts` — 送る内容を記録つきの形に変える
  - `src/anticheat/log.ts` — 15 行目の `import type { PlayMode } from "../storage"` を `"../game/mode"` に変えるだけ(Worker から import するため。ほかは触らない)
  - `tests/ranking-period.test.ts`、`tests/ranking-name.test.ts`、`tests/ranking-verify.test.ts`(新規)
  - `tests/stats-payload.test.ts` — 新しい形に合わせて書き直す
- 段階2
  - `migrations/0002_ranking.sql`(新規)
  - `worker/index.ts`、`worker/results.ts`、`worker/stats.ts`
  - `worker/ranking.ts`、`worker/name.ts`(新規)
- 段階3
  - `src/report.ts`
  - `src/screens/play.ts`、`src/screens/endurance.ts` — 終了時に `keys` も渡す
  - `src/main.ts`
  - `src/storage.ts` — ニックネームの保存
  - `src/screens/result.ts`、`src/screens/endurance-result.ts` — 順位の表示と「ランキング」ボタン
  - `src/screens/title.ts` — 「ランキング」ボタン
  - `src/screens/ranking.ts`(新規) — ランキング画面
  - `src/screens/name-form.ts`(新規) — ニックネームの入力
  - `src/style.css`
  - `tests/no-os-input.test.ts` — `name-form.ts` を例外に足す

触らないファイル:

- `src/game/**`、`src/anticheat/**`(上の `log.ts` の1行を除く)、`src/native/**`、`src/keyboard/**`(既存の関数を import して使うだけ)
- `src/stats/summary.ts`、`src/stats-page/**`、`stats.html`
- `migrations/0001_results.sql`(適用済みなので書き換えない)
- `wrangler.jsonc`、`package.json`、`index.html`、`AGENTS.md` / `CLAUDE.md` / `docs/**`(必要なら Claude Code が直す)

## 仕様

### 1. 送る内容(`src/stats/payload.ts`)

送る内容を次の形に変える。**スコアの数値は送らない**(サーバーが記録から計算する)。

```ts
export type TimeAttackSubmission = {
  kind: "timeattack";
  playerId: string; // 既存と同じ UUID
  mode: "native";
  rulesVersion: number; // RULES_VERSION
  seed: number; // お題を選んだ種(0 以上 2^32 未満の整数)
  edits: NativeEditLog[];
  keys: NativeKeyLog[];
};

export type EnduranceSubmission = {
  kind: "endurance";
  playerId: string;
  mode: "native";
  rulesVersion: number; // ENDURANCE_RULES_VERSION
  dateKey: string; // 遊んだ日(日本時間)
  edits: NativeEditLog[];
  keys: NativeKeyLog[];
};

export type Submission = TimeAttackSubmission | EnduranceSubmission;

export function validateSubmission(body: unknown, todayKey: string): ValidateResult;
// ValidateResult = { ok: true; submission: Submission } | { ok: false; reason: string }
```

検査すること(どれかに当たったら `ok: false`。`reason` は下の表の左の値):

| reason         | 条件                                                               |
| -------------- | ------------------------------------------------------------------ |
| `body`         | オブジェクトでない                                                 |
| `kind`         | `"timeattack"` / `"endurance"` 以外                                |
| `playerId`     | UUID の形でない(既存の `UUID_PATTERN`)                             |
| `mode`         | `"native"` 以外(`"flick"` も弾く)                                  |
| `rulesVersion` | 1 以上の整数でない                                                 |
| `seed`         | タイムアタックで、0 以上 4294967295 以下の整数でない               |
| `dateKey`      | 耐久で、`todayKey` か前日のどちらでもない(既存と同じ)              |
| `edits`        | 配列でない、要素が 20000 個を超える、要素の形が違う                |
| `keys`         | 配列でない、要素が 20000 個を超える、要素の形が違う                |
| `order`        | `edits` の `t` が前の要素より小さくなる(同じ値は可)。`keys` も同じ |

要素の形:

- `NativeEditLog`: `t` は 0 以上の有限の数、`inputType` は 40 文字以内の文字列、`before` / `after` は 200 文字以内の文字列、`trusted` は真偽値、`viewportRatio` は 0 以上 3 以下の有限の数。ほかのプロパティは捨てる
- `NativeKeyLog`: `t` は 0 以上の有限の数、`code` は 40 文字以内の文字列、`trusted` は真偽値、`viewportRatio` は 0 以上 3 以下の有限の数。ほかのプロパティは捨てる

`rulesVersion` が今の値(`RULES_VERSION` / `ENDURANCE_RULES_VERSION`)と違うかどうかはここでは見ない(Worker が 409 を返す。7 を参照)。

既存の `validatePayload`・`TimeAttackPayload`・`EndurancePayload`・`MAX_CPS` は消す。`ResultPayload` を使っている場所は `Submission` に置き換える。

### 2. 計算し直し(`src/ranking/verify.ts`)

```ts
export type VerifiedTimeAttack = {
  kind: "timeattack";
  correct: number;
  miss: number;
  maxCombo: number;
  durationMs: number; // final.endTimeMs
  bot: boolean;
  reasons: string[];
};

export type VerifiedEndurance = {
  kind: "endurance";
  passageId: string;
  correct: number;
  end: EnduranceEnd;
  endMs: number;
  bot: boolean;
  reasons: string[];
};

export function verifySubmission(submission: Submission): VerifiedTimeAttack | VerifiedEndurance;
export function scanNative(edits: NativeEditLog[], keys: NativeKeyLog[]): BehaviorVerdict;
```

- タイムアタック: `replayNative(seed, choosePrompts(seed, PROMPTS, 200), edits)` の `final` を使う。`main.ts` の `startGame` と同じお題の選び方にすること
- 耐久: `replayEndurance(dateKey, passageFor(dateKey, PASSAGES), { mode: "native", edits })` の `final` を使う
- `bot` / `reasons` は `scanNative(edits, keys)` の結果

`scanNative` は、**プレイ中に端末が毎回やっている判定を、記録の最初から最後までやり直す**。端末はプレイ中、入力のたびに `analyzeNative(それまでの edits, それまでの keys)` を呼び、機械と判定したらプレイを止める。ただし、端末を改造すればこれは飛ばせる。サーバーでは次のようにする:

1. `edits` から、`inputForEdit(edit) === null` になる要素(値が変わらない入力など)を除く。端末はこれらを記録に入れていないので、通常は何も除かれない
2. 全体の判定: `analyzeNative(edits, keys)` を1回呼ぶ(`untrusted` と `physical-key` は数が増える一方なので、全体で見れば足りる)
3. 途中の判定: `i = 0 … edits.length - 1` のそれぞれで、`analyzeNative(edits.slice(max(0, i + 1 - WINDOW), i + 1), [])` を呼ぶ
4. 2 と 3 のどれかで `bot` なら `bot: true`。`reasons` は、最初に見つかったものの `reasons` を使う(重複は除く)

3 で直近 `WINDOW` 件だけを渡すのは、計算量を抑えるため。`analyzeNative` が見ているのは直近 `WINDOW` 件と件数(`MIN_STROKES` 以上か)だけで、`WINDOW`(20) ≥ `MIN_STROKES`(10) なので、それまでの全部を渡したときと結果が同じになる。この同値性はテストで確かめる(8 を参照)。

### 3. 週のキー(`src/ranking/period.ts`)

```ts
export function jstWeekKey(nowMs: number): string; // その週の月曜日の日付キー(日本時間)。例 "2026-10-12"
export function weekRangeLabel(weekKey: string): string; // "10/12〜10/18"
```

- 日本時間の月曜 0:00 から日曜 23:59:59.999 までが同じ週
- `Date.now()` を使わない(引数で受け取る)。`new Date(ms)` で曜日を求めるのはよい

### 4. ニックネーム(`src/ranking/name.ts`、`src/ranking/ng-words.ts`)

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

### 5. D1 の表(`migrations/0002_ranking.sql`)

```sql
ALTER TABLE results ADD COLUMN verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE results ADD COLUMN bot INTEGER NOT NULL DEFAULT 0;
ALTER TABLE results ADD COLUMN bot_reasons TEXT;
ALTER TABLE results ADD COLUMN week_key TEXT;
CREATE INDEX IF NOT EXISTS results_ranking ON results (kind, mode, rules_version, verified, bot);

CREATE TABLE IF NOT EXISTS players (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  banned INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- 今までの行は `verified = 0` になり、ランキングに出ない(数値だけで、確かめようがないため)。集計ページ `/stats` には今までどおり出す
- `week_key` はタイムアタックの行だけに入れる(受け取ったときの `jstWeekKey(Date.now())`)。耐久は既存の `date_key` を使う

### 6. 送信を受ける(`worker/results.ts`、`POST /api/results`)

1. 本文の大きさの上限を 2048 バイトから **1 MB**(1048576 バイト)に上げる。超えたら 413
2. `validateSubmission(body, jstDateKey(Date.now()))`。失敗したら 400 `{ "error": reason }`
3. `rulesVersion` が今の値と違えば 409 `{ "error": "rulesVersion" }`(古い画面のまま遊んだ人。保存しない)
4. `verifySubmission` で計算し直す
5. `results` に1行入れる。数値の列は**計算し直した値**を入れる。`verified = 1`、`bot = 0 / 1`、`bot_reasons` は `reasons.join(",")`(空なら NULL)、タイムアタックは `week_key`
6. 返す値(200):

   ```ts
   type ResultsResponse = {
     correct: number; // 計算し直した文字数
     ranks: { period: number; alltime: number } | null;
   };
   ```

   - `period` はタイムアタックなら今週、耐久ならその日(`dateKey`)の順位。`alltime` は歴代の順位。どちらも、この人の**その期間のベスト**の順位(今回のプレイの順位ではない)
   - `bot` のとき、または `players.banned = 1` のときは `ranks: null`
   - 順位の数え方は 7 と同じ

`report.ts` は今まで 204 を受けていたので、返す値が増えても壊れない。

### 7. ランキングを返す(`worker/ranking.ts`、`GET /api/ranking`)

クエリ: `board` = `timeattack-weekly` / `timeattack-alltime` / `endurance-daily` / `endurance-alltime`。それ以外は 400。

ヘッダー `X-Player-Id`(任意): 自分の順位を返すため。UUID の形でなければ無視する。**`playerId` はレスポンスに一切含めない**(他人の ID が分かると、その人の名前を書き換えられるため)。

対象にする行:

- `mode = 'native'`、`rules_version` が今の値、`verified = 1`、`bot = 0`
- `players.banned = 1` の人を除く
- `timeattack-weekly`: `week_key = jstWeekKey(Date.now())`
- `endurance-daily`: `date_key = jstDateKey(Date.now())`
- `*-alltime`: 期間で絞らない

並べ方:

- 1人1行。その人のベストの行を使う
- タイムアタック: `correct` が多い順 → `miss` が少ない順 → `id` が小さい順(先に出した人が上)
- 耐久: `correct` が多い順 → `end_ms` が小さい順 → `id` が小さい順
- 順位は 1, 2, 3, …(同点でも上の並べ方で順番が付くので、同じ順位は出ない)

SQL はウィンドウ関数でよい(D1 は SQLite なので使える)。形の例:

```sql
WITH best AS (
  SELECT r.player_id, r.correct, r.miss, r.id,
         ROW_NUMBER() OVER (PARTITION BY r.player_id ORDER BY r.correct DESC, r.miss ASC, r.id ASC) AS rn
  FROM results r LEFT JOIN players p ON p.player_id = r.player_id
  WHERE r.kind = 'timeattack' AND r.mode = 'native' AND r.rules_version = ?1
    AND r.verified = 1 AND r.bot = 0 AND COALESCE(p.banned, 0) = 0
    AND r.week_key = ?2
),
ranked AS (
  SELECT player_id, correct, miss,
         ROW_NUMBER() OVER (ORDER BY correct DESC, miss ASC, id ASC) AS rank
  FROM best WHERE rn = 1
)
SELECT ranked.rank, ranked.correct, ranked.player_id, players.name
FROM ranked LEFT JOIN players ON players.player_id = ranked.player_id
WHERE ranked.rank <= 50 OR ranked.player_id = ?3
ORDER BY ranked.rank;
```

返す値:

```ts
type RankingResponse = {
  board: "timeattack-weekly" | "timeattack-alltime" | "endurance-daily" | "endurance-alltime";
  period: string | null; // weekly は "10/12〜10/18"、daily は "10/16"、alltime は null
  passage: { title: string; author: string } | null; // endurance-daily だけ
  entries: { rank: number; name: string; correct: number; mine: boolean }[]; // 上位 50 人
  me: { rank: number; correct: number } | null; // X-Player-Id の人。記録がなければ null
};
```

- `name` は `players.name`。行がなければ `DEFAULT_NAME`(「名無しさん」)
- `Cache-Control: no-store` を付ける

6 の `ranks` も、この関数の中身(順位を求める部分)を共通にして使う。

### 8. ニックネームを受ける(`worker/name.ts`、`PUT /api/name`)

- 本文: `{ playerId: string, name: string }`。本文は 1024 バイトまで
- `playerId` が UUID の形でなければ 400 `{ "error": "playerId" }`
- `checkName(name)` が失敗したら 400 `{ "error": "length" | "chars" | "ng" }`
- 成功したら `players` に upsert(`INSERT … ON CONFLICT(player_id) DO UPDATE SET name = …, updated_at = datetime('now')`)。**`banned` は書き換えない**
- 200 `{ "name": 正規化した名前 }`

### 9. 集計ページの扱い(`worker/stats.ts`)

- 2つの `SELECT` に `AND bot = 0` を足す(機械と判定した記録を分布に入れない)
- それ以外は変えない(`verified = 0` の古い行も今までどおり入れる)

### 10. ルーティング(`worker/index.ts`)

| パス           | メソッド | 処理 | 違うメソッド |
| -------------- | -------- | ---- | ------------ |
| `/api/results` | POST     | 6    | 405          |
| `/api/ranking` | GET      | 7    | 405          |
| `/api/name`    | PUT      | 8    | 405          |
| `/api/stats`   | GET      | 既存 | 405          |

### 11. 端末からの送信(`src/report.ts`、`main.ts`、`play.ts`、`endurance.ts`)

- `play.ts` / `endurance.ts` の `onFinish` の2つ目の引数に、`native` のとき `keys: NativeKeyLog[]` を足す(`{ mode: "native"; edits; keys }`)。中身はプレイ中に集めている `keys` そのもの
- `reportResult(submission: Submission, debug: boolean): Promise<ResultsResponse | null>` に変える
  - `debug` のとき、`import.meta.env.DEV` のとき、通信や本文の読み取りに失敗したとき、200 以外のときは `null`
  - `keepalive` は外す(本文が 64KB を超えると `keepalive` の `fetch` は失敗するため)
- `main.ts`
  - タイムアタック: `{ kind: "timeattack", playerId, mode: "native", rulesVersion: RULES_VERSION, seed, edits, keys }` を送る。`seed` は `startGame` で作ったもの
  - 耐久: `{ kind: "endurance", playerId, mode: "native", rulesVersion: ENDURANCE_RULES_VERSION, dateKey, edits, keys }`
  - `payload.mode === "flick"` のとき(画面からは選べないが、型の上では残る)は送らない
  - 結果画面は**すぐに出す**。送信の結果を待たない。返ってきたら結果画面に順位を出す(12)

### 12. 結果画面(`result.ts`、`endurance-result.ts`)

- 引数に `rank: Promise<ResultsResponse | null>` と `onRanking: () => void` を足す
- スコアの下に `<p class="result-rank">` を置く。最初は空
  - `ranks` が返ったら: タイムアタックは「今週 3位 ・ 歴代 12位」、耐久は「今日 3位 ・ 歴代 12位」
  - `ranks: null` または `null` が返ったら: 何も出さない
  - 端末のニックネームが未設定なら、順位の下に「名前を付けるとランキングに名前が出ます」と小さく出す(`ranks` があるときだけ)
- 「ランキング」ボタン(`secondary-button`)を、「もう一度」「タイトル」と同じ並びに足す。押すと `onRanking()`
- 結果画面を離れたあとに `Promise` が解決しても、エラーにならないようにする(要素が DOM になければ何もしない)

### 13. タイトル画面(`title.ts`)

- カードの下に「ランキング」ボタン(`secondary-button`)を足す。押すとランキング画面

### 14. ランキング画面(`src/screens/ranking.ts`)

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
3. 期間の切り替え: タイムアタックなら「今週」「歴代」、耐久なら「今日」「歴代」
4. 期間の表示: `period`(例「10/12〜10/18」)。耐久の今日なら文章の題名と作者も
5. 一覧: `順位 名前 文字数字`。自分の行(`mine`)は色を付ける。0 件なら「まだ記録がありません」
6. 自分の順位: `me` があれば「あなた 12位 ・ 123字」。上位 50 人に入っていても出す。なければ「あなたの記録はまだありません」
7. 名前: 「名前: ○○」(未設定なら「名無しさん」)と「名前を変える」ボタン → 15 のフォームを開く
8. 「戻る」ボタン → `onBack()`

- 切り替えるたびに `GET /api/ranking?board=…` を `X-Player-Id` 付きで呼ぶ。読み込み中は一覧に「読み込み中…」、失敗したら「読み込めませんでした」
- 先に押した切り替えの応答があとから届いても、表示を上書きしない(最後に頼んだ `board` の応答だけを使う)
- **名前は必ず `textContent` で入れる。`innerHTML` に名前を混ぜない**(サーバー側で記号を弾いていても、念のため)
- 画面は縦にスクロールできるようにする(`/stats` と同じく、この画面だけ `touch-action` と `overflow` を戻す)
- 開発サーバー(`npm run dev`)では Worker が動かないので、一覧は「読み込めませんでした」になってよい

`main.ts`: タイトルの「ランキング」は `timeattack-weekly` で開き、戻るとタイトル。結果画面の「ランキング」は、タイムアタックなら `timeattack-weekly`、耐久なら `endurance-daily` で開き、戻るとタイトル。

### 15. ニックネームの入力(`src/screens/name-form.ts`)

```ts
export function openNameForm(
  host: HTMLElement,
  current: string | null,
  onDone: (name: string) => void,
): void;
```

- `host` の上に重ねて出す(`.name-form` の全面のオーバーレイ)
- `<input type="text" id="name-input" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">`。フォントは 16px 以上。`user-select: text`
- 「決める」「やめる」の2つのボタン。入力欄の下に「10文字まで。記号・絵文字は使えません」
- 「決める」(または Enter): まず `checkName` を端末でもかけ、だめなら理由を出す。よければ `PUT /api/name` に送る
  - 200: `saveName(返ってきた name)`、オーバーレイを閉じて `onDone(name)`
  - 400: `error` に応じて「1〜10文字にしてください」「使えない文字が入っています」「その名前は使えません」
  - 通信失敗: 「送れませんでした。時間をおいて試してください」
- 「やめる」: 何もせずに閉じる
- 開いたら入力欄にフォーカスする

**この入力欄はゲームの入力経路ではない。** ランキング画面からしか開かず、ゲームの判定に何もつながない。`tests/no-os-input.test.ts` の「OS の入力を使ってよいファイル」に `src/screens/name-form.ts` を足す(`AGENTS.md` の規約は Claude Code が直す)。

### 16. ニックネームの保存(`src/storage.ts`)

- キー `"flick-typing:name:v1"`。`loadName(): string | null`、`saveName(name: string): void`。既存の関数と同じく `try` / `catch` で囲む
- 端末の値は表示用。正しい値はサーバーの `players` にある

### 17. テスト

`tests/ranking-period.test.ts`:

| 確かめること         | 入力                                     | 期待           |
| -------------------- | ---------------------------------------- | -------------- |
| 月曜 0:00(日本時間)  | 2026-10-12T00:00+09:00 の ms             | `"2026-10-12"` |
| 日曜 23:59(日本時間) | 2026-10-18T23:59:59+09:00 の ms          | `"2026-10-12"` |
| 次の月曜             | 2026-10-19T00:00+09:00 の ms             | `"2026-10-19"` |
| UTC では前日         | 2026-10-12T08:00+09:00(UTC 23:00 の日曜) | `"2026-10-12"` |
| 月をまたぐ週の表示   | `weekRangeLabel("2026-09-28")`           | `"9/28〜10/4"` |

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

`tests/ranking-verify.test.ts`:

| 確かめること                                                                                                                       | 期待                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| タイムアタックで、お題の読みを正しく1文字ずつ入れた記録(間隔 150〜250ms のばらつきあり)                                            | `correct` が入れた文字数、`miss` 0、`bot: false`                  |
| 同じ記録で1文字目を違う文字にした                                                                                                  | `miss` 1                                                          |
| 間隔がすべて 20ms の記録                                                                                                           | `bot: true`、`reasons` に `too-fast`                              |
| `trusted: false` が1つ混ざった記録                                                                                                 | `bot: true`、`reasons` に `untrusted`                             |
| 途中の 20 件だけ間隔が 20ms で、ほかはふつうの記録(最後の 20 件はふつう)                                                           | `bot: true`(全体の判定だけでは見逃すものを、途中の判定で見つける) |
| 耐久で、その日の文章を正しく入れた記録                                                                                             | `correct` が入れた文字数、`passageId` がその日の文章              |
| `scanNative` と、素朴な方法(i ごとに `edits.slice(0, i + 1)` と `t <= edits[i].t` の `keys` で `analyzeNative`)の `bot` が一致する | 上の記録すべてで一致                                              |

テスト用の記録は、`before` / `after` を実際の入力欄の動き(1文字ずつ増える、お題が変わったら空から)に合わせて作る関数をテストの中に書く。

`tests/stats-payload.test.ts`: 1 の表の1行ごとに `it` を1つ、ほかに「正しいタイムアタック」「正しい耐久」「余計なプロパティは捨てる」を1つずつ。

## 受け入れ条件

段階ごと:

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] 段階2・3: `npm run typecheck:worker` が通る

全体(Claude Code が確かめる。実装担当は不要):

- [ ] `npx wrangler d1 migrations apply flick-typing --local` と `npm run build && npx wrangler dev` で、次が動く
  - `POST /api/results` に正しい記録を送ると 200 で `ranks` が返り、`GET /api/ranking` に出る
  - スコアの数値だけを書き換えた古い形の本文は 400
  - 間隔 20ms の記録は 200 で `ranks: null`、ランキングに出ない
  - `PUT /api/name` で名前を付けるとランキングの名前が変わる。NG の名前は 400
  - `GET /api/ranking` のレスポンスに `player_id` / `playerId` が含まれない
- [ ] `grep -rn "<input" src` が `src/native/field.ts`、`src/probe/probe.ts`、`src/screens/name-form.ts` だけを出す

## 対象外

- 管理画面(名前や記録を消すときは、オーナーが下の SQL を `npx wrangler d1 execute flick-typing --remote --command "…"` で実行する)
  - 名前を消す: `DELETE FROM players WHERE name = '…';`
  - ランキングから外す: `INSERT INTO players (player_id, name, banned) VALUES ('…', '名無しさん', 1) ON CONFLICT(player_id) DO UPDATE SET banned = 1;`
- お題の種をサーバーが決めること(端末が種を選べるので、簡単なお題が出るまでやり直すことはできる。オーナーと相談し、今回はやらない)
- 送信の回数制限(レート制限)。一般公開の準備として別の仕様書で扱う
- 記録(edits / keys)そのものの保存。計算した数値と判定だけを保存する
- フリックキーボードのランキング
- 月間・日間(タイムアタック)のランキング
- 結果画面からのニックネーム入力(ランキング画面からだけ)

## 想定される落とし穴

- **Worker の CPU 時間。** 無料プランは1リクエストあたり CPU 10ms。耐久の文章は読みで最大約 1400 字あり、記録は 2000 件を超えることがある。`reduce` / `reduceEndurance` は1件ごとにオブジェクトを作り直すので、重くなるおそれがある。段階1で、2000 件の記録を `verifySubmission` にかける時間を手元で測り、報告に書く(テストにはしない)。明らかに遅ければ(目安 50ms 超)、実装を止めて報告する
- **Worker から `src/` を import するときの型チェック。** `worker/tsconfig.json` は `lib: ["ES2022"]` と Workers の型だけで、DOM の型がない。`src/ranking/` と、そこから import する先(`src/anticheat/log.ts` → `env.ts` など)に DOM や localStorage を使うファイルが混ざると `npm run typecheck:worker` が落ちる。`src/ranking/` には `src/stats/` と同じ規約(`AGENTS.md`)を当てる。`log.ts` の `storage` の import は上のとおり直す。それでも `env.ts` などで落ちる場合は、実装を止めて報告する
- **お題の選び方の一致。** `main.ts` は `choosePrompts(seed, PROMPTS, 200)`。サーバーも同じ引数で呼ばないと、正しく遊んだ人のスコアが 0 になる。テストで、端末と同じ手順で作った記録の `correct` が一致することを確かめる
- **値が変わらない `input` イベント**(Gboard が送ってくる)は、端末で記録に入れていない。サーバーでも `inputForEdit` が `null` のものは判定に入れない(`CLAUDE.md` のレビュー観点)
- **`keepalive` の上限。** `fetch(…, { keepalive: true })` は本文 64KB までで、超えると失敗する。記録を送るので外す。結果画面を出したまま送るので、ページを閉じない限り届く
- **`playerId` は他人に見せない。** ランキングの API が `player_id` を返すと、その ID で `PUT /api/name` を送って他人の名前を書き換えられる。SQL で取ってきても、レスポンスには入れない
- **名前の HTML。** 名前は利用者が入れる文字列なので、`innerHTML` に混ぜると表示が壊れたりスクリプトが動いたりする。`textContent` で入れる
- **`body` の `touch-action: none` と `user-select: none`。** 名前の入力欄とランキングの一覧のスクロールで戻す必要がある。`/stats` で同じことをしているので、そのやり方に合わせる
- **D1 のマイグレーションの本番への適用。** `0002` は、デプロイの前に `npx wrangler d1 migrations apply flick-typing --remote` で適用する必要がある。これは Claude Code がオーナーに確認してから行う(実装担当はしない)
- **古い画面のまま遊んだ人。** デプロイ直後、古い `report.ts` は数値だけの本文を送る。新しい Worker は 400 を返すので、その回は記録されない。許容する
