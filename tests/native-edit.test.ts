import { describe, expect, it } from "vitest";
import { inputForEdit } from "../src/game/native-edit";

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
