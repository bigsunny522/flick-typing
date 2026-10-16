import { ENDURANCE_RULES_VERSION, RULES_VERSION } from "../src/game/rules";
import type { EntryRequest } from "../src/ranking/types";
import type { Env } from "./index";
import { UUID_PATTERN } from "./ranking";

const MAX_BODY_BYTES = 512;

/** `POST /api/ranking/entry`。送った記録をランキングに載せる */
export async function handleEntry(request: Request, env: Env): Promise<Response> {
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
  const entry = readEntry(body);
  if (entry === null) return Response.json({ error: "body" }, { status: 400 });
  let changes: number;
  try {
    changes = await markRanked(env, entry);
  } catch {
    return new Response(null, { status: 500 });
  }
  if (changes < 1) return Response.json({ error: "result" }, { status: 404 });
  return Response.json({ ok: true });
}

/** `EntryRequest` の形を見て、違うときは null */
function readEntry(body: unknown): EntryRequest | null {
  const record: Record<string, unknown> = isObject(body) ? body : {};
  const playerId = record.playerId;
  if (typeof playerId !== "string" || !UUID_PATTERN.test(playerId)) return null;
  const resultId = record.resultId;
  if (typeof resultId !== "number" || !Number.isInteger(resultId) || resultId < 1) return null;
  return { playerId, resultId };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** 載せられる行なら `ranked = 1` にして、変わった行数を返す */
async function markRanked(env: Env, entry: EntryRequest): Promise<number> {
  const out = await env.DB.prepare(
    "UPDATE results SET ranked = 1 " +
      "WHERE id = ?1 AND player_id = ?2 AND mode = 'native' " +
      "AND ((kind = 'timeattack' AND rules_version = ?3) " +
      "OR (kind = 'endurance' AND rules_version = ?4))",
  )
    .bind(entry.resultId, entry.playerId, RULES_VERSION, ENDURANCE_RULES_VERSION)
    .run();
  return out.meta.changes;
}
