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
  it("advances on a replace that matches while pending", () => {
    const result = judge("ぱ", 0, "は", { kind: "replace", kana: "ぱ" });
    expect(result).toEqual({ result: "advance", index: 1, pending: null });
  });
  it("cycles on a replace inside the expected cycle while pending", () => {
    const result = judge("ぱ", 0, "は", { kind: "replace", kana: "ば" });
    expect(result).toEqual({ result: "cycle", index: 0, pending: "ば" });
  });
  it("misses on a replace outside the cycle while pending", () => {
    const result = judge("ぱ", 0, "は", { kind: "replace", kana: "く" });
    expect(result).toEqual({ result: "miss", index: 0, pending: null });
  });
  it("treats a replace as a kana without pending", () => {
    expect(judge("い", 0, null, { kind: "replace", kana: "い" }).result).toBe("advance");
  });
  it("cancels without moving the index", () => {
    const result = judge("ぱ", 0, "は", { kind: "cancel" });
    expect(result).toEqual({ result: "cancel", index: 0, pending: null });
  });
  it("misses and clears pending on reject", () => {
    const result = judge("ぱ", 0, "は", { kind: "reject" });
    expect(result).toEqual({ result: "miss", index: 0, pending: null });
  });
});
