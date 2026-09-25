export function renderBlocked(
  host: HTMLElement,
  reason: "notPhone" | "automation",
  debug = false,
  reasons: string[] = [],
): void {
  const message = reason === "notPhone" ? "スマホで開いてください" : "正しく操作できませんでした";
  host.innerHTML = `<main class="screen blocked"><h1>${message}</h1>${debug ? `<pre class="debug">${reasons.join(", ")}</pre>` : ""}</main>`;
}
