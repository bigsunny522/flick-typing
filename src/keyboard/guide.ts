import type { Direction } from "./layout";

export type Rect = { x: number; y: number; width: number; height: number };
export type GuideCell = { dir: Direction; label: string; rect: Rect };

const directions: Direction[] = ["tap", "left", "up", "right", "down"];

export function guideCells(key: Rect, values: string[]): GuideCell[] {
  return values.flatMap((label, index) => {
    if (label === "—" || (index > 0 && values[0] === "切替")) return [];
    const dir = directions[index];
    const x = dir === "left" ? key.x - key.width : dir === "right" ? key.x + key.width : key.x;
    const y = dir === "up" ? key.y - key.height : dir === "down" ? key.y + key.height : key.y;
    const shown = label === "切替" ? "゛゜小" : label;
    return [{ dir, label: shown, rect: { x, y, width: key.width, height: key.height } }];
  });
}
