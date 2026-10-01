# 计划 B2：女巫镇小游戏界面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Canvas 做出可以完整玩一局的女巫镇小游戏界面（月夜烛光风格、网格布局），替换现在的调试界面。

**Architecture:** 新建 `client/`（TypeScript），分为 `core`（不认识规则的轻量界面框架）、`theme`（月夜烛光画法）、`model`（纯逻辑：把 rooms + hands 合成画面数据、判断可做的操作）、`net`（云函数、实时监听、重连、超时推进）、`controller`（应用状态和命令）、`scenes`（首页、大厅、游戏桌、结算）。esbuild 打包成 `minigame/game.js`。规则类型和常量直接从 `engine/src` 引用，房间数据类型从 `server/src/types` 引用（仅类型）。

**Tech Stack:** TypeScript 7、esbuild 0.28、Vitest 5、微信小游戏 Canvas 2D、微信云开发客户端 SDK（`wx.cloud`）。

**Spec:** `docs/superpowers/specs/2026-09-28-plan-b2-minigame-ui-design.md`（上位文档 `docs/superpowers/specs/2026-09-26-witch-town-design.md`）

## Global Constraints

- 界面全部简体中文；只用系统字体 `sans-serif`（不加载字体文件）；**不做音效**。
- **不修改** `server/` 和 `engine/` 的任何文件；云函数接口以 `server/src/handler.ts` 的 `Request` 为准：`createRoom{profile}`、`joinRoom{code,profile}`、`leaveRoom{code}`、`reorderSeats{code,order}`、`addBots{code,count}`、`startGame{code}`、`act{code,action,version}`、`tick{code}`；返回 `{ok:true,data}` 或 `{ok:false,error}`。
- `createRoom` / `joinRoom` 返回 `{ code, openid }`；`startGame` 返回 `{ version }`；`tick` 返回 `{ changed }`。
- 集合：`rooms/{code}`（所有登录用户可读）；`hands/{code}_{openid}`（仅本人可读）。`hands.gameId` 与 `rooms.gameId` 不同时忽略该手牌。
- 服务器错误文案（客户端按原文匹配）：`状态已变化，请重试`（静默刷新）、`房间不存在` / `房间已结束` / `你不在这个房间里`（回首页）。
- 客户端代码在 `client/`，esbuild 输出 `minigame/game.js`（`format: 'iife'`、`target: 'es2017'`、无运行时 npm 依赖）；`minigame/game.js` 是生成文件，**提交进 git**（和 `cloudfunctions/game/index.js` 一样）。
- 从 `client/src/**` 引用引擎：`../../../engine/src/index`（`client/src/model/x.ts` 的写法；`client/src/x.ts` 用 `../../engine/src/index`）；引用房间类型只能用 `import type`，来自 `server/src/types`。
- 视觉：月夜烛光。颜色一律取自 `client/src/theme/palette.ts`。
- 动效每个约 0.3 秒，不阻塞操作。
- 每个提交信息以 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` 结尾。
- 所有命令在 `client/` 目录下运行：`npx vitest run`、`npm run typecheck`、`npm run build`。

## Review Focus

1. **请求进行中连续点按**：同一时间只能有一个请求，按钮显示禁用，连点不会发出第二个请求（Task 5 的 busy 测试）。
2. **同一房号复用时的旧手牌**：`hands.gameId ≠ rooms.gameId` 时不显示旧牌（Task 3 的 `currentHand` 测试）。
3. **断网 / 实时推送中断**：监听报错后自动退避重连，连续 3 次失败改为 3 秒轮询，恢复后停止轮询（Task 4 的 session 测试）。
4. **小屏手机（320×568）和 12 人局**：网格、日志、我的信息栏、手牌、按钮互不重叠，都在屏幕内（Task 7 的布局测试）。
5. **本机时钟偏差和超时推进**：倒计时不显示负数；`tick` 返回 `changed:false` 时 3 秒后重试，同一时间最多一个 `tick`（Task 3 的 `formatCountdown` 测试和 Task 4 的 ticker 测试）。

---

## 文件结构

```
client/
  package.json  tsconfig.json  build.mjs
  src/
    wx.d.ts                 只声明本项目用到的小游戏 API
    main.ts                 入口：创建画布、控制器、场景，处理启动参数和分享菜单
    platform.ts             画布 / 屏幕尺寸 / 触摸事件绑定（依赖 wx，不单测）
    controller.ts           应用状态与命令（建房、加入、出牌…）
    core/
      geom.ts               Rect 与点判断
      node.ts               节点树、绘制、点击判断
      text.ts               文字换行与省略
      tween.ts              补间动画 Animator
      app.ts                场景、按需重画、触摸分发
    theme/
      palette.ts            颜色、字体、头像颜色
      draw.ts               背景 / 面板 / 按钮 / 头像 / 卡牌 / 身份卡的画法
    model/
      cards.ts              卡牌与身份卡的中文名、颜色、说明
      rules.ts              规则速查文字
      log.ts                事件 → 中文句子
      table.ts              rooms + hands → TableModel，阶段标题，倒计时
      actions.ts            ClientAction、可出的牌、可选目标、夜晚步骤
      changes.ts            前后两个 TableModel 的差异（驱动动效）
    net/
      timers.ts  api.ts  storage.ts  session.ts  ticker.ts
    scenes/
      ui.ts                 Ui 接口（场景依赖的全部外部能力）
      widgets.ts            按钮、文字、遮罩、底部面板、滚动框、背景节点
      root.ts               根据状态选择场景
      home.ts  lobby.ts  result.ts
      tableLayout.ts        游戏桌布局计算（纯函数）
      tableParts.ts         玩家格子、我的信息栏的画法
      table.ts              游戏桌场景
      infoPanels.ts         玩家详情、我的身份卡、完整日志
      choicePanels.ts       审判 / 黑猫 / 传染 / 黎明 / 夜晚 选择面板
  test/
    fakes.ts  fixtures.ts  sceneKit.ts  *.test.ts
tools/debug-harness/game.js 原调试界面（从 minigame/game.js 移来）
minigame/game.js            构建产物
```

---

### Task 1: 客户端工程与界面框架 core

**Files:**
- Create: `client/package.json`, `client/tsconfig.json`, `client/build.mjs`, `client/src/wx.d.ts`, `client/src/platform.ts`, `client/src/main.ts`（临时占位画面）
- Create: `client/src/core/geom.ts`, `client/src/core/node.ts`, `client/src/core/text.ts`, `client/src/core/tween.ts`, `client/src/core/app.ts`
- Create: `client/test/fakes.ts`, `client/test/core.test.ts`
- Move: `minigame/game.js` → `tools/debug-harness/game.js`（`git mv`），然后由构建生成新的 `minigame/game.js`

**Interfaces:**
- Produces:
  - `interface Rect { x; y; w; h }`、`rect(x,y,w,h)`、`contains(r,px,py)`、`inset(r,d)`
  - `type Ctx = CanvasRenderingContext2D`；`interface Node { id?; rect; draw?(ctx); onTap?(); onScroll?(dy); children?; clip? }`；`drawNodes(ctx,nodes)`；`hitTest(nodes,x,y,key:'onTap'|'onScroll'): Node|null`；`findNode(nodes,id): Node|null`
  - `type Measure = (s:string)=>number`；`wrapText(text,maxWidth,measure): string[]`；`ellipsize(text,maxWidth,measure): string`
  - `easeOutCubic(t)`；`class Animator { start(key,now,dur=300,data?); progress(key,now): number; data<T>(key): T|undefined; running(key,now): boolean; active(now): boolean }`
  - `interface Screen { W; H; top; bottom }`；`interface Scene { build(now:number): Node[] }`；`class App { animator; screen; clock; setScene(s); render(); draw(); touchStart(x,y); touchMove(x,y); touchEnd(x,y); current: Node[] }`
  - 测试工具 `fakeCtx(): { ctx: Ctx; texts: string[] }`

- [ ] **Step 1: 建工程文件**

`client/package.json`：
```json
{
  "name": "witch-town-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "build": "node build.mjs"
  },
  "devDependencies": {
    "esbuild": "^0.28.2",
    "typescript": "^7.0.2",
    "vitest": "^5.0.2"
  }
}
```

`client/tsconfig.json`：
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": ["src", "test"]
}
```

`client/build.mjs`：
```js
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'neutral',
  target: 'es2017',
  format: 'iife',
  outfile: '../minigame/game.js',
  banner: { js: '// 由 client/build.mjs 生成，请勿手改。修改 client/src 后运行 npm run build。' },
  logLevel: 'info',
});
```

`client/src/wx.d.ts`：
```ts
// 只声明本项目用到的小游戏 API（没有 import/export，是全局声明文件）
interface WxRect { top: number; bottom: number; left: number; right: number; width: number; height: number }
interface WxTouch { identifier: number; clientX: number; clientY: number }
interface WxTouchEvent { touches: WxTouch[]; changedTouches: WxTouch[] }
interface WxLaunchOptions { scene?: number; query?: Record<string, string> }
interface WxWatchHandle { close(): void }
interface WxWatchOptions { onChange(snap: { docs: unknown[] }): void; onError(e: unknown): void }
interface WxDocRef { get(): Promise<{ data: unknown }>; watch(o: WxWatchOptions): WxWatchHandle }
interface WxQueryRef { watch(o: WxWatchOptions): WxWatchHandle }
interface WxCollection { doc(id: string): WxDocRef; where(q: Record<string, unknown>): WxQueryRef }
interface WxDatabase { collection(name: string): WxCollection }
interface WxCanvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D }
interface WxModalResult { confirm: boolean; cancel: boolean; content?: string }

declare const wx: {
  cloud: {
    init(o?: { env?: string; traceUser?: boolean }): void;
    callFunction(o: { name: string; data: unknown }): Promise<{ result?: unknown }>;
    database(): WxDatabase;
  };
  createCanvas(): WxCanvas;
  getSystemInfoSync(): { windowWidth: number; windowHeight: number; pixelRatio: number; safeArea?: WxRect };
  getMenuButtonBoundingClientRect(): WxRect;
  onTouchStart(cb: (e: WxTouchEvent) => void): void;
  onTouchMove(cb: (e: WxTouchEvent) => void): void;
  onTouchEnd(cb: (e: WxTouchEvent) => void): void;
  getLaunchOptionsSync(): WxLaunchOptions;
  onShow(cb: (o: WxLaunchOptions) => void): void;
  showModal(o: {
    title: string;
    content?: string;
    editable?: boolean;
    placeholderText?: string;
    showCancel?: boolean;
    success?(r: WxModalResult): void;
  }): void;
  showToast(o: { title: string; icon?: 'none' | 'success'; duration?: number }): void;
  setClipboardData(o: { data: string }): void;
  shareAppMessage(o: { title: string; query?: string }): void;
  showShareMenu(o: { menus: string[] }): void;
  onShareAppMessage(cb: () => { title: string; query?: string }): void;
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
  removeStorageSync(key: string): void;
};
```

- [ ] **Step 2: 安装依赖并移走调试界面**

```bash
cd client && npm install && cd ..
mkdir -p tools/debug-harness && git mv minigame/game.js tools/debug-harness/game.js
```
在 `tools/debug-harness/game.js` 第一行注释后面追加一行：`// 使用方法：临时把本文件复制为 minigame/game.js 再编译；用完运行 cd client && npm run build 恢复正式界面。`

- [ ] **Step 3: 写 core 的失败测试**

`client/test/fakes.ts`：
```ts
import type { Ctx } from '../src/core/node';

/** 假的 Canvas 上下文：所有方法都是空函数，measureText 按每字 10px 计算，fillText 记录文字 */
export function fakeCtx(): { ctx: Ctx; texts: string[] } {
  const texts: string[] = [];
  const gradient = { addColorStop() {} };
  const base: Record<string, unknown> = {
    measureText: (s: string) => ({ width: [...s].length * 10 }),
    fillText: (s: string) => {
      texts.push(s);
    },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  const ctx = new Proxy(base, {
    get: (t, k) => (k in t ? t[k as string] : () => {}),
    set: (t, k, v) => {
      t[k as string] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as Ctx, texts };
}
```

`client/test/core.test.ts`：
```ts
import { describe, expect, it, vi } from 'vitest';
import { App, type Scene } from '../src/core/app';
import { contains, inset, rect } from '../src/core/geom';
import { findNode, hitTest, type Node } from '../src/core/node';
import { ellipsize, wrapText } from '../src/core/text';
import { Animator, easeOutCubic } from '../src/core/tween';
import { fakeCtx } from './fakes';

const measure = (s: string) => [...s].length * 10;

describe('geom', () => {
  it('contains 包含边界', () => {
    const r = rect(10, 10, 20, 20);
    expect(contains(r, 10, 10)).toBe(true);
    expect(contains(r, 30, 30)).toBe(true);
    expect(contains(r, 31, 15)).toBe(false);
  });
  it('inset 向内收缩', () => {
    expect(inset(rect(0, 0, 100, 50), 5)).toEqual(rect(5, 5, 90, 40));
  });
});

describe('node', () => {
  const tapA = vi.fn();
  const tapB = vi.fn();
  const nodes: Node[] = [
    { id: 'a', rect: rect(0, 0, 100, 100), onTap: tapA },
    { id: 'b', rect: rect(50, 50, 100, 100), onTap: tapB },
    { id: 'box', rect: rect(0, 200, 100, 100), children: [{ id: 'inner', rect: rect(10, 210, 20, 20), onTap: vi.fn() }] },
  ];
  it('重叠时返回后画的（上层）节点', () => {
    expect(hitTest(nodes, 60, 60, 'onTap')?.id).toBe('b');
    expect(hitTest(nodes, 10, 10, 'onTap')?.id).toBe('a');
  });
  it('查找子节点，没有回调的节点不算命中', () => {
    expect(hitTest(nodes, 15, 215, 'onTap')?.id).toBe('inner');
    expect(hitTest(nodes, 80, 280, 'onTap')).toBeNull();
  });
  it('findNode 按 id 递归查找', () => {
    expect(findNode(nodes, 'inner')?.rect).toEqual(rect(10, 210, 20, 20));
    expect(findNode(nodes, 'nope')).toBeNull();
  });
});

describe('text', () => {
  it('按宽度换行，保留原有换行', () => {
    expect(wrapText('一二三四五', 30, measure)).toEqual(['一二三', '四五']);
    expect(wrapText('一二\n三', 100, measure)).toEqual(['一二', '三']);
    expect(wrapText('', 100, measure)).toEqual(['']);
  });
  it('超宽时加省略号', () => {
    expect(ellipsize('一二三四五', 100, measure)).toBe('一二三四五');
    expect(ellipsize('一二三四五', 40, measure)).toBe('一二三…');
  });
});

describe('tween', () => {
  it('easeOutCubic 端点', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });
  it('进度从 0 到 1，结束后不再活跃', () => {
    const a = new Animator();
    a.start('x', 1000, 300, { from: 1 });
    expect(a.progress('x', 1000)).toBe(0);
    expect(a.progress('x', 1150)).toBeGreaterThan(0.5);
    expect(a.running('x', 1150)).toBe(true);
    expect(a.data<{ from: number }>('x')).toEqual({ from: 1 });
    expect(a.progress('x', 1300)).toBe(1);
    expect(a.active(1400)).toBe(false);
    expect(a.progress('unknown', 0)).toBe(1);
  });
});

describe('App', () => {
  function setup(build: (now: number) => Node[]) {
    const frames: (() => void)[] = [];
    const { ctx } = fakeCtx();
    const scene: Scene = { build };
    const app = new App(ctx, { W: 375, H: 667, top: 60, bottom: 667 }, (cb) => frames.push(cb), () => 0);
    app.setScene(scene);
    const flush = () => frames.splice(0).forEach((f) => f());
    return { app, frames, flush };
  }

  it('同一帧内多次 render 只画一次', () => {
    const build = vi.fn(() => []);
    const { app, frames, flush } = setup(build);
    app.render();
    app.render();
    expect(frames).toHaveLength(1);
    flush();
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('点击调用最上层节点的 onTap 并重画', () => {
    const onTap = vi.fn();
    const { app, frames, flush } = setup(() => [{ rect: rect(0, 0, 100, 100), onTap }]);
    flush();
    app.touchStart(10, 10);
    app.touchEnd(12, 11);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(1);
  });

  it('拖动超过 8px 时触发滚动而不是点击', () => {
    const onTap = vi.fn();
    const onScroll = vi.fn();
    const { app, flush } = setup(() => [{ rect: rect(0, 0, 100, 300), onTap, onScroll }]);
    flush();
    app.touchStart(10, 100);
    app.touchMove(10, 90);
    app.touchMove(10, 70);
    app.touchEnd(10, 70);
    expect(onTap).not.toHaveBeenCalled();
    expect(onScroll).toHaveBeenCalledWith(-10);
    expect(onScroll).toHaveBeenCalledWith(-20);
  });

  it('有动画进行中时继续请求下一帧', () => {
    const { app, frames, flush } = setup(() => []);
    app.animator.start('x', 0, 300);
    flush();
    expect(frames).toHaveLength(1);
  });
});
```

- [ ] **Step 4: 运行测试，确认失败**

Run: `cd client && npx vitest run test/core.test.ts`
Expected: FAIL（找不到 `../src/core/...` 模块）

- [ ] **Step 5: 实现 core**

`client/src/core/geom.ts`：
```ts
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
```

`client/src/core/node.ts`：
```ts
import { contains, type Rect } from './geom';

export type Ctx = CanvasRenderingContext2D;

/** 画面上的一个元素。场景每次重画都重新生成节点树（立即模式），节点本身不保存状态。 */
export interface Node {
  /** 测试和调试用的名字 */
  id?: string;
  rect: Rect;
  draw?: (ctx: Ctx) => void;
  onTap?: () => void;
  /** 在该区域内上下拖动时调用，dy 为本次移动量（手指向上为负） */
  onScroll?: (dy: number) => void;
  children?: Node[];
  /** 绘制时裁剪到 rect（滚动列表用） */
  clip?: boolean;
}

export function drawNodes(ctx: Ctx, nodes: Node[]): void {
  for (const n of nodes) {
    ctx.save();
    if (n.clip) {
      ctx.beginPath();
      ctx.rect(n.rect.x, n.rect.y, n.rect.w, n.rect.h);
      ctx.clip();
    }
    n.draw?.(ctx);
    if (n.children) drawNodes(ctx, n.children);
    ctx.restore();
  }
}

/** 返回位于 (x, y)、带有指定回调的最上层节点（后画的在上层，子节点在父节点之上） */
export function hitTest(nodes: Node[], x: number, y: number, key: 'onTap' | 'onScroll'): Node | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.children) {
      const hit = hitTest(n.children, x, y, key);
      if (hit) return hit;
    }
    if (n[key] && contains(n.rect, x, y)) return n;
  }
  return null;
}

export function findNode(nodes: Node[], id: string): Node | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const hit = findNode(n.children, id);
      if (hit) return hit;
    }
  }
  return null;
}
```

`client/src/core/text.ts`：
```ts
export type Measure = (s: string) => number;

/** 按字符换行（中文没有空格分词），保留文本里原有的换行 */
export function wrapText(text: string, maxWidth: number, measure: Measure): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const ch of para) {
      if (line && measure(line + ch) > maxWidth) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function ellipsize(text: string, maxWidth: number, measure: Measure): string {
  if (measure(text) <= maxWidth) return text;
  const chars = [...text];
  while (chars.length > 0 && measure(chars.join('') + '…') > maxWidth) chars.pop();
  return chars.join('') + '…';
}
```

`client/src/core/tween.ts`：
```ts
export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

interface Item {
  start: number;
  dur: number;
  data: unknown;
}

/** 按 key 管理的补间动画。progress 返回缓动后的 0→1；没有这个动画或已结束时返回 1。 */
export class Animator {
  private items = new Map<string, Item>();

  start(key: string, now: number, dur = 300, data?: unknown): void {
    this.items.set(key, { start: now, dur, data });
  }

  progress(key: string, now: number): number {
    const it = this.items.get(key);
    if (!it) return 1;
    const t = (now - it.start) / it.dur;
    return t >= 1 ? 1 : easeOutCubic(Math.max(0, t));
  }

  data<T>(key: string): T | undefined {
    return this.items.get(key)?.data as T | undefined;
  }

  running(key: string, now: number): boolean {
    const it = this.items.get(key);
    return !!it && now < it.start + it.dur;
  }

  /** 是否还有动画在进行；顺便清理已结束的动画 */
  active(now: number): boolean {
    let any = false;
    for (const [key, it] of this.items) {
      if (now >= it.start + it.dur) this.items.delete(key);
      else any = true;
    }
    return any;
  }

  keys(): string[] {
    return [...this.items.keys()];
  }
}
```

`client/src/core/app.ts`：
```ts
import { drawNodes, hitTest, type Ctx, type Node } from './node';
import { Animator } from './tween';

export interface Screen {
  W: number;
  H: number;
  /** 内容区顶部（右上角胶囊按钮下沿之下） */
  top: number;
  /** 内容区底部（安全区下沿） */
  bottom: number;
}

export interface Scene {
  build(now: number): Node[];
}

interface Touch {
  x0: number;
  y0: number;
  lastY: number;
  moved: boolean;
  scroll: Node | null;
}

export class App {
  readonly animator = new Animator();
  private scene: Scene | null = null;
  private nodes: Node[] = [];
  private scheduled = false;
  private touch: Touch | null = null;

  constructor(
    private readonly ctx: Ctx,
    readonly screen: Screen,
    private readonly raf: (cb: () => void) => void,
    readonly clock: () => number,
  ) {}

  setScene(scene: Scene): void {
    this.scene = scene;
    this.render();
  }

  /** 请求在下一帧重画；同一帧内多次调用只画一次 */
  render(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    this.raf(() => {
      this.scheduled = false;
      this.draw();
    });
  }

  draw(): void {
    if (!this.scene) return;
    const now = this.clock();
    this.nodes = this.scene.build(now);
    this.ctx.clearRect(0, 0, this.screen.W, this.screen.H);
    drawNodes(this.ctx, this.nodes);
    if (this.animator.active(now)) this.render();
  }

  get current(): Node[] {
    return this.nodes;
  }

  touchStart(x: number, y: number): void {
    this.touch = { x0: x, y0: y, lastY: y, moved: false, scroll: hitTest(this.nodes, x, y, 'onScroll') };
  }

  touchMove(x: number, y: number): void {
    const t = this.touch;
    if (!t) return;
    if (!t.moved && Math.abs(x - t.x0) + Math.abs(y - t.y0) > 8) t.moved = true;
    if (t.moved && t.scroll) {
      t.scroll.onScroll!(y - t.lastY);
      this.render();
    }
    t.lastY = y;
  }

  touchEnd(x: number, y: number): void {
    const t = this.touch;
    this.touch = null;
    if (!t || t.moved) return;
    const n = hitTest(this.nodes, x, y, 'onTap');
    if (n) {
      n.onTap!();
      this.render();
    }
  }
}
```

注意 `onScroll` 测试：第一次 `touchMove(10,90)` 移动 10px 超过阈值，`moved` 变为 true 并以 `90-100=-10` 调用；第二次以 `70-90=-20` 调用。

- [ ] **Step 6: 运行测试，确认通过**

Run: `cd client && npx vitest run test/core.test.ts`
Expected: PASS

- [ ] **Step 7: 平台层和占位入口**

`client/src/platform.ts`：
```ts
import type { App, Screen } from './core/app';
import type { Ctx } from './core/node';

/** 创建全屏画布，按像素比缩放，计算内容区（避开右上角胶囊按钮和底部安全区） */
export function createPlatform(): { ctx: Ctx; screen: Screen } {
  const canvas = wx.createCanvas();
  const info = wx.getSystemInfoSync();
  const dpr = info.pixelRatio || 2;
  canvas.width = info.windowWidth * dpr;
  canvas.height = info.windowHeight * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  let top = 64;
  try {
    top = wx.getMenuButtonBoundingClientRect().bottom + 8;
  } catch {
    // 个别环境拿不到胶囊按钮位置，用默认值
  }
  const bottom = info.safeArea ? Math.min(info.safeArea.bottom, info.windowHeight) : info.windowHeight;
  return { ctx, screen: { W: info.windowWidth, H: info.windowHeight, top, bottom } };
}

export function bindTouches(app: App): void {
  wx.onTouchStart((e) => {
    const t = e.touches[0];
    if (t) app.touchStart(t.clientX, t.clientY);
  });
  wx.onTouchMove((e) => {
    const t = e.touches[0];
    if (t) app.touchMove(t.clientX, t.clientY);
  });
  wx.onTouchEnd((e) => {
    const t = e.changedTouches[0];
    if (t) app.touchEnd(t.clientX, t.clientY);
  });
}
```

`client/src/main.ts`（临时占位，Task 6 替换）：
```ts
import { App } from './core/app';
import { rect } from './core/geom';
import { bindTouches, createPlatform } from './platform';

const { ctx, screen } = createPlatform();
const app = new App(ctx, screen, (cb) => requestAnimationFrame(() => cb()), () => Date.now());
bindTouches(app);
app.setScene({
  build: () => [
    {
      rect: rect(0, 0, screen.W, screen.H),
      draw: (c) => {
        c.fillStyle = '#1a1326';
        c.fillRect(0, 0, screen.W, screen.H);
        c.fillStyle = '#e8c774';
        c.font = 'bold 28px sans-serif';
        c.textAlign = 'center';
        c.fillText('女巫镇 · 建设中', screen.W / 2, screen.H / 2);
      },
    },
  ],
});
```

- [ ] **Step 8: 类型检查与构建**

Run: `cd client && npm run typecheck && npm run build`
Expected: 无错误；生成 `minigame/game.js`，第一行是「由 client/build.mjs 生成」的注释。

- [ ] **Step 9: 提交**

```bash
git add client tools minigame/game.js
git commit -m "feat(client): scaffold mini game client and core UI framework

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 月夜烛光主题、卡牌资料、通用部件

**Files:**
- Create: `client/src/model/cards.ts`, `client/src/model/rules.ts`
- Create: `client/src/theme/palette.ts`, `client/src/theme/draw.ts`
- Create: `client/src/scenes/ui.ts`, `client/src/scenes/widgets.ts`
- Test: `client/test/theme.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `Rect`、`Node`、`Ctx`、`wrapText`、`ellipsize`、`Screen`、`Animator`
- Produces:
  - `type CardColor = 'red'|'blue'|'green'|'black'`；`CARD_INFO: Record<CardKind,{name;color;desc}>`；`TRYAL_NAME: Record<TryalKind,string>`；`TRYAL_SHORT`；`RULES: {title;items:string[]}[]`
  - `C`（颜色表）、`CARD_GRADIENT`、`font(size,bold?)`、`badgeColor(seat)`
  - `roundRect`、`drawText(ctx,text,x,y,opts)`、`drawSky(ctx,W,H,darkness)`、`drawPanel(ctx,r,opts)`、`drawButton(ctx,r,label,style)`、`drawBadge(ctx,cx,cy,radius,name,seat)`、`drawCardFace(ctx,r,kind,opts)`、`drawTryalChip(ctx,r,kind,revealed,scaleX?)`
  - `interface Ui`（见 Step 5）
  - 部件：`button(id,r,label,onTap|null,style?)`、`textNode(r,text,opts)`、`skyNode(screen,darkness)`、`overlay(screen,onTap?)`、`sheet(screen,height,title,onClose|null,slide?) → {nodes, body}`、`clampScroll(offset,contentH,viewH)`、`class ScrollBox { offset; node(id,r,lines); reset() }`、`interface Line { text; size?; color?; bold?; gap? }`

- [ ] **Step 1: 写失败测试**

`client/test/theme.test.ts`：
```ts
import { describe, expect, it, vi } from 'vitest';
import { rect } from '../src/core/geom';
import { CARD_INFO, TRYAL_NAME } from '../src/model/cards';
import { RULES } from '../src/model/rules';
import { drawButton } from '../src/theme/draw';
import { badgeColor } from '../src/theme/palette';
import { button, clampScroll, ScrollBox } from '../src/scenes/widgets';
import { fakeCtx } from './fakes';

describe('卡牌资料', () => {
  it('15 种卡都有中文名、颜色和说明', () => {
    const kinds = Object.keys(CARD_INFO);
    expect(kinds).toHaveLength(15);
    for (const k of kinds) {
      const info = CARD_INFO[k as keyof typeof CARD_INFO];
      expect(info.name.length).toBeGreaterThan(0);
      expect(info.desc.length).toBeGreaterThan(0);
    }
    expect(CARD_INFO.accusation).toMatchObject({ name: '指控', color: 'red' });
    expect(CARD_INFO.piety).toMatchObject({ name: '信徒', color: 'blue' });
    expect(CARD_INFO.stocks).toMatchObject({ name: '拘留', color: 'green' });
    expect(CARD_INFO.conspiracy).toMatchObject({ name: '传染', color: 'black' });
    expect(TRYAL_NAME).toEqual({ witch: '女巫', constable: '警长', villager: '村民' });
  });
  it('规则速查有内容', () => {
    expect(RULES.length).toBeGreaterThan(3);
    expect(RULES.every((s) => s.items.length > 0)).toBe(true);
  });
});

describe('主题', () => {
  it('12 个座位的头像颜色互不相同', () => {
    const colors = Array.from({ length: 12 }, (_, i) => badgeColor(i));
    expect(new Set(colors).size).toBe(12);
  });
  it('按钮画出文字', () => {
    const { ctx, texts } = fakeCtx();
    drawButton(ctx, rect(0, 0, 100, 40), '抽 2 张', 'primary');
    expect(texts).toContain('抽 2 张');
  });
});

describe('部件', () => {
  it('禁用按钮没有 onTap', () => {
    expect(button('b', rect(0, 0, 10, 10), 'x', null).onTap).toBeUndefined();
    const f = vi.fn();
    button('b', rect(0, 0, 10, 10), 'x', f).onTap!();
    expect(f).toHaveBeenCalled();
  });
  it('滚动范围限制在内容之内', () => {
    expect(clampScroll(10, 500, 200)).toBe(0);
    expect(clampScroll(-400, 500, 200)).toBe(-300);
    expect(clampScroll(-100, 500, 200)).toBe(-100);
    expect(clampScroll(-50, 100, 200)).toBe(0);
  });
  it('ScrollBox 画完后才知道内容高度，滚动被限制', () => {
    const box = new ScrollBox();
    const node = box.node('list', rect(0, 0, 100, 50), Array.from({ length: 20 }, () => ({ text: '一行' })));
    const { ctx } = fakeCtx();
    node.draw!(ctx);
    node.onScroll!(-10000);
    expect(box.offset).toBeLessThan(0);
    expect(box.offset).toBeGreaterThan(-10000);
    node.onScroll!(99999);
    expect(box.offset).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd client && npx vitest run test/theme.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 卡牌资料与规则速查**

`client/src/model/cards.ts`：
```ts
import type { CardKind, TryalKind } from '../../../engine/src/index';

export type CardColor = 'red' | 'blue' | 'green' | 'black';

export const CARD_INFO: Record<CardKind, { name: string; color: CardColor; desc: string }> = {
  accusation: { name: '指控', color: 'red', desc: '指控点 +1' },
  evidence: { name: '证据', color: 'red', desc: '指控点 +3' },
  witness: { name: '目击', color: 'red', desc: '指控点 +7' },
  blackCat: { name: '黑猫', color: 'blue', desc: '传染时，持有者先翻开自己一张身份卡' },
  matchmaker: { name: '情侣', color: 'blue', desc: '两名持有者同生共死' },
  asylum: { name: '避难', color: 'blue', desc: '夜晚不会被女巫杀死' },
  piety: { name: '信徒', color: 'blue', desc: '其他玩家不能对持有者打出红卡' },
  scapegoat: { name: '嫁祸', color: 'green', desc: '把一名玩家面前的所有卡转给另一名玩家' },
  robbery: { name: '抢劫', color: 'green', desc: '把一名玩家的所有手牌交给另一名玩家' },
  arson: { name: '纵火', color: 'green', desc: '丢弃一名玩家的所有手牌' },
  curse: { name: '诅咒', color: 'green', desc: '丢弃一名玩家面前的一张蓝卡' },
  stocks: { name: '拘留', color: 'green', desc: '目标跳过自己的下一回合' },
  alibi: { name: '辩护', color: 'green', desc: '丢弃一名玩家面前最多 3 张指控或 1 张证据' },
  night: { name: '夜晚', color: 'black', desc: '抽到立即结算：夜晚降临' },
  conspiracy: { name: '传染', color: 'black', desc: '抽到立即结算：每人从左边玩家处盲抽一张身份卡' },
};

export const TRYAL_NAME: Record<TryalKind, string> = { witch: '女巫', constable: '警长', villager: '村民' };

/** 格子里身份卡小方块上的单字 */
export const TRYAL_SHORT: Record<TryalKind, string> = { witch: '巫', constable: '警', villager: '民' };
```

`client/src/model/rules.ts`：
```ts
import { CARD_INFO, type CardColor } from './cards';

const cardsOf = (color: CardColor): string[] =>
  Object.values(CARD_INFO)
    .filter((c) => c.color === color)
    .map((c) => `${c.name}：${c.desc}`);

export const RULES: { title: string; items: string[] }[] = [
  {
    title: '胜负',
    items: ['所有女巫卡都被翻开：村民胜利。', '活着的玩家全都是女巫阵营：女巫胜利。'],
  },
  {
    title: '身份卡',
    items: [
      '每人 5 张，只有自己知道内容。4–5 人 1 张女巫卡，6 人以上 2 张；警长 1 张，其余是村民。',
      '翻出女巫卡，或 5 张全部翻开，立即死亡。',
      '开局持有女巫卡的人属于女巫阵营；之后通过传染拿到女巫卡的人也加入女巫阵营，阵营不会再变。',
    ],
  },
  {
    title: '回合',
    items: ['轮到你时二选一：抽 2 张牌，或打出任意张红 / 蓝 / 绿卡。', '红卡不能打给自己，蓝卡和绿卡可以。'],
  },
  {
    title: '审判',
    items: [
      '面前红卡点数达到 7 点立即受审，由受审者自己翻开一张身份卡。',
      '审判结束后，丢弃受审者面前所有红卡。',
    ],
  },
  {
    title: '夜晚',
    items: [
      '女巫阵营一起选一名玩家击杀；警长保护一名其他玩家；所有人都可以自首（翻开一张自己的身份卡），自首的人当晚不会被杀。',
      '被选中的人没有被保护、没有避难、也没有自首时死亡。',
    ],
  },
  {
    title: '传染',
    items: ['黑猫持有者先翻开一张身份卡；然后每个活着的人从左边玩家的未翻开身份卡里盲抽一张。'],
  },
  { title: '红卡', items: cardsOf('red') },
  { title: '蓝卡（留在面前持续生效）', items: cardsOf('blue') },
  { title: '绿卡（一次性）', items: cardsOf('green') },
  { title: '黑卡（抽到立即结算）', items: cardsOf('black') },
];
```

- [ ] **Step 4: 调色板与画法**

`client/src/theme/palette.ts`：
```ts
import type { CardColor } from '../model/cards';

export const C = {
  skyTop: '#3a2a5c',
  skyMid: '#1a1326',
  skyBottom: '#0d0a14',
  gold: '#e8c774',
  goldDark: '#b8913e',
  goldLine: '#d6a44a',
  text: '#e9dcb8',
  textDim: '#bfb2d6',
  textMuted: '#8a7fa3',
  panel: 'rgba(255,255,255,0.05)',
  panelSolid: '#221833',
  panelLine: '#4a3a6c',
  logBg: 'rgba(0,0,0,0.35)',
  danger: '#c0394d',
  moon: '#f1e3b3',
  overlay: 'rgba(8,5,14,0.72)',
  tryalHidden: '#2e2446',
  witch: '#b3263a',
  constable: '#c9a24a',
  villager: '#6b6384',
} as const;

export const CARD_GRADIENT: Record<CardColor, [string, string]> = {
  red: ['#7a1428', '#4a0a18'],
  blue: ['#233d6e', '#142546'],
  green: ['#265a45', '#143528'],
  black: ['#2b2b2b', '#0e0e0e'],
};

const BADGE_COLORS = [
  '#8e3b5a', '#3b6e8e', '#5a8e3b', '#8e6a3b', '#6a3b8e', '#3b8e7a',
  '#8e3b3b', '#3b4a8e', '#7a8e3b', '#8e3b82', '#3b8e4a', '#8e5a3b',
];

export const badgeColor = (seat: number): string => BADGE_COLORS[((seat % 12) + 12) % 12];

export const font = (size: number, bold = false): string => `${bold ? 'bold ' : ''}${size}px sans-serif`;
```

`client/src/theme/draw.ts`：
```ts
import type { CardKind, TryalKind } from '../../../engine/src/index';
import type { Rect } from '../core/geom';
import type { Ctx } from '../core/node';
import { ellipsize, wrapText } from '../core/text';
import { CARD_INFO, TRYAL_SHORT } from '../model/cards';
import { badgeColor, C, CARD_GRADIENT, font } from './palette';

export function roundRect(ctx: Ctx, r: Rect, radius: number): void {
  const rr = Math.max(0, Math.min(radius, r.w / 2, r.h / 2));
  ctx.beginPath();
  ctx.moveTo(r.x + rr, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rr);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rr);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rr);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rr);
  ctx.closePath();
}

export interface TextOpts {
  size?: number;
  color?: string;
  bold?: boolean;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  maxWidth?: number;
}

export function drawText(ctx: Ctx, text: string, x: number, y: number, o: TextOpts = {}): void {
  ctx.font = font(o.size ?? 14, o.bold);
  ctx.fillStyle = o.color ?? C.text;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'middle';
  const t = o.maxWidth ? ellipsize(text, o.maxWidth, (s) => ctx.measureText(s).width) : text;
  ctx.fillText(t, x, y);
}

/** 夜空背景：渐变、弯月、星星；darkness 0→1 叠加一层更深的夜色 */
export function drawSky(ctx: Ctx, W: number, H: number, darkness: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.skyTop);
  g.addColorStop(0.55, C.skyMid);
  g.addColorStop(1, C.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.25 + (i % 5) * 0.1;
    ctx.fillRect((i * 97 + 13) % W, (i * 57 + 7) % (H * 0.5), 1.5, 1.5);
  }
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = C.moon;
  ctx.beginPath();
  ctx.arc(W - 60, H * 0.16, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(W - 51, H * 0.16 - 7, 20, 0, Math.PI * 2);
  ctx.fill();
  if (darkness > 0) {
    ctx.fillStyle = `rgba(4,2,10,${0.55 * darkness})`;
    ctx.fillRect(0, 0, W, H);
  }
}

export interface PanelOpts {
  fill?: string;
  stroke?: string;
  radius?: number;
  glow?: number;
  lineWidth?: number;
}

export function drawPanel(ctx: Ctx, r: Rect, o: PanelOpts = {}): void {
  roundRect(ctx, r, o.radius ?? 8);
  if (o.glow) {
    ctx.shadowColor = `rgba(232,199,116,${o.glow})`;
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = o.fill ?? C.panel;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = o.lineWidth ?? 1;
  ctx.strokeStyle = o.stroke ?? C.panelLine;
  ctx.stroke();
}

export type ButtonStyle = 'primary' | 'secondary' | 'danger' | 'disabled';

export function drawButton(ctx: Ctx, r: Rect, label: string, style: ButtonStyle): void {
  if (style === 'primary') {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, C.gold);
    g.addColorStop(1, C.goldDark);
    roundRect(ctx, r, 10);
    ctx.fillStyle = g;
    ctx.fill();
  } else {
    drawPanel(ctx, r, {
      radius: 10,
      fill: style === 'danger' ? 'rgba(192,57,77,0.25)' : 'rgba(0,0,0,0.25)',
      stroke: style === 'disabled' ? C.panelLine : style === 'danger' ? C.danger : C.gold,
    });
  }
  const color = style === 'primary' ? C.skyMid : style === 'disabled' ? C.textMuted : style === 'danger' ? C.danger : C.gold;
  drawText(ctx, label, r.x + r.w / 2, r.y + r.h / 2, { size: 15, bold: true, color, align: 'center', maxWidth: r.w - 8 });
}

/** 圆形头像徽章：名字首字 + 座位专属颜色 */
export function drawBadge(ctx: Ctx, cx: number, cy: number, radius: number, name: string, seat: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = badgeColor(seat);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(232,199,116,0.7)';
  ctx.stroke();
  drawText(ctx, [...name][0] ?? '?', cx, cy + 1, { size: Math.round(radius * 1.05), bold: true, color: '#fff', align: 'center' });
}

export interface CardOpts {
  selected?: boolean;
  dim?: boolean;
}

export function drawCardFace(ctx: Ctx, r: Rect, kind: CardKind, o: CardOpts = {}): void {
  const info = CARD_INFO[kind];
  const [a, b] = CARD_GRADIENT[info.color];
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  if (o.dim) ctx.globalAlpha = 0.55;
  roundRect(ctx, r, 7);
  if (o.selected) {
    ctx.shadowColor = 'rgba(232,199,116,0.9)';
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = o.selected ? 2 : 1;
  ctx.strokeStyle = C.goldLine;
  ctx.stroke();
  drawText(ctx, info.name, r.x + r.w / 2, r.y + 16, { size: 14, bold: true, color: '#f3d9a0', align: 'center' });
  ctx.font = font(9);
  const lines = wrapText(info.desc, r.w - 8, (s) => ctx.measureText(s).width).slice(0, 4);
  lines.forEach((line, i) => drawText(ctx, line, r.x + r.w / 2, r.y + 34 + i * 12, { size: 9, color: '#f3d9a0', align: 'center' }));
  ctx.globalAlpha = 1;
}

/** 身份卡小方块：未翻开是暗色金边；翻开显示种类单字。scaleX 用于翻转动画（0→1） */
export function drawTryalChip(ctx: Ctx, r: Rect, kind: TryalKind | null, revealed: boolean, scaleX = 1): void {
  const w = r.w * Math.max(0.05, scaleX);
  const x = r.x + (r.w - w) / 2;
  const fill = !revealed || !kind ? C.tryalHidden : kind === 'witch' ? C.witch : kind === 'constable' ? C.constable : C.villager;
  roundRect(ctx, { x, y: r.y, w, h: r.h }, 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = revealed ? 'rgba(255,255,255,0.4)' : C.goldDark;
  ctx.stroke();
  if (revealed && kind && scaleX > 0.6) {
    drawText(ctx, TRYAL_SHORT[kind], r.x + r.w / 2, r.y + r.h / 2 + 0.5, { size: Math.max(8, r.h - 4), color: '#fff', align: 'center' });
  }
}
```

- [ ] **Step 5: Ui 接口与通用部件**

`client/src/scenes/ui.ts`：
```ts
import type { Screen } from '../core/app';
import type { Animator } from '../core/tween';
import type { Controller } from '../controller';

/** 场景需要的全部外部能力；测试时用假的实现 */
export interface Ui {
  screen: Screen;
  animator: Animator;
  ctl: Controller;
  render(): void;
  /** 弹出输入框；用户点确定时回调（已去掉首尾空格） */
  prompt(title: string, placeholder: string, cb: (text: string) => void, cancellable?: boolean): void;
  confirm(title: string, content: string, cb: () => void): void;
  copy(text: string): void;
  share(title: string, query: string): void;
}
```

（`Controller` 在 Task 5 实现。为了让本任务能通过类型检查，本步骤同时创建 `client/src/controller.ts` 的最小占位：`export class Controller {}`，Task 5 会整体替换。）

`client/src/scenes/widgets.ts`：
```ts
import type { Screen } from '../core/app';
import { rect, type Rect } from '../core/geom';
import type { Node } from '../core/node';
import { wrapText } from '../core/text';
import { drawButton, drawPanel, drawSky, drawText, type TextOpts } from '../theme/draw';
import { C, font } from '../theme/palette';

export type WidgetButtonStyle = 'primary' | 'secondary' | 'danger';

/** onTap 为 null 时按钮显示为禁用 */
export function button(id: string, r: Rect, label: string, onTap: (() => void) | null, style: WidgetButtonStyle = 'primary'): Node {
  return {
    id,
    rect: r,
    onTap: onTap ?? undefined,
    draw: (ctx) => drawButton(ctx, r, label, onTap ? style : 'disabled'),
  };
}

export function textNode(r: Rect, text: string, o: TextOpts = {}): Node {
  const align = o.align ?? 'left';
  const x = align === 'center' ? r.x + r.w / 2 : align === 'right' ? r.x + r.w : r.x;
  return { rect: r, draw: (ctx) => drawText(ctx, text, x, r.y + r.h / 2, { maxWidth: r.w, ...o }) };
}

export function skyNode(screen: Screen, darkness: number): Node {
  return { rect: rect(0, 0, screen.W, screen.H), draw: (ctx) => drawSky(ctx, screen.W, screen.H, darkness) };
}

/** 全屏半透明遮罩，拦住下面的点击；onTap 常用于「点空白处关闭」 */
export function overlay(screen: Screen, onTap?: () => void): Node {
  return {
    id: 'overlay',
    rect: rect(0, 0, screen.W, screen.H),
    onTap: onTap ?? (() => {}),
    draw: (ctx) => {
      ctx.fillStyle = C.overlay;
      ctx.fillRect(0, 0, screen.W, screen.H);
    },
  };
}

/** 从底部弹出的面板。slide 为 0→1 的滑出进度。返回节点和内容区 body。 */
export function sheet(
  screen: Screen,
  height: number,
  title: string,
  onClose: (() => void) | null,
  slide = 1,
  subtitle?: string,
): { nodes: Node[]; body: Rect } {
  const h = Math.min(height, screen.H - screen.top);
  const y = screen.H - h * slide;
  const panel = rect(0, y, screen.W, h + 16);
  const nodes: Node[] = [
    overlay(screen, onClose ?? undefined),
    {
      id: 'sheet',
      rect: panel,
      onTap: () => {},
      draw: (ctx) => {
        drawPanel(ctx, panel, { fill: C.panelSolid, stroke: C.goldLine, radius: 16 });
        drawText(ctx, title, 20, y + 26, { size: 17, bold: true, color: C.gold, maxWidth: screen.W - 120 });
        if (subtitle) drawText(ctx, subtitle, 20, y + 50, { size: 12, color: C.textDim, maxWidth: screen.W - 40 });
      },
    },
  ];
  if (onClose) nodes.push(button('sheet-close', rect(screen.W - 76, y + 10, 60, 32), '关闭', onClose, 'secondary'));
  const bodyTop = y + (subtitle ? 66 : 50);
  return { nodes, body: rect(16, bodyTop, screen.W - 32, screen.bottom - bodyTop - 12) };
}

export function clampScroll(offset: number, contentH: number, viewH: number): number {
  const min = Math.min(0, viewH - contentH);
  return Math.max(min, Math.min(0, offset));
}

export interface Line {
  text: string;
  size?: number;
  color?: string;
  bold?: boolean;
  /** 本行之后额外空出的高度 */
  gap?: number;
}

/** 可上下拖动的文字列表。内容高度在绘制时才知道，所以第一次绘制前滚动不会生效。 */
export class ScrollBox {
  offset = 0;
  private contentH = 0;

  reset(): void {
    this.offset = 0;
  }

  node(id: string, r: Rect, lines: Line[]): Node {
    return {
      id,
      rect: r,
      clip: true,
      onScroll: (dy) => {
        this.offset = clampScroll(this.offset + dy, this.contentH, r.h);
      },
      draw: (ctx) => {
        const start = r.y + 4;
        let y = start + this.offset;
        for (const l of lines) {
          const size = l.size ?? 13;
          ctx.font = font(size, l.bold);
          for (const t of wrapText(l.text, r.w - 8, (s) => ctx.measureText(s).width)) {
            drawText(ctx, t, r.x + 4, y + size / 2, { size, color: l.color, bold: l.bold });
            y += size + 6;
          }
          y += l.gap ?? 0;
        }
        this.contentH = y - this.offset - start;
      },
    };
  }
}
```

- [ ] **Step 6: 运行测试与类型检查**

Run: `cd client && npx vitest run && npm run typecheck`
Expected: PASS，无类型错误

- [ ] **Step 7: 提交**

```bash
git add client
git commit -m "feat(client): moonlit theme, card data and shared widgets

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: 画面数据 model（日志、TableModel、可做的操作）

**Files:**
- Create: `client/src/model/log.ts`, `client/src/model/table.ts`, `client/src/model/actions.ts`
- Create: `client/test/fixtures.ts`
- Test: `client/test/model.test.ts`

**Interfaces:**
- Consumes: 引擎 `createGame`、`projectPublic`、`projectPrivate`、`seededRng`、`targetCount`、`isRed`、`isBlack` 及类型；服务器类型 `RoomDoc`、`HandDoc`；Task 2 的 `CARD_INFO`、`TRYAL_NAME`
- Produces:
  - `describeEvent(e, name): string`、`visibleEvents(view)`、`logLines(view): string[]`
  - `interface TableModel { code; view; mySeat; me; priv; others; turnSeat; isMyTurn; pending; deadline; winner }`
  - `currentHand(room, hand): HandDoc|null`、`buildTable(room, hand, openid): TableModel|null`、`nameOf(m, seat)`、`phaseTitle(m)`、`formatCountdown(deadline, now)`
  - `type ClientAction`、`type NightPending`、`type NightStep = 'kill'|'protect'|'suspect'`、`type OptionNeed`
  - `playableCardIds(m)`、`cardKindOf(m, id)`、`targetOptions(m, kind, chosen)`、`optionNeed(m, kind, target)`、`ALIBI_CHOICES`、`nightSteps(p)`、`nightTargets(m, step)`、`dawnTargets(m)`、`unrevealedTryals(m)`；并重新导出引擎的 `targetCount`
  - 测试夹具：`newState(n?, seed?)`、`roomOf(s, gameId?)`、`handOf(s, seat, gameId?)`、`lobbyRoom(n)`、`setDay(s, turn, mode?)`、`giveCard(s, seat, kind, id?)`、`GAME_ID`

- [ ] **Step 1: 测试夹具**

`client/test/fixtures.ts`：
```ts
import {
  createGame,
  projectPrivate,
  projectPublic,
  seededRng,
  type CardKind,
  type GameState,
} from '../../engine/src/index';
import type { HandDoc, RoomDoc } from '../../server/src/types';

export const CODE = '1234';
export const GAME_ID = '1234-1';

export function newState(n = 5, seed = 1): GameState {
  return createGame(
    Array.from({ length: n }, (_, i) => ({ openid: `u${i}`, name: `P${i}` })),
    seededRng(seed),
  );
}

export function roomOf(s: GameState, gameId = GAME_ID): RoomDoc {
  return {
    code: CODE,
    host: 'u0',
    status: s.phase.kind === 'ended' ? 'ended' : 'playing',
    seats: s.players.map((p) => ({ openid: p.openid, name: p.name, avatar: '' })),
    view: projectPublic(s),
    deadline: 1_800_000_090_000,
    gameId,
    updatedAt: 0,
  };
}

export function handOf(s: GameState, seat: number, gameId = GAME_ID): HandDoc {
  return { _openid: s.players[seat].openid, roomId: CODE, gameId, view: projectPrivate(s, seat) };
}

export function lobbyRoom(n: number): RoomDoc {
  return {
    code: CODE,
    host: 'u0',
    status: 'lobby',
    seats: Array.from({ length: n }, (_, i) => ({ openid: `u${i}`, name: `P${i}`, avatar: '' })),
    view: null,
    deadline: null,
    gameId: null,
    updatedAt: 0,
  };
}

export function setDay(s: GameState, turn: number, mode: 'choose' | 'playing' | 'drawing' = 'choose'): void {
  s.phase = { kind: 'day', mode };
  s.turn = turn;
}

export function giveCard(s: GameState, seat: number, kind: CardKind, id = `${kind}-x${seat}`): string {
  s.players[seat].hand.push({ id, kind });
  return id;
}
```

- [ ] **Step 2: 写失败测试**

`client/test/model.test.ts`：
```ts
import { describe, expect, it } from 'vitest';
import {
  cardKindOf,
  dawnTargets,
  nightSteps,
  nightTargets,
  optionNeed,
  playableCardIds,
  targetOptions,
  unrevealedTryals,
  type NightPending,
} from '../src/model/actions';
import { describeEvent, logLines } from '../src/model/log';
import { buildTable, currentHand, formatCountdown, phaseTitle } from '../src/model/table';
import { giveCard, handOf, lobbyRoom, newState, roomOf, setDay } from './fixtures';

const name = (seat: number) => `P${seat}`;

describe('日志', () => {
  it('把事件翻译成中文', () => {
    expect(describeEvent({ t: 'play', seat: 0, kind: 'accusation', targets: [2] }, name)).toBe('P0 对 P2 打出「指控」');
    expect(describeEvent({ t: 'play', seat: 1, kind: 'asylum', targets: [1] }, name)).toBe('P1 给自己打出「避难」');
    expect(describeEvent({ t: 'play', seat: 0, kind: 'scapegoat', targets: [1, 2] }, name)).toBe('P0 打出「嫁祸」：P1 → P2');
    expect(describeEvent({ t: 'death', seat: 3, cause: 'lover' }, name)).toBe('P3 死亡：情侣殉情');
    expect(describeEvent({ t: 'reveal', seat: 1, kind: 'witch', cause: 'trial' }, name)).toBe('P1 因审判翻开了「女巫」');
    expect(describeEvent({ t: 'nightResult', target: 2, died: false }, name)).toBe('夜里，女巫袭击了 P2，但 TA 活了下来');
    expect(describeEvent({ t: 'gameEnd', winner: 'witch' }, name)).toBe('女巫胜利！');
  });
  it('死亡时自动翻开的身份卡不单独显示', () => {
    const s = newState();
    s.log.push({ t: 'reveal', seat: 1, kind: 'villager', cause: 'death' }, { t: 'death', seat: 1, cause: 'night' });
    const lines = logLines(roomOf(s).view!);
    expect(lines).toEqual(['游戏开始，共 5 人', 'P1 死亡：夜里被女巫杀死']);
  });
});

describe('TableModel', () => {
  it('大厅阶段没有画面数据', () => {
    expect(buildTable(lobbyRoom(4), null, 'u0')).toBeNull();
  });

  it('其他玩家从我的下一个座位开始按顺时针排列', () => {
    const s = newState(5);
    const m = buildTable(roomOf(s), handOf(s, 2), 'u2')!;
    expect(m.mySeat).toBe(2);
    expect(m.others.map((p) => p.seat)).toEqual([3, 4, 0, 1]);
    expect(m.priv?.seat).toBe(2);
  });

  it('gameId 不同的手牌（上一局残留）被忽略', () => {
    const s = newState(5);
    const room = roomOf(s, 'new-game');
    const stale = handOf(s, 1, 'old-game');
    expect(currentHand(room, stale)).toBeNull();
    const m = buildTable(room, stale, 'u1')!;
    expect(m.priv).toBeNull();
    expect(m.pending).toBeNull();
  });

  it('轮到我时 isMyTurn 为真，pending 是 turn', () => {
    const s = newState(5);
    setDay(s, 3);
    const m = buildTable(roomOf(s), handOf(s, 3), 'u3')!;
    expect(m.isMyTurn).toBe(true);
    expect(m.pending).toEqual({ kind: 'turn', mode: 'choose' });
    expect(phaseTitle(m)).toBe('你的回合');
    const other = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    expect(other.isMyTurn).toBe(false);
    expect(phaseTitle(other)).toBe('P3 的回合');
  });

  it('阶段标题', () => {
    const s = newState(5);
    expect(phaseTitle(buildTable(roomOf(s), null, 'u0')!)).toBe('第一夜：女巫放置黑猫');
    s.phase = { kind: 'night' };
    expect(phaseTitle(buildTable(roomOf(s), null, 'u0')!)).toBe('夜晚');
    s.phase = { kind: 'ended', winner: 'village' };
    const m = buildTable(roomOf(s), null, 'u0')!;
    expect(phaseTitle(m)).toBe('村民胜利');
    expect(m.winner).toBe('village');
  });

  it('倒计时不显示负数', () => {
    expect(formatCountdown(65_000, 0)).toBe('1:05');
    expect(formatCountdown(1_000, 5_000)).toBe('0:00');
    expect(formatCountdown(null, 0)).toBe('');
  });
});

describe('可做的操作', () => {
  it('只有轮到我时才能出牌，黑卡不能出', () => {
    const s = newState(5);
    setDay(s, 0);
    giveCard(s, 0, 'night', 'night-9');
    const mine = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    const ids = playableCardIds(mine);
    expect(ids).not.toContain('night-9');
    expect(ids.length).toBe(s.players[0].hand.length - 1);
    const notMine = buildTable(roomOf(s), handOf(s, 1), 'u1')!;
    expect(playableCardIds(notMine)).toEqual([]);
  });

  it('红卡不能打给自己、死人和信徒持有者', () => {
    const s = newState(5);
    setDay(s, 0);
    s.players[3].alive = false;
    s.players[4].blue.push({ id: 'piety-1', kind: 'piety' });
    const m = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    expect(targetOptions(m, 'accusation', [])).toEqual([1, 2]);
    expect(targetOptions(m, 'asylum', [])).toEqual([0, 1, 2, 4]);
  });

  it('情侣、拘留、诅咒的目标限制；第二个目标不能和第一个相同', () => {
    const s = newState(5);
    setDay(s, 0);
    s.players[1].blue.push({ id: 'matchmaker-1', kind: 'matchmaker' });
    s.players[2].green.push({ id: 'stocks-1', kind: 'stocks' });
    const m = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    expect(targetOptions(m, 'matchmaker', [])).toEqual([0, 2, 3, 4]);
    expect(targetOptions(m, 'stocks', [])).toEqual([0, 1, 3, 4]);
    expect(targetOptions(m, 'curse', [])).toEqual([1]);
    expect(targetOptions(m, 'robbery', [2])).toEqual([0, 1, 3, 4]);
  });

  it('诅咒要选蓝卡，辩护在指控和证据都有时要选', () => {
    const s = newState(5);
    setDay(s, 0);
    s.players[1].blue.push({ id: 'asylum-1', kind: 'asylum' }, { id: 'piety-1', kind: 'piety' });
    s.players[2].red.push({ id: 'accusation-1', kind: 'accusation', points: 1 }, { id: 'evidence-1', kind: 'evidence', points: 3 });
    s.players[3].red.push({ id: 'accusation-2', kind: 'accusation', points: 1 });
    const m = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    const curse = optionNeed(m, 'curse', 1);
    expect(curse?.kind).toBe('curse');
    expect(curse && curse.kind === 'curse' ? curse.cards.map((c) => c.id) : []).toEqual(['asylum-1', 'piety-1']);
    expect(optionNeed(m, 'alibi', 2)).toEqual({ kind: 'alibi' });
    expect(optionNeed(m, 'alibi', 3)).toBeNull();
    expect(optionNeed(m, 'accusation', 2)).toBeNull();
  });

  it('cardKindOf 查手牌种类', () => {
    const s = newState(5);
    setDay(s, 0);
    const id = giveCard(s, 0, 'witness', 'witness-1');
    const m = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    expect(cardKindOf(m, id)).toBe('witness');
    expect(cardKindOf(m, 'nope')).toBeNull();
  });

  it('夜晚步骤与目标', () => {
    const base: NightPending = { kind: 'night', witch: false, votes: null, constable: false, protect: null, confessed: false };
    expect(nightSteps(base)).toEqual(['suspect']);
    expect(nightSteps({ ...base, witch: true, votes: {} })).toEqual(['kill']);
    expect(nightSteps({ ...base, constable: true })).toEqual(['protect']);
    expect(nightSteps({ ...base, witch: true, votes: {}, constable: true })).toEqual(['kill', 'protect']);
    const s = newState(5);
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    s.players[4].alive = false;
    const m = buildTable(roomOf(s), handOf(s, 1), 'u1')!;
    expect(nightTargets(m, 'kill')).toEqual([0, 1, 2, 3]);
    expect(nightTargets(m, 'protect')).toEqual([0, 2, 3]);
    expect(dawnTargets(m)).toEqual([0, 1, 2, 3]);
  });

  it('未翻开的身份卡', () => {
    const s = newState(5);
    s.players[0].tryals[0].revealed = true;
    const m = buildTable(roomOf(s), handOf(s, 0), 'u0')!;
    expect(unrevealedTryals(m)).toHaveLength(4);
  });
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `cd client && npx vitest run test/model.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 4: 实现 log.ts**

`client/src/model/log.ts`：
```ts
import type { GameEvent, PublicView } from '../../../engine/src/index';
import { CARD_INFO, TRYAL_NAME } from './cards';

const REVEAL_CAUSE = { trial: '审判', cat: '黑猫', confess: '自首', death: '死亡' } as const;
const DEATH_CAUSE = {
  night: '夜里被女巫杀死',
  witchRevealed: '翻出了女巫卡',
  allRevealed: '身份卡全部翻开',
  lover: '情侣殉情',
} as const;

export function describeEvent(e: GameEvent, name: (seat: number) => string): string {
  switch (e.t) {
    case 'gameStart':
      return `游戏开始，共 ${e.players} 人`;
    case 'catPlaced':
      return `女巫把黑猫放在了 ${name(e.target)} 面前`;
    case 'turn':
      return `轮到 ${name(e.seat)}`;
    case 'skipped':
      return `${name(e.seat)} 被拘留，跳过这一回合`;
    case 'draw':
      return `${name(e.seat)} 抽了 1 张牌`;
    case 'blackDrawn':
      return `${name(e.seat)} 抽到了「${CARD_INFO[e.kind].name}」`;
    case 'play': {
      const card = CARD_INFO[e.kind].name;
      if (e.targets.length === 2) return `${name(e.seat)} 打出「${card}」：${name(e.targets[0])} → ${name(e.targets[1])}`;
      if (e.targets[0] === e.seat) return `${name(e.seat)} 给自己打出「${card}」`;
      return `${name(e.seat)} 对 ${name(e.targets[0])} 打出「${card}」`;
    }
    case 'trial':
      return `${name(e.target)} 受到审判（发起者：${name(e.initiator)}）`;
    case 'reveal':
      return `${name(e.seat)} 因${REVEAL_CAUSE[e.cause]}翻开了「${TRYAL_NAME[e.kind]}」`;
    case 'death':
      return `${name(e.seat)} 死亡：${DEATH_CAUSE[e.cause]}`;
    case 'conspiracyDone':
      return '传染结束，每个人都拿到了一张新的身份卡';
    case 'nightResult':
      return e.died ? `夜里，${name(e.target)} 遭到女巫袭击身亡` : `夜里，女巫袭击了 ${name(e.target)}，但 TA 活了下来`;
    case 'reshuffle':
      return '弃牌堆洗回了牌堆';
    case 'gameEnd':
      return e.winner === 'village' ? '村民胜利！' : '女巫胜利！';
  }
}

/** 日志里要显示的事件：死亡时自动翻开的身份卡不单独显示 */
export function visibleEvents(view: PublicView): GameEvent[] {
  return view.log.filter((e) => !(e.t === 'reveal' && e.cause === 'death'));
}

export function logLines(view: PublicView): string[] {
  const name = (seat: number) => view.players[seat]?.name ?? `座位 ${seat + 1}`;
  return visibleEvents(view).map((e) => describeEvent(e, name));
}
```

- [ ] **Step 5: 实现 table.ts**

`client/src/model/table.ts`：
```ts
import type { PendingChoice, PrivateView, PublicPlayer, PublicView, Winner } from '../../../engine/src/index';
import type { HandDoc, RoomDoc } from '../../../server/src/types';

export interface TableModel {
  code: string;
  view: PublicView;
  /** 我在本局的座位；不在座位中（观战）时为 null */
  mySeat: number | null;
  me: PublicPlayer | null;
  /** 我的私密视图；手牌文档不属于本局时为 null */
  priv: PrivateView | null;
  /** 其他玩家，从我的下一个座位开始按顺时针排列 */
  others: PublicPlayer[];
  turnSeat: number;
  isMyTurn: boolean;
  pending: PendingChoice | null;
  deadline: number | null;
  winner: Winner | null;
}

/** 只认属于当前这一局的手牌文档（房号复用时旧文档的 gameId 不同） */
export function currentHand(room: RoomDoc, hand: HandDoc | null): HandDoc | null {
  if (!hand || !room.gameId || hand.gameId !== room.gameId || hand.roomId !== room.code) return null;
  return hand;
}

export function buildTable(room: RoomDoc, hand: HandDoc | null, openid: string): TableModel | null {
  const view = room.view;
  if (!view) return null;
  const idx = room.seats.findIndex((s) => s.openid === openid);
  const mySeat = idx >= 0 && idx < view.players.length ? idx : null;
  const n = view.players.length;
  const others =
    mySeat === null ? view.players : Array.from({ length: n - 1 }, (_, k) => view.players[(mySeat + 1 + k) % n]);
  const h = currentHand(room, hand);
  const priv = h && mySeat !== null && h.view.seat === mySeat ? h.view : null;
  const me = mySeat === null ? null : view.players[mySeat];
  return {
    code: room.code,
    view,
    mySeat,
    me,
    priv,
    others,
    turnSeat: view.turn,
    isMyTurn: view.phase.kind === 'day' && view.turn === mySeat && !!me?.alive,
    pending: priv?.pending ?? null,
    deadline: room.deadline,
    winner: view.phase.kind === 'ended' ? view.phase.winner : null,
  };
}

export function nameOf(m: TableModel, seat: number): string {
  return seat === m.mySeat ? '你' : (m.view.players[seat]?.name ?? '');
}

export function phaseTitle(m: TableModel): string {
  const ph = m.view.phase;
  switch (ph.kind) {
    case 'dawn':
      return '第一夜：女巫放置黑猫';
    case 'day':
      return m.isMyTurn ? '你的回合' : `${m.view.players[m.turnSeat].name} 的回合`;
    case 'trialReveal':
      return `审判：${nameOf(m, ph.target)} 翻开身份卡`;
    case 'catReveal':
      return `传染：${nameOf(m, ph.holder)} 翻开身份卡`;
    case 'conspiracyPick':
      return '传染：大家盲抽身份卡';
    case 'night':
      return '夜晚';
    case 'ended':
      return ph.winner === 'village' ? '村民胜利' : '女巫胜利';
  }
}

export function formatCountdown(deadline: number | null, now: number): string {
  if (deadline === null) return '';
  const s = Math.max(0, Math.ceil((deadline - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
```

- [ ] **Step 6: 实现 actions.ts**

`client/src/model/actions.ts`：
```ts
import {
  isBlack,
  isRed,
  targetCount,
  type Card,
  type CardKind,
  type PendingChoice,
  type Tryal,
} from '../../../engine/src/index';
import type { TableModel } from './table';

export { targetCount };

/** 发给云函数 act 的操作（不含 seat，座位由服务器根据 openid 确定） */
export type ClientAction =
  | { type: 'draw' }
  | { type: 'play'; cardId: string; targets: number[]; option?: string }
  | { type: 'endTurn' }
  | { type: 'revealTryal'; tryalId: string }
  | { type: 'witchVote'; target: number }
  | { type: 'protect'; target: number }
  | { type: 'confess'; tryalId: string | null }
  | { type: 'conspiracyPick'; index: number };

export type NightPending = Extract<PendingChoice, { kind: 'night' }>;
export type NightStep = 'kill' | 'protect' | 'suspect';
export type OptionNeed = { kind: 'curse'; cards: Card[] } | { kind: 'alibi' } | null;

export const ALIBI_CHOICES = [
  { value: 'accusation', label: '丢弃最多 3 张指控' },
  { value: 'evidence', label: '丢弃 1 张证据' },
] as const;

export function playableCardIds(m: TableModel): string[] {
  if (m.pending?.kind !== 'turn' || !m.priv) return [];
  return m.priv.hand.filter((c) => !isBlack(c.kind)).map((c) => c.id);
}

export function cardKindOf(m: TableModel, id: string): CardKind | null {
  return m.priv?.hand.find((c) => c.id === id)?.kind ?? null;
}

/** 可选的下一个目标（chosen 是已经选好的目标）。与引擎的限制一致，最终以服务器判定为准。 */
export function targetOptions(m: TableModel, kind: CardKind, chosen: number[]): number[] {
  const out: number[] = [];
  for (const p of m.view.players) {
    if (!p.alive || chosen.includes(p.seat)) continue;
    if (chosen.length === 0) {
      if (isRed(kind) && (p.seat === m.mySeat || p.blue.some((c) => c.kind === 'piety'))) continue;
      if (kind === 'matchmaker' && p.blue.some((c) => c.kind === 'matchmaker')) continue;
      if (kind === 'stocks' && p.green.some((c) => c.kind === 'stocks')) continue;
      if (kind === 'curse' && p.blue.length === 0) continue;
    }
    out.push(p.seat);
  }
  return out;
}

/** 选好目标后是否还要选附加选项：诅咒要选哪张蓝卡；辩护在指控和证据都有时要选丢哪种 */
export function optionNeed(m: TableModel, kind: CardKind, target: number): OptionNeed {
  const p = m.view.players[target];
  if (!p) return null;
  if (kind === 'curse') return { kind: 'curse', cards: p.blue };
  if (kind === 'alibi') {
    const acc = p.red.some((c) => c.kind === 'accusation');
    const evi = p.red.some((c) => c.kind === 'evidence');
    return acc && evi ? { kind: 'alibi' } : null;
  }
  return null;
}

export function nightSteps(p: NightPending): NightStep[] {
  const steps: NightStep[] = [];
  if (p.witch) steps.push('kill');
  if (p.constable) steps.push('protect');
  if (steps.length === 0) steps.push('suspect');
  return steps;
}

export function nightTargets(m: TableModel, step: NightStep): number[] {
  return m.view.players.filter((p) => p.alive && (step === 'kill' || p.seat !== m.mySeat)).map((p) => p.seat);
}

export function dawnTargets(m: TableModel): number[] {
  return m.view.players.filter((p) => p.alive).map((p) => p.seat);
}

export function unrevealedTryals(m: TableModel): Tryal[] {
  return m.priv ? m.priv.tryals.filter((t) => !t.revealed) : [];
}
```

- [ ] **Step 7: 运行测试与类型检查**

Run: `cd client && npx vitest run && npm run typecheck`
Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add client
git commit -m "feat(client): table model, legal actions and event log text

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 联网层 net（云函数、监听与重连、超时推进、本机存储）

**Files:**
- Create: `client/src/net/timers.ts`, `client/src/net/api.ts`, `client/src/net/storage.ts`, `client/src/net/session.ts`, `client/src/net/ticker.ts`
- Modify: `client/test/fakes.ts`（追加 `ManualTimers`、`flush`、`FakeDb`）
- Test: `client/test/net.test.ts`

**Interfaces:**
- Consumes: 服务器类型 `RoomDoc`、`HandDoc`
- Produces:
  - `interface Timers { setTimeout(fn, ms): unknown; clearTimeout(id): void }`、`realTimers`
  - `type ApiResult<T>`、`NETWORK_ERROR`、`interface CloudLike`、`class Api { call<T>(data): Promise<ApiResult<T>> }`
  - `interface StorageLike`、`interface KeyStore { nickname(); setNickname(n); lastRoom(); setLastRoom(c); clearLastRoom() }`、`class LocalStore implements KeyStore`
  - `interface DbLike`、`POLL_MS=3000`、`MAX_BACKOFF_MS=30000`、`POLL_AFTER_FAILURES=3`、`class RoomSession { room; hand; start(); stop(); refresh() }`
  - `TICK_JITTER_MS=1500`、`TICK_RETRY_MS=3000`、`class Ticker { update(deadline); stop() }`

- [ ] **Step 1: 测试工具**

在 `client/test/fakes.ts` 末尾追加：
```ts
import type { Timers } from '../src/net/timers';
import type { DbLike } from '../src/net/session';

/** 等待已排队的 Promise 回调执行完 */
export const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** 手动推进的计时器 */
export class ManualTimers implements Timers {
  now = 0;
  private queue: { at: number; fn: () => void; id: number }[] = [];
  private seq = 0;

  setTimeout = (fn: () => void, ms: number): unknown => {
    const id = ++this.seq;
    this.queue.push({ at: this.now + ms, fn, id });
    return id;
  };

  clearTimeout = (id: unknown): void => {
    this.queue = this.queue.filter((t) => t.id !== id);
  };

  get pending(): number {
    return this.queue.length;
  }

  async advance(ms: number): Promise<void> {
    const end = this.now + ms;
    for (;;) {
      this.queue.sort((a, b) => a.at - b.at);
      const t = this.queue[0];
      if (!t || t.at > end) break;
      this.queue.shift();
      this.now = t.at;
      t.fn();
      await flush();
    }
    this.now = end;
    await flush();
  }
}

type WatchOpts = { onChange(snap: { docs: unknown[] }): void; onError(e: unknown): void };

/** 假的云数据库：记录监听器，可以手动推送数据或报错 */
export class FakeDb implements DbLike {
  docs = new Map<string, unknown>();
  getCalls = 0;
  failGets = false;
  private watchers: { coll: string; opts: WatchOpts; closed: boolean }[] = [];

  collection(coll: string) {
    return {
      doc: (id: string) => ({
        get: async () => {
          this.getCalls++;
          if (this.failGets) throw new Error('network error');
          const d = this.docs.get(`${coll}/${id}`);
          if (d === undefined) throw new Error(`document.get:fail document with _id ${id} does not exist`);
          return { data: d };
        },
        watch: (opts: WatchOpts) => this.addWatch(coll, opts),
      }),
      where: (_q: Record<string, unknown>) => ({ watch: (opts: WatchOpts) => this.addWatch(coll, opts) }),
    };
  }

  private addWatch(coll: string, opts: WatchOpts) {
    const w = { coll, opts, closed: false };
    this.watchers.push(w);
    return {
      close: () => {
        w.closed = true;
      },
    };
  }

  live(coll: string): number {
    return this.watchers.filter((w) => w.coll === coll && !w.closed).length;
  }

  push(coll: string, doc: unknown): void {
    for (const w of this.watchers.filter((x) => x.coll === coll && !x.closed)) w.opts.onChange({ docs: doc ? [doc] : [] });
  }

  error(coll: string): void {
    for (const w of this.watchers.filter((x) => x.coll === coll && !x.closed)) w.opts.onError(new Error('socket closed'));
  }
}
```

- [ ] **Step 2: 写失败测试**

`client/test/net.test.ts`：
```ts
import { describe, expect, it, vi } from 'vitest';
import { Api, NETWORK_ERROR } from '../src/net/api';
import { RoomSession } from '../src/net/session';
import { LocalStore } from '../src/net/storage';
import { Ticker } from '../src/net/ticker';
import { FakeDb, flush, ManualTimers } from './fakes';
import { lobbyRoom } from './fixtures';

describe('Api', () => {
  it('原样返回云函数结果', async () => {
    const api = new Api({ callFunction: async () => ({ result: { ok: true, data: { code: '1234' } } }) });
    expect(await api.call({ type: 'createRoom' })).toEqual({ ok: true, data: { code: '1234' } });
  });
  it('调用失败返回网络错误', async () => {
    const api = new Api({ callFunction: async () => { throw new Error('timeout'); } });
    expect(await api.call({ type: 'tick' })).toEqual({ ok: false, error: NETWORK_ERROR, network: true });
  });
  it('结果格式不对时返回错误', async () => {
    const api = new Api({ callFunction: async () => ({ result: undefined }) });
    expect(await api.call({ type: 'tick' })).toMatchObject({ ok: false, network: true });
  });
});

describe('LocalStore', () => {
  function memory() {
    const m = new Map<string, unknown>();
    return {
      getStorageSync: (k: string) => m.get(k) ?? '',
      setStorageSync: (k: string, v: unknown) => void m.set(k, v),
      removeStorageSync: (k: string) => void m.delete(k),
    };
  }
  it('保存昵称和上一次的房间', () => {
    const s = new LocalStore(memory());
    expect(s.nickname()).toBeNull();
    s.setNickname('小明');
    s.setLastRoom('1234');
    expect(s.nickname()).toBe('小明');
    expect(s.lastRoom()).toBe('1234');
    s.clearLastRoom();
    expect(s.lastRoom()).toBeNull();
  });
  it('存储出错时当作没有', () => {
    const s = new LocalStore({
      getStorageSync: () => { throw new Error('x'); },
      setStorageSync: () => { throw new Error('x'); },
      removeStorageSync: () => { throw new Error('x'); },
    });
    expect(s.nickname()).toBeNull();
    expect(() => s.setNickname('a')).not.toThrow();
  });
});

describe('RoomSession', () => {
  function setup() {
    const db = new FakeDb();
    const timers = new ManualTimers();
    const onChange = vi.fn();
    db.docs.set('rooms/1234', lobbyRoom(2));
    const session = new RoomSession(db, '1234', 'u0', timers, onChange);
    return { db, timers, onChange, session };
  }

  it('开始时先读一次数据再监听；没有手牌文档时 hand 为 null', async () => {
    const { db, onChange, session } = setup();
    session.start();
    await flush();
    expect(session.room?.code).toBe('1234');
    expect(session.hand).toBeNull();
    expect(onChange).toHaveBeenCalled();
    expect(db.live('rooms')).toBe(1);
    expect(db.live('hands')).toBe(1);
  });

  it('收到推送后更新数据', async () => {
    const { db, session } = setup();
    session.start();
    await flush();
    db.push('rooms', { ...lobbyRoom(3) });
    expect(session.room?.seats).toHaveLength(3);
  });

  it('监听出错后退避重连，连续 3 次失败改为轮询，恢复后停止轮询', async () => {
    const { db, timers, session } = setup();
    session.start();
    await flush();
    db.error('rooms');
    expect(db.live('rooms')).toBe(0);
    expect(db.live('hands')).toBe(0);
    await timers.advance(1000);
    expect(db.live('rooms')).toBe(1);
    db.error('hands');
    await timers.advance(2000);
    db.error('rooms');
    const before = db.getCalls;
    await timers.advance(3000);
    expect(db.getCalls).toBeGreaterThan(before);
    await timers.advance(1000);
    expect(db.live('rooms')).toBe(1);
    db.push('rooms', lobbyRoom(4));
    const afterRecover = db.getCalls;
    await timers.advance(10_000);
    expect(db.getCalls).toBe(afterRecover);
  });

  it('读取时网络出错保留原来的数据', async () => {
    const { db, session } = setup();
    session.start();
    await flush();
    db.failGets = true;
    await session.refresh();
    expect(session.room?.code).toBe('1234');
  });

  it('stop 关闭监听并清掉计时器', async () => {
    const { db, timers, session } = setup();
    session.start();
    await flush();
    db.error('rooms');
    session.stop();
    expect(db.live('rooms')).toBe(0);
    expect(timers.pending).toBe(0);
  });
});

describe('Ticker', () => {
  function setup() {
    const timers = new ManualTimers();
    const tick = vi.fn(async () => ({ ok: true }));
    const ticker = new Ticker({ now: () => timers.now, random: () => 0.5, timers, tick });
    return { timers, tick, ticker };
  }

  it('截止时间过后再随机等待一会儿才推进', async () => {
    const { timers, tick, ticker } = setup();
    ticker.update(10_000);
    await timers.advance(10_000 + 749);
    expect(tick).not.toHaveBeenCalled();
    await timers.advance(1);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('截止时间没变时 3 秒后重试；变成 null 时停止', async () => {
    const { timers, tick, ticker } = setup();
    ticker.update(0);
    await timers.advance(750);
    expect(tick).toHaveBeenCalledTimes(1);
    await timers.advance(3000);
    expect(tick).toHaveBeenCalledTimes(2);
    ticker.update(null);
    await timers.advance(10_000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('同一个截止时间重复 update 不会重复安排；tick 出错被忽略', async () => {
    const { timers, tick, ticker } = setup();
    tick.mockRejectedValueOnce(new Error('network'));
    ticker.update(1000);
    ticker.update(1000);
    expect(timers.pending).toBe(1);
    await timers.advance(1750);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('同一时间最多一个 tick 请求', async () => {
    const timers = new ManualTimers();
    let release: () => void = () => {};
    const tick = vi.fn(() => new Promise<void>((r) => (release = r)));
    const ticker = new Ticker({ now: () => timers.now, random: () => 0, timers, tick });
    ticker.update(0);
    await timers.advance(0);
    ticker.update(100);
    await timers.advance(100);
    expect(tick).toHaveBeenCalledTimes(1);
    release();
    await flush();
    await timers.advance(3000);
    expect(tick).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `cd client && npx vitest run test/net.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 4: 实现 timers / api / storage**

`client/src/net/timers.ts`：
```ts
export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

export const realTimers: Timers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};
```

`client/src/net/api.ts`：
```ts
export type ApiResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string; network?: true };

export interface CloudLike {
  callFunction(o: { name: string; data: unknown }): Promise<{ result?: unknown }>;
}

export const NETWORK_ERROR = '网络不稳定，请稍后再试';

export class Api {
  constructor(private readonly cloud: CloudLike) {}

  async call<T = unknown>(data: Record<string, unknown>): Promise<ApiResult<T>> {
    try {
      const r = await this.cloud.callFunction({ name: 'game', data });
      const res = r.result as { ok?: unknown } | undefined;
      if (!res || typeof res !== 'object' || typeof res.ok !== 'boolean') {
        return { ok: false, error: '服务器没有响应', network: true };
      }
      return res as ApiResult<T>;
    } catch {
      return { ok: false, error: NETWORK_ERROR, network: true };
    }
  }
}
```

`client/src/net/storage.ts`：
```ts
export interface StorageLike {
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
  removeStorageSync(key: string): void;
}

export interface KeyStore {
  nickname(): string | null;
  setNickname(name: string): void;
  lastRoom(): string | null;
  setLastRoom(code: string): void;
  clearLastRoom(): void;
}

const NICK = 'witchtown.nickname';
const ROOM = 'witchtown.lastRoom';

export class LocalStore implements KeyStore {
  constructor(private readonly s: StorageLike) {}

  private get(key: string): string | null {
    try {
      const v = this.s.getStorageSync(key);
      return typeof v === 'string' && v ? v : null;
    } catch {
      return null;
    }
  }

  private set(key: string, v: string | null): void {
    try {
      if (v === null) this.s.removeStorageSync(key);
      else this.s.setStorageSync(key, v);
    } catch {
      // 本机存储失败不影响游戏
    }
  }

  nickname(): string | null {
    return this.get(NICK);
  }
  setNickname(name: string): void {
    this.set(NICK, name);
  }
  lastRoom(): string | null {
    return this.get(ROOM);
  }
  setLastRoom(code: string): void {
    this.set(ROOM, code);
  }
  clearLastRoom(): void {
    this.set(ROOM, null);
  }
}
```

- [ ] **Step 5: 实现 session / ticker**

`client/src/net/session.ts`：
```ts
import type { HandDoc, RoomDoc } from '../../../server/src/types';
import type { Timers } from './timers';

export interface WatchHandle {
  close(): void;
}
interface WatchOpts {
  onChange(snap: { docs: unknown[] }): void;
  onError(e: unknown): void;
}
export interface DbLike {
  collection(name: string): {
    doc(id: string): { get(): Promise<{ data: unknown }>; watch(o: WatchOpts): WatchHandle };
    where(q: Record<string, unknown>): { watch(o: WatchOpts): WatchHandle };
  };
}

export const POLL_MS = 3000;
export const MAX_BACKOFF_MS = 30_000;
export const POLL_AFTER_FAILURES = 3;

const NOT_FOUND = /does not exist|DOCUMENT_NOT_EXIST|-502004/i;

function isNotFound(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String((e as { errMsg?: string } | null)?.errMsg ?? e);
  return NOT_FOUND.test(msg);
}

/**
 * 一个房间的实时数据：rooms/{code} 和我的 hands 文档。
 * 监听出错后按 1s、2s、4s… 最多 30s 退避重连；连续失败 3 次后改为每 3 秒读取一次，直到监听恢复。
 */
export class RoomSession {
  room: RoomDoc | null = null;
  hand: HandDoc | null = null;
  private watchers: WatchHandle[] = [];
  private gen = 0;
  private failures = 0;
  private retryTimer: unknown = null;
  private pollTimer: unknown = null;
  private stopped = false;

  constructor(
    private readonly db: DbLike,
    readonly code: string,
    private readonly openid: string,
    private readonly timers: Timers,
    private readonly onChange: () => void,
  ) {}

  start(): void {
    void this.refresh();
    this.watch();
  }

  stop(): void {
    this.stopped = true;
    this.closeWatchers();
    this.stopPolling();
    if (this.retryTimer !== null) {
      this.timers.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  async refresh(): Promise<void> {
    const [room, hand] = await Promise.all([
      this.getDoc<RoomDoc>('rooms', this.code),
      this.getDoc<HandDoc>('hands', `${this.code}_${this.openid}`),
    ]);
    if (this.stopped) return;
    if (room !== undefined) this.room = room;
    if (hand !== undefined) this.hand = hand;
    this.onChange();
  }

  /** 找不到文档返回 null；网络等其他错误返回 undefined（保留原数据） */
  private async getDoc<T>(coll: string, id: string): Promise<T | null | undefined> {
    try {
      const r = await this.db.collection(coll).doc(id).get();
      return (r.data as T) ?? null;
    } catch (e) {
      return isNotFound(e) ? null : undefined;
    }
  }

  private watch(): void {
    this.closeWatchers();
    const gen = this.gen;
    const onError = () => {
      if (gen === this.gen) this.fail();
    };
    this.watchers.push(
      this.db
        .collection('rooms')
        .doc(this.code)
        .watch({
          onChange: (snap) => {
            if (gen !== this.gen) return;
            this.room = (snap.docs[0] as RoomDoc | undefined) ?? null;
            this.ok();
          },
          onError,
        }),
      this.db
        .collection('hands')
        .where({ _openid: '{openid}', roomId: this.code })
        .watch({
          onChange: (snap) => {
            if (gen !== this.gen) return;
            this.hand = (snap.docs[0] as HandDoc | undefined) ?? null;
            this.ok();
          },
          onError,
        }),
    );
  }

  private closeWatchers(): void {
    this.gen++;
    for (const w of this.watchers) {
      try {
        w.close();
      } catch {
        // 关闭失败无所谓
      }
    }
    this.watchers = [];
  }

  private ok(): void {
    this.failures = 0;
    this.stopPolling();
    this.onChange();
  }

  private fail(): void {
    if (this.stopped) return;
    this.closeWatchers();
    this.failures++;
    if (this.failures >= POLL_AFTER_FAILURES) this.startPolling();
    if (this.retryTimer !== null) return;
    const delay = Math.min(1000 * 2 ** (this.failures - 1), MAX_BACKOFF_MS);
    this.retryTimer = this.timers.setTimeout(() => {
      this.retryTimer = null;
      if (!this.stopped) this.watch();
    }, delay);
  }

  private startPolling(): void {
    if (this.pollTimer !== null) return;
    const loop = () => {
      this.pollTimer = this.timers.setTimeout(async () => {
        await this.refresh();
        if (this.pollTimer !== null && !this.stopped) loop();
      }, POLL_MS);
    };
    loop();
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      this.timers.clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
```

说明：`fail()` 在已有 `retryTimer` 时直接返回，所以同一次断线中两个监听器先后报错只安排一次重连；`gen` 保证旧监听器迟到的回调被忽略。测试里的时间线：第 1 次失败 → 1s 后重连；第 2 次失败 → 2s 后；第 3 次失败 → 开始每 3s 轮询，同时 4s 后重连；重连成功并收到推送后轮询停止。

`client/src/net/ticker.ts`：
```ts
import type { Timers } from './timers';

export const TICK_JITTER_MS = 1500;
export const TICK_RETRY_MS = 3000;

export interface TickerDeps {
  now(): number;
  random(): number;
  timers: Timers;
  tick(): Promise<unknown>;
}

/**
 * 倒计时结束后请求服务器推进。随机等待 0–1.5 秒，避免所有手机同时请求；
 * 同一时间最多一个请求；截止时间没变（说明还没推进成功）就每 3 秒重试。
 */
export class Ticker {
  private deadline: number | null = null;
  private timer: unknown = null;
  private inflight = false;

  constructor(private readonly deps: TickerDeps) {}

  update(deadline: number | null): void {
    if (deadline === this.deadline) return;
    this.deadline = deadline;
    this.clear();
    if (deadline !== null) {
      this.schedule(Math.max(0, deadline - this.deps.now()) + this.deps.random() * TICK_JITTER_MS);
    }
  }

  stop(): void {
    this.deadline = null;
    this.clear();
  }

  private schedule(ms: number): void {
    this.timer = this.deps.timers.setTimeout(() => {
      this.timer = null;
      void this.fire();
    }, ms);
  }

  private async fire(): Promise<void> {
    const d = this.deadline;
    if (d === null) return;
    if (this.inflight) {
      this.schedule(TICK_RETRY_MS);
      return;
    }
    this.inflight = true;
    try {
      await this.deps.tick();
    } catch {
      // tick 的错误一律忽略
    } finally {
      this.inflight = false;
    }
    if (this.deadline === d && this.timer === null) this.schedule(TICK_RETRY_MS);
  }

  private clear(): void {
    if (this.timer !== null) {
      this.deps.timers.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
```

- [ ] **Step 6: 运行测试与类型检查**

Run: `cd client && npx vitest run && npm run typecheck`
Expected: PASS。若「同一时间最多一个 tick 请求」测试失败，检查 `fire()` 在 `inflight` 时是否改为 3 秒后重试。

- [ ] **Step 7: 提交**

```bash
git add client
git commit -m "feat(client): cloud api, room session with reconnect, ticker and local storage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 应用控制器 Controller

**Files:**
- Modify: `client/src/controller.ts`（替换 Task 2 的占位）
- Test: `client/test/controller.test.ts`

**Interfaces:**
- Consumes: Task 3 `ClientAction`；Task 4 `ApiResult`、`KeyStore`
- Produces:
  - `STALE_ERROR = '状态已变化，请重试'`、`LEAVE_ERRORS`
  - `interface SessionLike { room; hand; start(); stop(); refresh(): Promise<void> }`、`interface TickerLike { update(d); stop() }`
  - `interface ControllerDeps { api; store; openSession(code, openid, onChange); makeTicker(tick); toast(msg); render() }`
  - `class Controller`：只读属性 `openid`、`code`、`busy`、`room`、`hand`、`nickname`；方法 `setNickname(name): boolean`、`createRoom()`、`joinRoom(code)`、`leaveRoom()`、`addBot()`、`moveSeat(index, dir)`、`startGame()`、`act(action)`、`backHome()`、`onShow()`；全部命令返回 `Promise<void>`（`setNickname`、`backHome`、`onShow` 除外）

- [ ] **Step 1: 写失败测试**

`client/test/controller.test.ts`：
```ts
import { describe, expect, it, vi } from 'vitest';
import { Controller, type SessionLike } from '../src/controller';
import type { ApiResult } from '../src/net/api';
import type { KeyStore } from '../src/net/storage';
import { flush } from './fakes';
import { lobbyRoom, newState, roomOf } from './fixtures';

function memStore(): KeyStore {
  let nick: string | null = '小明';
  let room: string | null = null;
  return {
    nickname: () => nick,
    setNickname: (n) => void (nick = n),
    lastRoom: () => room,
    setLastRoom: (c) => void (room = c),
    clearLastRoom: () => void (room = null),
  };
}

function setup(reply: (req: Record<string, unknown>) => ApiResult | Promise<ApiResult>) {
  const store = memStore();
  const toast = vi.fn();
  const render = vi.fn();
  const sessions: (SessionLike & { onChange: () => void })[] = [];
  const ticker = { update: vi.fn(), stop: vi.fn() };
  const api = { call: vi.fn(async (req: Record<string, unknown>) => reply(req)) };
  const ctl = new Controller({
    api: api as never,
    store,
    openSession: (_code, _openid, onChange) => {
      const s = { room: null, hand: null, start: vi.fn(), stop: vi.fn(), refresh: vi.fn(async () => {}), onChange };
      sessions.push(s);
      return s;
    },
    makeTicker: () => ticker,
    toast,
    render,
  });
  return { ctl, api, store, toast, render, sessions, ticker };
}

const entered = (req: Record<string, unknown>): ApiResult => ({ ok: true, data: { code: '1234', openid: 'u0' } });

describe('Controller', () => {
  it('建房成功后进入房间：记住房号、开始监听', async () => {
    const { ctl, api, store, sessions } = setup(entered);
    await ctl.createRoom();
    expect(api.call).toHaveBeenCalledWith({ type: 'createRoom', profile: { name: '小明', avatar: '' } });
    expect(ctl.code).toBe('1234');
    expect(ctl.openid).toBe('u0');
    expect(store.lastRoom()).toBe('1234');
    expect(sessions[0].start).toHaveBeenCalled();
  });

  it('房号不是 4 位数字时不发请求', async () => {
    const { ctl, api, toast } = setup(entered);
    await ctl.joinRoom('12a');
    expect(api.call).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('请输入 4 位房间号');
  });

  it('请求进行中再点不会发出第二个请求', async () => {
    let release: (r: ApiResult) => void = () => {};
    const { ctl, api } = setup((req) => (req.type === 'act' ? new Promise((r) => (release = r)) : entered(req)));
    await ctl.createRoom();
    const first = ctl.act({ type: 'draw' });
    expect(ctl.busy).toBe(true);
    await ctl.act({ type: 'draw' });
    expect(api.call).toHaveBeenCalledTimes(2);
    release({ ok: true, data: {} });
    await first;
    expect(ctl.busy).toBe(false);
  });

  it('出牌带上当前版本号', async () => {
    const { ctl, api, sessions } = setup(entered);
    await ctl.createRoom();
    const s = newState(5);
    s.version = 7;
    sessions[0].room = roomOf(s);
    await ctl.act({ type: 'endTurn' });
    expect(api.call).toHaveBeenLastCalledWith({ type: 'act', code: '1234', action: { type: 'endTurn' }, version: 7 });
  });

  it('「状态已变化」时静默刷新，其他错误弹提示', async () => {
    let error = '状态已变化，请重试';
    const { ctl, toast, sessions } = setup((req) => (req.type === 'act' ? { ok: false, error } : entered(req)));
    await ctl.createRoom();
    await ctl.act({ type: 'draw' });
    expect(toast).not.toHaveBeenCalled();
    expect(sessions[0].refresh).toHaveBeenCalled();
    error = '现在不能抽牌';
    await ctl.act({ type: 'draw' });
    expect(toast).toHaveBeenCalledWith('现在不能抽牌');
  });

  it('房间不存在时回到首页', async () => {
    const { ctl, store, sessions, ticker } = setup((req) => (req.type === 'act' ? { ok: false, error: '房间不存在' } : entered(req)));
    await ctl.createRoom();
    await ctl.act({ type: 'draw' });
    expect(ctl.code).toBeNull();
    expect(sessions[0].stop).toHaveBeenCalled();
    expect(ticker.stop).toHaveBeenCalled();
    expect(store.lastRoom()).toBeNull();
  });

  it('调换座位发送新的顺序', async () => {
    const { ctl, api, sessions } = setup(entered);
    await ctl.createRoom();
    sessions[0].room = lobbyRoom(3);
    await ctl.moveSeat(2, -1);
    expect(api.call).toHaveBeenLastCalledWith({ type: 'reorderSeats', code: '1234', order: ['u0', 'u2', 'u1'] });
    await ctl.moveSeat(0, -1);
    expect(api.call).toHaveBeenCalledTimes(2);
  });

  it('游戏进行中把截止时间交给 ticker；大厅里为 null', async () => {
    const { ctl, sessions, ticker } = setup(entered);
    await ctl.createRoom();
    sessions[0].room = lobbyRoom(2);
    sessions[0].onChange();
    expect(ticker.update).toHaveBeenLastCalledWith(null);
    sessions[0].room = roomOf(newState(5));
    sessions[0].onChange();
    expect(ticker.update).toHaveBeenLastCalledWith(1_800_000_090_000);
  });

  it('座位里没有我时提示并回首页', async () => {
    const { ctl, toast, sessions } = setup((req) => ({ ok: true, data: { code: '1234', openid: 'someone-else' } }));
    await ctl.createRoom();
    sessions[0].room = lobbyRoom(2);
    sessions[0].onChange();
    expect(toast).toHaveBeenCalledWith('你已不在这个房间里');
    expect(ctl.code).toBeNull();
  });

  it('昵称需要 1–12 个字', () => {
    const { ctl, toast } = setup(entered);
    expect(ctl.setNickname('   ')).toBe(false);
    expect(ctl.setNickname('一二三四五六七八九十一二三')).toBe(false);
    expect(toast).toHaveBeenCalledWith('昵称需要 1–12 个字');
    expect(ctl.setNickname(' 阿花 ')).toBe(true);
    expect(ctl.nickname).toBe('阿花');
  });

  it('onShow 时重新读取数据', async () => {
    const { ctl, sessions } = setup(entered);
    await ctl.createRoom();
    ctl.onShow();
    await flush();
    expect(sessions[0].refresh).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd client && npx vitest run test/controller.test.ts`
Expected: FAIL（`Controller` 还是空类）

- [ ] **Step 3: 实现 Controller**

`client/src/controller.ts`：
```ts
import type { HandDoc, RoomDoc } from '../../server/src/types';
import type { ClientAction } from './model/actions';
import type { ApiResult } from './net/api';
import type { KeyStore } from './net/storage';

export const STALE_ERROR = '状态已变化，请重试';
export const LEAVE_ERRORS = ['房间不存在', '房间已结束', '你不在这个房间里'];

export interface SessionLike {
  room: RoomDoc | null;
  hand: HandDoc | null;
  start(): void;
  stop(): void;
  refresh(): Promise<void>;
}

export interface TickerLike {
  update(deadline: number | null): void;
  stop(): void;
}

export interface ControllerDeps {
  api: { call<T = unknown>(data: Record<string, unknown>): Promise<ApiResult<T>> };
  store: KeyStore;
  openSession(code: string, openid: string, onChange: () => void): SessionLike;
  makeTicker(tick: () => Promise<unknown>): TickerLike;
  toast(msg: string): void;
  render(): void;
}

/** 应用状态与全部命令。场景只读它的属性、调用它的方法。 */
export class Controller {
  openid: string | null = null;
  code: string | null = null;
  busy = false;
  private session: SessionLike | null = null;
  private ticker: TickerLike | null = null;

  constructor(private readonly d: ControllerDeps) {}

  get nickname(): string | null {
    return this.d.store.nickname();
  }

  get room(): RoomDoc | null {
    return this.session?.room ?? null;
  }

  get hand(): HandDoc | null {
    return this.session?.hand ?? null;
  }

  setNickname(name: string): boolean {
    const n = name.trim();
    const len = [...n].length;
    if (len < 1 || len > 12) {
      this.d.toast('昵称需要 1–12 个字');
      return false;
    }
    this.d.store.setNickname(n);
    this.d.render();
    return true;
  }

  async createRoom(): Promise<void> {
    const r = await this.run<{ code: string; openid: string }>({ type: 'createRoom', profile: this.profile() });
    if (r) this.enter(r.code, r.openid);
  }

  async joinRoom(code: string): Promise<void> {
    if (!/^\d{4}$/.test(code)) {
      this.d.toast('请输入 4 位房间号');
      return;
    }
    const r = await this.run<{ code: string; openid: string }>({ type: 'joinRoom', code, profile: this.profile() });
    if (r) this.enter(r.code, r.openid);
  }

  async leaveRoom(): Promise<void> {
    if (!this.code) return;
    if (this.room?.status === 'lobby') await this.run({ type: 'leaveRoom', code: this.code });
    this.backHome();
  }

  async addBot(): Promise<void> {
    if (this.code) await this.run({ type: 'addBots', code: this.code, count: 1 });
  }

  async moveSeat(index: number, dir: -1 | 1): Promise<void> {
    const seats = this.room?.seats;
    const j = index + dir;
    if (!this.code || !seats || j < 0 || j >= seats.length) return;
    const order = seats.map((s) => s.openid);
    [order[index], order[j]] = [order[j], order[index]];
    await this.run({ type: 'reorderSeats', code: this.code, order });
  }

  async startGame(): Promise<void> {
    if (this.code) await this.run({ type: 'startGame', code: this.code });
  }

  async act(action: ClientAction): Promise<void> {
    if (!this.code) return;
    await this.run({ type: 'act', code: this.code, action, version: this.room?.view?.version });
  }

  backHome(): void {
    this.session?.stop();
    this.ticker?.stop();
    this.session = null;
    this.ticker = null;
    this.code = null;
    this.d.store.clearLastRoom();
    this.d.render();
  }

  onShow(): void {
    void this.session?.refresh();
  }

  private profile(): { name: string; avatar: string } {
    return { name: this.nickname ?? '', avatar: '' };
  }

  private enter(code: string, openid: string): void {
    this.session?.stop();
    this.ticker?.stop();
    this.code = code;
    this.openid = openid;
    this.d.store.setLastRoom(code);
    this.ticker = this.d.makeTicker(() => this.d.api.call({ type: 'tick', code }));
    this.session = this.d.openSession(code, openid, () => this.onRoomChange());
    this.session.start();
    this.d.render();
  }

  private onRoomChange(): void {
    const room = this.room;
    this.ticker?.update(room?.status === 'playing' ? room.deadline : null);
    if (room && !room.seats.some((s) => s.openid === this.openid)) {
      this.d.toast('你已不在这个房间里');
      this.backHome();
      return;
    }
    if (room?.status === 'ended') this.d.store.clearLastRoom();
    this.d.render();
  }

  private async run<T>(req: Record<string, unknown>): Promise<T | null> {
    if (this.busy) return null;
    this.busy = true;
    this.d.render();
    try {
      const res = await this.d.api.call<T>(req);
      if (res.ok) return res.data;
      if (res.error === STALE_ERROR) {
        void this.session?.refresh();
        return null;
      }
      this.d.toast(res.error);
      if (LEAVE_ERRORS.includes(res.error) && this.code) this.backHome();
      return null;
    } finally {
      this.busy = false;
      this.d.render();
    }
  }
}
```

- [ ] **Step 4: 运行测试与类型检查**

Run: `cd client && npx vitest run && npm run typecheck`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add client
git commit -m "feat(client): app controller with busy guard and error routing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: 首页、大厅、场景路由与入口

**Files:**
- Create: `client/src/scenes/home.ts`, `client/src/scenes/lobby.ts`, `client/src/scenes/root.ts`
- Modify: `client/src/main.ts`（整体替换 Task 1 的占位）
- Create: `client/test/sceneKit.ts`
- Test: `client/test/scenes-home-lobby.test.ts`

**Interfaces:**
- Consumes: Task 2 部件与 `Ui`、`RULES`；Task 5 `Controller`；Task 4 `Api`、`RoomSession`、`LocalStore`、`Ticker`、`realTimers`；Task 1 `App`、`createPlatform`、`bindTouches`
- Produces:
  - `class HomeScene`、`class LobbyScene`、`class RootScene`（均 `implements Scene`，构造参数 `(ui: Ui)`）
  - `RootScene` 的路由：没有房号 → 首页；房间数据未到 → 「正在进入房间」；大厅 → 大厅；游戏中 → `this.playing(now)`（本任务先显示占位文字，Task 7 换成游戏桌）；已结束 → `this.ended(now)`（本任务占位，Task 8 换成结算页）
  - 节点 id：首页 `join`、`create`、`rules`、`nickname`、`rules-list`；大厅 `copy`、`invite`、`leave`、`add-bot`、`start`、`seat-up:{i}`、`seat-down:{i}`；路由 `loading-home`、`closed-home`
  - 测试工具：`SCREEN`、`fakeCtl(over)`、`fakeUi(ctl, screen?)`、`tap(nodes,id)`、`has(nodes,id)`、`canTap(nodes,id)`、`drawAll(nodes): string[]`

- [ ] **Step 1: 场景测试工具**

`client/test/sceneKit.ts`：
```ts
import { vi } from 'vitest';
import type { Screen } from '../src/core/app';
import { drawNodes, findNode, type Node } from '../src/core/node';
import { Animator } from '../src/core/tween';
import type { Controller } from '../src/controller';
import type { Ui } from '../src/scenes/ui';
import { fakeCtx } from './fakes';

export const SCREEN: Screen = { W: 375, H: 667, top: 60, bottom: 667 };

export function fakeCtl(over: Record<string, unknown> = {}): Controller {
  return {
    code: '1234',
    openid: 'u0',
    busy: false,
    room: null,
    hand: null,
    nickname: '小明',
    setNickname: vi.fn(() => true),
    createRoom: vi.fn(async () => {}),
    joinRoom: vi.fn(async () => {}),
    leaveRoom: vi.fn(async () => {}),
    addBot: vi.fn(async () => {}),
    moveSeat: vi.fn(async () => {}),
    startGame: vi.fn(async () => {}),
    act: vi.fn(async () => {}),
    backHome: vi.fn(),
    onShow: vi.fn(),
    ...over,
  } as unknown as Controller;
}

export function fakeUi(ctl: Controller, screen: Screen = SCREEN) {
  const ui = {
    screen,
    animator: new Animator(),
    ctl,
    render: vi.fn(),
    prompt: vi.fn((_t: string, _p: string, _cb: (text: string) => void, _c?: boolean) => {}),
    confirm: vi.fn((_t: string, _c: string, cb: () => void) => cb()),
    copy: vi.fn(),
    share: vi.fn(),
  };
  return ui satisfies Ui;
}

export function tap(nodes: Node[], id: string): void {
  const n = findNode(nodes, id);
  if (!n?.onTap) throw new Error(`没有可点击的节点：${id}`);
  n.onTap();
}

export const has = (nodes: Node[], id: string): boolean => findNode(nodes, id) !== null;
export const canTap = (nodes: Node[], id: string): boolean => !!findNode(nodes, id)?.onTap;

/** 把节点画到假画布上，返回画出的所有文字（同时检查绘制不报错） */
export function drawAll(nodes: Node[]): string[] {
  const { ctx, texts } = fakeCtx();
  drawNodes(ctx, nodes);
  return texts;
}
```

- [ ] **Step 2: 写失败测试**

`client/test/scenes-home-lobby.test.ts`：
```ts
import { describe, expect, it } from 'vitest';
import { HomeScene } from '../src/scenes/home';
import { LobbyScene } from '../src/scenes/lobby';
import { RootScene } from '../src/scenes/root';
import { lobbyRoom, newState, roomOf } from './fixtures';
import { canTap, drawAll, fakeCtl, fakeUi, has, tap } from './sceneKit';

describe('首页', () => {
  it('输入房号加入', () => {
    const ctl = fakeCtl({ code: null });
    const ui = fakeUi(ctl);
    ui.prompt.mockImplementation((_t, _p, cb) => cb('4321'));
    tap(new HomeScene(ui).build(0), 'join');
    expect(ctl.joinRoom).toHaveBeenCalledWith('4321');
  });

  it('创建房间；请求进行中按钮不可点', () => {
    const ctl = fakeCtl({ code: null });
    tap(new HomeScene(fakeUi(ctl)).build(0), 'create');
    expect(ctl.createRoom).toHaveBeenCalled();
    const busy = new HomeScene(fakeUi(fakeCtl({ code: null, busy: true }))).build(0);
    expect(canTap(busy, 'join')).toBe(false);
    expect(canTap(busy, 'create')).toBe(false);
  });

  it('规则速查可以打开和关闭', () => {
    const scene = new HomeScene(fakeUi(fakeCtl({ code: null })));
    tap(scene.build(0), 'rules');
    const opened = scene.build(0);
    expect(has(opened, 'rules-list')).toBe(true);
    expect(drawAll(opened).join('')).toContain('胜负');
    tap(opened, 'sheet-close');
    expect(has(scene.build(0), 'rules-list')).toBe(false);
  });

  it('显示昵称，点击可修改', () => {
    const ctl = fakeCtl({ code: null });
    const ui = fakeUi(ctl);
    ui.prompt.mockImplementation((_t, _p, cb) => cb('阿花'));
    const nodes = new HomeScene(ui).build(0);
    expect(drawAll(nodes).join('')).toContain('小明');
    tap(nodes, 'nickname');
    expect(ctl.setNickname).toHaveBeenCalledWith('阿花');
  });
});

describe('大厅', () => {
  it('复制房号和邀请', () => {
    const ctl = fakeCtl({ room: lobbyRoom(3) });
    const ui = fakeUi(ctl);
    const nodes = new LobbyScene(ui).build(0);
    expect(drawAll(nodes)).toContain('1234');
    tap(nodes, 'copy');
    expect(ui.copy).toHaveBeenCalledWith('1234');
    tap(nodes, 'invite');
    expect(ui.share).toHaveBeenCalledWith(expect.stringContaining('1234'), 'room=1234');
  });

  it('房主可以调座位、加机器人；不满 4 人不能开始', () => {
    const ctl = fakeCtl({ room: lobbyRoom(3) });
    const nodes = new LobbyScene(fakeUi(ctl)).build(0);
    expect(has(nodes, 'seat-up:0')).toBe(false);
    expect(has(nodes, 'seat-down:2')).toBe(false);
    tap(nodes, 'seat-up:2');
    expect(ctl.moveSeat).toHaveBeenCalledWith(2, -1);
    tap(nodes, 'seat-down:0');
    expect(ctl.moveSeat).toHaveBeenCalledWith(0, 1);
    tap(nodes, 'add-bot');
    expect(ctl.addBot).toHaveBeenCalled();
    expect(canTap(nodes, 'start')).toBe(false);
  });

  it('4 人可以开始；12 人不能再加机器人', () => {
    const ctl = fakeCtl({ room: lobbyRoom(4) });
    tap(new LobbyScene(fakeUi(ctl)).build(0), 'start');
    expect(ctl.startGame).toHaveBeenCalled();
    const full = new LobbyScene(fakeUi(fakeCtl({ room: lobbyRoom(12) }))).build(0);
    expect(canTap(full, 'add-bot')).toBe(false);
    expect(drawAll(full).length).toBeGreaterThan(12);
  });

  it('非房主没有房主按钮，可以离开', () => {
    const ctl = fakeCtl({ room: lobbyRoom(4), openid: 'u1' });
    const nodes = new LobbyScene(fakeUi(ctl)).build(0);
    expect(has(nodes, 'start')).toBe(false);
    expect(has(nodes, 'add-bot')).toBe(false);
    expect(has(nodes, 'seat-up:1')).toBe(false);
    tap(nodes, 'leave');
    expect(ctl.leaveRoom).toHaveBeenCalled();
  });
});

describe('路由', () => {
  it('按状态选择画面', () => {
    expect(has(new RootScene(fakeUi(fakeCtl({ code: null }))).build(0), 'create')).toBe(true);
    expect(has(new RootScene(fakeUi(fakeCtl({ room: null }))).build(0), 'loading-home')).toBe(true);
    expect(has(new RootScene(fakeUi(fakeCtl({ room: lobbyRoom(2) }))).build(0), 'invite')).toBe(true);
    const closed = { ...lobbyRoom(2), status: 'ended' as const };
    expect(has(new RootScene(fakeUi(fakeCtl({ room: closed }))).build(0), 'closed-home')).toBe(true);
    expect(new RootScene(fakeUi(fakeCtl({ room: roomOf(newState(5)) }))).build(0).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `cd client && npx vitest run test/scenes-home-lobby.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 4: 首页**

`client/src/scenes/home.ts`：
```ts
import type { Scene } from '../core/app';
import { rect } from '../core/geom';
import type { Node } from '../core/node';
import { RULES } from '../model/rules';
import { drawText } from '../theme/draw';
import { C } from '../theme/palette';
import type { Ui } from './ui';
import { button, ScrollBox, sheet, skyNode, type Line } from './widgets';

const RULE_LINES: Line[] = RULES.flatMap((s) => [
  { text: s.title, size: 15, bold: true, color: C.gold, gap: 2 },
  ...s.items.map((t, i) => ({ text: `· ${t}`, size: 13, gap: i === s.items.length - 1 ? 10 : 0 })),
]);

export class HomeScene implements Scene {
  private rules = false;
  private readonly box = new ScrollBox();

  constructor(private readonly ui: Ui) {}

  build(): Node[] {
    const { W, H, top } = this.ui.screen;
    const ctl = this.ui.ctl;
    const busy = ctl.busy;
    const nodes: Node[] = [skyNode(this.ui.screen, 0)];
    const titleY = top + H * 0.14;
    nodes.push({
      rect: rect(0, titleY - 30, W, 100),
      draw: (ctx) => {
        drawText(ctx, '女巫镇', W / 2, titleY, { size: 46, bold: true, color: C.gold, align: 'center' });
        drawText(ctx, 'Salem 1692 · 朋友局', W / 2, titleY + 44, { size: 14, color: C.textDim, align: 'center' });
      },
    });
    const nick = ctl.nickname ?? '（未设置）';
    nodes.push({
      id: 'nickname',
      rect: rect(W - 200, top, 188, 28),
      onTap: () => this.ui.prompt('修改昵称', '1–12 个字', (name) => ctl.setNickname(name)),
      draw: (ctx) => drawText(ctx, `昵称：${nick} ✎`, W - 12, top + 14, { size: 13, color: C.textDim, align: 'right', maxWidth: 188 }),
    });
    const bw = Math.min(280, W - 64);
    const bx = (W - bw) / 2;
    const y = H * 0.5;
    nodes.push(
      button('join', rect(bx, y, bw, 54), '输入房号加入', busy ? null : () => this.ui.prompt('输入房间号', '4 位数字', (code) => void ctl.joinRoom(code))),
      button('create', rect(bx, y + 70, bw, 48), '创建房间', busy ? null : () => void ctl.createRoom(), 'secondary'),
      button('rules', rect(bx, y + 132, bw, 48), '规则速查', () => {
        this.rules = true;
        this.box.reset();
      }, 'secondary'),
    );
    if (this.rules) {
      const { nodes: panel, body } = sheet(this.ui.screen, this.ui.screen.H - top, '规则速查', () => (this.rules = false));
      nodes.push(...panel, this.box.node('rules-list', body, RULE_LINES));
    }
    return nodes;
  }
}
```

- [ ] **Step 5: 大厅**

`client/src/scenes/lobby.ts`：
```ts
import type { Scene } from '../core/app';
import { rect } from '../core/geom';
import type { Node } from '../core/node';
import { drawBadge, drawPanel, drawText } from '../theme/draw';
import { C } from '../theme/palette';
import type { Ui } from './ui';
import { button, skyNode, textNode } from './widgets';

const MAX = 12;
const MIN = 4;

export class LobbyScene implements Scene {
  constructor(private readonly ui: Ui) {}

  build(): Node[] {
    const { W, top, bottom } = this.ui.screen;
    const ctl = this.ui.ctl;
    const room = ctl.room;
    if (!room) return [];
    const isHost = room.host === ctl.openid;
    const busy = ctl.busy;
    const seats = room.seats;
    const nodes: Node[] = [skyNode(this.ui.screen, 0)];

    nodes.push({
      rect: rect(0, top, W, 90),
      draw: (ctx) => {
        drawText(ctx, '房间号', W / 2, top + 12, { size: 13, color: C.textDim, align: 'center' });
        drawText(ctx, room.code, W / 2, top + 54, { size: 46, bold: true, color: C.gold, align: 'center' });
      },
    });
    const half = (W - 24 - 10) / 2;
    nodes.push(
      button('copy', rect(12, top + 92, half, 38), '复制房号', () => this.ui.copy(room.code), 'secondary'),
      button('invite', rect(12 + half + 10, top + 92, half, 38), '邀请朋友', () =>
        this.ui.share(`${ctl.nickname ?? '朋友'} 邀请你来女巫镇 · 房间 ${room.code}`, `room=${room.code}`), 'secondary'),
      textNode(rect(12, top + 136, W - 24, 20), '把房号发到群里，朋友在首页输入就能加入', { size: 12, color: C.textDim, align: 'center' }),
    );

    const startY = bottom - 12 - 48;
    const rowY = startY - 8 - 40;
    const listTop = top + 164;
    const rowH = Math.min(46, (rowY - 8 - listTop) / Math.max(seats.length, 1));
    seats.forEach((s, i) => {
      const r = rect(12, listTop + i * rowH, W - 24, rowH - 4);
      const tags = [
        s.openid === room.host ? '房主' : '',
        s.openid.startsWith('bot-') ? '机器人' : '',
        s.openid === ctl.openid ? '我' : '',
      ].filter(Boolean);
      nodes.push({
        rect: r,
        draw: (ctx) => {
          drawPanel(ctx, r, { radius: 8 });
          drawBadge(ctx, r.x + 20, r.y + r.h / 2, Math.min(14, r.h / 2 - 3), s.name, i);
          drawText(ctx, `${i + 1}. ${s.name}`, r.x + 42, r.y + r.h / 2, { size: 14, maxWidth: r.w - 170 });
          if (tags.length) drawText(ctx, tags.join(' · '), r.x + r.w - (isHost ? 84 : 10), r.y + r.h / 2, { size: 11, color: C.gold, align: 'right' });
        },
      });
      if (isHost) {
        const bh = r.h - 8;
        if (i > 0) nodes.push(button(`seat-up:${i}`, rect(r.x + r.w - 76, r.y + 4, 34, bh), '↑', busy ? null : () => void ctl.moveSeat(i, -1), 'secondary'));
        if (i < seats.length - 1) nodes.push(button(`seat-down:${i}`, rect(r.x + r.w - 38, r.y + 4, 34, bh), '↓', busy ? null : () => void ctl.moveSeat(i, 1), 'secondary'));
      }
    });

    const leave = () => this.ui.confirm('离开房间？', '离开后可以用房号重新加入', () => void ctl.leaveRoom());
    if (isHost) {
      nodes.push(
        button('leave', rect(12, rowY, half, 40), '离开', busy ? null : leave, 'danger'),
        button('add-bot', rect(12 + half + 10, rowY, half, 40), '加机器人', busy || seats.length >= MAX ? null : () => void ctl.addBot(), 'secondary'),
        button('start', rect(12, startY, W - 24, 48), `开始游戏（${seats.length}/${MAX}）`, busy || seats.length < MIN ? null : () => void ctl.startGame()),
      );
    } else {
      nodes.push(
        button('leave', rect(12, rowY, W - 24, 40), '离开', busy ? null : leave, 'danger'),
        textNode(rect(12, startY, W - 24, 48), `等待房主开始…（${seats.length}/${MAX}）`, { size: 14, color: C.textDim, align: 'center' }),
      );
    }
    return nodes;
  }
}
```

- [ ] **Step 6: 路由**

`client/src/scenes/root.ts`：
```ts
import type { Scene } from '../core/app';
import { rect } from '../core/geom';
import type { Node } from '../core/node';
import { C } from '../theme/palette';
import { HomeScene } from './home';
import { LobbyScene } from './lobby';
import type { Ui } from './ui';
import { button, skyNode, textNode } from './widgets';

export class RootScene implements Scene {
  private readonly home: HomeScene;
  private readonly lobby: LobbyScene;

  constructor(private readonly ui: Ui) {
    this.home = new HomeScene(ui);
    this.lobby = new LobbyScene(ui);
  }

  build(now: number): Node[] {
    const ctl = this.ui.ctl;
    if (!ctl.code) return this.home.build();
    const room = ctl.room;
    if (!room) return this.message(`正在进入房间 ${ctl.code}…`, 'loading-home');
    if (!room.view) return room.status === 'lobby' ? this.lobby.build() : this.message('房间已关闭', 'closed-home');
    if (room.view.phase.kind === 'ended') return this.ended(now);
    return this.playing(now);
  }

  /** Task 7 替换为游戏桌 */
  private playing(_now: number): Node[] {
    return this.message('游戏进行中（界面开发中）', 'loading-home');
  }

  /** Task 8 替换为结算页 */
  private ended(_now: number): Node[] {
    return this.message('游戏结束', 'closed-home');
  }

  private message(text: string, id: string): Node[] {
    const { W, H } = this.ui.screen;
    return [
      skyNode(this.ui.screen, 0),
      textNode(rect(0, H * 0.42, W, 30), text, { size: 16, color: C.text, align: 'center' }),
      button(id, rect((W - 200) / 2, H * 0.42 + 50, 200, 44), '返回首页', () => this.ui.ctl.backHome(), 'secondary'),
    ];
  }
}
```

- [ ] **Step 7: 入口**

`client/src/main.ts`（整体替换）：
```ts
import { App } from './core/app';
import { Controller } from './controller';
import { Api } from './net/api';
import { RoomSession, type DbLike } from './net/session';
import { LocalStore } from './net/storage';
import { Ticker } from './net/ticker';
import { realTimers } from './net/timers';
import { bindTouches, createPlatform } from './platform';
import { RootScene } from './scenes/root';
import type { Ui } from './scenes/ui';

wx.cloud.init({ traceUser: true });

const { ctx, screen } = createPlatform();
const app = new App(ctx, screen, (cb) => requestAnimationFrame(() => cb()), () => Date.now());
bindTouches(app);

const store = new LocalStore(wx);
const db = wx.cloud.database() as unknown as DbLike;
const ctl = new Controller({
  api: new Api(wx.cloud),
  store,
  openSession: (code, openid, onChange) => new RoomSession(db, code, openid, realTimers, onChange),
  makeTicker: (tick) => new Ticker({ now: () => Date.now(), random: Math.random, timers: realTimers, tick }),
  toast: (msg) => wx.showToast({ title: msg, icon: 'none', duration: 2000 }),
  render: () => app.render(),
});

const ui: Ui = {
  screen,
  animator: app.animator,
  ctl,
  render: () => app.render(),
  prompt: (title, placeholder, cb, cancellable = true) =>
    wx.showModal({
      title,
      editable: true,
      placeholderText: placeholder,
      showCancel: cancellable,
      success: (r) => {
        if (r.confirm) cb((r.content ?? '').trim());
      },
    }),
  confirm: (title, content, cb) =>
    wx.showModal({
      title,
      content,
      success: (r) => {
        if (r.confirm) cb();
      },
    }),
  copy: (text) => wx.setClipboardData({ data: text }),
  share: (title, query) => wx.shareAppMessage({ title, query }),
};

app.setScene(new RootScene(ui));

// 右上角菜单的「转发」（手机上目前不带房号，见设计文档 §7.1；保留以便日后生效）
wx.showShareMenu({ menus: ['shareAppMessage'] });
wx.onShareAppMessage(() =>
  ctl.code ? { title: `女巫镇 · 房间 ${ctl.code}`, query: `room=${ctl.code}` } : { title: '一起来玩女巫镇' },
);

// 游戏进行中每秒重画一次，刷新倒计时
setInterval(() => {
  if (ctl.room?.status === 'playing') app.render();
}, 1000);

function roomFrom(o: WxLaunchOptions): string | null {
  const r = o.query?.room;
  return r && /^\d{4}$/.test(r) ? r : null;
}

function ensureNickname(then: () => void): void {
  if (ctl.nickname) {
    then();
    return;
  }
  ui.prompt('给自己起个昵称', '1–12 个字，朋友会看到', (name) => (ctl.setNickname(name) ? then() : ensureNickname(then)), false);
}

ensureNickname(() => {
  const fromShare = roomFrom(wx.getLaunchOptionsSync());
  if (fromShare) {
    void ctl.joinRoom(fromShare);
    return;
  }
  const last = store.lastRoom();
  if (last) {
    wx.showModal({
      title: '回到房间？',
      content: `上次你在房间 ${last}，要回去吗？`,
      success: (r) => {
        if (r.confirm) void ctl.joinRoom(last);
        else store.clearLastRoom();
      },
    });
  }
});

wx.onShow((o) => {
  ctl.onShow();
  const code = roomFrom(o);
  if (code && code !== ctl.code && ctl.nickname) void ctl.joinRoom(code);
});
```

- [ ] **Step 8: 测试、类型检查、构建**

Run: `cd client && npx vitest run && npm run typecheck && npm run build`
Expected: 全部通过；`minigame/game.js` 重新生成。

- [ ] **Step 9: 在模拟器里走一遍**

在微信开发者工具按 Ctrl+B 编译：首次进入弹出昵称输入 → 首页（月夜背景、标题、三个按钮、右上角昵称）→「创建房间」→ 大厅显示 4 位房号 →「加机器人」3 次 →「开始游戏（4/12）」可点 → 点击后显示「游戏进行中（界面开发中）」。「规则速查」可打开、上下拖动、关闭。

- [ ] **Step 10: 提交**

```bash
git add client minigame/game.js
git commit -m "feat(client): home, lobby, scene routing and app entry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 游戏桌（布局、玩家网格、日志、我的信息栏、手牌与出牌、信息面板）

**Files:**
- Create: `client/src/scenes/tableLayout.ts`, `client/src/scenes/tableParts.ts`, `client/src/scenes/infoPanels.ts`, `client/src/scenes/table.ts`
- Modify: `client/src/scenes/root.ts`（`playing()` 改为游戏桌）
- Test: `client/test/table.test.ts`

**Interfaces:**
- Consumes: Task 3 `buildTable`、`phaseTitle`、`formatCountdown`、`nameOf`、`logLines`、`playableCardIds`、`cardKindOf`、`targetOptions`、`optionNeed`、`ALIBI_CHOICES`、`targetCount`、`ClientAction`；Task 2 画法与部件
- Produces:
  - `interface TableLayout { top; grid: Rect[]; log; me; info; hand; buttons; cellH }`、`tableLayout(screen, others): TableLayout`
  - `interface CellOpts { turn; glow; targetable; order; alpha; flip }`、`drawCell(ctx, r, p, o)`、`drawMeBar(ctx, r, m, o)`
  - `detailPanel(ui, m, seat, close)`、`myTryalsPanel(ui, m, close)`、`logPanel(ui, m, box, close)`
  - `class TableScene`：节点 id `seat:{seat}`、`me`、`log`、`card:{id}`、`draw`、`end-turn`、`cancel`、`confirm-play`、`option:{value}`、`log-list`；`protected panels(m, now)` 供 Task 8 扩展；`protected anim(m, now)` 钩子供 Task 9 使用

- [ ] **Step 1: 写失败测试**

`client/test/table.test.ts`：
```ts
import { describe, expect, it } from 'vitest';
import type { Screen } from '../src/core/app';
import { TableScene } from '../src/scenes/table';
import { tableLayout } from '../src/scenes/tableLayout';
import { giveCard, handOf, newState, roomOf, setDay } from './fixtures';
import { canTap, drawAll, fakeCtl, fakeUi, has, tap } from './sceneKit';
import type { GameState } from '../../engine/src/index';

function scene(s: GameState, seat = 0, over: Record<string, unknown> = {}) {
  const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, seat), openid: `u${seat}`, ...over });
  const ui = fakeUi(ctl);
  return { ctl, ui, scene: new TableScene(ui) };
}

describe('布局', () => {
  const screens: Screen[] = [
    { W: 320, H: 568, top: 64, bottom: 568 },
    { W: 375, H: 667, top: 60, bottom: 667 },
    { W: 414, H: 896, top: 92, bottom: 862 },
  ];
  for (const sc of screens) {
    for (const others of [3, 11]) {
      it(`${sc.W}×${sc.H}，${others + 1} 人时各区域不重叠`, () => {
        const L = tableLayout(sc, others);
        expect(L.grid).toHaveLength(others);
        expect(L.cellH).toBeGreaterThanOrEqual(48);
        for (const c of L.grid) {
          expect(c.y).toBeGreaterThanOrEqual(L.top.y + L.top.h);
          expect(c.y + c.h).toBeLessThanOrEqual(L.log.y + 0.01);
          expect(c.x + c.w).toBeLessThanOrEqual(sc.W - 12 + 0.01);
        }
        expect(L.log.y + L.log.h).toBeLessThanOrEqual(L.me.y);
        expect(L.me.y + L.me.h).toBeLessThanOrEqual(L.info.y);
        expect(L.info.y + L.info.h).toBeLessThanOrEqual(L.hand.y);
        expect(L.hand.y + L.hand.h).toBeLessThanOrEqual(L.buttons.y);
        expect(L.buttons.y + L.buttons.h).toBeLessThanOrEqual(sc.bottom);
      });
    }
  }
});

describe('游戏桌', () => {
  it('轮到我时可以抽 2 张', () => {
    const s = newState(5);
    setDay(s, 0);
    const { ctl, scene: t } = scene(s);
    const nodes = t.build(0);
    drawAll(nodes);
    tap(nodes, 'draw');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'draw' });
  });

  it('不是我的回合时没有操作按钮', () => {
    const s = newState(5);
    setDay(s, 1);
    const nodes = scene(s).scene.build(0);
    expect(has(nodes, 'draw')).toBe(false);
    expect(drawAll(nodes).join('')).toContain('等待 P1 行动');
  });

  it('请求进行中按钮不可点', () => {
    const s = newState(5);
    setDay(s, 0);
    expect(canTap(scene(s, 0, { busy: true }).scene.build(0), 'draw')).toBe(false);
  });

  it('出指控：选牌 → 选目标 → 确认', () => {
    const s = newState(5);
    setDay(s, 0);
    giveCard(s, 0, 'accusation', 'acc-1');
    const { ctl, scene: t } = scene(s);
    tap(t.build(0), 'card:acc-1');
    let nodes = t.build(0);
    expect(canTap(nodes, 'confirm-play')).toBe(false);
    tap(nodes, 'seat:2');
    nodes = t.build(0);
    tap(nodes, 'confirm-play');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'play', cardId: 'acc-1', targets: [2] });
  });

  it('红卡不能选信徒持有者；再点一次已选目标可以取消', () => {
    const s = newState(5);
    setDay(s, 0);
    s.players[3].blue.push({ id: 'piety-1', kind: 'piety' });
    giveCard(s, 0, 'accusation', 'acc-1');
    const { scene: t } = scene(s);
    tap(t.build(0), 'card:acc-1');
    tap(t.build(0), 'seat:3');
    expect(canTap(t.build(0), 'confirm-play')).toBe(false);
    tap(t.build(0), 'seat:2');
    expect(canTap(t.build(0), 'confirm-play')).toBe(true);
    tap(t.build(0), 'seat:2');
    expect(canTap(t.build(0), 'confirm-play')).toBe(false);
  });

  it('抢劫要选两个目标', () => {
    const s = newState(5);
    setDay(s, 0);
    giveCard(s, 0, 'robbery', 'rob-1');
    const { ctl, scene: t } = scene(s);
    tap(t.build(0), 'card:rob-1');
    tap(t.build(0), 'seat:1');
    expect(canTap(t.build(0), 'confirm-play')).toBe(false);
    tap(t.build(0), 'seat:3');
    tap(t.build(0), 'confirm-play');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'play', cardId: 'rob-1', targets: [1, 3] });
  });

  it('诅咒：目标有两张蓝卡时要选一张；只有一张时自动选', () => {
    const s = newState(5);
    setDay(s, 0);
    s.players[1].blue.push({ id: 'asylum-1', kind: 'asylum' }, { id: 'piety-1', kind: 'piety' });
    s.players[2].blue.push({ id: 'matchmaker-1', kind: 'matchmaker' });
    giveCard(s, 0, 'curse', 'curse-1');
    const a = scene(s);
    tap(a.scene.build(0), 'card:curse-1');
    tap(a.scene.build(0), 'seat:1');
    tap(a.scene.build(0), 'option:piety-1');
    tap(a.scene.build(0), 'confirm-play');
    expect(a.ctl.act).toHaveBeenCalledWith({ type: 'play', cardId: 'curse-1', targets: [1], option: 'piety-1' });
    const b = scene(s);
    tap(b.scene.build(0), 'card:curse-1');
    tap(b.scene.build(0), 'seat:2');
    tap(b.scene.build(0), 'confirm-play');
    expect(b.ctl.act).toHaveBeenCalledWith({ type: 'play', cardId: 'curse-1', targets: [2], option: 'matchmaker-1' });
  });

  it('蓝卡可以打给自己（点我的信息栏）', () => {
    const s = newState(5);
    setDay(s, 0);
    giveCard(s, 0, 'asylum', 'asy-1');
    const { ctl, scene: t } = scene(s);
    tap(t.build(0), 'card:asy-1');
    tap(t.build(0), 'me');
    tap(t.build(0), 'confirm-play');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'play', cardId: 'asy-1', targets: [0] });
  });

  it('出过牌之后可以结束回合', () => {
    const s = newState(5);
    setDay(s, 0, 'playing');
    const { ctl, scene: t } = scene(s);
    tap(t.build(0), 'end-turn');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'endTurn' });
  });

  it('没选牌时点玩家格子打开详情，点我的信息栏打开我的身份卡', () => {
    const s = newState(5);
    setDay(s, 1);
    const { scene: t } = scene(s);
    tap(t.build(0), 'seat:2');
    let nodes = t.build(0);
    expect(drawAll(nodes).join('')).toContain('P2');
    tap(nodes, 'sheet-close');
    expect(has(t.build(0), 'my-tryals')).toBe(false);
    tap(t.build(0), 'me');
    nodes = t.build(0);
    expect(has(nodes, 'my-tryals')).toBe(true);
    expect(drawAll(nodes).join('')).toContain('阵营');
  });

  it('点日志打开完整记录', () => {
    const s = newState(5);
    const { scene: t } = scene(s);
    tap(t.build(0), 'log');
    expect(has(t.build(0), 'log-list')).toBe(true);
  });

  it('我已出局时显示提示', () => {
    const s = newState(5);
    setDay(s, 1);
    s.players[0].alive = false;
    expect(drawAll(scene(s).scene.build(0)).join('')).toContain('你已出局');
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd client && npx vitest run test/table.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 布局**

`client/src/scenes/tableLayout.ts`：
```ts
import type { Screen } from '../core/app';
import { rect, type Rect } from '../core/geom';

export interface TableLayout {
  top: Rect;
  grid: Rect[];
  cellH: number;
  log: Rect;
  me: Rect;
  info: Rect;
  hand: Rect;
  buttons: Rect;
}

const PAD = 12;
const COLS = 4;
const GAP = 6;

/** 从下往上排固定区域，剩下的高度给玩家网格。屏幕矮时缩小手牌和日志。 */
export function tableLayout(screen: Screen, others: number): TableLayout {
  const W = screen.W;
  const small = screen.bottom - screen.top < 560;
  const top = rect(PAD, screen.top, W - 2 * PAD, 32);
  const btnH = small ? 40 : 44;
  const buttons = rect(PAD, screen.bottom - 10 - btnH, W - 2 * PAD, btnH);
  const handH = small ? 76 : 96;
  const hand = rect(PAD, buttons.y - 6 - handH, W - 2 * PAD, handH);
  const info = rect(PAD, hand.y - 20, W - 2 * PAD, 18);
  const meH = small ? 34 : 40;
  const me = rect(PAD, info.y - 4 - meH, W - 2 * PAD, meH);
  const logH = small ? 40 : 58;
  const log = rect(PAD, me.y - 6 - logH, W - 2 * PAD, logH);
  const gridTop = top.y + top.h + 6;
  const rows = Math.max(1, Math.ceil(others / COLS));
  const avail = log.y - 6 - gridTop;
  const cellH = Math.max(48, Math.min(88, (avail - GAP * (rows - 1)) / rows));
  const cellW = (W - 2 * PAD - GAP * (COLS - 1)) / COLS;
  const grid = Array.from({ length: others }, (_, i) =>
    rect(PAD + (i % COLS) * (cellW + GAP), gridTop + Math.floor(i / COLS) * (cellH + GAP), cellW, cellH),
  );
  return { top, grid, cellH, log, me, info, hand, buttons };
}
```

核对（320×568，top 64，11 人）：`bottom-top = 504 < 560` → small；buttons.y = 518；hand.y = 436；info.y = 416；me.y = 378；log.y = 332；gridTop = 102；avail = 224；cellH = (224−12)/3 ≈ 70.7。375×667：buttons.y = 613；hand.y = 511；info.y = 491；me.y = 447；log.y = 383；gridTop = 98；avail = 279；cellH = 88（上限）。

- [ ] **Step 4: 格子和我的信息栏画法**

`client/src/scenes/tableParts.ts`：
```ts
import type { PublicPlayer } from '../../../engine/src/index';
import type { Rect } from '../core/geom';
import type { Ctx } from '../core/node';
import { CARD_INFO } from '../model/cards';
import type { TableModel } from '../model/table';
import { drawBadge, drawPanel, drawText, drawTryalChip, roundRect } from '../theme/draw';
import { C } from '../theme/palette';

export interface CellOpts {
  /** 当前回合 */
  turn: boolean;
  /** 金色光晕强度 0–1 */
  glow: number;
  /** 出牌时可选为目标 */
  targetable: boolean;
  /** 已被选为第几个目标（0 = 没有） */
  order: number;
  /** 整格透明度（死亡变灰） */
  alpha: number;
  /** 身份卡翻转动画：第 index 张，进度 p（0→1） */
  flip: { index: number; p: number } | null;
}

function tryalRow(ctx: Ctx, p: PublicPlayer, cx: number, y: number, h: number, flip: CellOpts['flip']): void {
  const n = p.tryals.length;
  const cw = Math.round(h * 0.75);
  const gap = 3;
  const x0 = cx - (n * cw + (n - 1) * gap) / 2;
  p.tryals.forEach((t, i) => {
    const r = { x: x0 + i * (cw + gap), y, w: cw, h };
    if (flip && flip.index === i && flip.p < 1) {
      if (flip.p < 0.5) drawTryalChip(ctx, r, null, false, 1 - flip.p * 2);
      else drawTryalChip(ctx, r, t.kind, true, flip.p * 2 - 1);
    } else {
      drawTryalChip(ctx, r, t.kind, t.revealed);
    }
  });
}

function redBar(ctx: Ctx, p: PublicPlayer, x: number, y: number, w: number): void {
  const bar = { x, y, w, h: 4 };
  roundRect(ctx, bar, 2);
  ctx.fillStyle = '#3b2d57';
  ctx.fill();
  const ratio = Math.min(1, p.redTotal / Math.max(1, p.threshold));
  if (ratio > 0) {
    roundRect(ctx, { ...bar, w: w * ratio }, 2);
    ctx.fillStyle = C.danger;
    ctx.fill();
  }
}

/** 面前卡牌的单字标记：黑猫→黑、情侣→情、避难→避、信徒→信、拘留→拘 */
function frontMarks(p: PublicPlayer): string {
  return [...p.blue, ...p.green].map((c) => CARD_INFO[c.kind].name[0]).join('');
}

export function drawCell(ctx: Ctx, r: Rect, p: PublicPlayer, o: CellOpts): void {
  ctx.globalAlpha = o.alpha;
  drawPanel(ctx, r, {
    fill: o.targetable ? 'rgba(232,199,116,0.14)' : C.panel,
    stroke: o.turn || o.targetable || o.order ? C.gold : C.panelLine,
    glow: o.turn ? o.glow : 0,
    lineWidth: o.order ? 2 : 1,
  });
  const cx = r.x + r.w / 2;
  if (r.h >= 70) {
    drawBadge(ctx, cx, r.y + 17, 12, p.name, p.seat);
    drawText(ctx, p.name, cx, r.y + 38, { size: 11, align: 'center', maxWidth: r.w - 6 });
    redBar(ctx, p, r.x + 6, r.y + 47, r.w - 12);
    tryalRow(ctx, p, cx, r.y + 55, 11, o.flip);
    if (r.h >= 80) {
      drawText(ctx, `手${p.handCount}`, r.x + 6, r.y + r.h - 9, { size: 10, color: C.textDim });
      drawText(ctx, frontMarks(p), r.x + r.w - 6, r.y + r.h - 9, { size: 10, color: C.gold, align: 'right', maxWidth: r.w - 34 });
    }
  } else {
    drawBadge(ctx, r.x + 13, r.y + 13, 9, p.name, p.seat);
    drawText(ctx, p.name, r.x + 26, r.y + 13, { size: 11, maxWidth: r.w - 30 });
    redBar(ctx, p, r.x + 5, r.y + 27, r.w - 10);
    tryalRow(ctx, p, cx, r.y + 34, 10, o.flip);
  }
  if (!p.alive) drawText(ctx, '出局', cx, r.y + r.h / 2, { size: 13, bold: true, color: '#fff', align: 'center' });
  if (o.order) drawText(ctx, o.order === 1 ? '①' : '②', r.x + r.w - 9, r.y + 10, { size: 12, bold: true, color: C.gold, align: 'center' });
  ctx.globalAlpha = 1;
}

export function drawMeBar(ctx: Ctx, r: Rect, m: TableModel, o: { targetable: boolean; order: number; glow: number }): void {
  drawPanel(ctx, r, {
    fill: o.targetable ? 'rgba(232,199,116,0.14)' : C.panel,
    stroke: o.targetable || o.order || m.isMyTurn ? C.gold : C.panelLine,
    glow: m.isMyTurn ? o.glow : 0,
    lineWidth: o.order ? 2 : 1,
  });
  const me = m.me;
  const cy = r.y + r.h / 2;
  if (!me) {
    drawText(ctx, '你在观战', r.x + 12, cy, { size: 13, color: C.textDim });
    return;
  }
  drawBadge(ctx, r.x + 20, cy, Math.min(13, r.h / 2 - 3), me.name, me.seat);
  const status = me.alive ? `指控 ${me.redTotal}/${me.threshold} · 手牌 ${me.handCount}` : '你已出局';
  drawText(ctx, `你（${me.name}）  ${status}`, r.x + 40, cy, { size: 12, maxWidth: r.w - 130 });
  drawText(ctx, '我的身份卡 ›', r.x + r.w - 10, cy, { size: 12, color: C.gold, align: 'right' });
  if (o.order) drawText(ctx, o.order === 1 ? '①' : '②', r.x + r.w - 96, cy, { size: 12, bold: true, color: C.gold, align: 'center' });
}
```

- [ ] **Step 5: 信息面板**

`client/src/scenes/infoPanels.ts`：
```ts
import { rect } from '../core/geom';
import type { Node } from '../core/node';
import { CARD_INFO, TRYAL_NAME } from '../model/cards';
import { logLines } from '../model/log';
import { nameOf, type TableModel } from '../model/table';
import { drawText, drawTryalChip } from '../theme/draw';
import { C } from '../theme/palette';
import type { Ui } from './ui';
import { sheet, type ScrollBox } from './widgets';

function countNames(names: string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].map(([n, k]) => (k > 1 ? `${n}×${k}` : n)).join('、');
}

export function detailPanel(ui: Ui, m: TableModel, seat: number, close: () => void): Node[] {
  const p = m.view.players[seat];
  const { nodes, body } = sheet(ui.screen, 330, `${p.name}${seat === m.mySeat ? '（你）' : ''}${p.alive ? '' : '（已出局）'}`, close);
  const revealed = p.tryals.filter((t) => t.revealed && t.kind).map((t) => TRYAL_NAME[t.kind!]);
  const reds = countNames(p.red.map((c) => CARD_INFO[c.kind].name));
  const lines = [
    ...(p.character ? [`角色：${p.character}`] : []),
    `指控：${p.redTotal} / ${p.threshold}${reds ? `（${reds}）` : ''}`,
    `蓝卡：${p.blue.length ? countNames(p.blue.map((c) => CARD_INFO[c.kind].name)) : '无'}`,
    ...(p.green.length ? [`面前：${countNames(p.green.map((c) => CARD_INFO[c.kind].name))}`] : []),
    `手牌：${p.handCount} 张`,
    `身份卡：${p.tryals.length - revealed.length} 张未翻开${revealed.length ? `；已翻开 ${revealed.join('、')}` : ''}`,
  ];
  nodes.push({
    id: 'detail-body',
    rect: body,
    draw: (ctx) => lines.forEach((t, i) => drawText(ctx, t, body.x, body.y + 12 + i * 28, { size: 14, maxWidth: body.w })),
  });
  return nodes;
}

export function myTryalsPanel(ui: Ui, m: TableModel, close: () => void): Node[] {
  const { nodes, body } = sheet(ui.screen, 320, '我的身份卡', close, 1, '只有你自己能看到');
  const priv = m.priv;
  if (!priv) return nodes;
  const n = priv.tryals.length;
  const w = Math.min(56, (body.w - 8 * (n - 1)) / Math.max(1, n));
  const h = Math.round(w * 1.35);
  const x0 = body.x + (body.w - (n * w + (n - 1) * 8)) / 2;
  const partners = priv.witchPartners.map((s) => nameOf(m, s)).join('、');
  const lines = [
    priv.witchFaction ? `你属于女巫阵营。同伴：${partners || '没有'}` : '你属于村民阵营。',
    ...(priv.isConstable ? ['你持有警长卡：夜晚可以保护一名其他玩家。'] : []),
  ];
  nodes.push({
    id: 'my-tryals',
    rect: body,
    draw: (ctx) => {
      priv.tryals.forEach((t, i) => {
        const r = rect(x0 + i * (w + 8), body.y + 6, w, h);
        drawTryalChip(ctx, r, t.kind, true);
        drawText(ctx, `${TRYAL_NAME[t.kind]}${t.revealed ? '·已翻开' : ''}`, r.x + w / 2, r.y + h + 12, { size: 11, align: 'center', color: t.revealed ? C.textMuted : C.text });
      });
      lines.forEach((t, i) => drawText(ctx, t, body.x, body.y + h + 44 + i * 24, { size: 13, color: C.gold, maxWidth: body.w }));
    },
  });
  return nodes;
}

export function logPanel(ui: Ui, m: TableModel, box: ScrollBox, close: () => void): Node[] {
  const { nodes, body } = sheet(ui.screen, ui.screen.H * 0.8, '事件记录', close, 1, '最新的在最上面');
  const lines = logLines(m.view)
    .reverse()
    .map((text, i) => ({ text, size: 13, color: i === 0 ? C.text : C.textDim, gap: 2 }));
  nodes.push(box.node('log-list', body, lines));
  return nodes;
}
```

- [ ] **Step 6: 游戏桌场景**

`client/src/scenes/table.ts`：
```ts
import type { CardKind } from '../../../engine/src/index';
import type { Scene } from '../core/app';
import { rect, type Rect } from '../core/geom';
import type { Node } from '../core/node';
import {
  ALIBI_CHOICES,
  cardKindOf,
  optionNeed,
  playableCardIds,
  targetCount,
  targetOptions,
  type ClientAction,
} from '../model/actions';
import { CARD_INFO } from '../model/cards';
import { logLines } from '../model/log';
import { buildTable, formatCountdown, phaseTitle, type TableModel } from '../model/table';
import { drawCardFace, drawPanel, drawText } from '../theme/draw';
import { C } from '../theme/palette';
import { detailPanel, logPanel, myTryalsPanel } from './infoPanels';
import { tableLayout, type TableLayout } from './tableLayout';
import { drawCell, drawMeBar, type CellOpts } from './tableParts';
import type { Ui } from './ui';
import { button, ScrollBox, sheet, skyNode } from './widgets';

const TWO_TARGET_HINT = ['先选被拿走的人', '再选接收的人'];

/** 动效参数；Task 9 之前全部是静态值 */
export interface AnimState {
  darkness: number;
  glow: number;
  cell(seat: number): Pick<CellOpts, 'alpha' | 'flip'>;
  cardIn(id: string): number;
  overlay: Node[];
  panelSlide: number;
}

export class TableScene implements Scene {
  protected sel: string | null = null;
  protected targets: number[] = [];
  protected option: string | undefined = undefined;
  protected askOption = false;
  protected peek: string | null = null;
  protected detail: number | null = null;
  protected mine = false;
  protected logOpen = false;
  protected readonly logBox = new ScrollBox();
  protected layout: TableLayout | null = null;

  constructor(protected readonly ui: Ui) {}

  build(now: number): Node[] {
    const ctl = this.ui.ctl;
    const room = ctl.room;
    if (!room || !ctl.openid) return [];
    const m = buildTable(room, ctl.hand, ctl.openid);
    if (!m) return [];
    this.sync(m);
    const L = tableLayout(this.ui.screen, m.others.length);
    this.layout = L;
    const a = this.anim(m, now);
    const nodes: Node[] = [skyNode(this.ui.screen, a.darkness)];
    nodes.push(this.topBar(m, L.top, now));
    m.others.forEach((p, i) => nodes.push(this.cell(m, p.seat, L.grid[i], a)));
    nodes.push(this.logNode(m, L.log), this.meNode(m, L.me, a), this.infoNode(m, L.info));
    nodes.push(...this.handNodes(m, L.hand, a), ...this.buttonNodes(m, L.buttons));
    nodes.push(...a.overlay);
    nodes.push(...this.panels(m, now, a));
    return nodes;
  }

  /** 动效钩子（Task 9 覆盖为真正的动画） */
  protected anim(m: TableModel, _now: number): AnimState {
    return {
      darkness: m.view.phase.kind === 'night' ? 1 : 0,
      glow: 0.6,
      cell: (seat) => ({ alpha: m.view.players[seat]?.alive ? 1 : 0.4, flip: null }),
      cardIn: () => 1,
      overlay: [],
      panelSlide: 1,
    };
  }

  /** 叠在最上层的面板；Task 8 在这里加入选择面板 */
  protected panels(m: TableModel, _now: number, _a: AnimState): Node[] {
    if (this.askOption) return this.optionSheet(m);
    if (this.detail !== null) return detailPanel(this.ui, m, this.detail, () => (this.detail = null));
    if (this.mine) return myTryalsPanel(this.ui, m, () => (this.mine = false));
    if (this.logOpen) return logPanel(this.ui, m, this.logBox, () => (this.logOpen = false));
    return [];
  }

  /** 某个座位在画面上的位置（我自己是信息栏）；给出牌飞行动画用 */
  protected seatRect(m: TableModel, seat: number): Rect | null {
    const L = this.layout;
    if (!L) return null;
    if (seat === m.mySeat) return L.me;
    const i = m.others.findIndex((p) => p.seat === seat);
    return i >= 0 ? L.grid[i] : null;
  }

  private sync(m: TableModel): void {
    if (this.sel && !playableCardIds(m).includes(this.sel)) this.clearSel();
    if (this.peek && !m.priv?.hand.some((c) => c.id === this.peek)) this.peek = null;
  }

  private clearSel(): void {
    this.sel = null;
    this.targets = [];
    this.option = undefined;
    this.askOption = false;
  }

  private selKind(m: TableModel): CardKind | null {
    return this.sel ? cardKindOf(m, this.sel) : null;
  }

  private topBar(m: TableModel, r: Rect, now: number): Node {
    return {
      rect: r,
      draw: (ctx) => {
        const cy = r.y + r.h / 2;
        drawText(ctx, phaseTitle(m), r.x, cy, { size: 15, bold: true, color: C.gold, maxWidth: r.w * 0.46 });
        const cd = formatCountdown(m.deadline, now);
        if (cd) drawText(ctx, cd, r.x + r.w * 0.6, cy, { size: 15, bold: true, color: m.pending ? C.gold : C.text, align: 'center' });
        drawText(ctx, `牌堆 ${m.view.deckCount} · 弃 ${m.view.discardCount}`, r.x + r.w, cy, { size: 11, color: C.textDim, align: 'right' });
      },
    };
  }

  private cell(m: TableModel, seat: number, r: Rect, a: AnimState): Node {
    const p = m.view.players[seat];
    const kind = this.selKind(m);
    const targetable = !!kind && targetOptions(m, kind, this.targets).includes(seat);
    const turn = m.view.phase.kind === 'day' && m.turnSeat === seat;
    const opts: CellOpts = { turn, glow: a.glow, targetable, order: this.targets.indexOf(seat) + 1, ...a.cell(seat) };
    return { id: `seat:${seat}`, rect: r, onTap: () => this.tapSeat(m, seat), draw: (ctx) => drawCell(ctx, r, p, opts) };
  }

  private tapSeat(m: TableModel, seat: number): void {
    const kind = this.selKind(m);
    if (!kind) {
      this.detail = seat;
      return;
    }
    if (this.targets.includes(seat)) {
      this.targets = this.targets.filter((t) => t !== seat);
      this.option = undefined;
      return;
    }
    const need = targetCount(kind);
    if (this.targets.length >= need || !targetOptions(m, kind, this.targets).includes(seat)) return;
    this.targets = [...this.targets, seat];
    if (this.targets.length === need) this.resolveOption(m, kind);
  }

  private resolveOption(m: TableModel, kind: CardKind): void {
    const need = optionNeed(m, kind, this.targets[0]);
    if (!need) return;
    if (need.kind === 'curse' && need.cards.length === 1) {
      this.option = need.cards[0].id;
      return;
    }
    this.askOption = true;
  }

  private ready(m: TableModel): boolean {
    const kind = this.selKind(m);
    if (!kind || this.targets.length !== targetCount(kind)) return false;
    return !optionNeed(m, kind, this.targets[0]) || this.option !== undefined;
  }

  private confirmPlay(): void {
    if (!this.sel) return;
    const action: ClientAction = {
      type: 'play',
      cardId: this.sel,
      targets: this.targets,
      ...(this.option !== undefined ? { option: this.option } : {}),
    };
    this.clearSel();
    void this.ui.ctl.act(action);
  }

  private logNode(m: TableModel, r: Rect): Node {
    const count = r.h >= 54 ? 3 : 2;
    const lines = logLines(m.view).slice(-count);
    return {
      id: 'log',
      rect: r,
      onTap: () => {
        this.logOpen = true;
        this.logBox.reset();
      },
      draw: (ctx) => {
        drawPanel(ctx, r, { fill: C.logBg, stroke: '#3b2d57' });
        const lh = (r.h - 8) / count;
        lines.forEach((t, i) =>
          drawText(ctx, t, r.x + 8, r.y + 4 + lh * (i + 0.5), { size: 11, color: i === lines.length - 1 ? C.text : C.textDim, maxWidth: r.w - 16 }),
        );
      },
    };
  }

  private meNode(m: TableModel, r: Rect, a: AnimState): Node {
    const kind = this.selKind(m);
    const me = m.mySeat;
    const targetable = me !== null && !!kind && targetOptions(m, kind, this.targets).includes(me);
    const order = me === null ? 0 : this.targets.indexOf(me) + 1;
    return {
      id: 'me',
      rect: r,
      onTap: () => {
        if (kind && me !== null) this.tapSeat(m, me);
        else if (!kind && m.priv) this.mine = true;
      },
      draw: (ctx) => drawMeBar(ctx, r, m, { targetable, order, glow: a.glow }),
    };
  }

  private infoText(m: TableModel): string {
    const kind = this.selKind(m);
    if (kind) {
      const name = CARD_INFO[kind].name;
      const need = targetCount(kind);
      if (this.targets.length < need) return need === 2 ? `「${name}」：${TWO_TARGET_HINT[this.targets.length]}` : `「${name}」：选择目标`;
      return this.ready(m) ? `「${name}」：点「确认出牌」` : `「${name}」：请选择选项`;
    }
    if (this.peek) {
      const k = cardKindOf(m, this.peek);
      if (k) return `${CARD_INFO[k].name}：${CARD_INFO[k].desc}`;
    }
    if (m.me && !m.me.alive) return '你已出局，可以继续观看';
    if (m.pending?.kind === 'turn') return m.pending.mode === 'choose' ? '你的回合：抽 2 张，或点一张手牌打出' : '可以继续出牌，或结束回合';
    if (m.view.phase.kind === 'day') return `等待 ${m.view.players[m.turnSeat].name} 行动…`;
    return phaseTitle(m);
  }

  private infoNode(m: TableModel, r: Rect): Node {
    const text = this.infoText(m);
    return { rect: r, draw: (ctx) => drawText(ctx, text, r.x + r.w / 2, r.y + r.h / 2, { size: 12, color: C.gold, align: 'center', maxWidth: r.w }) };
  }

  private handNodes(m: TableModel, r: Rect, a: AnimState): Node[] {
    const hand = m.priv?.hand ?? [];
    if (!hand.length) {
      return [{ rect: r, draw: (ctx) => drawText(ctx, m.priv ? '没有手牌' : '', r.x + r.w / 2, r.y + r.h / 2, { size: 12, color: C.textMuted, align: 'center' }) }];
    }
    const playable = playableCardIds(m);
    const ch = r.h - 12;
    const cw = Math.round(ch * 0.69);
    const n = hand.length;
    const step = n > 1 ? Math.min(cw + 6, (r.w - cw) / (n - 1)) : 0;
    const x0 = r.x + (r.w - (cw + step * (n - 1))) / 2;
    return hand.map((c, i) => {
      const lifted = c.id === this.sel;
      const p = a.cardIn(c.id);
      const cr = rect(x0 + step * i, r.y + (lifted ? 0 : 12) + (1 - p) * 40, cw, ch);
      return {
        id: `card:${c.id}`,
        rect: cr,
        onTap: () => this.tapCard(c.id, playable),
        draw: (ctx) => {
          ctx.globalAlpha = p;
          drawCardFace(ctx, cr, c.kind, { selected: lifted, dim: m.pending?.kind === 'turn' && !playable.includes(c.id) });
          ctx.globalAlpha = 1;
        },
      };
    });
  }

  private tapCard(id: string, playable: string[]): void {
    if (playable.includes(id)) {
      if (this.sel === id) this.clearSel();
      else {
        this.clearSel();
        this.sel = id;
        this.peek = null;
      }
      return;
    }
    this.peek = this.peek === id ? null : id;
  }

  private buttonNodes(m: TableModel, r: Rect): Node[] {
    const ctl = this.ui.ctl;
    const busy = ctl.busy;
    const half = (r.w - 10) / 2;
    if (this.sel) {
      return [
        button('cancel', rect(r.x, r.y, half, r.h), '取消', () => this.clearSel(), 'secondary'),
        button('confirm-play', rect(r.x + half + 10, r.y, half, r.h), '确认出牌', this.ready(m) && !busy ? () => this.confirmPlay() : null),
      ];
    }
    if (m.pending?.kind !== 'turn') return [];
    if (m.pending.mode === 'choose') return [button('draw', r, '抽 2 张', busy ? null : () => void ctl.act({ type: 'draw' }))];
    return [button('end-turn', r, '结束回合', busy ? null : () => void ctl.act({ type: 'endTurn' }), 'secondary')];
  }

  private optionSheet(m: TableModel): Node[] {
    const kind = this.selKind(m);
    const target = this.targets[0];
    const need = kind && target !== undefined ? optionNeed(m, kind, target) : null;
    if (!need) {
      this.askOption = false;
      return [];
    }
    const close = () => {
      this.askOption = false;
      this.targets = this.targets.slice(0, -1);
    };
    const title = need.kind === 'curse' ? '诅咒：丢弃哪张蓝卡？' : '辩护：丢弃哪种红卡？';
    const { nodes, body } = sheet(this.ui.screen, 280, title, close);
    const choices =
      need.kind === 'curse'
        ? need.cards.map((c) => ({ value: c.id, label: CARD_INFO[c.kind].name }))
        : ALIBI_CHOICES.map((c) => ({ value: c.value as string, label: c.label as string }));
    choices.forEach((c, i) =>
      nodes.push(
        button(`option:${c.value}`, rect(body.x, body.y + i * 52, body.w, 44), c.label, () => {
          this.option = c.value;
          this.askOption = false;
        }, 'secondary'),
      ),
    );
    return nodes;
  }
}
```

- [ ] **Step 7: 路由改用游戏桌**

修改 `client/src/scenes/root.ts`：
1. 增加 `import { TableScene } from './table';`
2. 在类里增加字段 `private table: TableScene | null = null;` 和 `private tableKey = '';`
3. 把 `playing()` 整体替换为：
```ts
  private playing(now: number): Node[] {
    const room = this.ui.ctl.room!;
    const key = `${room.code}:${room.gameId}`;
    if (!this.table || key !== this.tableKey) {
      this.table = new TableScene(this.ui);
      this.tableKey = key;
    }
    return this.table.build(now);
  }
```

- [ ] **Step 8: 测试、类型检查、构建**

Run: `cd client && npx vitest run && npm run typecheck && npm run build`
Expected: 全部通过。

- [ ] **Step 9: 在模拟器里走一遍**

建房 → 加 4 个机器人 → 开始。确认：顶栏显示阶段、倒计时每秒走、牌堆数；网格里 4 个机器人；日志显示「游戏开始」；我的信息栏；底部手牌扇形排开。第一夜结束后（约 45 秒，或机器人超时推进），轮到自己时出现「抽 2 张」；点一张指控 → 可选格子高亮 → 点一个机器人 →「确认出牌」→ 日志出现「你 对 机器人X 打出「指控」」对应文字。

- [ ] **Step 10: 提交**

```bash
git add client minigame/game.js
git commit -m "feat(client): game table with grid, hand, play flow and info panels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 选择面板（审判、黑猫、传染、黎明、夜晚）与结算页

**Files:**
- Create: `client/src/scenes/choicePanels.ts`, `client/src/scenes/result.ts`
- Modify: `client/src/scenes/table.ts`（`panels()` 优先显示选择面板）
- Modify: `client/src/scenes/root.ts`（`ended()` 改为结算页）
- Test: `client/test/choices.test.ts`

**Interfaces:**
- Consumes: Task 3 `nightSteps`、`nightTargets`、`dawnTargets`、`unrevealedTryals`、`formatCountdown`、`nameOf`；Task 7 `TableScene`、`AnimState`
- Produces:
  - `interface ChoiceState { key; picked; suspect }`、`choiceKey(m)`、`choicePanel(ui, m, st, now, slide): Node[]`
  - 节点 id：`tryal:{id}`、`confirm-reveal`、`pick:{i}`、`confirm-pick`、`vote:{seat}`（黎明）、`kill:{seat}`、`protect:{seat}`、`suspect:{seat}`、`confess:{tryalId}`、`confirm-confess`、`no-confess`
  - `class ResultScene`，节点 id `result-home`

- [ ] **Step 1: 写失败测试**

`client/test/choices.test.ts`：
```ts
import { describe, expect, it } from 'vitest';
import type { GameState } from '../../engine/src/index';
import { ResultScene } from '../src/scenes/result';
import { TableScene } from '../src/scenes/table';
import { handOf, newState, roomOf } from './fixtures';
import { canTap, drawAll, fakeCtl, fakeUi, has, tap } from './sceneKit';

function table(s: GameState, seat: number) {
  const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, seat), openid: `u${seat}` });
  return { ctl, t: new TableScene(fakeUi(ctl)) };
}
const witches = (s: GameState) => s.players.filter((p) => p.witchFaction).map((p) => p.seat);
const constable = (s: GameState) => s.players.find((p) => p.tryals.some((t) => t.kind === 'constable' && !t.revealed))!.seat;

describe('选择面板', () => {
  it('审判：选一张身份卡再确认', () => {
    const s = newState(5);
    s.phase = { kind: 'trialReveal', target: 2, initiator: 0 };
    const { ctl, t } = table(s, 2);
    const id = s.players[2].tryals[1].id;
    let nodes = t.build(0);
    expect(canTap(nodes, 'confirm-reveal')).toBe(false);
    tap(nodes, `tryal:${id}`);
    nodes = t.build(0);
    drawAll(nodes);
    tap(nodes, 'confirm-reveal');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'revealTryal', tryalId: id });
  });

  it('选中女巫卡时提示会死亡', () => {
    const s = newState(5);
    const w = witches(s)[0];
    s.phase = { kind: 'trialReveal', target: w, initiator: (w + 1) % 5 };
    const { t } = table(s, w);
    const witchCard = s.players[w].tryals.find((x) => x.kind === 'witch')!;
    tap(t.build(0), `tryal:${witchCard.id}`);
    expect(drawAll(t.build(0)).join('')).toContain('翻开女巫卡会立即死亡');
  });

  it('传染：盲抽左边玩家的一张', () => {
    const s = newState(5);
    s.phase = { kind: 'conspiracyPick' };
    const { ctl, t } = table(s, 0);
    tap(t.build(0), 'pick:3');
    tap(t.build(0), 'confirm-pick');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'conspiracyPick', index: 3 });
  });

  it('黎明：女巫阵营投票放黑猫', () => {
    const s = newState(5);
    const w = witches(s)[0];
    const { ctl, t } = table(s, w);
    tap(t.build(0), 'vote:3');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'witchVote', target: 3 });
  });

  it('夜晚：女巫选击杀目标，警长选保护对象，其他人选怀疑对象（不发请求）', () => {
    const s = newState(6, 2);
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    const w = witches(s)[0];
    const a = table(s, w);
    tap(a.t.build(0), 'kill:1');
    expect(a.ctl.act).toHaveBeenCalledWith({ type: 'witchVote', target: 1 });

    const c = constable(s);
    const b = table(s, c);
    const nodes = b.t.build(0);
    expect(has(nodes, `protect:${c}`)).toBe(false);
    tap(nodes, `protect:${(c + 1) % 6}`);
    expect(b.ctl.act).toHaveBeenCalledWith({ type: 'protect', target: (c + 1) % 6 });

    const plain = s.players.find((p) => !p.witchFaction && p.seat !== c)!.seat;
    const d = table(s, plain);
    tap(d.t.build(0), `suspect:${(plain + 1) % 6}`);
    expect(d.ctl.act).not.toHaveBeenCalled();
    expect(has(d.t.build(0), 'no-confess')).toBe(true);
  });

  it('夜晚：自首或不自首', () => {
    const s = newState(5);
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    const plain = s.players.find((p) => !p.witchFaction)!.seat;
    const a = table(s, plain);
    tap(a.t.build(0), 'no-confess');
    expect(a.ctl.act).toHaveBeenCalledWith({ type: 'confess', tryalId: null });
    const b = table(s, plain);
    const id = s.players[plain].tryals[0].id;
    expect(canTap(b.t.build(0), 'confirm-confess')).toBe(false);
    tap(b.t.build(0), `confess:${id}`);
    tap(b.t.build(0), 'confirm-confess');
    expect(b.ctl.act).toHaveBeenCalledWith({ type: 'confess', tryalId: id });
  });

  it('已经自首后不再显示自首按钮', () => {
    const s = newState(5);
    s.phase = { kind: 'night' };
    const plain = s.players.find((p) => !p.witchFaction)!.seat;
    s.night = { witchVotes: {}, protect: null, confessions: { [plain]: null } };
    const nodes = table(s, plain).t.build(0);
    expect(has(nodes, 'no-confess')).toBe(false);
  });
});

describe('结算页', () => {
  it('显示胜负和每个人的阵营，可以回首页', () => {
    const s = newState(5);
    s.phase = { kind: 'ended', winner: 'witch' };
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0) });
    const nodes = new ResultScene(fakeUi(ctl)).build(0);
    const text = drawAll(nodes).join('');
    expect(text).toContain('女巫胜利');
    expect(text).toContain('女巫阵营');
    expect(text).toContain('P4');
    tap(nodes, 'result-home');
    expect(ctl.backHome).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd client && npx vitest run test/choices.test.ts`
Expected: FAIL

- [ ] **Step 3: 选择面板**

`client/src/scenes/choicePanels.ts`：
```ts
import { rect, type Rect } from '../core/geom';
import type { Node } from '../core/node';
import { dawnTargets, nightSteps, nightTargets, unrevealedTryals, type NightPending, type NightStep } from '../model/actions';
import { TRYAL_NAME } from '../model/cards';
import { formatCountdown, nameOf, type TableModel } from '../model/table';
import { drawBadge, drawPanel, drawText, drawTryalChip } from '../theme/draw';
import { C } from '../theme/palette';
import type { Ui } from './ui';
import { button, sheet, textNode } from './widgets';

export interface ChoiceState {
  key: string;
  /** 已选中的身份卡 id 或盲抽序号（等待确认） */
  picked: string | number | null;
  /** 夜晚「怀疑对象」（只在本地记录） */
  suspect: number | null;
}

export function choiceKey(m: TableModel): string {
  return m.pending ? `${m.pending.kind}:${m.view.phase.kind}:${m.view.log.length}` : '';
}

/** 一排玩家按钮（每行 4 个）。返回节点和占用的高度。 */
function seatGrid(
  m: TableModel,
  area: Rect,
  prefix: string,
  seats: number[],
  selected: number | null,
  marks: Record<number, string[]>,
  onPick: ((seat: number) => void) | null,
): { nodes: Node[]; height: number } {
  const cols = 4;
  const gap = 6;
  const w = (area.w - gap * (cols - 1)) / cols;
  const h = 36;
  const nodes = seats.map((seat, i) => {
    const r = rect(area.x + (i % cols) * (w + gap), area.y + Math.floor(i / cols) * (h + gap), w, h);
    const p = m.view.players[seat];
    const mark = marks[seat]?.join('、') ?? '';
    return {
      id: `${prefix}:${seat}`,
      rect: r,
      onTap: onPick ? () => onPick(seat) : undefined,
      draw: (ctx: CanvasRenderingContext2D) => {
        drawPanel(ctx, r, { fill: selected === seat ? 'rgba(232,199,116,0.25)' : C.panel, stroke: selected === seat ? C.gold : C.panelLine, lineWidth: selected === seat ? 2 : 1 });
        drawBadge(ctx, r.x + 13, r.y + h / 2, 9, p.name, seat);
        drawText(ctx, nameOf(m, seat), r.x + 26, r.y + (mark ? 12 : h / 2), { size: 12, maxWidth: r.w - 30 });
        if (mark) drawText(ctx, mark, r.x + 26, r.y + 26, { size: 9, color: C.gold, maxWidth: r.w - 30 });
      },
    } satisfies Node;
  });
  return { nodes, height: Math.ceil(seats.length / cols) * (h + gap) };
}

function votesToMarks(m: TableModel, votes: Record<number, number> | null): Record<number, string[]> {
  const marks: Record<number, string[]> = {};
  for (const [voter, target] of Object.entries(votes ?? {})) (marks[target] ??= []).push(nameOf(m, Number(voter)));
  return marks;
}

/** 一排身份卡（faceUp 为 false 时画背面） */
function tryalRow(area: Rect, items: { id: string; kind: 'witch' | 'constable' | 'villager' | null }[], prefix: string, selected: string | number | null, onPick: (key: string, i: number) => void): { nodes: Node[]; height: number } {
  const n = items.length;
  const gap = 8;
  const w = Math.min(52, (area.w - gap * (n - 1)) / Math.max(1, n));
  const h = Math.round(w * 1.3);
  const x0 = area.x + (area.w - (n * w + (n - 1) * gap)) / 2;
  const nodes = items.map((it, i) => {
    const r = rect(x0 + i * (w + gap), area.y, w, h);
    const sel = selected === it.id || selected === i;
    return {
      id: `${prefix}:${it.id}`,
      rect: r,
      onTap: () => onPick(it.id, i),
      draw: (ctx: CanvasRenderingContext2D) => {
        drawTryalChip(ctx, r, it.kind, it.kind !== null);
        if (sel) drawPanel(ctx, rect(r.x - 3, r.y - 3, r.w + 6, r.h + 6), { fill: 'rgba(0,0,0,0)', stroke: C.gold, lineWidth: 2, radius: 4 });
        if (it.kind) drawText(ctx, TRYAL_NAME[it.kind], r.x + w / 2, r.y + h + 11, { size: 11, align: 'center' });
      },
    } satisfies Node;
  });
  return { nodes, height: h + (items.some((x) => x.kind) ? 20 : 4) };
}

export function choicePanel(ui: Ui, m: TableModel, st: ChoiceState, now: number, slide = 1): Node[] {
  const p = m.pending;
  if (!p || p.kind === 'turn') return [];
  const key = choiceKey(m);
  if (st.key !== key) {
    st.key = key;
    st.picked = null;
    st.suspect = null;
  }
  const cd = formatCountdown(m.deadline, now);
  const busy = ui.ctl.busy;
  const act = ui.ctl.act.bind(ui.ctl);

  if (p.kind === 'revealTryal') {
    const title = p.reason === 'trial' ? '你受到审判：翻开一张身份卡' : '传染：你持有黑猫，翻开一张身份卡';
    const { nodes, body } = sheet(ui.screen, 320, title, null, slide, `剩余 ${cd} · 超时将随机翻开`);
    const tryals = unrevealedTryals(m);
    const row = tryalRow(body, tryals.map((t) => ({ id: t.id, kind: t.kind })), 'tryal', st.picked, (id) => (st.picked = id));
    nodes.push(...row.nodes);
    const picked = tryals.find((t) => t.id === st.picked);
    let y = body.y + row.height + 8;
    if (picked?.kind === 'witch') {
      nodes.push(textNode(rect(body.x, y, body.w, 20), '翻开女巫卡会立即死亡', { size: 13, color: C.danger, align: 'center' }));
    }
    y += 28;
    nodes.push(button('confirm-reveal', rect(body.x, y, body.w, 44), '确认翻开', picked && !busy ? () => void act({ type: 'revealTryal', tryalId: picked.id }) : null));
    return nodes;
  }

  if (p.kind === 'conspiracyPick') {
    const from = m.view.players[p.from];
    const { nodes, body } = sheet(ui.screen, 300, `传染：从 ${from.name} 的身份卡里盲抽一张`, null, slide, `剩余 ${cd} · 超时将随机抽取`);
    const items = Array.from({ length: p.count }, (_, i) => ({ id: String(i), kind: null }));
    const row = tryalRow(body, items, 'pick', st.picked, (_id, i) => (st.picked = i));
    nodes.push(...row.nodes);
    const idx = typeof st.picked === 'number' ? st.picked : null;
    nodes.push(button('confirm-pick', rect(body.x, body.y + row.height + 16, body.w, 44), '拿这张', idx !== null && !busy ? () => void act({ type: 'conspiracyPick', index: idx }) : null));
    return nodes;
  }

  if (p.kind === 'dawnVote') {
    const { nodes, body } = sheet(ui.screen, 360, '第一夜：和同伴一起选择黑猫的主人', null, slide, `同伴选择一致后生效 · 剩余 ${cd}`);
    const mine = m.mySeat !== null ? p.votes[m.mySeat] ?? null : null;
    const grid = seatGrid(m, body, 'vote', dawnTargets(m), mine, votesToMarks(m, p.votes), busy ? null : (seat) => void act({ type: 'witchVote', target: seat }));
    nodes.push(...grid.nodes);
    return nodes;
  }

  return nightPanel(ui, m, p, st, cd, slide);
}

const STEP_TITLE: Record<NightStep, string> = {
  kill: '选择击杀目标（同伴须一致）',
  protect: '选择保护一名玩家（不能是自己）',
  suspect: '选择你怀疑的人',
};

function nightPanel(ui: Ui, m: TableModel, p: NightPending, st: ChoiceState, cd: string, slide: number): Node[] {
  const busy = ui.ctl.busy;
  const act = ui.ctl.act.bind(ui.ctl);
  const { nodes, body } = sheet(ui.screen, ui.screen.H - ui.screen.top, '夜晚', null, slide, `剩余 ${cd} · 超时将自动处理`);
  let y = body.y;
  for (const step of nightSteps(p)) {
    nodes.push(textNode(rect(body.x, y, body.w, 20), STEP_TITLE[step], { size: 13, color: C.gold }));
    y += 24;
    const seats = nightTargets(m, step);
    const area = rect(body.x, y, body.w, 0);
    const grid =
      step === 'kill'
        ? seatGrid(m, area, 'kill', seats, m.mySeat !== null ? (p.votes?.[m.mySeat] ?? null) : null, votesToMarks(m, p.votes), busy ? null : (seat) => void act({ type: 'witchVote', target: seat }))
        : step === 'protect'
          ? seatGrid(m, area, 'protect', seats, p.protect, {}, busy ? null : (seat) => void act({ type: 'protect', target: seat }))
          : seatGrid(m, area, 'suspect', seats, st.suspect, {}, (seat) => (st.suspect = seat));
    nodes.push(...grid.nodes);
    y += grid.height + 8;
  }
  if (p.confessed) {
    nodes.push(textNode(rect(body.x, y, body.w, 24), '自首：已决定。等待其他玩家…', { size: 13, color: C.textDim }));
    return nodes;
  }
  nodes.push(textNode(rect(body.x, y, body.w, 20), '是否自首？自首要翻开一张身份卡，当晚不会被杀', { size: 13, color: C.gold }));
  y += 26;
  const tryals = unrevealedTryals(m);
  const row = tryalRow(rect(body.x, y, body.w, 0), tryals.map((t) => ({ id: t.id, kind: t.kind })), 'confess', st.picked, (id) => (st.picked = id));
  nodes.push(...row.nodes);
  y += row.height + 6;
  const half = (body.w - 10) / 2;
  const picked = typeof st.picked === 'string' ? st.picked : null;
  nodes.push(
    button('no-confess', rect(body.x, y, half, 42), '不自首', busy ? null : () => void act({ type: 'confess', tryalId: null }), 'secondary'),
    button('confirm-confess', rect(body.x + half + 10, y, half, 42), '自首', picked && !busy ? () => void act({ type: 'confess', tryalId: picked }) : null, 'danger'),
  );
  return nodes;
}
```

- [ ] **Step 4: 游戏桌接入选择面板**

修改 `client/src/scenes/table.ts`：
1. 增加 `import { choicePanel, type ChoiceState } from './choicePanels';`
2. 在类字段里增加 `protected readonly choice: ChoiceState = { key: '', picked: null, suspect: null };`
3. 把 `panels()` 的第一行之前插入：
```ts
    const choice = choicePanel(this.ui, m, this.choice, _now, _a.panelSlide);
    if (choice.length) return choice;
```
（参数名 `_now`、`_a` 此时已被使用，可改名为 `now`、`a`。）

- [ ] **Step 5: 结算页**

`client/src/scenes/result.ts`：
```ts
import type { Scene } from '../core/app';
import { rect } from '../core/geom';
import type { Node } from '../core/node';
import { drawBadge, drawPanel, drawText, drawTryalChip } from '../theme/draw';
import { C } from '../theme/palette';
import type { Ui } from './ui';
import { button, skyNode } from './widgets';

export class ResultScene implements Scene {
  constructor(private readonly ui: Ui) {}

  build(): Node[] {
    const { W, top, bottom } = this.ui.screen;
    const ctl = this.ui.ctl;
    const view = ctl.room?.view;
    if (!view || view.phase.kind !== 'ended') return [];
    const village = view.phase.winner === 'village';
    const mySeat = ctl.room!.seats.findIndex((s) => s.openid === ctl.openid);
    const nodes: Node[] = [skyNode(this.ui.screen, village ? 0 : 0.6)];
    nodes.push({
      rect: rect(0, top, W, 90),
      draw: (ctx) => {
        drawText(ctx, village ? '村民胜利' : '女巫胜利', W / 2, top + 30, { size: 36, bold: true, color: village ? C.gold : C.danger, align: 'center' });
        drawText(ctx, village ? '所有女巫卡都已翻开' : '活着的人全部属于女巫阵营', W / 2, top + 68, { size: 13, color: C.textDim, align: 'center' });
      },
    });
    const btnY = bottom - 12 - 48;
    const listTop = top + 100;
    const rowH = Math.min(52, (btnY - 10 - listTop) / Math.max(1, view.players.length));
    view.players.forEach((p, i) => {
      const r = rect(12, listTop + i * rowH, W - 24, rowH - 4);
      nodes.push({
        rect: r,
        draw: (ctx) => {
          drawPanel(ctx, r, { stroke: p.witchFaction ? C.danger : C.panelLine });
          drawBadge(ctx, r.x + 18, r.y + r.h / 2, Math.min(13, r.h / 2 - 3), p.name, p.seat);
          drawText(ctx, `${p.name}${i === mySeat ? '（你）' : ''}`, r.x + 38, r.y + r.h / 2 - 7, { size: 13, maxWidth: r.w * 0.4 });
          drawText(ctx, `${p.witchFaction ? '女巫阵营' : '村民阵营'} · ${p.alive ? '存活' : '出局'}`, r.x + 38, r.y + r.h / 2 + 9, { size: 11, color: p.witchFaction ? C.danger : C.textDim });
          const cw = 12;
          const x0 = r.x + r.w - 10 - p.tryals.length * (cw + 3);
          p.tryals.forEach((t, j) => drawTryalChip(ctx, rect(x0 + j * (cw + 3), r.y + r.h / 2 - 8, cw, 16), t.kind, true));
        },
      });
    });
    nodes.push(button('result-home', rect(12, btnY, W - 24, 48), '回到首页', () => ctl.backHome()));
    return nodes;
  }
}
```

- [ ] **Step 6: 路由改用结算页**

修改 `client/src/scenes/root.ts`：增加 `import { ResultScene } from './result';`、字段 `private readonly result: ResultScene;`（构造函数里 `this.result = new ResultScene(ui);`），并把 `ended()` 替换为：
```ts
  private ended(_now: number): Node[] {
    return this.result.build();
  }
```

- [ ] **Step 7: 测试、类型检查、构建**

Run: `cd client && npx vitest run && npm run typecheck && npm run build`
Expected: 全部通过（包括 Task 6 的路由测试）。

- [ ] **Step 8: 在模拟器里走一遍**

1 人 + 3 个机器人开局：第一夜若自己是女巫，底部弹出「第一夜」面板，点一个玩家后显示自己的选择；否则直接等待。之后一直「抽 2 张」直到抽到夜晚：夜晚画面变暗，面板显示「选择你怀疑的人」（或击杀 / 保护）和自首区；点「不自首」后显示「等待其他玩家…」。机器人会在超时后自动行动。玩到结束，出现结算页，「回到首页」可用。

- [ ] **Step 9: 提交**

```bash
git add client minigame/game.js
git commit -m "feat(client): choice panels for trial, conspiracy, dawn and night; result screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 动效

**Files:**
- Create: `client/src/model/changes.ts`
- Modify: `client/src/scenes/table.ts`（覆盖 `anim()`，记录上一帧数据）
- Test: `client/test/changes.test.ts`

**Interfaces:**
- Consumes: Task 3 `TableModel`；Task 1 `Animator`；Task 7 `AnimState`、`seatRect()`
- Produces:
  - `type Change = cardIn | play | night | death | reveal | turn | panel`（字段见代码）
  - `diffTables(prev, next): Change[]`
  - `ANIM_MS`（各动效时长）

- [ ] **Step 1: 写失败测试**

`client/test/changes.test.ts`：
```ts
import { describe, expect, it } from 'vitest';
import { diffTables } from '../src/model/changes';
import { buildTable } from '../src/model/table';
import { TableScene } from '../src/scenes/table';
import { handOf, newState, roomOf, setDay } from './fixtures';
import { fakeCtl, fakeUi } from './sceneKit';

const model = (s: ReturnType<typeof newState>, seat = 0) => buildTable(roomOf(s), handOf(s, seat), `u${seat}`)!;

describe('diffTables', () => {
  it('第一次或换了一局时没有变化', () => {
    const s = newState(5);
    expect(diffTables(null, model(s))).toEqual([]);
  });

  it('新手牌、出牌、入夜、死亡、翻牌、换回合、弹出面板', () => {
    const s = newState(5);
    setDay(s, 1);
    const before = model(s);
    s.players[0].hand.push({ id: 'new-1', kind: 'accusation' });
    s.log.push({ t: 'play', seat: 1, kind: 'accusation', targets: [2] });
    s.players[3].alive = false;
    s.players[2].tryals[0].revealed = true;
    s.phase = { kind: 'trialReveal', target: 0, initiator: 1 };
    const after = model(s);
    const changes = diffTables(before, after);
    expect(changes).toContainEqual({ kind: 'cardIn', id: 'new-1' });
    expect(changes).toContainEqual({ kind: 'play', index: before.view.log.length, from: 1, to: 2, card: 'accusation' });
    expect(changes).toContainEqual({ kind: 'death', seat: 3 });
    expect(changes).toContainEqual({ kind: 'reveal', seat: 2, index: 0 });
    expect(changes).toContainEqual({ kind: 'panel' });

    const dayBefore = model(s);
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    expect(diffTables(dayBefore, model(s))).toContainEqual({ kind: 'night', on: true });

    setDay(s, 2);
    const t1 = model(s);
    setDay(s, 3);
    expect(diffTables(t1, model(s))).toContainEqual({ kind: 'turn', seat: 3 });
  });
});

describe('游戏桌动效', () => {
  it('收到新牌时启动滑入动画；入夜时启动天色动画', () => {
    const s = newState(5);
    setDay(s, 0);
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0) }) as unknown as { room: unknown; hand: unknown };
    const ui = fakeUi(ctl as never);
    const t = new TableScene(ui);
    t.build(0);
    s.players[0].hand.push({ id: 'new-1', kind: 'evidence' });
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    ctl.room = roomOf(s);
    ctl.hand = handOf(s, 0);
    t.build(10);
    expect(ui.animator.running('in:new-1', 20)).toBe(true);
    expect(ui.animator.running('sky', 20)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd client && npx vitest run test/changes.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 changes.ts**

`client/src/model/changes.ts`：
```ts
import type { CardKind } from '../../../engine/src/index';
import type { TableModel } from './table';

export type Change =
  | { kind: 'cardIn'; id: string }
  | { kind: 'play'; index: number; from: number; to: number; card: CardKind }
  | { kind: 'night'; on: boolean }
  | { kind: 'death'; seat: number }
  | { kind: 'reveal'; seat: number; index: number }
  | { kind: 'turn'; seat: number }
  | { kind: 'panel' };

export const ANIM_MS = { cardIn: 300, play: 450, night: 600, death: 500, reveal: 500, turn: 1800, panel: 250 } as const;

const dayTurn = (m: TableModel): number | null => (m.view.phase.kind === 'day' ? m.turnSeat : null);

/** 比较前后两份画面数据，找出需要播放动效的变化 */
export function diffTables(prev: TableModel | null, next: TableModel): Change[] {
  if (!prev || prev.code !== next.code || prev.view.log.length > next.view.log.length) return [];
  const out: Change[] = [];
  if (prev.priv) {
    const before = new Set(prev.priv.hand.map((c) => c.id));
    for (const c of next.priv?.hand ?? []) if (!before.has(c.id)) out.push({ kind: 'cardIn', id: c.id });
  }
  next.view.log.slice(prev.view.log.length).forEach((e, k) => {
    if (e.t === 'play') out.push({ kind: 'play', index: prev.view.log.length + k, from: e.seat, to: e.targets[e.targets.length - 1], card: e.kind });
  });
  const wasNight = prev.view.phase.kind === 'night';
  const isNight = next.view.phase.kind === 'night';
  if (wasNight !== isNight) out.push({ kind: 'night', on: isNight });
  next.view.players.forEach((p, i) => {
    const q = prev.view.players[i];
    if (!q) return;
    if (q.alive && !p.alive) out.push({ kind: 'death', seat: i });
    if (!p.alive) return;
    p.tryals.forEach((t, j) => {
      if (t.revealed && q.tryals[j] && !q.tryals[j].revealed) out.push({ kind: 'reveal', seat: i, index: j });
    });
  });
  const turn = dayTurn(next);
  if (turn !== null && turn !== dayTurn(prev)) out.push({ kind: 'turn', seat: turn });
  if (next.pending && next.pending.kind !== 'turn' && prev.pending?.kind !== next.pending.kind) out.push({ kind: 'panel' });
  return out;
}
```

- [ ] **Step 4: 游戏桌播放动效**

修改 `client/src/scenes/table.ts`：
1. 增加 import：`import { ANIM_MS, diffTables } from '../model/changes';`、`import { CARD_GRADIENT } from '../theme/palette';`（与已有的 `C` 合并为 `import { C, CARD_GRADIENT } from '../theme/palette';`）、`import { roundRect } from '../theme/draw';`（合并进已有的 draw import）
2. 增加字段 `private prev: TableModel | null = null;`
3. 把 `anim()` 整体替换为：
```ts
  protected anim(m: TableModel, now: number): AnimState {
    const A = this.ui.animator;
    for (const c of diffTables(this.prev, m)) {
      switch (c.kind) {
        case 'cardIn':
          A.start(`in:${c.id}`, now, ANIM_MS.cardIn);
          break;
        case 'play':
          A.start(`fly:${c.index}`, now, ANIM_MS.play, c);
          break;
        case 'night':
          A.start('sky', now, ANIM_MS.night, { from: c.on ? 0 : 1, to: c.on ? 1 : 0 });
          break;
        case 'death':
          A.start(`dead:${c.seat}`, now, ANIM_MS.death);
          break;
        case 'reveal':
          A.start(`flip:${c.seat}`, now, ANIM_MS.reveal, { index: c.index });
          break;
        case 'turn':
          A.start('turn', now, ANIM_MS.turn);
          break;
        case 'panel':
          A.start('panel', now, ANIM_MS.panel);
          break;
      }
    }
    this.prev = m;

    const staticDark = m.view.phase.kind === 'night' ? 1 : 0;
    const sky = A.data<{ from: number; to: number }>('sky');
    const darkness = sky && A.running('sky', now) ? sky.from + (sky.to - sky.from) * A.progress('sky', now) : staticDark;
    const glow = A.running('turn', now) ? 0.45 + 0.55 * Math.abs(Math.sin(A.progress('turn', now) * Math.PI * 3)) : 0.6;

    const overlay: Node[] = [];
    for (const key of A.keys()) {
      if (!key.startsWith('fly:') || !A.running(key, now)) continue;
      const c = A.data<{ from: number; to: number; card: CardKind }>(key)!;
      const from = this.seatRect(m, c.from);
      const to = this.seatRect(m, c.to);
      if (!from || !to) continue;
      const p = A.progress(key, now);
      const x = from.x + from.w / 2 + (to.x + to.w / 2 - from.x - from.w / 2) * p;
      const y = from.y + from.h / 2 + (to.y + to.h / 2 - from.y - from.h / 2) * p;
      const r = rect(x - 14, y - 20, 28, 40);
      const [top, bottom] = CARD_GRADIENT[CARD_INFO[c.card].color];
      overlay.push({
        rect: r,
        draw: (ctx) => {
          ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
          const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
          g.addColorStop(0, top);
          g.addColorStop(1, bottom);
          roundRect(ctx, r, 4);
          ctx.fillStyle = g;
          ctx.fill();
          ctx.strokeStyle = C.goldLine;
          ctx.stroke();
          ctx.globalAlpha = 1;
        },
      });
    }

    return {
      darkness,
      glow,
      cell: (seat) => {
        const alive = m.view.players[seat]?.alive ?? true;
        const alpha = A.running(`dead:${seat}`, now) ? 1 - 0.6 * A.progress(`dead:${seat}`, now) : alive ? 1 : 0.4;
        const f = A.data<{ index: number }>(`flip:${seat}`);
        const flip = f && A.running(`flip:${seat}`, now) ? { index: f.index, p: A.progress(`flip:${seat}`, now) } : null;
        return { alpha, flip };
      },
      cardIn: (id) => A.progress(`in:${id}`, now),
      overlay,
      panelSlide: A.progress('panel', now),
    };
  }
```

说明：`App.draw()` 在 `animator.active(now)` 为真时会自动请求下一帧，动效期间持续重画，结束后停止。

- [ ] **Step 5: 测试、类型检查、构建**

Run: `cd client && npx vitest run && npm run typecheck && npm run build`
Expected: 全部通过。

- [ ] **Step 6: 在模拟器里看效果**

抽牌时新牌从下方滑入；机器人出牌时有一张小卡从它的格子飞向目标；轮到某人时格子金光闪 3 下后保持常亮；入夜时画面渐暗、天亮渐亮；有人出局时格子渐渐变灰；选择面板从底部滑出。

- [ ] **Step 7: 提交**

```bash
git add client minigame/game.js
git commit -m "feat(client): short animations for cards, turns, night, deaths and panels

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: 真机验收（与用户一起）

**Files:**
- Modify: `docs/superpowers/specs/2026-09-28-plan-b2-minigame-ui-design.md`（§7 追加「真机验收结果」小节）

这一步需要用户操作手机，执行者负责给出清楚的步骤并记录结果。

- [ ] **Step 1: 最终自检**

Run: `cd client && npx vitest run && npm run typecheck && npm run build`；`cd ../server && npx vitest run`；`cd ../engine && npx vitest run`
Expected: 三处测试全部通过，`git status` 中 `minigame/game.js` 与构建结果一致（构建后无改动）。

- [ ] **Step 2: 上传体验版（用户操作）**

请用户：开发者工具点 **Upload**，版本号 `0.2.0`，备注「B2 正式界面」→ 浏览器打开 mp.weixin.qq.com →「管理 → 版本管理」→ 新开发版本旁的小箭头 →「选为体验版」。

- [ ] **Step 3: 多人实测（用户和 1–2 位朋友）**

逐项确认并记录：
1. 首次打开要求输入昵称；首页显示正常，没有被右上角胶囊按钮挡住。
2. 房主建房 → 复制房号 → 发到群里 → 朋友在首页输入房号加入 → 大厅里双方都能看到对方。
3. 房主调整座位顺序、加机器人凑到 ≥4 人、开始。
4. 游戏桌在每台手机上都能看全（网格、日志、信息栏、手牌、按钮不重叠）。
5. 出牌（含两个目标的牌、诅咒选蓝卡）、抽牌、结束回合、审判翻牌、夜晚击杀 / 保护 / 自首都能完成。
6. 把一台手机切到后台 30 秒再回来，画面自动恢复到当前状态。
7. 玩到结束，结算页正确显示阵营，「回到首页」可用。
8. 顺便再试一次「邀请朋友」按钮发出的卡片，点开后是否自动进入房间（`wx.shareAppMessage` 主动分享，和右上角菜单的被动分享不同）。

- [ ] **Step 4: 记录结果并提交**

把以上 8 项的结果（通过 / 问题描述）写进设计文档 §7 新增的「### 7.3 真机验收结果（日期）」。发现的问题按严重程度决定当场修复（走 TDD：先加测试）还是记入后续计划。

```bash
git add docs
git commit -m "docs(b2): record on-device acceptance results

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
