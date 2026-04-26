import { BoardImageItem, BoardItem, BoardPathItem, BoardState, BoardTextItem } from '@/lib/board';
import { pointsToPath } from '@/lib/paths';

export async function buildBoardSvg(board: BoardState, outputWidth = 1092, outputHeight = 510): Promise<string> {
  const items = await Promise.all(board.items.map(async (item) => {
    if (item.type !== 'image') return item;
    return { ...item, src: await normalizeImageSource(item.src) } satisfies BoardImageItem;
  }));

  const erasers = items.filter((item): item is BoardPathItem => item.type === 'path' && item.tool === 'eraser');
  const visible = items.filter((item) => item.type !== 'path' || item.tool !== 'eraser');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${board.width} ${board.height}" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="bg" cx="20%" cy="0%" r="90%">
      <stop offset="0%" stop-color="#263653"/><stop offset="48%" stop-color="#111827"/><stop offset="100%" stop-color="#05070b"/>
    </radialGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity=".18"/><stop offset="100%" stop-color="#fff" stop-opacity=".06"/></linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="34" stdDeviation="24" flood-color="#000" flood-opacity=".45"/></filter>
    <clipPath id="clip"><rect x="18" y="18" width="${board.width - 36}" height="${board.height - 36}" rx="54"/></clipPath>
    <mask id="mask"><rect width="${board.width}" height="${board.height}" fill="white"/>${erasers.map((p) => `<path d="${pointsToPath(p.points)}" fill="none" stroke="black" stroke-width="${p.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${p.opacity}"/>`).join('')}</mask>
  </defs>
  <rect width="${board.width}" height="${board.height}" rx="62" fill="url(#bg)"/>
  <rect x="18" y="18" width="${board.width - 36}" height="${board.height - 36}" rx="54" fill="url(#glass)" stroke="#fff" stroke-opacity=".22" stroke-width="2" filter="url(#shadow)"/>
  <g clip-path="url(#clip)" mask="url(#mask)">${visible.map(renderItem).join('')}</g>
  <text x="52" y="82" fill="#fff" opacity=".54" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',Arial,sans-serif" font-size="24" letter-spacing="1.6">AMO'S BOARD</text>
</svg>`;
}

function renderItem(item: BoardItem): string {
  if (item.type === 'path') return renderPath(item);
  if (item.type === 'text') return renderText(item);
  return renderImage(item);
}

function renderPath(item: BoardPathItem): string {
  return `<path d="${pointsToPath(item.points)}" fill="none" stroke="${escapeAttr(item.color)}" stroke-width="${item.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${item.opacity}"/>`;
}

function renderText(item: BoardTextItem): string {
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  const lines = item.text.split('\n').slice(0, 20);
  const tspans = lines.map((line, i) => `<tspan x="${item.x}" dy="${i === 0 ? 0 : item.fontSize * 1.15}">${escapeText(line)}</tspan>`).join('');
  return `<text transform="rotate(${item.rotation} ${cx} ${cy})" x="${item.x}" y="${item.y + item.fontSize}" fill="${escapeAttr(item.color)}" opacity="${item.opacity}" font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display',Arial,sans-serif" font-weight="650" font-size="${item.fontSize}">${tspans}</text>`;
}

function renderImage(item: BoardImageItem): string {
  const cx = item.x + item.width / 2;
  const cy = item.y + item.height / 2;
  return `<image href="${escapeAttr(item.src)}" x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" opacity="${item.opacity}" preserveAspectRatio="xMidYMid slice" transform="rotate(${item.rotation} ${cx} ${cy})"/>`;
}

async function normalizeImageSource(src: string): Promise<string> {
  if (src.startsWith('data:image/')) return src;
  if (!src.startsWith('http')) return src;
  try {
    const response = await fetch(src, { cache: 'force-cache' });
    const type = response.headers.get('content-type') || 'image/png';
    if (!response.ok || !type.startsWith('image/')) return src;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 2500000) return src;
    return `data:${type};base64,${bytes.toString('base64')}`;
  } catch {
    return src;
  }
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}
