import { describe, expect, it } from "vitest";
import { guideCells } from "../src/keyboard/guide";

const key = { x: 100, y: 200, width: 40, height: 50 };
describe("guideCells", () => {
  it("places five directions in a cross", () => {
    expect(guideCells(key, ["あ", "い", "う", "え", "お"]).map((cell) => cell.rect)).toEqual([
      key,
      { ...key, x: 60 },
      { ...key, y: 150 },
      { ...key, x: 140 },
      { ...key, y: 250 },
    ]);
  });
  it("omits unavailable directions", () => {
    expect(guideCells(key, ["や", "—", "ゆ", "—", "よ"]).map((cell) => cell.dir)).toEqual([
      "tap",
      "up",
      "down",
    ]);
  });
  it("shows only the center for modifier", () => {
    expect(guideCells(key, ["切替", "切替", "切替", "切替", "切替"])).toHaveLength(1);
    expect(guideCells(key, ["切替", "切替", "切替", "切替", "切替"])[0].label).toBe("゛゜小");
  });
});
