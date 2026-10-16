import type { Passage } from "../game/endurance";

/** 日本時間の日付キー("2026-10-16")。src/main.ts の todayKey と同じ計算 */
export function jstDateKey(nowMs: number): string {
  return new Date(nowMs + 9 * 3600000).toISOString().slice(0, 10);
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

/** 自分の値の順位。自分より大きい値の数 + 1。同じ値は同じ順位。values が空なら null */
export function rankOf(values: number[], mine: number): number | null {
  if (values.length === 0) return null;
  const greater = values.filter((value) => value > mine).length;
  return greater + 1;
}

/** 自分の値が上位何%か。values が空なら null */
export function topPercent(values: number[], mine: number): number | null {
  if (values.length === 0) return null;
  const greater = values.filter((value) => value > mine).length;
  const percent = Math.ceil((100 * (greater + 1)) / values.length);
  return Math.min(100, Math.max(1, percent));
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
