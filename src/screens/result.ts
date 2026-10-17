import type { RankingBoard, ResultsResponse } from "../ranking/types";
import { bindShare } from "../share/bind";
import type { ShareSource } from "../share/text";
import type { PlayMode } from "../storage";
import { bindThemeTap } from "../theme";
import { showResultRank } from "./rank-offer";

export type ResultValues = {
  correct: number;
  miss: number;
  maxCombo: number;
  endTimeMs: number;
  bestUpdated: boolean;
  mode: PlayMode;
  perfect: boolean;
};

/** 紙吹雪を降らせる秒数。一番長い紙吹雪(3.0 秒)+ 遅れ(0.6 秒)より少し長く取る */
const CONFETTI_LIFETIME_MS = 3600;

export function renderResult(
  host: HTMLElement,
  values: ResultValues,
  onAgain: () => void,
  onTitle: () => void,
  rank: Promise<ResultsResponse | null>,
  onRanking: (board: RankingBoard, askName: boolean) => void,
  onSave?: () => void,
  revisit = false,
): void {
  const total = values.correct + values.miss;
  const accuracy = total === 0 ? 0 : values.correct / total;
  const cps = values.correct / (values.endTimeMs / 1000);
  const saveButton = onSave ? '<button id="save" class="secondary-button">ログを保存</button>' : "";
  const ribbon = values.perfect ? '<p class="ribbon perfect-ribbon">PERFECT</p>' : "";
  const confetti = values.perfect && !revisit && !prefersReducedMotion() ? confettiMarkup() : "";
  const source: ShareSource = {
    kind: "timeattack",
    correct: values.correct,
    miss: values.miss,
    maxCombo: values.maxCombo,
    endTimeMs: values.endTimeMs,
    perfect: values.perfect,
    bestUpdated: values.bestUpdated,
  };
  host.innerHTML =
    `<main class="screen result-screen">${confetti}` +
    `<div class="deco" aria-hidden="true"></div><button type="button" class="theme-tap" aria-label="テーマカラーを変える"></button><p class="ribbon">RESULT</p>` +
    `${ribbon}<p class="result-label">正しく打てた文字数</p><div class="score">${values.correct}<small>字</small></div>` +
    `<p class="result-rank"></p>` +
    `${values.bestUpdated ? '<p class="ribbon accent-ribbon">自己ベスト更新</p>' : ""}<div class="result-grid">` +
    `<p>ミス<strong>${values.miss}</strong></p><p>正確率<strong>${(accuracy * 100).toFixed(1)}<small>%</small></strong></p>` +
    `<p>1秒あたり<strong>${cps.toFixed(2)}<small>字</small></strong></p><p>最大コンボ<strong>${values.maxCombo}</strong></p></div>` +
    `<p class="duration">プレイ時間 ${(values.endTimeMs / 1000).toFixed(1)}秒(ボーナス +${((values.endTimeMs - 60000) / 1000).toFixed(1)}秒)</p>` +
    `<div class="result-actions">` +
    `<div class="result-actions-row share-row">` +
    `<a id="share-x" class="share-x-button" target="_blank" rel="noopener noreferrer">` +
    `<svg class="share-x-logo" viewBox="0 0 24 24" aria-hidden="true">` +
    `<path` +
    ` fill="currentColor"` +
    ` d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"` +
    `/>` +
    `</svg>` +
    `でポスト` +
    `</a>` +
    `<button id="share-image" class="secondary-button" disabled>画像で共有</button>` +
    `</div>` +
    `<button id="again" class="primary-button">もう一度</button>${saveButton}` +
    `<div class="result-actions-row">` +
    `<button id="title" class="secondary-button">タイトルへ</button>` +
    `<button id="ranking" class="secondary-button">ランキング</button>` +
    `</div></div></main>`;
  host.querySelector<HTMLButtonElement>("#save")?.addEventListener("click", onSave ?? (() => {}));
  host.querySelector<HTMLButtonElement>("#again")?.addEventListener("click", onAgain);
  host.querySelector<HTMLButtonElement>("#title")?.addEventListener("click", onTitle);
  host
    .querySelector<HTMLButtonElement>("#ranking")
    ?.addEventListener("click", () => onRanking("timeattack-weekly", false));
  showResultRank(host, rank, {
    kind: "timeattack",
    periodLabel: "今週",
    onRanking,
    offer: !revisit,
  });
  bindThemeTap(host);
  bindShare(host, source, rank);
  removeConfettiLater(host);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** 画面全体に降る紙吹雪の入れ物を作る。色とタイミングは各 `<i>` に入れる */
function confettiMarkup(): string {
  const colors = ["var(--primary)", "var(--accent)", "var(--fg)"];
  const pieces: string[] = [];
  for (let i = 0; i < 40; i += 1) {
    const x = Math.round(Math.random() * 100);
    const delay = (Math.random() * 0.6).toFixed(2);
    const duration = (1.8 + Math.random() * 1.2).toFixed(2);
    const drift = Math.round(Math.random() * 80 - 40);
    const spin = Math.round(360 + Math.random() * 720);
    const color = colors[Math.floor(Math.random() * colors.length)];
    pieces.push(
      `<i style="--x:${x};--delay:${delay}s;--duration:${duration}s;--drift:${drift}px;` +
        `--spin:${spin}deg;--color:${color}"></i>`,
    );
  }
  return `<div class="confetti" aria-hidden="true">${pieces.join("")}</div>`;
}

/** 落ちきる頃に紙吹雪を取り除く。画面が替わって外れていても `remove()` は安全 */
function removeConfettiLater(host: HTMLElement): void {
  const confetti = host.querySelector(".confetti");
  if (!confetti) return;
  window.setTimeout(() => confetti.remove(), CONFETTI_LIFETIME_MS);
}
