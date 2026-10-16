import type { PlayMode } from "../storage";
import { bindThemeTap } from "../theme";
import { startCelebration } from "./celebration";

export type ResultValues = {
  correct: number;
  miss: number;
  maxCombo: number;
  endTimeMs: number;
  bestUpdated: boolean;
  mode: PlayMode;
  perfect: boolean;
};

/** フラッシュの要素を取り除くまでの秒数 */
const FLASH_SECONDS = 600;

/** 帯のまわりに散らばる星。位置は `.perfect-burst` の左上を基準にする */
const STARS = [
  { sx: "-8%", sy: "-30%", ss: 14, sd: 0 },
  { sx: "18%", sy: "105%", ss: 10, sd: 0.4 },
  { sx: "48%", sy: "-45%", ss: 12, sd: 0.9 },
  { sx: "80%", sy: "110%", ss: 16, sd: 0.2 },
  { sx: "102%", sy: "-20%", ss: 10, sd: 1.2 },
  { sx: "64%", sy: "120%", ss: 8, sd: 0.7 },
];

export function renderResult(
  host: HTMLElement,
  values: ResultValues,
  onAgain: () => void,
  onTitle: () => void,
  onSave?: () => void,
): void {
  const total = values.correct + values.miss;
  const accuracy = total === 0 ? 0 : values.correct / total;
  const cps = values.correct / (values.endTimeMs / 1000);
  const saveButton = onSave ? '<button id="save" class="secondary-button">ログを保存</button>' : "";
  const reduced = prefersReducedMotion();
  const showCelebration = values.perfect && !reduced;
  const mainClass = values.perfect
    ? `screen result-screen ${reduced ? "perfect-result-static" : "perfect-result"}`
    : "screen result-screen";
  const celebration = showCelebration
    ? '<div class="celebration" aria-hidden="true"><div class="celebration-flash"></div></div>'
    : "";
  const burst = values.perfect ? perfectBurst() : "";
  const scoreClass = values.perfect ? "score perfect-score" : "score";
  host.innerHTML =
    celebration +
    `<main class="${mainClass}">` +
    `<div class="deco" aria-hidden="true"></div><button type="button" class="theme-tap" aria-label="テーマカラーを変える"></button><p class="ribbon">RESULT</p>` +
    `<p class="result-mode">${modeLabel(values.mode)}</p>` +
    `${burst}<p class="result-label">正しく打てた文字数</p><div class="${scoreClass}">${values.correct}<small>字</small></div>` +
    `${values.bestUpdated ? '<p class="ribbon accent-ribbon">自己ベスト更新</p>' : ""}<div class="result-grid">` +
    `<p>ミス<strong>${values.miss}</strong></p><p>正確率<strong>${(accuracy * 100).toFixed(1)}<small>%</small></strong></p>` +
    `<p>1秒あたり<strong>${cps.toFixed(2)}<small>字</small></strong></p><p>最大コンボ<strong>${values.maxCombo}</strong></p></div>` +
    `<p class="duration">プレイ時間 ${(values.endTimeMs / 1000).toFixed(1)}秒(ボーナス +${((values.endTimeMs - 60000) / 1000).toFixed(1)}秒)</p>` +
    `<div class="result-actions"><button id="again" class="primary-button">もう一度</button>${saveButton}<button id="title" class="secondary-button">タイトルへ</button></div></main>`;
  host.querySelector<HTMLButtonElement>("#save")?.addEventListener("click", onSave ?? (() => {}));
  host.querySelector<HTMLButtonElement>("#again")?.addEventListener("click", onAgain);
  host.querySelector<HTMLButtonElement>("#title")?.addEventListener("click", onTitle);
  bindThemeTap(host);
  startIfPossible(host, showCelebration);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 光の筋・星・帯を1つにまとめた入れ物を作る */
function perfectBurst(): string {
  const stars = STARS.map(
    (star) =>
      `<i class="perfect-star" style="--sx:${star.sx};--sy:${star.sy};--ss:${star.ss};--sd:${star.sd}"></i>`,
  ).join("");
  return (
    `<div class="perfect-burst"><div class="perfect-rays"></div>${stars}` +
    `<p class="ribbon perfect-ribbon">PERFECT</p></div>`
  );
}

/** 描いたあと、紙吹雪を動かし、0.6 秒後にフラッシュを取り除く */
function startIfPossible(host: HTMLElement, showCelebration: boolean): void {
  if (!showCelebration) return;
  const layer = host.querySelector<HTMLElement>(".celebration");
  if (!layer) return;
  const flash = layer.querySelector<HTMLElement>(".celebration-flash");
  startCelebration(layer);
  window.setTimeout(() => flash?.remove(), FLASH_SECONDS);
}

function modeLabel(mode: PlayMode): string {
  return mode === "native" ? "スマホのキーボード" : "フリックキーボード";
}
