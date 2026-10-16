# 集計ページ: 全プレイの分布と順位の表示

## 背景

`/stats` の分布は、匿名 ID ごとの自己ベストだけで描いている(`docs/spec-result-stats.md` の7章、`docs/spec-stats-histogram.md`)。オーナーの要望:

- 分布は「自己ベスト」と「全プレイ」を切り替えて見られるようにする。全プレイの分布は、あとでランクの基準を決める材料にする
- 順位は自己ベスト同士で比べる。「上位○%」ではなく「○位」で出す。人が増えたら、100位までは順位、それより下は「TOP200」のような区切りで出す(オーナー:「TOP200みたいな感じ」)

## 変更対象

- `src/stats/summary.ts`: 区間の幅の定数、全プレイの区間を作る関数、順位の関数、`StatsResponse` の型
- `worker/stats.ts`: 全プレイの区間をレスポンスに入れる
- `src/stats-page/main.ts`: 表示の切り替え、順位の行
- `src/stats-page/stats.css`: 必要なら切り替えの余白だけ
- `tests/stats-summary.test.ts`

触らないもの: `src/stats/payload.ts`、`worker/index.ts`、`worker/results.ts`、`migrations/`、`src/stats-page/chart.ts`、`wrangler.jsonc`、ゲーム側の画面。D1 のテーブルは変えない。

## 仕様

### 1. 区間の幅を1か所にまとめる(`src/stats/summary.ts`)

今は `src/stats-page/main.ts` に書いてある区間の幅を、`summary.ts` の定数に移す。ページと Worker の両方がこれを使う。

```ts
export const BIN = {
  correct: { width: 10 },
  accuracy: { width: 0.05, upper: 1 },
  cps: { width: 0.5 },
  progress: { width: 0.1, upper: 1 },
} as const;
```

`main.ts` の `histogram(..., 10)` などは `histogram(..., BIN.correct.width)` のように書き換える(値は変わらない)。

### 2. 全プレイの区間(`src/stats/summary.ts`)

全プレイの値の列を API でそのまま返すと、プレイ数に比例して大きくなる。Worker 側で区間ごとの数にまとめてから返す。

```ts
export type TimeAttackPlayBins = { correct: Bin[]; accuracy: Bin[]; cps: Bin[] };
export type EndurancePlayBins = { progress: Bin[] };

/** 全プレイ(自己ベストに絞らない)の区間ごとの数 */
export function timeAttackPlayBins(rows: TimeAttackRow[]): TimeAttackPlayBins;
export function endurancePlayBins(rows: EnduranceRow[], totalReading: number): EndurancePlayBins;
```

- 1行の値の出し方は `summarizeTimeAttack` と同じ: `accuracy = correct / (correct + miss)`(`correct + miss` が 0 なら 0)、`cps = correct / (durationMs / 1000)`。重複する計算は内部の関数にまとめてよい
- 耐久の `progress` は `correct / totalReading`
- 区間は `histogram(値の列, BIN.x.width, BIN.x.upper)` で作る。行が 0 件なら各配列は `[]`(`histogram` の今の動きのまま)

`StatsResponse` の各モードに `all` を足す:

```ts
export type TimeAttackSummary = ModeSummary<TimeAttackBest> & { all: TimeAttackPlayBins };
export type EnduranceSummary = ModeSummary<number> & { all: EndurancePlayBins };

// StatsResponse の timeattack.flick / timeattack.native を TimeAttackSummary に、
// endurance.flick / endurance.native を EnduranceSummary にする
```

### 3. 順位(`src/stats/summary.ts`)

```ts
/** 自分の値の順位。自分より大きい値の数 + 1。同じ値は同じ順位。values が空なら null */
export function rankOf(values: number[], mine: number): number | null;
```

| values | mine | 返り値 |
|---|---|---|
| `[]` | 100 | `null` |
| `[40, 30, 20, 10]` | 40 | `1` |
| `[40, 30, 20, 10]` | 10 | `4` |
| `[40, 30, 30, 10]` | 30 | `2` |
| `[40, 30, 30, 10]` | 20 | `4` |
| `[40, 30, 20, 10]` | 50 | `1`(列にない値でもよい) |

`topPercent` は残す(ページからは使わなくなるが、テストごと残す)。

```ts
/** 順位の表示。1〜100 位は「○位」、それより下は rank 以上で最小の区切りを「TOP○」で出す */
export function rankLabel(rank: number): string;
```

区切りは 200, 500, 1000, 2000, 5000, 10000, … と、1・2・5 に 10 の累乗をかけた数(200 以上)を小さい順にたどる。

| rank | 返り値 |
|---|---|
| 1 | `1位` |
| 100 | `100位` |
| 101 | `TOP200` |
| 200 | `TOP200` |
| 201 | `TOP500` |
| 501 | `TOP1000` |
| 1001 | `TOP2000` |
| 12000 | `TOP20000` |

### 4. API(`worker/stats.ts`)

- 各モードの集計に `all` を足す: タイムアタックは `timeAttackPlayBins(そのモードの行)`、耐久は `endurancePlayBins(そのモードの行, totalReading)`
- SQL・キャッシュ・ほかの項目は変えない。`bests` も今のまま返す(順位と自己ベストの分布に使う)

### 5. 集計ページ(`src/stats-page/main.ts`)

#### 表示の切り替え

モードの切り替えの下に、もう1つ切り替えを置く。

```
[ フリック | 標準キーボード ]
[ 自己ベスト | 全プレイ ]
```

- ボタンの文字は `自己ベスト` と `全プレイ`。初期値は `自己ベスト`。保存しない(ページを開き直したら `自己ベスト` に戻る)
- 見た目はモードの切り替えと同じ(`mode-select` のクラスを使ってよい)。押したら取得し直さずに描き直す
- タイムアタックと耐久の、すべてのグラフに効く

| 表示 | 自己ベスト | 全プレイ |
|---|---|---|
| 正解数の区間 | `histogram(bests の correct, BIN.correct.width)`(今のまま) | `all.correct` |
| 正確率の区間 | 今のまま | `all.accuracy` |
| 打鍵速度の区間 | 今のまま | `all.cps` |
| 進んだ割合の区間 | 今のまま | `all.progress` |
| 棒の上の数・`title`・`最大 N…` の単位 | `人` | `回` |
| `あなた` の棒 | 自己ベストが入る区間 | 同じ(自己ベストが入る区間) |

- `title` 属性は `<区間> <数>人` / `<区間> <数>回`。`最大 N人` / `最大 N回` も同じ
- 「まだ記録がありません」を出す条件は今のまま(`players` が 0)
- 全プレイの区間が空の配列のときは、そのグラフを描かずに「まだ記録がありません」を出す(`players` が 1 以上なら通常は起きないが、念のため)

#### 順位の行

今の `上位 ○%` の行を置き換える。比べる列は今と同じ(タイムアタックは `bests` の `correct`、耐久は `bests`)。切り替えによらず、常に自己ベスト同士で比べる。

| 条件 | 表示 |
|---|---|
| 自己ベストがない | 行を出さない(今と同じ) |
| `rankOf` が 1 以上 | `rankLabel(rankOf の値)`(`12位` / `TOP200` など) |
| `bests` が空 | 行を出さない |

- 分母(`○人中`)は付けない。自己ベストが API に届いていない場合(集計を始める前の記録など)に、`5人中 6位` のような表示になるのを避けるため。人数は上の `○人・○プレイ` の行で見える
- クラス名は今の `stats-top` のままでよい

## 受け入れ条件

- `npx tsc --noEmit` / `npm run typecheck:worker` / `npm test` / `npm run build` / `npm run format:check` がすべて通る
- `tests/stats-summary.test.ts` に、3章の `rankOf` と `rankLabel` の表の1行ごとの `it` がある
- `tests/stats-summary.test.ts` に、`timeAttackPlayBins` と `endurancePlayBins` について次の `it` がある
  - 同じ匿名 ID の行が複数あっても、すべての行が数に入る(自己ベストに絞らない)
  - 行が 0 件なら各配列が `[]`
  - 耐久の `progress` が `correct / totalReading` の区間に入る(例: `totalReading` 200、`correct` 50 → 0.2〜0.3 の区間に1)
- `grep -rnE "localStorage|import\.meta|storage" src/stats` が空
- `git diff --stat` が「変更対象」のファイルだけを含む

## 対象外

- 全プレイの値の列そのものを返すこと
- 順位の一覧(名前付きのランキング表)。匿名で、個人の記録を並べないという方針は変えない
- 結果画面に順位を出すこと
- 区間の幅を変えること

## 想定される落とし穴

- 今のクリック処理は `.mode-select button` をすべて拾って `dataset.mode` を読んでいる。切り替えを2つにすると、表示の切り替えのボタンも拾ってしまう。`data-mode` と `data-view` のように属性を分けて、それぞれ別に拾う
- `src/stats/` は Worker でも動く。`BIN` を置くのは `summary.ts` で、`src/stats-page/` 側から import する(逆向きにしない)
- `/api/stats` は 60 秒キャッシュされる。直前のプレイが順位や分布にすぐ出ないことがあるが、仕様どおり
