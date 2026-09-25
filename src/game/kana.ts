const cycles = [
  "あぁ",
  "いぃ",
  "うぅ",
  "えぇ",
  "おぉ",
  "かが",
  "きぎ",
  "くぐ",
  "けげ",
  "こご",
  "さざ",
  "しじ",
  "すず",
  "せぜ",
  "そぞ",
  "ただ",
  "ちぢ",
  "てで",
  "とど",
  "つっづ",
  "はばぱ",
  "ひびぴ",
  "ふぶぷ",
  "へべぺ",
  "ほぼぽ",
  "やゃ",
  "ゆゅ",
  "よょ",
];

export function cycleOf(kana: string): string[] {
  return cycles.find((cycle) => cycle.includes(kana))?.split("") ?? [kana];
}

export function nextVariant(kana: string): string {
  const cycle = cycleOf(kana);
  return cycle[(cycle.indexOf(kana) + 1) % cycle.length];
}

const directKana =
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんー、。？！";

export const TYPEABLE: ReadonlySet<string> = new Set([
  ...directKana,
  ...cycles.flatMap((cycle) => [...cycle]),
]);
