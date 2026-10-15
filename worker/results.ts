import { validatePayload, type ResultPayload } from "../src/stats/payload";
import { jstDateKey } from "../src/stats/summary";
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
  return new Response(null, { status: 204 });
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
