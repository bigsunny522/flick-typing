/** パーフェクトとみなす、正しく打てた文字数の下限 */
export const PERFECT_MIN_CORRECT = 100;

/** タイムアタックがミス 0 かつしきい値以上ならパーフェクト */
export function isPerfectRun(correct: number, miss: number): boolean {
  return miss === 0 && correct >= PERFECT_MIN_CORRECT;
}
