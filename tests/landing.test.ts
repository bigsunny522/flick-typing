import { describe, expect, it } from "vitest";
import { landingHtml } from "../src/landing";

describe("landingHtml", () => {
  it("h1 が1つでサイト名になっている", () => {
    const html = landingHtml();
    expect(html).toContain("<h1>ふりっくタイピング</h1>");
    expect(html.split("<h1").length - 1).toBe(1);
  });

  it("スマホで開いてください", () => {
    expect(landingHtml()).toContain("スマホで開いてください");
  });

  it("カタカナのサイト名を含む", () => {
    expect(landingHtml()).toContain("フリックタイピング");
  });

  it("h2 が3つ", () => {
    expect(landingHtml().split("<h2>").length - 1).toBe(3);
  });

  it("集計ページへのリンク", () => {
    expect(landingHtml()).toContain('href="/stats"');
  });

  it("連絡先の URL と別のタブで開く", () => {
    const html = landingHtml();
    expect(html).toContain('href="https://x.com/xyzack271"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("ブロック画面の class を残す", () => {
    expect(landingHtml()).toContain('class="screen blocked landing"');
  });

  it("入力欄を置かない", () => {
    const html = landingHtml();
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("<select");
  });
});
