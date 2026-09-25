export type Direction = "tap" | "left" | "up" | "right" | "down";
export type KeyId =
  "a" | "ka" | "sa" | "ta" | "na" | "ha" | "ma" | "ya" | "ra" | "wa" | "mod" | "punct";
export type KeyStroke = {
  key: KeyId;
  dir: Direction;
  down: { x: number; y: number; t: number };
  up: { x: number; y: number; t: number };
  moves: number;
  width: number;
  height: number;
  pressure: number;
};

export const KEY_ROWS: (KeyId | null)[][] = [
  [null, "a", "ka", "sa", null],
  [null, "ta", "na", "ha", null],
  [null, "ma", "ya", "ra", null],
  [null, "mod", "wa", "punct", null],
];

export const KEY_LABELS: Record<KeyId, string> = {
  a: "あ",
  ka: "か",
  sa: "さ",
  ta: "た",
  na: "な",
  ha: "は",
  ma: "ま",
  ya: "や",
  ra: "ら",
  wa: "わ",
  mod: "゛゜小",
  punct: "、。？！",
};

const directions: Direction[] = ["tap", "left", "up", "right", "down"];
const values: Record<KeyId, string[]> = {
  a: ["あ", "い", "う", "え", "お"],
  ka: ["か", "き", "く", "け", "こ"],
  sa: ["さ", "し", "す", "せ", "そ"],
  ta: ["た", "ち", "つ", "て", "と"],
  na: ["な", "に", "ぬ", "ね", "の"],
  ha: ["は", "ひ", "ふ", "へ", "ほ"],
  ma: ["ま", "み", "む", "め", "も"],
  ya: ["や", "—", "ゆ", "—", "よ"],
  ra: ["ら", "り", "る", "れ", "ろ"],
  wa: ["わ", "を", "ん", "ー", "—"],
  mod: ["切替", "切替", "切替", "切替", "切替"],
  punct: ["、", "。", "？", "！", "—"],
};

export function inputForStroke(stroke: Pick<KeyStroke, "key" | "dir">) {
  if (stroke.key === "mod") return { kind: "modifier" as const };
  const value = values[stroke.key][directions.indexOf(stroke.dir)];
  return value && value !== "—" ? { kind: "kana" as const, kana: value } : null;
}

export function keyIdAt(x: number, y: number, width: number, height: number): KeyId | null {
  return KEY_ROWS[Math.floor(y / (height / 4))]?.[Math.floor(x / (width / 5))] ?? null;
}

export function keyValues(id: KeyId): string[] {
  return values[id];
}
