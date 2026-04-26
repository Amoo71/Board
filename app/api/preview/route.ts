import { NextRequest, NextResponse } from 'next/server';
import { Resvg } from '@resvg/resvg-js';
import { buildBoardSvg } from '@/lib/render';
import { readBoard } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const width = clamp(Number(searchParams.get('w')) || 1092, 300, 2400);
  const height = clamp(Number(searchParams.get('h')) || 510, 300, 2400);
  const board = await readBoard();
  const svg = await buildBoardSvg(board, width, height);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles: [], loadSystemFonts: true, defaultFontFamily: 'Arial' }
  });
  const png = resvg.render().asPng();

  return new NextResponse(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
    }
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
