import type { JudgeInput } from "./judge";
import { TYPEABLE } from "./kana";

export type NativeEdit = {
  t: number; // プレイ開始からの ms(input イベントの timeStamp - 開始時刻)
  inputType: string;
  before: string; // このイベントの前の入力欄の値
  after: string; // このイベントの後の入力欄の値
};

export function inputForEdit(
  edit: Pick<NativeEdit, "inputType" | "before" | "after">,
): JudgeInput | null {
  const { inputType, before, after } = edit;
  if (before === after) {
    return null;
  }
  if (
    inputType.startsWith("insertFrom") ||
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
    return { kind: "cancel" };
  }
  if ([...inserted].length >= 2) {
    return { kind: "reject" };
  }
  if (!TYPEABLE.has(inserted)) {
    return { kind: "reject" };
  }
  if (deleted === 0) {
    return { kind: "kana", kana: inserted };
  }
  if (deleted === 1) {
    return { kind: "replace", kana: inserted };
  }
  return { kind: "reject" };
}
