import type { BehaviorVerdict } from "../anticheat/behavior";
import type { KeyStroke } from "../keyboard/layout";

export function debugEnabled(): boolean {
  return new URLSearchParams(location.search).has("debug");
}

export function renderDebugPanel(
  host: HTMLElement,
  verdict: BehaviorVerdict,
  strokes: KeyStroke[],
  paintLatencies: number[],
): void {
  const recent = strokes.slice(-10);
  const rows = recent
    .map((stroke) => {
      const duration = (stroke.up.t - stroke.down.t).toFixed(1);
      return (
        `<tr><td>${stroke.key}</td><td>${stroke.dir}</td><td>${duration}</td>` +
        `<td>${stroke.moves}</td><td>${stroke.width}</td>` +
        `<td>${stroke.height}</td><td>${stroke.pressure}</td></tr>`
      );
    })
    .join("");
  host.innerHTML =
    `<aside class="debug-panel"><div>${summarizeLatencies(paintLatencies)}</div>` +
    `<div>${verdict.bot ? "bot" : "ok"}</div>` +
    `<div>${verdict.reasons.join(", ")}</div><pre>${JSON.stringify(verdict.metrics)}</pre>` +
    "<table><thead><tr><th>key</th><th>dir</th><th>ms</th><th>moves</th>" +
    "<th>w</th><th>h</th><th>p</th></tr></thead><tbody>" +
    `${rows}</tbody></table></aside>`;
}

function summarizeLatencies(values: number[]): string {
  const sorted = [...values].sort((a, b) => a - b);
  return `描画 中央値 ${Math.round(medianOf(sorted))}ms / 最大 ${Math.round(maxOf(sorted))}ms`;
}

function medianOf(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[middle - 1] + sorted[middle]) / 2;
  return sorted[middle];
}

function maxOf(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  return sorted[sorted.length - 1];
}

export function downloadLog(log: unknown): void {
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `flick-typing-log-${new Date().toISOString()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
