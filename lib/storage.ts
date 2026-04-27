import { Redis } from '@upstash/redis';
import { BoardState, EMPTY_BOARD, sanitizeBoard } from '@/lib/board';

const KEY = process.env.BOARD_KEY || 'amos-board:state';

declare global {
  // eslint-disable-next-line no-var
  var __amosBoardMemory: BoardState | undefined;
}

function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return { url, token };
}

function getRedis(): Redis | null {
  const { url, token } = redisConfig();
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function getStorageMode() {
  const { url, token } = redisConfig();
  return {
    mode: url && token ? 'redis' : 'memory',
    persistent: Boolean(url && token),
    key: KEY
  };
}

export async function readBoard(): Promise<BoardState> {
  const redis = getRedis();
  const board = redis ? await redis.get<BoardState>(KEY) : globalThis.__amosBoardMemory ?? null;
  return sanitizeBoard(board ?? EMPTY_BOARD);
}

export async function writeBoard(input: unknown): Promise<BoardState> {
  const board = sanitizeBoard({ ...(input as object), updatedAt: new Date().toISOString() });
  const redis = getRedis();
  if (redis) await redis.set(KEY, board);
  else globalThis.__amosBoardMemory = board;
  return board;
}

export async function resetBoard(): Promise<BoardState> {
  const board = { ...EMPTY_BOARD, updatedAt: new Date().toISOString() } satisfies BoardState;
  const redis = getRedis();
  if (redis) await redis.set(KEY, board);
  else globalThis.__amosBoardMemory = board;
  return board;
}

export function isWriteAllowed(authorizationHeader: string | null): boolean {
  const token = process.env.BOARD_WRITE_TOKEN;
  if (!token) return true;
  return (authorizationHeader || '') === `Bearer ${token}`;
}
