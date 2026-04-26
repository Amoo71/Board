import type { Point } from '@/lib/board';

export function pointsToPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${round(points[0].x)} ${round(points[0].y)} L ${round(points[0].x + 0.01)} ${round(points[0].y + 0.01)}`;
  const [first, ...rest] = points;
  return [`M ${round(first.x)} ${round(first.y)}`, ...rest.map((p) => `L ${round(p.x)} ${round(p.y)}`)].join(' ');
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
