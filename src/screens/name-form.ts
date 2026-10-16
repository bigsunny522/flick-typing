import { checkName } from "../ranking/name";
import { loadPlayerId, saveName } from "../storage";

const ERROR_MESSAGES: Record<"length" | "chars" | "ng", string> = {
  length: "1〜10文字にしてください",
  chars: "使えない文字が入っています",
  ng: "その名前は使えません",
};
const SEND_ERROR = "送れませんでした。時間をおいて試してください";

const SHELL =
  `<form class="name-form-box">` +
  `<p class="name-form-title"></p>` +
  `<input type="text" id="name-input" maxlength="20" autocomplete="off" autocapitalize="off"` +
  ` spellcheck="false" enterkeyhint="done">` +
  `<p class="name-form-hint">10文字まで。記号・絵文字は使えません。ランキングでだれでも見られます</p>` +
  `<p class="name-form-error" role="alert"></p>` +
  `<div class="name-form-actions">` +
  `<button type="submit" id="name-ok" class="primary-button">決める</button>` +
  `<button type="button" id="name-cancel" class="secondary-button">やめる</button>` +
  `</div>` +
  `</form>`;

/**
 * ニックネームの入力欄を `host` の上に重ねて出す。
 * この入力欄はゲームの入力経路ではない(ランキング画面からしか開かない)
 * `title` は見出しに出す文
 */
export function openNameForm(
  host: HTMLElement,
  current: string | null,
  onDone: (name: string) => void,
  title = "名前を変える",
): void {
  const overlay = document.createElement("div");
  overlay.className = "name-form";
  overlay.innerHTML = SHELL;
  host.append(overlay);
  const heading = overlay.querySelector<HTMLParagraphElement>(".name-form-title");
  const form = overlay.querySelector<HTMLFormElement>(".name-form-box");
  const input = overlay.querySelector<HTMLInputElement>("#name-input");
  const error = overlay.querySelector<HTMLParagraphElement>(".name-form-error");
  const cancel = overlay.querySelector<HTMLButtonElement>("#name-cancel");
  if (!heading || !form || !input || !error || !cancel) {
    overlay.remove();
    return;
  }
  heading.textContent = title;
  const close = (): void => overlay.remove();
  input.value = current ?? "";
  cancel.addEventListener("click", close);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void send(input, error);
  });
  input.focus();

  /** 端末でも確かめてから送る。だめなら理由を出して、閉じない */
  async function send(input: HTMLInputElement, error: HTMLParagraphElement): Promise<void> {
    const check = checkName(input.value);
    if (!check.ok) {
      error.textContent = ERROR_MESSAGES[check.error];
      return;
    }
    error.textContent = "";
    let name = check.name;
    try {
      const response = await fetch("/api/name", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: loadPlayerId(), name: input.value }),
      });
      if (response.status === 400) {
        const body = (await response.json()) as { error?: unknown };
        error.textContent = messageOf(body.error);
        return;
      }
      if (response.status !== 200) {
        error.textContent = SEND_ERROR;
        return;
      }
      const body = (await response.json()) as { name?: unknown };
      if (typeof body.name === "string") name = body.name;
    } catch {
      error.textContent = SEND_ERROR;
      return;
    }
    saveName(name);
    close();
    onDone(name);
  }
}

/** 400 の `error` に合わせた文。分からないときは送信の失敗と同じ文にする */
function messageOf(error: unknown): string {
  if (error === "length" || error === "chars" || error === "ng") return ERROR_MESSAGES[error];
  return SEND_ERROR;
}
