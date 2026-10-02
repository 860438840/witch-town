import { afterEach, describe, expect, it, vi } from 'vitest';
import { blit, setSurfaceFactory } from '../src/theme/art/cache';
import { crescent, ellipse, hatch, seeded } from '../src/theme/art/shapes';
import { alpha } from '../src/theme/palette';
import { fakeCtx, fakeSurfaces } from './fakes';
import { CHARACTERS, type CardKind, type TryalKind } from '../../engine/src/index';
import { CARD_INFO } from '../src/model/cards';
import { CHAR_INFO } from '../src/model/characters';
import { cardBack, cardFace, charCard, portrait, tryalFace } from '../src/theme/art/frames';
import { CARD_ICONS, CHAR_ICONS, TRYAL_ICONS } from '../src/theme/art/icons';
import { paintBackdrop, type Backdrop } from '../src/theme/art/scenes';
import { drawSky } from '../src/theme/draw';

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
    // 大力士的杠铃上画了「8」，所以头像里会有这一个字
    expect(texts).toEqual(['女巫', '警长', '村民', '8']);
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
