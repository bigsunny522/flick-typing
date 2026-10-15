import { describe, expect, it } from "vitest";
import { PASSAGES } from "../src/game/endurance";
import { TYPEABLE } from "../src/game/kana";

const expectedIds = ["melos", "kumo", "chumon", "tebukuro", "yume", "toshishun", "yodaka"];

describe("endurance data", () => {
  it("keeps the seven passages in the spec order", () => {
    expect(PASSAGES.map((passage) => passage.id)).toEqual(expectedIds);
  });
  it("does not duplicate prompt ids across passages", () => {
    const ids = PASSAGES.flatMap((passage) => passage.prompts.map((prompt) => prompt.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("uses only typeable kana in readings", () => {
    for (const passage of PASSAGES) {
      for (const prompt of passage.prompts) {
        for (const kana of [...prompt.reading]) {
          expect(TYPEABLE.has(kana), `${passage.id}/${prompt.id}: ${kana}`).toBe(true);
        }
      }
    }
  });
  it("joins chunks back into text and reading", () => {
    for (const passage of PASSAGES) {
      for (const prompt of passage.prompts) {
        expect(prompt.chunks?.map(([text]) => text).join("")).toBe(prompt.text);
        expect(prompt.chunks?.map(([, reading]) => reading).join("")).toBe(prompt.reading);
      }
    }
  });
  it("keeps every text within 32 characters", () => {
    for (const passage of PASSAGES) {
      for (const prompt of passage.prompts) {
        expect([...prompt.text].length, `${passage.id}/${prompt.id}`).toBeLessThanOrEqual(32);
      }
    }
  });
  it("keeps each passage reading total between 1200 and 1800", () => {
    for (const passage of PASSAGES) {
      const total = [...passage.prompts.map((prompt) => prompt.reading).join("")].length;
      expect(total, `${passage.id} total`).toBeGreaterThanOrEqual(1200);
      expect(total, `${passage.id} total`).toBeLessThanOrEqual(1800);
    }
  });
  it("removes source notation marks from text", () => {
    for (const passage of PASSAGES) {
      for (const prompt of passage.prompts) {
        for (const mark of ["《", "》", "｜", "［", "※"]) {
          expect(prompt.text.includes(mark), `${passage.id}/${prompt.id}`).toBe(false);
        }
      }
    }
  });
});
