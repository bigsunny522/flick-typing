import type { Direction } from "./layout";

export function readDirection(dx: number, dy: number, keyWidth: number): Direction {
  if (Math.hypot(dx, dy) < keyWidth * 0.3) return "tap";
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}
