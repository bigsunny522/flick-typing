import type { EnduranceEnd } from "../game/endurance";
import type { RankingBoard, ResultsResponse } from "../ranking/types";
import type { PlayMode } from "../storage";
import { bindThemeTap } from "../theme";
import { showResultRank } from "./rank-offer";

export type EnduranceResultValues = {
  correct: number;
  end: EnduranceEnd;
  miss: { expected: string; typed: string | null } | null;
  title: string;
  author: string;
  cardUrl: string;
  progress: number;
  bestUpdated: boolean;
  mode: PlayMode;
};

export function renderEnduranceResult(
  host: HTMLElement,
  values: EnduranceResultValues,
  onAgain: () => void,
  onTitle: () => void,
  rank: Promise<ResultsResponse | null>,
  onRanking: (board: RankingBoard) => void,
  onSave?: () => void,
): void {
  const saveButton = onSave ? '<button id="save" class="secondary-button">ログを保存</button>' : "";
  const bestRibbon = values.bestUpdated
    ? '<p class="ribbon accent-ribbon">今日のベスト更新</p>'
    : "";
  host.innerHTML =
    `<main class="screen result-screen endurance-result">` +
    `<div class="deco" aria-hidden="true"></div>` +
    `<button type="button" class="theme-tap" aria-label="テーマカラーを変える"></button>` +
    `<p class="ribbon">RESULT</p>` +
    `<p class="result-label">打てた文字数</p>` +
    `<div class="score">${values.correct}<small>字</small></div>` +
    `<p class="result-rank"></p>` +
    `<p class="endurance-reason">${endReason(values)}</p>` +
    bestRibbon +
    `<div class="result-grid">` +
    `<p>作品<strong class="endurance-work">${values.title} / ${values.author}</strong></p>` +
    `<p>進んだ割合<strong>${values.progress}<small>%</small></strong></p>` +
    `</div>` +
    `<div class="result-actions">` +
    `<button id="again" class="primary-button">もう一度</button>` +
    saveButton +
    `<button id="title" class="secondary-button">タイトルへ</button>` +
    `<button id="ranking" class="secondary-button">ランキング</button>` +
    `</div>` +
    `<p class="endurance-source">` +
    `<a href="${values.cardUrl}" target="_blank" rel="noopener">出典: 青空文庫</a>` +
    `</p>` +
    `</main>`;
  host.querySelector<HTMLButtonElement>("#save")?.addEventListener("click", onSave ?? (() => {}));
  host.querySelector<HTMLButtonElement>("#again")?.addEventListener("click", onAgain);
  host.querySelector<HTMLButtonElement>("#title")?.addEventListener("click", onTitle);
  host
    .querySelector<HTMLButtonElement>("#ranking")
    ?.addEventListener("click", () => onRanking("endurance-daily"));
  showResultRank(host, rank, { kind: "endurance", periodLabel: "今日", onRanking });
  bindThemeTap(host);
}

function endReason(values: EnduranceResultValues): string {
  if (values.end === "timeout") return "時間切れ";
  if (values.end === "complete") return "完走!";
  const miss = values.miss;
  if (!miss) return "ミス";
  if (miss.typed === null) {
    return `「${miss.expected}」を打つところで使えない入力(変換・貼り付けなど)`;
  }
  return `「${miss.expected}」を打つところで「${miss.typed}」を入力`;
}
