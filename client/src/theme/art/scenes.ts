import type { Ctx } from '../../core/node';
import { alpha, C, INK } from '../palette';
import { circle, glow, hatch, seeded, star4 } from './shapes';

/** 整屏背景。都在 (0,0)–(W,H) 里作画，由缓存层贴到屏幕上 */
export type Backdrop = 'home' | 'lobby' | 'table' | 'village' | 'witch';

/** 牌桌背景的月亮位置（夜晚时在这里加亮） */
export const tableMoon = (W: number, H: number): { x: number; y: number; r: number } => ({ x: W - 60, y: H * 0.16, r: 22 });

function sky(ctx: Ctx, W: number, H: number, stops: [number, string][]): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (const [at, color] of stops) g.addColorStop(at, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function stars(ctx: Ctx, W: number, H: number, count: number, seed: number, maxY: number): void {
  const r = seeded(seed);
  ctx.fillStyle = INK.white;
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.3 + r() * 0.7;
    ctx.beginPath();
    ctx.arc(r() * W, r() * H * maxY, 0.4 + r() * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 满月：光晕、月面、陨石坑、半边排线阴影 */
function moon(ctx: Ctx, x: number, y: number, r: number, face: string, halo: string, crater: string): void {
  glow(ctx, x, y, r * 3.2, halo);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = face;
  ctx.fill();
  ctx.clip();
  for (const [dx, dy, cr] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.4, 0.12], [0.35, -0.35, 0.09]]) circle(ctx, x + dx * r, y + dy * r, cr * r, crater);
  hatch(ctx, x - r, y - r, r * 0.9, r * 2, -1, 3, alpha(INK.sepia, 0.25), 0.8);
  ctx.restore();
}

function hills(ctx: Ctx, W: number, H: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, y);
  for (let x = 0; x <= W; x += 10) ctx.lineTo(x, y - Math.sin(x / 45) * 10 - Math.sin(x / 17) * 4 - (x < 110 ? (110 - x) * 0.35 : 0));
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
}

/** 远处山坡上的绞刑架；baseY 是地面，k 是缩放 */
function gallows(ctx: Ctx, x: number, baseY: number, k: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 4 * k;
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, baseY - 60 * k);
  ctx.lineTo(x + 38 * k, baseY - 60 * k);
  ctx.moveTo(x, baseY - 45 * k);
  ctx.lineTo(x + 15 * k, baseY - 60 * k);
  ctx.stroke();
  ctx.lineWidth = 1.4 * k;
  ctx.beginPath();
  ctx.moveTo(x + 32 * k, baseY - 60 * k);
  ctx.lineTo(x + 32 * k, baseY - 39 * k);
  ctx.stroke();
  ctx.save();
  ctx.translate(x + 32 * k, baseY - 34 * k);
  ctx.scale(3.5 * k, 5 * k);
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.restore();
  ctx.stroke();
}

/** 小镇剪影：一排尖顶房子和一座教堂；lit 为 null 时不画亮着的窗户 */
function town(ctx: Ctx, W: number, base: number, color: string, lit: string | null, seed: number): void {
  const r = seeded(seed);
  const windows: [number, number, number, number][] = [];
  ctx.fillStyle = color;
  let x = -10;
  let church = false;
  while (x < W) {
    const w = 34 + r() * 30;
    const h = 26 + r() * 30;
    if (!church && x > W * 0.5) {
      church = true;
      const cw = 40;
      const ch = 54;
      ctx.fillRect(x, base - ch, cw, ch);
      ctx.beginPath();
      ctx.moveTo(x - 3, base - ch);
      ctx.lineTo(x + cw / 2, base - ch - 18);
      ctx.lineTo(x + cw + 3, base - ch);
      ctx.fill();
      ctx.fillRect(x + cw / 2 - 8, base - ch - 40, 16, 30);
      ctx.beginPath();
      ctx.moveTo(x + cw / 2 - 10, base - ch - 40);
      ctx.lineTo(x + cw / 2, base - ch - 82);
      ctx.lineTo(x + cw / 2 + 10, base - ch - 40);
      ctx.fill();
      ctx.fillRect(x + cw / 2 - 0.8, base - ch - 94, 1.6, 14);
      ctx.fillRect(x + cw / 2 - 5, base - ch - 89, 10, 1.6);
      windows.push([x + cw / 2 - 3, base - ch - 32, 6, 9]);
      x += cw + 4;
      continue;
    }
    ctx.fillRect(x, base - h, w, h);
    ctx.beginPath();
    ctx.moveTo(x - 4, base - h);
    ctx.lineTo(x + w / 2, base - h - 16 - r() * 10);
    ctx.lineTo(x + w + 4, base - h);
    ctx.fill();
    if (r() > 0.4) ctx.fillRect(x + w * 0.7, base - h - 20, 6, 14);
    if (r() > 0.35) windows.push([x + w * (0.2 + r() * 0.45), base - h + 8 + r() * (h - 18), 5, 7]);
    x += w + 2 + r() * 6;
  }
  if (!lit) return;
  for (const [lx, ly, lw, lh] of windows) {
    glow(ctx, lx + lw / 2, ly + lh / 2, 14, alpha(lit, 0.35));
    ctx.fillStyle = lit;
    ctx.fillRect(lx, ly, lw, lh);
  }
}

function fog(ctx: Ctx, W: number, y: number, color: string, strength: number, count: number, radius: number): void {
  for (let i = 0; i < count; i++) {
    const fx = (W * i) / Math.max(1, count - 1);
    const g = ctx.createRadialGradient(fx, y, 0, fx, y, radius);
    g.addColorStop(0, alpha(color, strength));
    g.addColorStop(1, alpha(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(fx - radius, y - radius, radius * 2, radius * 2);
  }
}

/** 首页：小镇夜景（月亮、星空、远山上的绞刑架、小镇、教堂、雾） */
function homeScene(ctx: Ctx, W: number, H: number): void {
  sky(ctx, W, H, [[0, C.skyTop], [0.55, C.skyMid], [1, C.skyBottom]]);
  stars(ctx, W, H, 110, 1692, 0.6);
  star4(ctx, W * 0.19, H * 0.12, 6, alpha(INK.white, 0.9));
  star4(ctx, W * 0.84, H * 0.42, 4, alpha(INK.white, 0.7));
  moon(ctx, W * 0.82, H * 0.2, W * 0.1, C.moon, alpha(C.moon, 0.22), alpha(INK.straw, 0.35));
  hills(ctx, W, H, H * 0.62, INK.townFar);
  gallows(ctx, 40, H * 0.56, 1, INK.inkSoft);
  fog(ctx, W, H * 0.66, INK.lilac, 0.12, 4, 90);
  const base = H * 0.74;
  town(ctx, W, base, INK.townNear, C.gold, 7);
  ctx.fillStyle = INK.ground;
  ctx.fillRect(0, base, W, H - base);
  fog(ctx, W, base + 4, INK.lilac, 0.16, 5, 110);
}

/** 牌桌：星空、小弯月，底部一条压暗的小镇剪影，不抢牌桌视线 */
function tableScene(ctx: Ctx, W: number, H: number): void {
  sky(ctx, W, H, [[0, C.skyTop], [0.55, C.skyMid], [1, C.skyBottom]]);
  stars(ctx, W, H, 50, 1692, 0.5);
  const m = tableMoon(W, H);
  glow(ctx, m.x, m.y, m.r * 3, alpha(C.moon, 0.15));
  circle(ctx, m.x, m.y, m.r, alpha(C.moon, 0.85));
  circle(ctx, m.x + 9, m.y - 7, m.r * 0.9, C.skyTop);
  ctx.globalAlpha = 0.55;
  town(ctx, W, H, INK.townNear, null, 7);
  ctx.globalAlpha = 1;
}

/** 村民胜利：黎明，太阳从小镇后升起，雾散开 */
function villageScene(ctx: Ctx, W: number, H: number): void {
  sky(ctx, W, H, [[0, INK.dawnTop], [0.5, INK.dawnMid], [0.75, INK.dawnLow], [1, INK.dawnLow]]);
  stars(ctx, W, H, 20, 1693, 0.25);
  const base = H * 0.78;
  glow(ctx, W * 0.5, base, W * 0.7, alpha(INK.sun, 0.45));
  circle(ctx, W * 0.5, base, W * 0.16, INK.sun);
  hills(ctx, W, H, H * 0.7, alpha(INK.townFar, 0.8));
  town(ctx, W, base, INK.townNear, C.gold, 7);
  ctx.fillStyle = INK.ground;
  ctx.fillRect(0, base, W, H - base);
  fog(ctx, W, base + 10, INK.dawnLow, 0.12, 5, 90);
}

/** 女巫胜利：血月，天空发红，绞刑架更显眼 */
function witchScene(ctx: Ctx, W: number, H: number): void {
  sky(ctx, W, H, [[0, INK.bloodTop], [0.55, INK.bloodMid], [1, INK.ink]]);
  stars(ctx, W, H, 60, 1694, 0.5);
  moon(ctx, W * 0.82, H * 0.14, W * 0.1, INK.bloodMoon, alpha(C.danger, 0.45), alpha(INK.wineDark, 0.5));
  hills(ctx, W, H, H * 0.64, INK.bloodTop);
  gallows(ctx, W * 0.12, H * 0.6, 1.6, INK.ink);
  const base = H * 0.76;
  town(ctx, W, base, INK.ink, C.danger, 9);
  ctx.fillStyle = INK.ink;
  ctx.fillRect(0, base, W, H - base);
  fog(ctx, W, base + 4, C.danger, 0.12, 5, 110);
}

export function paintBackdrop(ctx: Ctx, W: number, H: number, which: Backdrop): void {
  switch (which) {
    case 'home':
      homeScene(ctx, W, H);
      return;
    case 'lobby':
      homeScene(ctx, W, H);
      ctx.fillStyle = alpha(INK.ink, 0.45);
      ctx.fillRect(0, 0, W, H);
      return;
    case 'table':
      tableScene(ctx, W, H);
      return;
    case 'village':
      villageScene(ctx, W, H);
      return;
    case 'witch':
      witchScene(ctx, W, H);
      return;
  }
}
