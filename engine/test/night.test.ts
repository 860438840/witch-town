import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { RuleError } from '../src/errors';
import { startNight } from '../src/night';
import { seededRng } from '../src/rng';
import type { Action, GameState } from '../src/types';
import { countCards } from '../src/state';
import { fixedGame, giveCard, placeBlue, placeDiscard, placeRed, quietNight, setTryals, V } from './helpers';

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
  it('未受保护的目标死亡；由下一位活着的玩家开始', () => {
    let s = night();
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 4 });
    s = everyoneConfessesNothing(s);
    expect(s.players[3].alive).toBe(false);
    expect(s.log).toContainEqual({ t: 'nightResult', target: 3, died: true });
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

  it('F1 回归：情侣中一方自首翻开最后一张身份卡致死，连带死亡的情侣不会导致结算抛错', () => {
    let s = night();
    placeBlue(s, 2, 'matchmaker');
    placeBlue(s, 3, 'matchmaker');
    for (const t of s.players[2].tryals.slice(0, 4)) t.revealed = true;
    const lastId = s.players[2].tryals[4].id;
    const seat3Id = s.players[3].tryals[0].id;
    s = act(s, { type: 'witchVote', seat: 0, target: 4 });
    s = act(s, { type: 'protect', seat: 1, target: 4 });
    expect(() => {
      s = act(s, { type: 'confess', seat: 2, tryalId: lastId });
      s = act(s, { type: 'confess', seat: 3, tryalId: seat3Id });
      s = act(s, { type: 'confess', seat: 0, tryalId: null });
      s = act(s, { type: 'confess', seat: 1, tryalId: null });
      s = act(s, { type: 'confess', seat: 4, tryalId: null });
    }).not.toThrow();
    expect(s.night).toBeNull();
    expect(s.players[2].alive).toBe(false);
    expect(s.players[3].alive).toBe(false);
    expect(s.players[4].alive).toBe(true);
  });

  it('F1 回归：情侣一方自首翻开女巫身份卡致死（游戏未结束），结算不抛错', () => {
    let s = night();
    setTryals(s, 2, ['witch', V, V, V, V]);
    placeBlue(s, 2, 'matchmaker');
    placeBlue(s, 3, 'matchmaker');
    const witchId = s.players[2].tryals[0].id;
    const seat3Id = s.players[3].tryals[0].id;
    s = act(s, { type: 'witchVote', seat: 0, target: 4 });
    s = act(s, { type: 'witchVote', seat: 2, target: 4 });
    s = act(s, { type: 'protect', seat: 1, target: 4 });
    expect(() => {
      s = act(s, { type: 'confess', seat: 2, tryalId: witchId });
      s = act(s, { type: 'confess', seat: 3, tryalId: seat3Id });
      s = act(s, { type: 'confess', seat: 0, tryalId: null });
      s = act(s, { type: 'confess', seat: 1, tryalId: null });
      s = act(s, { type: 'confess', seat: 4, tryalId: null });
    }).not.toThrow();
    expect(s.night).toBeNull();
    expect(s.players[2].alive).toBe(false);
    expect(s.players[3].alive).toBe(false);
    expect(s.phase.kind).not.toBe('ended');
  });
});

describe('夜晚过后全部重置', () => {
  /** 0 号女巫和 1 号警长都选 4 号、没人自首的平静夜晚，开始前在桌上摆满各种牌 */
  function busyTable(): GameState {
    const s = fixedGame();
    placeRed(s, 3, 'evidence');
    placeRed(s, 2, 'accusation');
    placeBlue(s, 3, 'blackCat');
    placeBlue(s, 4, 'asylum');
    s.players[2].green.push(giveCard(s, 2, 'stocks'));
    s.players[2].hand.pop();
    placeDiscard(s, 'alibi');
    startNight(s);
    return s;
  }

  it('收回所有手牌和面前的牌，每个活人重新发 3 张；弃牌堆清空；总卡数不变', () => {
    let s = busyTable();
    const total = countCards(s);
    s = quietNight(s);
    for (const p of s.players) {
      expect(p.hand).toHaveLength(3);
      expect([...p.red, ...p.blue, ...p.green]).toEqual([]);
    }
    expect(s.discard).toEqual([]);
    expect(countCards(s)).toBe(total);
    expect(s.log).toContainEqual({ t: 'nightReset' });
    expect(s.log.some((e) => e.t === 'reshuffle')).toBe(false);
  });

  it('死亡的玩家不发牌', () => {
    let s = busyTable();
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 2 });
    s = everyoneConfessesNothing(s);
    expect(s.players[3].alive).toBe(false);
    expect(s.players[3].hand).toEqual([]);
    for (const seat of [0, 1, 2, 4]) expect(s.players[seat].hand).toHaveLength(3);
  });

  it('发牌不会发到夜晚和传染：它们之后才洗进剩下的牌堆', () => {
    for (let seed = 1; seed <= 30; seed++) {
      let s = busyTable();
      placeDiscard(s, 'conspiracy');
      s = apply(s, { type: 'witchVote', seat: 0, target: 4 }, seededRng(seed));
      s = apply(s, { type: 'protect', seat: 1, target: 4 }, seededRng(seed));
      for (const p of s.players) if (s.phase.kind === 'night') s = apply(s, { type: 'confess', seat: p.seat, tryalId: null }, seededRng(seed));
      const hands = s.players.flatMap((p) => p.hand.map((c) => c.kind));
      expect(hands).not.toContain('night');
      expect(hands).not.toContain('conspiracy');
      expect(s.deck.map((c) => c.kind)).toEqual(expect.arrayContaining(['night', 'conspiracy']));
    }
  });

  it('黑猫和其他牌一样洗回牌堆，不再留在任何人面前', () => {
    let s = busyTable();
    s = quietNight(s);
    const where = [...s.deck, ...s.players.flatMap((p) => p.hand)].filter((c) => c.kind === 'blackCat');
    expect(where).toHaveLength(1);
  });

  it('拘留随之解除：下一位玩家照常开始回合', () => {
    let s = busyTable();
    s.turn = 1;
    s = quietNight(s);
    expect(s.turn).toBe(2);
    expect(s.log.some((e) => e.t === 'skipped')).toBe(false);
  });

  it('身份卡（含已翻开的）和角色技能次数不变', () => {
    let s = busyTable();
    s.players[2].tryals[1].revealed = true;
    s.players[2].uses = { priest: 1 };
    s = quietNight(s);
    expect(s.players[2].tryals[1].revealed).toBe(true);
    expect(s.players[2].tryals).toHaveLength(5);
    expect(s.players[2].uses).toEqual({ priest: 1 });
  });
});
