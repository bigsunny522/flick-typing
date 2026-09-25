import type { Prompt } from "../game/prompts";
import { createSession, reduce } from "../game/session";
import { inputForStroke, type KeyStroke } from "../keyboard/layout";
import type { JudgeResult } from "../game/judge";
import { RULES_VERSION } from "../game/rules";
import type { EnvSnapshot } from "./env";

export type PlayLog = {
  rulesVersion: number;
  seed: number;
  promptIds: string[];
  strokes: (KeyStroke & { result: JudgeResult })[];
  final: { correct: number; miss: number; maxCombo: number; endTimeMs: number };
  env: EnvSnapshot;
  debug: boolean;
};

export function replay(seed: number, prompts: Prompt[], strokes: KeyStroke[]): PlayLog {
  let state = createSession(seed, prompts);
  const replayed: (KeyStroke & { result: JudgeResult })[] = [];
  for (const stroke of strokes) {
    const input = inputForStroke(stroke);
    if (!input) continue;
    if (state.finished || stroke.up.t >= state.endTimeMs) continue;
    state = reduce(state, { type: "stroke", t: stroke.up.t, input });
    const result = state.lastResult ?? "miss";
    replayed.push({ ...stroke, result });
  }
  return {
    final: {
      correct: state.correct,
      miss: state.miss,
      maxCombo: state.maxCombo,
      endTimeMs: state.endTimeMs,
    },
    promptIds: state.promptIds,
    strokes: replayed,
    rulesVersion: RULES_VERSION,
    seed,
    env: {
      userAgent: "",
      maxTouchPoints: 0,
      coarsePointer: false,
      webdriver: false,
      uaData: null,
      screenWidth: 0,
      screenHeight: 0,
    },
    debug: false,
  };
}
