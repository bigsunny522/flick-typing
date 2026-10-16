import type { ResultsResponse } from "../ranking/types";
import { cardContent } from "./card-content";
import { drawCard } from "./card";
import { imageFileName, shareText, xIntentUrl, type ShareSource } from "./text";

/**
 * 結果画面の「X でシェア」と「画像で共有」をつなぐ。
 * `rank` は `POST /api/results` の返事(送っていなければ null に解決する)
 */
export function bindShare(
  host: HTMLElement,
  source: ShareSource,
  rank: Promise<ResultsResponse | null>,
): void {
  /** 今期の順位(届くまでは null) */
  let periodRank: number | null = null;
  /** 作り終えた画像 */
  let file: File | null = null;
  /** 呼んだ回数の番号。大きい方だけ画像を入れ替える */
  let refreshToken = 0;

  /** 文を入れ直し、順位とテーマに合った画像を先に作る */
  const refresh = (): void => {
    const link = host.querySelector<HTMLAnchorElement>("#share-x");
    if (!link) return;
    link.href = xIntentUrl(shareText(source, periodRank));
    refreshToken += 1;
    const current = refreshToken;
    const date = new Date();
    void drawCard(cardContent(source, periodRank, date)).then((blob) => {
      if (!blob || current !== refreshToken) return;
      file = new File([blob], imageFileName(date), { type: "image/png" });
      host.querySelector<HTMLButtonElement>("#share-image")?.removeAttribute("disabled");
    });
  };

  refresh();
  void rank.then((response) => {
    if (!host.querySelector("#share-x")) return;
    const period = response?.chances?.period.rank;
    if (typeof period !== "number") return;
    periodRank = period;
    refresh();
  });
  host.querySelector<HTMLButtonElement>(".theme-tap")?.addEventListener("click", refresh);
  host.querySelector<HTMLButtonElement>("#share-image")?.addEventListener("click", () => {
    const image = file;
    if (!image) return;
    if (navigator.canShare?.({ files: [image] })) {
      // 画像は先に作ってあるので、click の中で待たずに共有する
      navigator.share({ files: [image] }).catch((error: unknown) => {
        if (isAbortError(error)) return;
        downloadFile(image);
      });
      return;
    }
    downloadFile(image);
  });
}

/** 利用者が共有シートを閉じたとき */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** 共有シートが使えないときに画像を保存する */
function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
