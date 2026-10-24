import { NATIVE_SOFT_KB_RATIO } from "../anticheat/thresholds";
import { resolveEdit, type EditBase } from "../game/native-edit";

const BLUR_CHECK_MS = 100;
const STRETCH_HOLD_MS = 300;
const FIELD_ATTRS: [string, string][] = [
  ["type", "text"],
  ["autocomplete", "off"],
  ["autocorrect", "off"],
  ["autocapitalize", "off"],
  ["spellcheck", "false"],
  ["enterkeyhint", "done"],
  ["lang", "ja"],
  ["aria-label", "入力"],
];
const FIELD_STYLE =
  "position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; font-size: 16px; " +
  "caret-color: transparent; border: 0; padding: 0;";

export type NativeFieldHandlers = {
  onEdit: (edit: {
    inputType: string;
    before: string;
    after: string;
    timeStamp: number;
    trusted: boolean;
  }) => void;
  onKey: (key: { code: string; timeStamp: number; trusted: boolean }) => void;
  onKeyboardChange: (shown: boolean) => void;
  onViewport: (view: { height: number; top: number; ratio: number }) => void;
};

export type NativeField = { focus(): void; clear(): void; reopen(): void; destroy(): void };

export function mountNativeField(host: HTMLElement, handlers: NativeFieldHandlers): NativeField {
  const fields = [createField(), createField()];
  host.append(fields[0], fields[1]);
  const bases = [emptyBase(), emptyBase()];
  let current = 0;
  let disposed = false;
  let blurred = false;
  let stretched = false;
  let shown = true;
  let blurTimer: number | null = null;
  let stretchTimer: number | null = null;
  const cleanups: (() => void)[] = [];
  const sync = () => {
    if (disposed) return;
    const next = !(blurred || stretched);
    if (next === shown) return;
    shown = next;
    handlers.onKeyboardChange(next);
  };
  const updateStretch = (ratio: number) => {
    if (ratio > NATIVE_SOFT_KB_RATIO) {
      if (stretched || stretchTimer !== null) return;
      stretchTimer = window.setTimeout(() => {
        stretchTimer = null;
        if (disposed) return;
        stretched = true;
        sync();
      }, STRETCH_HOLD_MS);
      return;
    }
    if (stretchTimer !== null) {
      window.clearTimeout(stretchTimer);
      stretchTimer = null;
    }
    stretched = false;
    sync();
  };
  const handleViewport = () => {
    if (disposed) return;
    const view = window.visualViewport;
    const height = view ? view.height : window.innerHeight;
    const top = view ? view.offsetTop : 0;
    const ratio = view ? view.height / window.innerHeight : 1;
    handlers.onViewport({ height, top, ratio });
    if (!view) return;
    updateStretch(ratio);
  };
  const handleInput = (index: number, event: Event) => {
    if (disposed || index !== current) return;
    const after = fields[index].value;
    const inputType = event instanceof InputEvent ? event.inputType : "";
    const resolved = resolveEdit(bases[index], inputType, after);
    bases[index] = resolved.next;
    if (resolved.before === null) return;
    handlers.onEdit({
      inputType,
      before: resolved.before,
      after,
      timeStamp: event.timeStamp,
      trusted: event.isTrusted,
    });
  };
  const handleKey = (event: KeyboardEvent) => {
    if (disposed) return;
    handlers.onKey({ code: event.code, timeStamp: event.timeStamp, trusted: event.isTrusted });
  };
  const handleFocus = () => {
    if (disposed) return;
    blurred = false;
    sync();
  };
  const handleBlur = () => {
    if (disposed) return;
    if (blurTimer !== null) window.clearTimeout(blurTimer);
    blurTimer = window.setTimeout(() => {
      blurTimer = null;
      if (disposed) return;
      const active = document.activeElement;
      if (active !== fields[0] && active !== fields[1]) {
        blurred = true;
        sync();
      }
    }, BLUR_CHECK_MS);
  };
  fields.forEach((input, index) => {
    const onInput = (event: Event) => handleInput(index, event);
    input.addEventListener("input", onInput);
    input.addEventListener("keydown", handleKey);
    input.addEventListener("focus", handleFocus);
    input.addEventListener("blur", handleBlur);
    cleanups.push(() => {
      input.removeEventListener("input", onInput);
      input.removeEventListener("keydown", handleKey);
      input.removeEventListener("focus", handleFocus);
      input.removeEventListener("blur", handleBlur);
    });
  });
  const viewport = window.visualViewport;
  if (viewport) {
    viewport.addEventListener("resize", handleViewport);
    viewport.addEventListener("scroll", handleViewport);
  }
  const focus = () => {
    if (disposed) return;
    fields[current].focus();
  };
  const clear = () => {
    if (disposed) return;
    const old = bases[current].remembered;
    const next = 1 - current;
    fields[current].value = "";
    fields[next].value = "";
    bases[0] = emptyBase();
    bases[1] = emptyBase();
    bases[next] = { remembered: "", commitBase: null, stale: old === "" ? null : old };
    current = next;
    fields[next].focus();
  };
  const reopen = () => {
    if (disposed) return;
    fields[current].blur();
    fields[current].focus();
  };
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    if (blurTimer !== null) window.clearTimeout(blurTimer);
    if (stretchTimer !== null) window.clearTimeout(stretchTimer);
    blurTimer = null;
    stretchTimer = null;
    for (const cleanup of cleanups) cleanup();
    if (viewport) {
      viewport.removeEventListener("resize", handleViewport);
      viewport.removeEventListener("scroll", handleViewport);
    }
    for (const input of fields) {
      input.blur();
      input.remove();
    }
  };
  handleViewport();
  return { focus, clear, reopen, destroy };
}

function emptyBase(): EditBase {
  return { remembered: "", commitBase: null, stale: null };
}

function createField(): HTMLInputElement {
  const input = document.createElement("input");
  for (const [name, value] of FIELD_ATTRS) input.setAttribute(name, value);
  input.style.cssText = FIELD_STYLE;
  return input;
}
