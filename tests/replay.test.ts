import { describe, expect, it } from "vitest";
import { replay } from "../src/anticheat/log";
import type { Prompt } from "../src/game/prompts";
import { createSession, reduce } from "../src/game/session";
import type { KeyStroke } from "../src/keyboard/layout";

const prompt: Prompt = { id: "one", text: "あ", reading: "あ" };
const stroke: KeyStroke = {
  key: "a",
  dir: "tap",
  down: { x: 1, y: 1, t: 0 },
  up: { x: 1, y: 1, t: 10 },
  moves: 1,
  width: 20,
  height: 20,
  pressure: 0.5,
};
describe("replay", () => {
  it("matches a raw reduce final state", () => {
    const raw = reduce(createSession(1, [prompt]), {
      type: "stroke",
      t: 10,
      input: { kind: "kana", kana: "あ" },
    });
    const replayed = replay(1, [prompt], [stroke]);
    expect(replayed.final).toMatchObject({
      correct: raw.correct,
      miss: raw.miss,
      maxCombo: raw.maxCombo,
      endTimeMs: raw.endTimeMs,
    });
  });
  it("records pending and cycle results", () => {
    const target = { id: "pa", text: "ぱ", reading: "ぱ" };
    const kana = { ...stroke, key: "ha" as const };
    const modifier = { ...stroke, key: "mod" as const, up: { x: 1, y: 1, t: 20 } };
    const log = replay(1, [target], [kana, modifier, { ...modifier, up: { x: 1, y: 1, t: 30 } }]);
    expect(log.strokes.map((item) => item.result)).toEqual(["pending", "cycle", "advance"]);
  });
  it("does not log a stroke at the end time", () => {
    const late = { ...stroke, up: { x: 1, y: 1, t: 60000 } };
    expect(replay(1, [prompt], [late]).strokes).toEqual([]);
  });
});
