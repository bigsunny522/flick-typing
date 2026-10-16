import { DEFAULT_NAME } from "../ranking/name";
import type { RankingBoard, RankingEntry, RankingResponse } from "../ranking/types";
import { loadName, loadPlayerId } from "../storage";
import { bindThemeTap } from "../theme";
import { openNameForm } from "./name-form";

type Kind = "timeattack" | "endurance";

const KIND_LABELS: Record<Kind, string> = {
  timeattack: "タイムアタック",
  endurance: "今日の耐久",
};
const PERIOD_LABELS: Record<Kind, [string, string]> = {
  timeattack: ["今週", "歴代"],
  endurance: ["今日", "歴代"],
};

const SHELL =
  `<main class="screen ranking-screen">` +
  `<div class="deco" aria-hidden="true"></div>` +
  `<button type="button" class="theme-tap" aria-label="テーマカラーを変える"></button>` +
  `<p class="ribbon">RANKING</p>` +
  `<div class="ranking-switch">` +
  `<div class="ranking-kinds">` +
  `<button type="button" class="ranking-kind" data-kind="timeattack">${KIND_LABELS.timeattack}</button>` +
  `<button type="button" class="ranking-kind" data-kind="endurance">${KIND_LABELS.endurance}</button>` +
  `</div>` +
  `<div class="ranking-periods"></div>` +
  `</div>` +
  `<p class="ranking-period"></p>` +
  `<div class="ranking-list"></div>` +
  `<p class="ranking-me"></p>` +
  `<div class="ranking-name">` +
  `<p class="ranking-name-text"></p>` +
  `<button type="button" id="change-name" class="secondary-button">名前を変える</button>` +
  `</div>` +
  `<div class="ranking-actions">` +
  `<button type="button" id="ranking-back" class="secondary-button">戻る</button>` +
  `</div>` +
  `</main>`;

/** ランキング画面。`initialBoard` で開き、戻るときは `onBack()` を呼ぶ */
export function renderRanking(
  host: HTMLElement,
  initialBoard: RankingBoard,
  onBack: () => void,
  askName = false,
): void {
  let board = initialBoard;
  /** 途中で切り替えたら古い応答を使わないための番号 */
  let request = 0;

  host.innerHTML = SHELL;
  bindThemeTap(host);
  const periods = need<HTMLElement>(host, ".ranking-periods");
  const periodLine = need<HTMLElement>(host, ".ranking-period");
  const list = need<HTMLElement>(host, ".ranking-list");
  const me = need<HTMLElement>(host, ".ranking-me");
  const nameText = need<HTMLElement>(host, ".ranking-name-text");
  const kindButtons = [...host.querySelectorAll<HTMLButtonElement>(".ranking-kind")];
  syncName();
  syncSwitches();

  for (const button of kindButtons) {
    button.addEventListener("click", () => {
      switchTo(boardOf(kindOf(button.dataset.kind), isAlltime(board)));
    });
  }
  need<HTMLButtonElement>(host, "#change-name").addEventListener("click", () => {
    openNameForm(host, loadName(), applyName);
  });
  need<HTMLButtonElement>(host, "#ranking-back").addEventListener("click", onBack);
  load();
  if (askName) openNameForm(host, null, applyName, "ニックネームを登録");

  function switchTo(next: RankingBoard): void {
    if (next === board) return;
    board = next;
    syncSwitches();
    load();
  }

  /** 種目のボタンと期間のボタンを今の `board` に合わせる */
  function syncSwitches(): void {
    const kind = kindOf(board);
    for (const button of kindButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.kind === kind));
    }
    const alltime = isAlltime(board);
    const [periodLabel, alltimeLabel] = PERIOD_LABELS[kind];
    periods.innerHTML =
      `<button type="button" class="ranking-period-button" data-alltime="false"` +
      ` aria-pressed="${String(!alltime)}">${periodLabel}</button>` +
      `<button type="button" class="ranking-period-button" data-alltime="true"` +
      ` aria-pressed="${String(alltime)}">${alltimeLabel}</button>`;
    periods.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      button.addEventListener("click", () => {
        switchTo(boardOf(kindOf(board), button.dataset.alltime === "true"));
      });
    });
  }

  function syncName(): void {
    nameText.textContent = `名前: ${loadName() ?? DEFAULT_NAME}`;
  }

  /** 名前が決まったとき。「名前を変える」と、移ってから聞く入力欄の両方で使う */
  function applyName(name: string): void {
    nameText.textContent = `名前: ${name}`;
    load();
  }

  function load(): void {
    const id = (request += 1);
    const requested = board;
    periodLine.textContent = "";
    me.textContent = "";
    list.replaceChildren(message("読み込み中…"));
    fetch(`/api/ranking?board=${requested}`, {
      headers: { "X-Player-Id": loadPlayerId() },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`/api/ranking: ${response.status}`);
        return (await response.json()) as RankingResponse;
      })
      .then((data) => {
        if (id !== request) return;
        if (data.board !== requested) throw new Error(`board が違う: ${data.board}`);
        periodLine.textContent = periodText(data);
        renderEntries(list, data.entries);
        me.textContent = data.me
          ? `あなた ${data.me.rank}位 ・ ${data.me.correct}字`
          : "あなたの記録はまだありません";
      })
      .catch(() => {
        if (id !== request) return;
        periodLine.textContent = "";
        me.textContent = "";
        list.replaceChildren(message("読み込めませんでした"));
      });
  }
}

function kindOf(kind: string | undefined): Kind {
  return kind?.startsWith("endurance") ? "endurance" : "timeattack";
}

function isAlltime(board: RankingBoard): boolean {
  return board.endsWith("alltime");
}

function boardOf(kind: Kind, alltime: boolean): RankingBoard {
  if (kind === "endurance") return alltime ? "endurance-alltime" : "endurance-daily";
  return alltime ? "timeattack-alltime" : "timeattack-weekly";
}

function periodText(data: RankingResponse): string {
  const parts: string[] = [];
  if (data.period !== null) parts.push(data.period);
  if (data.passage !== null) parts.push(`${data.passage.title} / ${data.passage.author}`);
  return parts.join(" ・ ");
}

/** 名前は必ず `textContent` で入れる(innerHTML に混ぜない) */
function renderEntries(list: HTMLElement, entries: RankingEntry[]): void {
  list.replaceChildren();
  if (entries.length === 0) {
    list.append(message("まだ記録がありません"));
    return;
  }
  for (const entry of entries) {
    const row = document.createElement("p");
    row.className = entry.mine ? "ranking-row is-mine" : "ranking-row";
    const rank = document.createElement("span");
    rank.className = "ranking-row-rank";
    rank.textContent = `${entry.rank}位`;
    const name = document.createElement("span");
    name.className = "ranking-row-name";
    name.textContent = entry.name;
    const correct = document.createElement("span");
    correct.className = "ranking-row-correct";
    correct.textContent = `${entry.correct}字`;
    row.append(rank, name, correct);
    list.append(row);
  }
}

function message(text: string): HTMLElement {
  const line = document.createElement("p");
  line.className = "ranking-message";
  line.textContent = text;
  return line;
}

function need<T extends Element>(host: HTMLElement, selector: string): T {
  const element = host.querySelector<T>(selector);
  if (!element) throw new Error(`ranking: ${selector} がありません`);
  return element;
}
