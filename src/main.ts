import "./style.css";
import { collectEnv, checkEnv } from "./anticheat/env";
import { choosePrompts, PROMPTS } from "./game/prompts";
import { createSession } from "./game/session";
import { debugEnabled } from "./debug/panel";
import { downloadLog } from "./debug/panel";
import { replay, replayNative } from "./anticheat/log";
import { renderBlocked } from "./screens/blocked";
import { renderPlay } from "./screens/play";
import { renderResult } from "./screens/result";
import { renderTitle } from "./screens/title";
import { loadBest, loadMode, loadTheme, saveBest, type PlayMode } from "./storage";
import { applyTheme, parseTheme } from "./theme";

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
  renderTitle(root, loadMode(), loadBest, verdict, debug, startGame);
}

function startGame(mode: PlayMode): void {
  const verdict = checkEnv(collectEnv());
  if (verdict.kind !== "ok" && !debug) return renderBlocked(root, verdict.kind);
  const seed = createSeed();
  const session = createSession(seed, choosePrompts(seed, PROMPTS, 200));
  renderPlay(root, session, {
    mode,
    debug,
    onBlocked: () => renderBlocked(root, "automation"),
    onFinish: (final, payload) => {
      const total = final.correct + final.miss;
      const accuracy = total === 0 ? 0 : final.correct / total;
      const cps = final.correct / (final.endTimeMs / 1000);
      const previous = loadBest(mode);
      const bestUpdated = !debug && (!previous || final.correct > previous.correct);
      if (bestUpdated)
        saveBest(mode, {
          correct: final.correct,
          accuracy,
          cps,
          date: new Date().toISOString(),
        });
      const result = {
        correct: final.correct,
        miss: final.miss,
        maxCombo: final.maxCombo,
        endTimeMs: final.endTimeMs,
        bestUpdated,
        mode,
      };
      const save = debug
        ? () =>
            downloadLog({
              ...(payload.mode === "flick"
                ? replay(seed, final.prompts, payload.strokes)
                : replayNative(seed, final.prompts, payload.edits)),
              seed,
              env: collectEnv(),
              debug,
            })
        : undefined;
      renderResult(root, result, () => startGame(mode), showTitle, save);
    },
  });
}

applyTheme(parseTheme(loadTheme()));

if (probe) {
  void import("./probe/probe").then(({ renderProbe }) => renderProbe(root));
} else {
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("gesturestart", (event) => event.preventDefault());
  showTitle();
}
