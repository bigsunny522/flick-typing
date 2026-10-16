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
  it("タイムアタックに順位あり", () => {
    expect(shareText(base, 3)).toBe(
      "タイムアタックで123字打ちました!(今週3位)\n#ふりっくタイピング",
    );
  });
  it("タイムアタックに順位なし", () => {
    expect(shareText(base, null)).toBe("タイムアタックで123字打ちました!\n#ふりっくタイピング");
  });
  it("タイムアタックのノーミス", () => {
    expect(shareText({ ...base, perfect: true }, 1)).toBe(
      "タイムアタックでノーミス123字打ちました!(今週1位)\n#ふりっくタイピング",
    );
  });
  it("耐久で完走でない", () => {
    expect(shareText(meros, 12)).toBe(
      "今日の耐久「走れメロス」で456字打ちました!(今日12位)\n#ふりっくタイピング",
    );
  });
  it("耐久の完走に順位なし", () => {
    expect(shareText({ ...meros, complete: true, correct: 2000 }, null)).toBe(
      "今日の耐久「走れメロス」を完走しました!(2000字)\n#ふりっくタイピング",
    );
  });
  it("耐久の完走に順位あり", () => {
    expect(shareText({ ...meros, complete: true, correct: 2000 }, 2)).toBe(
      "今日の耐久「走れメロス」を完走しました!(2000字・今日2位)\n#ふりっくタイピング",
    );
  });
});

describe("xIntentUrl", () => {
  it("文と URL をエンコードする", () => {
    expect(xIntentUrl("a b\n#c")).toBe(
      "https://x.com/intent/post?text=a%20b%0A%23c&url=https%3A%2F%2Fflicktypinggame.xyzack271.com%2F",
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
