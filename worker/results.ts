import type { RankChances, ResultsResponse } from "../src/ranking/types";
import { validatePayload, type ResultPayload } from "../src/stats/payload";
import { jstDateKey } from "../src/stats/summary";
import type { Env } from "./index";
import { resultChances } from "./ranking";

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
  let resultId: number;
  try {
    resultId = await insertResult(env, result.payload);
  } catch {
    return new Response(null, { status: 500 });
  }
  let chances: RankChances | null = null;
  try {
    chances = await resultChances(env, result.payload, resultId, Date.now());
  } catch {
    chances = null;
  }
  const response: ResultsResponse = { resultId, chances };
  return Response.json(response);
}

/** 行を入れて、入った行の `results.id` を返す */
async function insertResult(env: Env, payload: ResultPayload): Promise<number> {
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
    return await runInsert(statement);
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
  return await runInsert(statement);
}

/** 行を入れて、`meta.last_row_id` を返す。取れなければ投げて 500 にする */
async function runInsert(statement: D1PreparedStatement): Promise<number> {
  const out = await statement.run();
  const resultId = out.meta.last_row_id;
  if (typeof resultId !== "number" || resultId <= 0) throw new Error("last_row_id is missing");
  return resultId;
}
