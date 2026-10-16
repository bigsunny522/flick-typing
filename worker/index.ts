import { handleEntry } from "./entry";
import { handleName } from "./name";
import { handleRanking } from "./ranking";
import { handleResults } from "./results";
import { handleStats } from "./stats";

export type Env = { DB: D1Database; ASSETS: Fetcher };

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
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
