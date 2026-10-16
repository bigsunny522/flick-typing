import { rankLabel, type RankResponse } from "../stats/summary";

/** 順位の行(最初は hidden)と /stats へのリンクの HTML */
export function rankSlotHtml(): string {
  return (
    `<p class="result-rank" hidden></p>` +
    `<p class="result-links"><a href="/stats">みんなの記録を見る ›</a></p>`
  );
}

/** host の中の順位の行に順位を入れて表示する。行が見つからなければ何もしない */
export function fillRank(host: HTMLElement, rank: RankResponse): void {
  const row = host.querySelector<HTMLElement>(".result-rank");
  if (!row) return;
  row.textContent = rankText(rank);
  row.hidden = false;
}

/** 順位の行の文字列 */
export function rankText(rank: RankResponse): string {
  if (rank.kind === "endurance") return `今日 ${rankLabel(rank.today)}`;
  return `今週 ${rankLabel(rank.week)}・全期間 ${rankLabel(rank.all)}`;
}
