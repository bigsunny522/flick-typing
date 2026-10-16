/** 回数制限の種類。`wrangler.jsonc` の RL_WRITE / RL_NAME / RL_READ に対応する */
export type LimitName = "write" | "name" | "read";

/** 数える API の経路。経路は完全一致で比べる */
const ROUTES: { method: string; path: string; name: LimitName }[] = [
  { method: "POST", path: "/api/results", name: "write" },
  { method: "POST", path: "/api/ranking/entry", name: "write" },
  { method: "PUT", path: "/api/name", name: "name" },
  { method: "GET", path: "/api/ranking", name: "read" },
  { method: "GET", path: "/api/stats", name: "read" },
];

/** その経路を数える制限。数えない経路は null */
export function limitFor(method: string, path: string): LimitName | null {
  const route = ROUTES.find((item) => item.method === method && item.path === path);
  return route ? route.name : null;
}

/** 数えるときの key。同じ IP でも経路ごとに別に数える */
export function limitKey(name: LimitName, path: string, ip: string): string {
  if (name === "write") return `write:${path}:${ip}`;
  if (name === "name") return `name:${ip}`;
  return `read:${ip}`;
}
