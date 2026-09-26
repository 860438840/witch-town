import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { RuleError } from '../src/errors';
import { seededRng } from '../src/rng';
import { constableSeat, countCards } from '../src/state';
import type { Action, GameState } from '../src/types';
import { fixedGame, placeBlue, setTryals, stackDeck, V } from './helpers';

const act = (s: GameState, a: Action) => apply(s, a, seededRng(7));

function everyonePicks(s: GameState, index = 0): GameState {
  for (const p of s.players) {
    if (p.alive && s.phase.kind === 'conspiracyPick') s = act(s, { type: 'conspiracyPick', seat: p.seat, index });
  }
  return s;
}

describe('抽牌', () => {
  it('抽 2 张普通牌后轮到下一位', () => {
    let s = fixedGame();
    stackDeck(s, ['accusation', 'alibi']);
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.players[2].hand.slice(-2).map((c) => c.kind)).toEqual(['accusation', 'alibi']);
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
  });

  it('出过牌之后不能再抽牌；不是自己的回合不能抽牌', () => {
    const s = fixedGame();
    expect(() => act(s, { type: 'draw', seat: 3 })).toThrow(RuleError);
    s.phase = { kind: 'day', mode: 'playing' };
    expect(() => act(s, { type: 'draw', seat: 2 })).toThrow(RuleError);
  });

  it('第二张抽到夜晚：保留第一张，进入夜晚，夜晚卡进弃牌堆', () => {
    let s = fixedGame();
    stackDeck(s, ['accusation', 'night']);
    const handBefore = s.players[2].hand.length;
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.players[2].hand.length).toBe(handBefore + 1);
    expect(s.phase).toEqual({ kind: 'night' });
    expect(s.discard.some((c) => c.kind === 'night')).toBe(true);
    expect(s.log).toContainEqual({ t: 'blackDrawn', seat: 2, kind: 'night' });
  });

  it('牌堆抽空时把弃牌堆洗成新牌堆', () => {
    let s = fixedGame();
    const blacks = s.deck.filter((c) => c.kind === 'night' || c.kind === 'conspiracy');
    s.discard = s.deck.filter((c) => c.kind !== 'night' && c.kind !== 'conspiracy');
    s.setAside.push(...blacks);
    s.deck = [];
    const handBefore = s.players[2].hand.length;
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.players[2].hand.length).toBe(handBefore + 2);
    expect(s.log).toContainEqual({ t: 'reshuffle' });
    expect(countCards(s)).toBe(60);
  });
});

describe('传染', () => {
  it('没有黑猫：所有人从左边拿一张，之后补满 2 张普通牌', () => {
    let s = fixedGame();
    stackDeck(s, ['conspiracy', 'accusation', 'alibi']);
    const handBefore = s.players[2].hand.length;
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.phase).toEqual({ kind: 'conspiracyPick' });
    s = everyonePicks(s, 0);
    expect(s.log).toContainEqual({ t: 'conspiracyDone' });
    expect(s.players[2].hand.length).toBe(handBefore + 2);
    expect(s.turn).toBe(3);
    for (const p of s.players) expect(p.tryals).toHaveLength(5);
  });

  it('拿到女巫卡的人加入女巫阵营，原持有者仍是女巫阵营；拿到警长卡的人成为警长', () => {
    let s = fixedGame();
    stackDeck(s, ['conspiracy', 'accusation', 'alibi']);
    s = act(s, { type: 'draw', seat: 2 });
    s = everyonePicks(s, 0);
    // 4 号的左边是 0 号，0 号第 1 张是女巫；0 号的左边是 1 号，1 号第 1 张是警长
    expect(s.players[4].witchFaction).toBe(true);
    expect(s.players[4].tryals.some((t) => t.kind === 'witch')).toBe(true);
    expect(s.players[0].witchFaction).toBe(true);
    expect(constableSeat(s)).toBe(0);
  });

  it('有黑猫时，持有者先翻开一张身份卡', () => {
    let s = fixedGame();
    placeBlue(s, 3, 'blackCat');
    stackDeck(s, ['conspiracy', 'accusation', 'alibi']);
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.phase).toEqual({ kind: 'catReveal', holder: 3 });
    expect(() => act(s, { type: 'revealTryal', seat: 2, tryalId: s.players[2].tryals[0].id })).toThrow(RuleError);
    s = act(s, { type: 'revealTryal', seat: 3, tryalId: s.players[3].tryals[0].id });
    expect(s.log).toContainEqual({ t: 'reveal', seat: 3, kind: 'villager', cause: 'cat' });
    expect(s.phase).toEqual({ kind: 'conspiracyPick' });
  });

  it('拿牌位置无效时报错；已经拿过的人不能再拿', () => {
    let s = fixedGame();
    stackDeck(s, ['conspiracy', 'accusation', 'alibi']);
    s = act(s, { type: 'draw', seat: 2 });
    expect(() => act(s, { type: 'conspiracyPick', seat: 2, index: 5 })).toThrow(RuleError);
    expect(() => act(s, { type: 'conspiracyPick', seat: 2, index: -1 })).toThrow(RuleError);
  });

  it('黑猫持有者是当前玩家且翻出女巫死亡：传染继续，之后回合交给下一位', () => {
    let s = fixedGame();
    setTryals(s, 2, ['witch', V, V, V, V]);
    placeBlue(s, 2, 'blackCat');
    stackDeck(s, ['conspiracy', 'accusation', 'alibi']);
    s = act(s, { type: 'draw', seat: 2 });
    s = act(s, { type: 'revealTryal', seat: 2, tryalId: s.players[2].tryals[0].id });
    expect(s.players[2].alive).toBe(false);
    expect(s.phase).toEqual({ kind: 'conspiracyPick' });
    s = everyonePicks(s, 0);
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
  });
});
