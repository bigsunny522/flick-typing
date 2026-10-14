import { cycleOf, nextVariant } from "./kana";

export type JudgeInput =
  | { kind: "kana"; kana: string }
  | { kind: "modifier" }
  | { kind: "replace"; kana: string } // 最後の1文字が kana に置き換わった(゛゜小・トグル)
  | { kind: "cancel" } // 文字が消された
  | { kind: "reject" }; // 受け付けない入力(ペースト・変換・2文字以上・打てない文字)
export type JudgeResult = "advance" | "pending" | "cycle" | "miss" | "cancel";

export function judge(target: string, index: number, pending: string | null, input: JudgeInput) {
  const expected = target[index];
  if (input.kind === "cancel") {
    return { result: "cancel" as const, index, pending: null };
  }
  if (input.kind === "reject") {
    return { result: "miss" as const, index, pending: null };
  }
  if (pending === null) {
    if (input.kind === "modifier") {
      return { result: "miss" as const, index, pending };
    }
    if (input.kana === expected) {
      return { result: "advance" as const, index: index + 1, pending: null };
    }
    if (cycleOf(input.kana).includes(expected)) {
      return { result: "pending" as const, index, pending: input.kana };
    }
    return { result: "miss" as const, index, pending };
  }
  if (input.kind === "modifier") {
    const next = nextVariant(pending);
    if (next === expected) {
      return { result: "advance" as const, index: index + 1, pending: null };
    }
    return { result: "cycle" as const, index, pending: next };
  }
  if (input.kind === "kana") {
    return { result: "miss" as const, index, pending };
  }
  if (input.kana === expected) {
    return { result: "advance" as const, index: index + 1, pending: null };
  }
  if (cycleOf(input.kana).includes(expected)) {
    return { result: "cycle" as const, index, pending: input.kana };
  }
  return { result: "miss" as const, index, pending: null };
}
