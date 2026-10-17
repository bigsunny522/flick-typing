import "./style.css";
import { collectEnv, checkEnv } from "./anticheat/env";
import { choosePrompts, PROMPTS } from "./game/prompts";
import { ENDURANCE_RULES_VERSION, RULES_VERSION } from "./game/rules";
import { createSession } from "./game/session";
import { PASSAGES, passageFor } from "./game/endurance";
import { isPerfectRun } from "./game/perfect";
import { debugEnabled } from "./debug/panel";
import { downloadLog } from "./debug/panel";
import { replay, replayEndurance, replayNative } from "./anticheat/log";
import { renderBlocked } from "./screens/blocked";
import { renderPlay } from "./screens/play";
import { renderResult } from "./screens/result";
import { renderTitle } from "./screens/title";
import { renderEndurance } from "./screens/endurance";
import { renderEnduranceResult } from "./screens/endurance-result";
import { renderRanking } from "./screens/ranking";
import type { RankingBoard } from "./ranking/types";
import {
  loadBest,
  loadEnduranceBest,
  loadPlayerId,
  loadTheme,
  saveBest,
  saveEnduranceBest,
  type PlayMode,
} from "./storage";
import { reportResult } from "./report";
import { jstDateKey, totalReading } from "./stats/summary";
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
  const dateKey = jstDateKey(Date.now());
  const passage = passageFor(dateKey, PASSAGES);
  renderTitle(
    root,
    loadBest,
    verdict,
    debug,
    startGame,
    {
      title: passage.title,
      author: passage.author,
      loadBest: (mode) => loadEnduranceBest(mode, dateKey)?.correct ?? null,
    },
    startEndurance,
    () => openRanking("timeattack-weekly"),
  );
}

/** ランキング画面を開く。戻るときは `onBack`(省略ならタイトル)。`askName` は移ってから名前を聞くか */
function openRanking(
  board: RankingBoard,
  askName = false,
  onBack: () => void = showTitle,
  backLabel = "戻る",
): void {
  renderRanking(root, board, onBack, askName, backLabel);
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
    onRetry: () => startGame(mode),
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
      const rank = reportResult(
        {
          kind: "timeattack",
          playerId: loadPlayerId(),
          mode,
          rulesVersion: RULES_VERSION,
          correct: final.correct,
          miss: final.miss,
          maxCombo: final.maxCombo,
          durationMs: final.endTimeMs,
        },
        debug,
      );
      const result = {
        correct: final.correct,
        miss: final.miss,
        maxCombo: final.maxCombo,
        endTimeMs: final.endTimeMs,
        bestUpdated,
        mode,
        perfect: isPerfectRun(final.correct, final.miss),
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
      /** 結果の画面。ランキングから戻ったときは `revisit` が true */
      const showResult = (revisit: boolean): void =>
        renderResult(
          root,
          result,
          () => startGame(mode),
          showTitle,
          rank,
          (board, askName) => openRanking(board, askName, () => showResult(true), "結果に戻る"),
          save,
          revisit,
        );
      showResult(false);
    },
  });
}

function startEndurance(mode: PlayMode): void {
  startEnduranceRound(mode, jstDateKey(Date.now()));
}

function startEnduranceRound(mode: PlayMode, dateKey: string): void {
  const verdict = checkEnv(collectEnv());
  if (verdict.kind !== "ok" && !debug) return renderBlocked(root, verdict.kind);
  const passage = passageFor(dateKey, PASSAGES);
  renderEndurance(root, passage, {
    mode,
    debug,
    onBlocked: () => renderBlocked(root, "automation"),
    onRetry: () => startEnduranceRound(mode, dateKey),
    onFinish: (final, payload) => {
      const previous = loadEnduranceBest(mode, dateKey);
      const bestUpdated = !debug && (!previous || final.correct > previous.correct);
      if (bestUpdated) {
        saveEnduranceBest(mode, {
          dateKey,
          passageId: passage.id,
          correct: final.correct,
          date: new Date().toISOString(),
        });
      }
      const rank = reportResult(
        {
          kind: "endurance",
          playerId: loadPlayerId(),
          mode,
          rulesVersion: ENDURANCE_RULES_VERSION,
          dateKey,
          passageId: passage.id,
          correct: final.correct,
          end: final.end ?? "complete",
          endMs: final.endMs ?? 0,
        },
        debug,
      );
      const total = totalReading(passage);
      const values = {
        correct: final.correct,
        end: final.end ?? "complete",
        miss: final.miss,
        title: passage.title,
        author: passage.author,
        cardUrl: passage.cardUrl,
        progress: Math.floor((final.correct / total) * 100),
        bestUpdated,
        mode,
      };
      const save = debug
        ? () => {
            const log = replayEndurance(dateKey, passage, payload);
            downloadLog({ ...log, env: collectEnv(), debug });
          }
        : undefined;
      /** 結果の画面。ランキングから戻ったときは `revisit` が true */
      const showEnduranceResult = (revisit: boolean): void =>
        renderEnduranceResult(
          root,
          values,
          () => startEnduranceRound(mode, dateKey),
          showTitle,
          rank,
          (board, askName) =>
            openRanking(board, askName, () => showEnduranceResult(true), "結果に戻る"),
          save,
          revisit,
        );
      showEnduranceResult(false);
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
