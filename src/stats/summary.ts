import type { Passage } from "../game/endurance";

const JST_OFFSET_MS = 9 * 3600000;
const DAY_MS = 24 * 3600000;

/** 日本時間の日付キー("2026-10-16")。src/main.ts の todayKey と同じ計算 */
export function jstDateKey(nowMs: number): string {
  return new Date(nowMs + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC の "YYYY-MM-DD HH:MM:SS"(D1 の datetime('now') と同じ形) */
function utcStamp(ms: number): string {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/** nowMs を含む週(日本時間の月曜 0:00 始まり)の始まりを、UTC の "YYYY-MM-DD HH:MM:SS" で返す */
export function jstWeekStartUtc(nowMs: number): string {
  const jst = new Date(nowMs + JST_OFFSET_MS);
  const jstDayStart = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
  const daysSinceMonday = (jst.getUTCDay() + 6) % 7;
  const weekStart = jstDayStart - daysSinceMonday * DAY_MS;
  return utcStamp(weekStart - JST_OFFSET_MS);
}

/** 前日の日付キー */
export function previousDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  const previousYear = date.getUTCFullYear();
  const previousMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const previousDay = String(date.getUTCDate()).padStart(2, "0");
  return `${previousYear}-${previousMonth}-${previousDay}`;
}

export function totalReading(passage: Passage): number {
  let total = 0;
  for (const prompt of passage.prompts) {
    total += [...prompt.reading].length;
  }
  return total;
}

export type TimeAttackRow = { playerId: string; correct: number; miss: number; durationMs: number };
export type TimeAttackBest = { correct: number; accuracy: number; cps: number };
export type ModeSummary<T> = { players: number; plays: number; bests: T[] };

/** 1 行から自己ベストと同じ出し方で値を求める */
function timeAttackValues(row: TimeAttackRow): TimeAttackBest {
  return {
    correct: row.correct,
    accuracy: row.correct + row.miss === 0 ? 0 : row.correct / (row.correct + row.miss),
    cps: row.correct / (row.durationMs / 1000),
  };
}

/** 匿名 ID ごとの自己ベスト。bests は correct の大きい順 */
export function summarizeTimeAttack(rows: TimeAttackRow[]): ModeSummary<TimeAttackBest> {
  const bestRows = new Map<string, TimeAttackRow>();
  for (const row of rows) {
    const current = bestRows.get(row.playerId);
    if (current === undefined) {
      bestRows.set(row.playerId, row);
      continue;
    }
    const betterCorrect = row.correct > current.correct;
    const sameCorrectLessMiss = row.correct === current.correct && row.miss < current.miss;
    if (betterCorrect || sameCorrectLessMiss) bestRows.set(row.playerId, row);
  }
  const bests = [...bestRows.values()].map(timeAttackValues);
  bests.sort((left, right) => right.correct - left.correct);
  return { players: bestRows.size, plays: rows.length, bests };
}

export type EnduranceRow = { playerId: string; correct: number };

/** 匿名 ID ごとの最高 correct。bests は大きい順 */
export function summarizeEndurance(rows: EnduranceRow[]): ModeSummary<number> {
  const bestCorrect = new Map<string, number>();
  for (const row of rows) {
    const current = bestCorrect.get(row.playerId);
    if (current === undefined || row.correct > current) bestCorrect.set(row.playerId, row.correct);
  }
  const bests = [...bestCorrect.values()];
  bests.sort((left, right) => right - left);
  return { players: bestCorrect.size, plays: rows.length, bests };
}

export type Bin = { from: number; to: number; count: number };

/** 分布の区間の幅。ページと Worker の両方がこれを使う */
export const BIN = {
  correct: { width: 10 },
  accuracy: { width: 0.05, upper: 1 },
  cps: { width: 0.5 },
  progress: { width: 0.1, upper: 1 },
} as const;

/** 浮動小数の誤差を吸収して、値が入る区間の index を求める */
function binIndex(value: number, width: number): number {
  return Math.max(0, Math.floor(value / width + 1e-9));
}

function emptyBins(count: number, width: number): Bin[] {
  const bins: Bin[] = [];
  for (let index = 0; index < count; index += 1) {
    bins.push({ from: index * width, to: (index + 1) * width, count: 0 });
  }
  return bins;
}

export function histogram(values: number[], width: number, upper?: number): Bin[] {
  if (values.length === 0) return [];
  if (upper !== undefined) {
    const count = Math.ceil(upper / width);
    const bins = emptyBins(count, width);
    for (const value of values) {
      const at = Math.min(count - 1, binIndex(value, width));
      bins[at].count += 1;
    }
    return bins;
  }
  let maxIndex = 0;
  for (const value of values) maxIndex = Math.max(maxIndex, binIndex(value, width));
  const bins = emptyBins(maxIndex + 1, width);
  for (const value of values) bins[binIndex(value, width)].count += 1;
  return bins;
}

export type TimeAttackPlayBins = { correct: Bin[]; accuracy: Bin[]; cps: Bin[] };
export type EndurancePlayBins = { progress: Bin[] };

/** 全プレイ(自己ベストに絞らない)の区間ごとの数 */
export function timeAttackPlayBins(rows: TimeAttackRow[]): TimeAttackPlayBins {
  const values = rows.map(timeAttackValues);
  return {
    correct: histogram(
      values.map((row) => row.correct),
      BIN.correct.width,
    ),
    accuracy: histogram(
      values.map((row) => row.accuracy),
      BIN.accuracy.width,
      BIN.accuracy.upper,
    ),
    cps: histogram(
      values.map((row) => row.cps),
      BIN.cps.width,
    ),
  };
}

/** 全プレイ(自己ベストに絞らない)の進んだ割合の区間ごとの数 */
export function endurancePlayBins(rows: EnduranceRow[], totalReading: number): EndurancePlayBins {
  return {
    progress: histogram(
      rows.map((row) => row.correct / totalReading),
      BIN.progress.width,
      BIN.progress.upper,
    ),
  };
}

/** 順位の表示。1〜100 位は「○位」、それより下は rank 以上で最小の区切りを「TOP○」で出す */
export function rankLabel(rank: number): string {
  if (rank <= 100) return `${rank}位`;
  for (let scale = 100; ; scale *= 10) {
    for (const base of [2, 5, 10]) {
      const bucket = base * scale;
      if (bucket >= rank) return `TOP${bucket}`;
    }
  }
}

export type RankResponse =
  { kind: "timeattack"; week: number; all: number } | { kind: "endurance"; today: number };

function isRank(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

/** /api/results のレスポンスの JSON を読む。形が違えば null */
export function parseRankResponse(value: unknown): RankResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;
  if (body.kind === "timeattack") {
    if (!isRank(body.week) || !isRank(body.all)) return null;
    return { kind: "timeattack", week: body.week, all: body.all };
  }
  if (body.kind === "endurance") {
    if (!isRank(body.today)) return null;
    return { kind: "endurance", today: body.today };
  }
  return null;
}

export type TimeAttackSummary = ModeSummary<TimeAttackBest> & { all: TimeAttackPlayBins };
export type EnduranceSummary = ModeSummary<number> & { all: EndurancePlayBins };

export type StatsResponse = {
  timeattack: {
    rulesVersion: number;
    flick: TimeAttackSummary;
    native: TimeAttackSummary;
  };
  endurance: {
    rulesVersion: number;
    dateKey: string;
    passageId: string;
    totalReading: number;
    flick: EnduranceSummary;
    native: EnduranceSummary;
  };
};
