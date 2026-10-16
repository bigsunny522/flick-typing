import { describe, expect, it } from "vitest";
import { isDebugAllowed } from "../src/debug/allow";

describe("isDebugAllowed", () => {
  it("dev なら localhost でも許す", () => {
    expect(isDebugAllowed(true, "localhost")).toBe(true);
  });

  it("dev なら本番の URL でも許す", () => {
    expect(isDebugAllowed(true, "flick-typing.bigsunny.workers.dev")).toBe(true);
  });

  it("本番の workers.dev では許さない", () => {
    expect(isDebugAllowed(false, "flick-typing.bigsunny.workers.dev")).toBe(false);
  });

  it("ブランチのプレビュー URL は許す", () => {
    expect(isDebugAllowed(false, "feature-ranking-flick-typing.bigsunny.workers.dev")).toBe(true);
  });

  it("コミット名のプレビュー URL は許す", () => {
    expect(isDebugAllowed(false, "1a2b3c4d-flick-typing.bigsunny.workers.dev")).toBe(true);
  });

  it("独自ドメインは許さない", () => {
    expect(isDebugAllowed(false, "flick-typing.example.com")).toBe(false);
  });

  it("workers.dev でない -flick-typing は許さない", () => {
    expect(isDebugAllowed(false, "x-flick-typing.example.com")).toBe(false);
  });

  it("-flick-typing で終わらない最初のラベルは許さない", () => {
    expect(isDebugAllowed(false, "x-flick-typing-evil.bigsunny.workers.dev")).toBe(false);
  });

  it("dev でない localhost は許さない", () => {
    expect(isDebugAllowed(false, "localhost")).toBe(false);
  });
});
