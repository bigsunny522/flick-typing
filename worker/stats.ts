import { PASSAGES, passageFor } from "../src/game/endurance";
import type { PlayMode } from "../src/game/mode";
import { ENDURANCE_RULES_VERSION, RULES_VERSION } from "../src/game/rules";
import {
  endurancePlayBins,
  jstDateKey,
  summarizeEndurance,
  summarizeTimeAttack,
  timeAttackPlayBins,
  totalReading,
  type EnduranceRow,
  type StatsResponse,
  type TimeAttackRow,
} from "../src/stats/summary";
import type { Env } from "./index";

type TimeAttackRecord = {
  player_id: string;
  mode: string;
  correct: number;
  miss: number;
  duration_ms: number;
};

type EnduranceRecord = {
  player_id: string;
  mode: string;
  correct: number;
};

export async function handleStats(env: Env): Promise<Response> {
  const dateKey = jstDateKey(Date.now());
  const passage = passageFor(dateKey, PASSAGES);
  const timeattack = await env.DB.prepare(
    "SELECT player_id, mode, correct, miss, duration_ms FROM results " +
      "WHERE kind = 'timeattack' AND rules_version = ?1",
  )
    .bind(RULES_VERSION)
    .all<TimeAttackRecord>();
  const endurance = await env.DB.prepare(
    "SELECT player_id, mode, correct FROM results " +
      "WHERE kind = 'endurance' AND rules_version = ?1 AND date_key = ?2",
  )
    .bind(ENDURANCE_RULES_VERSION, dateKey)
    .all<EnduranceRecord>();
  const total = totalReading(passage);
  const timeattackFlick = timeAttackRows(timeattack.results, "flick");
  const timeattackNative = timeAttackRows(timeattack.results, "native");
  const enduranceFlick = enduranceRows(endurance.results, "flick");
  const enduranceNative = enduranceRows(endurance.results, "native");
  const stats: StatsResponse = {
    timeattack: {
      rulesVersion: RULES_VERSION,
      flick: { ...summarizeTimeAttack(timeattackFlick), all: timeAttackPlayBins(timeattackFlick) },
      native: {
        ...summarizeTimeAttack(timeattackNative),
        all: timeAttackPlayBins(timeattackNative),
      },
    },
    endurance: {
      rulesVersion: ENDURANCE_RULES_VERSION,
      dateKey,
      passageId: passage.id,
      totalReading: total,
      flick: {
        ...summarizeEndurance(enduranceFlick),
        all: endurancePlayBins(enduranceFlick, total),
      },
      native: {
        ...summarizeEndurance(enduranceNative),
        all: endurancePlayBins(enduranceNative, total),
      },
    },
  };
  return new Response(JSON.stringify(stats), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  });
}

function timeAttackRows(records: TimeAttackRecord[], mode: PlayMode): TimeAttackRow[] {
  return records
    .filter((record) => record.mode === mode)
    .map((record) => ({
      playerId: record.player_id,
      correct: record.correct,
      miss: record.miss,
      durationMs: record.duration_ms,
    }));
}

function enduranceRows(records: EnduranceRecord[], mode: PlayMode): EnduranceRow[] {
  return records
    .filter((record) => record.mode === mode)
    .map((record) => ({
      playerId: record.player_id,
      correct: record.correct,
    }));
}
