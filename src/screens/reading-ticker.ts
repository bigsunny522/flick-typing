export type ReadingTicker = {
  /** 新しい文を表示する(1行を作り直し、動きなしで1文字目に合わせる) */
  setReading(reading: string): void;
  /** 状態を反映する(文字のクラスと位置の更新だけ。1行は作り直さない) */
  update(index: number, pending: string | null, miss: boolean): void;
  /** resize などで位置を計算し直す */
  relayout(): void;
  destroy(): void;
};

export function createReadingTicker(host: HTMLElement): ReadingTicker {
  host.innerHTML =
    '<div class="reading-ticker-line"></div><div class="reading-ticker-marker"></div>';
  const line = host.querySelector<HTMLElement>(".reading-ticker-line")!;
  const marker = host.querySelector<HTMLElement>(".reading-ticker-marker")!;
  let spans: HTMLSpanElement[] = [];
  let currentIndex = -1;
  let currentPending: string | null = null;
  let currentMiss = false;
  let destroyed = false;

  const position = () => {
    if (destroyed || spans.length === 0) return;
    const base = host.clientWidth * 0.28;
    const current = spans[Math.min(Math.max(currentIndex, 0), spans.length - 1)];
    line.style.transform = `translateX(${base - current.offsetLeft}px)`;
    marker.style.width = `${current.offsetWidth}px`;
  };

  const setTransition = (enabled: boolean) => {
    line.style.transition = enabled ? "" : "none";
  };

  const update = (index: number, pending: string | null, miss: boolean) => {
    const indexChanged = index !== currentIndex;
    const pendingChanged = pending !== currentPending;
    const missChanged = miss !== currentMiss;
    if (!indexChanged && !pendingChanged && !missChanged) return;
    currentIndex = index;
    currentPending = pending;
    currentMiss = miss;
    spans.forEach((span, spanIndex) => {
      span.className = spanIndex < index ? "is-typed" : spanIndex === index ? "is-current" : "";
      if (spanIndex === index) {
        span.classList.toggle("is-miss", miss);
        span.dataset.pending = pending ?? "";
      } else {
        delete span.dataset.pending;
      }
    });
    position();
  };

  const onResize = () => position();
  window.addEventListener("resize", onResize);

  const ticker: ReadingTicker = {
    setReading(reading) {
      setTransition(false);
      line.replaceChildren();
      spans = [...reading].map((char) => {
        const span = document.createElement("span");
        span.textContent = char;
        line.append(span);
        return span;
      });
      currentIndex = -1;
      currentPending = null;
      currentMiss = false;
      update(0, null, false);
      position();
      void line.offsetWidth;
      setTransition(true);
    },
    update,
    relayout: position,
    destroy() {
      destroyed = true;
      window.removeEventListener("resize", onResize);
    },
  };

  return ticker;
}
