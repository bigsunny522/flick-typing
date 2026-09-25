import { readDirection } from "./gesture";
import { KEY_LABELS, KEY_ROWS, keyValues, type KeyId, type KeyStroke } from "./layout";

type PointerState = {
  key: KeyId;
  x: number;
  y: number;
  t: number;
  moves: number;
  width: number;
  height: number;
  pressure: number;
};

export function mountKeyboard(host: HTMLElement, onStroke: (stroke: KeyStroke) => boolean): void {
  const states = new Map<number, PointerState>();
  host.className = "keyboard";
  for (const key of KEY_ROWS.flat()) {
    const button = document.createElement("button");
    button.className = "key";
    button.textContent = key ? KEY_LABELS[key] : "";
    if (key)
      button.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "touch") return;
        const bounds = host.getBoundingClientRect();
        button.setPointerCapture(event.pointerId);
        states.set(event.pointerId, {
          key,
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
          t: event.timeStamp,
          moves: 0,
          width: event.width,
          height: event.height,
          pressure: event.pressure,
        });
        const guide = document.createElement("div");
        guide.className = "flick-guide";
        guide.dataset.pointerId = String(event.pointerId);
        guide.textContent = keyValues(key).join(" ");
        host.append(guide);
      });
    button.addEventListener("pointermove", (event) => {
      const state = states.get(event.pointerId);
      if (state) state.moves += 1;
    });
    button.addEventListener("pointerup", (event) => {
      const state = states.get(event.pointerId);
      if (!state) return;
      states.delete(event.pointerId);
      host.querySelector(`[data-pointer-id="${event.pointerId}"]`)?.remove();
      const bounds = host.getBoundingClientRect();
      const up = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        t: event.timeStamp,
      };
      const accepted = onStroke({
        key: state.key,
        dir: readDirection(up.x - state.x, up.y - state.y, bounds.width / 5),
        down: { x: state.x, y: state.y, t: state.t },
        up,
        moves: state.moves,
        width: state.width,
        height: state.height,
        pressure: state.pressure,
      });
      if (accepted) navigator.vibrate?.(8);
    });
    button.addEventListener("pointercancel", (event) => {
      states.delete(event.pointerId);
      host.querySelector(`[data-pointer-id="${event.pointerId}"]`)?.remove();
    });
    host.append(button);
  }
}
