import type { Best } from "../storage";
import type { EnvVerdict } from "../anticheat/env";

export function renderTitle(
  host: HTMLElement,
  best: Best | null,
  verdict: EnvVerdict,
  debug: boolean,
  onStart: () => void,
): void {
  host.innerHTML = `<main class="screen title-screen"><div class="deco" aria-hidden="true"></div><p class="ribbon">FLICK TYPING</p><h1>ふりっく<br />タイピング</h1><p class="intro">フリックだけで打つタイピング。<br />ミスせず続けると時間が増える。</p><div class="best"><span>自己ベスト</span><strong>${best?.correct ?? "—"}<small>字</small></strong></div>${debug ? `<pre class="debug">${verdict.kind}: ${verdict.reasons.join(", ")}</pre>` : ""}<button id="start" class="primary-button">はじめる</button></main>`;
  host.querySelector<HTMLButtonElement>("#start")?.addEventListener("click", onStart);
}
