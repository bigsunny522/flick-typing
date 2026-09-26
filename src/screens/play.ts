import { analyze } from "../anticheat/behavior";
import { inputForStroke, type KeyStroke } from "../keyboard/layout";
import { mountKeyboard } from "../keyboard/view";
import { reduce, type SessionState } from "../game/session";
import { breakIndexes } from "../game/prompts";
import { renderDebugPanel } from "../debug/panel";

export type PlayOptions = {
  debug: boolean;
  onFinish: (state: SessionState, strokes: KeyStroke[]) => void;
  onBlocked: () => void;
};

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
  const debugPanel = host.querySelector<HTMLElement>("#debug")!;
  let state = initial;
  let startedAt = 0;
  let strokes: KeyStroke[] = [];
  let active = false;
  let transitioned = false;
  let bonusUntil = 0;
  let seenBonuses = 0;
  let missUntil = 0;
  let seenMisses = 0;
  let measuredPromptIndex = -1;
  const withBreaks = (
    text: string,
    breaks: number[],
    render: (char: string) => string,
    offset = 0,
  ) => {
    const breakSet = new Set(breaks);
    return [...text]
      .map((char, index) => `${breakSet.has(index + offset) ? "\u200b" : ""}${render(char)}`)
      .join("");
  };
  const adjustPromptSize = () => {
    promptArea.style.setProperty("--reading-size", "38px");
    promptArea.style.setProperty("--kanji-size", "23px");
    while (promptArea.scrollHeight > promptArea.clientHeight) {
      const readingSize = Number.parseFloat(
        getComputedStyle(promptArea).getPropertyValue("--reading-size"),
      );
      if (readingSize <= 24) break;
      const nextReadingSize = readingSize - 2;
      promptArea.style.setProperty("--reading-size", `${nextReadingSize}px`);
      promptArea.style.setProperty("--kanji-size", `${Math.round((nextReadingSize * 23) / 38)}px`);
    }
  };
  const stop = (callback: () => void) => {
    if (transitioned) return;
    transitioned = true;
    window.removeEventListener("resize", adjustPromptSize);
    active = false;
    callback();
  };
  const paint = () => {
    const prompt = state.prompts[state.promptIndex];
    const before = prompt.reading.slice(0, state.index);
    const current = prompt.reading[state.index] ?? "";
    const after = prompt.reading.slice(state.index + 1);
    const remaining = (
      Math.max(0, state.endTimeMs - (performance.now() - startedAt)) / 1000
    ).toFixed(1);
    const urgent = Number(remaining) <= 10;
    stats.innerHTML = `<strong class="remaining${urgent ? " urgent" : ""}">${remaining}<small>秒</small></strong><span id="bonus"></span><span>正解 <b>${state.correct}</b></span>`;
    const bonus = stats.querySelector<HTMLElement>("#bonus")!;
    timeBar.style.width = `${Math.min(1, Number(remaining) / 60) * 100}%`;
    timeBar.parentElement?.classList.toggle("urgent", urgent);
    gauge.innerHTML = `<div class="combo-row"><span class="outline-ribbon">COMBO</span><b>${state.combo}</b><span>あと ${20 - (state.combo % 20)}字で +1秒</span></div><div class="gauge"><i style="width:${(state.combo % 20) * 5}%"></i></div>`;
    if (state.bonuses.length > seenBonuses) {
      seenBonuses = state.bonuses.length;
      bonusUntil = performance.now() + 800;
    }
    if (state.miss > seenMisses) {
      seenMisses = state.miss;
      missUntil = performance.now() + 200;
    }
    bonus.textContent = performance.now() < bonusUntil ? "+1秒" : "";
    perfect.innerHTML = state.lastPerfect ? '<span class="ribbon">PERFECT</span>' : "";
    const missClass = performance.now() < missUntil ? " current-miss" : "";
    const pending = state.pending ? `<small class="pending">${state.pending}</small>` : "";
    const next = state.prompts[state.promptIndex + 1];
    nextView.innerHTML = next ? `<span>NEXT</span><b>${next.text}</b>` : "";
    const chunks = prompt.chunks ?? [[prompt.text, prompt.reading] as [string, string]];
    const readingBreaks = breakIndexes(chunks.map((chunk) => chunk[1]));
    const kanjiBreaks = breakIndexes(chunks.map((chunk) => chunk[0]));
    const renderReading = (char: string) => char;
    const currentBreak = readingBreaks.includes(state.index) ? "\u200b" : "";
    promptView.innerHTML = `<div class="prompt-meta"><span>No. ${String(state.promptIndex + 1).padStart(2, "0")}</span></div><p class="kanji">${withBreaks(prompt.text, kanjiBreaks, (char) => char)}</p><p class="reading"><span class="done">${withBreaks(before, readingBreaks, renderReading)}</span>${currentBreak}${pending}<span class="current${missClass}">${current}</span>${withBreaks(after, readingBreaks, renderReading, state.index + 1)}</p>`;
    if (state.promptIndex !== measuredPromptIndex) {
      measuredPromptIndex = state.promptIndex;
      adjustPromptSize();
    }
  };
  const finishIfNeeded = () => {
    if (state.finished) stop(() => options.onFinish(state, strokes));
  };
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
    state = reduce(state, { type: "stroke", t: relative, input });
    const verdict = analyze(strokes);
    if (options.debug) renderDebugPanel(debugPanel, verdict, strokes);
    if (verdict.bot && !options.debug) {
      stop(options.onBlocked);
      return false;
    }
    paint();
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
  window.addEventListener("resize", adjustPromptSize);
  void document.fonts.ready.then(adjustPromptSize);
  paint();
}
