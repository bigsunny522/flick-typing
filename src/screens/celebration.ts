/** 結果画面の `.celebration` の中に canvas を足し、打ち上げと降下の紙吹雪を描き続ける */

type Shape = "rect" | "circle" | "strip";

type Piece = {
  shape: Shape;
  width: number;
  height: number;
  color: string;
  spawnAt: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  flutterSpeed: number;
  flutterAmp: number;
  phase: number;
  flipSpeed: number;
};

const GRAVITY = 1500;
const DRAG = 2.2;
const MAX_FRAME_SECONDS = 1 / 30;
const LAUNCH_AT = 0.35;
const FALL_FROM = 0.6;
const FALL_TO = 2.1;
const LAUNCH_COUNT = 70;
const FALL_COUNT = 60;
const MAX_LIFE_MS = 6000;
const EDGE_MARGIN = 30;

/**
 * 打ち上げの初速係数(高さ × この数値)。空気抵抗があるので1.6〜2.4 では目標の
 * 高さに届かない。端末の高さが変わっても紙吹雪の一番高いところが画面の上から
 * 10〜40% に来る範囲にした。
 */
const LAUNCH_POWER_MIN = 2.9;
const LAUNCH_POWER_MAX = 3.3;

/** 紙吹雪を打ち上げる。`layer` が 0×0 のときは何もしない */
export function startCelebration(layer: HTMLElement): void {
  const box = layer.getBoundingClientRect();
  const width = box.width;
  const height = box.height;
  if (width <= 0 || height <= 0) return;
  const canvas = document.createElement("canvas");
  canvas.className = "celebration-canvas";
  const context = canvas.getContext("2d");
  if (!context) return;
  const dpr = Math.min(window.devicePixelRatio, 2);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  layer.appendChild(canvas);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  const pieces = buildPieces(width, height, themeColors());
  let elapsed = 0;
  let previous: number | null = null;
  let startedAt: number | null = null;

  const stop = (): void => {
    canvas.remove();
  };

  const frame = (now: number): void => {
    if (!canvas.isConnected) return;
    if (startedAt === null) startedAt = now;
    if (now - startedAt >= MAX_LIFE_MS) return stop();
    const delta = previous === null ? 0 : Math.min((now - previous) / 1000, MAX_FRAME_SECONDS);
    previous = now;
    elapsed += delta;
    context.clearRect(0, 0, width, height);
    let remaining = 0;
    for (const piece of pieces) {
      if (elapsed < piece.spawnAt) {
        remaining += 1;
        continue;
      }
      step(piece, delta, elapsed);
      draw(context, piece, elapsed);
      if (piece.y <= height + EDGE_MARGIN) remaining += 1;
    }
    if (remaining === 0) return stop();
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

/** 主題色を読み、足し合わせて紙吹雪の5色にする */
function themeColors(): string[] {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string): string =>
    styles.getPropertyValue(name).trim() || fallback;
  return [
    read("--primary", "#7babff"),
    read("--accent", "#f59e0b"),
    read("--fg", "#171717"),
    "#ffd54a",
    "#ffffff",
  ];
}

/** 左右の打ち上げ70個ずつと、上から降る60個を作る */
function buildPieces(width: number, height: number, colors: string[]): Piece[] {
  const pieces: Piece[] = [];
  for (let i = 0; i < LAUNCH_COUNT; i += 1) {
    pieces.push(makeLaunch(width, height, colors, 1));
    pieces.push(makeLaunch(width, height, colors, -1));
  }
  for (let i = 0; i < FALL_COUNT; i += 1) {
    const ratio = i / (FALL_COUNT - 1);
    pieces.push(makeFaller(width, colors, FALL_FROM + (FALL_TO - FALL_FROM) * ratio));
  }
  return pieces;
}

/** 下の角から、真上から `direction` 側へ15〜40度の方向に打ち上げる */
function makeLaunch(width: number, height: number, colors: string[], direction: 1 | -1): Piece {
  const piece = makePiece(colors, LAUNCH_AT);
  const angle = ((15 + Math.random() * 25) * Math.PI) / 180;
  const power = LAUNCH_POWER_MIN + Math.random() * (LAUNCH_POWER_MAX - LAUNCH_POWER_MIN);
  const speed = height * power;
  piece.x = direction === 1 ? 0 : width;
  piece.y = height;
  piece.vx = Math.sin(angle) * speed * direction;
  piece.vy = -Math.cos(angle) * speed;
  return piece;
}

/** 画面の上から1個ずつ散らして降らせる */
function makeFaller(width: number, colors: string[], spawnAt: number): Piece {
  const piece = makePiece(colors, spawnAt);
  piece.x = Math.random() * width;
  piece.y = -20;
  piece.vx = -60 + Math.random() * 120;
  piece.vy = 60 + Math.random() * 120;
  return piece;
}

/** 形・色・回転などを1個ぶんランダムに決める */
function makePiece(colors: string[], spawnAt: number): Piece {
  const piece: Piece = {
    shape: "rect",
    width: 8,
    height: 13,
    color: colors[Math.floor(Math.random() * colors.length)],
    spawnAt,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: Math.random() * Math.PI * 2,
    spin: -8 + Math.random() * 16,
    flutterSpeed: 3 + Math.random() * 3,
    flutterAmp: 20 + Math.random() * 40,
    phase: Math.random() * Math.PI * 2,
    flipSpeed: 4 + Math.random() * 6,
  };
  const roll = Math.random();
  if (roll < 0.6) {
    piece.shape = "rect";
    piece.width = 7 + Math.random() * 3;
    piece.height = 11 + Math.random() * 4;
  } else if (roll < 0.85) {
    piece.shape = "circle";
    piece.width = 3 + Math.random() * 2;
    piece.height = piece.width;
  } else {
    piece.shape = "strip";
    piece.width = 3;
    piece.height = 16 + Math.random() * 6;
  }
  return piece;
}

/** 重力・空気抵抗・揺らぎ・回転を1フレームぶん進める */
function step(piece: Piece, delta: number, elapsed: number): void {
  piece.vy += GRAVITY * delta;
  const air = Math.exp(-DRAG * delta);
  piece.vx *= air;
  piece.vy *= air;
  const sway = Math.sin(elapsed * piece.flutterSpeed + piece.phase) * piece.flutterAmp;
  piece.x += (piece.vx + sway) * delta;
  piece.y += piece.vy * delta;
  piece.angle += piece.spin * delta;
}

/** 縦方向を `cos` 倍して、紙がくるくる回るように描く */
function draw(context: CanvasRenderingContext2D, piece: Piece, elapsed: number): void {
  const flip = Math.cos(elapsed * piece.flipSpeed + piece.phase);
  context.save();
  context.translate(piece.x, piece.y);
  context.rotate(piece.angle);
  context.scale(1, flip);
  context.fillStyle = piece.color;
  if (piece.shape === "circle") {
    context.beginPath();
    context.arc(0, 0, piece.width, 0, Math.PI * 2);
    context.fill();
  } else {
    context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
  }
  context.restore();
}
