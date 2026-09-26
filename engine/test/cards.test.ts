import { describe, expect, it } from 'vitest';
import { buildBaseDeck, isBlack, isBlue, isGreen, isRed, tryalComposition } from '../src/cards';
import { RuleError } from '../src/errors';
import { seededRng, shuffle } from '../src/rng';

describe('buildBaseDeck', () => {
  it('有 57 张（60 张去掉黑猫、夜晚、传染）', () => {
    expect(buildBaseDeck()).toHaveLength(57);
  });

  it('每张卡 id 唯一', () => {
    const ids = buildBaseDeck().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('红卡数量正确', () => {
    const deck = buildBaseDeck();
    const count = (kind: string) => deck.filter((c) => c.kind === kind).length;
    expect(count('accusation')).toBe(35);
    expect(count('evidence')).toBe(6);
    expect(count('witness')).toBe(1);
    expect(count('blackCat') + count('night') + count('conspiracy')).toBe(0);
  });

  it('颜色判断', () => {
    expect(isRed('witness')).toBe(true);
    expect(isBlue('asylum')).toBe(true);
    expect(isGreen('stocks')).toBe(true);
    expect(isBlack('night')).toBe(true);
    expect(isRed('alibi')).toBe(false);
  });
});

describe('tryalComposition', () => {
  const count = (kinds: string[], k: string) => kinds.filter((x) => x === k).length;

  it('4 人：20 张，1 女巫 1 警长', () => {
    const t = tryalComposition(4);
    expect(t).toHaveLength(20);
    expect(count(t, 'witch')).toBe(1);
    expect(count(t, 'constable')).toBe(1);
  });

  it('6 人：2 女巫', () => {
    expect(count(tryalComposition(6), 'witch')).toBe(2);
  });

  it('12 人：60 张', () => {
    expect(tryalComposition(12)).toHaveLength(60);
  });

  it('人数不在 4–12 时报错', () => {
    expect(() => tryalComposition(3)).toThrow(RuleError);
    expect(() => tryalComposition(13)).toThrow(RuleError);
  });
});

describe('rng', () => {
  it('相同种子产生相同序列', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
  });

  it('shuffle 不丢失元素且不修改原数组', () => {
    const arr = [1, 2, 3, 4, 5];
    const out = shuffle(arr, seededRng(1));
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
  });
});
