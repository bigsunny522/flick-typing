import { isAdAllowed } from "./allow";

/** 広告のキー(オーナーから受け取ったコードのまま) */
const AD_KEY = "4e0928acfd10444c6d71a0612761f108";

/** 広告を読むスクリプトの URL。キーから組み立てる */
const AD_SCRIPT_URL = `https://layinghypothesis.com/${AD_KEY}/invoke.js`;

/** iframe の中に入れる広告の HTML。余白を消して枠いっぱいに表示する */
const AD_SRCDOC =
  `<!doctype html>` +
  `<html>` +
  `<head>` +
  `<meta charset="utf-8" />` +
  `<style>` +
  `html,body{` +
  `margin:0;` +
  `padding:0;` +
  `overflow:hidden;` +
  `background:transparent;` +
  `}` +
  `</style>` +
  `</head>` +
  `<body>` +
  `<script>` +
  `atOptions = {` +
  `key: "${AD_KEY}",` +
  `format: "iframe",` +
  `height: 50,` +
  `width: 320,` +
  `params: {},` +
  `};` +
  `</script>` +
  `<script src="${AD_SCRIPT_URL}"></script>` +
  `</body>` +
  `</html>`;

/** 結果の画面の `.ad-slot` に広告を置く。出してはいけない場所なら `.ad-slot` ごと消す */
export function mountAd(host: HTMLElement): void {
  const slot = host.querySelector(".ad-slot");
  if (!slot) return;
  if (!isAdAllowed(location.hostname)) {
    slot.remove();
    return;
  }
  const frame = document.createElement("iframe");
  frame.title = "広告";
  frame.width = "320";
  frame.height = "50";
  // Adsterra のスクリプトは document.cookie を読むため allow-same-origin が要る。
  // ページを移す許可は付けず、広告から画面を切り替えられないようにする。
  frame.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox",
  );
  frame.srcdoc = AD_SRCDOC;
  slot.appendChild(frame);
}
