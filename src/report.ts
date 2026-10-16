import type { ResultsResponse } from "./ranking/types";
import type { ResultPayload } from "./stats/payload";

/** 結果を送り、返ってきた順位を受け取る。送れなかったときは null */
export function reportResult(
  payload: ResultPayload,
  debug: boolean,
): Promise<ResultsResponse | null> {
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
      return (await response.json()) as ResultsResponse;
    })
    .catch(() => null);
}
