import { describe, expect, it } from "vitest";
import type { Passage } from "../src/game/endurance";
import {
  endurancePlayBins,
  histogram,
  jstDateKey,
  jstWeekStartUtc,
  parseRankResponse,
  previousDateKey,
  rankLabel,
  summarizeEndurance,
  summarizeTimeAttack,
  timeAttackPlayBins,
  totalReading,
} from "../src/stats/summary";

function makePassage(readings: string[]): Passage {
  return {
    id: "test-passage",
    title: "題",
    author: "著者",
    cardUrl: "",
    prompts: readings.map((reading, index) => ({ id: `p${index}`, text: reading, reading })),
  };
}

describe("jstDateKey", () => {
  it("UTC 14:59 は日本時間で同じ日", () => {
    expect(jstDateKey(Date.UTC(2026, 9, 16, 14, 59))).toBe("2026-10-16");
  });

  it("UTC 15:00 は日本時間で翌日に変わる", () => {
    expect(jstDateKey(Date.UTC(2026, 9, 16, 15, 0))).toBe("2026-10-17");
  });
});

describe("jstWeekStartUtc", () => {
  it("金曜 UTC 03:00 は日本時間の金曜で、週の始まりは 10-11 15:00:00", () => {
    expect(jstWeekStartUtc(1792119600000)).toBe("2026-10-11 15:00:00");
  });

  it("日曜 UTC 14:59:59 はまだ前の週", () => {
    expect(jstWeekStartUtc(1792335599000)).toBe("2026-10-11 15:00:00");
  });

  it("月曜 UTC 15:00(日本時間の月曜 0:00)は新しい週", () => {
    expect(jstWeekStartUtc(1792335600000)).toBe("2026-10-18 15:00:00");
  });

  it("月曜 UTC 00:00 は同じ週", () => {
    expect(jstWeekStartUtc(1792368000000)).toBe("2026-10-18 15:00:00");
  });
});

describe("previousDateKey", () => {
  it("月の初日の前日は前の月", () => {
    expect(previousDateKey("2026-03-01")).toBe("2026-02-28");
  });

  it("年の初日の前日は前の年", () => {
    expect(previousDateKey("2026-01-01")).toBe("2025-12-31");
  });

  it("うるう年の 3/1 の前日は 2/29", () => {
    expect(previousDateKey("2028-03-01")).toBe("2028-02-29");
  });
});

describe("totalReading", () => {
  it("読みの文字数を合計する", () => {
    expect(totalReading(makePassage(["こんにちは", "世界"]))).toBe(7);
  });
});

describe("summarizeTimeAttack", () => {
  it("同じ ID の行は1件にまとまる", () => {
    const summary = summarizeTimeAttack([
      { playerId: "a", correct: 10, miss: 2, durationMs: 60000 },
      { playerId: "a", correct: 30, miss: 4, durationMs: 60000 },
    ]);
    expect(summary.bests).toHaveLength(1);
    expect(summary.bests[0].correct).toBe(30);
  });

  it("correct が同じなら miss が少ない行を選ぶ", () => {
    const summary = summarizeTimeAttack([
      { playerId: "a", correct: 30, miss: 10, durationMs: 60000 },
      { playerId: "a", correct: 30, miss: 2, durationMs: 60000 },
    ]);
    expect(summary.bests[0].accuracy).toBe(30 / 32);
  });

  it("accuracy と cps を計算する", () => {
    const summary = summarizeTimeAttack([
      { playerId: "a", correct: 30, miss: 10, durationMs: 60000 },
    ]);
    expect(summary.bests[0].accuracy).toBe(0.75);
    expect(summary.bests[0].cps).toBe(0.5);
  });

  it("correct と miss がどちらも 0 なら accuracy は 0", () => {
    const summary = summarizeTimeAttack([
      { playerId: "a", correct: 0, miss: 0, durationMs: 60000 },
    ]);
    expect(summary.bests[0].accuracy).toBe(0);
    expect(summary.bests[0].cps).toBe(0);
  });

  it("bests は correct の大きい順", () => {
    const summary = summarizeTimeAttack([
      { playerId: "a", correct: 20, miss: 0, durationMs: 60000 },
      { playerId: "b", correct: 40, miss: 0, durationMs: 60000 },
      { playerId: "c", correct: 30, miss: 0, durationMs: 60000 },
    ]);
    expect(summary.bests.map((best) => best.correct)).toEqual([40, 30, 20]);
  });

  it("players は匿名 ID の数、plays は行の数", () => {
    const summary = summarizeTimeAttack([
      { playerId: "a", correct: 10, miss: 0, durationMs: 60000 },
      { playerId: "a", correct: 20, miss: 0, durationMs: 60000 },
      { playerId: "b", correct: 5, miss: 0, durationMs: 60000 },
    ]);
    expect(summary.players).toBe(2);
    expect(summary.plays).toBe(3);
  });
});

describe("summarizeEndurance", () => {
  it("同じ ID の行は最高値1件にまとまる", () => {
    const summary = summarizeEndurance([
      { playerId: "a", correct: 100 },
      { playerId: "a", correct: 250 },
    ]);
    expect(summary.bests).toEqual([250]);
    expect(summary.players).toBe(1);
    expect(summary.plays).toBe(2);
  });

  it("bests は大きい順", () => {
    const summary = summarizeEndurance([
      { playerId: "a", correct: 100 },
      { playerId: "b", correct: 300 },
      { playerId: "c", correct: 200 },
    ]);
    expect(summary.bests).toEqual([300, 200, 100]);
  });
});

describe("histogram", () => {
  it("空の配列は空を返す", () => {
    expect(histogram([], 10)).toEqual([]);
    expect(histogram([], 0.05, 1)).toEqual([]);
  });

  it("width 10 の境目の値", () => {
    expect(histogram([0, 9, 10, 19, 20], 10)).toEqual([
      { from: 0, to: 10, count: 2 },
      { from: 10, to: 20, count: 2 },
      { from: 20, to: 30, count: 1 },
    ]);
  });

  it("width 0.05 の境目の値", () => {
    const bins = histogram([0.15, 0.95], 0.05);
    expect(bins).toHaveLength(20);
    expect(bins[3]).toEqual({ from: 3 * 0.05, to: 4 * 0.05, count: 1 });
    expect(bins[19]).toEqual({ from: 19 * 0.05, to: 20 * 0.05, count: 1 });
  });

  it("width 0.5 の境目の値", () => {
    expect(histogram([0.5, 1], 0.5)).toEqual([
      { from: 0, to: 0.5, count: 0 },
      { from: 0.5, to: 1, count: 1 },
      { from: 1, to: 1.5, count: 1 },
    ]);
  });

  it("upper を渡すと区間の数が ceil(upper / width) に固定される", () => {
    const bins = histogram([5], 10, 30);
    expect(bins).toEqual([
      { from: 0, to: 10, count: 1 },
      { from: 10, to: 20, count: 0 },
      { from: 20, to: 30, count: 0 },
    ]);
  });

  it("upper ちょうどの値が最後の区間に入る", () => {
    const bins = histogram([0.9, 0.95, 1], 0.05, 1);
    expect(bins[19].count).toBe(2);
    expect(bins[18].count).toBe(1);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(3);
  });

  it("upper より大きい値が最後の区間に入る", () => {
    const bins = histogram([35], 10, 30);
    expect(bins).toHaveLength(3);
    expect(bins[2].count).toBe(1);
  });

  it("途中の空の区間は count 0 で返る", () => {
    expect(histogram([0, 30], 10)).toEqual([
      { from: 0, to: 10, count: 1 },
      { from: 10, to: 20, count: 0 },
      { from: 20, to: 30, count: 0 },
      { from: 30, to: 40, count: 1 },
    ]);
  });
});

describe("parseRankResponse", () => {
  it("timeattack の week と all があればそのまま", () => {
    expect(parseRankResponse({ kind: "timeattack", week: 3, all: 12 })).toEqual({
      kind: "timeattack",
      week: 3,
      all: 12,
    });
  });

  it("endurance の today があればそのまま", () => {
    expect(parseRankResponse({ kind: "endurance", today: 5 })).toEqual({
      kind: "endurance",
      today: 5,
    });
  });

  it("timeattack で all が足りなければ null", () => {
    expect(parseRankResponse({ kind: "timeattack", week: 3 })).toBeNull();
  });

  it("week が 0 なら null", () => {
    expect(parseRankResponse({ kind: "timeattack", week: 0, all: 12 })).toBeNull();
  });

  it("week が整数でなければ null", () => {
    expect(parseRankResponse({ kind: "timeattack", week: 1.5, all: 12 })).toBeNull();
  });

  it("today が文字列なら null", () => {
    expect(parseRankResponse({ kind: "endurance", today: "5" })).toBeNull();
  });

  it("kind が分からないものは null", () => {
    expect(parseRankResponse({ kind: "other", today: 5 })).toBeNull();
  });

  it("null は null", () => {
    expect(parseRankResponse(null)).toBeNull();
  });
});

describe("rankLabel", () => {
  it("1 位は「1位」", () => {
    expect(rankLabel(1)).toBe("1位");
  });

  it("100 位は「100位」", () => {
    expect(rankLabel(100)).toBe("100位");
  });

  it("101 位は TOP200", () => {
    expect(rankLabel(101)).toBe("TOP200");
  });

  it("200 位は TOP200", () => {
    expect(rankLabel(200)).toBe("TOP200");
  });

  it("201 位は TOP500", () => {
    expect(rankLabel(201)).toBe("TOP500");
  });

  it("501 位は TOP1000", () => {
    expect(rankLabel(501)).toBe("TOP1000");
  });

  it("1001 位は TOP2000", () => {
    expect(rankLabel(1001)).toBe("TOP2000");
  });

  it("12000 位は TOP20000", () => {
    expect(rankLabel(12000)).toBe("TOP20000");
  });
});

describe("timeAttackPlayBins", () => {
  it("同じ ID の行が複数あっても、すべての行が数に入る", () => {
    const bins = timeAttackPlayBins([
      { playerId: "a", correct: 5, miss: 0, durationMs: 60000 },
      { playerId: "a", correct: 25, miss: 0, durationMs: 60000 },
    ]);
    expect(bins.correct).toEqual([
      { from: 0, to: 10, count: 1 },
      { from: 10, to: 20, count: 0 },
      { from: 20, to: 30, count: 1 },
    ]);
    expect(bins.accuracy.reduce((sum, bin) => sum + bin.count, 0)).toBe(2);
    expect(bins.cps.reduce((sum, bin) => sum + bin.count, 0)).toBe(2);
  });

  it("行が 0 件なら各配列は空", () => {
    expect(timeAttackPlayBins([])).toEqual({ correct: [], accuracy: [], cps: [] });
  });
});

describe("endurancePlayBins", () => {
  it("同じ ID の行が複数あっても、すべての行が数に入る", () => {
    const bins = endurancePlayBins(
      [
        { playerId: "a", correct: 50 },
        { playerId: "a", correct: 150 },
      ],
      200,
    );
    expect(bins.progress.reduce((sum, bin) => sum + bin.count, 0)).toBe(2);
  });

  it("行が 0 件なら各配列は空", () => {
    expect(endurancePlayBins([], 200)).toEqual({ progress: [] });
  });

  it("progress が correct / totalReading の区間に入る", () => {
    const bins = endurancePlayBins([{ playerId: "a", correct: 50 }], 200);
    expect(bins.progress).toHaveLength(10);
    expect(bins.progress[2].count).toBe(1);
    expect(bins.progress[2].from).toBeCloseTo(0.2);
    expect(bins.progress[2].to).toBeCloseTo(0.3);
  });
});
