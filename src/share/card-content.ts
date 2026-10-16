import { SITE_URL, type ShareSource } from "./text";

export type CardContent = {
  modeLabel: string; // "タイムアタック" / "今日の耐久"
  score: number; // correct
  rankLabel: string | null; // "今週 5位" / "今日 3位"。rank が null なら null
  badges: string[]; // 下の表の順。当てはまるものだけ
  stats: [string, string][]; // [見出し, 値]
  dateLabel: string; // "2026/10/07"
  footer: string; // SITE_URL から https:// と最後の / を除いたもの
};

/** カード画像に書く中身。`date` は端末の時刻(ローカル時刻で書く) */
export function cardContent(source: ShareSource, rank: number | null, date: Date): CardContent {
  if (source.kind === "timeattack") return timeattackCard(source, rank, date);
  return enduranceCard(source, rank, date);
}

function timeattackCard(
  source: Extract<ShareSource, { kind: "timeattack" }>,
  rank: number | null,
  date: Date,
): CardContent {
  const total = source.correct + source.miss;
  const accuracy = total === 0 ? 0 : source.correct / total;
  const cps = source.correct / (source.endTimeMs / 1000);
  const badges: string[] = [];
  if (source.perfect) badges.push("PERFECT");
  if (source.bestUpdated) badges.push("自己ベスト更新");
  return {
    modeLabel: "タイムアタック",
    score: source.correct,
    rankLabel: rank === null ? null : `今週 ${rank}位`,
    badges,
    stats: [
      ["ミス", String(source.miss)],
      ["正確率", `${(accuracy * 100).toFixed(1)}%`],
      ["1秒あたり", `${cps.toFixed(2)}字`],
      ["最大コンボ", String(source.maxCombo)],
    ],
    dateLabel: dateLabel(date),
    footer: footer(),
  };
}

function enduranceCard(
  source: Extract<ShareSource, { kind: "endurance" }>,
  rank: number | null,
  date: Date,
): CardContent {
  const badges: string[] = [];
  if (source.complete) badges.push("完走");
  if (source.bestUpdated) badges.push("今日のベスト更新");
  return {
    modeLabel: "今日の耐久",
    score: source.correct,
    rankLabel: rank === null ? null : `今日 ${rank}位`,
    badges,
    stats: [
      ["作品", `${source.title} / ${source.author}`],
      ["進んだ割合", `${source.progress}%`],
    ],
    dateLabel: dateLabel(date),
    footer: footer(),
  };
}

function dateLabel(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}/${month}/${day}`;
}

function footer(): string {
  return SITE_URL.replace(/^https:\/\//, "").replace(/\/$/, "");
}
