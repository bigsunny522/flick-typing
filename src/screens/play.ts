import { analyze } from "../anticheat/behavior";
import { inputForStroke, type KeyStroke } from "../keyboard/layout";
import { mountKeyboard } from "../keyboard/view";
import { reduce, type SessionState } from "../game/session";
import { renderDebugPanel } from "../debug/panel";

export type PlayOptions = {
  debug: boolean;
  onFinish: (state: SessionState, strokes: KeyStroke[]) => void;
  onBlocked: () => void;
};

export function renderPlay(host: HTMLElement, initial: SessionState, options: PlayOptions): void {
  host.innerHTML =
    `<main class="screen play"><div id="countdown">3</div>` +
    '<div id="bonus"></div><div id="stats"></div><div id="combo-gauge"></div>' +
    '<div id="perfect"></div><div id="prompt"></div>' +
    '<div id="keyboard"></div><div id="debug"></div></main>';
  const countdown = host.querySelector<HTMLElement>("#countdown")!;
  const stats = host.querySelector<HTMLElement>("#stats")!;
  const bonus = host.querySelector<HTMLElement>("#bonus")!;
  const gauge = host.querySelector<HTMLElement>("#combo-gauge")!;
  const perfect = host.querySelector<HTMLElement>("#perfect")!;
  const promptView = host.querySelector<HTMLElement>("#prompt")!;
  const keyboard = host.querySelector<HTMLElement>("#keyboard")!;
  const debugPanel = host.querySelector<HTMLElement>("#debug")!;
  let state = initial;
  let startedAt = 0;
  let strokes: KeyStroke[] = [];
  let active = false;
  let transitioned = false;
  let bonusUntil = 0;
  let seenBonuses = 0;
  const stop = (callback: () => void) => {
    if (transitioned) return;
    transitioned = true;
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
    stats.innerHTML = `<strong class="remaining">残り ${remaining}秒</strong><div>コンボ ${state.combo}　正解 ${state.correct}</div>`;
    gauge.innerHTML = `<div class="gauge"><i style="width:${(state.combo % 20) * 5}%"></i></div>`;
    if (state.bonuses.length > seenBonuses) {
      seenBonuses = state.bonuses.length;
      bonusUntil = performance.now() + 800;
    }
    bonus.textContent = performance.now() < bonusUntil ? "+1秒" : "";
    perfect.textContent = state.lastPerfect ? "PERFECT" : "";
    const missClass = state.lastResult === "miss" ? " current-miss" : "";
    const pending = state.pending ? `<small class="pending">${state.pending}</small>` : "";
    promptView.innerHTML = `<p>${prompt.text}</p><p><span class="done">${before}</span>${pending}<span class="current${missClass}">${current}</span>${after}</p>`;
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
  paint();
}
