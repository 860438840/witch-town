export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const rect = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export function contains(r: Rect, px: number, py: number): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function inset(r: Rect, d: number): Rect {
  return rect(r.x + d, r.y + d, r.w - 2 * d, r.h - 2 * d);
}
