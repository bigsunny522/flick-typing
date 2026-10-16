import { PASSAGES, passageFor } from "../src/game/endurance";
import { ENDURANCE_RULES_VERSION, RULES_VERSION } from "../src/game/rules";
import { DEFAULT_NAME } from "../src/ranking/name";
import { dayLabel, jstWeekRange, weekRangeLabel } from "../src/ranking/period";
import {
  isRankingBoard,
  type RankChance,
  type RankChances,
  type RankingBoard,
  type RankingEntry,
  type RankingResponse,
} from "../src/ranking/types";
import type { ResultPayload } from "../src/stats/payload";
import { jstDateKey } from "../src/stats/summary";
import type { Env } from "./index";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOP_ENTRIES = 100;

/** 期間の絞り方。created_at で絞る週、date_key で絞る日、絞らない歴代 */
type WindowFilter =
  | { type: "created"; startUtc: string; endUtc: string }
  | { type: "date"; dateKey: string }
  | { type: "all" };

/** SQL から返ってくる1行 */
type RankedRowRaw = { rank: number; player_id: string; correct: number; name: string | null };

/** 順位の1行。`playerId` はレスポンスには入れない */
type RankedRow = { rank: number; playerId: string; correct: number; name: string | null };

/** 送った記録の順位を数えた1行 */
type ChanceRow = { better_players: number; better_own: number };

function isTimeAttackBoard(board: RankingBoard): boolean {
  return board === "timeattack-weekly" || board === "timeattack-alltime";
}

/** 期間の絞り方。`dateKey` は endurance-daily の日を上書きする(結果送信が前日のとき) */
function windowFor(board: RankingBoard, nowMs: number, dateKey?: string): WindowFilter {
  if (board === "timeattack-weekly") {
    const week = jstWeekRange(nowMs);
    return { type: "created", startUtc: week.startUtc, endUtc: week.endUtc };
  }
  if (board === "endurance-daily") return { type: "date", dateKey: dateKey ?? jstDateKey(nowMs) };
  return { type: "all" };
}

/** 種目・mode・ルールの版・期間・banと、載せた記録だけに絞る条件。番号は `param` の順に振る */
function conditionList(
  board: RankingBoard,
  window: WindowFilter,
  param: (value: unknown) => string,
): string[] {
  const timeAttack = isTimeAttackBoard(board);
  const rulesVersion = timeAttack ? RULES_VERSION : ENDURANCE_RULES_VERSION;
  const conditions = [
    `r.kind = ${param(timeAttack ? "timeattack" : "endurance")}`,
    "r.mode = 'native'",
    `r.rules_version = ${param(rulesVersion)}`,
    "r.ranked = 1",
  ];
  if (window.type === "created") {
    conditions.push(`r.created_at >= ${param(window.startUtc)}`);
    conditions.push(`r.created_at < ${param(window.endUtc)}`);
  } else if (window.type === "date") {
    conditions.push(`r.date_key = ${param(window.dateKey)}`);
  }
  conditions.push("COALESCE(p.banned, 0) = 0");
  return conditions;
}

/** 対象の行・並べ方・順位を1つの SQL で求める。順位は 1 から始まる */
function rankedSql(
  board: RankingBoard,
  window: WindowFilter,
  playerId: string | null,
): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const param = (value: unknown): string => {
    values.push(value);
    return `?${values.length}`;
  };
  const timeAttack = isTimeAttackBoard(board);
  const tiebreak = timeAttack ? "miss" : "end_ms";
  const conditions = conditionList(board, window, param);
  let outerCondition = `ranked.rank <= ${TOP_ENTRIES}`;
  if (playerId !== null) outerCondition += ` OR ranked.player_id = ${param(playerId)}`;
  const sql = `
    WITH best AS (
      SELECT r.player_id, r.correct, r.miss, r.end_ms, r.id,
        ROW_NUMBER() OVER (
          PARTITION BY r.player_id
          ORDER BY r.correct DESC, r.${tiebreak} ASC, r.id ASC
        ) AS rn
      FROM results r LEFT JOIN players p ON p.player_id = r.player_id
      WHERE ${conditions.join(" AND ")}
    ),
    ranked AS (
      SELECT player_id, correct,
        ROW_NUMBER() OVER (ORDER BY correct DESC, ${tiebreak} ASC, id ASC) AS rank
      FROM best WHERE rn = 1
    )
    SELECT ranked.rank AS rank, ranked.correct AS correct,
      ranked.player_id AS player_id, players.name AS name
    FROM ranked LEFT JOIN players ON players.player_id = ranked.player_id
    WHERE ${outerCondition}
    ORDER BY ranked.rank
  `;
  return { sql, values };
}

async function fetchRanked(
  env: Env,
  board: RankingBoard,
  window: WindowFilter,
  playerId: string | null,
): Promise<RankedRow[]> {
  const { sql, values } = rankedSql(board, window, playerId);
  const result = await env.DB.prepare(sql)
    .bind(...values)
    .all<RankedRowRaw>();
  return result.results.map((row) => ({
    rank: row.rank,
    playerId: row.player_id,
    correct: row.correct,
    name: row.name,
  }));
}

/** その人が ban なら true */
async function isBanned(env: Env, playerId: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT banned FROM players WHERE player_id = ?1")
    .bind(playerId)
    .first<{ banned: number }>();
  return row !== null && row.banned === 1;
}

/** 送った記録を1期間で数え、載せたときの順位と improves を求める */
async function chanceFor(
  env: Env,
  board: RankingBoard,
  window: WindowFilter,
  payload: ResultPayload,
  resultId: number,
): Promise<RankChance> {
  const values: unknown[] = [];
  const param = (value: unknown): string => {
    values.push(value);
    return `?${values.length}`;
  };
  const selfParam = param(payload.playerId);
  const correctParam = param(payload.correct);
  const tieParam = param(payload.kind === "timeattack" ? payload.miss : payload.endMs);
  const idParam = param(resultId);
  const tiebreak = payload.kind === "timeattack" ? "miss" : "end_ms";
  const conditions = conditionList(board, window, param);
  const above =
    `(r.correct > ${correctParam} OR ` +
    `(r.correct = ${correctParam} AND r.${tiebreak} <= ${tieParam}))`;
  const sql = `
    SELECT
      (SELECT COUNT(DISTINCT r.player_id)
       FROM results r LEFT JOIN players p ON p.player_id = r.player_id
       WHERE ${conditions.join(" AND ")}
         AND r.player_id <> ${selfParam}
         AND r.id <> ${idParam}
         AND ${above}
      ) AS better_players,
      (SELECT COUNT(*)
       FROM results r LEFT JOIN players p ON p.player_id = r.player_id
       WHERE ${conditions.join(" AND ")}
         AND r.player_id = ${selfParam}
         AND r.id <> ${idParam}
         AND ${above}
      ) AS better_own
  `;
  const row = await env.DB.prepare(sql)
    .bind(...values)
    .first<ChanceRow>();
  if (row === null) throw new Error("chance row is missing");
  return { rank: row.better_players + 1, improves: row.better_own === 0 };
}

/** 送られた記録を載せたときの今期と歴代。ランキングに乗れないときは null */
export async function resultChances(
  env: Env,
  payload: ResultPayload,
  resultId: number,
  nowMs: number,
): Promise<RankChances | null> {
  if (payload.mode !== "native") return null;
  const timeAttack = payload.kind === "timeattack";
  const rulesVersion = timeAttack ? RULES_VERSION : ENDURANCE_RULES_VERSION;
  if (payload.rulesVersion !== rulesVersion) return null;
  if (await isBanned(env, payload.playerId)) return null;
  const periodBoard: RankingBoard = timeAttack ? "timeattack-weekly" : "endurance-daily";
  const alltimeBoard: RankingBoard = timeAttack ? "timeattack-alltime" : "endurance-alltime";
  const dateKey = payload.kind === "endurance" ? payload.dateKey : undefined;
  const period = await chanceFor(
    env,
    periodBoard,
    windowFor(periodBoard, nowMs, dateKey),
    payload,
    resultId,
  );
  const alltime = await chanceFor(
    env,
    alltimeBoard,
    windowFor(alltimeBoard, nowMs),
    payload,
    resultId,
  );
  return { period, alltime };
}

function periodLabel(board: RankingBoard, nowMs: number): string | null {
  if (board === "timeattack-weekly") return weekRangeLabel(jstWeekRange(nowMs).weekKey);
  if (board === "endurance-daily") return dayLabel(jstDateKey(nowMs));
  return null;
}

function passageLabel(
  board: RankingBoard,
  nowMs: number,
): { title: string; author: string } | null {
  if (board !== "endurance-daily") return null;
  const passage = passageFor(jstDateKey(nowMs), PASSAGES);
  return { title: passage.title, author: passage.author };
}

function buildResponse(
  board: RankingBoard,
  rows: RankedRow[],
  playerId: string | null,
  nowMs: number,
): RankingResponse {
  const entries: RankingEntry[] = rows
    .filter((row) => row.rank <= TOP_ENTRIES)
    .map((row) => ({
      rank: row.rank,
      name: row.name ?? DEFAULT_NAME,
      correct: row.correct,
      mine: playerId !== null && row.playerId === playerId,
    }));
  const myRow = playerId === null ? undefined : rows.find((row) => row.playerId === playerId);
  return {
    board,
    period: periodLabel(board, nowMs),
    passage: passageLabel(board, nowMs),
    entries,
    me: myRow === undefined ? null : { rank: myRow.rank, correct: myRow.correct },
  };
}

function playerIdOfHeader(value: string | null): string | null {
  if (value === null || !UUID_PATTERN.test(value)) return null;
  return value;
}

export async function handleRanking(request: Request, env: Env): Promise<Response> {
  const board = new URL(request.url).searchParams.get("board");
  if (!isRankingBoard(board)) return Response.json({ error: "board" }, { status: 400 });
  const playerId = playerIdOfHeader(request.headers.get("X-Player-Id"));
  const nowMs = Date.now();
  let rows: RankedRow[];
  try {
    rows = await fetchRanked(env, board, windowFor(board, nowMs), playerId);
  } catch {
    return new Response(null, { status: 500 });
  }
  const body: RankingResponse = buildResponse(board, rows, playerId, nowMs);
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
