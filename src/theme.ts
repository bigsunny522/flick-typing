import { saveTheme } from "./storage";

export type ThemeId = "sky" | "sakura" | "leaf" | "lavender" | "aqua" | "mono";
export const THEMES: readonly ThemeId[] = ["sky", "sakura", "leaf", "lavender", "aqua", "mono"];
export const DEFAULT_THEME: ThemeId = "sky";

export function nextTheme(current: ThemeId): ThemeId {
  const index = THEMES.indexOf(current);
  const next = index === -1 ? 0 : (index + 1) % THEMES.length;
  return THEMES[next];
}

export function parseTheme(value: string | null): ThemeId {
  if (value !== null && (THEMES as readonly string[]).includes(value)) {
    return value as ThemeId;
  }
  return DEFAULT_THEME;
}

export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme;
}

export function bindThemeTap(host: HTMLElement): void {
  host.querySelector<HTMLButtonElement>(".theme-tap")?.addEventListener("click", () => {
    const current = parseTheme(document.documentElement.dataset.theme ?? null);
    const next = nextTheme(current);
    applyTheme(next);
    saveTheme(next);
  });
}
