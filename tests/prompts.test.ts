import { describe, expect, it } from "vitest";
import { TYPEABLE } from "../src/game/kana";
import { breakIndexes, choosePrompts, difficulty, PROMPTS } from "../src/game/prompts";

describe("prompts", () => {
  it("contains 120 prompts", () => {
    expect(PROMPTS).toHaveLength(120);
  });
  it("has unique ids", () => {
    expect(new Set(PROMPTS.map((prompt) => prompt.id)).size).toBe(120);
  });
  it("has unique text", () => {
    expect(new Set(PROMPTS.map((prompt) => prompt.text)).size).toBe(120);
  });
  it("reconstructs text and reading from chunks", () => {
    expect(
      PROMPTS.every((prompt) => prompt.chunks!.map((chunk) => chunk[0]).join("") === prompt.text),
    ).toBe(true);
    expect(
      PROMPTS.every(
        (prompt) => prompt.chunks!.map((chunk) => chunk[1]).join("") === prompt.reading,
      ),
    ).toBe(true);
  });
  it("has no empty chunk values", () => {
    expect(PROMPTS.every((prompt) => prompt.chunks!.every((chunk) => chunk.every(Boolean)))).toBe(
      true,
    );
  });
  it("has 40 prompts in each difficulty level", () => {
    expect(
      [1, 2, 3].map((level) => PROMPTS.filter((p) => difficulty(p.reading) === level).length),
    ).toEqual([40, 40, 40]);
  });
  it("returns chunk break indexes", () => {
    expect(breakIndexes(["あめあがりの", "そらに", "にじが"])).toEqual([6, 9]);
    expect(breakIndexes(["ひとつだけ"])).toEqual([]);
  });
  it("uses only typeable readings", () => {
    expect(PROMPTS.every((p) => [...p.reading].every((c) => TYPEABLE.has(c)))).toBe(true);
  });
  it("has at least 15 prompts in each level", () => {
    expect(
      [1, 2, 3].every(
        (level) => PROMPTS.filter((p) => difficulty(p.reading) === level).length >= 15,
      ),
    ).toBe(true);
  });
  it("makes a 12 character reading with one modifier level 1", () => {
    expect(difficulty("あ".repeat(11) + "が")).toBe(1);
  });
  it("makes a 13 character reading level 2", () => {
    expect(difficulty("あ".repeat(13))).toBe(2);
  });
  it("makes a 20 character reading level 3", () => {
    expect(difficulty("あ".repeat(20))).toBe(3);
  });
  it("makes four modifiers level 3", () => {
    expect(difficulty("がががが")).toBe(3);
  });
  it("chooses level 1 for the first three prompts", () => {
    expect(choosePrompts(1, PROMPTS, 3).every((p) => difficulty(p.reading) === 1)).toBe(true);
  });
  it("chooses level 2 for prompts four through six", () => {
    expect(
      choosePrompts(1, PROMPTS, 6)
        .slice(3)
        .every((p) => difficulty(p.reading) === 2),
    ).toBe(true);
  });
  it("chooses the same order for the same seed", () => {
    expect(choosePrompts(5, PROMPTS).map((p) => p.id)).toEqual(
      choosePrompts(5, PROMPTS).map((p) => p.id),
    );
  });
  it("uses every prompt before repeating in 120 selections", () => {
    expect(new Set(choosePrompts(7, PROMPTS, 120).map((prompt) => prompt.id)).size).toBe(120);
  });
  it("contains full-width punctuation but not half-width punctuation", () => {
    expect(TYPEABLE.has("？") && TYPEABLE.has("！")).toBe(true);
    expect(TYPEABLE.has("?") || TYPEABLE.has("!")).toBe(false);
  });
});
