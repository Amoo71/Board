import * as React from 'react';
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { readBoard } from '@/lib/storage';
import type { BoardImageItem, BoardItem, BoardPathItem, BoardTextItem } from '@/lib/board';
import { pointsToPath } from '@/lib/paths';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const width = clamp(Number(searchParams.get('w')) || 1092, 300, 2400);
  const height = clamp(Number(searchParams.get('h')) || 510, 300, 2400);
  const board = await readBoard();

  return new ImageResponse(
    React.createElement(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          background: 'radial-gradient(circle at 15% 0%, #273654 0%, #101827 46%, #05070b 100%)',
          color: '#f8fafc',
          fontFamily: 'Arial, sans-serif'
        }
      },
      React.createElement('div', {
        style: {
          position: 'absolute',
          inset: 18,
          borderRadius: 54,
          border: '2px solid rgba(255,255,255,.22)',
          background: 'linear-gradient(135deg, rgba(255,255,255,.14), rgba(255,255,255,.04))'
        }
      }),
      React.createElement(
        'div',
        {
          style: {
            position: 'absolute',
            left: 52,
            top: 44,
            fontSize: 24,
            letterSpacing: 1.6,
            color: 'rgba(255,255,255,.54)',
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
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 12,
                color: 'rgba(255,255,255,.35)',
                fontWeight: 800
              }
            },
            React.createElement('div', { style: { fontSize: 34 } }, 'Amo‘s Board'),
            React.createElement('div', { style: { fontSize: 18, color: 'rgba(255,255,255,.18)' } }, 'Text • Pen • Images • Eraser • Sync')
          )
        : board.items.map((item) => renderItem(item, board.width, board.height))
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

function renderItem(item: BoardItem, boardWidth: number, boardHeight: number): React.ReactElement {
  if (item.type === 'path') return renderPath(item, boardWidth, boardHeight);
  if (item.type === 'text') return renderText(item);
  return renderImage(item);
}

function renderPath(item: BoardPathItem, boardWidth: number, boardHeight: number): React.ReactElement {
  return React.createElement(
    'svg',
    {
      key: item.id,
      width: boardWidth,
      height: boardHeight,
      viewBox: `0 0 ${boardWidth} ${boardHeight}`,
      style: { position: 'absolute', inset: 0, width: '100%', height: '100%' }
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

function renderText(item: BoardTextItem): React.ReactElement {
  return React.createElement(
    'div',
    {
      key: item.id,
      style: {
        position: 'absolute',
        left: item.x,
        top: item.y,
        width: item.width,
        minHeight: item.height,
        color: item.color,
        opacity: item.opacity,
        fontSize: item.fontSize,
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

function renderImage(item: BoardImageItem): React.ReactElement {
  return React.createElement('img', {
    key: item.id,
    src: item.src,
    width: item.width,
    height: item.height,
    style: {
      position: 'absolute',
      left: item.x,
      top: item.y,
      width: item.width,
      height: item.height,
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
