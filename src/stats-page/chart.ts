/** 区間の数 binCount から、目盛りを出す境目の番号(0〜binCount)を小さい順に返す */
export function axisTicks(binCount: number): number[] {
  if (binCount <= 0) return [];
  const step = Math.ceil(binCount / 5);
  const ticks: number[] = [];
  for (let value = 0; value <= binCount; value += step) {
    ticks.push(value);
  }
  const last = ticks[ticks.length - 1];
  if (last === binCount) return ticks;
  if (binCount - last < step / 2) {
    ticks[ticks.length - 1] = binCount;
  } else {
    ticks.push(binCount);
  }
  return ticks;
}
