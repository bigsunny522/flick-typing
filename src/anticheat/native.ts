import type { NativeEdit } from "../game/native-edit";
import type { BehaviorVerdict } from "./behavior";
import * as thresholds from "./thresholds";

export type NativeEditLog = NativeEdit & {
  trusted: boolean; // input イベントの isTrusted
  viewportRatio: number; // そのときの visualViewport.height / innerHeight
};
export type NativeKeyLog = {
  t: number;
  code: string;
  trusted: boolean;
  viewportRatio: number; // そのときの visualViewport.height / innerHeight
}; // keydown

export function analyzeNative(edits: NativeEditLog[], keys: NativeKeyLog[]): BehaviorVerdict {
  const metrics: Record<string, number> = {};
  const reasons: string[] = [];
  const physicalKeys = keys.filter(
    (key) => key.code !== "" && key.viewportRatio > thresholds.NATIVE_SOFT_KB_RATIO,
  ).length;
  const recent = edits.slice(-thresholds.WINDOW);
  const intervals = recent.slice(1).map((edit, index) => edit.t - recent[index].t);
  const ordered = [...intervals].sort((left, right) => left - right);
  const median = ordered[Math.floor(ordered.length / 2)] ?? 0;
  metrics.medianInterval = median;
  metrics.viewportRatio = edits.length > 0 ? edits[edits.length - 1].viewportRatio : 0;
  metrics.physicalKeys = physicalKeys;
  if (edits.some((edit) => !edit.trusted) || keys.some((key) => !key.trusted)) {
    reasons.push("untrusted");
  }
  if (physicalKeys >= thresholds.NATIVE_PHYSICAL_KEYS) {
    reasons.push("physical-key");
  }
  if (recent.length >= thresholds.NATIVE_NO_KB_MIN) {
    const raised = recent.filter(
      (edit) => edit.viewportRatio > thresholds.NATIVE_SOFT_KB_RATIO,
    ).length;
    if (raised / recent.length >= thresholds.NATIVE_NO_KB_SHARE) {
      reasons.push("no-soft-keyboard");
    }
  }
  if (edits.length >= thresholds.MIN_STROKES) {
    if (median < thresholds.FAST_MEDIAN) {
      reasons.push("too-fast");
    }
    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance =
      intervals.reduce((sum, interval) => sum + (interval - mean) ** 2, 0) / intervals.length;
    if (mean > 0 && Math.sqrt(variance) / mean < thresholds.REGULAR_CV) {
      reasons.push("too-regular");
    }
  }
  return { bot: reasons.length > 0, reasons, metrics };
}
