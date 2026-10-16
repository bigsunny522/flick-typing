# 一般公開の前の守り(回数制限と debug の制限)

## 背景

今は友達にだけ遊んでもらっていて、宣伝はしていない。ランキング(`docs/spec-ranking.md`、`docs/spec-ranking-entry.md`)を入れて一般に宣伝する前に、次の2つを直す。

1. **API に回数制限がない。** `POST /api/results`・`POST /api/ranking/entry`・`PUT /api/name` をスクリプトから何度でも送れて、そのまま D1 に入る。`docs/spec-ranking.md` の「対象外」で「一般公開の準備として別の仕様書で扱う」としたもの
2. **本番でも `?debug` が効く。** URL に `?debug` を付けると、環境チェックのブロック画面を素通りでき、プレイ中は機械操作の判定の理由と数値(`verdict.reasons`・`verdict.metrics`)がパネルに出る(`src/debug/panel.ts`)。debug 中は結果を送らないのでランキングに直接は入らないが、判定の基準が見えるので、すり抜ける調整に使える

オーナーと決めたこと:

| 項目               | 決めたこと                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| debug を使える場所 | `npm run dev` と、ブランチのプレビュー URL(`<名前>-flick-typing.<サブドメイン>.workers.dev`)だけ。本番では無視する |
| 回数制限のやり方   | Cloudflare Workers の Rate Limiting バインディング(依存の追加は要らない)                                           |
| 回数制限の単位     | 接続元の IP(`CF-Connecting-IP`)。`playerId` は端末が作る値で、いくらでも作り直せるので使わない                     |

## 変更対象

触るファイル:

- `src/api/limits.ts`(新規) — どの経路をどの制限で数えるかと、数えるときの key(純粋な関数。Worker でも使う)
- `tests/api-limits.test.ts`(新規)
- `worker/index.ts` — `Env` にバインディングを足し、経路を振り分ける前に回数を数える
- `src/debug/allow.ts`(新規) — debug を使ってよい場所か(純粋な関数)
- `tests/debug-allow.test.ts`(新規)
- `src/debug/panel.ts` — `debugEnabled()` が `src/debug/allow.ts` を使うようにする

触らないファイル:

- `wrangler.jsonc` — バインディング(`ratelimits`)は Claude Code が先に足してある(下の 1)
- `worker/results.ts`、`worker/entry.ts`、`worker/name.ts`、`worker/ranking.ts`、`worker/stats.ts` — 回数制限は `worker/index.ts` の入口でまとめて行う
- `src/report.ts`、`src/screens/**`、`src/stats-page/**` — 200 以外の返事はすでに「送れなかった」として扱っているので、429 のための変更は要らない
- `src/main.ts` — `debugEnabled()` の呼び出しはそのまま
- `package.json` — 依存は足さない

## 仕様

### 1. バインディング(`wrangler.jsonc`。Claude Code が済ませてある)

```jsonc
"ratelimits": [
  { "name": "RL_WRITE", "namespace_id": "52201", "simple": { "limit": 20, "period": 60 } },
  { "name": "RL_NAME", "namespace_id": "52202", "simple": { "limit": 5, "period": 60 } },
  { "name": "RL_READ", "namespace_id": "52203", "simple": { "limit": 120, "period": 60 } },
]
```

型は `@cloudflare/workers-types` の `RateLimit`(`limit({ key }): Promise<{ success: boolean }>`)。

### 2. 経路と制限(`src/api/limits.ts`)

```ts
/** 回数制限の種類。`wrangler.jsonc` の RL_WRITE / RL_NAME / RL_READ に対応する */
export type LimitName = "write" | "name" | "read";

/** その経路を数える制限。数えない経路は null */
export function limitFor(method: string, path: string): LimitName | null;

/** 数えるときの key */
export function limitKey(name: LimitName, path: string, ip: string): string;
```

`limitFor` の表:

| method | path                 | 返す値    |
| ------ | -------------------- | --------- |
| POST   | `/api/results`       | `"write"` |
| POST   | `/api/ranking/entry` | `"write"` |
| PUT    | `/api/name`          | `"name"`  |
| GET    | `/api/ranking`       | `"read"`  |
| GET    | `/api/stats`         | `"read"`  |
| 上以外 | 上以外               | `null`    |

- 経路は完全一致で比べる(`/api/ranking/entry` を `/api/ranking` の仲間にしない)。method が違うもの(405 になるもの)は `null`

`limitKey`:

- `"write"` は `write:<path>:<ip>`(結果の送信と記録の載せを別々に数える)
- `"name"` は `name:<ip>`、`"read"` は `read:<ip>`

`src/api/` は `src/stats/`・`src/ranking/` と同じ決まりにする(DOM・`Date.now()`・`Math.random()`・localStorage・`import.meta.env` を使わない。`src/storage.ts` を import しない)。

### 3. テスト(`tests/api-limits.test.ts`)

表の1行ごとに `it` を1つ書く。

`limitFor`:

| method | path                 | 期待      |
| ------ | -------------------- | --------- |
| POST   | `/api/results`       | `"write"` |
| POST   | `/api/ranking/entry` | `"write"` |
| PUT    | `/api/name`          | `"name"`  |
| GET    | `/api/ranking`       | `"read"`  |
| GET    | `/api/stats`         | `"read"`  |
| GET    | `/api/results`       | `null`    |
| GET    | `/api/ranking/entry` | `null`    |
| POST   | `/api/ranking`       | `null`    |
| GET    | `/api/unknown`       | `null`    |
| GET    | `/`                  | `null`    |
| GET    | `/stats`             | `null`    |

`limitKey`:

| name      | path                 | ip            | 期待                                     |
| --------- | -------------------- | ------------- | ---------------------------------------- |
| `"write"` | `/api/results`       | `203.0.113.5` | `"write:/api/results:203.0.113.5"`       |
| `"write"` | `/api/ranking/entry` | `203.0.113.5` | `"write:/api/ranking/entry:203.0.113.5"` |
| `"name"`  | `/api/name`          | `2001:db8::1` | `"name:2001:db8::1"`                     |
| `"read"`  | `/api/stats`         | `203.0.113.5` | `"read:203.0.113.5"`                     |

### 4. Worker の入口(`worker/index.ts`)

- `Env` に `RL_WRITE: RateLimit; RL_NAME: RateLimit; RL_READ: RateLimit` を足す
- `fetch` の最初(`path` を求めた直後、経路の振り分けより前)で:
  1. `const name = limitFor(request.method, path)`。`null` なら数えずに今までどおり進む
  2. `ip` は `request.headers.get("CF-Connecting-IP") ?? "unknown"`
  3. `name` に対応するバインディング(`write` → `RL_WRITE`、`name` → `RL_NAME`、`read` → `RL_READ`)の `limit({ key: limitKey(name, path, ip) })` を呼ぶ
  4. `success` が false なら、`429` で本文 `{ "error": "rate" }`、ヘッダ `Retry-After: 60` を返す。経路の処理(D1 への書き込み)はしない
  5. `limit()` が投げたら、`console.error` に出して**通す**(回数制限が壊れても遊べるようにする)
     - バインディングが無い環境(プレビューで設定が引き継がれない場合など)でも同じく通す。バインディングを取り出すところから `limit()` の呼び出しまでを `try` の中に入れる
- 振り分けの表(どの経路をどの関数で処理するか)と 405 / 404 は今のまま
- 静的アセット(`/api/` 以外)は数えない

### 5. debug を使ってよい場所(`src/debug/allow.ts`)

```ts
/**
 * `?debug` を効かせてよい場所か。
 * `dev` は `import.meta.env.DEV`、`hostname` は `location.hostname`
 */
export function isDebugAllowed(dev: boolean, hostname: string): boolean;
```

- `dev` が true なら true
- そうでなければ、`hostname` が `.workers.dev` で終わり、**最初のラベル**(最初の `.` より前)が `-flick-typing` で終わるときだけ true(プレビュー URL。例 `feature-ranking-flick-typing.xxx.workers.dev`)
- それ以外(本番の `flick-typing.xxx.workers.dev`、独自ドメイン、`localhost` など)は false
- DOM・`location`・`import.meta.env` は関数の中で読まない(引数で受け取る)

### 6. テスト(`tests/debug-allow.test.ts`)

表の1行ごとに `it` を1つ書く。

| dev     | hostname                                            | 期待    |
| ------- | --------------------------------------------------- | ------- |
| `true`  | `localhost`                                         | `true`  |
| `true`  | `flick-typing.bigsunny.workers.dev`                 | `true`  |
| `false` | `flick-typing.bigsunny.workers.dev`                 | `false` |
| `false` | `feature-ranking-flick-typing.bigsunny.workers.dev` | `true`  |
| `false` | `1a2b3c4d-flick-typing.bigsunny.workers.dev`        | `true`  |
| `false` | `flick-typing.example.com`                          | `false` |
| `false` | `x-flick-typing.example.com`                        | `false` |
| `false` | `x-flick-typing-evil.bigsunny.workers.dev`          | `false` |
| `false` | `localhost`                                         | `false` |

### 7. `debugEnabled()`(`src/debug/panel.ts`)

```ts
export function debugEnabled(): boolean {
  if (!isDebugAllowed(import.meta.env.DEV, location.hostname)) return false;
  return new URLSearchParams(location.search).has("debug");
}
```

- 呼び出し側(`src/main.ts`)は変えない。本番で `?debug` を付けても、`debug` が false になり、ブロック画面・結果の送信・パネルの非表示は普段どおりになる

## 受け入れ条件

- [ ] `npx tsc --noEmit` が通る
- [ ] `npm test` が通る(`tests/api-limits.test.ts` の15件と `tests/debug-allow.test.ts` の9件を含む)
- [ ] `npm run build` が通る
- [ ] `npm run format:check` が通る
- [ ] `npm run typecheck:worker` が通る
- [ ] `grep -n "isDebugAllowed" src/debug/panel.ts` が1行以上出る
- [ ] `grep -n "Retry-After" worker/index.ts` が1行出る
- [ ] 以下は Claude Code が確かめる(実装担当は不要)
  - `npx wrangler dev` で `POST /api/name` を 6回続けて送ると、6回目が 429 になる(ローカルで回数制限が効かない場合は、プレビューで確かめる)
  - `GET /` と `GET /stats` は何度読んでも 429 にならない
  - プレビュー URL では `?debug` でパネルが出て、本番の URL では出ない

## 対象外

- Cloudflare Turnstile などの人間確認
- WAF のレート制限ルール(ダッシュボードの設定)
- サーバー側での入力ログの再計算(`docs/spec-ranking.md` の対象外のまま)
- 429 のときに画面に専用の文を出すこと(今の「送れませんでした」で足りる)
- `src/probe/`(すでに `import.meta.env.DEV` のときだけ動く)

## 想定される落とし穴

- **回数制限はおおまか。** Rate Limiting バインディングは Cloudflare の拠点ごとに数え、数え方も少し遅れる。短い間なら上限を少し超えて通ることがある。テストで「21回目がちょうど 429」のような厳密な確かめ方をしない
- **携帯回線は IP を多くの人で共有する。** そのため上限はゆるめにしてある(書き込み 20回/分、名前 5回/分、読み込み 120回/分)。数値は `wrangler.jsonc` で Claude Code が変える。コードに数値を書かない
- **耐久はすぐ終わることがある。** 1文字目で間違えると数秒で結果を送るので、書き込みの上限を「1分に数回」まで下げない
- **`CF-Connecting-IP` がないとき。** `wrangler dev` ではない場合がある。`"unknown"` にまとめて数える
- **`/api/ranking/entry` と `/api/ranking`。** `startsWith` で比べると entry が read の仲間になる。完全一致で比べる
- **debug の判定に `import.meta.env` を直接書かない。** `src/debug/allow.ts` は引数で受け取る(テストで本番とプレビューの両方を確かめるため)
