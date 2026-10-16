import "../style.css";
import "./stats.css";
import { PASSAGES } from "../game/endurance";
import type { PlayMode } from "../game/mode";
import { loadBest, loadEnduranceBest, loadMode, loadTheme } from "../storage";
import {
  histogram,
  topPercent,
  type Bin,
  type ModeSummary,
  type StatsResponse,
} from "../stats/summary";
import { applyTheme, bindThemeTap, parseTheme } from "../theme";
import { axisTicks } from "./chart";

const MODE_ORDER: PlayMode[] = ["flick", "native"];
const MODE_LABEL: Record<PlayMode, string> = {
  flick: "フリック",
  native: "標準キーボード",
};

type Chart = {
  title: string;
  bins: Bin[];
  mine: number | null;
  label: (bin: Bin) => string;
  tick: (value: number) => string;
};

async function loadStats(): Promise<StatsResponse> {
  const response = await fetch("/api/stats");
  if (!response.ok) throw new Error(`/api/stats: ${response.status}`);
  return (await response.json()) as StatsResponse;
}

function shell(body: string): string {
  return (
    `<main class="screen stats-screen">` +
    `<div class="deco" aria-hidden="true"></div>` +
    `<button type="button" class="theme-tap" aria-label="テーマカラーを変える"></button>` +
    `${backLink()}<h1>みんなの記録</h1>${body}</main>`
  );
}

function backLink(): string {
  return `<p class="stats-back"><a href="/">ゲームへ戻る</a></p>`;
}

function renderLoading(host: HTMLElement): void {
  host.innerHTML = shell('<p class="stats-message">読み込み中…</p>');
  bindThemeTap(host);
}

function renderError(host: HTMLElement): void {
  host.innerHTML = shell('<p class="stats-message">記録を読み込めませんでした</p>');
  bindThemeTap(host);
}

function renderStats(host: HTMLElement, stats: StatsResponse): void {
  let current = loadMode();
  const draw = (): void => {
    host.innerHTML = shell(`${modeSelectHtml(current)}${sectionsHtml(stats, current)}`);
    bindThemeTap(host);
    host.querySelectorAll<HTMLButtonElement>(".mode-select button").forEach((button) => {
      button.addEventListener("click", () => {
        const next = button.dataset.mode;
        if (next === "flick" || next === "native") {
          current = next;
          draw();
        }
      });
    });
  };
  draw();
}

function modeSelectHtml(mode: PlayMode): string {
  const buttons = MODE_ORDER.map(
    (item) =>
      `<button type="button" data-mode="${item}" aria-pressed="${String(item === mode)}">${MODE_LABEL[item]}</button>`,
  ).join("");
  return `<div class="mode-select">${buttons}</div>`;
}

function sectionsHtml(stats: StatsResponse, mode: PlayMode): string {
  return timeattackHtml(stats, mode) + enduranceHtml(stats, mode);
}

function timeattackHtml(stats: StatsResponse, mode: PlayMode): string {
  const summary = stats.timeattack[mode];
  const best = loadBest(mode);
  const correct = best?.correct ?? null;
  const corrects = summary.bests.map((row) => row.correct);
  const top = correct === null ? null : topPercent(corrects, correct);
  const charts =
    summary.players === 0
      ? emptyHtml()
      : chartHtml({
          title: "正解数(文字)",
          bins: histogram(corrects, 10),
          mine: correct,
          label: (bin) => `${bin.from}〜${bin.to}`,
          tick: (value) => String(value),
        }) +
        chartHtml({
          title: "正確率",
          bins: histogram(
            summary.bests.map((row) => row.accuracy),
            0.05,
            1,
          ),
          mine: best?.accuracy ?? null,
          label: percentLabel,
          tick: percentTick,
        }) +
        chartHtml({
          title: "打鍵速度(文字/秒)",
          bins: histogram(
            summary.bests.map((row) => row.cps),
            0.5,
          ),
          mine: best?.cps ?? null,
          label: (bin) => `${bin.from}〜${bin.to}文字/秒`,
          tick: (value) => String(value),
        });
  return sectionHtml(
    "タイムアタック",
    summary,
    bestLineHtml("あなたの自己ベスト", correct),
    top,
    charts,
  );
}

function enduranceHtml(stats: StatsResponse, mode: PlayMode): string {
  const summary = stats.endurance[mode];
  const best = loadEnduranceBest(mode, stats.endurance.dateKey);
  const correct = best?.correct ?? null;
  const top = correct === null ? null : topPercent(summary.bests, correct);
  const total = stats.endurance.totalReading;
  const passage = PASSAGES.find((item) => item.id === stats.endurance.passageId);
  const title = passage ? `耐久(今日の文章: ${passage.title})` : "耐久";
  const charts =
    summary.players === 0
      ? emptyHtml()
      : chartHtml({
          title: "進んだ割合",
          bins: histogram(
            summary.bests.map((value) => value / total),
            0.1,
            1,
          ),
          mine: correct === null ? null : correct / total,
          label: percentLabel,
          tick: percentTick,
        });
  return sectionHtml(title, summary, bestLineHtml("あなたの今日の記録", correct), top, charts);
}

function sectionHtml(
  title: string,
  summary: ModeSummary<unknown>,
  best: string,
  top: number | null,
  charts: string,
): string {
  const topLine = top === null ? "" : `<p class="stats-top">上位 ${top}%</p>`;
  return (
    `<section class="stats-section">` +
    `<h2>${title}</h2>` +
    `<p class="stats-count">${summary.players}人・${summary.plays}プレイ</p>` +
    best +
    topLine +
    charts +
    `</section>`
  );
}

function bestLineHtml(label: string, correct: number | null): string {
  if (correct === null) return `<p class="stats-best stats-message">まだ記録がありません</p>`;
  return `<p class="stats-best">${label} <strong>${correct}</strong>文字</p>`;
}

function emptyHtml(): string {
  return '<p class="stats-message">まだ記録がありません</p>';
}

function chartHtml(chart: Chart): string {
  const binCount = chart.bins.length;
  const maxCount = Math.max(1, ...chart.bins.map((bin) => bin.count));
  const mineIndex = chart.mine === null ? -1 : binIndexOf(chart.bins, chart.mine);
  const showCounts = binCount <= 12;
  const maxNote = showCounts ? "" : `<span class="stats-max">最大 ${maxCount}人</span>`;
  const bars = chart.bins
    .map((bin, index) => {
      const height = Math.round((bin.count / maxCount) * 100);
      const mineClass = index === mineIndex ? " stats-bar-mine" : "";
      const count =
        showCounts && bin.count >= 1 ? `<span class="stats-value">${bin.count}</span>` : "";
      const mine = index === mineIndex ? '<span class="stats-you">あなた</span>' : "";
      return (
        `<div class="stats-col" title="${chart.label(bin)} ${bin.count}人">` +
        mine +
        count +
        `<span class="stats-bar${mineClass}" style="height: ${height}%"></span>` +
        `</div>`
      );
    })
    .join("");
  const ticks = axisTicks(binCount)
    .map((index) => {
      const value = index < binCount ? chart.bins[index].from : chart.bins[binCount - 1].to;
      const left = (index / binCount) * 100;
      const edge = index === 0 ? " stats-tick-start" : index === binCount ? " stats-tick-end" : "";
      return `<span class="stats-tick${edge}" style="left: ${left}%">${chart.tick(value)}</span>`;
    })
    .join("");
  return (
    `<div class="stats-chart">` +
    `<p class="stats-chart-title">${chart.title}${maxNote}</p>` +
    `<div class="stats-plot">` +
    `<div class="stats-bars">${bars}</div>` +
    `<div class="stats-baseline"></div>` +
    `<div class="stats-axis">${ticks}</div>` +
    `</div>` +
    `</div>`
  );
}

/** 値が入る区間の index。summary.ts の histogram と同じ決め方にする */
function binIndexOf(bins: Bin[], value: number): number {
  if (bins.length === 0) return -1;
  const width = bins[0].to - bins[0].from;
  const index = Math.floor(value / width + 1e-9);
  return Math.min(bins.length - 1, Math.max(0, index));
}

function percentLabel(bin: Bin): string {
  return `${Math.round(bin.from * 100)}〜${Math.round(bin.to * 100)}%`;
}

function percentTick(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("#app がありません。");
const root: HTMLElement = app;

applyTheme(parseTheme(loadTheme()));
renderLoading(root);
loadStats()
  .then((stats) => renderStats(root, stats))
  .catch(() => renderError(root));
