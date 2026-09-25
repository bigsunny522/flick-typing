import { describe, expect, it } from "vitest";
import { readDirection } from "../src/keyboard/gesture";
describe("gesture", () => {
  it("reads a movement below the boundary as tap", () => {
    expect(readDirection(2.9, 0, 10)).toBe("tap");
  });
  it("does not read movement at the boundary as tap", () => {
    expect(readDirection(3, 0, 10)).toBe("right");
  });
  it("reads left", () => {
    expect(readDirection(-10, 0, 10)).toBe("left");
  });
  it("reads up", () => {
    expect(readDirection(0, -10, 10)).toBe("up");
  });
  it("reads right", () => {
    expect(readDirection(10, 0, 10)).toBe("right");
  });
  it("reads down", () => {
    expect(readDirection(0, 10, 10)).toBe("down");
  });
});
