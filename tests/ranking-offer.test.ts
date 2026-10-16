import { describe, expect, it } from "vitest";
import { offerPeriods } from "../src/ranking/offer";
import type { RankChance, RankChances } from "../src/ranking/types";

function c(rank: number, improves: boolean): RankChance {
  return { rank, improves };
}

function chances(period: RankChance, alltime: RankChance): RankChances {
  return { period, alltime };
}

describe("offerPeriods", () => {
  it("null のときは出さない", () => {
    expect(offerPeriods(null)).toEqual([]);
  });

  it("両方に入る", () => {
    expect(offerPeriods(chances(c(3, true), c(12, true)))).toEqual(["period", "alltime"]);
  });

  it("今期だけ入る", () => {
    expect(offerPeriods(chances(c(3, true), c(150, true)))).toEqual(["period"]);
  });

  it("100位ちょうど", () => {
    expect(offerPeriods(chances(c(100, true), c(200, true)))).toEqual(["period"]);
  });

  it("101位", () => {
    expect(offerPeriods(chances(c(101, true), c(101, true)))).toEqual([]);
  });

  it("自分の記録より良くない", () => {
    expect(offerPeriods(chances(c(3, false), c(12, false)))).toEqual([]);
  });

  it("歴代だけ自分の記録より良くない", () => {
    expect(offerPeriods(chances(c(3, true), c(12, false)))).toEqual(["period"]);
  });
});
