import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { RuleError } from '../src/errors';
import { targetCount } from '../src/play';
import { seededRng } from '../src/rng';
import { redTotal } from '../src/state';
import type { Action, GameState } from '../src/types';
import { fixedGame, giveCard, placeBlue } from './helpers';

const act = (s: GameState, a: Action) => apply(s, a, seededRng(7));

describe('targetCount', () => {
  it('嫁祸和抢劫需要 2 个目标，其余卡需要 1 个', () => {
    expect(targetCount('scapegoat')).toBe(2);
    expect(targetCount('robbery')).toBe(2);
    for (const kind of ['accusation', 'evidence', 'witness', 'matchmaker', 'asylum', 'piety', 'arson', 'curse', 'stocks', 'alibi'] as const) {
      expect(targetCount(kind)).toBe(1);
    }
  });
});

describe('红卡与审判', () => {
  it('指控：目标 +1 点，进入出牌模式，手牌减少', () => {
    let s = fixedGame();
    const c = giveCard(s, 2, 'accusation');
    s = act(s, { type: 'play', seat: 2, cardId: c.id, targets: [3] });
    expect(redTotal(s.players[3])).toBe(1);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(s.players[2].hand.some((h) => h.id === c.id)).toBe(false);
    expect(s.version).toBe(1);
  });

  it('apply 不修改传入的 state', () => {
    const s = fixedGame();
    const c = giveCard(s, 2, 'accusation');
    const snapshot = JSON.stringify(s);
    act(s, { type: 'play', seat: 2, cardId: c.id, targets: [3] });
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('非法出牌会报错', () => {
    const s = fixedGame();
    const c = giveCard(s, 2, 'accusation');
    expect(() => act(s, { type: 'play', seat: 2, cardId: c.id, targets: [2] })).toThrow(RuleError);
    expect(() => act(s, { type: 'play', seat: 3, cardId: c.id, targets: [4] })).toThrow(RuleError);
    expect(() => act(s, { type: 'play', seat: 2, cardId: 'nope', targets: [3] })).toThrow(RuleError);
    placeBlue(s, 3, 'piety');
    expect(() => act(s, { type: 'play', seat: 2, cardId: c.id, targets: [3] })).toThrow(/信徒/);
    s.players[4].alive = false;
    expect(() => act(s, { type: 'play', seat: 2, cardId: c.id, targets: [4] })).toThrow(RuleError);
  });

  it('累计 7 点触发审判，被审判者翻牌后清空红卡，回到出牌模式', () => {
    let s = fixedGame();
    const e1 = giveCard(s, 2, 'evidence');
    const e2 = giveCard(s, 2, 'evidence');
    const a1 = giveCard(s, 2, 'accusation');
    const a2 = giveCard(s, 2, 'accusation');
    s = act(s, { type: 'play', seat: 2, cardId: e1.id, targets: [3] });
    s = act(s, { type: 'play', seat: 2, cardId: e2.id, targets: [3] });
    expect(s.phase.kind).toBe('day');
    s = act(s, { type: 'play', seat: 2, cardId: a1.id, targets: [3] });
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 3, initiator: 2 });
    expect(s.log).toContainEqual({ t: 'trial', target: 3, initiator: 2 });
    expect(() => act(s, { type: 'play', seat: 2, cardId: a2.id, targets: [4] })).toThrow(RuleError);
    expect(() => act(s, { type: 'revealTryal', seat: 2, tryalId: s.players[2].tryals[0].id })).toThrow(RuleError);
    s = act(s, { type: 'revealTryal', seat: 3, tryalId: s.players[3].tryals[0].id });
    expect(s.players[3].tryals[0].revealed).toBe(true);
    expect(s.players[3].red).toEqual([]);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(s.turn).toBe(2);
  });

  it('目击一张即审判；翻出女巫则女巫死亡，村民获胜', () => {
    let s = fixedGame();
    const w = giveCard(s, 2, 'witness');
    s = act(s, { type: 'play', seat: 2, cardId: w.id, targets: [0] });
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 0, initiator: 2 });
    s = act(s, { type: 'revealTryal', seat: 0, tryalId: s.players[0].tryals[0].id });
    expect(s.players[0].alive).toBe(false);
    expect(s.phase).toEqual({ kind: 'ended', winner: 'village' });
  });

  it('当前玩家在自己的回合中死亡（情侣连带），回合交给下一位活着的玩家', () => {
    let s = fixedGame();
    placeBlue(s, 2, 'matchmaker');
    placeBlue(s, 3, 'matchmaker');
    for (const t of s.players[3].tryals.slice(0, 4)) t.revealed = true;
    const w = giveCard(s, 2, 'witness');
    s = act(s, { type: 'play', seat: 2, cardId: w.id, targets: [3] });
    s = act(s, { type: 'revealTryal', seat: 3, tryalId: s.players[3].tryals[4].id });
    expect(s.players[3].alive).toBe(false);
    expect(s.players[2].alive).toBe(false);
    expect(s.turn).toBe(4);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
  });
});

describe('绿卡和蓝卡', () => {
  it('辩护：默认移除最多 3 张指控', () => {
    let s = fixedGame();
    for (let i = 0; i < 4; i++) {
      const a = giveCard(s, 2, 'accusation');
      s = act(s, { type: 'play', seat: 2, cardId: a.id, targets: [3] });
    }
    const alibi = giveCard(s, 2, 'alibi');
    s = act(s, { type: 'play', seat: 2, cardId: alibi.id, targets: [3] });
    expect(redTotal(s.players[3])).toBe(1);
  });

  it('辩护：选择 evidence 时移除 1 张证据', () => {
    let s = fixedGame();
    const e = giveCard(s, 2, 'evidence');
    const a = giveCard(s, 2, 'accusation');
    s = act(s, { type: 'play', seat: 2, cardId: e.id, targets: [3] });
    s = act(s, { type: 'play', seat: 2, cardId: a.id, targets: [3] });
    const alibi = giveCard(s, 2, 'alibi');
    s = act(s, { type: 'play', seat: 2, cardId: alibi.id, targets: [3], option: 'evidence' });
    expect(redTotal(s.players[3])).toBe(1);
  });

  it('拘留：目标跳过下一回合，拘留卡进弃牌堆', () => {
    let s = fixedGame();
    const st = giveCard(s, 2, 'stocks');
    s = act(s, { type: 'play', seat: 2, cardId: st.id, targets: [3] });
    expect(s.players[3].green.map((c) => c.kind)).toEqual(['stocks']);
    s = act(s, { type: 'endTurn', seat: 2 });
    expect(s.turn).toBe(4);
    expect(s.log).toContainEqual({ t: 'skipped', seat: 3 });
    expect(s.players[3].green).toEqual([]);
    expect(s.discard.some((c) => c.id === st.id)).toBe(true);
  });

  it('纵火：丢弃目标所有手牌', () => {
    let s = fixedGame();
    const c = giveCard(s, 2, 'arson');
    s = act(s, { type: 'play', seat: 2, cardId: c.id, targets: [3] });
    expect(s.players[3].hand).toEqual([]);
  });

  it('抢劫：把第一个目标的手牌交给第二个目标', () => {
    let s = fixedGame();
    const c = giveCard(s, 2, 'robbery');
    const before3 = s.players[3].hand.length;
    const before4 = s.players[4].hand.length;
    s = act(s, { type: 'play', seat: 2, cardId: c.id, targets: [3, 4] });
    expect(s.players[3].hand).toEqual([]);
    expect(s.players[4].hand.length).toBe(before3 + before4);
  });

  it('嫁祸：转移红蓝绿卡，接收者达到 7 点时审判', () => {
    let s = fixedGame();
    const e1 = giveCard(s, 2, 'evidence');
    const e2 = giveCard(s, 2, 'evidence');
    const a = giveCard(s, 2, 'accusation');
    s = act(s, { type: 'play', seat: 2, cardId: e1.id, targets: [3] });
    s = act(s, { type: 'play', seat: 2, cardId: e2.id, targets: [3] });
    s = act(s, { type: 'play', seat: 2, cardId: a.id, targets: [4] });
    placeBlue(s, 3, 'asylum');
    const sg = giveCard(s, 2, 'scapegoat');
    s = act(s, { type: 'play', seat: 2, cardId: sg.id, targets: [3, 4] });
    expect(s.players[3].red).toEqual([]);
    expect(s.players[3].blue).toEqual([]);
    expect(s.players[4].blue.map((c) => c.kind)).toEqual(['asylum']);
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 4, initiator: 2 });
  });

  it('诅咒：移除指定的蓝卡；未指定时报错', () => {
    let s = fixedGame();
    const blue = placeBlue(s, 3, 'asylum');
    const c = giveCard(s, 2, 'curse');
    expect(() => act(s, { type: 'play', seat: 2, cardId: c.id, targets: [3] })).toThrow(RuleError);
    s = act(s, { type: 'play', seat: 2, cardId: c.id, targets: [3], option: blue.id });
    expect(s.players[3].blue).toEqual([]);
  });

  it('嫁祸：接收者已有情侣卡时，转来的情侣卡进弃牌堆，其他蓝卡照常转移', () => {
    let s = fixedGame();
    const m1 = placeBlue(s, 3, 'matchmaker');
    placeBlue(s, 3, 'asylum');
    placeBlue(s, 4, 'matchmaker');
    const sg = giveCard(s, 2, 'scapegoat');
    s = act(s, { type: 'play', seat: 2, cardId: sg.id, targets: [3, 4] });
    expect(s.players[3].blue).toEqual([]);
    expect(s.players[4].blue.map((c) => c.kind).sort()).toEqual(['asylum', 'matchmaker']);
    expect(s.discard.some((c) => c.id === m1.id)).toBe(true);
  });

  it('嫁祸：接收者已被拘留时，转来的拘留卡进弃牌堆', () => {
    let s = fixedGame();
    const st1 = giveCard(s, 2, 'stocks');
    s = act(s, { type: 'play', seat: 2, cardId: st1.id, targets: [3] });
    const st2 = giveCard(s, 2, 'stocks');
    s = act(s, { type: 'play', seat: 2, cardId: st2.id, targets: [4] });
    const sg = giveCard(s, 2, 'scapegoat');
    s = act(s, { type: 'play', seat: 2, cardId: sg.id, targets: [3, 4] });
    expect(s.players[3].green).toEqual([]);
    expect(s.players[4].green.map((c) => c.id)).toEqual([st2.id]);
    expect(s.discard.some((c) => c.id === st1.id)).toBe(true);
  });

  it('同一人不能放两张情侣', () => {
    let s = fixedGame();
    const m1 = giveCard(s, 2, 'matchmaker');
    const m2 = giveCard(s, 2, 'matchmaker');
    s = act(s, { type: 'play', seat: 2, cardId: m1.id, targets: [3] });
    expect(() => act(s, { type: 'play', seat: 2, cardId: m2.id, targets: [3] })).toThrow(RuleError);
  });

  it('还没抽牌或出牌时不能结束回合', () => {
    const s = fixedGame();
    expect(() => act(s, { type: 'endTurn', seat: 2 })).toThrow(RuleError);
  });
});
