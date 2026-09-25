export type ResultValues = {
  correct: number;
  miss: number;
  maxCombo: number;
  endTimeMs: number;
  bestUpdated: boolean;
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
  const saveButton = onSave ? '<button id="save">ログを保存</button>' : "";
  host.innerHTML =
    `<main class="screen"><h1>${values.correct}</h1>` +
    `<p>正しく打てた文字数</p><p>ミス: ${values.miss}</p>` +
    `<p>正確率: ${(accuracy * 100).toFixed(1)}%</p>` +
    `<p>1秒あたり: ${cps.toFixed(2)}文字</p><p>最大コンボ: ${values.maxCombo}</p>` +
    `${values.bestUpdated ? "<p>自己ベスト更新！</p>" : ""}${saveButton}` +
    '<button id="again">もう一度</button><button id="title">タイトルへ</button></main>';
  host.querySelector<HTMLButtonElement>("#save")?.addEventListener("click", onSave ?? (() => {}));
  host.querySelector<HTMLButtonElement>("#again")?.addEventListener("click", onAgain);
  host.querySelector<HTMLButtonElement>("#title")?.addEventListener("click", onTitle);
}
