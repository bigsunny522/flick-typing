export const RULES_VERSION = 1;

export const RULES = {
  baseTimeMs: 60000,
  comboStep: 20,
  comboBonusMs: 1000,
  perfectBonusMs: 1000,
} as const;

export const ENDURANCE_RULES_VERSION = 1;

export const ENDURANCE_RULES = {
  startMs: 10000, // 開始時の残り時間
  maxMs: 10000, // 残り時間の上限
  // 正しく打った1文字ごとに回復する時間。打った文字数(この文字を打つ前の数)が from 以上の行を使う
  gains: [
    { from: 0, gainMs: 800 },
    { from: 100, gainMs: 600 },
    { from: 300, gainMs: 450 },
    { from: 600, gainMs: 350 },
    { from: 1000, gainMs: 250 },
  ],
} as const;
