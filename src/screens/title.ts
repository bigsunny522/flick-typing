import type { Best } from "../storage";
import type { EnvVerdict } from "../anticheat/env";

export function renderTitle(
  host: HTMLElement,
  best: Best | null,
  verdict: EnvVerdict,
  debug: boolean,
  onStart: () => void,
): void {
  host.innerHTML = `<main class="screen"><h1>ふりっくタイピング</h1><p>フリックだけで打って、ミスせず続けよう。</p><p>自己ベスト: ${best?.correct ?? "—"}</p>${debug ? `<pre class="debug">${verdict.kind}: ${verdict.reasons.join(", ")}</pre>` : ""}<button id="start">はじめる</button></main>`;
  host.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", onStart);
}
