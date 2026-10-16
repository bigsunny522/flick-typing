import type { RankChances } from "./types";

/** この順位以内ならポップアップを出す */
export const OFFER_MAX_RANK = 100;

/** ポップアップに出す期間。出さないときは [] */
export function offerPeriods(chances: RankChances | null): ("period" | "alltime")[] {
  if (chances === null) return [];
  const periods: ("period" | "alltime")[] = [];
  if (chances.period.improves && chances.period.rank <= OFFER_MAX_RANK) periods.push("period");
  if (chances.alltime.improves && chances.alltime.rank <= OFFER_MAX_RANK) periods.push("alltime");
  return periods;
}
