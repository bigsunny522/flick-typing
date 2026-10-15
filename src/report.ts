import type { ResultPayload } from "./stats/payload";

export function reportResult(payload: ResultPayload, debug: boolean): void {
  if (debug) return;
  if (import.meta.env.DEV) return;
  fetch("/api/results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}
