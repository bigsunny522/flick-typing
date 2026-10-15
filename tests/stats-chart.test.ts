import { describe, expect, it } from "vitest";
import { axisTicks } from "../src/stats-page/chart";

describe("axisTicks", () => {
  it("binCount 0 は空の配列", () => {
    expect(axisTicks(0)).toEqual([]);
  });

  it("binCount 1", () => {
    expect(axisTicks(1)).toEqual([0, 1]);
  });

  it("binCount 5", () => {
    expect(axisTicks(5)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("binCount 10", () => {
    expect(axisTicks(10)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it("binCount 20", () => {
    expect(axisTicks(20)).toEqual([0, 4, 8, 12, 16, 20]);
  });

  it("binCount 7 は最後の値を置き換えない", () => {
    expect(axisTicks(7)).toEqual([0, 2, 4, 6, 7]);
  });

  it("binCount 13 は 12 を 13 に置き換える", () => {
    expect(axisTicks(13)).toEqual([0, 3, 6, 9, 13]);
  });
});
