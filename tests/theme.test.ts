import { describe, expect, it } from "vitest";
import { nextTheme, parseTheme, type ThemeId } from "../src/theme";

describe("theme", () => {
  it("次のテーマ", () => {
    expect(nextTheme("sky")).toBe("sakura");
  });
  it("最後の次は最初", () => {
    expect(nextTheme("mono")).toBe("sky");
  });
  it("6回で1周", () => {
    let current: ThemeId = "sky";
    for (let i = 0; i < 6; i += 1) current = nextTheme(current);
    expect(current).toBe("sky");
  });
  it("一覧にある値", () => {
    expect(parseTheme("leaf")).toBe("leaf");
  });
  it("一覧にない値", () => {
    expect(parseTheme("red")).toBe("sky");
  });
  it("null", () => {
    expect(parseTheme(null)).toBe("sky");
  });
});
