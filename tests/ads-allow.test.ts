import { describe, expect, it } from "vitest";
import { isAdAllowed } from "../src/ads/allow";

describe("isAdAllowed", () => {
  it("本番のホスト名なら許す", () => {
    expect(isAdAllowed("flicktypinggame.xyzack271.com")).toBe(true);
  });

  it("ブランチのプレビュー URL は許さない", () => {
    expect(isAdAllowed("bigsunny522-re-launch-checklist-flick-typing.xyzack271.workers.dev")).toBe(
      false,
    );
  });

  it("localhost は許さない", () => {
    expect(isAdAllowed("localhost")).toBe(false);
  });

  it("末尾に本番のホスト名を付けた偽りのドメインは許さない", () => {
    expect(isAdAllowed("flicktypinggame.xyzack271.com.example.com")).toBe(false);
  });

  it("空文字は許さない", () => {
    expect(isAdAllowed("")).toBe(false);
  });
});
