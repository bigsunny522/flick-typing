import { describe, expect, it } from "vitest";
import { isPerfectRun } from "../src/game/perfect";

describe("isPerfectRun", () => {
  it("accepts 100 correct with 0 miss", () => {
    expect(isPerfectRun(100, 0)).toBe(true);
  });
  it("accepts 250 correct with 0 miss", () => {
    expect(isPerfectRun(250, 0)).toBe(true);
  });
  it("rejects 99 correct with 0 miss", () => {
    expect(isPerfectRun(99, 0)).toBe(false);
  });
  it("rejects 0 correct with 0 miss", () => {
    expect(isPerfectRun(0, 0)).toBe(false);
  });
  it("rejects 100 correct with 1 miss", () => {
    expect(isPerfectRun(100, 1)).toBe(false);
  });
  it("rejects 250 correct with 3 miss", () => {
    expect(isPerfectRun(250, 3)).toBe(false);
  });
});
