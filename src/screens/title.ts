import type { Best, PlayMode } from "../storage";
import { bindThemeTap } from "../theme";
import type { EnvVerdict } from "../anticheat/env";

const NATIVE_HINT = "フリック入力で打ってください(トグル入力は使えません)";

export type TitleEndurance = {
  title: string;
  author: string;
  loadBest: (mode: PlayMode) => number | null;
};

export function renderTitle(
  host: HTMLElement,
  loadBestFor: (mode: PlayMode) => Best | null,
  verdict: EnvVerdict,
  debug: boolean,
  onStart: (mode: PlayMode) => void,
  endurance: TitleEndurance,
  onStartEndurance: (mode: PlayMode) => void,
  onRanking: () => void,
): void {
  const best = loadBestFor("native");
  const enduranceBest = endurance.loadBest("native");
  host.innerHTML =
    `<main class="screen title-screen">` +
    `<div class="deco" aria-hidden="true"></div>` +
    `<button type="button" class="theme-tap" aria-label="テーマカラーを変える"></button>` +
    `<p class="ribbon">FLICK TYPING</p>` +
    `<h1>ふりっく<br />タイピング</h1>` +
    `<p class="intro">フリックだけで打つタイピング。</p>` +
    `${debug ? `<pre class="debug">${verdict.kind}: ${verdict.reasons.join(", ")}</pre>` : ""}` +
    `<div class="title-actions">` +
    `<p class="native-hint">${NATIVE_HINT}</p>` +
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
    `<button id="ranking" class="secondary-button title-ranking">ランキング</button>` +
    `</div>` +
    `</main>`;
  host
    .querySelector<HTMLButtonElement>("#start")
    ?.addEventListener("click", () => onStart("native"));
  host
    .querySelector<HTMLButtonElement>("#start-endurance")
    ?.addEventListener("click", () => onStartEndurance("native"));
  host.querySelector<HTMLButtonElement>("#ranking")?.addEventListener("click", onRanking);
  bindThemeTap(host);
}
