import { describe, expect, it } from "vitest";
import { checkEnv, type EnvSnapshot } from "../src/anticheat/env";

const phone: EnvSnapshot = {
  userAgent: "Mozilla iPhone",
  maxTouchPoints: 5,
  coarsePointer: true,
  webdriver: false,
  uaData: null,
  screenWidth: 390,
  screenHeight: 844,
};
const verdict = (change: Partial<EnvSnapshot>) => checkEnv({ ...phone, ...change });
describe("env", () => {
  it("accepts iPhone Safari", () => {
    expect(checkEnv(phone).kind).toBe("ok");
  });
  it("accepts Android Chrome", () => {
    expect(
      verdict({
        userAgent: "Mozilla Android Mobile",
        uaData: { mobile: true, platform: "Android" },
      }).kind,
    ).toBe("ok");
  });
  it("reports webdriver", () => {
    expect(verdict({ webdriver: true }).reasons).toContain("webdriver");
  });
  it("reports no touch", () => {
    expect(verdict({ maxTouchPoints: 0 }).reasons).toContain("no-touch");
  });
  it("reports non-mobile user agents", () => {
    expect(verdict({ userAgent: "Mozilla Chrome" }).reasons).toContain("not-mobile-ua");
  });
  it("reports iPad desktop user agents", () => {
    expect(verdict({ userAgent: "Mozilla Macintosh", maxTouchPoints: 5 }).reasons).toContain(
      "ipad-desktop-ua",
    );
  });
  it("reports tablet sizes", () => {
    expect(verdict({ screenWidth: 800 }).reasons).toContain("tablet-size");
  });
  it("reports non-mobile UA data", () => {
    expect(verdict({ uaData: { mobile: false, platform: "Android" } }).reasons).toContain(
      "uadata-not-mobile",
    );
  });
  it("reports UA data on iPhone", () => {
    expect(verdict({ uaData: { mobile: true, platform: "iOS" } }).reasons).toContain(
      "ios-with-uadata",
    );
  });
  it("reports Android platform mismatch", () => {
    expect(
      verdict({
        userAgent: "Mozilla Android Mobile",
        uaData: { mobile: true, platform: "Windows" },
      }).reasons,
    ).toContain("android-platform-mismatch");
  });
});
