import { describe, expect, it } from "vitest";
import { analyzeNative, type NativeEditLog, type NativeKeyLog } from "../src/anticheat/native";

function makeEdits(
  count: number,
  patch: (index: number) => Partial<NativeEditLog> = () => ({}),
): NativeEditLog[] {
  return Array.from({ length: count }, (_, index) => ({
    t: index * 200 + (index % 3) * 50,
    inputType: "insertCompositionText",
    before: "",
    after: "あ",
    trusted: true,
    viewportRatio: 0.45,
    ...patch(index),
  }));
}

function makeKeys(count: number, patch: Partial<NativeKeyLog> = {}): NativeKeyLog[] {
  return Array.from({ length: count }, (_, index) => ({
    t: index * 120,
    code: "KeyA",
    trusted: true,
    viewportRatio: 0.45,
    ...patch,
  }));
}

describe("native behavior", () => {
  it("flags an untrusted event", () => {
    const edits = makeEdits(1, () => ({ trusted: false }));
    expect(analyzeNative(edits, []).reasons).toEqual(["untrusted"]);
  });
  it("flags physical keys", () => {
    const keys: NativeKeyLog[] = [0, 1, 2].map((index) => ({
      t: index * 120,
      code: "KeyA",
      trusted: true,
      viewportRatio: 1,
    }));
    const verdict = analyzeNative(makeEdits(3), keys);
    expect(verdict.reasons).toEqual(["physical-key"]);
    expect(verdict.metrics.physicalKeys).toBe(3);
  });
  it("flags a viewport that never opens the soft keyboard", () => {
    const edits = makeEdits(12, () => ({ viewportRatio: 0.9 }));
    expect(analyzeNative(edits, []).reasons).toEqual(["no-soft-keyboard"]);
  });
  it("flags too-fast intervals", () => {
    const edits = makeEdits(12, (index) => ({
      t: 40 * Math.floor(index / 2) + (index % 2) * 10,
    }));
    expect(analyzeNative(edits, []).reasons).toEqual(["too-fast"]);
  });
  it("flags too-regular intervals", () => {
    const edits = makeEdits(12, (index) => ({ t: index * 100 }));
    expect(analyzeNative(edits, []).reasons).toEqual(["too-regular"]);
  });
  it("flags nothing for human-like typing", () => {
    const gaps = [
      150, 260, 340, 190, 400, 220, 310, 170, 380, 250, 290, 200, 360, 230, 160, 330, 270, 210, 390,
      240,
    ];
    let t = 0;
    const edits: NativeEditLog[] = gaps.map((gap) => {
      t += gap;
      return {
        t,
        inputType: "insertCompositionText",
        before: "",
        after: "あ",
        trusted: true,
        viewportRatio: 0.45,
      };
    });
    const keys: NativeKeyLog[] = edits.map((edit) => ({
      t: edit.t,
      code: "",
      trusted: true,
      viewportRatio: 0.45,
    }));
    const verdict = analyzeNative(edits, keys);
    expect(verdict.bot).toBe(false);
    expect(verdict.reasons).toEqual([]);
  });
  it("counts no physical keys while the soft keyboard is open", () => {
    const keys = makeKeys(3, { code: "KeyA", viewportRatio: 0.45 });
    const verdict = analyzeNative(makeEdits(3), keys);
    expect(verdict.reasons).toEqual([]);
    expect(verdict.metrics.physicalKeys).toBe(0);
  });
  it("counts no physical keys when the ratio equals the threshold", () => {
    const keys = makeKeys(3, { code: "KeyA", viewportRatio: 0.85 });
    const verdict = analyzeNative(makeEdits(3), keys);
    expect(verdict.reasons).toEqual([]);
    expect(verdict.metrics.physicalKeys).toBe(0);
  });
  it("counts physical keys while the soft keyboard is closed", () => {
    const keys = makeKeys(3, { code: "KeyA", viewportRatio: 0.9 });
    const verdict = analyzeNative(makeEdits(3), keys);
    expect(verdict.reasons).toEqual(["physical-key"]);
    expect(verdict.metrics.physicalKeys).toBe(3);
  });
  it("counts no physical keys without a code", () => {
    const keys = makeKeys(3, { code: "", viewportRatio: 1 });
    const verdict = analyzeNative(makeEdits(3), keys);
    expect(verdict.reasons).toEqual([]);
    expect(verdict.metrics.physicalKeys).toBe(0);
  });
  it("flags an untrusted key regardless of the ratio", () => {
    const keys = makeKeys(3, { code: "KeyA", viewportRatio: 0.45, trusted: false });
    const verdict = analyzeNative(makeEdits(3), keys);
    expect(verdict.reasons).toEqual(["untrusted"]);
    expect(verdict.metrics.physicalKeys).toBe(0);
  });
});
