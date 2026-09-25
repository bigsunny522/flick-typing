import { describe, expect, it } from "vitest";
import { analyze } from "../src/anticheat/behavior";
import type { KeyStroke } from "../src/keyboard/layout";

function makeStrokes(count: number, patch: (index: number) => Partial<KeyStroke>): KeyStroke[] {
  return Array.from({ length: count }, (_, index) => ({
    key: "a",
    dir: "tap",
    down: { x: index, y: index, t: index * 100 },
    up: { x: index + 1, y: index + 1, t: index * 100 + 30 },
    moves: 2,
    width: 20,
    height: 20,
    pressure: 0.5,
    ...patch(index),
  }));
}

describe("behavior", () => {
  it("does not judge fewer than ten strokes", () => {
    expect(analyze(makeStrokes(9, () => ({}))).bot).toBe(false);
  });
  it("detects instant presses", () => {
    const result = analyze(makeStrokes(10, (i) => ({ up: { x: i, y: i, t: i * 100 + 1 } })));
    expect(result.reasons).toContain("instant-press");
  });
  it("detects teleport flicks", () => {
    const result = analyze(makeStrokes(10, () => ({ dir: "left", moves: 0 })));
    expect(result.reasons).toContain("teleport-flick");
  });
  it("detects identical points", () => {
    const result = analyze(makeStrokes(10, (i) => ({ down: { x: 1, y: 1, t: i * 100 } })));
    expect(result.reasons).toContain("same-point");
  });
  it("detects too-fast intervals", () => {
    const result = analyze(makeStrokes(10, (i) => ({ down: { x: i, y: i, t: i * 20 } })));
    expect(result.reasons).toContain("too-fast");
  });
  it("detects too-regular intervals", () => {
    const result = analyze(makeStrokes(10, (i) => ({ down: { x: i, y: i, t: i * 100 } })));
    expect(result.reasons).toContain("too-regular");
  });
  it("does not flag varied human-like strokes", () => {
    const result = analyze(
      makeStrokes(10, (i) => ({
        down: { x: i, y: i + 1, t: i * 100 + (i % 3) * 17 },
        up: { x: i + 2, y: i + 3, t: i * 100 + (i % 3) * 17 + 30 },
      })),
    );
    expect(result.bot).toBe(false);
  });
});
