import { describe, expect, it } from "vitest";
import { cardContent } from "../src/share/card-content";
import type { ShareSource } from "../src/share/text";

const date = new Date(2026, 9, 7, 9, 5);

const base: ShareSource = {
  kind: "timeattack",
  correct: 123,
  miss: 2,
  maxCombo: 40,
  endTimeMs: 60000,
  perfect: false,
  bestUpdated: false,
};

const meros: ShareSource = {
  kind: "endurance",
  correct: 456,
  title: "走れメロス",
  author: "太宰治",
  progress: 12,
  complete: false,
  bestUpdated: false,
};

describe("cardContent", () => {
  it("タイムアタックの stats", () => {
    const card = cardContent({ ...base, correct: 120, miss: 3 }, 5, date);
    expect(card.stats).toEqual([
      ["ミス", "3"],
      ["正確率", "97.6%"],
      ["1秒あたり", "2.00字"],
      ["最大コンボ", "40"],
    ]);
  });
  it("タイムアタックの種目と順位", () => {
    const card = cardContent(base, 5, date);
    expect(card.modeLabel).toBe("タイムアタック");
    expect(card.rankLabel).toBe("今週 暫定5位");
  });
  it("順位がなければ順位なし", () => {
    expect(cardContent(base, null, date).rankLabel).toBe(null);
  });
  it("タイムアタックの badges", () => {
    const card = cardContent({ ...base, perfect: true, bestUpdated: true }, null, date);
    expect(card.badges).toEqual(["PERFECT", "自己ベスト更新"]);
  });
  it("0 件の正確率", () => {
    const card = cardContent({ ...base, correct: 0, miss: 0 }, null, date);
    expect(card.stats[1]).toEqual(["正確率", "0.0%"]);
  });
  it("耐久の種目と順位と stats", () => {
    const card = cardContent({ ...meros, bestUpdated: true }, 3, date);
    expect(card.modeLabel).toBe("今日の耐久");
    expect(card.rankLabel).toBe("今日 暫定3位");
    expect(card.stats).toEqual([
      ["作品", "走れメロス / 太宰治"],
      ["進んだ割合", "12%"],
    ]);
  });
  it("耐久の badges", () => {
    const card = cardContent({ ...meros, complete: true, bestUpdated: true }, null, date);
    expect(card.badges).toEqual(["完走", "今日のベスト更新"]);
  });
  it("日付と URL", () => {
    const card = cardContent(base, null, date);
    expect(card.dateLabel).toBe("2026/10/07");
    expect(card.footer).toBe("flicktypinggame.xyzack271.com");
  });
});
