import { describe, expect, it } from "vitest";
import { checkName, DEFAULT_NAME } from "../src/ranking/name";

describe("checkName", () => {
  it("ふつうの名前", () => {
    expect(checkName("たいぴすと")).toEqual({ ok: true, name: "たいぴすと" });
  });

  it("前後の空白を除く", () => {
    expect(checkName("  abc  ")).toEqual({ ok: true, name: "abc" });
  });

  it("全角英数を半角に", () => {
    expect(checkName("ＡＢＣ１")).toEqual({ ok: true, name: "ABC1" });
  });

  it("空", () => {
    expect(checkName("")).toEqual({ ok: false, error: "length" });
  });

  it("11文字", () => {
    expect(checkName("あいうえおかきくけこさ")).toEqual({ ok: false, error: "length" });
  });

  it("記号", () => {
    expect(checkName("a<b")).toEqual({ ok: false, error: "chars" });
  });

  it("空白を含む", () => {
    expect(checkName("a b")).toEqual({ ok: false, error: "chars" });
  });

  it("絵文字", () => {
    expect(checkName("abc😀")).toEqual({ ok: false, error: "chars" });
  });

  it("NG(ひらがな)", () => {
    expect(checkName("しねしね")).toEqual({ ok: false, error: "ng" });
  });

  it("NG(カタカナ)", () => {
    expect(checkName("ウンコ")).toEqual({ ok: false, error: "ng" });
  });

  it("NG(大文字・区切り)", () => {
    expect(checkName("F-U-C-K")).toEqual({ ok: false, error: "ng" });
  });

  it("NG(漢字)", () => {
    expect(checkName("死ね")).toEqual({ ok: false, error: "ng" });
  });

  it("NG(漢字・前に文字がある)", () => {
    expect(checkName("お前死ね")).toEqual({ ok: false, error: "ng" });
  });

  it("NG(漢字・後ろに文字がある)", () => {
    expect(checkName("殺すぞ")).toEqual({ ok: false, error: "ng" });
  });

  it("NG(1文字の言葉)", () => {
    expect(checkName("糞野郎")).toEqual({ ok: false, error: "ng" });
  });

  it("似た字を含むが NG ではない", () => {
    expect(checkName("変身ヒーロー")).toEqual({ ok: true, name: "変身ヒーロー" });
  });
});

describe("DEFAULT_NAME", () => {
  it("名無しさん", () => {
    expect(DEFAULT_NAME).toBe("名無しさん");
  });
});
