import { analyze, type BehaviorVerdict } from "../anticheat/behavior";
import { inputForStroke, type KeyStroke } from "../keyboard/layout";
import { mountKeyboard } from "../keyboard/view";
import { reduce, type SessionState } from "../game/session";
import { breakIndexes } from "../game/prompts";
import { renderDebugPanel } from "../debug/panel";
import { createReadingTicker } from "./reading-ticker";

export type PlayOptions = {
  debug: boolean;
  onFinish: (state: SessionState, strokes: KeyStroke[]) => void;
  onBlocked: () => void;
};

const PAINT_PROBE_LIMIT = 20;

export function renderPlay(host: HTMLElement, initial: SessionState, options: PlayOptions): void {
  host.innerHTML =
    `<main class="screen play is-counting"><div class="deco" aria-hidden="true"></div><div id="countdown">3</div>` +
    '<div class="play-header"><div id="stats"></div></div><div class="time-bar"><i></i></div>' +
    '<div class="prompt-area"><div id="perfect"></div><div id="prompt"></div></div>' +
    '<div class="play-bottom"><div id="next"></div><div id="combo-gauge"></div><div id="keyboard"></div><div class="flick-only">FLICK ONLY</div></div><div id="debug"></div></main>';
  const countdown = host.querySelector<HTMLElement>("#countdown")!;
  const stats = host.querySelector<HTMLElement>("#stats")!;
  const gauge = host.querySelector<HTMLElement>("#combo-gauge")!;
  const perfect = host.querySelector<HTMLElement>("#perfect")!;
  const promptView = host.querySelector<HTMLElement>("#prompt")!;
  const nextView = host.querySelector<HTMLElement>("#next")!;
  const timeBar = host.querySelector<HTMLElement>(".time-bar i")!;
  const keyboard = host.querySelector<HTMLElement>("#keyboard")!;
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
    if (state.finished) stop(() => options.onFinish(state, strokes));
  };
  const probePaint = (upTimeStamp: number, verdict: BehaviorVerdict, log: KeyStroke[]) => {
    requestAnimationFrame(() => {
      paintLatencies.push(performance.now() - upTimeStamp);
      if (paintLatencies.length > PAINT_PROBE_LIMIT) paintLatencies.shift();
      renderDebugPanel(debugPanel, verdict, log, paintLatencies);
    });
  };
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
  const start = () => {
    active = true;
    startedAt = performance.now();
    host.querySelector(".play")?.classList.remove("is-counting");
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
