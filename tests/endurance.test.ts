import { describe, expect, it } from "vitest";
import {
  createEndurance,
  dayNumber,
  gainFor,
  passageFor,
  reduceEndurance,
  type EnduranceState,
  type Passage,
} from "../src/game/endurance";
import type { JudgeInput } from "../src/game/judge";
import type { Prompt } from "../src/game/prompts";
import type { Action } from "../src/game/session";

const twoPrompts: Prompt[] = [
  { id: "t-001", text: "あ", reading: "あ" },
  { id: "t-002", text: "い", reading: "い" },
];

const sevenPassages: Passage[] = Array.from({ length: 7 }, (_, index) => ({
  id: `p${index + 1}`,
  title: `作品${index + 1}`,
  author: "著者",
  cardUrl: "https://example.com",
  prompts: [],
}));

function stateFor(reading: string): EnduranceState {
  return createEndurance([{ id: "t-001", text: reading, reading }]);
}

function stroke(t: number, input: JudgeInput): Action {
  return { type: "stroke", t, input };
}

function tick(t: number): Action {
  return { type: "tick", t };
}

function kana(t: number, kana: string): Action {
  return stroke(t, { kind: "kana", kana });
}

describe("endurance", () => {
  it("gains 800ms at 0 correct", () => {
    expect(gainFor(0)).toBe(800);
  });
  it("gains 800ms at 99 correct", () => {
    expect(gainFor(99)).toBe(800);
  });
  it("gains 600ms at 100 correct", () => {
    expect(gainFor(100)).toBe(600);
  });
  it("gains 450ms at 300 correct", () => {
    expect(gainFor(300)).toBe(450);
  });
  it("gains 350ms at 600 correct", () => {
    expect(gainFor(600)).toBe(350);
  });
  it("gains 250ms at 5000 correct", () => {
    expect(gainFor(5000)).toBe(250);
  });
  it("recovers time on one correct kana", () => {
    const next = reduceEndurance(stateFor("あい"), kana(2000, "あ"));
    expect(next.correct).toBe(1);
    expect(next.deadlineMs).toBe(10800);
  });
  it("caps recovery at maxMs", () => {
    const next = reduceEndurance(stateFor("あい"), kana(500, "あ"));
    expect(next.deadlineMs).toBe(10500);
  });
  it("ends on the first miss", () => {
    const next = reduceEndurance(stateFor("あい"), kana(1000, "か"));
    expect(next.finished).toBe(true);
    expect(next.end).toBe("miss");
    expect(next.miss).toEqual({ expected: "あ", typed: "か" });
    expect(next.endMs).toBe(1000);
  });
  it("does not miss while waiting for a voiced variant", () => {
    const first = reduceEndurance(stateFor("が"), kana(500, "か"));
    expect(first.pending).toBe("か");
    const second = reduceEndurance(first, stroke(600, { kind: "modifier" }));
    expect(second.correct).toBe(1);
    expect(second.finished).toBe(true);
    expect(second.end).toBe("complete");
  });
  it("does not recover time while pending", () => {
    const next = reduceEndurance(stateFor("がい"), kana(3000, "か"));
    expect(next.deadlineMs).toBe(10000);
  });
  it("misses a modifier without a pending candidate", () => {
    const next = reduceEndurance(stateFor("あ"), stroke(500, { kind: "modifier" }));
    expect(next.end).toBe("miss");
    expect(next.miss?.typed).toBe("゛゜小");
  });
  it("accepts a replace to the voiced kana", () => {
    const first = reduceEndurance(stateFor("が"), kana(500, "か"));
    const second = reduceEndurance(first, stroke(600, { kind: "replace", kana: "が" }));
    expect(second.correct).toBe(1);
    expect(second.end).toBe("complete");
  });
  it("misses on a wrong replace", () => {
    const first = reduceEndurance(stateFor("が"), kana(500, "か"));
    const second = reduceEndurance(first, stroke(600, { kind: "replace", kana: "こ" }));
    expect(second.end).toBe("miss");
    expect(second.miss?.typed).toBe("こ");
  });
  it("misses on a rejected input with typed null", () => {
    const next = reduceEndurance(stateFor("あ"), stroke(500, { kind: "reject" }));
    expect(next.end).toBe("miss");
    expect(next.miss?.typed).toBe(null);
  });
  it("does not miss on cancel", () => {
    const first = reduceEndurance(stateFor("あい"), kana(500, "あ"));
    const second = reduceEndurance(first, stroke(600, { kind: "cancel" }));
    expect(second.finished).toBe(false);
    expect(second.correct).toBe(1);
  });
  it("ends in timeout on a tick at the deadline", () => {
    const next = reduceEndurance(stateFor("あい"), tick(10000));
    expect(next.end).toBe("timeout");
    expect(next.endMs).toBe(10000);
  });
  it("does not judge a stroke at the deadline", () => {
    const next = reduceEndurance(stateFor("あい"), kana(10000, "あ"));
    expect(next.correct).toBe(0);
    expect(next.end).toBe("timeout");
  });
  it("moves to the next prompt", () => {
    const next = reduceEndurance(createEndurance(twoPrompts), kana(500, "あ"));
    expect(next.promptIndex).toBe(1);
    expect(next.index).toBe(0);
  });
  it("completes when the last prompt ends", () => {
    let state = createEndurance(twoPrompts);
    state = reduceEndurance(state, kana(500, "あ"));
    state = reduceEndurance(state, kana(600, "い"));
    expect(state.end).toBe("complete");
  });
  it("returns the same state after finish", () => {
    const finished = reduceEndurance(stateFor("あ"), kana(500, "か"));
    expect(reduceEndurance(finished, kana(700, "あ"))).toEqual(finished);
  });
  it("counts days from 2026-01-01", () => {
    expect(dayNumber("2026-01-01")).toBe(0);
  });
  it("counts 287 days for 2026-10-15", () => {
    expect(dayNumber("2026-10-15")).toBe(287);
  });
  it("picks the first passage on 2026-10-15", () => {
    expect(passageFor("2026-10-15", sevenPassages).id).toBe("p1");
  });
  it("picks the second passage on 2026-10-16", () => {
    expect(passageFor("2026-10-16", sevenPassages).id).toBe("p2");
  });
  it("picks the seventh passage on 2025-12-31", () => {
    expect(passageFor("2025-12-31", sevenPassages).id).toBe("p7");
  });
});
