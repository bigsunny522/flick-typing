import { describe, expect, it } from "vitest";
import { inputForEdit, resolveEdit } from "../src/game/native-edit";

describe("native edit", () => {
  it("reads the first inserted kana", () => {
    expect(inputForEdit({ before: "", after: "あ", inputType: "insertCompositionText" })).toEqual({
      kind: "kana",
      kana: "あ",
    });
  });
  it("reads a kana appended to the value", () => {
    expect(
      inputForEdit({ before: "あ", after: "あい", inputType: "insertCompositionText" }),
    ).toEqual({ kind: "kana", kana: "い" });
  });
  it("reads a kana from a plain text insert", () => {
    expect(inputForEdit({ before: "あ", after: "あか", inputType: "insertText" })).toEqual({
      kind: "kana",
      kana: "か",
    });
  });
  it("reads a dakuten swap as a replace", () => {
    expect(inputForEdit({ before: "か", after: "が", inputType: "insertCompositionText" })).toEqual(
      { kind: "replace", kana: "が" },
    );
  });
  it("reads a single character replacement as a replace", () => {
    expect(inputForEdit({ before: "か", after: "き", inputType: "insertCompositionText" })).toEqual(
      { kind: "replace", kana: "き" },
    );
  });
  it("ignores an event that does not change the value", () => {
    expect(
      inputForEdit({ before: "あい", after: "あい", inputType: "insertCompositionText" }),
    ).toBeNull();
  });
  it("reads a backward delete as a cancel", () => {
    expect(
      inputForEdit({ before: "あい", after: "あ", inputType: "deleteContentBackward" }),
    ).toEqual({ kind: "cancel" });
  });
  it("reads a composition clear as a cancel", () => {
    expect(
      inputForEdit({ before: "あいう", after: "", inputType: "deleteCompositionText" }),
    ).toEqual({ kind: "cancel" });
  });
  it("rejects a conversion that swaps the first character", () => {
    expect(
      inputForEdit({ before: "あいう", after: "空いう", inputType: "insertCompositionText" }),
    ).toEqual({ kind: "reject" });
  });
  it("rejects a conversion that appends after the cursor", () => {
    expect(
      inputForEdit({ before: "あいう", after: "あい空", inputType: "insertCompositionText" }),
    ).toEqual({ kind: "reject" });
  });
  it("rejects two or more inserted characters", () => {
    expect(
      inputForEdit({ before: "あ", after: "あいう", inputType: "insertCompositionText" }),
    ).toEqual({ kind: "reject" });
  });
  it("rejects a character outside the typeable set", () => {
    expect(inputForEdit({ before: "", after: "b", inputType: "insertCompositionText" })).toEqual({
      kind: "reject",
    });
  });
  it("rejects a paste even when one character was added", () => {
    expect(inputForEdit({ before: "あ", after: "あい", inputType: "insertFromPaste" })).toEqual({
      kind: "reject",
    });
  });
  it("rejects a replacement that deleted two characters", () => {
    expect(
      inputForEdit({ before: "あい", after: "う", inputType: "insertCompositionText" }),
    ).toEqual({ kind: "reject" });
  });
});

describe("inputForEdit for a composition commit", () => {
  it("ignores a composition commit that does not change the value", () => {
    expect(
      inputForEdit({ before: "きょうは", after: "きょうは", inputType: "insertFromComposition" }),
    ).toBeNull();
  });
  it("reads a kana appended by a composition commit", () => {
    expect(
      inputForEdit({ before: "きょうは", after: "きょうは。", inputType: "insertFromComposition" }),
    ).toEqual({ kind: "kana", kana: "。" });
  });
  it("ignores a composition commit that swaps characters", () => {
    expect(
      inputForEdit({ before: "きょうは", after: "今日は", inputType: "insertFromComposition" }),
    ).toBeNull();
  });
  it("ignores a composition commit that inserts the whole word", () => {
    expect(
      inputForEdit({ before: "", after: "きょうは", inputType: "insertFromComposition" }),
    ).toBeNull();
  });
  it("ignores a composition commit that clears the value", () => {
    expect(
      inputForEdit({ before: "きょうは", after: "", inputType: "insertFromComposition" }),
    ).toBeNull();
  });
});

describe("resolveEdit", () => {
  it("uses the remembered value as the base for a composition insert", () => {
    expect(
      resolveEdit(
        { remembered: "あ", commitBase: null, stale: null },
        "insertCompositionText",
        "あい",
      ),
    ).toEqual({ before: "あ", next: { remembered: "あい", commitBase: null, stale: null } });
  });
  it("keeps the value before a composition clear as the commit base", () => {
    expect(
      resolveEdit(
        { remembered: "きょうは", commitBase: null, stale: null },
        "deleteCompositionText",
        "",
      ),
    ).toEqual({ before: null, next: { remembered: "", commitBase: "きょうは", stale: null } });
  });
  it("uses the commit base as the base for a composition commit", () => {
    expect(
      resolveEdit(
        { remembered: "", commitBase: "きょうは", stale: null },
        "insertFromComposition",
        "きょうは",
      ),
    ).toEqual({
      before: "きょうは",
      next: { remembered: "きょうは", commitBase: null, stale: null },
    });
  });
  it("uses the commit base when the commit appends a kana", () => {
    expect(
      resolveEdit(
        { remembered: "", commitBase: "きょうは", stale: null },
        "insertFromComposition",
        "きょうは。",
      ),
    ).toEqual({
      before: "きょうは",
      next: { remembered: "きょうは。", commitBase: null, stale: null },
    });
  });
  it("ignores the commit base for an input that is not a composition commit", () => {
    expect(
      resolveEdit(
        { remembered: "", commitBase: "きょうは", stale: null },
        "insertCompositionText",
        "あ",
      ),
    ).toEqual({ before: "", next: { remembered: "あ", commitBase: null, stale: null } });
  });
  it("uses the stale value as the base for the first input after a switch", () => {
    expect(
      resolveEdit(
        { remembered: "", commitBase: null, stale: "きょうは。" },
        "insertCompositionText",
        "きょうは。",
      ),
    ).toEqual({
      before: "きょうは。",
      next: { remembered: "きょうは。", commitBase: null, stale: null },
    });
  });
  it("reads only the kana appended to the stale value", () => {
    expect(
      resolveEdit(
        { remembered: "", commitBase: null, stale: "きょうは。" },
        "insertCompositionText",
        "きょうは。あ",
      ),
    ).toEqual({
      before: "きょうは。",
      next: { remembered: "きょうは。あ", commitBase: null, stale: null },
    });
  });
  it("does not treat a single character as the stale value", () => {
    expect(
      resolveEdit({ remembered: "", commitBase: null, stale: "あ" }, "insertCompositionText", "あ"),
    ).toEqual({ before: "", next: { remembered: "あ", commitBase: null, stale: null } });
  });
  it("drops the stale value when the first input does not match it", () => {
    expect(
      resolveEdit(
        { remembered: "", commitBase: null, stale: "きょうは。" },
        "insertCompositionText",
        "か",
      ),
    ).toEqual({ before: "", next: { remembered: "か", commitBase: null, stale: null } });
  });
  it("keeps the stale value through a composition clear", () => {
    expect(
      resolveEdit(
        { remembered: "", commitBase: null, stale: "きょうは。" },
        "deleteCompositionText",
        "",
      ),
    ).toEqual({ before: null, next: { remembered: "", commitBase: "", stale: "きょうは。" } });
  });
});
