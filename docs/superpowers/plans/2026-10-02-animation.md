# 美化 C：动画特效 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 升级现有动效，并给抽牌、受审、翻出女巫、出局、结算、换界面、按下补上一次性短动效。没有变化时不重画。

**Architecture:**
- 沿用“前后两帧对比 → 启动按名字管理的补间动画 → 画的时候读进度”这套现有机制。
- 新增的变化种类加在 `model/changes.ts`；动效参数在 `TableScene.anim()` 里算；格子的晃动、闪光、印章画在 `tableParts.ts`。
- 按下效果放在 `core`（App 记住按下的点，`drawNodes` 下沉被按的元素，再交给主题提供的函数盖暗色）。
- 换界面的淡入放在 `RootScene`。结算页入场放在 `ResultScene`。

**Tech Stack:** TypeScript、Canvas 2D、vitest、esbuild（画廊）

**Spec:** `docs/superpowers/specs/2026-10-02-animation-design.md`

## Global Constraints

- 动效只补过程：界面状态永远是最新的，动效播放时按钮可点、倒计时照常。
- 没有循环动画；动效全部结束后不再逐帧重画。
- 保留“版本号一次跳太多就不播动效”的规则（`MAX_VERSION_STEP`）。
- 会缩放或倾斜的东西（飞行的牌、印章）一律按固定尺寸画，再用画布变换缩放；不能每帧按新尺寸画插画。
- 只偏移“画的位置”，不改节点的 `rect`（点击区域）。
- 时长集中在 `ANIM_MS`；新颜色放进调色板；绘图代码不写颜色值。
- 布局、规则、服务器不改。
- 所有命令在 `client/` 下运行；测试 `npm test`，类型检查 `npm run typecheck`。
- 提交信息结尾加 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Review Focus

1. **延迟开始的动效提前露脸**：命中闪光、女巫红光、第二张手牌都是延后开始的。开始之前 `progress` 是 0，如果只判断 `running`，就会提前显示。Task 1 加 `started()`，Task 4 有测试。
2. **插画缓存被撑爆**：飞行的牌每帧大小不同，如果按新尺寸调 `drawCardFace`，每帧都会新建缓存图。Task 4 有连续 30 帧的缓存测试。
3. **全屏遮罩被当成按钮按下**：弹窗背后的遮罩和弹窗底板都有 `onTap`，按下时整屏会变暗。Task 2 用 `noPress` 排除，并有测试。
4. **结算页人多时动效被截断**：12 人局时最后一行要到 250+11×80+300 ms 才出来。总时长必须按人数算。Task 5 有测试。
5. **按下后拖动滚动列表**：手指移动超过 8px 就是滚动，按下效果必须取消。Task 2 有测试。

---

### Task 1: 发现新变化（别人抽牌、受审、翻出女巫）和时长表

**Files:**
- Modify: `client/src/model/changes.ts`
- Modify: `client/src/core/tween.ts`（新增 `started`）
- Test: `client/test/changes.test.ts`、`client/test/core.test.ts`

**Interfaces:**
- Produces:

```ts
export type Change =
  | { kind: 'cardIn'; id: string }
  | { kind: 'play'; index: number; from: number; to: number; card: CardKind }
  | { kind: 'night'; on: boolean }
  | { kind: 'death'; seat: number }
  | { kind: 'reveal'; seat: number; index: number; witch: boolean }
  | { kind: 'turn'; seat: number }
  | { kind: 'panel' }
  | { kind: 'draw'; seat: number; count: number }
  | { kind: 'trial'; seat: number };

export const ANIM_MS = {
  cardIn: 450, cardStagger: 80, othersDraw: 400, play: 600, hit: 250, trial: 600,
  death: 500, reveal: 500, burst: 350, night: 900, turn: 1800, panel: 250, scene: 250,
  resultTitle: 400, resultRowStart: 250, resultRowStagger: 80, resultRow: 300,
} as const;
```

  另外，`Animator.started(key: string, now: number): boolean` 在 `now >= 开始时间` 时返回 true；没有这个动画时返回 true。

- [ ] **Step 1: 写失败的测试**

在 `test/core.test.ts` 的 `describe('tween', ...)` 里加：

```ts
  it('started：延后开始的动画在开始之前为 false，没有这个动画时为 true', () => {
    const a = new Animator();
    a.start('k', 100, 50);
    expect(a.started('k', 99)).toBe(false);
    expect(a.started('k', 100)).toBe(true);
    expect(a.started('none', 0)).toBe(true);
  });
```

（如果 `Animator` 还没导入，就从 `../src/core/tween` 导入。）

在 `test/changes.test.ts` 的 `describe('diffTables', ...)` 里加：

```ts
  it('别人抽牌按张数记；我自己的新牌只算 cardIn', () => {
    const s = newState(5);
    setDay(s, 1);
    const before = model(s);
    s.players[2].hand.push({ id: 'x1', kind: 'evidence' }, { id: 'x2', kind: 'evidence' });
    s.players[0].hand.push({ id: 'mine', kind: 'evidence' });
    s.version += 1;
    const changes = diffTables(before, model(s));
    expect(changes).toContainEqual({ kind: 'draw', seat: 2, count: 2 });
    expect(changes).toContainEqual({ kind: 'cardIn', id: 'mine' });
    expect(changes.filter((c) => c.kind === 'draw')).toHaveLength(1);
  });

  it('手牌变少不算抽牌', () => {
    const s = newState(5);
    setDay(s, 1);
    const before = model(s);
    s.players[2].hand.pop();
    s.version += 1;
    expect(diffTables(before, model(s)).some((c) => c.kind === 'draw')).toBe(false);
  });

  it('受审：新的受审事件', () => {
    const s = newState(5);
    setDay(s, 1);
    const before = model(s);
    s.log.push({ t: 'trial', target: 3, initiator: 1 });
    s.version += 1;
    expect(diffTables(before, model(s))).toContainEqual({ kind: 'trial', seat: 3 });
  });

  it('翻牌时带上是不是女巫', () => {
    const s = newState(5);
    setDay(s, 1);
    const seatW = s.players.findIndex((p) => p.tryals.some((t) => t.kind === 'witch'));
    const iw = s.players[seatW].tryals.findIndex((t) => t.kind === 'witch');
    const seatV = s.players.findIndex((p, i) => i !== seatW && p.tryals.some((t) => t.kind !== 'witch'));
    const iv = s.players[seatV].tryals.findIndex((t) => t.kind !== 'witch');
    const before = model(s);
    s.players[seatW].tryals[iw].revealed = true;
    s.players[seatV].tryals[iv].revealed = true;
    s.version += 1;
    const changes = diffTables(before, model(s));
    expect(changes).toContainEqual({ kind: 'reveal', seat: seatW, index: iw, witch: true });
    expect(changes).toContainEqual({ kind: 'reveal', seat: seatV, index: iv, witch: false });
  });
```

再把已有测试“新手牌、出牌、入夜……”里的这一行：

```ts
    expect(changes).toContainEqual({ kind: 'reveal', seat: 2, index: 0 });
```

改成：

```ts
    expect(changes).toContainEqual({ kind: 'reveal', seat: 2, index: 0, witch: s.players[2].tryals[0].kind === 'witch' });
```

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run test/changes.test.ts test/core.test.ts`
Expected：
- FAIL `started is not a function`；
- 没有 `draw`、`trial` 变化；
- 翻牌变化没有 `witch` 字段。

- [ ] **Step 3: 实现**

`tween.ts` 的 `Animator` 里，在 `running` 之后加：

```ts
  /** 延后开始的动画是否已经开始；没有这个动画时为 true */
  started(key: string, now: number): boolean {
    const it = this.items.get(key);
    return !it || now >= it.start;
  }
```

`changes.ts`：
- 把 `Change` 和 `ANIM_MS` 换成上面 Interfaces 里的版本。
- 在 `diffTables` 里，把出牌的 `forEach` 改成同时处理受审：

```ts
  next.view.log.slice(prev.view.log.length).forEach((e, k) => {
    if (e.t === 'play') out.push({ kind: 'play', index: prev.view.log.length + k, from: e.seat, to: e.targets[e.targets.length - 1], card: e.kind });
    if (e.t === 'trial') out.push({ kind: 'trial', seat: e.target });
  });
```

- 把玩家循环换成：

```ts
  next.view.players.forEach((p, i) => {
    const q = prev.view.players[i];
    if (!q) return;
    if (q.alive && !p.alive) out.push({ kind: 'death', seat: i });
    if (i !== next.mySeat && p.handCount > q.handCount) out.push({ kind: 'draw', seat: i, count: p.handCount - q.handCount });
    if (!p.alive) return;
    p.tryals.forEach((t, j) => {
      if (t.revealed && q.tryals[j] && !q.tryals[j].revealed) out.push({ kind: 'reveal', seat: i, index: j, witch: t.kind === 'witch' });
    });
  });
```

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run test/changes.test.ts test/core.test.ts; npm run typecheck`
Expected：PASS。类型检查可能报 `table.ts` 的 `case 'reveal'` 之类，因为 switch 里没有处理新种类。TypeScript 对缺少的 case 不报错，所以应该没有报错。如果有报错，记下来，Task 4 修。

- [ ] **Step 5: 全套测试并提交**

Run: `npm test 2>&1 | tail -4`
Expected：全部通过。

```bash
git add src/model/changes.ts src/core/tween.ts test/changes.test.ts test/core.test.ts
git commit -m "feat(client): detect others' draws, trials and witch reveals; animation timings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 按下效果（界面框架层）

**Files:**
- Modify: `client/src/core/node.ts`（`Node.noPress`、`drawNodes` 增加参数、导出 `PressShade` 类型）
- Modify: `client/src/core/app.ts`（记住按下点，构造函数第 5 个参数）
- Modify: `client/src/theme/palette.ts`（`pressShade`）
- Modify: `client/src/theme/draw.ts`（`drawPressShade`）
- Modify: `client/src/scenes/widgets.ts`（遮罩、弹窗底板加 `noPress: true`）
- Modify: `client/src/main.ts`（把 `drawPressShade` 传给 App）
- Test: `client/test/core.test.ts`、`client/test/polish.test.ts`

**Interfaces:**
- Produces:
  - `Node.noPress?: boolean`
  - `export type PressShade = (ctx: Ctx, r: Rect) => void`（在 node.ts）
  - `drawNodes(ctx, nodes, pressed: Node | null = null, shade?: PressShade)`
  - `new App(ctx, screen, raf, clock, shade?: PressShade)`
  - `drawPressShade(ctx, r)`（draw.ts）
  - `C.pressShade: 'rgba(0,0,0,0.22)'`

- [ ] **Step 1: 写失败的测试**

`test/core.test.ts`：在导入中加入 `rect` 和 `type Rect`（来自 `../src/core/geom`）、`type Node`（来自 `../src/core/node`），以及 `fakeCtx`（如果还没导入）。然后在文件末尾加：

```ts
describe('按下效果', () => {
  const setup = () => {
    const { ctx, ops } = fakeCtx();
    const shaded: Rect[] = [];
    const app = new App(ctx, { W: 100, H: 100, top: 0, bottom: 100 }, (cb) => cb(), () => 0, (_c, r) => shaded.push(r));
    const tap = vi.fn();
    const btn: Node = { id: 'b', rect: rect(10, 10, 40, 20), onTap: tap, draw: (c) => c.fillRect(0, 0, 1, 1) };
    const mask: Node = { id: 'm', rect: rect(60, 60, 40, 40), onTap: () => {}, noPress: true };
    app.setScene({ build: () => [btn, mask] });
    ops.length = 0;
    return { app, ops, shaded, tap };
  };

  it('按住时下沉并盖暗色；松开后恢复并触发点击', () => {
    const { app, ops, shaded, tap } = setup();
    app.touchStart(20, 20);
    expect(ops).toContain('translate');
    expect(shaded).toEqual([rect(10, 10, 40, 20)]);
    ops.length = 0;
    shaded.length = 0;
    app.touchEnd(20, 20);
    expect(tap).toHaveBeenCalled();
    expect(ops).not.toContain('translate');
    expect(shaded).toEqual([]);
  });

  it('按下后手指移动超过 8px（滚动）就取消按下效果', () => {
    const { app, ops, shaded } = setup();
    app.touchStart(20, 20);
    ops.length = 0;
    shaded.length = 0;
    app.touchMove(20, 40);
    expect(ops).not.toContain('translate');
    expect(shaded).toEqual([]);
  });

  it('系统打断时取消按下效果', () => {
    const { app, ops, shaded } = setup();
    app.touchStart(20, 20);
    ops.length = 0;
    shaded.length = 0;
    app.touchCancel();
    expect(ops).not.toContain('translate');
    expect(shaded).toEqual([]);
  });

  it('noPress 的区域（遮罩、弹窗底板）没有按下效果', () => {
    const { app, ops, shaded } = setup();
    app.touchStart(70, 70);
    expect(ops).not.toContain('translate');
    expect(shaded).toEqual([]);
  });
});
```

`test/polish.test.ts` 末尾加（`sheet`、`SCREEN`、`opsOf` 已导入或已定义）：

```ts
describe('按下效果用的暗色与遮罩', () => {
  it('drawPressShade 用调色板里的按下暗色', () => {
    const { ctx, ops } = fakeCtx();
    drawPressShade(ctx, rect(0, 0, 50, 20));
    expect(ops).toContain(`fillStyle=${C.pressShade}`);
    expect(ops).toContain('fill');
  });
  it('弹窗的遮罩和底板不显示按下效果', () => {
    const { nodes } = sheet(SCREEN, 300, '标题', null);
    expect(nodes.find((n) => n.id === 'overlay')?.noPress).toBe(true);
    expect(nodes.find((n) => n.id === 'sheet')?.noPress).toBe(true);
  });
});
```

（把 `drawPressShade` 加进 polish.test.ts 已有的 draw 导入里。）

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run test/core.test.ts test/polish.test.ts`
Expected：FAIL。App 不接受第 5 个参数，所以 `shaded` 一直为空、没有 `translate`；`drawPressShade` 不存在；`noPress` 是 undefined。

- [ ] **Step 3: 实现**

`node.ts`：
- 在 `Node` 的 `clip?: boolean;` 之后加：

```ts
  /** 按下时不显示按下效果（全屏遮罩、弹窗底板这类只为拦截点击的区域） */
  noPress?: boolean;
```

- 加类型并替换 `drawNodes`：

```ts
/** 在被按住的元素上画按下效果（由主题提供，core 不认识颜色） */
export type PressShade = (ctx: Ctx, r: Rect) => void;

export function drawNodes(ctx: Ctx, nodes: Node[], pressed: Node | null = null, shade?: PressShade): void {
  for (const n of nodes) {
    ctx.save();
    if (n === pressed) ctx.translate(0, 1);
    if (n.clip) {
      ctx.beginPath();
      ctx.rect(n.rect.x, n.rect.y, n.rect.w, n.rect.h);
      ctx.clip();
    }
    n.draw?.(ctx);
    if (n.children) drawNodes(ctx, n.children, pressed, shade);
    if (n === pressed && shade) shade(ctx, n.rect);
    ctx.restore();
  }
}
```

（如果 node.ts 还没导入 `Rect`，从 `./geom` 导入类型。）

`app.ts`：
- 从 `./node` 的导入里加上 `type PressShade`。
- 构造函数加第 5 个参数 `private readonly shade?: PressShade`。
- 字段：`private press: { x: number; y: number } | null = null;`。
- `draw()` 里，把 `drawNodes(this.ctx, this.nodes);` 换成：

```ts
    const hit = this.press ? hitTest(this.nodes, this.press.x, this.press.y, 'onTap') : null;
    drawNodes(this.ctx, this.nodes, hit && !hit.noPress ? hit : null, this.shade);
```

- `touchStart`：在最后一行 `this.touch = { ... };` 之后加：

```ts
    this.press = { x, y };
    this.render();
```

- `touchMove`：把 `if (!t.moved && Math.abs(x - t.x0) + Math.abs(y - t.y0) > 8) t.moved = true;` 换成：

```ts
    if (!t.moved && Math.abs(x - t.x0) + Math.abs(y - t.y0) > 8) {
      t.moved = true;
      if (this.press) {
        this.press = null;
        this.render();
      }
    }
```

- `touchCancel`：在 `this.touch = null;` 之后加：

```ts
    if (this.press) {
      this.press = null;
      this.render();
    }
```

- `touchEnd`：在 `const t = this.touch;` 之前（拖动分支之后）加：

```ts
    if (this.press) {
      this.press = null;
      this.render();
    }
```

`palette.ts` 的 `C` 里，在 `transparent` 之前加：

```ts
  /** 按下效果：盖在被按住的元素上 */
  pressShade: 'rgba(0,0,0,0.22)',
```

`draw.ts` 末尾加：

```ts
/** 按下效果：在被按住的元素上盖一层暗色（App 已把它下移 1px） */
export function drawPressShade(ctx: Ctx, r: Rect): void {
  roundRect(ctx, r, 8);
  ctx.fillStyle = C.pressShade;
  ctx.fill();
}
```

`widgets.ts`：
- `overlay()` 返回的对象加 `noPress: true,`；
- `sheet()` 里 `id: 'sheet'` 的节点加 `noPress: true,`。

`main.ts`：
- 导入 `import { drawPressShade } from './theme/draw';`；
- 把 `new App(ctx, screen, (cb) => requestAnimationFrame(() => cb()), () => Date.now())` 改成 `new App(ctx, screen, (cb) => requestAnimationFrame(() => cb()), () => Date.now(), drawPressShade)`。

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run test/core.test.ts test/polish.test.ts; npm test 2>&1 | tail -4; npm run typecheck`
Expected：全部 PASS，类型检查没有错误。原有的 App 测试如果数过 `raf` 被调用的次数，可能因为按下/松开时多请求了一次重画而变化。这种情况按新行为改数字，并在报告里写明。

- [ ] **Step 5: 提交**

```bash
git add src/core src/theme src/scenes/widgets.ts src/main.ts test/core.test.ts test/polish.test.ts
git commit -m "feat(client): press feedback on every tappable element

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 格子的晃动、闪光、出局印章

**Files:**
- Modify: `client/src/scenes/tableParts.ts`（`CellOpts`、`drawCell`、`drawMeBar`）
- Modify: `client/test/fakes.ts`（假画布额外记录调用参数）
- Test: `client/test/polish.test.ts`

**Interfaces:**
- Produces（`CellOpts` 新增，都是可选）：

```ts
  /** 受审晃动：画的位置水平偏移（像素；点击区域不动） */
  shake?: number;
  /** 叠在格子上的闪光色（已含透明度；null/省略 = 不闪） */
  flash?: string | null;
  /** 出局印章的盖下进度 0→1（省略 = 1，已盖好） */
  stamp?: number;
```

- `drawMeBar(ctx, r, m, o)` 的 `o` 增加 `shake?: number; flash?: string | null`。
- `fakeCtx()` 返回值增加 `calls: [string, unknown[]][]`：按顺序记录没有专门实现的方法调用及参数，以及 `fillText` 的参数。

- [ ] **Step 1: 假画布记录参数**

`test/fakes.ts` 的 `fakeCtx`：
- 声明 `const calls: [string, unknown[]][] = [];`；
- 把 `fillText` 改成 `(s: string, ...rest: unknown[]) => { texts.push(s); ops.push(\`fillText:${s}\`); calls.push(['fillText', [s, ...rest]]); }`；
- 把 get 陷阱的兜底函数改成 `(...args: unknown[]) => { ops.push(String(k)); calls.push([String(k), args]); }`；
- 返回 `{ ctx, texts, ops, calls }`，返回类型同步加上 `calls: [string, unknown[]][]`。

- [ ] **Step 2: 写失败的测试**

`test/polish.test.ts` 末尾加（`drawCell`、`projectPublic`、`newState`、`CELL` 已有）：

```ts
describe('格子动效', () => {
  const firstMoveX = (calls: [string, unknown[]][]): number => calls.find(([n]) => n === 'moveTo')![1][0] as number;
  it('晃动只改画的位置', () => {
    const p = projectPublic(newState(5)).players[1];
    const a = fakeCtx();
    drawCell(a.ctx, rect(0, 0, 83, 88), p, CELL);
    const b = fakeCtx();
    drawCell(b.ctx, rect(0, 0, 83, 88), p, { ...CELL, shake: 3 });
    expect(firstMoveX(b.calls) - firstMoveX(a.calls)).toBeCloseTo(3);
  });
  it('闪光叠在格子上', () => {
    const p = projectPublic(newState(5)).players[1];
    const { ctx, ops } = fakeCtx();
    drawCell(ctx, rect(0, 0, 83, 88), p, { ...CELL, flash: 'rgba(1,2,3,0.4)' });
    expect(ops).toContain('fillStyle=rgba(1,2,3,0.4)');
  });
  it('出局印章：盖到一半时放大约 1.3 倍，盖好后正常大小且有倾斜', () => {
    const s = newState(5);
    s.players[1].alive = false;
    const p = projectPublic(s).players[1];
    const half = fakeCtx();
    drawCell(half.ctx, rect(0, 0, 83, 88), p, { ...CELL, stamp: 0.5 });
    expect(half.calls).toContainEqual(['scale', [1.3, 1.3]]);
    const done = fakeCtx();
    drawCell(done.ctx, rect(0, 0, 83, 88), p, CELL);
    expect(done.calls).toContainEqual(['scale', [1, 1]]);
    expect(done.calls).toContainEqual(['rotate', [-0.12]]);
    expect(done.texts).toContain('出局');
  });
});
```

- [ ] **Step 3: 运行，确认失败**

Run: `npx vitest run test/polish.test.ts`
Expected：
- 3 个新测试 FAIL：偏移是 0、没有闪光色、没有 `scale`/`rotate` 调用；
- 其余测试仍然通过。

- [ ] **Step 4: 实现**

`tableParts.ts`：
- 在 `CellOpts` 末尾加上 Interfaces 里的三个可选字段。
- 在 `drawCell` 之前加：

```ts
/** 出局印章：从 1.6 倍缩到正常大小、逐渐显现，最后稍微歪着盖在中央 */
function drawStamp(ctx: Ctx, x: number, y: number, p: number): void {
  const s = 1 + 0.6 * (1 - p);
  ctx.save();
  ctx.globalAlpha *= p;
  ctx.translate(x, y);
  ctx.rotate(-0.12);
  ctx.scale(s, s);
  drawText(ctx, '出局', 0, 0, { size: 13, bold: true, color: C.badgeText, align: 'center' });
  ctx.restore();
}

/** 叠在格子上的闪光 */
function drawFlash(ctx: Ctx, r: Rect, color: string | null | undefined): void {
  if (!color) return;
  roundRect(ctx, r, 8);
  ctx.fillStyle = color;
  ctx.fill();
}
```

- `drawCell`：
  - 把参数名 `r` 改成 `r0`，函数第一行加 `const r = o.shake ? { ...r0, x: r0.x + o.shake } : r0;`；
  - 在 `drawPanel(...)` 调用之后紧接着加 `drawFlash(ctx, r, o.flash);`；
  - 把 `if (!p.alive) drawText(ctx, '出局', cx, r.y + r.h / 2, { size: 13, bold: true, color: C.badgeText, align: 'center' });` 换成 `if (!p.alive) drawStamp(ctx, cx, r.y + r.h / 2, o.stamp ?? 1);`。
- `drawMeBar`：
  - 签名改为 `o: { targetable: boolean; order: number; glow: number; shake?: number; flash?: string | null }`；
  - 同样把参数 `r` 改成 `r0`，开头加 `const r = o.shake ? { ...r0, x: r0.x + o.shake } : r0;`；
  - 在 `drawPanel(...)` 之后加 `drawFlash(ctx, r, o.flash);`。

（`roundRect` 已从 draw 导入；`Ctx`、`Rect` 类型已导入。）

- [ ] **Step 5: 运行，确认通过**

Run: `npx vitest run test/polish.test.ts; npm test 2>&1 | tail -4; npm run typecheck`
Expected：全部 PASS，类型检查没有错误。

- [ ] **Step 6: 提交**

```bash
git add src/scenes/tableParts.ts test/fakes.ts test/polish.test.ts
git commit -m "feat(client): cell shake, flash and the 出局 stamp

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 牌桌动效接线（抽牌飞行、出牌弧线、命中、受审、女巫红光、印章、入夜）

**Files:**
- Modify: `client/src/scenes/table.ts`（`AnimState`、`anim()`、`handNodes`、`cell`、`meNode`，新增 `deckPoint`）
- Test: `client/test/changes.test.ts`（`describe('游戏桌动效')` 里加用例）

**Interfaces:**
- Consumes：Task 1 的 `Change`/`ANIM_MS`/`Animator.started`，Task 3 的 `CellOpts.shake/flash/stamp` 与 `drawMeBar` 的 `shake/flash`。
- Produces（`AnimState` 改为）：

```ts
export interface AnimState {
  darkness: number;
  glow: number;
  cell(seat: number): Pick<CellOpts, 'alpha' | 'flip' | 'shake' | 'flash' | 'stamp'>;
  /** 我自己（信息栏）的晃动和闪光 */
  me: { shake: number; flash: string | null };
  /** 新手牌的飞入进度：null = 还没轮到它开始；1 = 已落定 */
  cardIn(id: string): number | null;
  /** 牌堆在画面上的位置（飞行起点） */
  deck: { x: number; y: number };
  overlay: Node[];
  panelSlide: number;
}
```

动画键名：
- `in:<牌id>`：开始时间为 now + 第几张 × cardStagger，时长 cardIn。
- `draw:<座位>:<now>:<第几张>`：开始时间为 now + 第几张 × cardStagger，时长 othersDraw，data `{ seat }`。
- `fly:<日志序号>`：时长 play，data 是这条变化。
- `hit:<目标座位>`：开始时间为 now + play，时长 hit，data `{ red: boolean }`。
- `trial:<座位>`：时长 trial。
- `flip:<座位>`：保持不变。翻出女巫时另加 `burst:<座位>`，开始时间为 now + reveal，时长 burst。
- `dead:<座位>`：时长 death。
- `sky`：时长 night。

- [ ] **Step 1: 写失败的测试**

在 `test/changes.test.ts` 顶部的导入里加入：

```ts
import { afterEach } from 'vitest';
import { setSurfaceFactory } from '../src/theme/art/cache';
import { drawNodes } from '../src/core/node';
import { fakeCtx, fakeSurfaces } from './fakes';
```

（`afterEach` 可以合并到已有的 vitest 导入行里。）

然后在 `describe('游戏桌动效', ...)` 里加：

```ts
  class Probe extends TableScene {
    at(m: TableModel, now: number) {
      return this.anim(m, now);
    }
  }
  /** 先画一帧，改数据后在 t0 再画一帧（启动动效），返回探针和最新的画面数据 */
  const start = (s: ReturnType<typeof newState>, change: () => void, t0 = 1000) => {
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0) }) as unknown as { room: unknown; hand: unknown };
    const ui = fakeUi(ctl as never);
    const t = new Probe(ui);
    t.build(0);
    change();
    s.version += 1;
    ctl.room = roomOf(s);
    ctl.hand = handOf(s, 0);
    t.build(t0);
    return { t, ui, m: model(s) };
  };
  afterEach(() => setSurfaceFactory(null));

  it('出牌：中途有一张飞行的牌，结束后没有；到达后目标格子闪光', () => {
    const s = newState(5);
    setDay(s, 1);
    const { t, m } = start(s, () => s.log.push({ t: 'play', seat: 1, kind: 'accusation', targets: [3] }));
    expect(t.at(m, 1000 + ANIM_MS.play / 2).overlay).toHaveLength(1);
    expect(t.at(m, 1000 + ANIM_MS.play / 2).cell(3).flash ?? null).toBeNull();
    expect(t.at(m, 1000 + ANIM_MS.play + ANIM_MS.hit / 2).cell(3).flash).not.toBeNull();
    expect(t.at(m, 1000 + ANIM_MS.play + ANIM_MS.hit).overlay).toHaveLength(0);
  });

  it('别人抽两张：两张小卡背先后飞出', () => {
    const s = newState(5);
    setDay(s, 2);
    const { t, m } = start(s, () => s.players[2].hand.push({ id: 'x1', kind: 'evidence' }, { id: 'x2', kind: 'evidence' }));
    expect(t.at(m, 1000 + 10).overlay).toHaveLength(1);
    expect(t.at(m, 1000 + ANIM_MS.cardStagger + 10).overlay).toHaveLength(2);
    expect(t.at(m, 1000 + ANIM_MS.cardStagger + ANIM_MS.othersDraw).overlay).toHaveLength(0);
  });

  it('我一次抽两张：第二张晚一点才开始', () => {
    const s = newState(5);
    setDay(s, 0);
    const { t, m } = start(s, () => s.players[0].hand.push({ id: 'n1', kind: 'evidence' }, { id: 'n2', kind: 'evidence' }));
    const a = t.at(m, 1000 + 10);
    expect(a.cardIn('n1')).not.toBeNull();
    expect(a.cardIn('n2')).toBeNull();
    expect(t.at(m, 1000 + ANIM_MS.cardStagger + 10).cardIn('n2')).not.toBeNull();
    expect(t.at(m, 1000 + ANIM_MS.cardStagger + ANIM_MS.cardIn).cardIn('n2')).toBe(1);
  });

  it('受审：中途晃动并闪红光，结束后恢复', () => {
    const s = newState(5);
    setDay(s, 1);
    const { t, m } = start(s, () => s.log.push({ t: 'trial', target: 2, initiator: 1 }));
    const mid = t.at(m, 1000 + ANIM_MS.trial / 4).cell(2);
    expect(Math.abs(mid.shake ?? 0)).toBeGreaterThan(0.5);
    expect(mid.flash).not.toBeNull();
    const end = t.at(m, 1000 + ANIM_MS.trial).cell(2);
    expect(end.shake ?? 0).toBe(0);
    expect(end.flash ?? null).toBeNull();
  });

  it('翻出女巫：翻完后冒红光；翻出村民不冒', () => {
    const s = newState(5);
    setDay(s, 1);
    const seatW = s.players.findIndex((p) => p.tryals.some((x) => x.kind === 'witch'));
    const iw = s.players[seatW].tryals.findIndex((x) => x.kind === 'witch');
    const seatV = s.players.findIndex((p, i) => i !== seatW && p.tryals.some((x) => x.kind !== 'witch'));
    const iv = s.players[seatV].tryals.findIndex((x) => x.kind !== 'witch');
    const { t, m } = start(s, () => {
      s.players[seatW].tryals[iw].revealed = true;
      s.players[seatV].tryals[iv].revealed = true;
    });
    const at = 1000 + ANIM_MS.reveal + ANIM_MS.burst / 2;
    expect(t.at(m, at).cell(seatW).flash).not.toBeNull();
    expect(t.at(m, at).cell(seatV).flash ?? null).toBeNull();
    expect(t.at(m, 1000 + ANIM_MS.reveal / 2).cell(seatW).flash ?? null).toBeNull();
  });

  it('出局：印章盖到一半，结束后盖好', () => {
    const s = newState(5);
    setDay(s, 1);
    const { t, m } = start(s, () => (s.players[3].alive = false));
    const half = t.at(m, 1000 + ANIM_MS.death / 2).cell(3).stamp!;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
    expect(t.at(m, 1000 + ANIM_MS.death).cell(3).stamp).toBe(1);
  });

  it('入夜的天色渐变用 ANIM_MS.night', () => {
    const s = newState(5);
    setDay(s, 1);
    const { ui } = start(s, () => {
      s.phase = { kind: 'night' };
      s.night = { witchVotes: {}, protect: null, confessions: {} };
    });
    expect(ui.animator.running('sky', 1000 + ANIM_MS.night - 1)).toBe(true);
    expect(ui.animator.running('sky', 1000 + ANIM_MS.night)).toBe(false);
  });

  it('飞行动效连续画 30 帧，插画缓存里的图数量不变', () => {
    const surfaces = fakeSurfaces();
    setSurfaceFactory(surfaces.factory);
    const s = newState(5);
    setDay(s, 0);
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0) }) as unknown as { room: unknown; hand: unknown };
    const ui = fakeUi(ctl as never);
    const t = new TableScene(ui);
    const { ctx } = fakeCtx();
    drawNodes(ctx, t.build(0));
    s.log.push({ t: 'play', seat: 1, kind: 'accusation', targets: [3] });
    s.players[2].hand.push({ id: 'x1', kind: 'evidence' });
    // 新牌用手里已有的牌种：卡面已在缓存里，飞行中不应再新建任何图
    s.players[0].hand.push({ id: 'n1', kind: s.players[0].hand[0].kind });
    s.version += 1;
    ctl.room = roomOf(s);
    ctl.hand = handOf(s, 0);
    drawNodes(ctx, t.build(1000));
    const after1 = surfaces.created.length;
    for (let i = 1; i <= 30; i++) drawNodes(ctx, t.build(1000 + i * 20));
    expect(surfaces.created.length).toBe(after1);
  });
```

注意：如果 `fakeUi` 的 `animator` 与 `start` 里 `t.build` 用的是同一个对象（`fakeUi` 每次新建 Animator，并挂在 ui 上），以上用法成立。

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run test/changes.test.ts`
Expected：新用例 FAIL：
- 没有 `draw`/`hit`/`trial`/`burst` 动效；
- `cardIn` 返回数字而不是 null；
- `cell().shake`、`flash`、`stamp` 是 undefined；
- 天色动效时长是 600，所以 `running` 在 `night - 1`（899）时为 false；
- 缓存测试可能已经通过，因为现在飞的是纯色方块。没关系，它是为 Step 3 改用真卡面后设的保护。

- [ ] **Step 3: 实现**

`table.ts`：
- 导入加上 `drawCardBack`（来自 `../theme/draw`）、`alpha`（来自 `../theme/palette`），以及 `isBlack` 已有。删除不再使用的 `CARD_GRADIENT` 导入。
- 把 `AnimState` 换成 Interfaces 里的版本。
- 在 `seatRect` 之后加：

```ts
  /** 牌堆数字在画面上的位置（抽牌飞行的起点） */
  protected deckPoint(): { x: number; y: number } {
    const r = this.layout?.top;
    if (!r) return { x: this.ui.screen.W - 80, y: 40 };
    return { x: r.x + r.w - LEAVE_W - 28, y: r.y + r.h / 2 - 7 };
  }
```

- 把 `anim()` 整个换成：

```ts
  /** 比较上一帧的画面数据，启动对应动效，再算出这一帧的动效参数 */
  protected anim(m: TableModel, now: number): AnimState {
    const A = this.ui.animator;
    let mine = 0;
    for (const c of diffTables(this.prev, m)) {
      switch (c.kind) {
        case 'cardIn':
          A.start(`in:${c.id}`, now + mine++ * ANIM_MS.cardStagger, ANIM_MS.cardIn);
          break;
        case 'draw':
          for (let k = 0; k < c.count; k++) A.start(`draw:${c.seat}:${now}:${k}`, now + k * ANIM_MS.cardStagger, ANIM_MS.othersDraw, { seat: c.seat });
          break;
        case 'play':
          A.start(`fly:${c.index}`, now, ANIM_MS.play, c);
          A.start(`hit:${c.to}`, now + ANIM_MS.play, ANIM_MS.hit, { red: CARD_INFO[c.card].color === 'red' });
          break;
        case 'trial':
          A.start(`trial:${c.seat}`, now, ANIM_MS.trial);
          break;
        case 'night':
          A.start('sky', now, ANIM_MS.night, { from: c.on ? 0 : 1, to: c.on ? 1 : 0 });
          break;
        case 'death':
          A.start(`dead:${c.seat}`, now, ANIM_MS.death);
          break;
        case 'reveal':
          A.start(`flip:${c.seat}`, now, ANIM_MS.reveal, { index: c.index });
          if (c.witch) A.start(`burst:${c.seat}`, now + ANIM_MS.reveal, ANIM_MS.burst);
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

    /** 已经开始、还没结束 */
    const live = (key: string): boolean => A.started(key, now) && A.running(key, now);
    const staticDark = m.view.phase.kind === 'night' ? 1 : 0;
    const sky = A.data<{ from: number; to: number }>('sky');
    const darkness = sky && A.running('sky', now) ? sky.from + (sky.to - sky.from) * A.progress('sky', now) : staticDark;
    // 按线性时间均匀闪 3 下，起止都落在常亮值 0.6 上
    const glow = A.running('turn', now) ? 0.6 + 0.4 * Math.abs(Math.sin(A.linear('turn', now) * Math.PI * 3)) : 0.6;
    const deck = this.deckPoint();

    const shakeOf = (seat: number): number => {
      const k = `trial:${seat}`;
      if (!live(k)) return 0;
      const p = A.linear(k, now);
      return Math.sin(p * Math.PI * 6) * 3 * (1 - p);
    };
    const flashOf = (seat: number): string | null => {
      const t = `trial:${seat}`;
      if (live(t)) return alpha(C.danger, 0.4 * Math.abs(Math.sin(A.linear(t, now) * Math.PI * 2)));
      const b = `burst:${seat}`;
      if (live(b)) return alpha(C.danger, 0.45 * (1 - A.progress(b, now)));
      const h = `hit:${seat}`;
      if (live(h)) return alpha(A.data<{ red: boolean }>(h)!.red ? C.danger : C.gold, 0.4 * (1 - A.progress(h, now)));
      return null;
    };

    const overlay: Node[] = [];
    for (const key of A.keys()) {
      if (key.startsWith('fly:') && live(key)) {
        const c = A.data<{ from: number; to: number; card: CardKind }>(key)!;
        const from = this.seatRect(m, c.from);
        const to = this.seatRect(m, c.to);
        if (!from || !to) continue;
        const p = A.progress(key, now);
        const x = from.x + from.w / 2 + (to.x + to.w / 2 - from.x - from.w / 2) * p;
        const y = from.y + from.h / 2 + (to.y + to.h / 2 - from.y - from.h / 2) * p - Math.sin(Math.PI * p) * 40;
        const s = 1 + 0.3 * Math.sin(Math.PI * p);
        overlay.push({
          rect: rect(x - 14 * s, y - 20 * s, 28 * s, 40 * s),
          draw: (ctx) => {
            ctx.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
            ctx.translate(x, y);
            ctx.scale(s, s);
            // 固定 28×40 画，缩放交给画布变换：插画缓存只存一种尺寸
            drawCardFace(ctx, rect(-14, -20, 28, 40), c.card);
          },
        });
      }
      if (key.startsWith('draw:') && live(key)) {
        const { seat } = A.data<{ seat: number }>(key)!;
        const to = this.seatRect(m, seat);
        if (!to) continue;
        const p = A.progress(key, now);
        const x = deck.x + (to.x + to.w / 2 - deck.x) * p;
        const y = deck.y + (to.y + to.h / 2 - deck.y) * p - Math.sin(Math.PI * p) * 24;
        overlay.push({
          rect: rect(x - 9, y - 13, 18, 26),
          draw: (ctx) => {
            ctx.globalAlpha = p > 0.8 ? (1 - p) / 0.2 : 1;
            drawCardBack(ctx, rect(x - 9, y - 13, 18, 26));
          },
        });
      }
    }

    const meSeat = m.mySeat;
    return {
      darkness,
      glow,
      cell: (seat) => {
        const alive = m.view.players[seat]?.alive ?? true;
        const dying = A.running(`dead:${seat}`, now);
        const alphaV = dying ? 1 - 0.6 * A.progress(`dead:${seat}`, now) : alive ? 1 : 0.4;
        const f = A.data<{ index: number }>(`flip:${seat}`);
        const flip = f && A.running(`flip:${seat}`, now) ? { index: f.index, p: A.progress(`flip:${seat}`, now) } : null;
        return { alpha: alphaV, flip, shake: shakeOf(seat), flash: flashOf(seat), stamp: dying ? A.progress(`dead:${seat}`, now) : 1 };
      },
      me: meSeat === null ? { shake: 0, flash: null } : { shake: shakeOf(meSeat), flash: flashOf(meSeat) },
      cardIn: (id) => (A.started(`in:${id}`, now) ? A.progress(`in:${id}`, now) : null),
      deck,
      overlay,
      panelSlide: A.progress('panel', now),
    };
  }
```

- `meNode` 的 draw 改成 `drawMeBar(ctx, r, m, { targetable, order, glow: a.glow, shake: a.me.shake, flash: a.me.flash })`。
- `handNodes` 里 `hand.map(...)` 的回调换成：

```ts
    return hand.map((c, i) => {
      const lifted = c.id === this.sel;
      const p = a.cardIn(c.id);
      const cr = rect(x0 + step * i, r.y + (lifted ? 0 : 12), cw, ch);
      const opts = { selected: lifted, dim: m.pending?.kind === 'turn' && !playable.includes(c.id) };
      return {
        id: `card:${c.id}`,
        rect: cr,
        onTap: () => this.tapCard(c.id, playable),
        draw: (ctx) => {
          if (p === null) return; // 还没轮到这张开始飞
          if (p >= 1) {
            drawCardFace(ctx, cr, c.kind, opts);
            return;
          }
          // 从牌堆飞到自己的位置：前 60% 是卡背，之后横向翻成正面；固定按手牌尺寸画，整体缩放
          const x = a.deck.x + (cr.x + cw / 2 - a.deck.x) * p;
          const y = a.deck.y + (cr.y + ch / 2 - a.deck.y) * p - Math.sin(Math.PI * p) * 30;
          const s = 0.4 + 0.6 * p;
          const q = Math.min(1, Math.max(0, (p - 0.6) / 0.4));
          const sx = Math.abs(1 - 2 * q);
          ctx.translate(x, y);
          ctx.scale(s * Math.max(sx, 0.02), s);
          const local = rect(-cw / 2, -ch / 2, cw, ch);
          if (q < 0.5) drawCardBack(ctx, local);
          else drawCardFace(ctx, local, c.kind, opts);
        },
      };
    });
```

（`drawNodes` 每个节点都包着 save/restore，所以这里的 translate/scale 不会漏到别的节点。）

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run test/changes.test.ts; npm test 2>&1 | tail -4; npm run typecheck`
Expected：
- 全部 PASS，类型检查没有错误。
- 原有的“收到新牌时启动滑入动画”测试检查的是 `in:new-1` 正在运行，仍然成立。
- 如果有其他原有测试依赖旧的手牌偏移或旧的飞行方块，按新行为改断言，并在报告里写明原因。

- [ ] **Step 5: 提交**

```bash
git add src/scenes/table.ts test/changes.test.ts
git commit -m "feat(client): table animations — card flights from the deck, arcing plays, hit/trial/witch flashes, stamp, slower night

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 弹窗遮罩渐深、结算页入场、换界面淡入

**Files:**
- Modify: `client/src/scenes/widgets.ts`（`overlay` 增加透明度参数；`sheet` 传入 `slide`）
- Modify: `client/src/scenes/result.ts`
- Modify: `client/src/scenes/root.ts`
- Test: `client/test/polish.test.ts`

**Interfaces:**
- Produces:
  - `overlay(screen, onTap?, alpha = 1)`
  - 结算页的动画键 `result`，从第一次画出这一局的结算开始计时，总时长 = resultRowStart + 人数 × resultRowStagger + resultRow + 100。
  - 换界面的动画键 `scene`，时长 ANIM_MS.scene；淡入层是最后一个节点，`id: 'scene-fade'`，没有 `onTap`。

- [ ] **Step 1: 写失败的测试**

`test/polish.test.ts` 的导入里加 `RootScene`（`../src/scenes/root`）和 `ANIM_MS`（`../src/model/changes`），然后在末尾加：

```ts
describe('弹窗、结算、换界面的动效', () => {
  it('弹窗滑到一半时，背后遮罩也只有一半深', () => {
    const ops = opsOf(sheet(SCREEN, 300, '标题', null, 0.5).nodes);
    expect(ops).toContain('globalAlpha=0.5');
  });

  it('结算页：开始时各行透明，先出现的行在前；结束后全部不透明', () => {
    const s = newState(6);
    s.phase = { kind: 'ended', winner: 'village' };
    const ui = fakeUi(fakeCtl({ room: roomOf(s) }));
    const sc = new ResultScene(ui);
    const rowAlpha = (now: number): number[] => {
      const nodes = sc.build(now);
      // 第 0 个是背景，第 1 个是标题，之后 6 行，最后是按钮
      return nodes.slice(2, 8).map((n) => {
        const { ctx, ops } = fakeCtx();
        drawNodes(ctx, [n]);
        const a = ops.find((o) => o.startsWith('globalAlpha='));
        return a ? Number(a.slice(12)) : 1;
      });
    };
    expect(rowAlpha(0)).toEqual([0, 0, 0, 0, 0, 0]);
    const mid = rowAlpha(ANIM_MS.resultRowStart + ANIM_MS.resultRow);
    expect(mid[0]).toBeGreaterThan(0);
    expect(mid[5]).toBe(0);
    expect(rowAlpha(10_000)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('结算页：12 人局最后一行也能播完（总时长按人数算）', () => {
    const s = newState(12);
    s.phase = { kind: 'ended', winner: 'witch' };
    const ui = fakeUi(fakeCtl({ room: roomOf(s) }));
    new ResultScene(ui).build(0);
    const lastRowEnd = ANIM_MS.resultRowStart + 11 * ANIM_MS.resultRowStagger + ANIM_MS.resultRow;
    expect(ui.animator.running('result', lastRowEnd - 1)).toBe(true);
  });

  it('换界面：新界面从夜色里淡出来，结束后没有淡入层', () => {
    const ctl = fakeCtl({ code: null });
    const ui = fakeUi(ctl);
    const root = new RootScene(ui);
    const first = root.build(0);
    expect(first[first.length - 1].id).toBe('scene-fade');
    const after = root.build(ANIM_MS.scene);
    expect(after.some((n) => n.id === 'scene-fade')).toBe(false);
    (ctl as unknown as { code: string; room: unknown }).code = '1234';
    (ctl as unknown as { code: string; room: unknown }).room = lobbyRoom(4);
    const lobby = root.build(1000);
    expect(lobby[lobby.length - 1].id).toBe('scene-fade');
    expect(lobby[lobby.length - 1].onTap).toBeUndefined();
  });
});
```

（如果没有导入 `drawNodes`，就从 `../src/core/node` 导入；`lobbyRoom`、`ResultScene`、`fakeUi`、`fakeCtl` 已有。）

- [ ] **Step 2: 运行，确认失败**

Run: `npx vitest run test/polish.test.ts`
Expected：FAIL。遮罩没有 `globalAlpha=0.5`；结算行没有透明度；没有 `result` 动画；也没有 `scene-fade` 节点。

- [ ] **Step 3: 实现**

`widgets.ts`：
- `overlay` 改为 `export function overlay(screen: Screen, onTap?: () => void, alpha = 1): Node`；
- 它的 draw 改为先 `ctx.globalAlpha = alpha;`，再填色（`drawNodes` 会 restore）；
- `sheet()` 里把 `overlay(screen, onClose ?? undefined)` 改成 `overlay(screen, onClose ?? undefined, slide)`。

`result.ts`：
- 导入 `ANIM_MS`（`../model/changes`）、`easeOutCubic`（`../core/tween`）。
- 类里加字段 `private shownFor: string | null = null;`。
- 在 `build` 里取到 `view` 之后、构造节点之前加：

```ts
    const A = this.ui.animator;
    const n = view.players.length;
    const total = ANIM_MS.resultRowStart + n * ANIM_MS.resultRowStagger + ANIM_MS.resultRow + 100;
    const key = `${ctl.room!.code}:${ctl.room!.gameId}`;
    if (key !== this.shownFor) {
      this.shownFor = key;
      A.start('result', now, total);
    }
    const t = A.running('result', now) ? A.linear('result', now) * total : Infinity;
    /** 从 start 毫秒开始、持续 dur 毫秒的一段进度（缓动后）；动效结束后恒为 1 */
    const phase = (start: number, dur: number): number => easeOutCubic(Math.min(1, Math.max(0, (t - start) / dur)));
```

  并把参数名 `_now` 改成 `now`。
- 标题节点的 draw 开头加：

```ts
        const pt = phase(0, ANIM_MS.resultTitle);
        const sc = 1 + 0.15 * (1 - pt);
        ctx.globalAlpha = pt;
        ctx.translate(W / 2, top + 30);
        ctx.scale(sc, sc);
        ctx.translate(-W / 2, -(top + 30));
```

- 每一行（`view.players.forEach((p, i) => ...)`）的 draw 开头加：

```ts
          const pr = phase(ANIM_MS.resultRowStart + i * ANIM_MS.resultRowStagger, ANIM_MS.resultRow);
          ctx.globalAlpha = pr;
          ctx.translate(0, (1 - pr) * 24);
```

- 按钮改成先建好、再包一层透明度：

```ts
    const home = button('result-home', rect(12, btnY, W - 24, 48), '回到首页', () => ctl.backHome());
    const pb = phase(ANIM_MS.resultRowStart + n * ANIM_MS.resultRowStagger, ANIM_MS.resultRow);
    nodes.push({
      ...home,
      draw: (ctx) => {
        ctx.globalAlpha = pb;
        home.draw!(ctx);
      },
    });
```

`root.ts`：
- 导入 `ANIM_MS`（`../model/changes`）。
- 加字段 `private shown = '';`。
- 把原来的 `build(now)` 改名为 `private pick(now: number): [string, Node[]]`。每个 return 都带上界面种类：
  - `['home', this.home.build(now)]`
  - `['message', this.message(...)]`（加载中和房间已关闭两处都用 `'message'`）
  - `['lobby', this.lobby.build(now)]`
  - `['result', this.ended(now)]`
  - `['table', this.playing(now)]`
- 新的 `build`：

```ts
  build(now: number): Node[] {
    const [kind, nodes] = this.pick(now);
    const A = this.ui.animator;
    if (kind !== this.shown) {
      this.shown = kind;
      A.start('scene', now, ANIM_MS.scene);
    }
    if (!A.running('scene', now)) return nodes;
    const { W, H } = this.ui.screen;
    const a = 1 - A.progress('scene', now);
    return [
      ...nodes,
      {
        id: 'scene-fade',
        rect: rect(0, 0, W, H),
        draw: (ctx) => {
          ctx.globalAlpha = a;
          ctx.fillStyle = C.skyBottom;
          ctx.fillRect(0, 0, W, H);
        },
      },
    ];
  }
```

- [ ] **Step 4: 运行，确认通过**

Run: `npx vitest run test/polish.test.ts; npm test 2>&1 | tail -4; npm run typecheck`
Expected：
- 全部 PASS，类型检查没有错误。
- 如果原有路由或结算测试依赖“最后一个节点是某某”或固定的节点个数，要改测试：在时刻 0 之后的足够晚的时间点（例如 10000）再检查，并在报告里写明。

- [ ] **Step 5: 提交**

```bash
git add src/scenes/widgets.ts src/scenes/result.ts src/scenes/root.ts test/polish.test.ts
git commit -m "feat(client): sheet backdrop fades with the slide, result rows enter in turn, scenes fade in from night

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 画廊“动效演示”区

**Files:**
- Create: `client/gallery/demos.ts`
- Modify: `client/gallery/build.mjs`（打包 demos.ts，加一个区块）

**Interfaces:**
- Consumes：`App`（`src/core/app`，第 5 个参数为 `drawPressShade`）、`TableScene`、`RootScene`、`HomeScene`、`ctlFor`/`busy`（`gallery/harness`）、`roomOf`/`handOf`/`newState`/`setDay`（`test/fixtures`）。

- [ ] **Step 1: 写演示页脚本**

新建 `gallery/demos.ts`：

```ts
import { App, type Screen } from '../src/core/app';
import type { Controller } from '../src/controller';
import { HomeScene } from '../src/scenes/home';
import { RootScene } from '../src/scenes/root';
import { TableScene } from '../src/scenes/table';
import type { Ui } from '../src/scenes/ui';
import { drawPressShade } from '../src/theme/draw';
import type { GameState } from '../../engine/src/index';
import { handOf, newState, roomOf, setDay } from '../test/fixtures';
import { busy, ctlFor, dpr } from './harness';

/** 每个时刻一块画布：先显示“之前”，点「重播」后切到“之后”，用真实的 App 循环播放动效；鼠标可以按按钮试按下效果 */
const SIZE: Screen = { W: 320, H: 568, top: 64, bottom: 568 };

interface Demo {
  title: string;
  /** 生成“之前”的状态 */
  before(): GameState;
  /** 在“之前”的状态上做改动，得到“之后” */
  change(s: GameState): void;
  scene?: 'table' | 'root';
}

const bump = (s: GameState) => (s.version += 1);
const witchSeat = (s: GameState) => s.players.findIndex((p) => p.tryals.some((t) => t.kind === 'witch' && !t.revealed));

const DEMOS: Demo[] = [
  { title: '我抽牌', before: busy, change: (s) => s.players[0].hand.push({ id: 'd1', kind: 'evidence' }, { id: 'd2', kind: 'witness' }) },
  { title: '别人抽牌', before: busy, change: (s) => s.players[2].hand.push({ id: 'o1', kind: 'evidence' }, { id: 'o2', kind: 'evidence' }) },
  {
    title: '出牌（红卡）',
    before: busy,
    change: (s) => {
      s.players[1].hand.pop();
      s.log.push({ t: 'play', seat: 1, kind: 'accusation', targets: [3] });
    },
  },
  { title: '受审', before: busy, change: (s) => s.log.push({ t: 'trial', target: 2, initiator: 1 }) },
  {
    title: '翻出女巫',
    before: busy,
    change: (s) => {
      const w = witchSeat(s);
      s.players[w].tryals.find((t) => t.kind === 'witch' && !t.revealed)!.revealed = true;
    },
  },
  { title: '出局', before: busy, change: (s) => (s.players[3].alive = false) },
  {
    title: '入夜',
    before: busy,
    change: (s) => {
      s.phase = { kind: 'night' };
      s.night = { witchVotes: {}, protect: null, confessions: {} };
    },
  },
  {
    title: '结算页（含换界面）',
    scene: 'root',
    before: () => {
      const s = newState(6);
      setDay(s, 0);
      return s;
    },
    change: (s) => (s.phase = { kind: 'ended', winner: 'village' }),
  },
];

function stage(title: string, setup: (app: App, ui: Ui) => () => void): void {
  const fig = document.createElement('figure');
  const c = document.createElement('canvas');
  c.width = Math.round(SIZE.W * dpr);
  c.height = Math.round(SIZE.H * dpr);
  c.style.width = `${SIZE.W}px`;
  c.style.height = `${SIZE.H}px`;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(dpr, dpr);
  const app = new App(ctx, SIZE, (cb) => requestAnimationFrame(() => cb()), () => performance.now(), drawPressShade);
  const pos = (e: MouseEvent) => [e.offsetX, e.offsetY] as const;
  c.addEventListener('mousedown', (e) => app.touchStart(...pos(e)));
  c.addEventListener('mousemove', (e) => e.buttons && app.touchMove(...pos(e)));
  c.addEventListener('mouseup', (e) => app.touchEnd(...pos(e)));
  c.addEventListener('mouseleave', () => app.touchCancel());
  const ui: Ui = { screen: SIZE, animator: app.animator, ctl: null as unknown as Controller, render: () => app.render(), prompt: () => {}, confirm: () => {}, copy: () => {}, share: () => {} };
  const replay = setup(app, ui);
  const btn = document.createElement('button');
  btn.textContent = `重播：${title}`;
  btn.onclick = replay;
  fig.append(c, btn);
  document.getElementById('demos')?.append(fig);
  replay();
}

for (const d of DEMOS) {
  stage(d.title, (app, ui) => () => {
    const s = d.before();
    const ctl = ctlFor({ room: roomOf(s), hand: handOf(s, 0), openid: 'u0' }) as Controller & { room: unknown; hand: unknown };
    (ui as { ctl: Controller }).ctl = ctl;
    app.setScene(d.scene === 'root' ? new RootScene(ui) : new TableScene(ui));
    setTimeout(() => {
      d.change(s);
      bump(s);
      ctl.room = roomOf(s);
      ctl.hand = handOf(s, 0);
      app.render();
    }, 700);
  });
}

stage('按钮按下（用鼠标按住首页按钮试试）', (app, ui) => () => {
  (ui as { ctl: Controller }).ctl = ctlFor({});
  app.setScene(new HomeScene(ui));
});
```

（如果 `ctlFor` 返回的对象里 `room`、`hand` 是只读类型，就照上面的写法用类型断言放宽；它在运行时是普通对象。）

- [ ] **Step 2: 接进画廊页**

`gallery/build.mjs`：
- 在 `const screens = await bundle('gallery/screens.ts');` 之后加 `const demos = await bundle('gallery/demos.ts');`；
- 在 html 模板里 `<script>${screens}</script>` 之后加：

```html
<h2>动效演示（点「重播」再看一次；首页那块可以用鼠标按住按钮）</h2>
<div id="demos" class="row"></div>
<script>${demos}</script>
```

- 在 `<style>` 里加 `button { margin-top: 4px; background: #3a0d1c; color: #e8c774; border: 1px solid #d6a44a; border-radius: 6px; padding: 4px 10px; }`。

（build.mjs 是网页样式，不属于游戏绘图代码，可以写颜色值。）

- [ ] **Step 3: 构建并检查**

Run: `npm run gallery && npm run typecheck`
Expected：
- 打印 `gallery/out/gallery.html`，没有打包错误；
- 类型检查没有错误。如果 gallery 不在 tsconfig 范围内，以打包成功为准。

- [ ] **Step 4: 提交**

```bash
git add gallery/demos.ts gallery/build.mjs
git commit -m "build: gallery animation demos with replay and mouse press

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 全面验证、小游戏包、画廊发布

**Files:**
- 不改代码。发现问题时，先写会失败的测试，再修改，然后提交。

- [ ] **Step 1: 全套测试和构建**

Run: `npm test 2>&1 | tail -4; npm run typecheck; npm run build 2>&1 | grep game.js; (cd ../engine && npx vitest run 2>&1 | grep "Tests "); (cd ../server && npx vitest run 2>&1 | grep "Tests ")`
Expected：
- 客户端、引擎（137 个）、服务器（76 个）全部通过；
- 类型检查没有错误；
- 小游戏包在 180KB 以内。

- [ ] **Step 2: 画廊截图检查**

用 Edge 无界面模式截一张 1700×9000 的整页，裁出“动效演示”区查看。演示是“之前”状态加 0.7 秒后切换，截图时刻不固定，所以只检查：
- 演示区有 9 块画布；
- 每块都有画面，没有空白；
- 都有重播按钮。

再看静态界面区：
- 出局的格子显示倾斜的“出局”印章；
- 其他界面没有变化。

- [ ] **Step 3: 提交小游戏包**

```bash
cd .. && git add minigame/game.js && git commit -m "build: regenerate mini-game bundle with animations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 4: 更新画廊给用户看**

用 Artifact 工具把 `client/gallery/out/gallery.html` 发布到 `https://claude.ai/artifact/Buzc5nicpcUr1bDYZQvNz9`，覆盖更新。
