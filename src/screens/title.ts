import { saveMode, type Best, type PlayMode } from "../storage";
import { bindThemeTap } from "../theme";
import type { EnvVerdict } from "../anticheat/env";

const MODE_ORDER: PlayMode[] = ["flick", "native"];
const MODE_LABEL: Record<PlayMode, string> = {
  flick: "フリックキーボード",
  native: "スマホのキーボード",
};
const NATIVE_HINT = "フリック入力で打ってください(トグル入力は使えません)";

export type TitleEndurance = {
  title: string;
  author: string;
  loadBest: (mode: PlayMode) => number | null;
};

export function renderTitle(
  host: HTMLElement,
  mode: PlayMode,
  loadBestFor: (mode: PlayMode) => Best | null,
  verdict: EnvVerdict,
  debug: boolean,
  onStart: (mode: PlayMode) => void,
  endurance: TitleEndurance,
  onStartEndurance: (mode: PlayMode) => void,
): void {
  let current = mode;
  const modeButtonsHtml = MODE_ORDER.map(
    (item) =>
      `<button type="button" data-mode="${item}" aria-pressed="${String(item === mode)}">${MODE_LABEL[item]}</button>`,
  ).join("");
  const best = loadBestFor(mode);
  const enduranceBest = endurance.loadBest(mode);
  host.innerHTML =
    `<main class="screen title-screen">` +
    `<div class="deco" aria-hidden="true"></div>` +
    `<button type="button" class="theme-tap" aria-label="テーマカラーを変える"></button>` +
    `<p class="ribbon">FLICK TYPING</p>` +
    `<h1>ふりっく<br />タイピング</h1>` +
    `<p class="intro">フリックだけで打つタイピング。</p>` +
    `${debug ? `<pre class="debug">${verdict.kind}: ${verdict.reasons.join(", ")}</pre>` : ""}` +
    `<div class="title-actions">` +
    `<div class="mode-select">${modeButtonsHtml}</div>` +
    `<p class="native-hint"${mode === "native" ? "" : " hidden"}>${NATIVE_HINT}</p>` +
    `<div class="game-cards">` +
    `<section class="game-card">` +
    `<p class="game-card-label">タイムアタック</p>` +
    `<p class="game-card-sub">60秒から開始<br />連続正解で時間が増える</p>` +
    `<div class="game-card-best">` +
    `<span>自己ベスト</span>` +
    `<strong><span id="best-value">${best?.correct ?? "—"}</span><small>字</small></strong>` +
    `</div>` +
    `<button id="start" class="primary-button">はじめる</button>` +
    `</section>` +
    `<section class="game-card">` +
    `<p class="game-card-label">今日の耐久</p>` +
    `<p class="game-card-sub">${endurance.title} / ${endurance.author}<br />1回ミスしたら終了</p>` +
    `<div class="game-card-best">` +
    `<span>今日のベスト</span>` +
    `<strong><span id="endurance-best-value">${enduranceBest ?? "—"}</span><small>字</small></strong>` +
    `</div>` +
    `<button id="start-endurance" class="secondary-button">挑戦する</button>` +
    `</section>` +
    `</div>` +
    `</div>` +
    `</main>`;
  const bestValue = host.querySelector<HTMLElement>("#best-value")!;
  const enduranceBestValue = host.querySelector<HTMLElement>("#endurance-best-value")!;
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
    enduranceBestValue.textContent = String(endurance.loadBest(next) ?? "—");
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
  host
    .querySelector<HTMLButtonElement>("#start-endurance")
    ?.addEventListener("click", () => onStartEndurance(current));
  bindThemeTap(host);
}
