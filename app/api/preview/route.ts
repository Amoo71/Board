import * as React from 'react';
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readBoard } from '@/lib/storage';
import type { BoardImageItem, BoardItem, BoardPathItem, BoardState, BoardTextItem } from '@/lib/board';
import { pointsToPath } from '@/lib/paths';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const FALLBACK_BOARD: BoardState = {
  version: 1,
  title: 'Amo‘s Board',
  width: 1440,
  height: 1000,
  updatedAt: new Date(0).toISOString(),
  items: []
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const width = clamp(Number(searchParams.get('w')) || 1092, 300, 2400);
  const height = clamp(Number(searchParams.get('h')) || 510, 300, 2400);
  const board = await readBoard().catch(() => FALLBACK_BOARD);

  return new ImageResponse(
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #273654 0%, #101827 48%, #05070b 100%)',
          color: '#f8fafc',
          fontFamily: 'Arial, sans-serif'
        }
      },
      React.createElement('div', {
        style: {
          display: 'flex',
          position: 'absolute',
          left: 18,
          top: 18,
          width: width - 36,
          height: height - 36,
          borderRadius: 54,
          border: '2px solid rgba(255,255,255,0.22)',
          backgroundColor: 'rgba(255,255,255,0.07)'
        }
      }),
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            position: 'absolute',
            left: 52,
            top: 44,
            fontSize: 24,
            letterSpacing: 1.6,
            color: 'rgba(255,255,255,0.54)',
            fontWeight: 700
          }
        },
        "AMO'S BOARD"
      ),
      board.items.length === 0
        ? React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                position: 'absolute',
                left: 0,
                top: 0,
                width,
                height,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                color: 'rgba(255,255,255,0.35)',
                fontWeight: 800
              }
            },
            React.createElement('div', { style: { display: 'flex', fontSize: 34 } }, 'Amo‘s Board'),
            React.createElement('div', { style: { display: 'flex', marginTop: 12, fontSize: 18, color: 'rgba(255,255,255,0.18)' } }, 'Text • Pen • Images • Eraser • Sync')
          )
        : board.items.map((item) => renderItem(item, board.width, board.height, width, height))
    ),
    {
      width,
      height,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    }
  );
}

function renderItem(item: BoardItem, boardWidth: number, boardHeight: number, outputWidth: number, outputHeight: number): React.ReactElement | null {
  if (item.type === 'path') return renderPath(item, boardWidth, boardHeight, outputWidth, outputHeight);
  if (item.type === 'text') return renderText(item, boardWidth, boardHeight, outputWidth, outputHeight);
  return renderImage(item, boardWidth, boardHeight, outputWidth, outputHeight);
}

function renderPath(item: BoardPathItem, boardWidth: number, boardHeight: number, outputWidth: number, outputHeight: number): React.ReactElement {
  return React.createElement(
    'svg',
    {
      key: item.id,
      width: outputWidth,
      height: outputHeight,
      viewBox: `0 0 ${boardWidth} ${boardHeight}`,
      style: { position: 'absolute', left: 0, top: 0, width: outputWidth, height: outputHeight }
    },
    React.createElement('path', {
      d: pointsToPath(item.points),
      fill: 'none',
      stroke: item.tool === 'eraser' ? '#101827' : item.color,
      strokeWidth: item.width,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      opacity: item.opacity
    })
  );
}

function renderText(item: BoardTextItem, boardWidth: number, boardHeight: number, outputWidth: number, outputHeight: number): React.ReactElement {
  const sx = outputWidth / boardWidth;
  const sy = outputHeight / boardHeight;
  return React.createElement(
    'div',
    {
      key: item.id,
      style: {
        display: 'flex',
        position: 'absolute',
        left: item.x * sx,
        top: item.y * sy,
        width: item.width * sx,
        minHeight: item.height * sy,
        color: item.color,
        opacity: item.opacity,
        fontSize: Math.max(8, item.fontSize * sx),
        fontWeight: 800,
        lineHeight: 1.12,
        whiteSpace: 'pre-wrap',
        transform: `rotate(${item.rotation}deg)`,
        transformOrigin: 'center center'
      }
    },
    item.text
  );
}

function renderImage(item: BoardImageItem, boardWidth: number, boardHeight: number, outputWidth: number, outputHeight: number): React.ReactElement | null {
  if (!item.src.startsWith('http') && !item.src.startsWith('data:image/')) return null;
  const sx = outputWidth / boardWidth;
  const sy = outputHeight / boardHeight;
  return React.createElement('img', {
    key: item.id,
    src: item.src,
    width: Math.max(1, item.width * sx),
    height: Math.max(1, item.height * sy),
    style: {
      position: 'absolute',
      left: item.x * sx,
      top: item.y * sy,
      width: Math.max(1, item.width * sx),
      height: Math.max(1, item.height * sy),
      objectFit: 'cover',
      opacity: item.opacity,
      transform: `rotate(${item.rotation}deg)`,
      transformOrigin: 'center center',
      borderRadius: 24
    }
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
