import { analyze } from "../anticheat/behavior";
import { analyzeNative, type NativeEditLog, type NativeKeyLog } from "../anticheat/native";
import { inputForStroke, type KeyStroke } from "../keyboard/layout";
import { mountKeyboard } from "../keyboard/view";
import {
  createEndurance,
  reduceEndurance,
  type EnduranceState,
  type Passage,
} from "../game/endurance";
import { ENDURANCE_RULES } from "../game/rules";
import { breakIndexes } from "../game/prompts";
import { inputForEdit } from "../game/native-edit";
import type { PlayMode } from "../storage";
import { mountNativeField, type NativeField } from "../native/field";
import { createReadingTicker } from "./reading-ticker";

export type EndurancePayload =
  { mode: "flick"; strokes: KeyStroke[] } | { mode: "native"; edits: NativeEditLog[] };

export type EnduranceOptions = {
  mode: PlayMode;
  debug: boolean;
  onFinish: (state: EnduranceState, payload: EndurancePayload) => void;
  onBlocked: () => void;
  onRetry: () => void;
};

const COMPACT_VIEWPORT_HEIGHT = 400;
const URGENT_REMAINING_SEC = 3;
const MISS_HOLD_MS = 1200;
const TIMEOUT_HOLD_MS = 600;

export function renderEndurance(
  host: HTMLElement,
  passage: Passage,
  options: EnduranceOptions,
): void {
  const isNative = options.mode === "native";
  host.innerHTML =
    `<main class="screen play endurance${isNative ? " is-native" : ""} is-counting">` +
    `<div class="deco" aria-hidden="true"></div><div id="countdown">3</div>` +
    '<div class="play-header"><div id="stats"></div>' +
    '<button type="button" class="retry-button" aria-label="最初からやり直す">↻</button></div>' +
    '<div class="time-bar"><i></i></div>' +
    '<div class="prompt-area"><div id="prompt"></div></div>' +
    '<div class="play-bottom"><div id="next"></div>' +
    (isNative ? "" : '<div id="keyboard"></div><div class="flick-only">FLICK ONLY</div>') +
    "</div>" +
    (isNative
      ? '<div class="reopen-overlay" id="reopen"><button type="button" class="primary-button reopen-button">タップしてキーボードを出す</button></div>'
      : "") +
    '<div class="retry-confirm" id="retry-confirm"><div class="retry-confirm-box">' +
    "<p>最初からやり直しますか?</p>" +
    '<button type="button" class="primary-button retry-yes">やり直す</button>' +
    '<button type="button" class="secondary-button retry-no">続ける</button>' +
    "</div></div>" +
    "</main>";
  const playView = host.querySelector<HTMLElement>(".play")!;
  const countdown = host.querySelector<HTMLElement>("#countdown")!;
  const stats = host.querySelector<HTMLElement>("#stats")!;
  const promptView = host.querySelector<HTMLElement>("#prompt")!;
  const nextView = host.querySelector<HTMLElement>("#next")!;
  const timeBar = host.querySelector<HTMLElement>(".time-bar i")!;
  const keyboard = host.querySelector<HTMLElement>("#keyboard");
  const reopenOverlay = host.querySelector<HTMLElement>("#reopen");
  const promptArea = host.querySelector<HTMLElement>(".prompt-area")!;
  const readingTickerHost = document.createElement("div");
  readingTickerHost.className = "reading-ticker-host";
  promptArea.append(readingTickerHost);
  const readingTicker = createReadingTicker(readingTickerHost);
  const totalReading = passage.prompts.reduce((sum, item) => sum + [...item.reading].length, 0);
  const remainingValue = document.createElement("span");
  const remainingUnit = document.createElement("small");
  remainingUnit.textContent = "秒";
  const remainingView = document.createElement("strong");
  remainingView.className = "remaining";
  remainingView.append(remainingValue, remainingUnit);
  const correctValue = document.createElement("b");
  const correctLabel = document.createElement("span");
  correctLabel.append(correctValue, " 字");
  stats.append(remainingView, correctLabel);
  const metaTitle = document.createElement("span");
  metaTitle.className = "endurance-title";
  metaTitle.textContent = passage.title;
  const metaProgress = document.createElement("span");
  metaProgress.className = "endurance-progress";
  const meta = document.createElement("div");
  meta.className = "prompt-meta";
  meta.append(metaTitle, metaProgress);
  const nextLabel = document.createElement("span");
  nextLabel.textContent = "NEXT";
  const nextText = document.createElement("b");
  let state = createEndurance(passage.prompts);
  let startedAt = 0;
  let strokes: KeyStroke[] = [];
  let edits: NativeEditLog[] = [];
  let keys: NativeKeyLog[] = [];
  let field: NativeField | null = null;
  let lastViewport = { height: 0, top: 0, ratio: 0 };
  let active = false;
  let transitioned = false;
  let ending = false;
  let seenRemaining: string | null = null;
  let seenUrgent: boolean | null = null;
  let seenCorrect: number | null = null;
  let seenTimeWidth: string | null = null;
  let seenProgress: string | null = null;
  let seenPromptIndex: number | null = null;
  const withBreaks = (text: string, breaks: number[]) => {
    const breakSet = new Set(breaks);
    return [...text].map((char, index) => `${breakSet.has(index) ? "\u200b" : ""}${char}`).join("");
  };
  const stop = (callback: () => void) => {
    if (transitioned) return;
    transitioned = true;
    readingTicker.destroy();
    active = false;
    field?.destroy();
    callback();
  };
  const paint = () => {
    const prompt = state.prompts[state.promptIndex];
    const elapsedMs = startedAt === 0 ? 0 : performance.now() - startedAt;
    const remainingMs = Math.max(0, state.deadlineMs - elapsedMs);
    const remaining = (remainingMs / 1000).toFixed(1);
    const urgent = Number(remaining) <= URGENT_REMAINING_SEC;
    if (remaining !== seenRemaining) {
      seenRemaining = remaining;
      remainingValue.textContent = remaining;
    }
    if (urgent !== seenUrgent) {
      seenUrgent = urgent;
      remainingView.classList.toggle("urgent", urgent);
      timeBar.parentElement?.classList.toggle("urgent", urgent);
    }
    if (state.correct !== seenCorrect) {
      seenCorrect = state.correct;
      correctValue.textContent = String(state.correct);
    }
    const timeWidth = `${Math.min(1, remainingMs / ENDURANCE_RULES.maxMs) * 100}%`;
    if (timeWidth !== seenTimeWidth) {
      seenTimeWidth = timeWidth;
      timeBar.style.width = timeWidth;
    }
    const progress = `${Math.floor((state.correct / totalReading) * 100)}%`;
    if (progress !== seenProgress) {
      seenProgress = progress;
      metaProgress.textContent = progress;
    }
    if (state.promptIndex !== seenPromptIndex) {
      seenPromptIndex = state.promptIndex;
      const next = state.prompts[state.promptIndex + 1];
      if (next) {
        nextText.textContent = next.text;
        nextView.replaceChildren(nextLabel, nextText);
      } else {
        nextView.replaceChildren();
      }
      const chunks = prompt.chunks ?? [[prompt.text, prompt.reading] as [string, string]];
      const kanjiBreaks = breakIndexes(chunks.map((chunk) => chunk[0]));
      const kanjiView = document.createElement("p");
      kanjiView.className = "kanji";
      kanjiView.textContent = withBreaks(prompt.text, kanjiBreaks);
      promptView.replaceChildren(meta, kanjiView, readingTickerHost);
      readingTicker.setReading(prompt.reading);
    }
    const missVisible = state.finished && state.end === "miss";
    readingTicker.update(state.index, state.pending, missVisible);
  };
  const finishIfNeeded = () => {
    if (!state.finished || ending) return;
    ending = true;
    active = false;
    paint();
    if (state.end === "complete") {
      stop(() =>
        options.onFinish(state, isNative ? { mode: "native", edits } : { mode: "flick", strokes }),
      );
      return;
    }
    const holdMs = state.end === "miss" ? MISS_HOLD_MS : TIMEOUT_HOLD_MS;
    setTimeout(() => {
      stop(() =>
        options.onFinish(state, isNative ? { mode: "native", edits } : { mode: "flick", strokes }),
      );
    }, holdMs);
  };
  if (keyboard) {
    mountKeyboard(keyboard, (stroke) => {
      if (!active) return false;
      const input = inputForStroke(stroke);
      if (!input) return false;
      const relative = stroke.up.t - startedAt;
      strokes = [
        ...strokes,
        {
          ...stroke,
          down: { ...stroke.down, t: stroke.down.t - startedAt },
          up: { ...stroke.up, t: relative },
        },
      ];
      state = reduceEndurance(state, { type: "stroke", t: relative, input });
      const verdict = analyze(strokes);
      if (verdict.bot && !options.debug) {
        stop(options.onBlocked);
        return false;
      }
      paint();
      finishIfNeeded();
      return true;
    });
  }
  const onEdit = (edit: {
    inputType: string;
    before: string;
    after: string;
    timeStamp: number;
    trusted: boolean;
  }) => {
    if (!active) return;
    const input = inputForEdit(edit);
    if (!input) return;
    const t = edit.timeStamp - startedAt;
    edits = [
      ...edits,
      {
        t,
        inputType: edit.inputType,
        before: edit.before,
        after: edit.after,
        trusted: edit.trusted,
        viewportRatio: lastViewport.ratio,
      },
    ];
    const previousPromptIndex = state.promptIndex;
    state = reduceEndurance(state, { type: "stroke", t, input });
    const verdict = analyzeNative(edits, keys);
    if (verdict.bot && !options.debug) {
      stop(options.onBlocked);
      return;
    }
    if (state.promptIndex !== previousPromptIndex || input.kind === "reject") field?.clear();
    paint();
    finishIfNeeded();
  };
  const onKey = (key: { code: string; timeStamp: number; trusted: boolean }) => {
    if (!active) return;
    keys = [...keys, { t: key.timeStamp - startedAt, code: key.code, trusted: key.trusted }];
  };
  const onKeyboardChange = (shown: boolean) => {
    reopenOverlay?.classList.toggle("is-open", !shown);
  };
  const onViewport = (view: { height: number; top: number; ratio: number }) => {
    lastViewport = view;
    playView.style.setProperty("--vv-height", `${view.height}px`);
    playView.style.setProperty("--vv-top", `${view.top}px`);
    playView.classList.toggle("is-compact", view.height < COMPACT_VIEWPORT_HEIGHT);
  };
  if (isNative) {
    playView.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".reopen-button")) return;
      event.preventDefault();
    });
    host
      .querySelector<HTMLButtonElement>(".reopen-button")
      ?.addEventListener("click", () => field?.reopen());
    field = mountNativeField(playView, { onEdit, onKey, onKeyboardChange, onViewport });
    field.focus();
  }
  const retryConfirm = host.querySelector<HTMLElement>("#retry-confirm");
  const retryButton = host.querySelector<HTMLButtonElement>(".retry-button");
  const retryYes = retryConfirm?.querySelector<HTMLButtonElement>(".retry-yes");
  const retryNo = retryConfirm?.querySelector<HTMLButtonElement>(".retry-no");
  const canRetry = () => !transitioned && !state.finished;
  retryButton?.addEventListener("click", () => {
    if (!canRetry()) return;
    retryConfirm?.classList.add("is-open");
  });
  retryNo?.addEventListener("click", () => {
    retryConfirm?.classList.remove("is-open");
  });
  retryYes?.addEventListener("click", () => {
    if (!canRetry()) return;
    stop(options.onRetry);
  });
  const start = () => {
    if (transitioned) return;
    field?.clear();
    active = true;
    startedAt = performance.now();
    playView.classList.remove("is-counting");
    countdown.remove();
    const tick = () => {
      if (!active) return;
      state = reduceEndurance(state, { type: "tick", t: performance.now() - startedAt });
      paint();
      if (state.finished) {
        finishIfNeeded();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  setTimeout(() => {
    countdown.textContent = "2";
  }, 1000);
  setTimeout(() => {
    countdown.textContent = "1";
  }, 2000);
  setTimeout(start, 3000);
  void document.fonts?.ready.then(() => readingTicker.relayout());
  paint();
}
