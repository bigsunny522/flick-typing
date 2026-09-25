import type { BehaviorVerdict } from "../anticheat/behavior";
import type { KeyStroke } from "../keyboard/layout";

export function debugEnabled(): boolean {
  return new URLSearchParams(location.search).has("debug");
}

export function renderDebugPanel(
  host: HTMLElement,
  verdict: BehaviorVerdict,
  strokes: KeyStroke[],
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
    `<aside class="debug-panel"><div>${verdict.bot ? "bot" : "ok"}</div>` +
    `<div>${verdict.reasons.join(", ")}</div><pre>${JSON.stringify(verdict.metrics)}</pre>` +
    "<table><thead><tr><th>key</th><th>dir</th><th>ms</th><th>moves</th>" +
    "<th>w</th><th>h</th><th>p</th></tr></thead><tbody>" +
    `${rows}</tbody></table></aside>`;
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
