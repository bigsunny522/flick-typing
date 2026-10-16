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
export function shareText(source: ShareSource, rank: number | null): string {
  return `${firstLine(source, rank)}\n#${HASHTAG}`;
}

/** X の投稿画面の URL */
export function xIntentUrl(text: string): string {
  const query = `text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE_URL)}`;
  return `https://x.com/intent/post?${query}`;
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

function firstLine(source: ShareSource, rank: number | null): string {
  if (source.kind === "timeattack") {
    const head = source.perfect
      ? `タイムアタックでノーミス${source.correct}字打ちました!`
      : `タイムアタックで${source.correct}字打ちました!`;
    return rank === null ? head : `${head}(今週${rank}位)`;
  }
  if (source.complete) {
    const head = `今日の耐久「${source.title}」を完走しました!(${source.correct}字`;
    return rank === null ? `${head})` : `${head}・今日${rank}位)`;
  }
  const head = `今日の耐久「${source.title}」で${source.correct}字打ちました!`;
  return rank === null ? head : `${head}(今日${rank}位)`;
}
