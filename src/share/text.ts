/** 共有する URL(本番) */
export const SITE_URL = "https://flicktypinggame.xyzack271.com/";

/** ハッシュタグ(# なし) */
export const HASHTAG = "ふりっくタイピング";

/** シェアする結果 */
export type ShareSource =
  | {
      kind: "timeattack";
      correct: number;
      miss: number;
      maxCombo: number;
      endTimeMs: number;
      perfect: boolean;
      bestUpdated: boolean;
    }
  | {
      kind: "endurance";
      correct: number;
      title: string;
      author: string;
      progress: number; // 進んだ割合(%)。画面と同じ値
      complete: boolean; // 完走したか(end === "complete")
      bestUpdated: boolean;
    };

/** 投稿の文。`rank` は今期(今週 / 今日)の順位。分からなければ null */
export function shareText(source: ShareSource, rank: number | null, date: Date): string {
  const lines = [firstLine(source)];
  if (rank !== null) lines.push(rankLine(source, rank, date));
  lines.push("");
  lines.push(inviteLine(source));
  lines.push(`#${HASHTAG}`);
  return lines.join("\n");
}

/** X の投稿画面の URL。URL は `url=` ではなく文の最後の行に入れる */
export function xIntentUrl(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(`${text}\n${SITE_URL}`)}`;
}

/** 画像のファイル名。`date` は端末の時刻(ローカル時刻で書く) */
export function imageFileName(date: Date): string {
  const day = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
  const time = `${pad2(date.getHours())}${pad2(date.getMinutes())}`;
  return `flick-typing-${day}-${time}.png`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function firstLine(source: ShareSource): string {
  if (source.kind === "timeattack") {
    const head = source.perfect
      ? `フリック入力60秒タイムアタックでノーミス${source.correct}字!`
      : `フリック入力60秒タイムアタックで${source.correct}字!`;
    return source.bestUpdated ? `${head}自己ベスト更新!` : head;
  }
  const head = source.complete
    ? `今日の耐久「${source.title}」を${source.correct}字で完走!`
    : `今日の耐久「${source.title}」を${source.correct}字(${source.progress}%)まで打った!`;
  return source.bestUpdated ? `${head}今日のベスト更新!` : head;
}

/** 2行目。順位が変わるので「暫定」と日付で書く */
function rankLine(source: ShareSource, rank: number, date: Date): string {
  const period = source.kind === "timeattack" ? "今週" : "今日";
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${period}のランキングで暫定${rank}位(${month}/${day}時点)`;
}

/** 3行目。見た人に遊びたくなる一言 */
function inviteLine(source: ShareSource): string {
  if (source.kind === "timeattack") return "この記録、抜ける?";
  return "今日中なら同じ文章で勝負できる!";
}
