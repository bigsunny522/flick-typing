import type { ResultPayload } from "./stats/payload";
import { parseRankResponse, type RankResponse } from "./stats/summary";

export function reportResult(payload: ResultPayload, debug: boolean): Promise<RankResponse | null> {
  if (debug) return Promise.resolve(null);
  if (import.meta.env.DEV) return Promise.resolve(null);
  return fetch("/api/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  })
    .then(async (response) => {
      if (response.status !== 200) return null;
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return null;
      }
      const rank = parseRankResponse(body);
      if (rank === null) return null;
      return rank.kind === payload.kind ? rank : null;
    })
    .catch(() => null);
}
