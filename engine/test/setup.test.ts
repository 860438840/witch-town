import { describe, expect, it } from 'vitest';
import { RuleError } from '../src/errors';
import { seededRng } from '../src/rng';
import { createGame } from '../src/setup';
import { catHolder, constableSeat, countCards, leftOf, rightOf } from '../src/state';
import { newGame } from './helpers';

describe('createGame', () => {
  it('5 人局：每人 5 张身份卡、3 张手牌，黑猫暂放，阶段为黎明', () => {
    const s = newGame(5);
    expect(s.players).toHaveLength(5);
    for (const p of s.players) {
      expect(p.tryals).toHaveLength(5);
      expect(p.hand).toHaveLength(3);
      expect(p.alive).toBe(true);
      expect(p.character).toBeNull();
    }
    expect(s.deck).toHaveLength(57 - 15 + 2);
    expect(s.setAside.map((c) => c.kind)).toEqual(['blackCat']);
    expect(s.phase).toEqual({ kind: 'dawn' });
    expect(countCards(s)).toBe(60);
    expect(catHolder(s)).toBeNull();
  });

  it('手牌中没有黑卡，夜晚和传染都在牌堆里', () => {
    const s = newGame(8, 3);
    const hands = s.players.flatMap((p) => p.hand);
    expect(hands.some((c) => c.kind === 'night' || c.kind === 'conspiracy' || c.kind === 'blackCat')).toBe(false);
    expect(s.deck.filter((c) => c.kind === 'night' || c.kind === 'conspiracy')).toHaveLength(2);
  });

  it('女巫阵营等于开局持有女巫卡的玩家', () => {
    const s = newGame(6, 9);
    for (const p of s.players) {
      expect(p.witchFaction).toBe(p.tryals.some((t) => t.kind === 'witch'));
    }
    expect(s.players.flatMap((p) => p.tryals).filter((t) => t.kind === 'witch')).toHaveLength(2);
    expect(constableSeat(s)).not.toBeNull();
  });

  it('身份卡 id 唯一', () => {
    const ids = newGame(12).players.flatMap((p) => p.tryals.map((t) => t.id));
    expect(new Set(ids).size).toBe(60);
  });

  it('人数不足 4 人时报错', () => {
    const three = [0, 1, 2].map((i) => ({ openid: `u${i}`, name: `P${i}` }));
    expect(() => createGame(three, seededRng(1))).toThrow(RuleError);
  });
});

describe('邻居', () => {
  it('左边是下一个座位，右边是上一个座位，跳过死亡玩家', () => {
    const s = newGame(5);
    s.players[1].alive = false;
    expect(leftOf(s, 0)).toBe(2);
    expect(rightOf(s, 2)).toBe(0);
    expect(rightOf(s, 0)).toBe(4);
    expect(leftOf(s, 4)).toBe(0);
  });
});
