export type Best = { correct: number; accuracy: number; cps: number; date: string };
const KEY = "flick-typing:best:v1";
export function loadBest(): Best | null {
  try {
    const v = localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as Best) : null;
  } catch {
    return null;
  }
}
export function saveBest(best: Best) {
  try {
    localStorage.setItem(KEY, JSON.stringify(best));
  } catch {
    /* storage is optional */
  }
}
