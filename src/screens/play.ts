import { analyze, type BehaviorVerdict } from "../anticheat/behavior";
import { analyzeNative, type NativeEditLog, type NativeKeyLog } from "../anticheat/native";
import { inputForStroke, type KeyStroke } from "../keyboard/layout";
import { mountKeyboard } from "../keyboard/view";
import { reduce, type SessionState } from "../game/session";
import { breakIndexes } from "../game/prompts";
import { inputForEdit } from "../game/native-edit";
import type { JudgeResult } from "../game/judge";
import type { PlayMode } from "../storage";
import { renderDebugPanel, renderNativeDebugPanel } from "../debug/panel";
import { mountNativeField, type NativeField } from "../native/field";
import { createReadingTicker } from "./reading-ticker";

export type PlayOptions = {
  mode: PlayMode;
  debug: boolean;
  onFinish: (
    state: SessionState,
    payload: { mode: "flick"; strokes: KeyStroke[] } | { mode: "native"; edits: NativeEditLog[] },
  ) => void;
  onBlocked: () => void;
  onRetry: () => void;
};

const PAINT_PROBE_LIMIT = 20;
const COMPACT_VIEWPORT_HEIGHT = 400;

export function renderPlay(host: HTMLElement, initial: SessionState, options: PlayOptions): void {
  const isNative = options.mode === "native";
  host.innerHTML =
    `<main class="screen play${isNative ? " is-native" : ""} is-counting">` +
    `<div class="deco" aria-hidden="true"></div><div id="countdown">3</div>` +
    '<div class="play-header"><div id="stats"></div>' +
    '<button type="button" class="retry-button" aria-label="最初からやり直す">↻</button></div>' +
    '<div class="time-bar"><i></i></div>' +
    '<div class="prompt-area"><div id="perfect"></div><div id="prompt"></div></div>' +
    '<div class="play-bottom"><div id="next"></div><div id="combo-gauge"></div>' +
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
    `<div id="debug"></div></main>`;
  const playView = host.querySelector<HTMLElement>(".play")!;
  const countdown = host.querySelector<HTMLElement>("#countdown")!;
  const stats = host.querySelector<HTMLElement>("#stats")!;
  const gauge = host.querySelector<HTMLElement>("#combo-gauge")!;
  const perfect = host.querySelector<HTMLElement>("#perfect")!;
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
  const debugPanel = host.querySelector<HTMLElement>("#debug")!;
  const remainingValue = document.createElement("span");
  const remainingUnit = document.createElement("small");
  remainingUnit.textContent = "秒";
  const remainingView = document.createElement("strong");
  remainingView.className = "remaining";
  remainingView.append(remainingValue, remainingUnit);
  const bonus = document.createElement("span");
  bonus.id = "bonus";
  const correctValue = document.createElement("b");
  const correctLabel = document.createElement("span");
  correctLabel.append("正解 ", correctValue);
  stats.append(remainingView, bonus, correctLabel);
  const comboValue = document.createElement("b");
  const comboHint = document.createElement("span");
  const comboRow = document.createElement("div");
  comboRow.className = "combo-row";
  const comboRibbon = document.createElement("span");
  comboRibbon.className = "outline-ribbon";
  comboRibbon.textContent = "COMBO";
  comboRow.append(comboRibbon, comboValue, comboHint);
  const gaugeFill = document.createElement("i");
  const gaugeTrack = document.createElement("div");
  gaugeTrack.className = "gauge";
  gaugeTrack.append(gaugeFill);
  gauge.append(comboRow, gaugeTrack);
  const nextLabel = document.createElement("span");
  nextLabel.textContent = "NEXT";
  const nextText = document.createElement("b");
  const perfectRibbon = document.createElement("span");
  perfectRibbon.className = "ribbon";
  perfectRibbon.textContent = "PERFECT";
  let state = initial;
  let startedAt = 0;
  let strokes: KeyStroke[] = [];
  let edits: NativeEditLog[] = [];
  let editResults: (JudgeResult | null)[] = [];
  let keys: NativeKeyLog[] = [];
  let field: NativeField | null = null;
  let lastViewport = { height: 0, top: 0, ratio: 0 };
  let active = false;
  let transitioned = false;
  let bonusUntil = 0;
  let seenBonuses = 0;
  let missUntil = 0;
  let seenMisses = 0;
  let seenRemaining: string | null = null;
  let seenUrgent: boolean | null = null;
  let seenCorrect: number | null = null;
  let seenTimeWidth: string | null = null;
  let seenCombo: number | null = null;
  let seenBonusText: string | null = null;
  let seenPerfect: boolean | null = null;
  let seenPromptIndex: number | null = null;
  const paintLatencies: number[] = [];
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
    const remaining = (
      Math.max(0, state.endTimeMs - (performance.now() - startedAt)) / 1000
    ).toFixed(1);
    const urgent = Number(remaining) <= 10;
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
    const timeWidth = `${Math.min(1, Number(remaining) / 60) * 100}%`;
    if (timeWidth !== seenTimeWidth) {
      seenTimeWidth = timeWidth;
      timeBar.style.width = timeWidth;
    }
    if (state.combo !== seenCombo) {
      seenCombo = state.combo;
      comboValue.textContent = String(state.combo);
      comboHint.textContent = `あと ${20 - (state.combo % 20)}字で +1秒`;
      gaugeFill.style.width = `${(state.combo % 20) * 5}%`;
    }
    if (state.bonuses.length > seenBonuses) {
      seenBonuses = state.bonuses.length;
      bonusUntil = performance.now() + 800;
    }
    if (state.miss > seenMisses) {
      seenMisses = state.miss;
      missUntil = performance.now() + 200;
    }
    const bonusText = performance.now() < bonusUntil ? "+1秒" : "";
    if (bonusText !== seenBonusText) {
      seenBonusText = bonusText;
      bonus.textContent = bonusText;
    }
    if (state.lastPerfect !== seenPerfect) {
      seenPerfect = state.lastPerfect;
      if (state.lastPerfect) perfect.replaceChildren(perfectRibbon);
      else perfect.replaceChildren();
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
      promptView.innerHTML = `<div class="prompt-meta"><span>No. ${String(state.promptIndex + 1).padStart(2, "0")}</span></div><p class="kanji">${withBreaks(prompt.text, kanjiBreaks)}</p>`;
      promptView.append(readingTickerHost);
      readingTicker.setReading(prompt.reading);
    }
    readingTicker.update(state.index, state.pending, performance.now() < missUntil);
  };
  const finishIfNeeded = () => {
    if (!state.finished) return;
    stop(() =>
      options.onFinish(state, isNative ? { mode: "native", edits } : { mode: "flick", strokes }),
    );
  };
  const probePaint = (upTimeStamp: number, verdict: BehaviorVerdict, log: KeyStroke[]) => {
    requestAnimationFrame(() => {
      paintLatencies.push(performance.now() - upTimeStamp);
      if (paintLatencies.length > PAINT_PROBE_LIMIT) paintLatencies.shift();
      renderDebugPanel(debugPanel, verdict, log, paintLatencies);
    });
  };
  if (keyboard) {
    mountKeyboard(keyboard, (stroke, upTimeStamp) => {
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
      state = reduce(state, { type: "stroke", t: relative, input });
      const verdict = analyze(strokes);
      if (verdict.bot && !options.debug) {
        stop(options.onBlocked);
        return false;
      }
      paint();
      if (options.debug) probePaint(upTimeStamp, verdict, strokes);
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
    state = reduce(state, { type: "stroke", t, input });
    editResults = [...editResults, state.lastResult];
    const verdict = analyzeNative(edits, keys);
    if (verdict.bot && !options.debug) {
      stop(options.onBlocked);
      return;
    }
    if (state.promptIndex !== previousPromptIndex || input.kind === "reject") field?.clear();
    paint();
    if (options.debug) {
      const paired = edits.map((edit, index) => ({ ...edit, result: editResults[index] ?? null }));
      renderNativeDebugPanel(debugPanel, verdict, paired, lastViewport);
    }
    finishIfNeeded();
  };
  const onKey = (key: { code: string; timeStamp: number; trusted: boolean }) => {
    if (!active) return;
    keys = [
      ...keys,
      {
        t: key.timeStamp - startedAt,
        code: key.code,
        trusted: key.trusted,
        viewportRatio: lastViewport.ratio,
      },
    ];
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
      state = reduce(state, { type: "tick", t: performance.now() - startedAt });
      paint();
      if (state.finished) return finishIfNeeded();
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
