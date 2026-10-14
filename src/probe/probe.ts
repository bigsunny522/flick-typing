type ProbeField = "a" | "b" | "viewport";

type ProbeRecord = {
  scenario: string;
  field: ProbeField;
  type: string;
  t: number;
  isTrusted: boolean;
  key?: string;
  code?: string;
  keyCode?: number;
  inputType?: string;
  data?: string | null;
  isComposing?: boolean;
  value: string;
  selectionStart?: number | null;
  innerHeight: number;
  vvHeight: number;
  vvOffsetTop: number;
};

const SCENARIO_RESET = "7 3文字で空にする";
const SCENARIO_SWAP = "8 3文字で入力欄Bへ";
const SCENARIO_REFOCUS = "9 3文字でblur→focus";

const SCENARIOS: readonly string[] = [
  "1 フリック",
  "2 トグル入力",
  "3 変換候補",
  "4 ペースト",
  "5 音声入力",
  "6 物理キーボード",
  SCENARIO_RESET,
  SCENARIO_SWAP,
  SCENARIO_REFOCUS,
];

const RECORDED_EVENTS: readonly string[] = [
  "keydown",
  "keyup",
  "beforeinput",
  "input",
  "compositionstart",
  "compositionupdate",
  "compositionend",
  "focus",
  "blur",
];

const VISIBLE_RECORDS = 40;
const AUTO_CLEAR_LENGTH = 3;

const FIELD_ATTRS =
  `class="probe-field" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" ` +
  `spellcheck="false" enterkeyhint="done" lang="ja"`;

export function renderProbe(host: HTMLElement): void {
  const records: ProbeRecord[] = [];
  let scenario = "";
  let notice = "";

  const scenarioButtons = SCENARIOS.map(
    (name, index) =>
      `<button type="button" class="probe-scenario" data-index="${index}">${name}</button>`,
  ).join("");

  host.innerHTML =
    `<main class="probe">` +
    `<p class="probe-status" id="probe-status"></p>` +
    `<div class="probe-scenarios">${scenarioButtons}</div>` +
    `<input id="probe-a" aria-label="入力欄 A" ${FIELD_ATTRS} />` +
    `<input id="probe-b" aria-label="入力欄 B" ${FIELD_ATTRS} />` +
    `<div class="probe-buttons">` +
    `<button type="button" id="probe-save">記録を保存</button>` +
    `<button type="button" id="probe-copy">記録をコピー</button>` +
    `<button type="button" id="probe-clear">記録を消す</button>` +
    `</div>` +
    `<p class="probe-notice" id="probe-notice"></p>` +
    `<pre class="probe-records" id="probe-records"></pre>` +
    `</main>`;

  const inputA = pick<HTMLInputElement>(host, "#probe-a");
  const inputB = pick<HTMLInputElement>(host, "#probe-b");
  const statusEl = pick<HTMLElement>(host, "#probe-status");
  const noticeEl = pick<HTMLElement>(host, "#probe-notice");
  const recordsEl = pick<HTMLElement>(host, "#probe-records");
  const scenarioEls = host.querySelectorAll<HTMLElement>(".probe-scenario");

  function renderStatus(): void {
    statusEl.textContent =
      `innerHeight=${window.innerHeight} ` +
      `visualViewport.height=${viewportHeight()} ` +
      `visualViewport.offsetTop=${viewportOffsetTop()}`;
  }

  function renderRecords(): void {
    noticeEl.textContent = notice;
    const visible = records.slice(-VISIBLE_RECORDS).reverse();
    recordsEl.textContent = visible.map((record) => JSON.stringify(record)).join("\n");
  }

  function push(record: ProbeRecord): void {
    records.push(record);
    renderRecords();
  }

  function recordFor(
    field: "a" | "b",
    type: string,
    event: Event,
    input: HTMLInputElement,
  ): ProbeRecord {
    const record: ProbeRecord = {
      scenario,
      field,
      type,
      t: roundTime(event.timeStamp),
      isTrusted: event.isTrusted,
      value: input.value,
      selectionStart: input.selectionStart,
      innerHeight: window.innerHeight,
      vvHeight: viewportHeight(),
      vvOffsetTop: viewportOffsetTop(),
    };
    if (event instanceof KeyboardEvent) {
      record.key = event.key;
      record.code = event.code;
      record.keyCode = event.keyCode;
      record.isComposing = event.isComposing;
    } else if (event instanceof InputEvent) {
      record.inputType = event.inputType;
      record.data = event.data;
      record.isComposing = event.isComposing;
    } else if (event instanceof CompositionEvent) {
      record.data = event.data;
    }
    return record;
  }

  function viewportRecord(event: Event): ProbeRecord {
    return {
      scenario,
      field: "viewport",
      type: "vv",
      t: roundTime(event.timeStamp),
      isTrusted: event.isTrusted,
      value: "",
      innerHeight: window.innerHeight,
      vvHeight: viewportHeight(),
      vvOffsetTop: viewportOffsetTop(),
    };
  }

  function handleInputA(event: Event): void {
    if (inputA.value.length < AUTO_CLEAR_LENGTH) return;
    if (scenario === SCENARIO_RESET) {
      inputA.value = "";
      push(recordFor("a", "probe-reset", event, inputA));
      return;
    }
    if (scenario === SCENARIO_SWAP) {
      inputA.value = "";
      inputB.focus();
      push(recordFor("a", "probe-swap", event, inputA));
      return;
    }
    if (scenario === SCENARIO_REFOCUS) {
      inputA.blur();
      inputA.value = "";
      inputA.focus();
      push(recordFor("a", "probe-refocus", event, inputA));
    }
  }

  function handleInputB(event: Event): void {
    if (scenario !== SCENARIO_SWAP) return;
    if (inputB.value.length < AUTO_CLEAR_LENGTH) return;
    inputB.value = "";
    inputA.focus();
    push(recordFor("b", "probe-swap", event, inputB));
  }

  function handleFieldEvent(
    field: "a" | "b",
    input: HTMLInputElement,
    type: string,
    event: Event,
  ): void {
    push(recordFor(field, type, event, input));
    if (type !== "input") return;
    if (field === "a") handleInputA(event);
    else handleInputB(event);
  }

  function handleViewportChange(event: Event): void {
    renderStatus();
    push(viewportRecord(event));
  }

  function selectScenario(index: number): void {
    scenario = SCENARIOS[index];
    scenarioEls.forEach((button, i) => button.classList.toggle("is-active", i === index));
  }

  function buildPayload(): string {
    return JSON.stringify(
      {
        userAgent: navigator.userAgent,
        screen: { width: screen.width, height: screen.height },
        records,
      },
      null,
      2,
    );
  }

  function saveRecords(): void {
    const blob = new Blob([buildPayload()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `probe-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyRecords(): Promise<void> {
    try {
      await navigator.clipboard.writeText(buildPayload());
      notice = "";
    } catch {
      notice = "コピーできませんでした";
    }
    renderRecords();
  }

  function clearRecords(): void {
    records.length = 0;
    notice = "";
    renderRecords();
  }

  for (const type of RECORDED_EVENTS) {
    inputA.addEventListener(type, (event) => handleFieldEvent("a", inputA, type, event));
    inputB.addEventListener(type, (event) => handleFieldEvent("b", inputB, type, event));
  }

  scenarioEls.forEach((button) => {
    const index = Number(button.dataset.index);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      selectScenario(index);
    });
    button.addEventListener("click", () => selectScenario(index));
  });

  const viewport = window.visualViewport;
  if (viewport) {
    viewport.addEventListener("resize", handleViewportChange);
    viewport.addEventListener("scroll", handleViewportChange);
  }

  pick<HTMLElement>(host, "#probe-save").addEventListener("click", saveRecords);
  pick<HTMLElement>(host, "#probe-copy").addEventListener("click", () => void copyRecords());
  pick<HTMLElement>(host, "#probe-clear").addEventListener("click", clearRecords);

  renderStatus();
  renderRecords();
}

function pick<T extends Element>(host: HTMLElement, selector: string): T {
  const element = host.querySelector<T>(selector);
  if (!element) throw new Error(`probe: ${selector} がありません。`);
  return element;
}

function viewportHeight(): number {
  return window.visualViewport ? window.visualViewport.height : 0;
}

function viewportOffsetTop(): number {
  return window.visualViewport ? window.visualViewport.offsetTop : 0;
}

function roundTime(value: number): number {
  return Math.round(value * 10) / 10;
}
