import "./style.css";
import { collectEnv, checkEnv } from "./anticheat/env";
import { choosePrompts, PROMPTS } from "./game/prompts";
import { createSession } from "./game/session";
import { debugEnabled } from "./debug/panel";
import { downloadLog } from "./debug/panel";
import { replay } from "./anticheat/log";
import { renderBlocked } from "./screens/blocked";
import { renderPlay } from "./screens/play";
import { renderResult } from "./screens/result";
import { renderTitle } from "./screens/title";
import { loadBest, saveBest } from "./storage";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("#app がありません。");
const root: HTMLElement = app;
const probe = import.meta.env.DEV && new URLSearchParams(location.search).has("probe");
const debug = debugEnabled();

function createSeed(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0];
}

function showTitle(): void {
  const verdict = checkEnv(collectEnv());
  if (verdict.kind !== "ok" && !debug) return renderBlocked(root, verdict.kind);
  renderTitle(root, loadBest(), verdict, debug, startGame);
}

function startGame(): void {
  const verdict = checkEnv(collectEnv());
  if (verdict.kind !== "ok" && !debug) return renderBlocked(root, verdict.kind);
  const seed = createSeed();
  const session = createSession(seed, choosePrompts(seed, PROMPTS, 200));
  renderPlay(root, session, {
    debug,
    onBlocked: () => renderBlocked(root, "automation"),
    onFinish: (final, strokes) => {
      const total = final.correct + final.miss;
      const accuracy = total === 0 ? 0 : final.correct / total;
      const cps = final.correct / (final.endTimeMs / 1000);
      const previous = loadBest();
      const bestUpdated = !debug && (!previous || final.correct > previous.correct);
      if (bestUpdated)
        saveBest({ correct: final.correct, accuracy, cps, date: new Date().toISOString() });
      const result = {
        correct: final.correct,
        miss: final.miss,
        maxCombo: final.maxCombo,
        endTimeMs: final.endTimeMs,
        bestUpdated,
      };
      const save = debug
        ? () =>
            downloadLog({ ...replay(seed, final.prompts, strokes), seed, env: collectEnv(), debug })
        : undefined;
      renderResult(root, result, startGame, showTitle, save);
    },
  });
}

if (probe) {
  void import("./probe/probe").then(({ renderProbe }) => renderProbe(root));
} else {
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("gesturestart", (event) => event.preventDefault());
  showTitle();
}
