/** ランキングの種目 */
export type RankingBoard =
  "timeattack-weekly" | "timeattack-alltime" | "endurance-daily" | "endurance-alltime";

/** 送った結果に対する順位 */
export type Ranks = { period: number; alltime: number };

/** `POST /api/results` の返す値 */
export type ResultsResponse = { ranks: Ranks | null };

/** 一覧の1行。`playerId` は含めない */
export type RankingEntry = { rank: number; name: string; correct: number; mine: boolean };

/** `GET /api/ranking` の返す値 */
export type RankingResponse = {
  board: RankingBoard;
  period: string | null; // weekly は "10/12〜10/18"、daily は "10/16"、alltime は null
  passage: { title: string; author: string } | null; // endurance-daily だけ
  entries: RankingEntry[]; // 上位 50 人
  me: { rank: number; correct: number } | null; // X-Player-Id の人。記録がなければ null
};

const BOARDS: RankingBoard[] = [
  "timeattack-weekly",
  "timeattack-alltime",
  "endurance-daily",
  "endurance-alltime",
];

export function isRankingBoard(value: unknown): value is RankingBoard {
  return BOARDS.includes(value as RankingBoard);
}
