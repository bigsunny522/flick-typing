/** その週の範囲(日本時間の月曜 0:00 から翌月曜 0:00 まで) */
export type WeekRange = {
  weekKey: string; // その週の月曜日の日付(日本時間)。例 "2026-10-12"
  startUtc: string; // 月曜 0:00(日本時間)を UTC で表した "YYYY-MM-DD HH:MM:SS"
  endUtc: string; // 次の月曜 0:00(日本時間)を同じ形で
};

const JST_OFFSET_MS = 9 * 3600000;
const DAY_MS = 24 * 3600000;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** ms を UTC の暦として読んで "YYYY-MM-DD" にする */
function dateKeyOf(ms: number): string {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  return `${year}-${month}-${day}`;
}

/** ms を UTC で "YYYY-MM-DD HH:MM:SS" にする */
function dateTimeOf(ms: number): string {
  const date = new Date(ms);
  const hour = pad2(date.getUTCHours());
  const minute = pad2(date.getUTCMinutes());
  const second = pad2(date.getUTCSeconds());
  return `${dateKeyOf(ms)} ${hour}:${minute}:${second}`;
}

function partsOf(dateKey: string): { year: number; month: number; day: number } {
  const parts = dateKey.split("-").map(Number);
  return { year: parts[0], month: parts[1], day: parts[2] };
}

/** "2026-10-12" → "10/12"。先頭の 0 は付けない */
function shortLabel(dateKey: string): string {
  const { month, day } = partsOf(dateKey);
  return `${month}/${day}`;
}

/** その時刻のある週(月曜 0:00 から翌月曜 0:00)を求める。Date.now() は使わない */
export function jstWeekRange(nowMs: number): WeekRange {
  const jst = new Date(nowMs + JST_OFFSET_MS);
  const daysSinceMonday = (jst.getUTCDay() + 6) % 7;
  const mondayMs =
    Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - daysSinceMonday * DAY_MS;
  const startMs = mondayMs - JST_OFFSET_MS;
  const endMs = startMs + 7 * DAY_MS;
  return {
    weekKey: dateKeyOf(mondayMs),
    startUtc: dateTimeOf(startMs),
    endUtc: dateTimeOf(endMs),
  };
}

/** その週の表示("10/12〜10/18")。月曜から日曜まで */
export function weekRangeLabel(weekKey: string): string {
  const { year, month, day } = partsOf(weekKey);
  const sundayMs = Date.UTC(year, month - 1, day) + 6 * DAY_MS;
  return `${shortLabel(weekKey)}〜${shortLabel(dateKeyOf(sundayMs))}`;
}

/** 日の表示("2026-10-16" → "10/16") */
export function dayLabel(dateKey: string): string {
  return shortLabel(dateKey);
}
