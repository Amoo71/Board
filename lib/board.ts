export type Point = { x: number; y: number };

export type BoardPathItem = {
  id: string;
  type: 'path';
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  tool: 'pen' | 'eraser';
};

export type BoardTextItem = {
  id: string;
  type: 'text';
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  opacity: number;
  rotation: number;
  width: number;
  height: number;
};

export type BoardImageItem = {
  id: string;
  type: 'image';
  x: number;
  y: number;
  src: string;
  width: number;
  height: number;
  opacity: number;
  rotation: number;
};

export type BoardItem = BoardPathItem | BoardTextItem | BoardImageItem;

export type BoardState = {
  version: 1;
  title: string;
  width: number;
  height: number;
  updatedAt: string;
  items: BoardItem[];
};

export const EMPTY_BOARD: BoardState = {
  version: 1,
  title: 'Amo‘s Board',
  width: 1440,
  height: 1000,
  updatedAt: new Date(0).toISOString(),
  items: []
};

export function sanitizeBoard(input: unknown): BoardState {
  const maybe = input as Partial<BoardState>;
  const items = Array.isArray(maybe.items) ? maybe.items : [];

  return {
    version: 1,
    title: typeof maybe.title === 'string' ? maybe.title.slice(0, 80) : EMPTY_BOARD.title,
    width: clampNumber(maybe.width, 600, 4000, EMPTY_BOARD.width),
    height: clampNumber(maybe.height, 400, 4000, EMPTY_BOARD.height),
    updatedAt: typeof maybe.updatedAt === 'string' ? maybe.updatedAt : new Date().toISOString(),
    items: items.map(sanitizeItem).filter(Boolean) as BoardItem[]
  };
}

function sanitizeItem(item: unknown): BoardItem | null {
  const v = item as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.type !== 'string') return null;

  if (v.type === 'path') {
    const points = Array.isArray(v.points)
      ? v.points.map((p) => {
          const q = p as Record<string, unknown>;
          return { x: clampNumber(q.x, -10000, 10000, 0), y: clampNumber(q.y, -10000, 10000, 0) };
        }).slice(0, 6000)
      : [];
    if (points.length < 1) return null;
    return {
      id: v.id.slice(0, 80),
      type: 'path',
      points,
      color: sanitizeColor(v.color, '#f8fafc'),
      width: clampNumber(v.width, 1, 120, 8),
      opacity: clampNumber(v.opacity, 0.05, 1, 1),
      tool: v.tool === 'eraser' ? 'eraser' : 'pen'
    };
  }

  if (v.type === 'text') {
    return {
      id: v.id.slice(0, 80),
      type: 'text',
      x: clampNumber(v.x, -10000, 10000, 120),
      y: clampNumber(v.y, -10000, 10000, 120),
      text: typeof v.text === 'string' ? v.text.slice(0, 2000) : 'Text',
      color: sanitizeColor(v.color, '#f8fafc'),
      fontSize: clampNumber(v.fontSize, 10, 160, 42),
      opacity: clampNumber(v.opacity, 0.05, 1, 1),
      rotation: clampNumber(v.rotation, -360, 360, 0),
      width: clampNumber(v.width, 20, 2000, 320),
      height: clampNumber(v.height, 20, 1200, 80)
    };
  }

  if (v.type === 'image') {
    const src = typeof v.src === 'string' ? v.src : '';
    if (!src.startsWith('http') && !src.startsWith('data:image/')) return null;
    return {
      id: v.id.slice(0, 80),
      type: 'image',
      x: clampNumber(v.x, -10000, 10000, 120),
      y: clampNumber(v.y, -10000, 10000, 120),
      src: src.slice(0, 3000000),
      width: clampNumber(v.width, 20, 2500, 360),
      height: clampNumber(v.height, 20, 2500, 260),
      opacity: clampNumber(v.opacity, 0.05, 1, 1),
      rotation: clampNumber(v.rotation, -360, 360, 0)
    };
  }

  return null;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return value;
  if (/^rgba?\([0-9.,%\s]+\)$/i.test(value)) return value;
  return fallback;
}
