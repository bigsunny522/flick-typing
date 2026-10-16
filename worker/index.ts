import { limitFor, limitKey, type LimitName } from "../src/api/limits";
import { handleEntry } from "./entry";
import { handleName } from "./name";
import { handleRanking } from "./ranking";
import { handleResults } from "./results";
import { handleStats } from "./stats";

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  RL_WRITE: RateLimit;
  RL_NAME: RateLimit;
  RL_READ: RateLimit;
};

const LIMIT_BINDINGS: Record<LimitName, (env: Env) => RateLimit> = {
  write: (env) => env.RL_WRITE,
  name: (env) => env.RL_NAME,
  read: (env) => env.RL_READ,
};

/** 回数制限に達していたら false。数えない経路と、制限が壊れているときは true */
async function withinLimit(request: Request, path: string, env: Env): Promise<boolean> {
  const name = limitFor(request.method, path);
  if (name === null) return true;
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  try {
    const binding = LIMIT_BINDINGS[name](env);
    const outcome = await binding.limit({ key: limitKey(name, path, ip) });
    return outcome.success;
  } catch (error) {
    console.error("回数制限の確認に失敗したので通す", error);
    return true;
  }
}

function rateLimited(): Response {
  return Response.json({ error: "rate" }, { status: 429, headers: { "Retry-After": "60" } });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!(await withinLimit(request, path, env))) return rateLimited();
    if (path === "/api/results") {
      if (request.method !== "POST") return new Response(null, { status: 405 });
      return handleResults(request, env);
    }
    if (path === "/api/ranking") {
      if (request.method !== "GET") return new Response(null, { status: 405 });
      return handleRanking(request, env);
    }
    if (path === "/api/ranking/entry") {
      if (request.method !== "POST") return new Response(null, { status: 405 });
      return handleEntry(request, env);
    }
    if (path === "/api/name") {
      if (request.method !== "PUT") return new Response(null, { status: 405 });
      return handleName(request, env);
    }
    if (path === "/api/stats") {
      if (request.method !== "GET") return new Response(null, { status: 405 });
      return handleStats(env);
    }
    if (path.startsWith("/api/")) return new Response(null, { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
