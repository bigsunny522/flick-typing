import { cycleOf, nextVariant } from "./kana";

export type JudgeInput = { kind: "kana"; kana: string } | { kind: "modifier" };
export type JudgeResult = "advance" | "pending" | "cycle" | "miss";

export function judge(target: string, index: number, pending: string | null, input: JudgeInput) {
  const expected = target[index];
  if (pending === null) {
    if (input.kind === "kana" && input.kana === expected) {
      return { result: "advance" as const, index: index + 1, pending: null };
    }
    if (input.kind === "kana" && cycleOf(input.kana).includes(expected)) {
      return { result: "pending" as const, index, pending: input.kana };
    }
    return { result: "miss" as const, index, pending };
  }
  if (input.kind !== "modifier") {
    return { result: "miss" as const, index, pending };
  }
  const next = nextVariant(pending);
  if (next === expected) {
    return { result: "advance" as const, index: index + 1, pending: null };
  }
  return { result: "cycle" as const, index, pending: next };
}
