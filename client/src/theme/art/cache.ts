import type { Ctx } from '../../core/node';

/** 一张隐藏画布 */
export interface Surface {
  canvas: CanvasImageSource;
  ctx: Ctx;
}

/** 按像素尺寸创建隐藏画布（小游戏里用 wx.createCanvas） */
export type SurfaceFactory = (pixelW: number, pixelH: number) => Surface;

/** 面积超过这个值（逻辑像素²）的图算大图，只保留最近用过的几张 */
const LARGE_AREA = 256 * 256;
const LARGE_KEEP = 2;

let factory: SurfaceFactory | null = null;
let ratio = 1;
const small = new Map<string, Surface>();
let large: { key: string; s: Surface }[] = [];

/** 设置隐藏画布的来源和屏幕像素比；不设置时每次直接画（测试、图鉴页的对照模式） */
export function setSurfaceFactory(f: SurfaceFactory | null, pixelRatio = 1): void {
  factory = f;
  ratio = pixelRatio;
  small.clear();
  large = [];
}

/**
 * 画一张可缓存的图：paint 在 (0,0)–(w,h) 的坐标里作画。
 * 同一个 key 和尺寸只画一次，之后直接贴到 (dx,dy)，贴图大小 dw×dh（翻转动画时 dw 会变窄）。
 */
export function blit(
  ctx: Ctx,
  key: string,
  w: number,
  h: number,
  paint: (c: Ctx, w: number, h: number) => void,
  dx: number,
  dy: number,
  dw = w,
  dh = h,
): void {
  if (w <= 0 || h <= 0 || dw <= 0 || dh <= 0) return;
  if (!factory) {
    ctx.save();
    ctx.translate(dx, dy);
    ctx.scale(dw / w, dh / h);
    paint(ctx, w, h);
    ctx.restore();
    return;
  }
  const k = `${key}@${Math.round(w)}x${Math.round(h)}`;
  let s = find(k);
  if (!s) {
    s = factory(Math.ceil(w * ratio), Math.ceil(h * ratio));
    s.ctx.scale(ratio, ratio);
    paint(s.ctx, w, h);
    keep(k, s, w * h);
  }
  ctx.drawImage(s.canvas, dx, dy, dw, dh);
}

function find(k: string): Surface | undefined {
  const hit = small.get(k);
  if (hit) return hit;
  const i = large.findIndex((e) => e.key === k);
  if (i < 0) return undefined;
  const [e] = large.splice(i, 1);
  large.push(e);
  return e.s;
}

function keep(k: string, s: Surface, area: number): void {
  if (area <= LARGE_AREA) {
    small.set(k, s);
    return;
  }
  large.push({ key: k, s });
  if (large.length > LARGE_KEEP) large.shift();
}
