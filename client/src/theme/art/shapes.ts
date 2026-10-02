import type { Ctx } from '../../core/node';
import { alpha, INK } from '../palette';

/** 插画的基础笔法：圆角矩形、椭圆、木刻排线、光晕、四角星、弯月、折线、固定种子随机数 */

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}

/** 椭圆路径（用缩放的圆实现，不依赖 ctx.ellipse） */
export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(Math.max(rx, 0.01), Math.max(ry, 0.01));
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.restore();
}

export function fillEllipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number, color: string): void {
  ellipse(ctx, x, y, rx, ry, rot);
  ctx.fillStyle = color;
  ctx.fill();
}

export function circle(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(r, 0.01), 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/** 木刻排线：在 (x,y,w,h) 范围内画一组平行线。调用方先 clip 到想要的形状。 */
export function hatch(ctx: Ctx, x: number, y: number, w: number, h: number, angle: number, gap: number, color: string, lw: number): void {
  if (gap <= 0.5) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  const d = Math.hypot(w, h);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  for (let o = -d; o <= d; o += gap) {
    ctx.moveTo(cx - ca * d - sa * o, cy - sa * d + ca * o);
    ctx.lineTo(cx + ca * d - sa * o, cy + sa * d + ca * o);
  }
  ctx.stroke();
  ctx.restore();
}

export function glow(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, alpha(INK.black, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function star4(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

/**
 * 弯月：半径 r 的圆，被圆心偏移 (dx,dy)、半径 0.88r 的圆挖掉一块。
 * 用两段圆弧拼出轮廓（不依赖 evenodd 填充规则，小游戏画布也能用）。
 */
export function crescent(ctx: Ctx, x: number, y: number, r: number, dx: number, dy: number, color: string): void {
  const r2 = r * 0.88;
  const d = Math.hypot(dx, dy);
  if (d < 0.01) return;
  const base = Math.atan2(dy, dx);
  const a = (r * r - r2 * r2 + d * d) / (2 * d);
  const t = Math.acos(Math.max(-1, Math.min(1, a / r)));
  const cx = x + dx;
  const cy = y + dy;
  const p1x = x + r * Math.cos(base + t);
  const p1y = y + r * Math.sin(base + t);
  const p2x = x + r * Math.cos(base - t);
  const p2y = y + r * Math.sin(base - t);
  ctx.beginPath();
  ctx.arc(x, y, r, base + t, base - t + Math.PI * 2);
  ctx.arc(cx, cy, r2, Math.atan2(p2y - cy, p2x - cx), Math.atan2(p1y - cy, p1x - cx), true);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function polyline(ctx: Ctx, pts: [number, number][], lw: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.stroke();
}

export function polygon(ctx: Ctx, pts: [number, number][], color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fill();
}

/** 固定种子的随机数（星星、房屋位置每次画出来都一样） */
export function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
