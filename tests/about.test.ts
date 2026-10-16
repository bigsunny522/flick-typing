import { describe, expect, it } from "vitest";
import { aboutHtml } from "../src/about";

describe("aboutHtml", () => {
  it("見出し", () => {
    expect(aboutHtml()).toContain("<summary>記録と名前について</summary>");
  });

  it("連絡先の URL", () => {
    expect(aboutHtml()).toContain('href="https://x.com/xyzack271"');
  });

  it("別のタブで開く", () => {
    expect(aboutHtml()).toContain('target="_blank"');
    expect(aboutHtml()).toContain('rel="noopener noreferrer"');
  });

  it("項目の数", () => {
    expect(aboutHtml().split("<li>").length - 1).toBe(7);
  });

  it("入力欄を置かない", () => {
    expect(aboutHtml()).not.toContain("<input");
    expect(aboutHtml()).not.toContain("<textarea");
  });
});
