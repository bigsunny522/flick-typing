import { describe, expect, it } from "vitest";
import { PASSAGES, passageFor } from "../src/game/endurance";
import { RULES } from "../src/game/rules";
import { validatePayload } from "../src/stats/payload";
import { previousDateKey, totalReading } from "../src/stats/summary";

const TODAY = "2026-10-16";
const PLAYER_ID = "1f4e9a3c-2b7d-4e5f-8a9b-0c1d2e3f4a5b";
const passage = passageFor(TODAY, PASSAGES);
const reading = totalReading(passage);

function timeattack(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: "timeattack",
    playerId: PLAYER_ID,
    mode: "flick",
    rulesVersion: 1,
    correct: 100,
    miss: 5,
    maxCombo: 50,
    durationMs: RULES.baseTimeMs,
    ...overrides,
  };
}

function endurance(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: "endurance",
    playerId: PLAYER_ID,
    mode: "native",
    rulesVersion: 1,
    dateKey: TODAY,
    passageId: passage.id,
    correct: 10,
    end: "miss",
    endMs: 10000,
    ...overrides,
  };
}

describe("validatePayload", () => {
  it("正しいタイムアタックのデータが ok になる", () => {
    const body = timeattack();
    expect(validatePayload(body, TODAY)).toEqual({ ok: true, payload: body });
  });

  it("正しい耐久のデータが ok になる", () => {
    const body = endurance();
    expect(validatePayload(body, TODAY)).toEqual({ ok: true, payload: body });
  });

  it("タイムアタックの余計なキーは payload に入らない", () => {
    const body = timeattack({ extra: 1, junk: "x" });
    expect(validatePayload(body, TODAY)).toEqual({ ok: true, payload: timeattack() });
  });

  it("耐久の余計なキーは payload に入らない", () => {
    const body = endurance({ extra: 1, junk: "x" });
    expect(validatePayload(body, TODAY)).toEqual({ ok: true, payload: endurance() });
  });

  it("body がオブジェクトでない", () => {
    expect(validatePayload(null, TODAY)).toEqual({ ok: false, reason: "body" });
    expect(validatePayload("{}", TODAY)).toEqual({ ok: false, reason: "body" });
    expect(validatePayload(42, TODAY)).toEqual({ ok: false, reason: "body" });
  });

  it("kind が timeattack/endurance でない", () => {
    expect(validatePayload(timeattack({ kind: "sprint" }), TODAY)).toEqual({
      ok: false,
      reason: "kind",
    });
    expect(validatePayload(endurance({ kind: "sprint" }), TODAY)).toEqual({
      ok: false,
      reason: "kind",
    });
  });

  it("playerId が crypto.randomUUID() の形でない", () => {
    expect(validatePayload(timeattack({ playerId: "player-1" }), TODAY)).toEqual({
      ok: false,
      reason: "playerId",
    });
    expect(
      validatePayload(timeattack({ playerId: "1f4e9a3c-2b7d-4e5f-8a9b-0c1d2e3f4a5z" }), TODAY),
    ).toEqual({ ok: false, reason: "playerId" });
    expect(
      validatePayload(timeattack({ playerId: "1F4E9A3C-2B7D-4E5F-8A9B-0C1D2E3F4A5B" }), TODAY),
    ).toEqual({
      ok: false,
      reason: "playerId",
    });
    expect(validatePayload(timeattack({ playerId: 123 }), TODAY)).toEqual({
      ok: false,
      reason: "playerId",
    });
  });

  it("mode が flick/native でない", () => {
    expect(validatePayload(timeattack({ mode: "keyboard" }), TODAY)).toEqual({
      ok: false,
      reason: "mode",
    });
    expect(validatePayload(endurance({ mode: "gamepad" }), TODAY)).toEqual({
      ok: false,
      reason: "mode",
    });
  });

  it("rulesVersion が 1 以上の整数でない", () => {
    expect(validatePayload(timeattack({ rulesVersion: 0 }), TODAY)).toEqual({
      ok: false,
      reason: "rulesVersion",
    });
    expect(validatePayload(timeattack({ rulesVersion: 1.5 }), TODAY)).toEqual({
      ok: false,
      reason: "rulesVersion",
    });
    expect(validatePayload(timeattack({ rulesVersion: "1" }), TODAY)).toEqual({
      ok: false,
      reason: "rulesVersion",
    });
  });

  it("durationMs が RULES.baseTimeMs 未満", () => {
    const body = timeattack({ durationMs: RULES.baseTimeMs - 1 });
    expect(validatePayload(body, TODAY)).toEqual({ ok: false, reason: "durationMs" });
  });

  it("durationMs が RULES.baseTimeMs + correct * 1000 を超える", () => {
    const body = timeattack({ durationMs: RULES.baseTimeMs + 100 * 1000 + 1 });
    expect(validatePayload(body, TODAY)).toEqual({ ok: false, reason: "durationMs" });
  });

  it("correct が durationMs / 1000 * 15 を超える", () => {
    const body = timeattack({ correct: 901 });
    expect(validatePayload(body, TODAY)).toEqual({ ok: false, reason: "correct" });
  });

  it("correct が 0 未満", () => {
    const body = timeattack({ correct: -1 });
    expect(validatePayload(body, TODAY)).toEqual({ ok: false, reason: "correct" });
  });

  it("miss が 0 以上 10000 以下でない", () => {
    expect(validatePayload(timeattack({ miss: -1 }), TODAY)).toEqual({ ok: false, reason: "miss" });
    expect(validatePayload(timeattack({ miss: 10001 }), TODAY)).toEqual({
      ok: false,
      reason: "miss",
    });
  });

  it("maxCombo が correct を超える", () => {
    const body = timeattack({ maxCombo: 101 });
    expect(validatePayload(body, TODAY)).toEqual({ ok: false, reason: "maxCombo" });
  });

  it("correct に小数・文字列・NaN を入れると落ちる", () => {
    expect(validatePayload(timeattack({ correct: 100.5 }), TODAY)).toEqual({
      ok: false,
      reason: "correct",
    });
    expect(validatePayload(timeattack({ correct: "100" }), TODAY)).toEqual({
      ok: false,
      reason: "correct",
    });
    expect(validatePayload(timeattack({ correct: NaN }), TODAY)).toEqual({
      ok: false,
      reason: "correct",
    });
  });

  it("dateKey が前日なら通る", () => {
    const yesterday = previousDateKey(TODAY);
    const body = endurance({ dateKey: yesterday, passageId: passageFor(yesterday, PASSAGES).id });
    expect(validatePayload(body, TODAY)).toEqual({ ok: true, payload: body });
  });

  it("dateKey が 2 日前なら落ちる", () => {
    const twoDaysAgo = previousDateKey(previousDateKey(TODAY));
    const body = endurance({ dateKey: twoDaysAgo, passageId: passageFor(twoDaysAgo, PASSAGES).id });
    expect(validatePayload(body, TODAY)).toEqual({ ok: false, reason: "dateKey" });
  });

  it("dateKey が翌日なら落ちる", () => {
    const body = endurance({ dateKey: "2026-10-17" });
    expect(validatePayload(body, TODAY)).toEqual({ ok: false, reason: "dateKey" });
  });

  it("passageId がその日の文章と違う", () => {
    const body = endurance({ passageId: "not-todays-passage" });
    expect(validatePayload(body, TODAY)).toEqual({ ok: false, reason: "passageId" });
  });

  it("end が miss/timeout/complete でない", () => {
    const body = endurance({ end: "giveup" });
    expect(validatePayload(body, TODAY)).toEqual({ ok: false, reason: "end" });
  });

  it("correct が 0 未満", () => {
    const body = endurance({ correct: -1 });
    expect(validatePayload(body, TODAY)).toEqual({ ok: false, reason: "correct" });
  });

  it("correct が文章の読みの合計より大きい", () => {
    const body = endurance({ correct: reading + 1 });
    expect(validatePayload(body, TODAY)).toEqual({ ok: false, reason: "correct" });
  });

  it("end が complete のとき correct が合計と違う", () => {
    const body = endurance({ end: "complete", correct: reading - 1, endMs: reading * 100 });
    expect(validatePayload(body, TODAY)).toEqual({ ok: false, reason: "correct" });
  });

  it("endMs が 0 未満", () => {
    const body = endurance({ endMs: -1 });
    expect(validatePayload(body, TODAY)).toEqual({ ok: false, reason: "endMs" });
  });

  it("correct が 1 以上なのに endMs が足りない", () => {
    const body = endurance({ correct: 10, endMs: 100 });
    expect(validatePayload(body, TODAY)).toEqual({ ok: false, reason: "endMs" });
  });
});
