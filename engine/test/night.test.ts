import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { RuleError } from '../src/errors';
import { startNight } from '../src/night';
import { seededRng } from '../src/rng';
import type { Action, GameState } from '../src/types';
import { fixedGame, placeBlue, setTryals, V } from './helpers';

const act = (s: GameState, a: Action) => apply(s, a, seededRng(7));

function dawn(): GameState {
  const s = fixedGame();
  s.phase = { kind: 'dawn' };
  return s;
}

function night(): GameState {
  const s = fixedGame();
  startNight(s);
  return s;
}

function everyoneConfessesNothing(s: GameState): GameState {
  for (const p of s.players) if (p.alive) s = act(s, { type: 'confess', seat: p.seat, tryalId: null });
  return s;
}

describe('第一夜', () => {
  it('唯一女巫投票后放置黑猫，由持有者开始回合', () => {
    let s = dawn();
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    expect(s.players[3].blue.map((c) => c.kind)).toEqual(['blackCat']);
    expect(s.setAside).toEqual([]);
    expect(s.log).toContainEqual({ t: 'catPlaced', target: 3 });
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
  });

  it('非女巫不能投票', () => {
    expect(() => act(dawn(), { type: 'witchVote', seat: 2, target: 3 })).toThrow(RuleError);
  });

  it('两名女巫意见一致才放置黑猫', () => {
    let s = dawn();
    setTryals(s, 4, ['witch', V, V, V, V]);
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'witchVote', seat: 4, target: 1 });
    expect(s.phase).toEqual({ kind: 'dawn' });
    s = act(s, { type: 'witchVote', seat: 4, target: 3 });
    expect(s.players[3].blue.map((c) => c.kind)).toEqual(['blackCat']);
  });
});

describe('夜晚', () => {
  it('未受保护的目标死亡；弃牌堆与牌堆重洗；由下一位活着的玩家开始', () => {
    let s = night();
    const before = s.deck.length + s.discard.length;
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 4 });
    s = everyoneConfessesNothing(s);
    expect(s.players[3].alive).toBe(false);
    expect(s.log).toContainEqual({ t: 'nightResult', target: 3, died: true });
    expect(s.discard).toEqual([]);
    expect(s.deck.length).toBe(before + 3);
    expect(s.night).toBeNull();
    expect(s.turn).toBe(4);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
  });

  it('警长保护的目标存活', () => {
    let s = night();
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 3 });
    s = everyoneConfessesNothing(s);
    expect(s.players[3].alive).toBe(true);
    expect(s.log).toContainEqual({ t: 'nightResult', target: 3, died: false });
  });

  it('持有避难的目标存活', () => {
    let s = night();
    placeBlue(s, 3, 'asylum');
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 4 });
    s = everyoneConfessesNothing(s);
    expect(s.players[3].alive).toBe(true);
  });

  it('自首的目标存活，并翻开所选身份卡', () => {
    let s = night();
    const tid = s.players[3].tryals[2].id;
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 4 });
    s = act(s, { type: 'confess', seat: 3, tryalId: tid });
    for (const seat of [0, 1, 2, 4]) s = act(s, { type: 'confess', seat, tryalId: null });
    expect(s.players[3].alive).toBe(true);
    expect(s.players[3].tryals[2].revealed).toBe(true);
    expect(s.log).toContainEqual({ t: 'reveal', seat: 3, kind: 'villager', cause: 'confess' });
  });

  it('所有人都提交前不结算', () => {
    let s = night();
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 4 });
    for (const seat of [0, 1, 2, 3]) s = act(s, { type: 'confess', seat, tryalId: null });
    expect(s.phase).toEqual({ kind: 'night' });
    expect(s.players[3].alive).toBe(true);
  });

  it('警长不能保护自己，非警长不能保护', () => {
    const s = night();
    expect(() => act(s, { type: 'protect', seat: 1, target: 1 })).toThrow(/自己/);
    expect(() => act(s, { type: 'protect', seat: 2, target: 3 })).toThrow(RuleError);
  });

  it('警长卡已翻开时不需要保护也能结算', () => {
    let s = night();
    s.players[1].tryals[0].revealed = true;
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = everyoneConfessesNothing(s);
    expect(s.players[3].alive).toBe(false);
  });
});
