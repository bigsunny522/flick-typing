import data from "../data/prompts.json";
import { TYPEABLE } from "./kana";
import { mulberry32 } from "./random";

export type Prompt = { id: string; text: string; reading: string };
export const PROMPTS = data as Prompt[];

const modifierKana = new Set(
  "ぁぃぅぇぉがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽっゃゅょ",
);

export function difficulty(reading: string): 1 | 2 | 3 {
  const modifiers = [...reading].filter((kana) => modifierKana.has(kana)).length;
  if (reading.length <= 12 && modifiers <= 1) return 1;
  if (reading.length >= 20 || modifiers >= 4) return 3;
  return 2;
}

export function choosePrompts(seed: number, prompts: Prompt[], count = 20): Prompt[] {
  const random = mulberry32(seed);
  const used = new Set<string>();
  const chosen: Prompt[] = [];
  for (let index = 0; index < count; index += 1) {
    const requested = index < 3 ? 1 : index < 6 ? 2 : 3;
    const levels = requested === 1 ? [1] : requested === 2 ? [2] : [3, 2, 1];
    let pool: Prompt[] = [];
    for (const level of levels) {
      pool = prompts.filter(
        (prompt) => difficulty(prompt.reading) === level && !used.has(prompt.id),
      );
      if (pool.length > 0) break;
    }
    if (pool.length === 0) {
      used.clear();
      for (const level of levels) {
        pool = prompts.filter((prompt) => difficulty(prompt.reading) === level);
        if (pool.length > 0) break;
      }
    }
    const prompt = pool[Math.floor(random() * pool.length)];
    used.add(prompt.id);
    chosen.push(prompt);
  }
  return chosen;
}

export function validPrompts(prompts: Prompt[]): boolean {
  return (
    prompts.length === 60 &&
    new Set(prompts.map((prompt) => prompt.id)).size === 60 &&
    prompts.every((prompt) => [...prompt.reading].every((kana) => TYPEABLE.has(kana)))
  );
}
