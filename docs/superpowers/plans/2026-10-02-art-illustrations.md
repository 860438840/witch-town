# 美化 B：代码绘制插画 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Canvas 代码画出全部卡牌、身份、角色、场景插画，并替换游戏里所有对应位置的色块和文字。

**Architecture:** 新增 `client/src/theme/art/`（基础笔法、图标、卡框模板、场景、隐藏画布缓存）。`client/src/theme/draw.ts` 里现有的公共绘制函数保持名字和用法，内部改为调用美术代码，并通过缓存层「画一次、之后贴图」。小游戏里用 `wx.createCanvas()` 作为隐藏画布；测试里不设置隐藏画布，直接画到假画布上。

**Tech Stack:** TypeScript、Canvas 2D、vitest、esbuild（与现有客户端相同）。

**Spec:** `docs/superpowers/specs/2026-10-01-art-design.md`（画风以 `docs/superpowers/specs/assets/2026-10-01-art-prototype.html` 为准）

## Global Constraints

- 颜色只能来自 `client/src/theme/palette.ts`（`C`、`INK`、`FRAME_GRADIENT`、`CARD_GRADIENT`、`alpha()`），美术文件里不写颜色字面量。
- 不使用 `fill('evenodd')` 和 `ctx.ellipse`：椭圆用 `shapes.ts` 的 `ellipse`/`fillEllipse`，弯月用 `crescent`。小游戏画布对它们的支持不可靠。
- 卡名、角色名用 `titleFont()`（系统衬线体），正文继续用 `font()`。
- 不改引擎、服务器、规则；只改 `client/`、`docs/`、`.gitignore`。
- 小游戏包 `minigame/game.js` 增长不超过 100KB（基线 115344 字节）。
- 小屏 320×568 下所有面板不重叠、按钮在屏幕内（现有布局测试必须继续通过）。
- 每个任务结束时：`cd client && npx vitest run && npm run typecheck` 全部通过。提交信息结尾加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Review Focus

1. **隐藏画布的像素比**：缓存图在高分屏上必须按 `pixelRatio` 放大绘制，否则会糊。测试：缓存创建的画布尺寸 = 逻辑尺寸 × 像素比（Task 1）。
2. **大图缓存不能无限增长**：整屏背景每张几 MB，最多保留 2 张。测试：画第 3 张不同背景后，再画第 1 张会重新创建（Task 1）。
3. **翻牌动画**：身份卡翻转时横向缩放，缓存的图要按缩放后的宽度贴，不能每帧重画新尺寸。测试：同一张卡不同 scaleX 只创建一次（Task 4）。
4. **很小的身份卡**（格子里 8×11）不能走图标画法，要保持颜色区分。测试：宽度 < 16 不创建隐藏画布（Task 4）。
5. **选角色面板在小屏放得下**：角色卡按 2:3 缩放后确认按钮仍在屏幕内（沿用现有测试，Task 5）。

## 裁定（与设计文档不同之处，Task 6 同步回设计文档）

- 设计文档 §4「我的身份卡面板：未翻开的显示卡背」——改为**全部显示卡面**（自己的身份卡自己本来就看得到，显示卡背反而丢信息），已翻开的照旧标「·已翻开」。
- 设计文档 §4「格子里面前的牌：10 像素小图标」——改为 **10×14 的迷你卡面**：试画发现单独的剪影图标在暗底上看不清，带底色的迷你卡能看清颜色。

---

### Task 1: 美术基础：调色板、基础笔法、隐藏画布缓存

**Files:**
- Modify: `client/src/theme/palette.ts`（末尾追加）
- Create: `client/src/theme/art/shapes.ts`
- Create: `client/src/theme/art/cache.ts`
- Modify: `client/src/platform.ts`、`client/src/main.ts`、`client/src/wx.d.ts`（不需要改，`createCanvas` 已声明）
- Modify: `client/test/fakes.ts`（加假隐藏画布）
- Create: `client/test/art.test.ts`

**Interfaces:**
- Produces: `INK`、`FRAME_GRADIENT`、`alpha(hex, a)`、`titleFont(size)`（palette）；`rr / ellipse / fillEllipse / circle / hatch / glow / star4 / crescent / polyline / polygon / seeded`（shapes）；`Surface`、`SurfaceFactory`、`setSurfaceFactory(f, pixelRatio)`、`blit(ctx, key, w, h, paint, dx, dy, dw?, dh?)`（cache）；`createPlatform()` 多返回 `dpr`；测试用 `fakeSurfaces()`。

- [ ] **Step 1: 写失败的测试**

在 `client/test/fakes.ts` 末尾追加：

```ts
/** 假的隐藏画布工厂：记录每次创建的像素尺寸，画布上下文是 fakeCtx */
export function fakeSurfaces(): { factory: (w: number, h: number) => { canvas: CanvasImageSource; ctx: Ctx }; created: [number, number][] } {
  const created: [number, number][] = [];
  return {
    created,
    factory: (w, h) => {
      created.push([w, h]);
      return { canvas: {} as CanvasImageSource, ctx: fakeCtx().ctx };
    },
  };
}
```

创建 `client/test/art.test.ts`：

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blit, setSurfaceFactory } from '../src/theme/art/cache';
import { crescent, ellipse, hatch, seeded } from '../src/theme/art/shapes';
import { alpha } from '../src/theme/palette';
import { fakeCtx, fakeSurfaces } from './fakes';

afterEach(() => setSurfaceFactory(null));

describe('基础笔法', () => {
  it('alpha 把 #rrggbb 转成 rgba', () => {
    expect(alpha('#e8c774', 0.5)).toBe('rgba(232,199,116,0.5)');
  });
  it('固定种子的随机数每次一样', () => {
    const a = seeded(3);
    const b = seeded(3);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('弯月、椭圆、排线在假画布上能画完', () => {
    const { ctx } = fakeCtx();
    expect(() => {
      crescent(ctx, 50, 50, 20, 8, -4, '#fff');
      ellipse(ctx, 10, 10, 5, 3, 0.4);
      hatch(ctx, 0, 0, 40, 40, 0.7, 3, '#000', 1);
    }).not.toThrow();
  });
});

describe('隐藏画布缓存', () => {
  it('没有设置隐藏画布时每次直接画', () => {
    const paint = vi.fn();
    const { ctx } = fakeCtx();
    blit(ctx, 'x', 10, 10, paint, 0, 0);
    blit(ctx, 'x', 10, 10, paint, 0, 0);
    expect(paint).toHaveBeenCalledTimes(2);
  });

  it('同一个 key 和尺寸只画一次；画布按像素比放大', () => {
    const { factory, created } = fakeSurfaces();
    setSurfaceFactory(factory, 3);
    const paint = vi.fn();
    const { ctx } = fakeCtx();
    blit(ctx, 'card:night', 58, 84, paint, 0, 0);
    blit(ctx, 'card:night', 58, 84, paint, 100, 0);
    expect(paint).toHaveBeenCalledTimes(1);
    expect(created).toEqual([[174, 252]]);
    blit(ctx, 'card:night', 44, 64, paint, 0, 0);
    expect(paint).toHaveBeenCalledTimes(2);
  });

  it('贴图宽度变化（翻牌动画）不重新画', () => {
    const { factory, created } = fakeSurfaces();
    setSurfaceFactory(factory, 2);
    const { ctx } = fakeCtx();
    for (const dw of [52, 30, 5]) blit(ctx, 'back', 52, 68, () => {}, 0, 0, dw, 68);
    expect(created).toHaveLength(1);
  });

  it('大图最多保留 2 张：画第 3 张后第 1 张要重画', () => {
    const { factory, created } = fakeSurfaces();
    setSurfaceFactory(factory, 1);
    const { ctx } = fakeCtx();
    for (const k of ['a', 'b', 'c', 'a']) blit(ctx, k, 375, 667, () => {}, 0, 0);
    expect(created).toHaveLength(4);
    blit(ctx, 'a', 375, 667, () => {}, 0, 0);
    expect(created).toHaveLength(4);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd client && npx vitest run test/art.test.ts`
Expected: FAIL（找不到 `../src/theme/art/cache` 等模块，`alpha` 不存在）

- [ ] **Step 3: 实现**

在 `client/src/theme/palette.ts` 末尾追加：

```ts

/** 插画用色（剪影、羊皮纸、火焰、植物等），与上面的界面色同属一套调色板 */
export const INK = {
  ink: '#0d0a14',
  inkSoft: '#120c1c',
  townFar: '#251a3a',
  townNear: '#0f0a18',
  ground: '#0b0811',
  parchment: '#e3d3a8',
  parchmentDark: '#cdb98a',
  sepia: '#5a4020',
  sepiaDark: '#3a2614',
  brown: '#2b1d12',
  wood: '#3a2614',
  straw: '#b8913e',
  steel: '#cfc6dc',
  iron: '#9b93ad',
  wax: '#8e1a2c',
  wine: '#7a1428',
  wineDark: '#5a1020',
  leaf: '#3f6b4f',
  flameCore: '#fff1c4',
  lilac: '#bfb2d6',
  lilacText: '#d8cce8',
  portraitTop: '#5a4585',
  portraitBottom: '#241a38',
  backTop: '#2a1d44',
  backBottom: '#120c1e',
  poison: '#5d8a4a',
  poisonLight: '#a8d08d',
  dawnTop: '#4a3a6c',
  dawnMid: '#c97b4a',
  dawnLow: '#f0c27a',
  sun: '#ffd98a',
  bloodTop: '#2a0710',
  bloodMid: '#5a0f1c',
  bloodMoon: '#c0283a',
  white: '#ffffff',
  black: '#000000',
} as const;

/** 身份卡、角色卡的底色（上、下） */
export const FRAME_GRADIENT = {
  witch: ['#6e1424', '#2a0710'],
  constable: ['#6b5320', '#2e220a'],
  villager: ['#4a4560', '#221f30'],
  character: ['#3a2a5c', '#1a1326'],
  back: ['#2a1d44', '#120c1e'],
} as const satisfies Record<string, readonly [string, string]>;

/** 把 #rrggbb 转成带透明度的 rgba() */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** 卡名、角色名用的衬线字体（手机自带） */
export const titleFont = (size: number): string => `bold ${size}px serif`;
```

创建 `client/src/theme/art/shapes.ts`：

```ts
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
```

创建 `client/src/theme/art/cache.ts`：

```ts
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
```

`client/src/platform.ts`：`createPlatform` 返回值加上 `dpr`，并新增隐藏画布工厂：

```ts
import type { SurfaceFactory } from './theme/art/cache';

/** 创建全屏画布，按像素比缩放，计算内容区（避开右上角胶囊按钮和底部安全区） */
export function createPlatform(): { ctx: Ctx; screen: Screen; dpr: number } {
  // …原有代码不变…
  return { ctx, screen: { W: info.windowWidth, H: info.windowHeight, top, bottom }, dpr };
}

/** 隐藏画布：小游戏里第一次 createCanvas 是屏幕画布，之后创建的都是离屏画布 */
export const wxSurfaces: SurfaceFactory = (w, h) => {
  const canvas = wx.createCanvas();
  canvas.width = w;
  canvas.height = h;
  return { canvas: canvas as unknown as CanvasImageSource, ctx: canvas.getContext('2d') };
};
```

`client/src/main.ts`：

```ts
import { bindTouches, createPlatform, wxSurfaces } from './platform';
import { setSurfaceFactory } from './theme/art/cache';
// …
const { ctx, screen, dpr } = createPlatform();
setSurfaceFactory(wxSurfaces, dpr);
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd client && npx vitest run && npm run typecheck`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add client/src/theme/palette.ts client/src/theme/art client/src/platform.ts client/src/main.ts client/test/fakes.ts client/test/art.test.ts
git commit -m "feat(client): art foundation — ink palette, drawing primitives, offscreen surface cache

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 图标和卡框模板

**Files:**
- Create: `client/src/theme/art/icons.ts`
- Create: `client/src/theme/art/frames.ts`
- Modify: `client/test/art.test.ts`（追加）

**Interfaces:**
- Consumes: Task 1 的 shapes / palette。
- Produces: `IconFn`、`CARD_ICONS: Record<CardKind, IconFn>`、`TRYAL_ICONS: Record<TryalKind, IconFn>`、`CHAR_ICONS: Record<CharacterId, IconFn>`；`cardFace(ctx,w,h,kind)`、`cardBack(ctx,w,h)`、`tryalFace(ctx,w,h,kind)`、`portrait(ctx,size,id,ring)`、`charCard(ctx,w,h,id)`、`miniIcon(ctx,size,kind)`、`miniCharIcon(ctx,size,id)`。都在 (0,0)–(w,h) 里作画。

- [ ] **Step 1: 写失败的测试**

在 `client/test/art.test.ts` 追加：

```ts
import { CHARACTERS, type CardKind, type TryalKind } from '../../engine/src/index';
import { CARD_INFO } from '../src/model/cards';
import { CHAR_INFO } from '../src/model/characters';
import { cardBack, cardFace, charCard, portrait, tryalFace } from '../src/theme/art/frames';
import { CARD_ICONS, CHAR_ICONS, TRYAL_ICONS } from '../src/theme/art/icons';

const KINDS = Object.keys(CARD_INFO) as CardKind[];
const TRYALS: TryalKind[] = ['witch', 'constable', 'villager'];

describe('图标', () => {
  it('每种牌、身份、角色都有图标', () => {
    expect(Object.keys(CARD_ICONS).sort()).toEqual([...KINDS].sort());
    expect(Object.keys(TRYAL_ICONS).sort()).toEqual([...TRYALS].sort());
    expect(Object.keys(CHAR_ICONS).sort()).toEqual([...CHARACTERS].sort());
  });

  it('所有图标在各种尺寸下都能画完', () => {
    const { ctx } = fakeCtx();
    for (const s of [10, 40, 120]) {
      for (const f of [...Object.values(CARD_ICONS), ...Object.values(TRYAL_ICONS), ...Object.values(CHAR_ICONS)]) {
        expect(() => f(ctx, s / 2, s / 2, s)).not.toThrow();
      }
    }
  });
});

describe('卡框模板', () => {
  it('大卡面写牌名，迷你卡面（宽 < 40）不写字', () => {
    const big = fakeCtx();
    cardFace(big.ctx, 120, 168, 'blackCat');
    expect(big.texts).toContain('黑猫');
    const tiny = fakeCtx();
    cardFace(tiny.ctx, 28, 40, 'blackCat');
    expect(tiny.texts).toEqual([]);
  });

  it('红卡带点数，其他颜色不带', () => {
    const w = fakeCtx();
    cardFace(w.ctx, 58, 84, 'witness');
    expect(w.texts).toEqual(['目击', '7']);
    const b = fakeCtx();
    cardFace(b.ctx, 58, 84, 'asylum');
    expect(b.texts).toEqual(['避难']);
  });

  it('卡背、身份卡面、头像能画完', () => {
    const { ctx, texts } = fakeCtx();
    cardBack(ctx, 52, 68);
    cardBack(ctx, 14, 19);
    for (const t of TRYALS) tryalFace(ctx, 52, 68, t);
    for (const id of CHARACTERS) portrait(ctx, 24, id, '#8e3b5a');
    expect(texts).toEqual(['女巫', '警长', '村民']);
  });

  it('角色卡写名字、技能说明；限次角色有「限 n 次」', () => {
    const p = fakeCtx();
    charCard(p.ctx, 160, 240, 'priest');
    const text = p.texts.join('');
    expect(text).toContain('牧师');
    expect(text).toContain('弃牌堆');
    expect(text).toContain('限 2 次');
    const j = fakeCtx();
    charCard(j.ctx, 160, 240, 'judge');
    expect(j.texts.join('')).not.toContain('限');
    expect(j.texts[0]).toBe(CHAR_INFO.judge.name);
  });
});
```

（把这几个 import 合并到文件顶部的 import 区。）

- [ ] **Step 2: 跑测试确认失败**

Run: `cd client && npx vitest run test/art.test.ts`
Expected: FAIL（找不到 `../src/theme/art/frames`、`icons`）

- [ ] **Step 3: 实现**

创建 `client/src/theme/art/icons.ts`（黑猫、夜晚、指控、证据、目击、纵火、三种身份、15 个角色照搬试验品；情侣、避难、信徒、嫁祸、抢劫、诅咒、拘留、辩护、传染是新画的，已在浏览器里渲染检查过）：

```ts
import type { CardKind, CharacterId, TryalKind } from '../../../../engine/src/index';
import type { Ctx } from '../../core/node';
import { alpha, C, FRAME_GRADIENT, INK, titleFont } from '../palette';
import { circle, crescent, fillEllipse, glow, hatch, polygon, polyline, rr, seeded, star4 } from './shapes';

/** 一个图标：以 (cx, cy) 为中心、边长 s 的方框内作画 */
export type IconFn = (ctx: Ctx, cx: number, cy: number, s: number) => void;

/* ---------------------------------------------------------------- 卡牌 */

const blackCat: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy - s * 0.05, s * 0.45, alpha(C.moon, 0.25));
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.05, s * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = C.moon;
  ctx.fill();
  ctx.clip();
  hatch(ctx, cx - s * 0.3, cy - s * 0.35, s * 0.25, s * 0.6, -0.9, s * 0.03, alpha(INK.sepia, 0.35), s * 0.008);
  ctx.restore();
  fillEllipse(ctx, cx, cy + s * 0.14, s * 0.15, s * 0.19, 0, INK.ink);
  circle(ctx, cx + s * 0.01, cy - s * 0.1, s * 0.095, INK.ink);
  polygon(ctx, [[cx - s * 0.085, cy - s * 0.13], [cx - s * 0.07, cy - s * 0.25], [cx - s * 0.01, cy - s * 0.18]], INK.ink);
  polygon(ctx, [[cx + s * 0.1, cy - s * 0.13], [cx + s * 0.09, cy - s * 0.25], [cx + s * 0.03, cy - s * 0.18]], INK.ink);
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = s * 0.045;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.12, cy + s * 0.3);
  ctx.bezierCurveTo(cx + s * 0.32, cy + s * 0.3, cx + s * 0.3, cy + s * 0.05, cx + s * 0.2, cy - s * 0.02);
  ctx.stroke();
  fillEllipse(ctx, cx - s * 0.03, cy - s * 0.1, s * 0.02, s * 0.011, -0.2, C.gold);
  fillEllipse(ctx, cx + s * 0.05, cy - s * 0.1, s * 0.02, s * 0.011, 0.2, C.gold);
  ctx.fillStyle = INK.ink;
  ctx.fillRect(cx - s * 0.4, cy + s * 0.32, s * 0.8, s * 0.2);
};

const night: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.gold, 0.18));
  crescent(ctx, cx - s * 0.03, cy - s * 0.02, s * 0.26, s * 0.12, -s * 0.07, C.moon);
  const r = seeded(7);
  for (let i = 0; i < 9; i++) star4(ctx, cx + (r() - 0.5) * s * 0.8, cy + (r() - 0.5) * s * 0.8, s * (0.015 + r() * 0.025), alpha(INK.white, 0.85));
  for (let i = 0; i < 3; i++) fillEllipse(ctx, cx + (i - 1) * s * 0.2, cy + s * 0.3 + i * s * 0.03, s * 0.28, s * 0.04, 0, alpha(INK.lilac, 0.18));
};

const accusation: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.42, alpha(C.gold, 0.12));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.7);
  ctx.fillStyle = INK.parchment;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.3);
  ctx.bezierCurveTo(-s * 0.13, s * 0.1, -s * 0.12, -s * 0.2, s * 0.02, -s * 0.36);
  ctx.bezierCurveTo(s * 0.08, -s * 0.15, s * 0.06, s * 0.1, 0, s * 0.3);
  ctx.fill();
  ctx.save();
  ctx.clip();
  hatch(ctx, -s * 0.15, -s * 0.4, s * 0.3, s * 0.7, 0.9, s * 0.028, alpha(INK.sepia, 0.45), s * 0.007);
  ctx.restore();
  polyline(ctx, [[0, s * 0.42], [-s * 0.005, s * 0.1], [s * 0.02, -s * 0.34]], s * 0.012, INK.sepia);
  polygon(ctx, [[-s * 0.015, s * 0.38], [s * 0.015, s * 0.38], [0, s * 0.46]], INK.ink);
  ctx.restore();
  for (const [dx, dy, r] of [[-0.24, 0.3, 0.03], [-0.17, 0.34, 0.018], [-0.29, 0.25, 0.014]]) circle(ctx, cx + dx * s, cy + dy * s, r * s, INK.ink);
};

const evidence: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.gold, 0.15));
  const w = s * 0.42;
  const h = s * 0.56;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.fillStyle = INK.parchment;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  hatch(ctx, x, y, w, h, 0.8, s * 0.035, alpha(INK.sepia, 0.18), s * 0.006);
  ctx.restore();
  ctx.fillStyle = INK.parchmentDark;
  rr(ctx, x - s * 0.03, y - s * 0.04, w + s * 0.06, s * 0.07, s * 0.035);
  ctx.fill();
  rr(ctx, x - s * 0.03, y + h - s * 0.03, w + s * 0.06, s * 0.07, s * 0.035);
  ctx.fill();
  ctx.strokeStyle = alpha(INK.sepiaDark, 0.7);
  ctx.lineWidth = s * 0.012;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ly = y + s * 0.09 + i * s * 0.065;
    const len = w * (i === 5 ? 0.45 : 0.75);
    ctx.moveTo(x + w * 0.12, ly);
    for (let t = 0; t <= len; t += s * 0.03) ctx.lineTo(x + w * 0.12 + t, ly + Math.sin((t * 40) / s + i) * s * 0.006);
  }
  ctx.stroke();
  circle(ctx, x + w * 0.78, y + h * 0.82, s * 0.07, INK.wax);
  star4(ctx, x + w * 0.78, y + h * 0.82, s * 0.04, alpha(C.cardText, 0.8));
};

const witness: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.5, alpha(C.moon, 0.35));
  ctx.strokeStyle = alpha(C.gold, 0.75);
  ctx.lineWidth = s * 0.014;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const t = (i * Math.PI) / 8;
    const r1 = s * 0.3;
    const r2 = s * (i % 2 ? 0.36 : 0.42);
    ctx.moveTo(cx + Math.cos(t) * r1, cy + Math.sin(t) * r1 * 0.8);
    ctx.lineTo(cx + Math.cos(t) * r2, cy + Math.sin(t) * r2 * 0.8);
  }
  ctx.stroke();
  const eye = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, cy);
    ctx.quadraticCurveTo(cx, cy - s * 0.26, cx + s * 0.3, cy);
    ctx.quadraticCurveTo(cx, cy + s * 0.26, cx - s * 0.3, cy);
    ctx.closePath();
  };
  eye();
  ctx.fillStyle = C.moon;
  ctx.fill();
  ctx.save();
  eye();
  ctx.clip();
  hatch(ctx, cx - s * 0.3, cy - s * 0.15, s * 0.6, s * 0.09, 0, s * 0.022, alpha(INK.sepia, 0.4), s * 0.006);
  const g = ctx.createRadialGradient(cx, cy, s * 0.02, cx, cy, s * 0.12);
  g.addColorStop(0, C.gold);
  g.addColorStop(1, INK.wine);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, cx, cy, s * 0.055, INK.ink);
  circle(ctx, cx + s * 0.035, cy - s * 0.035, s * 0.02, INK.white);
  ctx.restore();
  eye();
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = s * 0.022;
  ctx.stroke();
};

const arson: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy - s * 0.15, s * 0.5, alpha(C.goldLine, 0.35));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.18);
  ctx.fillStyle = INK.wood;
  ctx.beginPath();
  ctx.moveTo(-s * 0.045, -s * 0.02);
  ctx.lineTo(s * 0.045, -s * 0.02);
  ctx.lineTo(s * 0.03, s * 0.42);
  ctx.lineTo(-s * 0.03, s * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  hatch(ctx, -s * 0.05, -s * 0.02, s * 0.1, s * 0.44, 1.4, s * 0.03, alpha(INK.black, 0.4), s * 0.008);
  ctx.restore();
  ctx.fillStyle = C.goldDark;
  ctx.fillRect(-s * 0.06, -s * 0.02, s * 0.12, s * 0.04);
  ctx.fillRect(-s * 0.055, s * 0.06, s * 0.11, s * 0.025);
  const flame = (h: number, w: number, col: string): void => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.02);
    ctx.bezierCurveTo(-w, -s * 0.05, -w * 0.6, -h * 0.6, 0, -h);
    ctx.bezierCurveTo(w * 0.6, -h * 0.6, w, -s * 0.05, 0, -s * 0.02);
    ctx.fill();
  };
  flame(s * 0.42, s * 0.17, C.danger);
  flame(s * 0.34, s * 0.12, C.goldLine);
  flame(s * 0.22, s * 0.07, INK.flameCore);
  ctx.restore();
};

const matchmaker: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.danger, 0.25));
  ctx.lineWidth = s * 0.05;
  ctx.strokeStyle = C.goldDark;
  ctx.beginPath();
  ctx.arc(cx - s * 0.1, cy + s * 0.04, s * 0.17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = C.gold;
  ctx.beginPath();
  ctx.arc(cx + s * 0.1, cy - s * 0.02, s * 0.17, 0, Math.PI * 2);
  ctx.stroke();
  // 左环压在右环上面的那一小段，做出交扣的感觉
  ctx.strokeStyle = C.goldDark;
  ctx.beginPath();
  ctx.arc(cx - s * 0.1, cy + s * 0.04, s * 0.17, -0.6, 0.2);
  ctx.stroke();
  star4(ctx, cx + s * 0.1, cy - s * 0.21, s * 0.06, INK.white);
  circle(ctx, cx + s * 0.1, cy - s * 0.2, s * 0.03, C.danger);
};

const asylum: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.gold, 0.2));
  const arch = (w: number, top: number, bottom: number): void => {
    ctx.beginPath();
    ctx.moveTo(cx - w, bottom);
    ctx.lineTo(cx - w, cy - s * 0.02);
    ctx.quadraticCurveTo(cx - w, top + (cy - top) * 0.25, cx, top);
    ctx.quadraticCurveTo(cx + w, top + (cy - top) * 0.25, cx + w, cy - s * 0.02);
    ctx.lineTo(cx + w, bottom);
    ctx.closePath();
  };
  arch(s * 0.26, cy - s * 0.4, cy + s * 0.3);
  ctx.fillStyle = INK.ink;
  ctx.fill();
  ctx.save();
  ctx.clip();
  hatch(ctx, cx - s * 0.3, cy - s * 0.4, s * 0.6, s * 0.7, 0, s * 0.06, alpha(INK.lilac, 0.18), s * 0.01);
  ctx.restore();
  arch(s * 0.16, cy - s * 0.26, cy + s * 0.3);
  const g = ctx.createLinearGradient(0, cy - s * 0.26, 0, cy + s * 0.3);
  g.addColorStop(0, INK.flameCore);
  g.addColorStop(1, C.goldDark);
  ctx.fillStyle = g;
  ctx.fill();
  polyline(ctx, [[cx, cy - s * 0.26], [cx, cy + s * 0.3]], s * 0.015, INK.sepiaDark);
  circle(ctx, cx - s * 0.04, cy + s * 0.08, s * 0.015, INK.sepiaDark);
  ctx.fillStyle = INK.inkSoft;
  ctx.fillRect(cx - s * 0.34, cy + s * 0.3, s * 0.68, s * 0.06);
  polyline(ctx, [[cx, cy - s * 0.4], [cx, cy - s * 0.48]], s * 0.02, C.gold);
  polyline(ctx, [[cx - s * 0.035, cy - s * 0.45], [cx + s * 0.035, cy - s * 0.45]], s * 0.02, C.gold);
};

const piety: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy - s * 0.1, s * 0.45, alpha(C.moon, 0.3));
  ctx.strokeStyle = alpha(C.gold, 0.8);
  ctx.lineWidth = s * 0.02;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.18, s * 0.26, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  for (const sg of [-1, 1]) {
    const ox = cx + sg * s * 0.012;
    const hand = (): void => {
      ctx.beginPath();
      ctx.moveTo(ox, cy + s * 0.32);
      ctx.quadraticCurveTo(ox + sg * s * 0.2, cy + s * 0.22, ox + sg * s * 0.12, cy - s * 0.08);
      ctx.quadraticCurveTo(ox + sg * s * 0.06, cy - s * 0.3, ox, cy - s * 0.36);
      ctx.closePath();
    };
    hand();
    ctx.fillStyle = INK.parchment;
    ctx.fill();
    ctx.save();
    ctx.clip();
    hatch(ctx, cx - s * 0.25, cy - s * 0.4, s * 0.5, s * 0.75, sg * 0.5, s * 0.08, alpha(INK.sepia, 0.25), s * 0.007);
    ctx.restore();
    hand();
    ctx.strokeStyle = INK.sepiaDark;
    ctx.lineWidth = s * 0.014;
    ctx.stroke();
    // 手指之间的分界
    for (let i = 1; i <= 3; i++) polyline(ctx, [[ox + sg * s * 0.02, cy - s * (0.3 - i * 0.07)], [ox + sg * s * 0.1, cy - s * (0.24 - i * 0.07)]], s * 0.008, alpha(INK.sepiaDark, 0.6));
  }
  ctx.fillStyle = INK.wineDark;
  ctx.fillRect(cx - s * 0.12, cy + s * 0.24, s * 0.24, s * 0.06);
};

const scapegoat: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.danger, 0.22));
  ctx.strokeStyle = INK.sepiaDark;
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = 'round';
  for (const sg of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sg * s * 0.06, cy - s * 0.14);
    ctx.bezierCurveTo(cx + sg * s * 0.15, cy - s * 0.38, cx + sg * s * 0.36, cy - s * 0.32, cx + sg * s * 0.3, cy - s * 0.12);
    ctx.stroke();
  }
  ctx.strokeStyle = alpha(C.cardText, 0.5);
  ctx.lineWidth = s * 0.01;
  for (const sg of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sg * s * 0.08, cy - s * 0.18);
    ctx.bezierCurveTo(cx + sg * s * 0.16, cy - s * 0.34, cx + sg * s * 0.32, cy - s * 0.3, cx + sg * s * 0.29, cy - s * 0.15);
    ctx.stroke();
  }
  for (const sg of [-1, 1]) fillEllipse(ctx, cx + sg * s * 0.17, cy - s * 0.06, s * 0.09, s * 0.035, sg * 0.4, INK.ink);
  polygon(ctx, [[cx - s * 0.11, cy - s * 0.14], [cx + s * 0.11, cy - s * 0.14], [cx + s * 0.06, cy + s * 0.22], [cx, cy + s * 0.27], [cx - s * 0.06, cy + s * 0.22]], INK.ink);
  polygon(ctx, [[cx - s * 0.04, cy + s * 0.24], [cx + s * 0.04, cy + s * 0.24], [cx, cy + s * 0.4]], INK.ink);
  fillEllipse(ctx, cx - s * 0.05, cy - s * 0.04, s * 0.025, s * 0.01, 0, C.gold);
  fillEllipse(ctx, cx + s * 0.05, cy - s * 0.04, s * 0.025, s * 0.01, 0, C.gold);
  polyline(ctx, [[cx - s * 0.02, cy + s * 0.18], [cx + s * 0.02, cy + s * 0.18]], s * 0.01, alpha(C.cardText, 0.6));
};

const robbery: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.gold, 0.2));
  fillEllipse(ctx, cx - s * 0.06, cy + s * 0.1, s * 0.2, s * 0.19, 0, INK.straw);
  ctx.save();
  ellipse_(ctx, cx - s * 0.06, cy + s * 0.1, s * 0.2, s * 0.19);
  ctx.clip();
  hatch(ctx, cx - s * 0.26, cy - s * 0.1, s * 0.4, s * 0.4, 0.7, s * 0.035, alpha(INK.sepiaDark, 0.5), s * 0.008);
  ctx.restore();
  polygon(ctx, [[cx - s * 0.13, cy - s * 0.1], [cx + s * 0.01, cy - s * 0.1], [cx + s * 0.07, cy - s * 0.24], [cx - s * 0.06, cy - s * 0.15], [cx - s * 0.19, cy - s * 0.24]], INK.straw);
  ctx.fillStyle = C.goldDark;
  ctx.fillRect(cx - s * 0.14, cy - s * 0.11, s * 0.16, s * 0.035);
  ctx.fillStyle = INK.sepiaDark;
  ctx.font = titleFont(Math.max(1, Math.round(s * 0.16)));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', cx - s * 0.06, cy + s * 0.11);
  // 从右边伸过来的手
  polyline(ctx, [[cx + s * 0.48, cy + s * 0.12], [cx + s * 0.2, cy + s * 0.04]], s * 0.1, INK.ink);
  for (let i = 0; i < 3; i++) {
    polyline(ctx, [[cx + s * 0.2, cy + s * (0.0 + i * 0.04)], [cx + s * 0.12, cy + s * (-0.02 + i * 0.05)], [cx + s * 0.1, cy + s * (0.03 + i * 0.05)]], s * 0.03, INK.ink);
  }
};

/** 椭圆路径（不填充），给裁剪用 */
function ellipse_(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.restore();
}

const curse: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.danger, 0.25));
  ctx.fillStyle = INK.straw;
  rr(ctx, cx - s * 0.11, cy - s * 0.04, s * 0.22, s * 0.3, s * 0.05);
  ctx.fill();
  ctx.fillRect(cx - s * 0.26, cy, s * 0.52, s * 0.07);
  ctx.fillRect(cx - s * 0.1, cy + s * 0.22, s * 0.07, s * 0.14);
  ctx.fillRect(cx + s * 0.03, cy + s * 0.22, s * 0.07, s * 0.14);
  circle(ctx, cx, cy - s * 0.15, s * 0.12, INK.straw);
  ctx.save();
  rr(ctx, cx - s * 0.26, cy - s * 0.27, s * 0.52, s * 0.63, s * 0.05);
  ctx.clip();
  hatch(ctx, cx - s * 0.3, cy - s * 0.3, s * 0.6, s * 0.7, 1.2, s * 0.035, alpha(INK.sepiaDark, 0.35), s * 0.007);
  ctx.restore();
  // 两只眼睛是缝上去的叉
  for (const ex of [cx - s * 0.045, cx + s * 0.045]) {
    const ey = cy - s * 0.17;
    polyline(ctx, [[ex - s * 0.025, ey - s * 0.025], [ex + s * 0.025, ey + s * 0.025]], s * 0.014, INK.ink);
    polyline(ctx, [[ex + s * 0.025, ey - s * 0.025], [ex - s * 0.025, ey + s * 0.025]], s * 0.014, INK.ink);
  }
  polyline(ctx, [[cx - s * 0.05, cy - s * 0.08], [cx + s * 0.05, cy - s * 0.08]], s * 0.012, INK.ink);
  for (const [x1, y1, x2, y2] of [[0.28, -0.3, 0.02, -0.12], [-0.3, 0.12, -0.04, 0.1], [0.3, 0.2, 0.05, 0.12]]) {
    polyline(ctx, [[cx + x1 * s, cy + y1 * s], [cx + x2 * s, cy + y2 * s]], s * 0.012, INK.steel);
    circle(ctx, cx + x1 * s, cy + y1 * s, s * 0.03, C.danger);
  }
};

const stocks: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.gold, 0.15));
  ctx.fillStyle = INK.wood;
  ctx.fillRect(cx - s * 0.04, cy, s * 0.08, s * 0.42);
  const bx = cx - s * 0.38;
  const by = cy - s * 0.2;
  const bw = s * 0.76;
  const bh = s * 0.24;
  ctx.fillStyle = INK.straw;
  ctx.fillRect(bx, by, bw, bh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.clip();
  hatch(ctx, bx, by, bw, bh, 0.05, s * 0.03, alpha(INK.sepiaDark, 0.5), s * 0.008);
  ctx.restore();
  polyline(ctx, [[bx, by + bh / 2], [bx + bw, by + bh / 2]], s * 0.012, INK.sepiaDark);
  circle(ctx, cx, by + bh / 2, s * 0.075, INK.ink);
  circle(ctx, cx - s * 0.25, by + bh / 2, s * 0.045, INK.ink);
  circle(ctx, cx + s * 0.25, by + bh / 2, s * 0.045, INK.ink);
  ctx.fillStyle = C.goldDark;
  for (const x of [bx + s * 0.02, bx + bw - s * 0.06]) ctx.fillRect(x, by + bh / 2 - s * 0.03, s * 0.04, s * 0.06);
  ctx.strokeStyle = INK.sepiaDark;
  ctx.lineWidth = s * 0.012;
  ctx.strokeRect(bx, by, bw, bh);
};

const alibi: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.moon, 0.2));
  ctx.save();
  ctx.translate(cx + s * 0.08, cy - s * 0.02);
  ctx.rotate(0.15);
  ctx.fillStyle = INK.parchment;
  ctx.fillRect(-s * 0.18, -s * 0.26, s * 0.36, s * 0.48);
  ctx.strokeStyle = alpha(INK.sepiaDark, 0.6);
  ctx.lineWidth = s * 0.012;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    ctx.moveTo(-s * 0.12, -s * 0.18 + i * s * 0.07);
    ctx.lineTo(s * 0.12, -s * 0.18 + i * s * 0.07);
  }
  ctx.stroke();
  circle(ctx, s * 0.08, s * 0.14, s * 0.06, INK.wax);
  ctx.restore();
  // 举起的手：手掌加四根手指和拇指
  ctx.save();
  ctx.translate(cx - s * 0.12, cy + s * 0.08);
  ctx.rotate(-0.15);
  ctx.fillStyle = INK.lilac;
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = s * 0.016;
  const palm = (): void => rr(ctx, -s * 0.11, -s * 0.06, s * 0.22, s * 0.24, s * 0.06);
  palm();
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    rr(ctx, -s * 0.105 + i * s * 0.055, -s * (0.26 - Math.abs(i - 1.5) * 0.03), s * 0.045, s * 0.22, s * 0.022);
    ctx.fill();
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(-s * 0.11, s * 0.04);
  ctx.rotate(-0.8);
  rr(ctx, -s * 0.025, -s * 0.13, s * 0.05, s * 0.14, s * 0.025);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  palm();
  ctx.fill();
  ctx.restore();
};

const conspiracy: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy + s * 0.1, s * 0.45, alpha(INK.poison, 0.35));
  for (let i = 0; i < 3; i++) fillEllipse(ctx, cx + (i - 1) * s * 0.18, cy + s * (0.3 - (i % 2) * 0.05), s * 0.2, s * 0.05, 0, alpha(INK.lilac, 0.2));
  ctx.save();
  ctx.translate(cx - s * 0.06, cy - s * 0.08);
  ctx.rotate(0.6);
  ctx.beginPath();
  ctx.arc(0, s * 0.06, s * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = INK.ink;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = INK.poison;
  ctx.fillRect(-s * 0.2, s * 0.08, s * 0.4, s * 0.2);
  ctx.restore();
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = s * 0.014;
  ctx.stroke();
  ctx.fillStyle = INK.ink;
  ctx.fillRect(-s * 0.04, -s * 0.2, s * 0.08, s * 0.12);
  ctx.fillStyle = INK.sepiaDark;
  ctx.fillRect(-s * 0.05, -s * 0.26, s * 0.1, s * 0.06);
  ctx.restore();
  // 瓶口滴下的一滴
  const dx = cx + s * 0.16;
  const dy = cy + s * 0.04;
  ctx.fillStyle = INK.poisonLight;
  ctx.beginPath();
  ctx.moveTo(dx, dy - s * 0.08);
  ctx.quadraticCurveTo(dx + s * 0.05, dy, dx, dy + s * 0.04);
  ctx.quadraticCurveTo(dx - s * 0.05, dy, dx, dy - s * 0.08);
  ctx.fill();
  circle(ctx, dx + s * 0.05, dy + s * 0.14, s * 0.02, INK.poisonLight);
};

export const CARD_ICONS: Record<CardKind, IconFn> = {
  accusation,
  evidence,
  witness,
  blackCat,
  matchmaker,
  asylum,
  piety,
  scapegoat,
  robbery,
  arson,
  curse,
  stocks,
  alibi,
  night,
  conspiracy,
};

/* ---------------------------------------------------------------- 身份 */

const witch: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.witch, 0.35));
  crescent(ctx, cx + s * 0.2, cy - s * 0.22, s * 0.1, s * 0.05, -s * 0.03, C.moon);
  ctx.fillStyle = INK.ink;
  ctx.strokeStyle = C.goldLine;
  ctx.lineWidth = s * 0.01;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.17, cy + s * 0.14);
  ctx.quadraticCurveTo(cx - s * 0.05, cy - s * 0.1, cx + s * 0.02, cy - s * 0.32);
  ctx.quadraticCurveTo(cx + s * 0.06, cy - s * 0.2, cx + s * 0.2, cy - s * 0.26);
  ctx.quadraticCurveTo(cx + s * 0.07, cy - s * 0.12, cx + s * 0.17, cy + s * 0.14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ellipse_(ctx, cx, cy + s * 0.16, s * 0.36, s * 0.07);
  ctx.fill();
  ctx.stroke();
  polygon(ctx, [[cx - s * 0.165, cy + s * 0.08], [cx + s * 0.165, cy + s * 0.08], [cx + s * 0.17, cy + s * 0.14], [cx - s * 0.17, cy + s * 0.14]], C.witch);
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = s * 0.014;
  ctx.strokeRect(cx - s * 0.035, cy + s * 0.075, s * 0.07, s * 0.07);
};

const constable: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy + s * 0.05, s * 0.45, alpha(C.gold, 0.35));
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.3, s * 0.05, Math.PI, 0);
  ctx.stroke();
  polygon(ctx, [[cx - s * 0.05, cy - s * 0.3], [cx + s * 0.05, cy - s * 0.3], [cx + s * 0.17, cy - s * 0.18], [cx - s * 0.17, cy - s * 0.18]], INK.ink);
  ctx.fillStyle = alpha(C.gold, 0.55);
  ctx.fillRect(cx - s * 0.13, cy - s * 0.18, s * 0.26, s * 0.32);
  glow(ctx, cx, cy - s * 0.02, s * 0.15, alpha(INK.flameCore, 0.9));
  ctx.fillStyle = INK.flameCore;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.1);
  ctx.quadraticCurveTo(cx + s * 0.04, cy, cx, cy + s * 0.04);
  ctx.quadraticCurveTo(cx - s * 0.04, cy, cx, cy - s * 0.1);
  ctx.fill();
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = s * 0.022;
  ctx.strokeRect(cx - s * 0.13, cy - s * 0.18, s * 0.26, s * 0.32);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.045, cy - s * 0.18);
  ctx.lineTo(cx - s * 0.045, cy + s * 0.14);
  ctx.moveTo(cx + s * 0.045, cy - s * 0.18);
  ctx.lineTo(cx + s * 0.045, cy + s * 0.14);
  ctx.stroke();
  ctx.fillStyle = INK.ink;
  ctx.fillRect(cx - s * 0.17, cy + s * 0.14, s * 0.34, s * 0.06);
  star4(ctx, cx, cy + s * 0.32, s * 0.07, C.gold);
};

const villager: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(INK.lilac, 0.2));
  for (let i = 0; i < 3; i++) circle(ctx, cx + s * 0.13 + i * s * 0.03, cy - s * 0.3 - i * s * 0.06, s * (0.03 + i * 0.012), alpha(INK.lilac, 0.25));
  ctx.fillStyle = INK.ink;
  ctx.fillRect(cx + s * 0.1, cy - s * 0.27, s * 0.06, s * 0.14);
  const roof: [number, number][] = [[cx - s * 0.27, cy - s * 0.02], [cx, cy - s * 0.24], [cx + s * 0.27, cy - s * 0.02]];
  polygon(ctx, roof, INK.ink);
  ctx.fillRect(cx - s * 0.21, cy - s * 0.03, s * 0.42, s * 0.3);
  ctx.save();
  ctx.beginPath();
  roof.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  hatch(ctx, cx - s * 0.3, cy - s * 0.25, s * 0.6, s * 0.25, 0, s * 0.035, alpha(INK.lilac, 0.25), s * 0.007);
  ctx.restore();
  glow(ctx, cx - s * 0.1, cy + s * 0.08, s * 0.12, alpha(C.gold, 0.5));
  ctx.fillStyle = C.gold;
  ctx.fillRect(cx - s * 0.14, cy + s * 0.04, s * 0.08, s * 0.08);
  ctx.fillStyle = INK.ink;
  ctx.fillRect(cx - s * 0.102, cy + s * 0.04, s * 0.006, s * 0.08);
  ctx.fillRect(cx - s * 0.14, cy + s * 0.077, s * 0.08, s * 0.006);
  ctx.fillStyle = INK.brown;
  ctx.fillRect(cx + s * 0.05, cy + s * 0.1, s * 0.09, s * 0.17);
  ctx.fillStyle = INK.ink;
  ctx.fillRect(cx - s * 0.4, cy + s * 0.27, s * 0.8, s * 0.2);
};

export const TRYAL_ICONS: Record<TryalKind, IconFn> = { witch, constable, villager };

/* ---------------------------------------------------------------- 角色 */

const judge: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.gold, 0.25));
  ctx.fillStyle = INK.ink;
  rr(ctx, cx - s * 0.24, cy + s * 0.2, s * 0.48, s * 0.08, s * 0.02);
  ctx.fill();
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = s * 0.01;
  ctx.stroke();
  ctx.save();
  ctx.translate(cx + s * 0.02, cy - s * 0.02);
  ctx.rotate(-0.6);
  ctx.fillStyle = INK.wood;
  rr(ctx, -s * 0.025, -s * 0.02, s * 0.05, s * 0.38, s * 0.02);
  ctx.fill();
  ctx.fillStyle = INK.ink;
  rr(ctx, -s * 0.16, -s * 0.12, s * 0.32, s * 0.13, s * 0.03);
  ctx.fill();
  ctx.fillStyle = C.goldDark;
  ctx.fillRect(-s * 0.12, -s * 0.12, s * 0.025, s * 0.13);
  ctx.fillRect(s * 0.095, -s * 0.12, s * 0.025, s * 0.13);
  ctx.restore();
};

const doctor: IconFn = (ctx, cx, cy, s) => {
  fillEllipse(ctx, cx - s * 0.04, cy - s * 0.2, s * 0.26, s * 0.05, 0, INK.ink);
  ctx.fillStyle = INK.ink;
  ctx.fillRect(cx - s * 0.16, cy - s * 0.36, s * 0.24, s * 0.17);
  circle(ctx, cx - s * 0.05, cy - s * 0.02, s * 0.16, INK.ink);
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.06, cy - s * 0.1);
  ctx.quadraticCurveTo(cx + s * 0.3, cy - s * 0.02, cx + s * 0.36, cy + s * 0.22);
  ctx.quadraticCurveTo(cx + s * 0.2, cy + s * 0.1, cx + s * 0.03, cy + s * 0.08);
  ctx.fill();
  ctx.fillRect(cx - s * 0.2, cy + s * 0.1, s * 0.3, s * 0.3);
  circle(ctx, cx - s * 0.02, cy - s * 0.05, s * 0.045, C.gold);
  circle(ctx, cx - s * 0.02, cy - s * 0.05, s * 0.02, INK.ink);
  ellipse_(ctx, cx - s * 0.04, cy - s * 0.2, s * 0.26, s * 0.05);
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = s * 0.01;
  ctx.stroke();
};

const beggar: IconFn = (ctx, cx, cy, s) => {
  ctx.fillStyle = INK.ink;
  ctx.beginPath();
  ctx.save();
  ctx.translate(cx, cy + s * 0.08);
  ctx.scale(s * 0.28, s * 0.2);
  ctx.arc(0, 0, 1, 0, Math.PI);
  ctx.restore();
  ctx.fill();
  ellipse_(ctx, cx, cy + s * 0.08, s * 0.28, s * 0.06);
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = s * 0.02;
  ctx.stroke();
  for (const [dx, dy, r] of [[-0.06, -0.08, 0.06], [0.1, -0.2, 0.05], [0.02, -0.32, 0.04]]) fillEllipse(ctx, cx + dx * s, cy + dy * s, r * s, r * s * 0.75, 0.4, C.gold);
  polyline(ctx, [[cx + s * 0.1, cy + s * 0.14], [cx + s * 0.14, cy + s * 0.2], [cx + s * 0.11, cy + s * 0.26]], s * 0.012, alpha(C.gold, 0.5));
};

const landlord: IconFn = (ctx, cx, cy, s) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.75);
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.arc(0, -s * 0.22, s * 0.1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = C.gold;
  ctx.fillRect(-s * 0.025, -s * 0.12, s * 0.05, s * 0.44);
  ctx.fillRect(s * 0.02, s * 0.2, s * 0.1, s * 0.04);
  ctx.fillRect(s * 0.02, s * 0.27, s * 0.07, s * 0.04);
  circle(ctx, 0, -s * 0.22, s * 0.035, INK.ink);
  ctx.restore();
};

const priest: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy - s * 0.1, s * 0.3, alpha(INK.flameCore, 0.5));
  ctx.fillStyle = C.gold;
  ctx.fillRect(cx - s * 0.03, cy - s * 0.36, s * 0.06, s * 0.36);
  ctx.fillRect(cx - s * 0.12, cy - s * 0.26, s * 0.24, s * 0.055);
  ctx.fillStyle = INK.ink;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy + s * 0.06);
  ctx.quadraticCurveTo(cx - s * 0.15, cy, cx, cy + s * 0.07);
  ctx.quadraticCurveTo(cx + s * 0.15, cy, cx + s * 0.3, cy + s * 0.06);
  ctx.lineTo(cx + s * 0.3, cy + s * 0.26);
  ctx.quadraticCurveTo(cx + s * 0.15, cy + s * 0.2, cx, cy + s * 0.27);
  ctx.quadraticCurveTo(cx - s * 0.15, cy + s * 0.2, cx - s * 0.3, cy + s * 0.26);
  ctx.closePath();
  ctx.fill();
  polyline(ctx, [[cx, cy + s * 0.07], [cx, cy + s * 0.27]], s * 0.012, C.goldDark);
  for (let i = 0; i < 3; i++) {
    polyline(ctx, [[cx - s * 0.25, cy + s * (0.1 + i * 0.045)], [cx - s * 0.05, cy + s * (0.12 + i * 0.045)]], s * 0.008, alpha(C.gold, 0.45));
    polyline(ctx, [[cx + s * 0.05, cy + s * (0.12 + i * 0.045)], [cx + s * 0.25, cy + s * (0.1 + i * 0.045)]], s * 0.008, alpha(C.gold, 0.45));
  }
};

const storyteller: IconFn = (ctx, cx, cy, s) => {
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.translate(cx, cy + s * 0.28);
    ctx.rotate((i - 2) * 0.28);
    const w = s * 0.2;
    const h = s * 0.3;
    rr(ctx, -w / 2, -h - s * 0.12, w, h, s * 0.025);
    ctx.fillStyle = i === 2 ? INK.wine : FRAME_GRADIENT.back[0];
    ctx.fill();
    ctx.strokeStyle = C.goldLine;
    ctx.lineWidth = s * 0.01;
    ctx.stroke();
    if (i === 2) star4(ctx, 0, -h / 2 - s * 0.12, s * 0.05, C.gold);
    else crescent(ctx, 0, -h / 2 - s * 0.12, s * 0.04, s * 0.02, -s * 0.01, alpha(C.gold, 0.7));
    ctx.restore();
  }
};

const tailor: IconFn = (ctx, cx, cy, s) => {
  ctx.save();
  ctx.translate(cx, cy);
  for (const sg of [-1, 1]) {
    ctx.save();
    ctx.rotate(sg * 0.35);
    polygon(ctx, [[-s * 0.02, 0], [s * 0.02, 0], [s * 0.005, -s * 0.36]], INK.steel);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    ctx.arc(0, s * 0.17, s * 0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = C.gold;
    ctx.fillRect(-s * 0.015, 0, s * 0.03, s * 0.1);
    ctx.restore();
  }
  circle(ctx, 0, 0, s * 0.025, INK.ink);
  ctx.restore();
  polyline(ctx, [[cx - s * 0.32, cy - s * 0.3], [cx - s * 0.2, cy - s * 0.12], [cx - s * 0.3, cy + s * 0.05], [cx - s * 0.22, cy + s * 0.3]], s * 0.012, C.danger);
};

const housewife: IconFn = (ctx, cx, cy, s) => {
  ctx.strokeStyle = alpha(INK.lilac, 0.45);
  ctx.lineWidth = s * 0.018;
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.02 + i * s * 0.08, cy - s * 0.2);
    ctx.bezierCurveTo(cx - s * 0.08 + i * s * 0.08, cy - s * 0.27, cx + s * 0.04 + i * s * 0.08, cy - s * 0.32, cx - s * 0.02 + i * s * 0.08, cy - s * 0.4);
    ctx.stroke();
  }
  fillEllipse(ctx, cx, cy + s * 0.06, s * 0.22, s * 0.2, 0, INK.ink);
  ctx.fillStyle = INK.ink;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.16, cy);
  ctx.quadraticCurveTo(cx + s * 0.32, cy - s * 0.02, cx + s * 0.36, cy - s * 0.14);
  ctx.lineTo(cx + s * 0.3, cy - s * 0.12);
  ctx.quadraticCurveTo(cx + s * 0.26, cy + s * 0.04, cx + s * 0.16, cy + s * 0.1);
  ctx.fill();
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = s * 0.035;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.1, s * 0.15, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  fillEllipse(ctx, cx, cy - s * 0.13, s * 0.1, s * 0.025, 0, C.goldDark);
  ctx.fillStyle = C.goldDark;
  ctx.fillRect(cx - s * 0.2, cy + s * 0.1, s * 0.4, s * 0.02);
};

const farmer: IconFn = (ctx, cx, cy, s) => {
  for (const [ang, len] of [[-0.35, 0.55], [0, 0.62], [0.35, 0.55]]) {
    ctx.save();
    ctx.translate(cx, cy + s * 0.32);
    ctx.rotate(ang);
    polyline(ctx, [[0, 0], [0, -s * len]], s * 0.02, C.goldDark);
    for (let k = 0; k < 5; k++) {
      const y = -s * len + s * (0.04 + k * 0.05);
      for (const sg of [-1, 1]) fillEllipse(ctx, sg * s * 0.03, y, s * 0.022, s * 0.045, sg * 0.5, C.gold);
    }
    ctx.restore();
  }
  ctx.fillStyle = C.danger;
  ctx.fillRect(cx - s * 0.07, cy + s * 0.14, s * 0.14, s * 0.04);
};

const child: IconFn = (ctx, cx, cy, s) => {
  ctx.strokeStyle = alpha(C.gold, 0.5);
  ctx.lineWidth = s * 0.012;
  for (const r of [0.3, 0.36]) {
    ctx.beginPath();
    ctx.save();
    ctx.translate(cx, cy + s * 0.26);
    ctx.scale(s * r, s * r * 0.2);
    ctx.arc(0, 0, 1, Math.PI * 0.1, Math.PI * 0.9);
    ctx.restore();
    ctx.stroke();
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.24, cy - s * 0.08);
  ctx.quadraticCurveTo(cx, cy - s * 0.2, cx + s * 0.24, cy - s * 0.08);
  ctx.lineTo(cx, cy + s * 0.3);
  ctx.closePath();
  ctx.fillStyle = INK.wine;
  ctx.fill();
  ctx.clip();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? C.gold : INK.ink;
    ctx.fillRect(cx - s * 0.3, cy - s * 0.04 + i * s * 0.07, s * 0.6, s * 0.03);
  }
  ctx.restore();
  ctx.fillStyle = INK.ink;
  ctx.fillRect(cx - s * 0.02, cy - s * 0.3, s * 0.04, s * 0.16);
  circle(ctx, cx, cy - s * 0.31, s * 0.035, INK.ink);
};

const minister: IconFn = (ctx, cx, cy, s) => {
  ctx.fillStyle = alpha(C.danger, 0.85);
  ctx.fillRect(cx - s * 0.3, cy + s * 0.2, s * 0.26, s * 0.14);
  ctx.strokeStyle = alpha(C.cardText, 0.6);
  ctx.lineWidth = s * 0.01;
  ctx.strokeRect(cx - s * 0.28, cy + s * 0.22, s * 0.22, s * 0.1);
  ctx.save();
  ctx.translate(cx + s * 0.08, cy);
  ctx.rotate(0.2);
  circle(ctx, 0, -s * 0.28, s * 0.08, INK.ink);
  ctx.fillStyle = INK.ink;
  ctx.fillRect(-s * 0.035, -s * 0.24, s * 0.07, s * 0.22);
  rr(ctx, -s * 0.16, -s * 0.04, s * 0.32, s * 0.14, s * 0.02);
  ctx.fill();
  ctx.fillStyle = C.goldDark;
  ctx.fillRect(-s * 0.16, s * 0.08, s * 0.32, s * 0.04);
  ctx.restore();
};

const official: IconFn = (ctx, cx, cy, s) => {
  ctx.fillStyle = INK.ink;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.36, cy + s * 0.02);
  ctx.quadraticCurveTo(cx - s * 0.2, cy - s * 0.28, cx, cy - s * 0.2);
  ctx.quadraticCurveTo(cx + s * 0.2, cy - s * 0.28, cx + s * 0.36, cy + s * 0.02);
  ctx.quadraticCurveTo(cx + s * 0.15, cy - s * 0.02, cx, cy + s * 0.14);
  ctx.quadraticCurveTo(cx - s * 0.15, cy - s * 0.02, cx - s * 0.36, cy + s * 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = s * 0.018;
  ctx.stroke();
  circle(ctx, cx + s * 0.14, cy - s * 0.1, s * 0.05, C.danger);
  star4(ctx, cx + s * 0.14, cy - s * 0.1, s * 0.035, C.gold);
};

const strongman: IconFn = (ctx, cx, cy, s) => {
  ctx.fillStyle = INK.iron;
  ctx.fillRect(cx - s * 0.36, cy - s * 0.02, s * 0.72, s * 0.04);
  ctx.fillStyle = INK.ink;
  for (const sg of [-1, 1]) {
    rr(ctx, cx + sg * s * 0.25 - s * 0.045, cy - s * 0.2, s * 0.09, s * 0.4, s * 0.02);
    ctx.fill();
    rr(ctx, cx + sg * s * 0.16 - s * 0.035, cy - s * 0.14, s * 0.07, s * 0.28, s * 0.02);
    ctx.fill();
  }
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = s * 0.01;
  for (const sg of [-1, 1]) {
    rr(ctx, cx + sg * s * 0.25 - s * 0.045, cy - s * 0.2, s * 0.09, s * 0.4, s * 0.02);
    ctx.stroke();
  }
  ctx.fillStyle = C.gold;
  ctx.font = titleFont(Math.max(1, Math.round(s * 0.14)));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('8', cx, cy + s * 0.22);
};

const maid: IconFn = (ctx, cx, cy, s) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.45);
  ctx.fillStyle = INK.wood;
  ctx.fillRect(-s * 0.018, -s * 0.42, s * 0.036, s * 0.5);
  ctx.beginPath();
  ctx.moveTo(-s * 0.06, s * 0.06);
  ctx.lineTo(s * 0.06, s * 0.06);
  ctx.lineTo(s * 0.15, s * 0.38);
  ctx.lineTo(-s * 0.15, s * 0.38);
  ctx.closePath();
  ctx.fillStyle = INK.straw;
  ctx.fill();
  ctx.save();
  ctx.clip();
  hatch(ctx, -s * 0.15, s * 0.06, s * 0.3, s * 0.32, Math.PI / 2, s * 0.025, alpha(INK.sepiaDark, 0.6), s * 0.008);
  ctx.restore();
  ctx.fillStyle = C.danger;
  ctx.fillRect(-s * 0.07, s * 0.06, s * 0.14, s * 0.04);
  ctx.restore();
};

const maiden: IconFn = (ctx, cx, cy, s) => {
  polyline(ctx, [[cx, cy + s * 0.02], [cx - s * 0.02, cy + s * 0.2], [cx + s * 0.01, cy + s * 0.38]], s * 0.025, INK.leaf);
  for (const sg of [-1, 1]) fillEllipse(ctx, cx + sg * s * 0.08, cy + s * 0.22, s * 0.07, s * 0.03, sg * -0.5, INK.leaf);
  for (let i = 0; i < 5; i++) {
    const t = (i * Math.PI * 2) / 5 - Math.PI / 2;
    circle(ctx, cx + Math.cos(t) * s * 0.09, cy - s * 0.1 + Math.sin(t) * s * 0.09, s * 0.09, C.danger);
  }
  circle(ctx, cx, cy - s * 0.1, s * 0.07, INK.wine);
  circle(ctx, cx, cy - s * 0.1, s * 0.03, C.gold);
};

export const CHAR_ICONS: Record<CharacterId, IconFn> = {
  doctor,
  beggar,
  landlord,
  judge,
  priest,
  storyteller,
  tailor,
  housewife,
  farmer,
  child,
  minister,
  official,
  strongman,
  maid,
  maiden,
};
```

创建 `client/src/theme/art/frames.ts`：

```ts
import { USE_LIMITS, type CardKind, type CharacterId, type TryalKind } from '../../../../engine/src/index';
import type { Ctx } from '../../core/node';
import { wrapText } from '../../core/text';
import { CARD_INFO, TRYAL_NAME } from '../../model/cards';
import { CHAR_INFO } from '../../model/characters';
import { alpha, C, CARD_GRADIENT, FRAME_GRADIENT, font, INK, titleFont } from '../palette';
import { CARD_ICONS, CHAR_ICONS, TRYAL_ICONS, type IconFn } from './icons';
import { circle, crescent, glow, hatch, rr, star4 } from './shapes';

/** 卡牌模板都在 (0,0)–(w,h) 里作画，由缓存层负责贴到屏幕上 */

/** 宽度小于这个值的卡面只画图标，不写牌名 */
const TINY_W = 40;
/** 宽度小于这个值的卡面用紧凑排版 */
const SMALL_W = 80;

const RED_POINTS: Partial<Record<CardKind, number>> = { accusation: 1, evidence: 3, witness: 7 };
/** 红卡内框亮度：点数越高越亮 */
const RED_GLOW: Partial<Record<CardKind, number>> = { accusation: 0, evidence: 0.5, witness: 1 };

function vertical(ctx: Ctx, h: number, [top, bottom]: readonly [string, string]): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  return g;
}

/** 通用卡框：底色、金边、图框（里面画图标）、牌名 */
function framed(ctx: Ctx, w: number, h: number, colors: readonly [string, string], title: string, art: IconFn, frameGlow = 0): void {
  const r = Math.max(3, w * 0.07);
  rr(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.fillStyle = vertical(ctx, h, colors);
  ctx.fill();
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = Math.max(1, w * 0.012);
  ctx.stroke();
  const tiny = w < TINY_W;
  const small = w < SMALL_W;
  const pad = tiny ? Math.max(2, w * 0.08) : w * (small ? 0.07 : 0.065);
  const aw = w - pad * 2;
  const ah = tiny ? h - pad * 2 : h * (small ? 0.7 : 0.66);
  ctx.save();
  rr(ctx, pad, pad, aw, ah, r * 0.6);
  ctx.clip();
  ctx.fillStyle = alpha(INK.black, 0.35);
  ctx.fillRect(pad, pad, aw, ah);
  if (!small) hatch(ctx, pad, pad, aw, ah, -0.7, w * 0.03, alpha(INK.white, 0.04), 1);
  art(ctx, pad + aw / 2, pad + ah / 2, Math.min(aw, ah * 1.05));
  ctx.restore();
  rr(ctx, pad, pad, aw, ah, r * 0.6);
  ctx.strokeStyle = alpha(C.goldLine, 0.55 + 0.45 * frameGlow);
  ctx.lineWidth = Math.max(0.75, w * (0.008 + 0.012 * frameGlow));
  ctx.stroke();
  if (tiny) return;
  if (!small) {
    ctx.fillStyle = C.goldLine;
    for (const [px, py] of [[0.07, 0.035], [0.93, 0.035], [0.07, 0.965], [0.93, 0.965]]) {
      ctx.save();
      ctx.translate(w * px, h * py);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-w * 0.015, -w * 0.015, w * 0.03, w * 0.03);
      ctx.restore();
    }
  }
  const fs = Math.max(9, Math.round(w * (small ? 0.19 : 0.115)));
  ctx.fillStyle = C.cardText;
  ctx.font = titleFont(fs);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, w / 2, pad + ah + (h - pad - ah) / 2);
}

/** 红卡左上角的点数圆标 */
function pointsBadge(ctx: Ctx, w: number, n: number): void {
  const R = Math.max(5, w * 0.11);
  const p = w * 0.14;
  circle(ctx, p, p, R, INK.wineDark);
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = Math.max(1, R * 0.14);
  ctx.stroke();
  ctx.fillStyle = C.cardText;
  ctx.font = titleFont(Math.round(R * 1.25));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), p, p + R * 0.05);
}

export function cardFace(ctx: Ctx, w: number, h: number, kind: CardKind): void {
  const info = CARD_INFO[kind];
  framed(ctx, w, h, CARD_GRADIENT[info.color], info.name, CARD_ICONS[kind], RED_GLOW[kind] ?? 0);
  const pts = RED_POINTS[kind];
  if (pts !== undefined && w >= 30) pointsBadge(ctx, w, pts);
}

export function cardBack(ctx: Ctx, w: number, h: number): void {
  const r = Math.max(2, w * 0.07);
  rr(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.fillStyle = vertical(ctx, h, FRAME_GRADIENT.back);
  ctx.fill();
  ctx.save();
  ctx.clip();
  hatch(ctx, 0, 0, w, h, Math.PI / 4, Math.max(3, w * 0.09), alpha(C.gold, 0.12), 1);
  hatch(ctx, 0, 0, w, h, -Math.PI / 4, Math.max(3, w * 0.09), alpha(C.gold, 0.12), 1);
  ctx.restore();
  rr(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = Math.max(1, w * 0.012);
  ctx.stroke();
  if (w >= 24) {
    rr(ctx, w * 0.06, w * 0.06, w * 0.88, h - w * 0.12, r * 0.6);
    ctx.strokeStyle = alpha(C.goldLine, 0.6);
    ctx.stroke();
  }
  const cx = w / 2;
  const cy = h / 2;
  const R = w * 0.3;
  circle(ctx, cx, cy, R * 1.1, FRAME_GRADIENT.back[1]);
  ctx.strokeStyle = C.goldLine;
  ctx.lineWidth = Math.max(1, w * 0.012);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  if (w >= 24) {
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.78, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const t = (i * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(t) * R, cy + Math.sin(t) * R);
      ctx.lineTo(cx + Math.cos(t) * R * 1.25, cy + Math.sin(t) * R * 1.25);
      ctx.stroke();
    }
  }
  crescent(ctx, cx - R * 0.1, cy, R * 0.55, R * 0.25, -R * 0.12, C.gold);
  star4(ctx, cx + R * 0.32, cy - R * 0.25, R * 0.12, C.gold);
}

export function tryalFace(ctx: Ctx, w: number, h: number, kind: TryalKind): void {
  framed(ctx, w, h, FRAME_GRADIENT[kind], TRYAL_NAME[kind], TRYAL_ICONS[kind]);
}

/** 圆形头像：size×size 的方框里画一个圆，ring 是外圈颜色 */
export function portrait(ctx: Ctx, size: number, id: CharacterId, ring: string): void {
  const R = size / 2 - Math.max(1, size * 0.04);
  const c = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(c, c - R * 0.4, R * 0.1, c, c, R);
  g.addColorStop(0, INK.portraitTop);
  g.addColorStop(1, INK.portraitBottom);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  CHAR_ICONS[id](ctx, c, c + R * 0.05, R * 1.75);
  ctx.restore();
  ctx.strokeStyle = ring;
  ctx.lineWidth = Math.max(1.2, size * 0.05);
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.stroke();
}

/** 角色卡：圆头像、名字绶带、技能说明、限次标记。按 160×240 设计，等比缩放 */
export function charCard(ctx: Ctx, w: number, h: number, id: CharacterId): void {
  const info = CHAR_INFO[id];
  const k = w / 160;
  rr(ctx, 1, 1, w - 2, h - 2, 10 * k);
  ctx.fillStyle = vertical(ctx, h, FRAME_GRADIENT.character);
  ctx.fill();
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  rr(ctx, 6 * k, 6 * k, w - 12 * k, h - 12 * k, 7 * k);
  ctx.strokeStyle = alpha(C.goldLine, 0.45);
  ctx.lineWidth = 1;
  ctx.stroke();
  const R = w * 0.3;
  const cx = w / 2;
  const cy = h * 0.27;
  glow(ctx, cx, cy, R * 1.6, alpha(C.gold, 0.18));
  ctx.save();
  ctx.translate(cx - R - 2, cy - R - 2);
  portrait(ctx, R * 2 + 4, id, C.goldLine);
  ctx.restore();
  // 名字绶带
  const by = h * 0.52;
  const bw = w * 0.78;
  const bh = 24 * k;
  ctx.fillStyle = INK.wineDark;
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2 - 8 * k, by);
  ctx.lineTo(cx - bw / 2 + 4 * k, by + bh / 2);
  ctx.lineTo(cx - bw / 2 - 8 * k, by + bh);
  ctx.lineTo(cx + bw / 2 + 8 * k, by + bh);
  ctx.lineTo(cx + bw / 2 - 4 * k, by + bh / 2);
  ctx.lineTo(cx + bw / 2 + 8 * k, by);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = INK.wine;
  ctx.fillRect(cx - bw / 2 + 4 * k, by - 2 * k, bw - 8 * k, bh + 4 * k);
  ctx.strokeStyle = C.goldLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - bw / 2 + 4 * k, by - 2 * k, bw - 8 * k, bh + 4 * k);
  ctx.fillStyle = C.cardText;
  ctx.font = titleFont(Math.round(15 * k));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(info.name, cx, by + bh / 2 + k);
  // 技能说明
  const size = Math.max(10, Math.round(11 * k));
  ctx.font = font(size);
  ctx.fillStyle = INK.lilacText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines = wrapText(info.desc, w - 28 * k, (s) => ctx.measureText(s).width);
  const lh = size + 5 * k;
  const maxLines = Math.max(1, Math.floor((h - (by + bh + 12 * k) - 8 * k) / lh));
  lines.slice(0, maxLines).forEach((line, i) => ctx.fillText(line, 14 * k, by + bh + 12 * k + i * lh));
  const limit = (USE_LIMITS as Partial<Record<CharacterId, number>>)[id];
  if (limit) {
    const t = `限 ${limit} 次`;
    ctx.font = font(Math.max(9, Math.round(10 * k)), true);
    const tw = ctx.measureText(t).width + 12 * k;
    const th = 18 * k;
    rr(ctx, w - tw - 10 * k, 10 * k, tw, th, th / 2);
    ctx.fillStyle = alpha(C.danger, 0.85);
    ctx.fill();
    ctx.strokeStyle = C.gold;
    ctx.stroke();
    ctx.fillStyle = INK.white;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, w - tw / 2 - 10 * k, 10 * k + th / 2);
  }
}

/** 不带卡框的小图标（格子里「面前的牌」、规则页、弃牌列表） */
export function miniIcon(ctx: Ctx, size: number, kind: CardKind): void {
  CARD_ICONS[kind](ctx, size / 2, size / 2, size);
}

export function miniCharIcon(ctx: Ctx, size: number, id: CharacterId): void {
  CHAR_ICONS[id](ctx, size / 2, size / 2, size);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd client && npx vitest run && npm run typecheck`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add client/src/theme/art/icons.ts client/src/theme/art/frames.ts client/test/art.test.ts
git commit -m "feat(client): code-drawn icons for all cards, identities and characters, plus card templates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 场景背景，接入首页、大厅、牌桌、结算页

**Files:**
- Create: `client/src/theme/art/scenes.ts`
- Modify: `client/src/theme/draw.ts`（`drawSky`）
- Modify: `client/src/scenes/widgets.ts`（`skyNode`）
- Modify: `client/src/scenes/home.ts`、`client/src/scenes/lobby.ts`、`client/src/scenes/result.ts`
- Modify: `client/test/art.test.ts`（追加）

**Interfaces:**
- Consumes: Task 1 `blit`、shapes；palette。
- Produces: `Backdrop = 'home' | 'lobby' | 'table' | 'village' | 'witch'`、`paintBackdrop(ctx, W, H, which)`、`tableMoon(W, H)`；`drawSky(ctx, W, H, darkness, backdrop = 'table')`；`skyNode(screen, darkness, backdrop = 'table')`。

- [ ] **Step 1: 写失败的测试**

在 `client/test/art.test.ts` 追加（import 合并到顶部）：

```ts
import { paintBackdrop, type Backdrop } from '../src/theme/art/scenes';
import { drawSky } from '../src/theme/draw';

describe('场景', () => {
  const ALL: Backdrop[] = ['home', 'lobby', 'table', 'village', 'witch'];

  it('五种背景在大屏、小屏上都能画完', () => {
    const { ctx } = fakeCtx();
    for (const b of ALL) for (const [W, H] of [[375, 667], [320, 568]]) expect(() => paintBackdrop(ctx, W, H, b)).not.toThrow();
  });

  it('背景缓存：同一种背景只画一次；夜色叠加不进缓存', () => {
    const { factory, created } = fakeSurfaces();
    setSurfaceFactory(factory, 2);
    const { ctx } = fakeCtx();
    drawSky(ctx, 375, 667, 0, 'table');
    drawSky(ctx, 375, 667, 0.8, 'table');
    expect(created).toHaveLength(1);
    drawSky(ctx, 375, 667, 0, 'home');
    expect(created).toHaveLength(2);
  });
});
```

再在 `client/test/scenes-home-lobby.test.ts` 和 `client/test/choices.test.ts` 不用改：首页、大厅、结算页的现有测试会在 Step 4 一起跑，确认换背景后照常工作。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd client && npx vitest run test/art.test.ts`
Expected: FAIL（找不到 `../src/theme/art/scenes`；`drawSky` 不接受第 5 个参数——类型检查会报，vitest 里第二个用例画布数为 0）

- [ ] **Step 3: 实现**

创建 `client/src/theme/art/scenes.ts`：

```ts
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
  moon(ctx, W * 0.72, H * 0.17, W * 0.13, C.moon, alpha(C.moon, 0.22), alpha(INK.straw, 0.35));
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
  moon(ctx, W * 0.5, H * 0.24, W * 0.2, INK.bloodMoon, alpha(C.danger, 0.45), alpha(INK.wineDark, 0.5));
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
```

`client/src/theme/draw.ts`：替换 `drawSky`（删除原来手画的渐变、星星、月亮），并补 import：

```ts
import { blit } from './art/cache';
import { paintBackdrop, tableMoon, type Backdrop } from './art/scenes';
import { glow } from './art/shapes';
import { alpha, badgeColor, C, CARD_GRADIENT, font, goldGlow, nightShade } from './palette';

/** 整屏背景：按场景缓存；darkness 0→1 叠加一层夜色，牌桌的月亮在夜里更亮 */
export function drawSky(ctx: Ctx, W: number, H: number, darkness: number, backdrop: Backdrop = 'table'): void {
  blit(ctx, `sky:${backdrop}`, W, H, (c, w, h) => paintBackdrop(c, w, h, backdrop), 0, 0);
  if (darkness <= 0) return;
  ctx.fillStyle = nightShade(0.55 * darkness);
  ctx.fillRect(0, 0, W, H);
  if (backdrop === 'table') {
    const m = tableMoon(W, H);
    glow(ctx, m.x, m.y, m.r * 4, alpha(C.moon, 0.3 * darkness));
  }
}
```

（`CARD_GRADIENT` 在 Task 4 改完 `drawCardFace` 后可能不再用到，到时删掉未使用的 import。）

`client/src/scenes/widgets.ts`：

```ts
import type { Backdrop } from '../theme/art/scenes';

export function skyNode(screen: Screen, darkness: number, backdrop: Backdrop = 'table'): Node {
  return { rect: rect(0, 0, screen.W, screen.H), draw: (ctx) => drawSky(ctx, screen.W, screen.H, darkness, backdrop) };
}
```

- `client/src/scenes/home.ts`：`const nodes: Node[] = [skyNode(this.ui.screen, 0, 'home')];`
- `client/src/scenes/lobby.ts`：`const nodes: Node[] = [skyNode(this.ui.screen, 0, 'lobby')];`
- `client/src/scenes/result.ts`：`const nodes: Node[] = [skyNode(this.ui.screen, 0, village ? 'village' : 'witch')];`
- 牌桌 `client/src/scenes/table.ts` 不用改（默认 `'table'`）。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd client && npx vitest run && npm run typecheck`
Expected: 全部 PASS

- [ ] **Step 5: 提交**

```bash
git add client/src/theme/art/scenes.ts client/src/theme/draw.ts client/src/scenes/widgets.ts client/src/scenes/home.ts client/src/scenes/lobby.ts client/src/scenes/result.ts client/test/art.test.ts
git commit -m "feat(client): painted backdrops — town night, lobby, table, dawn and blood-moon results

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 卡面、身份卡、头像换成插画（手牌、格子、信息栏、夜晚、结算）

**Files:**
- Modify: `client/src/theme/draw.ts`（`drawCardFace`、`drawTryalChip`、`drawBadge`，新增 `drawCardBack`、`drawCharCard`）
- Modify: `client/src/scenes/tableParts.ts`（格子头像、面前的牌、信息栏头像）
- Modify: `client/src/scenes/choicePanels.ts`（`seatGrid` 头像）
- Modify: `client/src/scenes/result.ts`（头像）
- Modify: `client/test/art.test.ts`（追加）

**Interfaces:**
- Consumes: Task 1 `blit`；Task 2 `cardFace / cardBack / tryalFace / portrait / charCard`。
- Produces: `drawCardFace(ctx, r, kind, o)`（签名不变）；`drawTryalChip(ctx, r, kind, revealed, scaleX)`（签名不变）；`drawBadge(ctx, cx, cy, radius, name, seat, character: CharacterId | null = null)`；`drawCardBack(ctx, r)`；`drawCharCard(ctx, r, id)`；常量 `SMALL_CHIP = 16`。

- [ ] **Step 1: 写失败的测试**

在 `client/test/art.test.ts` 追加（import 合并到顶部）：

```ts
import { rect } from '../src/core/geom';
import { drawBadge, drawCardFace, drawTryalChip } from '../src/theme/draw';
import { drawCell } from '../src/scenes/tableParts';
import { projectPublic } from '../../engine/src/index';
import { newState } from './fixtures';

describe('接入游戏的绘制函数', () => {
  it('手牌：同一种牌同一尺寸只画一次', () => {
    const { factory, created } = fakeSurfaces();
    setSurfaceFactory(factory, 2);
    const { ctx } = fakeCtx();
    drawCardFace(ctx, rect(0, 0, 58, 84), 'night');
    drawCardFace(ctx, rect(70, 0, 58, 84), 'night', { selected: true });
    drawCardFace(ctx, rect(140, 0, 58, 84), 'night', { dim: true });
    expect(created).toHaveLength(1);
  });

  it('很小的身份卡（宽 < 16）保持颜色画法，不建隐藏画布；大的用卡面', () => {
    const { factory, created } = fakeSurfaces();
    setSurfaceFactory(factory, 2);
    const { ctx } = fakeCtx();
    drawTryalChip(ctx, rect(0, 0, 8, 11), 'witch', true);
    drawTryalChip(ctx, rect(0, 0, 8, 11), null, false);
    expect(created).toHaveLength(0);
    drawTryalChip(ctx, rect(0, 0, 52, 68), 'witch', true);
    drawTryalChip(ctx, rect(0, 0, 52, 68), null, false);
    expect(created).toHaveLength(2);
  });

  it('翻牌动画的不同进度复用同一张缓存', () => {
    const { factory, created } = fakeSurfaces();
    setSurfaceFactory(factory, 2);
    const { ctx } = fakeCtx();
    for (const sx of [1, 0.6, 0.2]) drawTryalChip(ctx, rect(0, 0, 52, 68), 'constable', true, sx);
    expect(created).toHaveLength(1);
  });

  it('头像：没有角色写名字首字；有角色画角色图标，不写字', () => {
    const a = fakeCtx();
    drawBadge(a.ctx, 10, 10, 9, '小明', 0);
    expect(a.texts).toEqual(['小']);
    const b = fakeCtx();
    drawBadge(b.ctx, 10, 10, 9, '小明', 0, 'judge');
    expect(b.texts).toEqual([]);
  });

  it('格子里面前的牌画成迷你卡面，不再写单字', () => {
    const s = newState(5);
    s.players[1].blue.push({ id: 'cat', kind: 'blackCat' });
    const p = projectPublic(s).players[1];
    const { ctx, texts } = fakeCtx();
    drawCell(ctx, rect(0, 0, 83, 88), p, { turn: false, glow: 0, targetable: false, order: 0, alpha: 1, flip: null, partner: false });
    expect(texts).not.toContain('黑');
  });
});
```

`newState` 来自现有的 `client/test/fixtures.ts`。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd client && npx vitest run test/art.test.ts`
Expected: FAIL（`drawCardFace` 还没走缓存，`created` 为 0；头像有角色时仍写字；格子仍写「黑」）

- [ ] **Step 3: 实现**

`client/src/theme/draw.ts`：替换 `drawBadge`、`drawCardFace`、`drawTryalChip`，新增 `drawCardBack`、`drawCharCard`。import 增加 `cardBack, cardFace, charCard, portrait, tryalFace`（`./art/frames`）和 `CharacterId` 类型；删掉不再使用的 `wrapText`、`CARD_INFO`、`CARD_GRADIENT`、`font` import（以 typecheck 为准）。

```ts
/** 圆形头像：有角色时画角色图标（外圈用座位颜色），没有角色时写名字首字 */
export function drawBadge(ctx: Ctx, cx: number, cy: number, radius: number, name: string, seat: number, character: CharacterId | null = null): void {
  if (character) {
    const size = radius * 2;
    blit(ctx, `portrait:${character}:${((seat % 12) + 12) % 12}`, size, size, (c, w) => portrait(c, w, character, badgeColor(seat)), cx - radius, cy - radius);
    return;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = badgeColor(seat);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = C.badgeRing;
  ctx.stroke();
  drawText(ctx, [...name][0] ?? '?', cx, cy + 1, { size: Math.round(radius * 1.05), bold: true, color: C.badgeText, align: 'center' });
}

export interface CardOpts {
  selected?: boolean;
  dim?: boolean;
}

const cardRadius = (r: Rect): number => Math.max(3, r.w * 0.07);

export function drawCardFace(ctx: Ctx, r: Rect, kind: CardKind, o: CardOpts = {}): void {
  if (o.dim) ctx.globalAlpha = 0.55;
  if (o.selected) {
    roundRect(ctx, r, cardRadius(r));
    ctx.shadowColor = C.glowStrong;
    ctx.shadowBlur = 14;
    ctx.fillStyle = C.goldLine;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  blit(ctx, `card:${kind}`, r.w, r.h, (c, w, h) => cardFace(c, w, h, kind), r.x, r.y);
  if (o.selected) {
    roundRect(ctx, r, cardRadius(r));
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.gold;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function drawCardBack(ctx: Ctx, r: Rect): void {
  blit(ctx, 'back', r.w, r.h, cardBack, r.x, r.y);
}

export function drawCharCard(ctx: Ctx, r: Rect, id: CharacterId): void {
  blit(ctx, `char:${id}`, r.w, r.h, (c, w, h) => charCard(c, w, h, id), r.x, r.y);
}

/** 宽度小于这个值的身份卡（格子里的）放不下图标，只用颜色区分 */
export const SMALL_CHIP = 16;

/** 身份卡：未翻开是卡背，翻开是身份卡面；很小时用颜色方块。scaleX 用于翻转动画（0→1） */
export function drawTryalChip(ctx: Ctx, r: Rect, kind: TryalKind | null, revealed: boolean, scaleX = 1): void {
  const w = r.w * Math.max(0.05, scaleX);
  const x = r.x + (r.w - w) / 2;
  if (r.w >= SMALL_CHIP) {
    if (revealed && kind) blit(ctx, `tryal:${kind}`, r.w, r.h, (c, cw, ch) => tryalFace(c, cw, ch, kind), x, r.y, w, r.h);
    else blit(ctx, 'back', r.w, r.h, cardBack, x, r.y, w, r.h);
    return;
  }
  const fill = !revealed || !kind ? C.tryalHidden : kind === 'witch' ? C.witch : kind === 'constable' ? C.constable : C.villager;
  roundRect(ctx, { x, y: r.y, w, h: r.h }, 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = revealed ? C.chipRevealedLine : C.goldDark;
  ctx.stroke();
  if (!revealed || !kind) {
    // 像缩小的卡背：中间一个金点
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2, r.y + r.h / 2, Math.max(0.8, w * 0.15), 0, Math.PI * 2);
    ctx.fillStyle = C.goldDark;
    ctx.fill();
    return;
  }
  if (scaleX > 0.6) {
    drawText(ctx, TRYAL_SHORT[kind], r.x + r.w / 2, r.y + r.h / 2 + 0.5, { size: Math.max(8, r.h - 4), color: C.badgeText, align: 'center' });
  }
}
```

`client/src/scenes/tableParts.ts`：

```ts
// 删掉 frontMarks（单字），换成迷你卡面
/** 面前的蓝卡、绿卡：从右往左排 10×14 的迷你卡面，放不下的不画 */
function frontCards(ctx: Ctx, p: PublicPlayer, right: number, cy: number, maxW: number): void {
  const cards = [...p.blue, ...p.green];
  const n = Math.min(cards.length, Math.floor((maxW + 2) / 12));
  for (let i = 0; i < n; i++) drawCardFace(ctx, { x: right - 10 - i * 12, y: cy - 7, w: 10, h: 14 }, cards[i].kind);
}
```

- 两处 `drawBadge(ctx, …, p.name, p.seat)` 改为 `drawBadge(ctx, …, p.name, p.seat, p.character)`。
- `drawText(ctx, frontMarks(p), r.x + r.w - 6, r.y + r.h - 9, { … })` 改为 `frontCards(ctx, p, r.x + r.w - 6, r.y + r.h - 9, r.w - 34)`。
- `drawMeBar` 里 `drawBadge(ctx, r.x + 20, cy, Math.min(13, r.h / 2 - 3), me.name, me.seat)` 加上 `, me.character`。
- import 增加 `drawCardFace`；`CARD_INFO` 如不再使用则删掉。

`client/src/scenes/choicePanels.ts` 的 `seatGrid`：`drawBadge(ctx, r.x + 13, r.y + h / 2, 9, p.name, seat, p.character);`

`client/src/scenes/result.ts`：`drawBadge(ctx, r.x + 18, r.y + r.h / 2, Math.min(13, r.h / 2 - 3), p.name, p.seat, p.character);`

- [ ] **Step 4: 跑测试确认通过**

Run: `cd client && npx vitest run && npm run typecheck`
Expected: 全部 PASS（现有的格子、信息栏、结算页测试只检查文字标签，不受影响）

- [ ] **Step 5: 提交**

```bash
git add client/src/theme/draw.ts client/src/scenes/tableParts.ts client/src/scenes/choicePanels.ts client/src/scenes/result.ts client/test/art.test.ts
git commit -m "feat(client): illustrated card faces, identity cards and character portraits on the table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 面板换成插画（选角色、详情、牧师、说书人、弃牌堆、规则页）

**Files:**
- Modify: `client/src/scenes/choicePanels.ts`（`characterPanel`）
- Modify: `client/src/scenes/infoPanels.ts`（`detailPanel`、`discardPanel`）
- Modify: `client/src/scenes/abilityPanels.ts`（`priestPanel`）
- Modify: `client/src/scenes/storyBoard.ts`（`drawRow`）
- Modify: `client/src/scenes/widgets.ts`（`Line.icon`、`ScrollBox` 画图标）
- Modify: `client/src/model/rules.ts`（条目带图标）
- Modify: `client/src/scenes/home.ts`（`RULE_LINES`）
- Modify: `client/src/theme/draw.ts`（`IconRef`、`drawIconRef`）
- Modify: `client/test/art.test.ts`、`client/test/theme.test.ts`

**Interfaces:**
- Consumes: Task 4 `drawCardFace`、`drawBadge`、`drawCharCard`。
- Produces: `IconRef = { card: CardKind } | { char: CharacterId }`、`drawIconRef(ctx, ref, x, y, h)`（画在左上角 (x,y)、高 h，返回占用宽度）；`Line.icon?: IconRef`；`RULES: { title: string; items: RuleItem[] }[]`，`RuleItem = { text: string; icon?: IconRef }`。

- [ ] **Step 1: 写失败的测试**

在 `client/test/art.test.ts` 追加：

```ts
import { RULES } from '../src/model/rules';
import { ScrollBox } from '../src/scenes/widgets';

describe('面板里的图标', () => {
  it('规则页：每种牌、每个角色的条目带图标', () => {
    const items = RULES.flatMap((s) => s.items);
    const cards = items.filter((i) => i.icon && 'card' in i.icon);
    const chars = items.filter((i) => i.icon && 'char' in i.icon);
    expect(cards).toHaveLength(15);
    expect(chars).toHaveLength(15);
  });

  it('带图标的行：文字往右缩进，内容照常画出', () => {
    const box = new ScrollBox();
    const node = box.node('x', rect(0, 0, 200, 300), [{ text: '黑猫：说明', icon: { card: 'blackCat' } }, { text: '法官：说明', icon: { char: 'judge' } }]);
    const { ctx, texts } = fakeCtx();
    node.draw!(ctx);
    expect(texts).toEqual(['黑猫：说明', '法官：说明']);
  });
});
```

`client/test/theme.test.ts` 里「规则速查有内容」不用改（`items.length` 仍然成立）。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd client && npx vitest run test/art.test.ts`
Expected: FAIL（`RULES` 条目还是字符串，没有 `icon`；`Line` 没有 `icon` 字段——typecheck 报错）

- [ ] **Step 3: 实现**

`client/src/theme/draw.ts` 追加：

```ts
export type IconRef = { card: CardKind } | { char: CharacterId };

/** 列表里的小图标：牌画迷你卡面（宽 = 0.72 × 高），角色画圆头像。返回占用的宽度 */
export function drawIconRef(ctx: Ctx, ref: IconRef, x: number, y: number, h: number): number {
  if ('card' in ref) {
    const w = Math.round(h * 0.72);
    drawCardFace(ctx, { x, y, w, h }, ref.card);
    return w;
  }
  drawBadge(ctx, x + h / 2, y + h / 2, h / 2, '', 0, ref.char);
  return h;
}
```

`client/src/scenes/widgets.ts`：`Line` 加字段，`ScrollBox.node` 的 `draw` 改为：

```ts
export interface Line {
  text: string;
  size?: number;
  color?: string;
  bold?: boolean;
  /** 本行之后额外空出的高度 */
  gap?: number;
  /** 行首的小图标（牌或角色） */
  icon?: IconRef;
}

      draw: (ctx) => {
        const start = r.y + 4;
        let y = start + this.offset;
        for (const l of lines) {
          const size = l.size ?? 13;
          const iconH = l.icon ? size + 6 : 0;
          const indent = l.icon ? drawIconRef(ctx, l.icon, r.x + 4, y - 2, iconH) + 6 : 0;
          ctx.font = font(size, l.bold);
          const top = y;
          for (const t of wrapText(l.text, r.w - 8 - indent, (s) => ctx.measureText(s).width)) {
            drawText(ctx, t, r.x + 4 + indent, y + size / 2, { size, color: l.color, bold: l.bold });
            y += size + 6;
          }
          y = Math.max(y, top + iconH + 2);
          y += l.gap ?? 0;
        }
        this.contentH = y - this.offset - start;
      },
```

（import 增加 `drawIconRef, type IconRef` 自 `../theme/draw`。）

`client/src/model/rules.ts`：

```ts
import type { CardKind, CharacterId } from '../../../engine/src/index';
import type { IconRef } from '../theme/draw';
import { CHAR_INFO } from './characters';
import { CARD_INFO, type CardColor } from './cards';

export interface RuleItem {
  text: string;
  icon?: IconRef;
}

const plain = (texts: string[]): RuleItem[] => texts.map((text) => ({ text }));

const cardsOf = (color: CardColor): RuleItem[] =>
  (Object.keys(CARD_INFO) as CardKind[])
    .filter((k) => CARD_INFO[k].color === color)
    .map((k) => ({ text: `${CARD_INFO[k].name}：${CARD_INFO[k].desc}`, icon: { card: k } }));

export const RULES: { title: string; items: RuleItem[] }[] = [
  // 原有各节的 items: [...字符串] 一律改为 items: plain([...字符串])
  // 红/蓝/绿/黑卡四节保持 items: cardsOf('red') 等
  {
    title: '角色（公开）',
    items: [
      { text: '少于 7 人时每人从 2 个随机角色中选 1 个；7 人及以上直接随机发。角色对所有人公开。' },
      ...(Object.keys(CHAR_INFO) as CharacterId[]).map((id) => ({ text: `${CHAR_INFO[id].name}：${CHAR_INFO[id].desc}`, icon: { char: id } })),
    ],
  },
];
```

（「胜负」「身份卡」「回合」「审判」「夜晚」「传染」六节的文字一字不改，只是用 `plain([...])` 包起来。）

`client/src/scenes/home.ts`：

```ts
const RULE_LINES: Line[] = RULES.flatMap((s) => [
  { text: s.title, size: 15, bold: true, color: C.gold, gap: 2 },
  ...s.items.map((it, i) => ({ text: it.icon ? it.text : `· ${it.text}`, icon: it.icon, size: 13, gap: i === s.items.length - 1 ? 10 : 2 })),
]);
```

`client/src/scenes/infoPanels.ts`：

- `discardPanel`：每种颜色一行标题，下面每种牌一行带图标：

```ts
  const lines = COLOR_GROUPS.flatMap(([title, color]): Line[] => {
    const kinds = [...new Set(discard.filter((c) => CARD_INFO[c.kind].color === color).map((c) => c.kind))];
    if (!kinds.length) return [];
    return [
      { text: title, size: 14, bold: true, color: C.gold, gap: 2 },
      ...kinds.map((k) => ({ text: `${CARD_INFO[k].name} ×${discard.filter((c) => c.kind === k).length}`, icon: { card: k }, size: 14, gap: 2 })),
      { text: '', size: 4, gap: 4 },
    ];
  });
```

（import 增加 `type Line`。）

- `detailPanel`：sheet 高度 420 → 560；有角色时顶部居中画 96×144 的角色卡，文字从卡下面开始：

```ts
  const card = p.character ? rect(body.x + (body.w - 96) / 2, body.y + 4, 96, 144) : null;
  nodes.push({
    id: 'detail-body',
    rect: body,
    draw: (ctx) => {
      if (card && p.character) drawCharCard(ctx, card, p.character);
      ctx.font = font(14);
      let y = body.y + 12 + (card ? card.h + 10 : 0);
      // …原来的逐行绘制不变…
    },
  });
```

`client/src/scenes/abilityPanels.ts` 的 `priestPanel`：格子高 56 → 78，上半部分画 40×56 的卡面，下面写张数：

```ts
  const h = 78;
  // …
      draw: (ctx) => {
        drawPanel(ctx, r, { fill: mine ? goldGlow(0.2) : C.panel, stroke: mine ? C.gold : C.panelLine, lineWidth: mine ? 2 : 1 });
        drawCardFace(ctx, rect(r.x + (r.w - 40) / 2, r.y + 4, 40, 56), kind);
        drawText(ctx, mine ? `已选 ${mine} / ${ids.length}` : `${ids.length} 张`, r.x + r.w / 2, r.y + 69, {
          size: 11,
          align: 'center',
          color: mine ? C.gold : C.textDim,
        });
      },
```

（`CARD_INFO` 若不再使用则删掉 import；import 增加 `drawCardFace`。）

`client/src/scenes/storyBoard.ts` 的 `drawRow`：把手画的渐变色块加单字换成迷你卡面：

```ts
  const chip = rect(r.x + 34, r.y + 5, 28, r.h - 10);
  drawCardFace(ctx, chip, card.kind);
```

（删掉色块渐变那 10 行和 `info.name.slice(0, 1)` 那行；`CARD_GRADIENT`、`roundRect` 若不再使用则删掉 import。）

`client/src/scenes/choicePanels.ts` 的 `characterPanel`：两张角色卡按 2:3 并排，选中的金框并上浮 6：

```ts
  const { nodes, body } = sheet(ui.screen, 480, '选择你的角色', null, slide, `角色对所有人公开 · 剩余 ${cd} · 超时随机选择`);
  const gap = 10;
  const slot = (body.w - gap) / 2;
  const cw = Math.min(slot, (body.h - 70) / 1.5);
  const ch = cw * 1.5;
  p.offers.forEach((c, i) => {
    const r = rect(body.x + i * (slot + gap) + (slot - cw) / 2, body.y + 6, cw, ch);
    nodes.push({
      id: `character:${c}`,
      rect: r,
      onTap: () => (st.picked = i),
      draw: (ctx) => {
        const sel = st.picked === i;
        const y = r.y - (sel ? 6 : 0);
        if (sel) drawPanel(ctx, rect(r.x - 3, y - 3, r.w + 6, r.h + 6), { fill: C.transparent, stroke: C.gold, lineWidth: 2, radius: 12, glow: 0.9 });
        drawCharCard(ctx, rect(r.x, y, r.w, r.h), c);
      },
    });
  });
  const idx = typeof st.picked === 'number' ? st.picked : null;
  nodes.push(
    requestButton('confirm-character', rect(body.x, body.y + 6 + ch + 14, body.w, 44), '选这个角色', idx !== null ? () => void ui.ctl.act({ type: 'pickCharacter', index: idx }) : null, ui.ctl.busy),
  );
  return nodes;
```

（`CHAR_INFO`、`wrapText`、`font` 若不再使用则删掉 import。）

- [ ] **Step 4: 跑测试确认通过**

Run: `cd client && npx vitest run && npm run typecheck`
Expected: 全部 PASS。重点看这几条现有测试：`选角色 › 两个候选显示技能说明`（角色卡里画了名字和说明）、`选角色 › 小屏上确认按钮在屏幕内`、`玩家详情显示技能说明`、`弃牌堆（2 张）`。

- [ ] **Step 5: 提交**

```bash
git add client/src client/test
git commit -m "feat(client): character cards in pick and detail panels; card icons in priest, storyteller, discard and rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 图鉴页、打包、真机验收

**Files:**
- Create: `client/gallery/gallery.ts`、`client/gallery/build.mjs`
- Modify: `client/package.json`（加 `"gallery": "node gallery/build.mjs"`）
- Modify: `.gitignore`（加 `client/gallery/out/`）
- Modify: `client/tsconfig.json`（`include` 加 `"gallery"`）
- Modify（生成）：`minigame/game.js`
- Modify: `docs/superpowers/specs/2026-10-01-art-design.md`（两条裁定 + 真机验收记录）

- [ ] **Step 1: 图鉴页**

创建 `client/gallery/gallery.ts`：

```ts
import { CHARACTERS, type CardKind, type TryalKind } from '../../engine/src/index';
import { CARD_INFO } from '../src/model/cards';
import { cardBack, cardFace, charCard, portrait, tryalFace } from '../src/theme/art/frames';
import { paintBackdrop, type Backdrop } from '../src/theme/art/scenes';
import { badgeColor } from '../src/theme/palette';

/** 图鉴页：用游戏真实的美术代码把所有图画一遍，供手机上检查。不进小游戏包。 */

const dpr = Math.min(3, window.devicePixelRatio || 1);

function canvas(parent: HTMLElement, w: number, h: number, label: string): CanvasRenderingContext2D {
  const fig = document.createElement('figure');
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  const cap = document.createElement('figcaption');
  cap.textContent = label;
  fig.append(c, cap);
  parent.append(fig);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(dpr, dpr);
  return ctx;
}

function section(title: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  const div = document.createElement('div');
  div.className = 'row';
  document.body.append(h, div);
  return div;
}

const kinds = Object.keys(CARD_INFO) as CardKind[];
const tryals: TryalKind[] = ['witch', 'constable', 'villager'];

const big = section('卡牌（放大）');
for (const k of kinds) cardFace(canvas(big, 120, 168, CARD_INFO[k].name), 120, 168, k);
cardBack(canvas(big, 120, 168, '卡背'), 120, 168);

const hand = section('手牌实际大小 58×84 / 小屏 44×64');
for (const k of kinds) cardFace(canvas(hand, 58, 84, ''), 58, 84, k);
for (const k of kinds) cardFace(canvas(hand, 44, 64, ''), 44, 64, k);

const tiny = section('说书人行 28×40、格子里面前的牌 10×14');
for (const k of kinds) cardFace(canvas(tiny, 28, 40, ''), 28, 40, k);
for (const k of kinds) cardFace(canvas(tiny, 10, 14, ''), 10, 14, k);

const ids = section('身份卡');
for (const t of tryals) tryalFace(canvas(ids, 52, 68, ''), 52, 68, t);
cardBack(canvas(ids, 52, 68, ''), 52, 68);
for (const t of tryals) tryalFace(canvas(ids, 120, 168, ''), 120, 168, t);

const chars = section('角色卡');
for (const id of CHARACTERS) charCard(canvas(chars, 160, 240, ''), 160, 240, id);

const heads = section('头像 24 / 18');
CHARACTERS.forEach((id, i) => portrait(canvas(heads, 24, 24, ''), 24, id, badgeColor(i)));
CHARACTERS.forEach((id, i) => portrait(canvas(heads, 18, 18, ''), 18, id, badgeColor(i)));

const scenes = section('场景（375×667）');
for (const b of ['home', 'lobby', 'table', 'village', 'witch'] as Backdrop[]) paintBackdrop(canvas(scenes, 188, 334, b), 188, 334, b);
```

创建 `client/gallery/build.mjs`：

```js
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

/** 打包图鉴页：一个自带脚本的 HTML，输出到 gallery/out/（不提交） */
const out = await build({
  entryPoints: ['gallery/gallery.ts'],
  bundle: true,
  format: 'iife',
  target: 'es2017',
  write: false,
  logLevel: 'info',
});
const js = out.outputFiles[0].text;
const html = `<title>女巫镇图鉴</title>
<style>
  :root { color-scheme: dark; }
  body { background: #0d0a14; color: #e9dcb8; font-family: -apple-system, "PingFang SC", sans-serif; margin: 0; padding: 16px; }
  h2 { color: #e8c774; font-size: 16px; margin: 24px 0 8px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; }
  figure { margin: 0; display: grid; gap: 2px; justify-items: center; }
  figcaption { font-size: 11px; color: #8a7fa3; }
</style>
<body>
<script>${js.replace(/<\/script/g, '<\/script')}</script>
`;
mkdirSync('gallery/out', { recursive: true });
writeFileSync('gallery/out/gallery.html', html);
console.log('gallery/out/gallery.html');
```

Run: `cd client && npm run typecheck && npm run gallery`
Expected: 输出 `gallery/out/gallery.html`，无报错。

- [ ] **Step 2: 浏览器渲染检查**

用 Edge 无头模式截图检查（Windows）：

```bash
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=1300,2600 --screenshot="<草稿目录>/gallery.png" "file:///D:/UNSW/女巫镇/client/gallery/out/gallery.html"
```

Expected: 截图里 15 张卡、卡背、3 张身份卡、15 张角色卡、5 幅场景都正常显示，没有空白或错位。把 `gallery.html` 作为 Artifact 发布给用户在手机上看。

- [ ] **Step 3: 全部测试、打包、体积检查**

Run:

```bash
cd client && npx vitest run && npm run typecheck && npm run build
ls -l ../minigame/game.js
```

Expected: 全部 PASS；`minigame/game.js` ≤ 115344 + 102400 = 217744 字节。

- [ ] **Step 4: 提交**

```bash
git add client/gallery/gallery.ts client/gallery/build.mjs client/package.json client/tsconfig.json .gitignore minigame/game.js
git commit -m "build: art gallery page and regenerated mini-game bundle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: 真机验收（需要用户）**

用户编译上传体验版 `0.4.0`（云函数不用重新部署），在手机上看：首页、大厅、牌桌（含夜晚变暗）、手牌、格子头像和面前的牌、选角色面板、点格子详情、我的身份卡、牧师面板、说书人面板、弃牌堆、规则页、两种结算页；牌桌操作不卡。

把结果和本计划开头的两条裁定写进设计文档末尾「真机验收（日期）」一节，提交：

```bash
git add docs/superpowers/specs/2026-10-01-art-design.md
git commit -m "docs: art sub-project rulings and on-device acceptance

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
