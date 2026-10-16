# 運用メモ

公開してから困ったときに引くメモ。SQL はすべて Mac のターミナルで、リポジトリのフォルダから実行する。`wrangler` は依存に入れていないので `npx wrangler@4` で動かす(初回は `npx wrangler@4 login`)。

## デプロイのしくみ

| ブランチ | どうなるか                                                                                                        | 使う D1                |
| -------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `main`   | push すると Workers Builds が `npm run build` → `npx wrangler deploy` で本番に出す                                | `flick-typing`         |
| それ以外 | push すると `npx wrangler preview` でプレビュー URL(`<ブランチ名>-flick-typing.<サブドメイン>.workers.dev`)を作る | `flick-typing-preview` |

- `?debug` はプレビュー URL と `npm run dev` だけで効く。本番の URL では無視される(`src/debug/allow.ts`)
- `wrangler.jsonc` を変えたときは、デプロイのたびにダッシュボードの設定が上書きされる。ダッシュボードでバインディングを直接いじらない

## D1 のマイグレーション

新しい `migrations/000N_*.sql` を足したら、`main` に入れる**前に**両方の D1 に当てる。

```
npx wrangler@4 d1 migrations list flick-typing --remote          # 本番で未適用のものを見る
npx wrangler@4 d1 migrations apply flick-typing --remote         # 本番に当てる
```

プレビュー用の D1 は `wrangler.jsonc` の `previews` の中にあるので、`d1 migrations` から名前でも `--preview` でも指定できない(2026-10-17 に確かめた)。いったん上の `d1_databases` の `database_name` / `database_id` をプレビューのもの(`flick-typing-preview` / `2da4238e-a92e-4c8b-845b-3957a2820bd2`)に書き換えて `migrations apply flick-typing-preview --remote` し、すぐ元に戻す(書き換えたままコミットしない)。単発の SQL なら ID で指定できる:

```
npx wrangler@4 d1 execute 2da4238e-a92e-4c8b-845b-3957a2820bd2 --remote --command "SELECT name FROM d1_migrations"
```

適用の状況(2026-10-17): 本番・プレビューとも `0001`〜`0003` まで。

## 名前と記録の管理

管理画面はない。次の SQL を `npx wrangler@4 d1 execute flick-typing --remote --command "…"` で実行する。

| したいこと                      | SQL                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 名前で人を探す                  | `SELECT player_id, name, banned FROM players WHERE name LIKE '%…%';`                                                           |
| 名前を消す(名無しさんに戻る)    | `DELETE FROM players WHERE player_id = '…';`                                                                                   |
| ランキングから外す(ban)         | `INSERT INTO players (player_id, name, banned) VALUES ('…', '名無しさん', 1) ON CONFLICT(player_id) DO UPDATE SET banned = 1;` |
| ban を解く                      | `UPDATE players SET banned = 0 WHERE player_id = '…';`                                                                         |
| 1つの記録だけランキングから外す | `UPDATE results SET ranked = 0 WHERE id = …;`                                                                                  |

- `player_id` はランキングの API には出ない。名前から探すか、下の「怪しい記録」から探す
- 名前を消しても、その人がまた名前を付ければ載る。繰り返すなら ban する

## 怪しい記録を見る

```sql
-- タイムアタックで載っている上位(1秒あたりの文字数が高すぎるものを疑う)
SELECT r.id, r.player_id, p.name, r.correct, r.miss, r.duration_ms,
       ROUND(r.correct * 1000.0 / r.duration_ms, 2) AS cps, r.created_at
FROM results r LEFT JOIN players p ON p.player_id = r.player_id
WHERE r.kind = 'timeattack' AND r.ranked = 1
ORDER BY r.correct DESC LIMIT 30;

-- 1人で送った回数が多い人(直近1日)
SELECT player_id, COUNT(*) AS n FROM results
WHERE created_at >= datetime('now', '-1 day')
GROUP BY player_id ORDER BY n DESC LIMIT 20;
```

結果は UTC(`created_at`)。日本時間は +9 時間。

## 回数制限

`wrangler.jsonc` の `ratelimits`(`docs/spec-launch-hardening.md`)。key は接続元の IP。

| バインディング | 対象                                           | 上限                 |
| -------------- | ---------------------------------------------- | -------------------- |
| `RL_WRITE`     | `POST /api/results`、`POST /api/ranking/entry` | 20 回 / 分(経路ごと) |
| `RL_NAME`      | `PUT /api/name`                                | 5 回 / 分            |
| `RL_READ`      | `GET /api/ranking`、`GET /api/stats`           | 120 回 / 分          |

- 上限に当たると 429。画面には「送れませんでした」と出る
- 数値を変えるときは `wrangler.jsonc` の `limit` を変えて `main` に push する(`period` は 10 か 60 だけ)
- 拠点ごとにおおまかに数えるので、厳密な上限ではない

## ログ

- `wrangler.jsonc` の `observability` で Workers Logs を有効にしてある。ダッシュボード → Workers & Pages → `flick-typing` → Observability で、500・429・`console.error` を探せる
- その場で流れるログを見るとき: `npx wrangler@4 tail flick-typing`

## データを戻す

D1 は Time Travel で過去の任意の時点に戻せる(Workers の無料プランは7日、有料プランは30日まで。戻すと、その時点より後の書き込みは消える)。

```
npx wrangler@4 d1 time-travel info flick-typing                                   # 今の状態の bookmark
npx wrangler@4 d1 time-travel restore flick-typing --timestamp=2026-10-17T12:00:00+09:00
```

消しすぎた・間違えて UPDATE したときに使う。戻す前に、上の `info` で今の bookmark を控えておくと、戻したことを取り消せる。
