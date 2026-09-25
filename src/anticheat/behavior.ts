import type { KeyStroke } from "../keyboard/layout";
import * as thresholds from "./thresholds";

export type BehaviorVerdict = { bot: boolean; reasons: string[]; metrics: Record<string, number> };

export function analyze(strokes: KeyStroke[]): BehaviorVerdict {
  const window = strokes.slice(-thresholds.WINDOW);
  const metrics: Record<string, number> = {};
  if (strokes.length < thresholds.MIN_STROKES) return { bot: false, reasons: [], metrics };
  const reasons: string[] = [];
  const instant = window.filter(
    (stroke) => stroke.up.t - stroke.down.t < thresholds.INSTANT_MS,
  ).length;
  const instantRatio = instant / window.length;
  if (instantRatio >= thresholds.INSTANT_RATIO) reasons.push("instant-press");
  const flicks = window.filter((stroke) => stroke.dir !== "tap");
  const teleports = flicks.filter((stroke) => stroke.moves === 0).length;
  if (
    flicks.length >= thresholds.TELEPORT_MIN &&
    teleports / flicks.length >= thresholds.TELEPORT_RATIO
  ) {
    reasons.push("teleport-flick");
  }
  const points = new Map<string, number>();
  for (const stroke of window) {
    const point = `${stroke.key}:${stroke.down.x}:${stroke.down.y}`;
    points.set(point, (points.get(point) ?? 0) + 1);
  }
  if ([...points.values()].some((count) => count >= thresholds.SAME_POINT))
    reasons.push("same-point");
  const intervals = window.slice(1).map((stroke, index) => stroke.down.t - window[index].down.t);
  const ordered = [...intervals].sort((left, right) => left - right);
  const median = ordered[Math.floor(ordered.length / 2)] ?? 0;
  if (median < thresholds.FAST_MEDIAN) reasons.push("too-fast");
  const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const variance =
    intervals.reduce((sum, interval) => sum + (interval - mean) ** 2, 0) / intervals.length;
  if (mean > 0 && Math.sqrt(variance) / mean < thresholds.REGULAR_CV) reasons.push("too-regular");
  metrics.instantRatio = instantRatio;
  metrics.medianInterval = median;
  metrics.widthKinds = new Set(window.map((stroke) => stroke.width)).size;
  metrics.heightKinds = new Set(window.map((stroke) => stroke.height)).size;
  metrics.pressureKinds = new Set(window.map((stroke) => stroke.pressure)).size;
  return { bot: reasons.length > 0, reasons, metrics };
}
