import type { PlayMode } from "./game/mode";

export type { PlayMode };
export type Best = { correct: number; accuracy: number; cps: number; date: string };
export type EnduranceBest = { dateKey: string; passageId: string; correct: number; date: string };
const BEST_KEYS: Record<PlayMode, string> = {
  flick: "flick-typing:best:v1",
  native: "flick-typing:best:native:v1",
};
const ENDURANCE_BEST_KEYS: Record<PlayMode, string> = {
  flick: "flick-typing:endurance:v1",
  native: "flick-typing:endurance:native:v1",
};
const MODE_KEY = "flick-typing:mode:v1";
const THEME_KEY = "flick-typing:theme:v1";
const NAME_KEY = "flick-typing:name:v1";
const PLAYER_KEY = "flick-typing:player:v1";
const PLAYER_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let cachedPlayerId: string | null = null;

/** crypto.randomUUID は https か localhost でしかないので、無い環境では getRandomValues から作る */
function createPlayerId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function loadBest(mode: PlayMode): Best | null {
  try {
    const v = localStorage.getItem(BEST_KEYS[mode]);
    return v ? (JSON.parse(v) as Best) : null;
  } catch {
    return null;
  }
}
export function saveBest(mode: PlayMode, best: Best) {
  try {
    localStorage.setItem(BEST_KEYS[mode], JSON.stringify(best));
  } catch {
    /* storage is optional */
  }
}
export function loadEnduranceBest(mode: PlayMode, dateKey: string): EnduranceBest | null {
  try {
    const v = localStorage.getItem(ENDURANCE_BEST_KEYS[mode]);
    if (!v) return null;
    const best = JSON.parse(v) as EnduranceBest;
    return best.dateKey === dateKey ? best : null;
  } catch {
    return null;
  }
}
export function saveEnduranceBest(mode: PlayMode, best: EnduranceBest) {
  try {
    localStorage.setItem(ENDURANCE_BEST_KEYS[mode], JSON.stringify(best));
  } catch {
    /* storage is optional */
  }
}
export function loadMode(): PlayMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === "native" ? "native" : "flick";
  } catch {
    return "flick";
  }
}
export function saveMode(mode: PlayMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* storage is optional */
  }
}
export function loadTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}
export function saveTheme(theme: string) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage is optional */
  }
}
export function loadPlayerId(): string {
  if (cachedPlayerId) return cachedPlayerId;
  try {
    const saved = localStorage.getItem(PLAYER_KEY);
    if (saved && PLAYER_PATTERN.test(saved)) {
      cachedPlayerId = saved;
      return saved;
    }
    const created = createPlayerId();
    localStorage.setItem(PLAYER_KEY, created);
    cachedPlayerId = created;
    return created;
  } catch {
    cachedPlayerId = createPlayerId();
    return cachedPlayerId;
  }
}
/** 端末に保存したニックネーム(表示用)。正しくはサーバーの players にある */
export function loadName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}
export function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* storage is optional */
  }
}
