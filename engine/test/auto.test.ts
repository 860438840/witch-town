import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { autoActions } from '../src/auto';
import { RuleError } from '../src/errors';
import { startNight } from '../src/night';
import { seededRng } from '../src/rng';
import type { GameState } from '../src/types';
import { fixedGame, setTryals, V } from './helpers';

function applyAll(s: GameState): GameState {
  const rng = seededRng(3);
  for (const a of autoActions(s, rng)) {
    try {
      s = apply(s, a, rng);
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
    }
  }
  return s;
}

describe('autoActions', () => {
  it('轮到的玩家还没行动时默认抽 2 张；出过牌时默认结束回合', () => {
    const s = fixedGame();
    expect(autoActions(s, seededRng(1))).toEqual([{ type: 'draw', seat: 2 }]);
    s.phase = { kind: 'day', mode: 'playing' };
    expect(autoActions(s, seededRng(1))).toEqual([{ type: 'endTurn', seat: 2 }]);
  });

  it('审判超时：随机翻开被审判者的一张未翻开身份卡', () => {
    let s = fixedGame();
    s.phase = { kind: 'trialReveal', target: 3, initiator: 2 };
    s = applyAll(s);
    expect(s.players[3].tryals.filter((t) => t.revealed)).toHaveLength(1);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
  });

  it('黎明超时：女巫统一投票，黑猫被放置', () => {
    let s = fixedGame();
    s.phase = { kind: 'dawn' };
    s = applyAll(s);
    expect(s.players.some((p) => p.blue.some((c) => c.kind === 'blackCat'))).toBe(true);
    expect(s.phase.kind).toBe('day');
  });

  it('夜晚超时且两名女巫意见不一：统一投给得票最多的目标，夜晚能结算', () => {
    let s = fixedGame();
    setTryals(s, 4, ['witch', V, V, V, V]);
    startNight(s);
    s.night!.witchVotes = { 0: 3, 4: 2 };
    s = applyAll(s);
    expect(s.night).toBeNull();
    expect(s.log.some((e) => e.t === 'nightResult' && e.target === 3)).toBe(true);
  });

  it('传染超时：所有还没拿牌的人随机拿一张', () => {
    let s = fixedGame();
    s.phase = { kind: 'conspiracyPick' };
    s.drawsLeft = 2;
    s = applyAll(s);
    expect(s.log).toContainEqual({ t: 'conspiracyDone' });
  });
});
