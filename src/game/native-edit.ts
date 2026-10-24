import type { JudgeInput } from "./judge";
import { TYPEABLE } from "./kana";

export type NativeEdit = {
  t: number; // プレイ開始からの ms(input イベントの timeStamp - 開始時刻)
  inputType: string;
  before: string; // このイベントの前の入力欄の値
  after: string; // このイベントの後の入力欄の値
};

export type EditBase = {
  remembered: string; // 前回の input の後の値
  commitBase: string | null; // deleteCompositionText の直前の値。確定の途中でなければ null
  stale: string | null; // 切り替える前の入力欄の値。切り替えた直後の最初の input まで持つ
};

export function resolveEdit(
  base: EditBase,
  inputType: string,
  after: string,
): { before: string | null; next: EditBase } {
  if (inputType === "deleteCompositionText") {
    return {
      before: null,
      next: { remembered: after, commitBase: base.remembered, stale: base.stale },
    };
  }
  let before =
    inputType === "insertFromComposition" && base.commitBase !== null
      ? base.commitBase
      : base.remembered;
  const stale = base.stale;
  if (stale !== null && stale !== "" && before === "" && [...after].length >= 2) {
    const chars = [...after];
    if (stale.endsWith(after)) {
      before = after;
    } else {
      const restored = chars.slice(0, -1).join("");
      if (stale.endsWith(restored)) {
        before = restored;
      }
    }
  }
  return { before, next: { remembered: after, commitBase: null, stale: null } };
}

export function inputForEdit(
  edit: Pick<NativeEdit, "inputType" | "before" | "after">,
): JudgeInput | null {
  const { inputType, before, after } = edit;
  if (before === after) {
    return null;
  }
  const fromComposition = inputType === "insertFromComposition";
  if (
    (!fromComposition && inputType.startsWith("insertFrom")) ||
    inputType === "historyUndo" ||
    inputType === "historyRedo"
  ) {
    return { kind: "reject" };
  }
  let common = 0;
  while (common < before.length && common < after.length && before[common] === after[common]) {
    common += 1;
  }
  const deleted = before.length - common;
  const inserted = after.slice(common);
  if (inserted === "") {
    return fromComposition ? null : { kind: "cancel" };
  }
  if ([...inserted].length >= 2) {
    return fromComposition ? null : { kind: "reject" };
  }
  if (!TYPEABLE.has(inserted)) {
    return fromComposition ? null : { kind: "reject" };
  }
  if (deleted === 0) {
    return { kind: "kana", kana: inserted };
  }
  if (deleted === 1) {
    return { kind: "replace", kana: inserted };
  }
  return fromComposition ? null : { kind: "reject" };
}
