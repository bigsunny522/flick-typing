import { checkName } from "../src/ranking/name";
import type { Env } from "./index";

const MAX_BODY_BYTES = 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function handleName(request: Request, env: Env): Promise<Response> {
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
  const record: Record<string, unknown> = isObject(body) ? body : {};
  const playerId = record.playerId;
  if (typeof playerId !== "string" || !UUID_PATTERN.test(playerId)) {
    return Response.json({ error: "playerId" }, { status: 400 });
  }
  const check = checkName(typeof record.name === "string" ? record.name : "");
  if (!check.ok) return Response.json({ error: check.error }, { status: 400 });
  try {
    await saveName(env, playerId, check.name);
  } catch {
    return new Response(null, { status: 500 });
  }
  return Response.json({ name: check.name });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** なければ作る。あれば名前だけ書き換える。`banned` は書き換えない */
async function saveName(env: Env, playerId: string, name: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO players (player_id, name) VALUES (?1, ?2) " +
      "ON CONFLICT(player_id) DO UPDATE SET name = excluded.name, updated_at = datetime('now')",
  )
    .bind(playerId, name)
    .run();
}
