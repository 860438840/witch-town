import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { autoActions } from '../src/auto';
import { killPlayer } from '../src/death';
import { RuleError } from '../src/errors';
import { seededRng } from '../src/rng';
import { countCards, redTotal } from '../src/state';
import type { Action, GameState } from '../src/types';
import { projectPublic } from '../src/view';
import { fixedGame, giveCard, placeBlue, placeRed, setCharacter } from './helpers';

const act = (s: GameState, a: Action) => apply(s, a, seededRng(7));
const play = (s: GameState, seat: number, cardId: string, targets: number[], option?: string) =>
  act(s, { type: 'play', seat, cardId, targets, option });

// fixedGame：5 人；0 号是唯一女巫，1 号是警长，2–4 号是村民；轮到 2 号

describe('法官与大力士', () => {
  it('法官打出的红卡让目标达到 6 点即审判；普通玩家到 6 点不审判', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'judge');
    const a = giveCard(s, 2, 'evidence');
    const b = giveCard(s, 2, 'evidence');
    s = play(s, 2, a.id, [3]);
    s = play(s, 2, b.id, [3]);
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 3, initiator: 2 });

    let t = fixedGame();
    const c = giveCard(t, 2, 'evidence');
    const d = giveCard(t, 2, 'evidence');
    t = play(t, 2, c.id, [3]);
    t = play(t, 2, d.id, [3]);
    expect(t.phase).toEqual({ kind: 'day', mode: 'playing' });
  });

  it('对大力士审判线是 8 点，公开视图显示 8', () => {
    let s = fixedGame();
    setCharacter(s, 3, 'strongman');
    expect(projectPublic(s).players[3].threshold).toBe(8);
    const w = giveCard(s, 2, 'witness');
    s = play(s, 2, w.id, [3]);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    const a = giveCard(s, 2, 'accusation');
    s = play(s, 2, a.id, [3]);
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 3, initiator: 2 });
  });

  it('法官对大力士仍按 6 点', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'judge');
    setCharacter(s, 3, 'strongman');
    const a = giveCard(s, 2, 'evidence');
    const b = giveCard(s, 2, 'evidence');
    s = play(s, 2, a.id, [3]);
    s = play(s, 2, b.id, [3]);
    expect(s.phase.kind).toBe('trialReveal');
  });
});

describe('部长', () => {
  it('别人打给他的证据只算 1 点并记日志；嫁祸转来的证据按原点数', () => {
    let s = fixedGame();
    setCharacter(s, 3, 'minister');
    const e = giveCard(s, 2, 'evidence');
    s = play(s, 2, e.id, [3]);
    expect(redTotal(s.players[3])).toBe(1);
    expect(s.log).toContainEqual({ t: 'ability', seat: 3, ability: 'minister' });
    const e2 = giveCard(s, 2, 'evidence');
    s = play(s, 2, e2.id, [4]);
    const sg = giveCard(s, 2, 'scapegoat');
    s = play(s, 2, sg.id, [4, 3]);
    expect(redTotal(s.players[3])).toBe(4);
  });
});

describe('医生', () => {
  it('辩护当作目击：目标 +7 点并审判；进弃牌堆时还原成辩护', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'doctor');
    const c = giveCard(s, 2, 'alibi');
    s = play(s, 2, c.id, [3], 'witness');
    expect(s.players[3].red).toEqual([{ id: c.id, kind: 'witness', points: 7, source: 'alibi' }]);
    expect(s.log).toContainEqual({ t: 'ability', seat: 2, ability: 'doctor' });
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 3, initiator: 2 });
    s = act(s, { type: 'revealTryal', seat: 3, tryalId: s.players[3].tryals[0].id });
    expect(s.discard).toContainEqual({ id: c.id, kind: 'alibi' });
    expect(s.discard.some((d) => d.id === c.id && d.kind === 'witness')).toBe(false);
    expect(countCards(s)).toBe(60);
  });

  it('当作目击时按红卡规则：不能打给自己；不受部长削弱；不是医生不能这样打', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'doctor');
    setCharacter(s, 3, 'minister');
    const c = giveCard(s, 2, 'alibi');
    expect(() => play(s, 2, c.id, [2], 'witness')).toThrow(RuleError);
    s = play(s, 2, c.id, [3], 'witness');
    expect(redTotal(s.players[3])).toBe(7);

    const t = fixedGame();
    const d = giveCard(t, 2, 'alibi');
    expect(() => play(t, 2, d.id, [3], 'witness')).toThrow('只有医生可以把辩护当作目击');
  });
});

describe('女仆', () => {
  it('黑猫、情侣打给她无效，直接进弃牌堆', () => {
    let s = fixedGame();
    setCharacter(s, 3, 'maid');
    const m = giveCard(s, 2, 'matchmaker');
    s = play(s, 2, m.id, [3]);
    expect(s.players[3].blue).toEqual([]);
    expect(s.discard).toContainEqual(m);
    expect(s.log).toContainEqual({ t: 'ability', seat: 3, ability: 'maid', kind: 'matchmaker' });
  });

  it('第一夜不能把黑猫放给她；超时自动放置时也不会选她', () => {
    const s = fixedGame();
    setCharacter(s, 3, 'maid');
    s.phase = { kind: 'dawn' };
    expect(() => act(s, { type: 'witchVote', seat: 0, target: 3 })).toThrow(RuleError);
    for (let seed = 1; seed <= 30; seed++) {
      let t: GameState = JSON.parse(JSON.stringify(s));
      const rng = seededRng(seed);
      for (const a of autoActions(t, rng)) t = apply(t, a, rng);
      expect(t.players[3].blue.some((c) => c.kind === 'blackCat')).toBe(false);
    }
  });

  it('嫁祸转给她的黑猫和情侣进弃牌堆，其他卡照常转移', () => {
    let s = fixedGame();
    setCharacter(s, 3, 'maid');
    placeBlue(s, 4, 'matchmaker');
    placeBlue(s, 4, 'asylum');
    const sg = giveCard(s, 2, 'scapegoat');
    s = play(s, 2, sg.id, [4, 3]);
    expect(s.players[3].blue.map((c) => c.kind)).toEqual(['asylum']);
    expect(s.discard.some((c) => c.kind === 'matchmaker')).toBe(true);
    expect(countCards(s)).toBe(60);
  });
});

describe('乞丐', () => {
  it('以他为第一个目标的纵火无效并丢弃；抢劫时他是接收方照常生效', () => {
    let s = fixedGame();
    setCharacter(s, 3, 'beggar');
    const handBefore = s.players[3].hand.length;
    const ar = giveCard(s, 2, 'arson');
    s = play(s, 2, ar.id, [3]);
    expect(s.players[3].hand).toHaveLength(handBefore);
    expect(s.discard).toContainEqual(ar);
    expect(s.log).toContainEqual({ t: 'ability', seat: 3, ability: 'beggar', kind: 'arson' });

    const rb = giveCard(s, 2, 'robbery');
    const fourHand = s.players[4].hand.length;
    s = play(s, 2, rb.id, [4, 3]);
    expect(s.players[3].hand).toHaveLength(handBefore + fourHand);
    expect(s.players[4].hand).toEqual([]);
  });

  it('抢他的手牌无效', () => {
    let s = fixedGame();
    setCharacter(s, 3, 'beggar');
    const handBefore = s.players[3].hand.length;
    const rb = giveCard(s, 2, 'robbery');
    s = play(s, 2, rb.id, [3, 4]);
    expect(s.players[3].hand).toHaveLength(handBefore);
    expect(s.log).toContainEqual({ t: 'ability', seat: 3, ability: 'beggar', kind: 'robbery' });
  });
});

describe('小孩', () => {
  it('他发起的审判结束后，丢弃自己面前的指控和证据，目击保留', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'child');
    placeRed(s, 2, 'accusation');
    placeRed(s, 2, 'witness');
    for (const kind of ['evidence', 'evidence', 'accusation'] as const) {
      const c = giveCard(s, 2, kind);
      s = play(s, 2, c.id, [3]);
    }
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 3, initiator: 2 });
    s = act(s, { type: 'revealTryal', seat: 3, tryalId: s.players[3].tryals[0].id });
    expect(s.players[2].red.map((c) => c.kind)).toEqual(['witness']);
    expect(s.log).toContainEqual({ t: 'ability', seat: 2, ability: 'child' });
    expect(countCards(s)).toBe(60);
  });
});

describe('农民', () => {
  it('有人死亡时获得他的手牌和蓝卡（含黑猫），红卡进弃牌堆', () => {
    const s = fixedGame();
    setCharacter(s, 4, 'farmer');
    placeBlue(s, 3, 'blackCat');
    placeBlue(s, 3, 'asylum');
    const red = placeRed(s, 3, 'accusation');
    const hand3 = s.players[3].hand.length;
    const before = s.players[4].hand.length;
    killPlayer(s, 3, 'night');
    expect(s.players[4].hand).toHaveLength(before + hand3 + 2);
    expect(s.players[4].hand.some((c) => c.kind === 'blackCat')).toBe(true);
    expect(s.discard.some((c) => c.id === red.id)).toBe(true);
    expect(s.log).toContainEqual({ t: 'ability', seat: 4, ability: 'farmer', from: 3 });
    expect(countCards(s)).toBe(60);
  });

  it('农民自己在同一事件中（情侣殉情）死亡时不获得', () => {
    const s = fixedGame();
    setCharacter(s, 4, 'farmer');
    placeBlue(s, 3, 'matchmaker');
    placeBlue(s, 4, 'matchmaker');
    killPlayer(s, 3, 'night');
    expect(s.players[4].alive).toBe(false);
    expect(s.log.some((e) => e.t === 'ability' && e.ability === 'farmer')).toBe(false);
    expect(countCards(s)).toBe(60);
  });
});

describe('最终复审补充', () => {
  it('法官通过嫁祸转移红卡：接收方到 6 点即审判', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'judge');
    placeRed(s, 4, 'evidence');
    placeRed(s, 4, 'evidence');
    expect(redTotal(s.players[4])).toBe(6);
    const sg = giveCard(s, 2, 'scapegoat');
    s = play(s, 2, sg.id, [4, 3]);
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 3, initiator: 2 });
  });

  it('医生的「当作目击」不能用在有信徒的人身上', () => {
    const s = fixedGame();
    setCharacter(s, 2, 'doctor');
    placeBlue(s, 3, 'piety');
    const c = giveCard(s, 2, 'alibi');
    expect(() => play(s, 2, c.id, [3], 'witness')).toThrow(RuleError);
  });
});
