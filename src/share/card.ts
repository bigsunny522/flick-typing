import type { CardContent } from "./card-content";
import { HASHTAG } from "./text";

const WIDTH = 1200;
const HEIGHT = 675;
const CENTER = WIDTH / 2;
const BOARD_X = 56;
const BOARD_Y = 40;
const BOARD_WIDTH = 1088;
const BOARD_HEIGHT = 595;
const BAND_HEIGHT = 10;
const STATS_X = 136;
const STATS_END = 1064;
const FONT_JP = '"LINE Seed JP", sans-serif';
const FONT_NUMBER = "Outfit, sans-serif";

/** テーマの色。描くときに CSS 変数から読む */
type Palette = {
  bg: string;
  fg: string;
  muted: string;
  primary: string;
  primaryInk: string;
  primaryStrong: string;
  primaryTint: string;
  primaryLine: string;
  line: string;
};

/** カード画像を描いて PNG にする。描けなければ null */
export async function drawCard(content: CardContent): Promise<Blob | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await loadFonts(content);
    paint(ctx, content, readPalette());
    return await toPng(canvas);
  } catch {
    return null;
  }
}

function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string): string => style.getPropertyValue(name).trim();
  return {
    bg: pick("--bg"),
    fg: pick("--fg"),
    muted: pick("--muted"),
    primary: pick("--primary"),
    primaryInk: pick("--primary-ink"),
    primaryStrong: pick("--primary-strong"),
    primaryTint: pick("--primary-tint"),
    primaryLine: pick("--primary-line"),
    line: pick("--line"),
  };
}

/** 使う太さと、書く文字列を指定して読む(読めなくても sans-serif で描く) */
async function loadFonts(content: CardContent): Promise<void> {
  const headings = content.stats.map(([heading]) => heading).join("");
  const values = content.stats.map(([, value]) => value).join("");
  const bottom = `${content.dateLabel}  ${content.footer}  #${HASHTAG}`;
  const requests: [string, string][] = [
    [`700 30px ${FONT_JP}`, "ふりっくタイピング"],
    [`700 26px ${FONT_JP}`, content.modeLabel],
    [`italic 300 170px ${FONT_NUMBER}`, String(content.score)],
    [`700 48px ${FONT_JP}`, "字"],
    [`700 38px ${FONT_JP}`, content.rankLabel ?? ""],
    [`700 26px ${FONT_JP}`, content.badges.join("")],
    [`700 22px ${FONT_JP}`, headings],
    [`500 38px ${FONT_NUMBER}`, values],
    [`700 28px ${FONT_JP}`, values],
    [`400 22px ${FONT_JP}`, bottom],
  ];
  await Promise.all(
    requests.map(async ([font, text]) => {
      try {
        await document.fonts.load(font, text);
      } catch {
        // 読めなくても sans-serif で描く
      }
    }),
  );
}

function paint(ctx: CanvasRenderingContext2D, content: CardContent, palette: Palette): void {
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = palette.primaryTint;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = palette.bg;
  ctx.fillRect(BOARD_X, BOARD_Y, BOARD_WIDTH, BOARD_HEIGHT);
  ctx.strokeStyle = palette.primaryLine;
  ctx.lineWidth = 2;
  ctx.strokeRect(BOARD_X, BOARD_Y, BOARD_WIDTH, BOARD_HEIGHT);
  ctx.fillStyle = palette.primary;
  ctx.fillRect(BOARD_X, BOARD_Y, BOARD_WIDTH, BAND_HEIGHT);
  drawName(ctx, palette);
  drawMode(ctx, content, palette);
  drawScore(ctx, content, palette);
  drawRank(ctx, content, palette);
  drawBadges(ctx, content, palette);
  drawDivider(ctx, palette);
  drawStats(ctx, content, palette);
  drawFooter(ctx, content, palette);
}

/** 中央に文字を書く */
function centerText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

function drawName(ctx: CanvasRenderingContext2D, palette: Palette): void {
  ctx.fillStyle = palette.fg;
  ctx.font = `700 30px ${FONT_JP}`;
  centerText(ctx, "ふりっくタイピング", CENTER, 78);
}

/** 種類は帯ごと中央に置く */
function drawMode(ctx: CanvasRenderingContext2D, content: CardContent, palette: Palette): void {
  ctx.font = `700 26px ${FONT_JP}`;
  const width = ctx.measureText(content.modeLabel).width + 36;
  ctx.fillStyle = palette.primary;
  ctx.fillRect(CENTER - width / 2, 124, width, 42);
  ctx.fillStyle = palette.primaryInk;
  centerText(ctx, content.modeLabel, CENTER, 132);
}

/** 文字数は数字と「字」の幅を合わせて中央に置く */
function drawScore(ctx: CanvasRenderingContext2D, content: CardContent, palette: Palette): void {
  const score = String(content.score);
  ctx.font = `italic 300 170px ${FONT_NUMBER}`;
  const scoreWidth = ctx.measureText(score).width;
  ctx.font = `700 48px ${FONT_JP}`;
  const unitWidth = ctx.measureText("字").width;
  const start = CENTER - (scoreWidth + 10 + unitWidth) / 2;
  ctx.fillStyle = palette.fg;
  ctx.font = `italic 300 170px ${FONT_NUMBER}`;
  ctx.fillText(score, start, 182);
  ctx.font = `700 48px ${FONT_JP}`;
  ctx.fillText("字", start + scoreWidth + 10, 294);
}

function drawRank(ctx: CanvasRenderingContext2D, content: CardContent, palette: Palette): void {
  if (content.rankLabel === null) return;
  ctx.fillStyle = palette.primaryStrong;
  ctx.font = `700 38px ${FONT_JP}`;
  centerText(ctx, content.rankLabel, CENTER, 360);
}

/** バッジは全部の幅(間 12px)を合わせて中央に置く */
function drawBadges(ctx: CanvasRenderingContext2D, content: CardContent, palette: Palette): void {
  if (content.badges.length === 0) return;
  ctx.font = `700 26px ${FONT_JP}`;
  const widths = content.badges.map((badge) => ctx.measureText(badge).width + 32);
  const total = widths.reduce((sum, width) => sum + width, 0) + 12 * (widths.length - 1);
  let x = CENTER - total / 2;
  content.badges.forEach((badge, index) => {
    const width = widths[index];
    ctx.fillStyle = palette.primary;
    ctx.fillRect(x, 414, width, 40);
    ctx.fillStyle = palette.primaryInk;
    ctx.fillText(badge, x + 16, 421);
    x += width + 12;
  });
}

function drawDivider(ctx: CanvasRenderingContext2D, palette: Palette): void {
  ctx.fillStyle = palette.line;
  ctx.fillRect(STATS_X, 478, STATS_END - STATS_X, 1);
}

/** 数値は x 136〜1064 を stats の数で等分し、各区画の中央に書く */
function drawStats(ctx: CanvasRenderingContext2D, content: CardContent, palette: Palette): void {
  const cell = (STATS_END - STATS_X) / content.stats.length;
  content.stats.forEach(([heading, value], index) => {
    const middle = STATS_X + cell * index + cell / 2;
    ctx.fillStyle = palette.muted;
    ctx.font = `700 22px ${FONT_JP}`;
    centerText(ctx, heading, middle, 498);
    ctx.fillStyle = palette.fg;
    if (heading === "作品") {
      ctx.font = `700 28px ${FONT_JP}`;
      centerText(ctx, clip(ctx, value, cell - 24), middle, 530);
    } else {
      ctx.font = `500 38px ${FONT_NUMBER}`;
      centerText(ctx, value, middle, 530);
    }
  });
}

function drawFooter(ctx: CanvasRenderingContext2D, content: CardContent, palette: Palette): void {
  ctx.fillStyle = palette.muted;
  ctx.font = `400 22px ${FONT_JP}`;
  centerText(ctx, `${content.dateLabel}  ${content.footer}  #${HASHTAG}`, CENTER, 592);
}

/** 幅に入らなければ末尾を … にして詰める */
function clip(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 0 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function toPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
