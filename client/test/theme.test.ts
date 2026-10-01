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
