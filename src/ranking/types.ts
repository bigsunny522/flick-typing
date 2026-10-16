/** ランキングの種目 */
export type RankingBoard =
  "timeattack-weekly" | "timeattack-alltime" | "endurance-daily" | "endurance-alltime";

/** 送った記録を載せたときの、ある期間での順位 */
export type RankChance = {
  rank: number; // 載せたら何位か(自分のほかの記録は数えない)
  improves: boolean; // 自分がその期間に載せている記録より良いか(載せていなければ true)
};

/** 今期(タイムアタックは今週、耐久はその日)と歴代 */
export type RankChances = { period: RankChance; alltime: RankChance };

/** `POST /api/results` の返す値 */
export type ResultsResponse = {
  resultId: number; // 入れた行の results.id
  chances: RankChances | null; // ランキングの対象外(flick・古いルール・ban)なら null
};

/** `POST /api/ranking/entry` に送る値 */
export type EntryRequest = { playerId: string; resultId: number };

/** 一覧の1行。`playerId` は含めない */
export type RankingEntry = { rank: number; name: string; correct: number; mine: boolean };

/** `GET /api/ranking` の返す値 */
export type RankingResponse = {
  board: RankingBoard;
  period: string | null; // weekly は "10/12〜10/18"、daily は "10/16"、alltime は null
  passage: { title: string; author: string } | null; // endurance-daily だけ
  entries: RankingEntry[]; // 上位 100 人
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
