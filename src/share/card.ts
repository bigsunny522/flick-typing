import type { CardContent } from "./card-content";
import { HASHTAG } from "./text";

const WIDTH = 1200;
const HEIGHT = 675;
const MARGIN = 64;
const TOP_BAND = 12;
const RIGHT_COLUMN_START = 700;
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
  accent: string;
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
    accent: pick("--accent"),
    line: pick("--line"),
  };
}

/** 使う太さと、書く文字列を指定して読む(読めなくても sans-serif で描く) */
async function loadFonts(content: CardContent): Promise<void> {
  const values = content.stats.map(([, value]) => value).join("");
  const headings = content.stats.map(([heading]) => heading).join("");
  const requests: [string, string][] = [
    [`700 36px ${FONT_JP}`, "ふりっくタイピング"],
    [`400 28px ${FONT_JP}`, content.dateLabel],
    [`700 32px ${FONT_JP}`, content.modeLabel],
    [`italic 300 200px ${FONT_NUMBER}`, String(content.score)],
    [`700 48px ${FONT_JP}`, "字"],
    [`700 40px ${FONT_JP}`, content.rankLabel ?? ""],
    [`700 26px ${FONT_JP}`, content.badges.join("")],
    [`700 24px ${FONT_JP}`, headings],
    [`500 44px ${FONT_NUMBER}`, values],
    [`700 30px ${FONT_JP}`, values],
    [`400 26px ${FONT_JP}`, content.footer],
    [`700 26px ${FONT_JP}`, `#${HASHTAG}`],
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
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = palette.primary;
  ctx.fillRect(0, 0, WIDTH, TOP_BAND);
  drawHeader(ctx, content, palette);
  drawLeftColumn(ctx, content, palette);
  drawStats(ctx, content, palette);
  drawFooter(ctx, content, palette);
}

function drawHeader(ctx: CanvasRenderingContext2D, content: CardContent, palette: Palette): void {
  ctx.fillStyle = palette.fg;
  ctx.font = `700 36px ${FONT_JP}`;
  ctx.fillText("ふりっくタイピング", MARGIN, MARGIN);
  ctx.textAlign = "right";
  ctx.fillStyle = palette.muted;
  ctx.font = `400 28px ${FONT_JP}`;
  ctx.fillText(content.dateLabel, WIDTH - MARGIN, MARGIN + 4);
  ctx.textAlign = "left";
}

function drawLeftColumn(
  ctx: CanvasRenderingContext2D,
  content: CardContent,
  palette: Palette,
): void {
  let y = 128;
  ctx.fillStyle = palette.primaryStrong;
  ctx.font = `700 32px ${FONT_JP}`;
  ctx.fillText(content.modeLabel, MARGIN, y);
  y += 52;
  const score = String(content.score);
  ctx.fillStyle = palette.fg;
  ctx.font = `italic 300 200px ${FONT_NUMBER}`;
  ctx.fillText(score, MARGIN, y);
  const scoreWidth = ctx.measureText(score).width;
  ctx.font = `700 48px ${FONT_JP}`;
  const unitX = MARGIN + scoreWidth + 10;
  ctx.fillText("字", unitX, y + 142);
  y += 214;
  if (content.rankLabel !== null) {
    ctx.font = `700 40px ${FONT_JP}`;
    ctx.fillText(content.rankLabel, MARGIN, y);
    y += 54;
  }
  drawBadges(ctx, content.badges, y, palette);
}

function drawBadges(
  ctx: CanvasRenderingContext2D,
  badges: string[],
  y: number,
  palette: Palette,
): void {
  if (badges.length === 0) return;
  ctx.font = `700 26px ${FONT_JP}`;
  let x = MARGIN;
  for (const badge of badges) {
    const width = ctx.measureText(badge).width + 32;
    ctx.fillStyle = palette.primary;
    ctx.fillRect(x, y, width, 40);
    ctx.fillStyle = palette.primaryInk;
    ctx.fillText(badge, x + 16, y + 7);
    x += width + 12;
  }
}

function drawStats(ctx: CanvasRenderingContext2D, content: CardContent, palette: Palette): void {
  const width = WIDTH - MARGIN - RIGHT_COLUMN_START;
  let y = 128;
  content.stats.forEach(([heading, value], index) => {
    ctx.textAlign = "left";
    ctx.fillStyle = palette.muted;
    ctx.font = `700 24px ${FONT_JP}`;
    ctx.fillText(heading, RIGHT_COLUMN_START, y);
    ctx.fillStyle = palette.fg;
    if (heading === "作品") {
      ctx.font = `700 30px ${FONT_JP}`;
      ctx.fillText(clip(ctx, value, width), RIGHT_COLUMN_START, y + 38);
    } else {
      ctx.font = `500 44px ${FONT_NUMBER}`;
      ctx.fillText(value, RIGHT_COLUMN_START, y + 36);
    }
    y += 96;
    if (index < content.stats.length - 1) {
      ctx.fillStyle = palette.line;
      ctx.fillRect(RIGHT_COLUMN_START, y - 22, width, 1);
    }
  });
}

function drawFooter(ctx: CanvasRenderingContext2D, content: CardContent, palette: Palette): void {
  const y = HEIGHT - MARGIN - 26;
  ctx.textAlign = "left";
  ctx.fillStyle = palette.muted;
  ctx.font = `400 26px ${FONT_JP}`;
  ctx.fillText(content.footer, MARGIN, y);
  ctx.textAlign = "right";
  ctx.fillStyle = palette.primaryStrong;
  ctx.font = `700 26px ${FONT_JP}`;
  ctx.fillText(`#${HASHTAG}`, WIDTH - MARGIN, y);
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
