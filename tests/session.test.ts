import { describe, expect, it } from "vitest";
import type { Prompt } from "../src/game/prompts";
import { createSession, reduce } from "../src/game/session";

const short: Prompt = { id: "short", text: "あ", reading: "あ" };
const stroke = (t: number, kana = "あ") => ({
  type: "stroke" as const,
  t,
  input: { kind: "kana" as const, kana },
});

describe("session", () => {
  it("adds one second at 20 combo", () => {
    const long = { id: "long", text: "", reading: "あ".repeat(20) };
    let state = createSession(1, [long]);
    for (let index = 0; index < 20; index += 1) state = reduce(state, stroke(index));
    expect(state.endTimeMs).toBe(62000);
  });
  it("adds one second for a perfect sentence", () => {
    expect(reduce(createSession(1, [short]), stroke(0)).endTimeMs).toBe(61000);
  });
  it("marks a perfect sentence completion", () => {
    expect(reduce(createSession(1, [short]), stroke(0)).lastPerfect).toBe(true);
  });
  it("records the latest bonus", () => {
    expect(reduce(createSession(1, [short]), stroke(0)).lastBonusMs).toBe(1000);
  });
  it("does not add the perfect bonus after a miss", () => {
    let state = createSession(1, [short]);
    state = reduce(state, stroke(0, "い"));
    state = reduce(state, stroke(1));
    expect(state.endTimeMs).toBe(60000);
  });
  it("resets combo to zero on a miss", () => {
    let state = createSession(1, [{ ...short, reading: "ああ" }]);
    state = reduce(state, stroke(0));
    state = reduce(state, stroke(1, "い"));
    expect(state.combo).toBe(0);
  });
  it("does not judge a stroke at the end time", () => {
    const state = reduce(createSession(1, [short]), stroke(60000));
    expect(state.correct).toBe(0);
  });
  it("ignores actions after finishing", () => {
    const finished = reduce(createSession(1, [short]), { type: "tick", t: 60000 });
    expect(reduce(finished, stroke(0))).toBe(finished);
  });
  it("is deterministic for the same seed and actions", () => {
    const actions = [stroke(0), stroke(1, "い"), { type: "tick" as const, t: 2 }];
    const replay = () =>
      actions.reduce((state, action) => reduce(state, action), createSession(8, [short]));
    expect(replay()).toEqual(replay());
  });
});
