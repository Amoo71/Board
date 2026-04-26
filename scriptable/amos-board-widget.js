// Amo's Board — Scriptable iOS widget
// Deploy the Next.js app to Vercel, then use this script as a medium or large Scriptable widget.
// Optional: set the widget parameter to another Vercel URL if you create a new deployment/domain.

const DEFAULT_BASE_URL = "https://board-mcrxmrivq-amoo71s-projects.vercel.app";
const inputBase = (args.widgetParameter || DEFAULT_BASE_URL).trim().replace(/\/$/, "");
const family = config.widgetFamily || "medium";

const pixelSizes = {
  small: [510, 510],
  medium: [1092, 510],
  large: [1092, 1146],
  extraLarge: [2208, 1032]
};

const [w, h] = pixelSizes[family] || pixelSizes.medium;
const previewURL = `${inputBase}/api/preview?w=${w}&h=${h}&v=${Date.now()}`;

const widget = new ListWidget();
widget.url = inputBase;
widget.setPadding(0, 0, 0, 0);
widget.backgroundColor = new Color("#05070b");

try {
  const req = new Request(previewURL);
  req.timeoutInterval = 20;
  const image = await req.loadImage();
  widget.backgroundImage = image;
} catch (error) {
  widget.setPadding(16, 16, 16, 16);
  const title = widget.addText("Amo‘s Board");
  title.font = Font.boldSystemFont(18);
  title.textColor = Color.white();
  widget.addSpacer(8);
  const message = widget.addText(`Could not load preview. URL: ${previewURL}`);
  message.font = Font.systemFont(11);
  message.textColor = new Color("#94a3b8");
}

if (!config.runsInWidget) {
  await widget.presentMedium();
}

Script.setWidget(widget);
Script.complete();
