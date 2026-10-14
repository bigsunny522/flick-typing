export type PlayMode = "flick" | "native";
export type Best = { correct: number; accuracy: number; cps: number; date: string };
const BEST_KEYS: Record<PlayMode, string> = {
  flick: "flick-typing:best:v1",
  native: "flick-typing:best:native:v1",
};
const MODE_KEY = "flick-typing:mode:v1";
const THEME_KEY = "flick-typing:theme:v1";
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
