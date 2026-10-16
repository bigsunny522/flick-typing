import { offerPeriods } from "../ranking/offer";
import type { RankChances, RankingBoard, ResultsResponse } from "../ranking/types";
import { loadName, loadPlayerId } from "../storage";

/** ポップアップに出す期間 */
type OfferPeriod = "period" | "alltime";

type OfferKind = "timeattack" | "endurance";

/** 期間の名前。[今期, 歴代] */
const PERIOD_LABELS: Record<OfferKind, [string, string]> = {
  timeattack: ["今週", "歴代"],
  endurance: ["今日", "歴代"],
};
const SEND_ERROR = "送れませんでした。時間をおいて試してください";

/** 中身は動かない部分だけ。名前はあとで `textContent` で入れる */
const SHELL =
  `<div class="rank-offer-box">` +
  `<p class="rank-offer-title">ランキングに入れます</p>` +
  `<p class="rank-offer-rank"></p>` +
  `<p class="rank-offer-question"></p>` +
  `<div class="rank-offer-actions">` +
  `<button type="button" class="rank-offer-ok primary-button">載せる</button>` +
  `<button type="button" class="rank-offer-cancel secondary-button">載せない</button>` +
  `</div>` +
  `<p class="rank-offer-error" role="alert"></p>` +
  `</div>`;

/**
 * 「ランキングに入れます」のポップアップを `host` の上に重ねて出す。
 * `periods` は `offerPeriods` の結果(空なら呼ばない)
 */
export function openRankOffer(
  host: HTMLElement,
  options: {
    kind: OfferKind;
    resultId: number;
    chances: RankChances;
    periods: OfferPeriod[];
    onOpenRanking: (board: RankingBoard, askName: boolean) => void;
  },
): void {
  const overlay = document.createElement("div");
  overlay.className = "rank-offer";
  overlay.innerHTML = SHELL;
  const rank = overlay.querySelector<HTMLElement>(".rank-offer-rank")!;
  const question = overlay.querySelector<HTMLElement>(".rank-offer-question")!;
  const ok = overlay.querySelector<HTMLButtonElement>(".rank-offer-ok")!;
  const cancel = overlay.querySelector<HTMLButtonElement>(".rank-offer-cancel")!;
  const error = overlay.querySelector<HTMLParagraphElement>(".rank-offer-error")!;
  const [periodLabel, alltimeLabel] = PERIOD_LABELS[options.kind];
  rank.textContent = options.periods
    .map(
      (period) =>
        `${period === "period" ? periodLabel : alltimeLabel} ${options.chances[period].rank}位`,
    )
    .join(" ・ ");
  drawQuestion();
  host.append(overlay);
  ok.addEventListener("click", () => {
    void send();
  });
  cancel.addEventListener("click", () => overlay.remove());

  /** 名前の状態で問いかけの文を変える。名前は必ず `textContent` で入れる */
  function drawQuestion(): void {
    const name = loadName();
    if (name === null) {
      question.textContent = "ランキングに載せますか?";
      return;
    }
    question.textContent = `『${name}』で載せますか?`;
  }

  /** 記録を載せて、乗ったらランキング画面へ移る。だめなら文を出して閉じない */
  async function send(): Promise<void> {
    ok.disabled = true;
    cancel.disabled = true;
    error.textContent = "";
    try {
      const response = await fetch("/api/ranking/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: loadPlayerId(), resultId: options.resultId }),
      });
      if (response.status !== 200) throw new Error(`status ${response.status}`);
    } catch {
      drawQuestion();
      error.textContent = SEND_ERROR;
      ok.disabled = false;
      cancel.disabled = false;
      return;
    }
    overlay.remove();
    options.onOpenRanking(boardToOpen(), loadName() === null);
  }

  /** 移る先。今期が先なら週 / 今日のボード、歴代が先なら歴代のボード */
  function boardToOpen(): RankingBoard {
    const alltime = options.periods[0] === "alltime";
    if (options.kind === "endurance") return alltime ? "endurance-alltime" : "endurance-daily";
    return alltime ? "timeattack-alltime" : "timeattack-weekly";
  }
}

/**
 * 送信の返事が来たら順位の行を書き、載せられるならポップアップを出す。
 * 画面が替わって順位の行が残っていないときは何もしない
 */
export function showResultRank(
  host: HTMLElement,
  rank: Promise<ResultsResponse | null>,
  options: {
    kind: OfferKind;
    periodLabel: string; // 順位の行に出す今期の名前(タイムアタックは今週、耐久は今日)
    onRanking: (board: RankingBoard, askName: boolean) => void;
  },
): void {
  const line = host.querySelector(".result-rank");
  if (!line) return;
  void rank.then((response) => {
    if (!line.isConnected || response === null || response.chances === null) return;
    const chances = response.chances;
    const period = chances.period.rank;
    const alltime = chances.alltime.rank;
    if (typeof period !== "number" || typeof alltime !== "number") return;
    line.textContent = `${options.periodLabel} ${period}位 ・ 歴代 ${alltime}位`;
    const periods = offerPeriods(chances);
    if (periods.length === 0) return;
    openRankOffer(host, {
      kind: options.kind,
      resultId: response.resultId,
      chances,
      periods,
      onOpenRanking: options.onRanking,
    });
  });
}
