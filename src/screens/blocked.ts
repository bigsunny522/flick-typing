import { landingHtml } from "../landing";

export function renderBlocked(
  host: HTMLElement,
  reason: "notPhone" | "automation",
  debug = false,
  reasons: string[] = [],
): void {
  const debugHtml = debug ? `<pre class="debug">${reasons.join(", ")}</pre>` : "";
  if (reason === "notPhone") {
    const notice = `<p class="landing-notice">スマホで開いてください</p>`;
    host.innerHTML = landingHtml().replace(notice, `${notice}${debugHtml}`);
    return;
  }
  host.innerHTML = `<main class="screen blocked"><p class="ribbon">FLICK TYPING</p><h1>正しく操作できませんでした</h1>${debugHtml}</main>`;
}
