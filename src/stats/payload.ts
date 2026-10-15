import { PASSAGES, passageFor, type EnduranceEnd } from "../game/endurance";
import type { PlayMode } from "../game/mode";
import { RULES } from "../game/rules";
import { previousDateKey, totalReading } from "./summary";

/** 1秒あたりの文字数の上限 */
const MAX_CPS = 15;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type TimeAttackPayload = {
  kind: "timeattack";
  playerId: string;
  mode: PlayMode;
  rulesVersion: number; // RULES_VERSION
  correct: number;
  miss: number;
  maxCombo: number;
  durationMs: number; // final.endTimeMs(ボーナス込みのプレイ時間)
};

export type EndurancePayload = {
  kind: "endurance";
  playerId: string;
  mode: PlayMode;
  rulesVersion: number; // ENDURANCE_RULES_VERSION
  dateKey: string; // "2026-10-16"(日本時間)
  passageId: string;
  correct: number;
  end: EnduranceEnd;
  endMs: number; // 終わった時刻(開始からの ms)
};

export type ResultPayload = TimeAttackPayload | EndurancePayload;

export type ValidateResult = { ok: true; payload: ResultPayload } | { ok: false; reason: string };

function fail(reason: string): ValidateResult {
  return { ok: false, reason };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isInt(value: unknown): value is number {
  return Number.isInteger(value);
}

function isKind(value: unknown): value is "timeattack" | "endurance" {
  return value === "timeattack" || value === "endurance";
}

function isMode(value: unknown): value is PlayMode {
  return value === "flick" || value === "native";
}

function isEnd(value: unknown): value is EnduranceEnd {
  return value === "miss" || value === "timeout" || value === "complete";
}

export function validatePayload(body: unknown, todayKey: string): ValidateResult {
  if (!isObject(body)) return fail("body");
  const kind = body.kind;
  if (!isKind(kind)) return fail("kind");
  const playerId = body.playerId;
  if (typeof playerId !== "string" || !UUID_PATTERN.test(playerId)) return fail("playerId");
  const mode = body.mode;
  if (!isMode(mode)) return fail("mode");
  const rulesVersion = body.rulesVersion;
  if (typeof rulesVersion !== "number" || !isInt(rulesVersion) || rulesVersion < 1) {
    return fail("rulesVersion");
  }
  if (kind === "timeattack") return validateTimeAttack(body, playerId, mode, rulesVersion);
  return validateEndurance(body, playerId, mode, rulesVersion, todayKey);
}

function validateTimeAttack(
  body: Record<string, unknown>,
  playerId: string,
  mode: PlayMode,
  rulesVersion: number,
): ValidateResult {
  const durationMs = body.durationMs;
  if (!isInt(durationMs) || durationMs < RULES.baseTimeMs) return fail("durationMs");
  const correct = body.correct;
  if (!isInt(correct) || correct < 0) return fail("correct");
  const miss = body.miss;
  if (!isInt(miss) || miss < 0 || miss > 10000) return fail("miss");
  const maxCombo = body.maxCombo;
  if (!isInt(maxCombo) || maxCombo < 0) return fail("maxCombo");
  if (durationMs > RULES.baseTimeMs + correct * 1000) return fail("durationMs");
  if (correct > (durationMs / 1000) * MAX_CPS) return fail("correct");
  if (maxCombo > correct) return fail("maxCombo");
  return {
    ok: true,
    payload: {
      kind: "timeattack",
      playerId,
      mode,
      rulesVersion,
      correct,
      miss,
      maxCombo,
      durationMs,
    },
  };
}

function validateEndurance(
  body: Record<string, unknown>,
  playerId: string,
  mode: PlayMode,
  rulesVersion: number,
  todayKey: string,
): ValidateResult {
  const dateKey = body.dateKey;
  const yesterday = previousDateKey(todayKey);
  if (typeof dateKey !== "string" || (dateKey !== todayKey && dateKey !== yesterday)) {
    return fail("dateKey");
  }
  const passage = passageFor(dateKey, PASSAGES);
  const passageId = body.passageId;
  if (typeof passageId !== "string" || passageId !== passage.id) return fail("passageId");
  const end = body.end;
  if (!isEnd(end)) return fail("end");
  const reading = totalReading(passage);
  const correct = body.correct;
  if (!isInt(correct) || correct < 0 || correct > reading) return fail("correct");
  if (end === "complete" && correct !== reading) return fail("correct");
  const endMs = body.endMs;
  if (!isInt(endMs) || endMs < 0) return fail("endMs");
  if (correct >= 1 && correct > (endMs / 1000) * MAX_CPS) return fail("endMs");
  return {
    ok: true,
    payload: {
      kind: "endurance",
      playerId,
      mode,
      rulesVersion,
      dateKey,
      passageId,
      correct,
      end,
      endMs,
    },
  };
}
