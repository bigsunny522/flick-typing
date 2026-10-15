import data from "../data/endurance.json";
import { judge, type JudgeInput, type JudgeResult } from "./judge";
import type { Prompt } from "./prompts";
import { ENDURANCE_RULES } from "./rules";
import type { Action } from "./session";

export type Passage = {
  id: string;
  title: string;
  author: string;
  cardUrl: string;
  prompts: Prompt[];
};
export const PASSAGES = data as Passage[];

export type EnduranceEnd = "miss" | "timeout" | "complete";

export type EnduranceState = {
  prompts: Prompt[];
  promptIndex: number;
  index: number; // 今の文の読みの何文字目か
  pending: string | null;
  correct: number;
  deadlineMs: number; // 開始からこの時刻(ms)で時間切れ
  finished: boolean;
  end: EnduranceEnd | null;
  endMs: number | null; // 終わった時刻(開始からの ms)
  miss: { expected: string; typed: string | null } | null; // typed が null は「受け付けない入力」
  lastResult: JudgeResult | null;
};

export function gainFor(correct: number): number {
  let gain: number = ENDURANCE_RULES.gains[0].gainMs;
  for (const row of ENDURANCE_RULES.gains) {
    if (row.from <= correct) gain = row.gainMs;
  }
  return gain;
}

export function createEndurance(prompts: Prompt[]): EnduranceState {
  return {
    prompts,
    promptIndex: 0,
    index: 0,
    pending: null,
    correct: 0,
    deadlineMs: ENDURANCE_RULES.startMs,
    finished: false,
    end: null,
    endMs: null,
    miss: null,
    lastResult: null,
  };
}

function typedOf(input: JudgeInput): string | null {
  if (input.kind === "kana" || input.kind === "replace") return input.kana;
  if (input.kind === "modifier") return "゛゜小";
  return null;
}

export function reduceEndurance(state: EnduranceState, action: Action): EnduranceState {
  if (state.finished) return state;
  if (action.t >= state.deadlineMs) {
    return { ...state, finished: true, end: "timeout", endMs: state.deadlineMs };
  }
  if (action.type === "tick") return state;
  const prompt = state.prompts[state.promptIndex];
  const judged = judge(prompt.reading, state.index, state.pending, action.input);
  if (judged.result === "miss") {
    return {
      ...state,
      finished: true,
      end: "miss",
      endMs: action.t,
      miss: { expected: prompt.reading[state.index], typed: typedOf(action.input) },
      pending: judged.pending,
      lastResult: judged.result,
    };
  }
  if (judged.result !== "advance") {
    return { ...state, index: judged.index, pending: judged.pending, lastResult: judged.result };
  }
  const deadlineMs = Math.min(
    action.t + ENDURANCE_RULES.maxMs,
    state.deadlineMs + gainFor(state.correct),
  );
  const correct = state.correct + 1;
  const lastResult = judged.result;
  if (judged.index < prompt.reading.length) {
    return { ...state, index: judged.index, pending: null, deadlineMs, correct, lastResult };
  }
  if (state.promptIndex + 1 >= state.prompts.length) {
    return {
      ...state,
      index: judged.index,
      pending: null,
      deadlineMs,
      correct,
      lastResult,
      finished: true,
      end: "complete",
      endMs: action.t,
    };
  }
  return {
    ...state,
    promptIndex: state.promptIndex + 1,
    index: 0,
    pending: null,
    deadlineMs,
    correct,
    lastResult,
  };
}

/** "2026-10-15" のような日付から、2026-01-01 を 0 とした通し日数を返す */
export function dayNumber(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  const epoch = Date.UTC(2026, 0, 1);
  return Math.floor((Date.UTC(year, month - 1, day) - epoch) / 86400000);
}

/** その日の文章。dayNumber を passages.length で割った余り(負の日も 0 以上にする) */
export function passageFor(dateKey: string, passages: Passage[]): Passage {
  const index = ((dayNumber(dateKey) % passages.length) + passages.length) % passages.length;
  return passages[index];
}
