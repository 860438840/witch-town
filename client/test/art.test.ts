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
