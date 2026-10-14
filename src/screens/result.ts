import type { PlayMode } from "../storage";

export type ResultValues = {
  correct: number;
  miss: number;
  maxCombo: number;
  endTimeMs: number;
  bestUpdated: boolean;
  mode: PlayMode;
};

export function renderResult(
  host: HTMLElement,
  values: ResultValues,
  onAgain: () => void,
  onTitle: () => void,
  onSave?: () => void,
): void {
  const total = values.correct + values.miss;
  const accuracy = total === 0 ? 0 : values.correct / total;
  const cps = values.correct / (values.endTimeMs / 1000);
  const saveButton = onSave ? '<button id="save" class="secondary-button">ログを保存</button>' : "";
  host.innerHTML =
    `<main class="screen result-screen"><div class="deco" aria-hidden="true"></div><p class="ribbon">RESULT</p>` +
    `<p class="result-mode">${modeLabel(values.mode)}</p>` +
    `<p class="result-label">正しく打てた文字数</p><div class="score">${values.correct}<small>字</small></div>` +
    `${values.bestUpdated ? '<p class="ribbon accent-ribbon">自己ベスト更新</p>' : ""}<div class="result-grid">` +
    `<p>ミス<strong>${values.miss}</strong></p><p>正確率<strong>${(accuracy * 100).toFixed(1)}<small>%</small></strong></p>` +
    `<p>1秒あたり<strong>${cps.toFixed(2)}<small>字</small></strong></p><p>最大コンボ<strong>${values.maxCombo}</strong></p></div>` +
    `<p class="duration">プレイ時間 ${(values.endTimeMs / 1000).toFixed(1)}秒(ボーナス +${((values.endTimeMs - 60000) / 1000).toFixed(1)}秒)</p>` +
    `<div class="result-actions"><button id="again" class="primary-button">もう一度</button>${saveButton}<button id="title" class="secondary-button">タイトルへ</button></div></main>`;
  host.querySelector<HTMLButtonElement>("#save")?.addEventListener("click", onSave ?? (() => {}));
  host.querySelector<HTMLButtonElement>("#again")?.addEventListener("click", onAgain);
  host.querySelector<HTMLButtonElement>("#title")?.addEventListener("click", onTitle);
}

function modeLabel(mode: PlayMode): string {
  return mode === "native" ? "スマホのキーボード" : "フリックキーボード";
}
