import { saveMode, type Best, type PlayMode } from "../storage";
import { bindThemeTap } from "../theme";
import type { EnvVerdict } from "../anticheat/env";

const MODE_ORDER: PlayMode[] = ["flick", "native"];
const MODE_LABEL: Record<PlayMode, string> = {
  flick: "フリックキーボード",
  native: "スマホのキーボード",
};
const NATIVE_HINT = "フリック入力で打ってください(トグル入力は使えません)";

export function renderTitle(
  host: HTMLElement,
  mode: PlayMode,
  loadBestFor: (mode: PlayMode) => Best | null,
  verdict: EnvVerdict,
  debug: boolean,
  onStart: (mode: PlayMode) => void,
): void {
  let current = mode;
  const modeButtonsHtml = MODE_ORDER.map(
    (item) =>
      `<button type="button" data-mode="${item}" aria-pressed="${String(item === mode)}">${MODE_LABEL[item]}</button>`,
  ).join("");
  const best = loadBestFor(mode);
  host.innerHTML = `<main class="screen title-screen"><div class="deco" aria-hidden="true"></div><button type="button" class="theme-tap" aria-label="テーマカラーを変える"></button><p class="ribbon">FLICK TYPING</p><h1>ふりっく<br />タイピング</h1><p class="intro">フリックだけで打つタイピング。<br />ミスせず続けると時間が増える。</p><p class="native-hint"${mode === "native" ? "" : " hidden"}>${NATIVE_HINT}</p><div class="best"><span>自己ベスト</span><strong><span id="best-value">${best?.correct ?? "—"}</span><small>字</small></strong></div>${debug ? `<pre class="debug">${verdict.kind}: ${verdict.reasons.join(", ")}</pre>` : ""}<div class="mode-select">${modeButtonsHtml}</div><button id="start" class="primary-button">はじめる</button></main>`;
  const bestValue = host.querySelector<HTMLElement>("#best-value")!;
  const hint = host.querySelector<HTMLElement>(".native-hint")!;
  const buttons = host.querySelectorAll<HTMLButtonElement>(".mode-select button");
  const select = (next: PlayMode) => {
    current = next;
    saveMode(next);
    buttons.forEach((button) =>
      button.setAttribute("aria-pressed", String(button.dataset.mode === next)),
    );
    const nextBest = loadBestFor(next);
    bestValue.textContent = nextBest ? String(nextBest.correct) : "—";
    hint.hidden = next !== "native";
  };
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.mode;
      if (next === "flick" || next === "native") select(next);
    });
  });
  host
    .querySelector<HTMLButtonElement>("#start")
    ?.addEventListener("click", () => onStart(current));
  bindThemeTap(host);
}
