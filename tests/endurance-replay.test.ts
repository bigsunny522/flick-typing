import { describe, expect, it } from "vitest";
import { replayEndurance } from "../src/anticheat/log";
import type { NativeEditLog } from "../src/anticheat/native";
import {
  createEndurance,
  reduceEndurance,
  type EnduranceState,
  type Passage,
} from "../src/game/endurance";
import { inputForEdit } from "../src/game/native-edit";
import type { Prompt } from "../src/game/prompts";
import type { KeyStroke } from "../src/keyboard/layout";

const pair: Prompt = { id: "pair", text: "あい", reading: "あい" };
const passage: Passage = {
  id: "p1",
  title: "テスト",
  author: "著者",
  cardUrl: "https://example.com",
  prompts: [pair],
};
const dateKey = "2026-10-15";

function stroke(t: number, key: KeyStroke["key"] = "a", dir: KeyStroke["dir"] = "tap"): KeyStroke {
  return {
    key,
    dir,
    down: { x: 1, y: 1, t: t - 10 },
    up: { x: 1, y: 1, t },
    moves: 1,
    width: 20,
    height: 20,
    pressure: 0.5,
  };
}

function edit(t: number, before: string, after: string): NativeEditLog {
  return {
    t,
    inputType: "insertCompositionText",
    before,
    after,
    trusted: true,
    viewportRatio: 0.45,
  };
}

function advance(state: EnduranceState, t: number, kana: string): EnduranceState {
  return reduceEndurance(state, { type: "stroke", t, input: { kind: "kana", kana } });
}

describe("replayEndurance", () => {
  it("matches a raw reduce final state for flick strokes", () => {
    let raw = createEndurance([pair]);
    raw = advance(raw, 10, "あ");
    raw = advance(raw, 210, "い");
    const log = replayEndurance(dateKey, passage, {
      mode: "flick",
      strokes: [stroke(10), stroke(210, "a", "left")],
    });
    expect(log.final).toMatchObject({
      correct: raw.correct,
      end: raw.end,
      endMs: raw.endMs,
    });
  });
  it("matches a raw reduce final state for native edits", () => {
    const edits = [edit(10, "", "あ"), edit(210, "あ", "あい")];
    let raw = createEndurance([pair]);
    for (const item of edits) {
      const judged = inputForEdit(item);
      if (judged) raw = reduceEndurance(raw, { type: "stroke", t: item.t, input: judged });
    }
    const log = replayEndurance(dateKey, passage, { mode: "native", edits });
    expect(log.final).toMatchObject({
      correct: raw.correct,
      end: raw.end,
      endMs: raw.endMs,
    });
    expect(log.mode).toBe("native");
    expect(log.strokes).toEqual([]);
  });
  it("drops edits that do not change the value", () => {
    const withNoop = [edit(10, "", "あ"), edit(150, "あ", "あ"), edit(210, "あ", "あい")];
    const without = [edit(10, "", "あ"), edit(210, "あ", "あい")];
    const mixed = replayEndurance(dateKey, passage, { mode: "native", edits: withNoop });
    const clean = replayEndurance(dateKey, passage, { mode: "native", edits: without });
    expect(mixed.edits).toEqual(clean.edits);
    expect(mixed.final).toEqual(clean.final);
  });
  it("does not log strokes after a miss", () => {
    const single: Prompt = { id: "one", text: "い", reading: "い" };
    const only: Passage = { ...passage, prompts: [single] };
    const log = replayEndurance(dateKey, only, {
      mode: "flick",
      strokes: [stroke(10), stroke(200)],
    });
    expect(log.strokes).toHaveLength(1);
    expect(log.final.end).toBe("miss");
  });
  it("ends in timeout when the strokes stop before the deadline", () => {
    const log = replayEndurance(dateKey, passage, { mode: "flick", strokes: [stroke(10)] });
    expect(log.final.end).toBe("timeout");
    expect(log.final.correct).toBe(1);
  });
});
