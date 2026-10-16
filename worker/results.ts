import { validatePayload, type ResultPayload } from "../src/stats/payload";
import {
  jstDateKey,
  jstWeekStartUtc,
  parseRankResponse,
  type RankResponse,
} from "../src/stats/summary";
import type { Env } from "./index";

const MAX_BODY_BYTES = 2048;

export async function handleResults(request: Request, env: Env): Promise<Response> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "json" }, { status: 400 });
  }
  const result = validatePayload(body, jstDateKey(Date.now()));
  if (!result.ok) return Response.json({ error: result.reason }, { status: 400 });
  try {
    await insertResult(env, result.payload);
  } catch {
    return new Response(null, { status: 500 });
  }
  let rank: RankResponse;
  try {
    rank = await readRank(env, result.payload);
  } catch {
    return new Response(null, { status: 204 });
  }
  return Response.json(rank, { status: 200 });
}

async function insertResult(env: Env, payload: ResultPayload): Promise<void> {
  if (payload.kind === "timeattack") {
    const statement = env.DB.prepare(
      "INSERT INTO results (player_id, kind, mode, rules_version, correct, miss, max_combo, duration_ms) " +
        "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    ).bind(
      payload.playerId,
      payload.kind,
      payload.mode,
      payload.rulesVersion,
      payload.correct,
      payload.miss,
      payload.maxCombo,
      payload.durationMs,
    );
    await statement.run();
    return;
  }
  const statement = env.DB.prepare(
    "INSERT INTO results (player_id, kind, mode, rules_version, correct, date_key, passage_id, end_reason, end_ms) " +
      "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
  ).bind(
    payload.playerId,
    payload.kind,
    payload.mode,
    payload.rulesVersion,
    payload.correct,
    payload.dateKey,
    payload.passageId,
    payload.end,
    payload.endMs,
  );
  await statement.run();
}

/** 保存したあとに、同じ条件で correct がこの回より大きい行の数から順位を数える */
async function readRank(env: Env, payload: ResultPayload): Promise<RankResponse> {
  if (payload.kind === "endurance") {
    const row = await firstRow(
      env,
      "SELECT COUNT(*) + 1 AS today_rank FROM results " +
        "WHERE kind = 'endurance' AND rules_version = ?1 AND mode = ?2 AND date_key = ?3 AND correct > ?4",
      [payload.rulesVersion, payload.mode, payload.dateKey, payload.correct],
    );
    return requireRank(parseRankResponse({ kind: "endurance", today: row.today_rank }));
  }
  const row = await firstRow(
    env,
    "SELECT " +
      "(SELECT COUNT(*) FROM results " +
      "WHERE kind = 'timeattack' AND rules_version = ?1 AND mode = ?2 AND correct > ?3) + 1 AS all_rank, " +
      "(SELECT COUNT(*) FROM results " +
      "WHERE kind = 'timeattack' AND rules_version = ?1 AND mode = ?2 AND created_at >= ?4 " +
      "AND correct > ?3) + 1 AS week_rank",
    [payload.rulesVersion, payload.mode, payload.correct, jstWeekStartUtc(Date.now())],
  );
  return requireRank(
    parseRankResponse({ kind: "timeattack", week: row.week_rank, all: row.all_rank }),
  );
}

async function firstRow(env: Env, sql: string, values: (string | number)[]): Promise<Row> {
  const row = await env.DB.prepare(sql)
    .bind(...values)
    .first<Row>();
  if (row === null) throw new Error("rank の行がありません");
  return row;
}

type Row = { today_rank?: unknown; week_rank?: unknown; all_rank?: unknown };

function requireRank(rank: RankResponse | null): RankResponse {
  if (rank === null) throw new Error("rank の形が違います");
  return rank;
}
