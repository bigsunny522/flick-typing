# みんなの記録(結果の収集と集計ページ)

## 背景

ランキングや、結果に応じたランク(段位)を作りたい。ただ、基準を決めるための材料がない。今は結果を端末の localStorage に自己ベストとして残すだけで、ほかの人がどのくらいの記録を出しているのか分からない。

ゲームは Cloudflare Pages(GitHub 連携の自動デプロイ)で公開していて、友達に遊んでもらっている。そこで次の2つを作る。

1. プレイを終えるたびに、**結果の数値だけ**を匿名でサーバー(Pages Functions + D1)に送って保存する
2. 集めた記録の分布を、誰でも見られる集計ページ `/stats` に出す

オーナーと決めたこと:

- 送るのは結果の数値だけ。入力ログ(打鍵の列)は送らない。ランクの基準を決めるには分布が分かれば足りるため。サーバーでの再計算は本番のランキングを作るときに足す
- 集計ページは公開する。ただし匿名 ID や日時の付いた1プレイずつの一覧は出さない
- 集計ページへのリンクはゲームの画面に置かない。URL を知っている人だけが開く
- 集計は1人1件(端末の匿名 ID ごとの自己ベスト)で数える

## 変更対象

触るファイル:

- `src/stats/payload.ts`(新規) — 送るデータの型と、受け取ったデータのチェック(純粋な関数)
- `src/stats/summary.ts`(新規) — 自己ベストの集計・分布・上位◯%の計算と、日本時間の日付キー(純粋な関数)
- `src/report.ts`(新規) — プレイ結果をサーバーへ送る(ブラウザ側)
- `src/game/mode.ts`(新規) — `PlayMode` 型だけを置く(`src/storage.ts` から移す)
- `src/storage.ts` — 端末の匿名 ID の読み書きを足す。`PlayMode` は `src/game/mode.ts` から再 export する(`export type { PlayMode } from "./game/mode"`。既存の import 元を変えずに済ませるため)
- `src/main.ts` — `onFinish` で結果を送る。`todayKey` を `src/stats/summary.ts` の関数に置き換える
- `stats.html`(新規) — 集計ページの HTML
- `src/stats-page/main.ts`(新規) — 集計ページの描画
- `src/stats-page/stats.css`(新規) — 集計ページのスタイル
- `vite.config.ts`(新規) — `stats.html` もビルドに含める
- `functions/api/results.ts`(新規) — `POST /api/results`
- `functions/api/stats.ts`(新規) — `GET /api/stats`
- `functions/tsconfig.json`(新規) — `functions/` の型チェック用
- `migrations/0001_results.sql`(新規) — D1 のテーブル
- `tests/stats-payload.test.ts`・`tests/stats-summary.test.ts`(新規)
- `package.json` — `format` / `format:check` の対象に `stats.html functions` を足す。`typecheck:functions` スクリプトを足す

触らないファイル:

- `src/game/**`(新規の `mode.ts` を除く。`RULES` と `RULES_VERSION` は読むだけ。集計のための定数を `rules.ts` に混ぜない)
- `src/anticheat/**`、`src/keyboard/**`、`src/native/**`、`src/data/**`、`src/probe/**`、`src/debug/**`
- `src/screens/**`(結果画面・タイトル画面にリンクを置かない)
- `src/style.css`(集計ページは `stats.css` で上書きする)
- `index.html`、`tsconfig.json`
- `AGENTS.md` / `CLAUDE.md` / `docs/**`(Claude Code が直す)
- `package.json` の依存(`@cloudflare/workers-types` は Claude Code が追加済み)

## 仕様

### 1. 送るデータ(`src/stats/payload.ts`)

```ts
import type { PlayMode } from "../game/mode";
import type { EnduranceEnd } from "../game/endurance";

export type TimeAttackPayload = {
  kind: "timeattack";
  playerId: string;
  mode: PlayMode;
  rulesVersion: number; // RULES_VERSION
  correct: number;
  miss: number;
  maxCombo: number;
  durationMs: number; // final.endTimeMs(ボーナス込みのプレイ時間)
};

export type EndurancePayload = {
  kind: "endurance";
  playerId: string;
  mode: PlayMode;
  rulesVersion: number; // ENDURANCE_RULES_VERSION
  dateKey: string; // "2026-10-16"(日本時間)
  passageId: string;
  correct: number;
  end: EnduranceEnd;
  endMs: number; // 終わった時刻(開始からの ms)
};

export type ResultPayload = TimeAttackPayload | EndurancePayload;

export type ValidateResult = { ok: true; payload: ResultPayload } | { ok: false; reason: string };

export function validatePayload(body: unknown, todayKey: string): ValidateResult;
```

`PlayMode` は `src/game/mode.ts` から import する。`src/storage.ts` からは型だけでも import しない。`import type` でも `functions/` の型チェックの対象に `storage.ts` が入り、Workers の型には `localStorage` がないため `Cannot find name` で落ちる(実装中に判明)。`functions/` 側に `localStorage` の型宣言を足したり、`lib` に `DOM` を足したりして回避しない。

#### チェックの内容

`validatePayload` は次をすべて満たすときだけ `ok: true` を返す。満たさないときは `ok: false` と、どの項目で落ちたかを表す短い英語の `reason`(例 `"correct"`)を返す。数値はすべて「有限の整数」であることも確かめる(`Number.isInteger`)。

共通:

| 項目           | 条件                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `body`         | オブジェクト                                                                                   |
| `kind`         | `"timeattack"` か `"endurance"`                                                                |
| `playerId`     | `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/`(`crypto.randomUUID()` の形) |
| `mode`         | `"flick"` か `"native"`                                                                        |
| `rulesVersion` | 1 以上の整数(今のバージョンと違っても受け取る。集計で今のバージョンだけに絞る)                 |

タイムアタック:

| 項目         | 条件                                                              |
| ------------ | ----------------------------------------------------------------- |
| `durationMs` | `RULES.baseTimeMs` 以上、`RULES.baseTimeMs + correct * 1000` 以下 |
| `correct`    | 0 以上、`durationMs / 1000 * MAX_CPS` 以下                        |
| `miss`       | 0 以上、10000 以下                                                |
| `maxCombo`   | 0 以上、`correct` 以下                                            |

耐久:

| 項目        | 条件                                                                               |
| ----------- | ---------------------------------------------------------------------------------- |
| `dateKey`   | `todayKey` か、その前日(日付の変わり目をまたいだプレイを受け取るため)              |
| `passageId` | `passageFor(dateKey, PASSAGES).id` と同じ                                          |
| `end`       | `"miss"`・`"timeout"`・`"complete"` のどれか                                       |
| `correct`   | 0 以上、その文章の読みの合計文字数以下。`end` が `"complete"` なら合計文字数と同じ |
| `endMs`     | 0 以上、`correct` が 1 以上なら `correct <= endMs / 1000 * MAX_CPS`                |

- `MAX_CPS = 15`(1秒あたりの文字数の上限)は `payload.ts` に定数として置く
- 読みの合計文字数は `src/main.ts` と同じく `[...prompt.reading].length` の合計で数える(同じ計算を `summary.ts` に `totalReading(passage)` として置き、`main.ts` もそれを使う)
- `ok: true` のときの `payload` には、上の項目だけを詰め直したオブジェクトを返す(余計なキーを保存しないため)

### 2. 集計(`src/stats/summary.ts`)

```ts
/** 日本時間の日付キー("2026-10-16")。src/main.ts の todayKey と同じ計算 */
export function jstDateKey(nowMs: number): string;

/** 前日の日付キー */
export function previousDateKey(dateKey: string): string;

export function totalReading(passage: Passage): number;

export type TimeAttackRow = { playerId: string; correct: number; miss: number; durationMs: number };
export type TimeAttackBest = { correct: number; accuracy: number; cps: number };
export type ModeSummary<T> = { players: number; plays: number; bests: T[] };

/** 匿名 ID ごとの自己ベスト。bests は correct の大きい順 */
export function summarizeTimeAttack(rows: TimeAttackRow[]): ModeSummary<TimeAttackBest>;

export type EnduranceRow = { playerId: string; correct: number };
/** 匿名 ID ごとの最高 correct。bests は大きい順 */
export function summarizeEndurance(rows: EnduranceRow[]): ModeSummary<number>;

export type Bin = { from: number; to: number; count: number };
export function histogram(values: number[], width: number, upper?: number): Bin[];

/** 自分の値が上位何%か。values が空なら null */
export function topPercent(values: number[], mine: number): number | null;
```

- 自己ベストの決め方(タイムアタック):`correct` が最大のプレイ。同じなら `miss` が少ないプレイ
- `accuracy = correct / (correct + miss)`(`correct + miss` が 0 なら 0)。`cps = correct / (durationMs / 1000)`。`src/main.ts` の計算と同じ
- `players` は匿名 ID の数、`plays` は行の数
- `histogram`:
  - 区間は `[from, to)` で、`from = i * width`、`to = (i + 1) * width`。0 から始める
  - `upper` を渡したときは区間の数を `Math.ceil(upper / width)` に固定し、`upper` 以上の値は最後の区間に入れる(正確率 1.0 を最後の区間に入れるため)
  - `upper` がないときは、最大値が入る区間までを作る。途中の空の区間も `count: 0` で返す
  - `values` が空なら空の配列
- `topPercent`:`Math.ceil(100 * (mine より大きい値の数 + 1) / values.length)` を 1〜100 に収める
- 浮動小数の区間の境目で誤差が出ないよう、`Math.floor(value / width)` で区間を決める。テストは `width` が 10・0.05・0.5 のときの境目の値で確かめる

### 3. 端末の匿名 ID(`src/storage.ts`)

```ts
export function loadPlayerId(): string;
```

- キーは `"flick-typing:player:v1"`
- 保存されていて形が正しければそれを返す。なければ `crypto.randomUUID()` で作って保存し、それを返す
- localStorage が使えないときは、作った ID をそのまま返す(保存はしない)。モジュール内の変数に覚えておき、同じページを開いている間は同じ ID を返す

### 4. 送信(`src/report.ts`)

```ts
export function reportResult(payload: ResultPayload, debug: boolean): void;
```

- 次のときは何もしない
  - `debug` が `true`
  - `import.meta.env.DEV` が `true`(`npm run dev` での開発中)
- それ以外は `fetch("/api/results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), keepalive: true })` を呼ぶ
- 結果を待たない(`await` しない)。失敗は `.catch(() => {})` で捨てる。再送しない。画面にも何も出さない

`src/main.ts` の `onFinish` から呼ぶ:

- タイムアタック(`startGame`):`saveBest` の判定のあとで `reportResult({ kind: "timeattack", playerId: loadPlayerId(), mode, rulesVersion: RULES_VERSION, correct, miss, maxCombo, durationMs: final.endTimeMs }, debug)`
- 耐久(`startEnduranceRound`):`reportResult({ kind: "endurance", playerId: loadPlayerId(), mode, rulesVersion: ENDURANCE_RULES_VERSION, dateKey, passageId: passage.id, correct: final.correct, end: final.end ?? "complete", endMs: final.endMs ?? 0 }, debug)`
- 途中のリトライ(`onRetry`)と、ブロック画面になったとき(`onBlocked`)は送らない。`onFinish` だけで送るので、今の作りのままで満たせる
- `src/main.ts` の `todayKey()` は `jstDateKey(Date.now())` に置き換える(計算を1か所にするため)

### 5. D1 のテーブル(`migrations/0001_results.sql`)

```sql
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  player_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  mode TEXT NOT NULL,
  rules_version INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  miss INTEGER,
  max_combo INTEGER,
  duration_ms INTEGER,
  date_key TEXT,
  passage_id TEXT,
  end_reason TEXT,
  end_ms INTEGER
);
CREATE INDEX IF NOT EXISTS results_kind_version ON results (kind, rules_version, mode);
CREATE INDEX IF NOT EXISTS results_endurance_day ON results (kind, date_key, mode);
```

使わない列には `NULL` を入れる(タイムアタックの `date_key` など)。

### 6. API(`functions/api/*.ts`)

Pages Functions の書き方(`export const onRequestPost: PagesFunction<Env>` など)で書く。D1 のバインディング名は `DB`。

```ts
type Env = { DB: D1Database };
```

判定と集計は `src/stats/` の関数を呼ぶだけにし、`functions/` 側には SQL と HTTP の受け渡しだけを書く。

#### `POST /api/results`(`functions/api/results.ts`)

1. 本文が 2048 バイトを超えたら `413`
2. JSON として読めなければ `400`
3. `validatePayload(body, jstDateKey(Date.now()))` が `ok: false` なら `400`。本文は `{ "error": reason }`
4. `ok: true` なら1行 `INSERT` して `204`。SQL は `prepare(...).bind(...)` で値を渡す(文字列をつなげて SQL を作らない)
5. D1 がエラーを返したら `500`(本文に詳細を出さない)

`POST` 以外は Pages Functions の既定どおり `405` になる(`onRequestPost` だけを export する)。

#### `GET /api/stats`(`functions/api/stats.ts`)

返す形:

```ts
type StatsResponse = {
  timeattack: {
    rulesVersion: number;
    flick: ModeSummary<TimeAttackBest>;
    native: ModeSummary<TimeAttackBest>;
  };
  endurance: {
    rulesVersion: number;
    dateKey: string;
    passageId: string;
    totalReading: number;
    flick: ModeSummary<number>;
    native: ModeSummary<number>;
  };
};
```

この型は `src/stats/summary.ts` に置き、集計ページと共有する。

- タイムアタック:`kind = 'timeattack' AND rules_version = RULES_VERSION` の行を、モードごとに `summarizeTimeAttack` にかける
- 耐久:`kind = 'endurance' AND rules_version = ENDURANCE_RULES_VERSION AND date_key = 今日(jstDateKey(Date.now()))` の行を、モードごとに `summarizeEndurance` にかける
- `passageId` と `totalReading` は `passageFor(dateKey, PASSAGES)` から出す
- ヘッダーに `Cache-Control: public, max-age=60` を付ける
- 匿名 ID・日時・行の ID は返さない(`bests` は値だけ)

### 7. 集計ページ(`stats.html`・`src/stats-page/`)

`/stats` で開く(Cloudflare Pages は `stats.html` を `/stats` で配信する)。`index.html` と同じフォントの読み込みと viewport の指定をし、`<html lang="ja" class="stats">`、`<title>みんなの記録 | ふりっくタイピング</title>` にする。

`src/stats-page/main.ts` は `../style.css` と `./stats.css` を読み込み、`applyTheme(parseTheme(loadTheme()))` でゲームと同じ色にする。`stats.css` では `html.stats` の下で `touch-action` と `user-select` を元に戻し、縦にスクロールできるようにする。

画面の構成(上から):

```
┌──────────────────────────────┐
│ みんなの記録                  │
│ [ フリック | 標準キーボード ] │  ← 切り替え。初期値は loadMode()
│                               │
│ タイムアタック                │
│ 12人・58プレイ                │
│ あなたの自己ベスト 143文字    │
│ 上位 25%                      │
│ 正解数        ▇▇▇▇ 3          │  ← 区間ごとの横棒。自分の区間を強調
│ 正確率        ...             │
│ 打鍵速度      ...             │
│                               │
│ 耐久(今日の文章: 作品名)      │
│ 8人・20プレイ                 │
│ あなたの今日の記録 412文字    │
│ 上位 38%                      │
│ 進んだ割合    ...             │
│                               │
│ ゲームへ戻る                  │  ← "/" へのリンク
└──────────────────────────────┘
```

| 表示                       | 中身                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| 人数・プレイ数             | `players`・`plays`                                                                        |
| 自己ベスト(タイムアタック) | `loadBest(mode)?.correct`。ないときは「まだ記録がありません」とし、上位◯%は出さない       |
| 上位◯%(タイムアタック)     | `topPercent(bests の correct の列, 自己ベスト)`                                           |
| 正解数の分布               | `histogram(correct の列, 10)`                                                             |
| 正確率の分布               | `histogram(accuracy の列, 0.05, 1)`。ラベルは `%` で表示                                  |
| 打鍵速度の分布             | `histogram(cps の列, 0.5)`。ラベルは「文字/秒」                                           |
| 今日の記録(耐久)           | `loadEnduranceBest(mode, endurance.dateKey)?.correct`。ないときは「まだ記録がありません」 |
| 上位◯%(耐久)               | `topPercent(bests, 今日の記録)`                                                           |
| 進んだ割合の分布           | `bests` を `correct / totalReading` にして `histogram(列, 0.1, 1)`。ラベルは `%`          |
| 今日の文章の作品名         | `PASSAGES` から `passageId` で探した `title`                                              |

- 横棒の長さは、その分布でいちばん多い区間を 100% として比べる。棒の横に人数を出す
- 自己ベストが入る区間の棒は `--primary-strong` で塗る。ほかは `--primary`
- `players` が 0 のモードは、分布の代わりに「まだ記録がありません」と出す
- 読み込み中は「読み込み中…」、`/api/stats` の取得に失敗したら「記録を読み込めませんでした」と出す(`npm run dev` では API がないので、こちらが出るのが正しい)
- 切り替えボタンを押したら、取得し直さずに描き直す。切り替えた値は保存しない(ゲームのモードを書き換えないため)
- 入力欄(`<input>` など)は置かない。押せるのは切り替えボタンとリンクだけ
- グラフのライブラリは使わない。`<div>` の幅で棒を描く

### 8. ビルド(`vite.config.ts`)

`index.html` と `stats.html` の両方を入口にする(Vite の複数ページ構成。`build.rollupOptions.input`、Vite 8 で名前が変わっていれば新しい名前を使う)。`npm run build` のあと `dist/index.html` と `dist/stats.html` の両方ができること。

### 9. `functions/` の型チェック

- `functions/tsconfig.json` は、ルートの `tsconfig.json` と同じ厳しさ(`strict` など)で、`"types": ["@cloudflare/workers-types"]`、`"lib": ["ES2022"]`、`"include": ["."]` にする
- `package.json` に `"typecheck:functions": "tsc -p functions --noEmit"` を足す
- `functions/` から `src/stats/`・`src/game/` を相対パスで import する。`src/game/endurance.ts` の JSON の import がこの tsconfig でも通るよう `resolveJsonModule` を付ける
- `functions/` から import してよいのは `src/stats/**` と `src/game/**` だけ(DOM や localStorage に触れるファイルを読み込まない)

### 10. テスト

1つの `it` で1つの振る舞いを確かめる。表の行ごとにテストを書く。

`tests/stats-payload.test.ts`:

- 正しいタイムアタックのデータが `ok: true` になる
- 正しい耐久のデータが `ok: true` になる
- 余計なキーが付いていても、返る `payload` には仕様の項目しかない
- 1章の「チェックの内容」の表の各行について、その条件だけを破ったデータが `ok: false` になる(共通・タイムアタック・耐久の全行)
- 耐久の `dateKey` が前日なら通り、2日前と翌日は落ちる
- 数値の項目に小数・文字列・`NaN` を入れると落ちる(`correct` で代表して確かめる)

`tests/stats-summary.test.ts`:

- `jstDateKey`:UTC で 14:59 と 15:00 のとき、日本時間の日付が変わる
- `previousDateKey`:月の初日・年の初日・うるう年の 3/1
- `totalReading`:絵文字を含まない普通の読みで、`[...reading].length` の合計になる
- `summarizeTimeAttack`:同じ ID の行が1件にまとまる/`correct` が同じなら `miss` が少ない方/`accuracy` と `cps` の計算/`bests` が大きい順/`players` と `plays`
- `summarizeEndurance`:同じ ID の行が最高値1件にまとまる/大きい順
- `histogram`:空の配列/境目の値(10・0.05・0.5 の各 width)/`upper` を渡したとき `upper` ちょうどの値が最後の区間に入る/途中の空の区間が `count: 0` で返る
- `topPercent`:空なら `null`/いちばん上なら最小の%/いちばん下なら 100/同じ値が並ぶとき

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm run typecheck:functions` が通る
- [ ] `npm test` が通る(上の「テスト」の項目がすべてある)
- [ ] `npm run build` が通り、`dist/index.html` と `dist/stats.html` の両方ができる
- [ ] `npm run format:check` が通る
- [ ] `src/stats/` で `Date.now`・`Math.random`・`document`・`window`・`localStorage`・`import.meta` を使っていない(`grep -rnE "Date\.now|Math\.random|document\.|window\.|localStorage|import\.meta" src/stats` が何も出さない)
- [ ] `npm run dev` で `/stats.html` を開くと、「記録を読み込めませんでした」が出て、ゲームへ戻るリンクがある
- [ ] `npm run dev` でゲームを最後まで遊んでも、`/api/results` への通信が起きない(開発中は送らない)

デプロイ後に Claude Code とオーナーが確かめること(実装担当はやらない):

- [ ] 本番でタイムアタックと耐久を1回ずつ遊ぶと、D1 の `results` に1行ずつ増える
- [ ] `/stats` に自分の記録が反映され、上位◯%が出る
- [ ] でたらめな値(`correct: 99999` など)を `curl` で送ると `400` が返り、行が増えない

## デプロイ前にオーナーがやる準備

実装担当の作業とは別。コードをデプロイする前に1回だけやる。

1. Cloudflare のダッシュボード → Storage & Databases → D1 → Create で、データベースを作る(名前は `flick-typing`)
2. 作ったデータベースの Console で、`migrations/0001_results.sql` の中身を貼り付けて実行する
3. Workers & Pages → このゲームの Pages プロジェクト → Settings → Bindings → Add → D1 database で、変数名 `DB`、データベース `flick-typing` を選ぶ。Production と Preview の両方に設定する
4. 設定のあとにデプロイし直す(バインディングは次のデプロイから効く)

`wrangler.toml` は置かない。置くとダッシュボードのバインディング設定より優先され、手順 3 が効かなくなるため。

生データを見たいときは、D1 の Console で SQL を実行する(例:`SELECT * FROM results ORDER BY id DESC LIMIT 50`)。

## 対象外

- ランキング(名前を付けて順位を並べること)
- 入力ログの送信と、サーバー側での計算し直し
- ランク(段位)の基準そのもの。データが溜まってから別の仕様書で決める
- ゲーム画面(タイトル・結果)から集計ページへのリンク
- 送信の再送、送信の成否の表示
- 送信の回数制限(レート制限)。荒らしが起きたら別の仕様書で足す
- 過去の日付の耐久の集計、ルールのバージョンをまたいだ集計
- 1プレイずつの一覧の表示

## 想定される落とし穴

- **`src/stats/` は Workers の上でも動く。** DOM・localStorage・`import.meta.env` を使わない。`src/storage.ts` など、ブラウザ側のファイルからは型も含めて import しない(上の「1. 送るデータ」のとおり)
- **`src/game/endurance.ts` は約 180KB の JSON を読み込む。** `functions/` に含まれても Pages Functions のサイズ上限には収まる。気にして別の形に分けない
- **`wrangler.toml` を作らない。** 上の「準備」のとおり、ダッシュボードの設定が効かなくなる
- **`npm run dev` では `/api/*` が動かない。** Vite は `functions/` を実行しない。集計ページの見た目を確かめたいときに API を真似するコードを本番のコードに入れない(確かめはデプロイ後に行う)
- **ルート `tsconfig.json` の `include` に `functions` を足さない。** ルートは DOM の型、`functions/` は Workers の型で、混ぜると型がぶつかる。だから型チェックを2つに分けている
- **`style.css` の `html, body { touch-action: none; user-select: none }`** のせいで、そのままでは集計ページをスクロールできない。`stats.css` の `html.stats` で上書きする。`style.css` 自体は変えない
- **`keepalive: true` の本文は 64KB まで。** 今回のデータは数百バイトなので問題ない
- **耐久の `final.endMs` と `final.end` は型の上では `null` になりうる。** 終わった後は値が入っているはずだが、`main.ts` の今の書き方(`?? "complete"`)に合わせて `?? 0` で埋める
- **正確率の区間の境目**:`0.95 / 0.05` は浮動小数の誤差で `18.999…` になる。`histogram` のテストで 0.95 が `[0.95, 1)` の区間に入ることを確かめ、入らなければ `Math.floor(value / width + 1e-9)` のように誤差を吸収する
