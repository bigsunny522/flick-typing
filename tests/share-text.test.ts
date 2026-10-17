import { describe, expect, it } from "vitest";
import { imageFileName, shareText, xIntentUrl, type ShareSource } from "../src/share/text";

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

describe("shareText", () => {
  const date = new Date(2026, 9, 7, 21, 5);

  it("タイムアタック 123字、順位 3", () => {
    expect(shareText(base, 3, date)).toBe(
      "フリック入力60秒タイムアタックで123字!\n" +
        "今週のランキングで暫定3位(10/7時点)\n" +
        "\n" +
        "この記録、抜ける?\n" +
        "#ふりっくタイピング",
    );
  });
  it("タイムアタック 123字、順位 null", () => {
    expect(shareText(base, null, date)).toBe(
      "フリック入力60秒タイムアタックで123字!\n\nこの記録、抜ける?\n#ふりっくタイピング",
    );
  });
  it("タイムアタック perfect、順位 1", () => {
    expect(shareText({ ...base, perfect: true }, 1, date)).toBe(
      "フリック入力60秒タイムアタックでノーミス123字!\n" +
        "今週のランキングで暫定1位(10/7時点)\n" +
        "\n" +
        "この記録、抜ける?\n" +
        "#ふりっくタイピング",
    );
  });
  it("タイムアタック bestUpdated、順位 null", () => {
    expect(shareText({ ...base, bestUpdated: true }, null, date)).toBe(
      "フリック入力60秒タイムアタックで123字!自己ベスト更新!\n" +
        "\n" +
        "この記録、抜ける?\n" +
        "#ふりっくタイピング",
    );
  });
  it("耐久「走れメロス」456字・12%、順位 12", () => {
    expect(shareText(meros, 12, date)).toBe(
      "今日の耐久「走れメロス」を456字(12%)まで打った!\n" +
        "今日のランキングで暫定12位(10/7時点)\n" +
        "\n" +
        "今日中なら同じ文章で勝負できる!\n" +
        "#ふりっくタイピング",
    );
  });
  it("耐久 complete 3800字、順位 null", () => {
    expect(shareText({ ...meros, complete: true, correct: 3800 }, null, date)).toBe(
      "今日の耐久「走れメロス」を3800字で完走!\n" +
        "\n" +
        "今日中なら同じ文章で勝負できる!\n" +
        "#ふりっくタイピング",
    );
  });
  it("耐久 complete・bestUpdated 3800字、順位 2", () => {
    expect(shareText({ ...meros, complete: true, correct: 3800, bestUpdated: true }, 2, date)).toBe(
      "今日の耐久「走れメロス」を3800字で完走!今日のベスト更新!\n" +
        "今日のランキングで暫定2位(10/7時点)\n" +
        "\n" +
        "今日中なら同じ文章で勝負できる!\n" +
        "#ふりっくタイピング",
    );
  });
});

describe("xIntentUrl", () => {
  it("文と URL をエンコードする", () => {
    expect(xIntentUrl("a b\n#c")).toBe(
      "https://x.com/intent/post?text=a%20b%0A%23c%0Ahttps%3A%2F%2Fflicktypinggame.xyzack271.com%2F",
    );
  });
});

describe("imageFileName", () => {
  it("月と日と時と分は2桁", () => {
    expect(imageFileName(new Date(2026, 9, 7, 9, 5))).toBe("flick-typing-20261007-0905.png");
  });
  it("年末でも動く", () => {
    expect(imageFileName(new Date(2026, 11, 31, 23, 59))).toBe("flick-typing-20261231-2359.png");
  });
});
