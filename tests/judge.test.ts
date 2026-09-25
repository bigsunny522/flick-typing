import { describe, expect, it } from "vitest";
import { judge } from "../src/game/judge";

describe("judge", () => {
  it("advances matching kana", () => {
    expect(judge("あ", 0, null, { kind: "kana", kana: "あ" }).result).toBe("advance");
  });
  it("holds a cyclic kana", () => {
    expect(judge("が", 0, null, { kind: "kana", kana: "か" }).result).toBe("pending");
  });
  it("misses unrelated kana", () => {
    expect(judge("あ", 0, null, { kind: "kana", kana: "か" }).result).toBe("miss");
  });
  it("misses modifier without pending", () => {
    expect(judge("あ", 0, null, { kind: "modifier" }).result).toBe("miss");
  });
  it("advances pending modifier", () => {
    expect(judge("が", 0, "か", { kind: "modifier" }).result).toBe("advance");
  });
  it("cycles pending modifier", () => {
    expect(judge("ぱ", 0, "は", { kind: "modifier" }).result).toBe("cycle");
  });
  it("misses kana while pending", () => {
    expect(judge("が", 0, "か", { kind: "kana", kana: "が" }).result).toBe("miss");
  });
  it("types ぱ after two modifiers", () => {
    const one = judge("ぱ", 0, "は", { kind: "modifier" });
    expect(judge("ぱ", 0, one.pending, { kind: "modifier" }).result).toBe("advance");
  });
  it("types っ after one modifier", () => {
    expect(judge("っ", 0, "つ", { kind: "modifier" }).result).toBe("advance");
  });
  it("types づ after two modifiers", () => {
    const one = judge("づ", 0, "つ", { kind: "modifier" });
    expect(judge("づ", 0, one.pending, { kind: "modifier" }).result).toBe("advance");
  });
});
