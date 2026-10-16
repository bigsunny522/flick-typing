import { describe, expect, it } from "vitest";
import { dayLabel, jstWeekRange, weekRangeLabel } from "../src/ranking/period";

describe("jstWeekRange", () => {
  it("月曜 0:00(日本時間)", () => {
    const nowMs = new Date("2026-10-12T00:00:00+09:00").getTime();
    expect(jstWeekRange(nowMs)).toEqual({
      weekKey: "2026-10-12",
      startUtc: "2026-10-11 15:00:00",
      endUtc: "2026-10-18 15:00:00",
    });
  });

  it("日曜 23:59(日本時間)", () => {
    const nowMs = new Date("2026-10-18T23:59:59+09:00").getTime();
    expect(jstWeekRange(nowMs).weekKey).toBe("2026-10-12");
  });

  it("次の月曜", () => {
    const nowMs = new Date("2026-10-19T00:00:00+09:00").getTime();
    expect(jstWeekRange(nowMs).weekKey).toBe("2026-10-19");
  });

  it("UTC では日曜", () => {
    const nowMs = new Date("2026-10-12T08:00:00+09:00").getTime();
    expect(jstWeekRange(nowMs).weekKey).toBe("2026-10-12");
  });
});

describe("weekRangeLabel", () => {
  it("月をまたぐ週の表示", () => {
    expect(weekRangeLabel("2026-09-28")).toBe("9/28〜10/4");
  });
});

describe("dayLabel", () => {
  it("日の表示", () => {
    expect(dayLabel("2026-10-06")).toBe("10/6");
  });
});
