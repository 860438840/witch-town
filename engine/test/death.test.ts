import { describe, expect, it } from 'vitest';
import { killPlayer, revealTryal } from '../src/death';
import { RuleError } from '../src/errors';
import { countCards } from '../src/state';
import { fixedGame, placeBlue, setTryals, V } from './helpers';

describe('revealTryal', () => {
  it('翻开村民卡：玩家存活，记录日志', () => {
    const s = fixedGame();
    revealTryal(s, 2, s.players[2].tryals[0].id, 'trial');
    expect(s.players[2].tryals[0].revealed).toBe(true);
    expect(s.players[2].alive).toBe(true);
    expect(s.log.at(-1)).toEqual({ t: 'reveal', seat: 2, kind: 'villager', cause: 'trial' });
  });

  it('翻开女巫卡：玩家死亡，身份全部公开，手牌进弃牌堆，村民获胜', () => {
    const s = fixedGame();
    const discardBefore = s.discard.length;
    revealTryal(s, 0, s.players[0].tryals[0].id, 'trial');
    const p = s.players[0];
    expect(p.alive).toBe(false);
    expect(p.tryals.every((t) => t.revealed)).toBe(true);
    expect(p.hand).toEqual([]);
    expect(s.discard.length).toBe(discardBefore + 3);
    expect(s.log).toContainEqual({ t: 'death', seat: 0, cause: 'witchRevealed' });
    expect(s.phase).toEqual({ kind: 'ended', winner: 'village' });
  });

  it('5 张全部翻开：玩家死亡', () => {
    const s = fixedGame();
    for (const t of [...s.players[2].tryals]) revealTryal(s, 2, t.id, 'trial');
    expect(s.players[2].alive).toBe(false);
    expect(s.log).toContainEqual({ t: 'death', seat: 2, cause: 'allRevealed' });
  });

  it('不能重复翻开同一张', () => {
    const s = fixedGame();
    const id = s.players[2].tryals[0].id;
    revealTryal(s, 2, id, 'trial');
    expect(() => revealTryal(s, 2, id, 'trial')).toThrow(RuleError);
  });
});

describe('killPlayer', () => {
  it('情侣：一方死亡，另一方同时死亡', () => {
    const s = fixedGame();
    placeBlue(s, 2, 'matchmaker');
    placeBlue(s, 3, 'matchmaker');
    killPlayer(s, 2, 'night');
    expect(s.players[3].alive).toBe(false);
    expect(s.log).toContainEqual({ t: 'death', seat: 3, cause: 'lover' });
  });

  it('只放了一张情侣卡时不连带', () => {
    const s = fixedGame();
    placeBlue(s, 2, 'matchmaker');
    killPlayer(s, 2, 'night');
    expect(s.players.filter((p) => !p.alive)).toHaveLength(1);
  });

  it('女巫卡全部翻开但交出女巫卡的原女巫还活着：游戏继续，原女巫死后村民获胜', () => {
    const s = fixedGame();
    // 模拟传染：0 号把女巫卡交给了 4 号，但 0 号仍属女巫阵营
    setTryals(s, 0, [V, V, V, V, V]);
    s.players[0].witchFaction = true;
    setTryals(s, 4, ['witch', V, V, V, V]);
    revealTryal(s, 4, s.players[4].tryals[0].id, 'trial');
    expect(s.players[4].alive).toBe(false);
    expect(s.phase.kind).not.toBe('ended');
    killPlayer(s, 0, 'night');
    expect(s.phase).toEqual({ kind: 'ended', winner: 'village' });
  });

  it('活着的玩家全是女巫阵营时女巫获胜', () => {
    const s = fixedGame();
    for (const seat of [1, 2, 3, 4]) killPlayer(s, seat, 'night');
    expect(s.phase).toEqual({ kind: 'ended', winner: 'witch' });
  });

  it('死亡后总卡数不变', () => {
    const s = fixedGame();
    placeBlue(s, 3, 'asylum');
    killPlayer(s, 3, 'night');
    expect(countCards(s)).toBe(60);
  });
});
