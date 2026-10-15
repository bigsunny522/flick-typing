export type PlayMode = "flick" | "native";
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
