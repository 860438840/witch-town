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

describe('App 按住拖动', () => {
  function setup() {
    const frames: (() => void)[] = [];
    const events: string[] = [];
    const app = new App(fakeCtx().ctx, { W: 100, H: 100, top: 0, bottom: 100 }, (cb) => frames.push(cb), () => 0);
    const scene: Scene = {
      build: () => [
        { id: 'row', rect: rect(0, 0, 100, 100), onTap: () => events.push('tap'), onScroll: () => events.push('scroll') },
        {
          id: 'handle',
          rect: rect(80, 0, 20, 20),
          onPress: (_x, y) => {
            events.push(`press ${y}`);
            return {
              move: (_mx, my) => events.push(`move ${my}`),
              end: () => events.push('end'),
              frame: () => events.push('frame'),
            };
          },
        },
      ],
    };
    app.setScene(scene);
    frames.shift()!();
    return { app, frames, events };
  }

  it('按住把手立即开始拖动：移动和松手都交给拖动，不触发点击和滚动', () => {
    const { app, events } = setup();
    app.touchStart(90, 10);
    app.touchMove(90, 50);
    app.touchEnd(90, 50);
    expect(events.filter((e) => e !== 'frame')).toEqual(['press 10', 'move 50', 'end']);
  });

  it('拖动期间每一帧都调用 frame（手指不动也调用），松手后不再调用', () => {
    const { app, frames, events } = setup();
    app.touchStart(90, 10);
    frames.shift()!();
    frames.shift()!();
    const during = events.filter((e) => e === 'frame').length;
    expect(during).toBeGreaterThanOrEqual(2);
    app.touchEnd(90, 10);
    while (frames.length) frames.shift()!();
    const after = events.filter((e) => e === 'frame').length;
    app.render();
    while (frames.length) frames.shift()!();
    expect(events.filter((e) => e === 'frame').length).toBe(after);
    expect(frames).toHaveLength(0);
  });

  it('把手以外的地方照常点击和滚动', () => {
    const { app, events } = setup();
    app.touchStart(10, 50);
    app.touchEnd(10, 50);
    app.touchStart(10, 50);
    app.touchMove(10, 80);
    app.touchEnd(10, 80);
    expect(events).toEqual(['tap', 'scroll']);
  });
});
