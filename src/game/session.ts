import type { Prompt } from "./prompts";
import { judge, type JudgeInput, type JudgeResult } from "./judge";
import { RULES } from "./rules";

export type SessionState = {
  prompts: Prompt[];
  promptIndex: number;
  index: number;
  pending: string | null;
  correct: number;
  miss: number;
  combo: number;
  maxCombo: number;
  currentMiss: boolean;
  endTimeMs: number;
  bonuses: number[];
  finished: boolean;
  promptIds: string[];
  seed: number;
  lastResult: JudgeResult | null;
  lastBonusMs: number | null;
  lastPerfect: boolean;
};

export type Action = { type: "stroke"; t: number; input: JudgeInput } | { type: "tick"; t: number };

export function createSession(seed: number, prompts: Prompt[]): SessionState {
  const first = prompts[0];
  return {
    prompts,
    promptIndex: 0,
    index: 0,
    pending: null,
    correct: 0,
    miss: 0,
    combo: 0,
    maxCombo: 0,
    currentMiss: false,
    endTimeMs: RULES.baseTimeMs,
    bonuses: [],
    finished: false,
    promptIds: first ? [first.id] : [],
    seed,
    lastResult: null,
    lastBonusMs: null,
    lastPerfect: false,
  };
}

export function reduce(state: SessionState, action: Action): SessionState {
  if (state.finished) return state;
  if (action.t >= state.endTimeMs) return { ...state, finished: true };
  if (action.type === "tick" || state.prompts.length === 0) return state;
  const prompt = state.prompts[state.promptIndex];
  const judged = judge(prompt.reading, state.index, state.pending, action.input);
  if (judged.result === "miss") {
    return {
      ...state,
      miss: state.miss + 1,
      combo: 0,
      currentMiss: true,
      lastResult: judged.result,
      lastBonusMs: null,
      lastPerfect: false,
    };
  }
  let next: SessionState = {
    ...state,
    index: judged.index,
    pending: judged.pending,
    lastResult: judged.result,
    lastBonusMs: null,
    lastPerfect: false,
  };
  if (judged.result !== "advance") return next;
  next = { ...next, correct: next.correct + 1, combo: next.combo + 1 };
  next.maxCombo = Math.max(next.maxCombo, next.combo);
  if (next.combo % RULES.comboStep === 0) {
    next.endTimeMs += RULES.comboBonusMs;
    next.bonuses = [...next.bonuses, RULES.comboBonusMs];
    next.lastBonusMs = RULES.comboBonusMs;
  }
  if (next.index < prompt.reading.length) return next;
  if (!next.currentMiss) {
    next.endTimeMs += RULES.perfectBonusMs;
    next.bonuses = [...next.bonuses, RULES.perfectBonusMs];
    next.lastBonusMs = RULES.perfectBonusMs;
    next.lastPerfect = true;
  }
  const promptIndex = (next.promptIndex + 1) % next.prompts.length;
  return {
    ...next,
    promptIndex,
    promptIds: [...next.promptIds, next.prompts[promptIndex].id],
    index: 0,
    pending: null,
    currentMiss: false,
  };
}
