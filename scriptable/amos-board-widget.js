// Amo's Board — Scriptable iOS widget
// Loads /api/board JSON and draws the widget directly on iOS.
// If loading fails, it shows the real HTTP status and response preview for debugging.

const DEFAULT_BASE_URL = "https://board-mcrxmrivq-amoo71s-projects.vercel.app";
const inputBase = (args.widgetParameter || DEFAULT_BASE_URL).trim().replace(/\/$/, "");
const boardURL = `${inputBase}/api/board?v=${Date.now()}`;
const family = config.widgetFamily || "medium";

const sizes = {
  small: [338, 338],
  medium: [720, 338],
  large: [720, 758],
  extraLarge: [1024, 480]
};
const [w, h] = sizes[family] || sizes.medium;

const widget = new ListWidget();
widget.url = inputBase;
widget.setPadding(0, 0, 0, 0);
widget.backgroundColor = new Color("#05070b");

try {
  const req = new Request(boardURL);
  req.timeoutInterval = 20;
  req.headers = { "Accept": "application/json" };
  const raw = await req.loadString();
  const status = req.response ? req.response.statusCode : "unknown";
  const contentType = req.response && req.response.headers ? String(req.response.headers["content-type"] || req.response.headers["Content-Type"] || "") : "";

  if (status < 200 || status >= 300) {
    throw new Error(`HTTP ${status} ${contentType}\n${raw.slice(0, 260)}`);
  }

  let board;
  try {
    board = JSON.parse(raw);
  } catch (_) {
    throw new Error(`Not JSON. HTTP ${status} ${contentType}\n${raw.slice(0, 260)}`);
  }

  widget.backgroundImage = await renderBoard(board, w, h);
} catch (error) {
  widget.setPadding(16, 16, 16, 16);
  const title = widget.addText("Amo‘s Board");
  title.font = Font.boldSystemFont(18);
  title.textColor = Color.white();
  widget.addSpacer(8);
  const message = widget.addText(String(error).slice(0, 520));
  message.font = Font.systemFont(10);
  message.textColor = new Color("#94a3b8");
  widget.addSpacer(6);
  const urlText = widget.addText(boardURL);
  urlText.font = Font.systemFont(8);
  urlText.textColor = new Color("#64748b");
}

if (!config.runsInWidget) {
  family === "large" ? await widget.presentLarge() : await widget.presentMedium();
}

Script.setWidget(widget);
Script.complete();

async function renderBoard(board, width, height) {
  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const boardW = Number(board.width || 1440);
  const boardH = Number(board.height || 1000);
  const sx = width / boardW;
  const sy = height / boardH;
  const scale = Math.min(sx, sy);

  fillRect(ctx, 0, 0, width, height, "#05070b");
  fillRect(ctx, 0, 0, width, height, "#101827");
  fillRect(ctx, 10, 10, width - 20, height - 20, "#182033");
  strokeRound(ctx, 10, 10, width - 20, height - 20, 24, "#ffffff", 0.22, 2);

  ctx.setTextColor(new Color("#ffffff", 0.48));
  ctx.setFont(Font.boldSystemFont(13));
  ctx.drawTextInRect("AMO'S BOARD", new Rect(26, 24, width - 52, 24));

  const items = Array.isArray(board.items) ? board.items : [];
  if (items.length === 0) {
    ctx.setTextColor(new Color("#ffffff", 0.36));
    ctx.setFont(Font.boldSystemFont(24));
    ctx.drawTextInRect("Amo‘s Board", new Rect(0, height / 2 - 30, width, 34));
    ctx.setTextColor(new Color("#ffffff", 0.18));
    ctx.setFont(Font.systemFont(13));
    ctx.drawTextInRect("Text • Pen • Images • Eraser • Sync", new Rect(0, height / 2 + 8, width, 24));
    return ctx.getImage();
  }

  for (const item of items) {
    if (!item || !item.type) continue;
    if (item.type === "path") drawPath(ctx, item, sx, sy, scale);
    if (item.type === "text") drawText(ctx, item, sx, sy, scale);
    if (item.type === "image") await drawImage(ctx, item, sx, sy);
  }

  return ctx.getImage();
}

function fillRect(ctx, x, y, w, h, hex) {
  ctx.setFillColor(new Color(hex));
  ctx.fill(new Rect(x, y, w, h));
}

function strokeRound(ctx, x, y, w, h, radius, hex, alpha, lineWidth) {
  const path = new Path();
  const r = Math.min(radius, w / 2, h / 2);
  path.move(new Point(x + r, y));
  path.addLine(new Point(x + w - r, y));
  path.addQuadCurve(new Point(x + w, y + r), new Point(x + w, y));
  path.addLine(new Point(x + w, y + h - r));
  path.addQuadCurve(new Point(x + w - r, y + h), new Point(x + w, y + h));
  path.addLine(new Point(x + r, y + h));
  path.addQuadCurve(new Point(x, y + h - r), new Point(x, y + h));
  path.addLine(new Point(x, y + r));
  path.addQuadCurve(new Point(x + r, y), new Point(x, y));
  path.closeSubpath();
  ctx.setStrokeColor(new Color(hex, alpha));
  ctx.setLineWidth(lineWidth);
  ctx.strokePath(path);
}

function drawPath(ctx, item, sx, sy, scale) {
  const points = Array.isArray(item.points) ? item.points : [];
  if (points.length < 1) return;
  const path = new Path();
  path.move(new Point(points[0].x * sx, points[0].y * sy));
  for (let i = 1; i < points.length; i++) {
    path.addLine(new Point(points[i].x * sx, points[i].y * sy));
  }
  const color = item.tool === "eraser" ? "#101827" : (item.color || "#f8fafc");
  ctx.setStrokeColor(new Color(color, Number(item.opacity || 1)));
  ctx.setLineWidth(Math.max(1, Number(item.width || 8) * scale));
  ctx.strokePath(path);
}

function drawText(ctx, item, sx, sy, scale) {
  ctx.setTextColor(new Color(item.color || "#f8fafc", Number(item.opacity || 1)));
  ctx.setFont(Font.boldSystemFont(Math.max(8, Number(item.fontSize || 42) * scale)));
  const rect = new Rect(
    Number(item.x || 0) * sx,
    Number(item.y || 0) * sy,
    Math.max(20, Number(item.width || 320) * sx),
    Math.max(20, Number(item.height || 80) * sy)
  );
  ctx.drawTextInRect(String(item.text || "Text"), rect);
}

async function drawImage(ctx, item, sx, sy) {
  const src = String(item.src || "");
  if (!src.startsWith("http") && !src.startsWith("data:image/")) return;
  try {
    let image;
    if (src.startsWith("http")) {
      const req = new Request(src);
      req.timeoutInterval = 10;
      image = await req.loadImage();
    } else {
      const base64 = src.split(",")[1];
      if (!base64) return;
      image = Image.fromData(Data.fromBase64String(base64));
    }
    const rect = new Rect(
      Number(item.x || 0) * sx,
      Number(item.y || 0) * sy,
      Math.max(1, Number(item.width || 360) * sx),
      Math.max(1, Number(item.height || 260) * sy)
    );
    ctx.drawImageInRect(image, rect);
  } catch (_) {}
}
