import type { Prompt } from "../game/prompts";
import { createSession, reduce } from "../game/session";
import {
  createEndurance,
  reduceEndurance,
  type EnduranceEnd,
  type Passage,
} from "../game/endurance";
import { inputForStroke, type KeyStroke } from "../keyboard/layout";
import { inputForEdit } from "../game/native-edit";
import type { JudgeResult } from "../game/judge";
import { RULES_VERSION, ENDURANCE_RULES_VERSION } from "../game/rules";
import type { EnvSnapshot } from "./env";
import type { NativeEditLog } from "./native";
import type { PlayMode } from "../storage";

export type PlayLog = {
  rulesVersion: number;
  mode: PlayMode;
  seed: number;
  promptIds: string[];
  strokes: (KeyStroke & { result: JudgeResult })[]; // native のときは []
  edits: (NativeEditLog & { result: JudgeResult })[]; // flick のときは []
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
    edits: [],
    mode: "flick",
    rulesVersion: RULES_VERSION,
    seed,
    env: emptyEnv(),
    debug: false,
  };
}

export function replayNative(seed: number, prompts: Prompt[], edits: NativeEditLog[]): PlayLog {
  let state = createSession(seed, prompts);
  const replayed: (NativeEditLog & { result: JudgeResult })[] = [];
  for (const edit of edits) {
    const input = inputForEdit(edit);
    if (!input) continue;
    if (state.finished || edit.t >= state.endTimeMs) continue;
    state = reduce(state, { type: "stroke", t: edit.t, input });
    const result = state.lastResult ?? "miss";
    replayed.push({ ...edit, result });
  }
  return {
    final: {
      correct: state.correct,
      miss: state.miss,
      maxCombo: state.maxCombo,
      endTimeMs: state.endTimeMs,
    },
    promptIds: state.promptIds,
    strokes: [],
    edits: replayed,
    mode: "native",
    rulesVersion: RULES_VERSION,
    seed,
    env: emptyEnv(),
    debug: false,
  };
}

export type EnduranceLog = {
  rulesVersion: number;
  kind: "endurance";
  mode: PlayMode;
  dateKey: string;
  passageId: string;
  strokes: (KeyStroke & { result: JudgeResult })[]; // native のときは []
  edits: (NativeEditLog & { result: JudgeResult })[]; // flick のときは []
  final: { correct: number; end: EnduranceEnd; endMs: number };
  env: EnvSnapshot;
  debug: boolean;
};

export function replayEndurance(
  dateKey: string,
  passage: Passage,
  input: { mode: "flick"; strokes: KeyStroke[] } | { mode: "native"; edits: NativeEditLog[] },
): EnduranceLog {
  let state = createEndurance(passage.prompts);
  const replayedStrokes: (KeyStroke & { result: JudgeResult })[] = [];
  const replayedEdits: (NativeEditLog & { result: JudgeResult })[] = [];
  if (input.mode === "flick") {
    for (const stroke of input.strokes) {
      const judged = inputForStroke(stroke);
      if (!judged) continue;
      if (state.finished || stroke.up.t >= state.deadlineMs) continue;
      state = reduceEndurance(state, { type: "stroke", t: stroke.up.t, input: judged });
      replayedStrokes.push({ ...stroke, result: state.lastResult ?? "miss" });
    }
  } else {
    for (const edit of input.edits) {
      const judged = inputForEdit(edit);
      if (!judged) continue;
      if (state.finished || edit.t >= state.deadlineMs) continue;
      state = reduceEndurance(state, { type: "stroke", t: edit.t, input: judged });
      replayedEdits.push({ ...edit, result: state.lastResult ?? "miss" });
    }
  }
  if (!state.finished) {
    state = reduceEndurance(state, { type: "tick", t: state.deadlineMs });
  }
  return {
    rulesVersion: ENDURANCE_RULES_VERSION,
    kind: "endurance",
    mode: input.mode,
    dateKey,
    passageId: passage.id,
    strokes: replayedStrokes,
    edits: replayedEdits,
    final: {
      correct: state.correct,
      end: state.end ?? "timeout",
      endMs: state.endMs ?? state.deadlineMs,
    },
    env: emptyEnv(),
    debug: false,
  };
}

function emptyEnv(): EnvSnapshot {
  return {
    userAgent: "",
    maxTouchPoints: 0,
    coarsePointer: false,
    webdriver: false,
    uaData: null,
    screenWidth: 0,
    screenHeight: 0,
  };
}
