import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { autoActions } from '../src/auto';
import { RuleError } from '../src/errors';
import { startNight } from '../src/night';
import { seededRng } from '../src/rng';
import { countCards } from '../src/state';
import type { Action, GameState } from '../src/types';
import { projectPrivate, projectPublic } from '../src/view';
import { fixedGame, placeDiscard, setCharacter } from './helpers';

const act = (s: GameState, a: Action) => apply(s, a, seededRng(7));

// fixedGame：5 人；0 号是唯一女巫，1 号是警长，2–4 号是村民；轮到 2 号

describe('牧师', () => {
  it('回合开始时从弃牌堆拿 1–2 张非黑卡，然后回合结束', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'priest');
    const a = placeDiscard(s, 'alibi');
    const b = placeDiscard(s, 'evidence');
    s = act(s, { type: 'priestDraw', seat: 2, cardIds: [a.id, b.id] });
    expect(s.players[2].hand.map((c) => c.id)).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(s.discard.some((c) => c.id === a.id || c.id === b.id)).toBe(false);
    expect(s.players[2].uses.priest).toBe(1);
    expect(s.log).toContainEqual({ t: 'ability', seat: 2, ability: 'priest', count: 2 });
    expect(s.turn).toBe(3);
    expect(countCards(s)).toBe(60);
  });

  it('不能拿黑卡、不能超过 2 张、不能重复；出过牌后、次数用完后、不是牧师都不能用', () => {
    const s = fixedGame();
    setCharacter(s, 2, 'priest');
    const a = placeDiscard(s, 'alibi');
    const b = placeDiscard(s, 'evidence');
    const c = placeDiscard(s, 'accusation');
    const night = placeDiscard(s, 'night');
    expect(() => act(s, { type: 'priestDraw', seat: 2, cardIds: [night.id] })).toThrow(RuleError);
    expect(() => act(s, { type: 'priestDraw', seat: 2, cardIds: [a.id, b.id, c.id] })).toThrow(RuleError);
    expect(() => act(s, { type: 'priestDraw', seat: 2, cardIds: [a.id, a.id] })).toThrow(RuleError);
    expect(() => act(s, { type: 'priestDraw', seat: 2, cardIds: [] })).toThrow(RuleError);
    const playing: GameState = JSON.parse(JSON.stringify(s));
    playing.phase = { kind: 'day', mode: 'playing' };
    expect(() => act(playing, { type: 'priestDraw', seat: 2, cardIds: [a.id] })).toThrow(RuleError);
    const used: GameState = JSON.parse(JSON.stringify(s));
    used.players[2].uses.priest = 2;
    expect(() => act(used, { type: 'priestDraw', seat: 2, cardIds: [a.id] })).toThrow(RuleError);
    const plain: GameState = JSON.parse(JSON.stringify(s));
    plain.players[2].character = null;
    expect(() => act(plain, { type: 'priestDraw', seat: 2, cardIds: [a.id] })).toThrow(RuleError);
  });

  it('裁缝复制牧师：次数记在裁缝自己身上', () => {
    let s = fixedGame();
    setCharacter(s, 1, 'priest');
    setCharacter(s, 2, 'tailor');
    s.players[1].uses.priest = 2;
    const a = placeDiscard(s, 'alibi');
    s = act(s, { type: 'priestDraw', seat: 2, cardIds: [a.id] });
    expect(s.players[2].uses.priest).toBe(1);
    expect(s.players[1].uses.priest).toBe(2);
  });
});

describe('说书人', () => {
  it('开始调整后只有他能看到牌堆；提交新顺序后回到他的回合，仍可抽牌；只能用一次', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'storyteller');
    s = act(s, { type: 'storyStart', seat: 2 });
    expect(s.phase).toEqual({ kind: 'storytelling', seat: 2 });
    expect(projectPrivate(s, 2).pending).toEqual({ kind: 'storytelling', deck: s.deck });
    expect(projectPrivate(s, 3).pending).toBeNull();
    const pub = JSON.stringify(projectPublic(s));
    for (const c of s.deck) expect(pub).not.toContain(`"${c.id}"`);
    for (const p of s.players) {
      if (p.seat === 2) continue;
      const priv = JSON.stringify(projectPrivate(s, p.seat));
      for (const c of s.deck) expect(priv).not.toContain(`"${c.id}"`);
    }
    const order = [...s.deck].reverse().map((c) => c.id);
    s = act(s, { type: 'storyReorder', seat: 2, order });
    expect(s.deck.map((c) => c.id)).toEqual(order);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(s.turn).toBe(2);
    expect(s.players[2].uses.storyteller).toBe(1);
    expect(s.log).toContainEqual({ t: 'ability', seat: 2, ability: 'storyteller' });
    expect(() => act(s, { type: 'storyStart', seat: 2 })).toThrow(RuleError);
    expect(() => act(s, { type: 'draw', seat: 2 })).not.toThrow();
  });

  it('新顺序必须正好是当前牌堆的重新排列', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'storyteller');
    s = act(s, { type: 'storyStart', seat: 2 });
    const ids = s.deck.map((c) => c.id);
    expect(() => act(s, { type: 'storyReorder', seat: 2, order: ids.slice(1) })).toThrow(RuleError);
    expect(() => act(s, { type: 'storyReorder', seat: 2, order: [ids[0], ...ids.slice(0, -1)] })).toThrow(RuleError);
    expect(() => act(s, { type: 'storyReorder', seat: 2, order: ['blackCat-1', ...ids.slice(1)] })).toThrow(RuleError);
    expect(() => act(s, { type: 'storyReorder', seat: 3, order: ids })).toThrow(RuleError);
  });

  it('超时：按原顺序回到他的回合', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'storyteller');
    s = act(s, { type: 'storyStart', seat: 2 });
    const ids = s.deck.map((c) => c.id);
    const rng = seededRng(1);
    for (const a of autoActions(s, rng)) s = apply(s, a, rng);
    expect(s.deck.map((c) => c.id)).toEqual(ids);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(s.turn).toBe(2);
  });
});

describe('官员', () => {
  it('不翻牌自首：当晚免疫击杀，身份卡都不翻开，次数用完', () => {
    let s = fixedGame();
    setCharacter(s, 3, 'official');
    startNight(s);
    s = act(s, { type: 'confess', seat: 3, tryalId: null, silent: true });
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 4 });
    for (const seat of [0, 1, 2, 4]) s = act(s, { type: 'confess', seat, tryalId: null });
    expect(s.players[3].alive).toBe(true);
    expect(s.players[3].tryals.every((t) => !t.revealed)).toBe(true);
    expect(s.log).toContainEqual({ t: 'nightResult', target: 3, died: false });
    expect(s.log).toContainEqual({ t: 'ability', seat: 3, ability: 'official' });
    expect(s.players[3].uses.official).toBe(1);
  });

  it('次数用完、不是官员、同时选了身份卡、已经决定过时都不能不翻牌自首', () => {
    const s = fixedGame();
    setCharacter(s, 3, 'official');
    startNight(s);
    const used: GameState = JSON.parse(JSON.stringify(s));
    used.players[3].uses.official = 1;
    expect(() => act(used, { type: 'confess', seat: 3, tryalId: null, silent: true })).toThrow(RuleError);
    expect(() => act(s, { type: 'confess', seat: 2, tryalId: null, silent: true })).toThrow(RuleError);
    const tid = s.players[3].tryals[0].id;
    expect(() => act(s, { type: 'confess', seat: 3, tryalId: tid, silent: true })).toThrow(RuleError);
    const decided = act(s, { type: 'confess', seat: 3, tryalId: null });
    expect(() => act(decided, { type: 'confess', seat: 3, tryalId: null, silent: true })).toThrow(RuleError);
  });
});

describe('牧师与地主（裁定 C2）', () => {
  it('牧师从弃牌堆拿指控不触发地主奖励', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'priest');
    const a = placeDiscard(s, 'accusation');
    const b = placeDiscard(s, 'accusation');
    const before = s.players[2].hand.length;
    s = act(s, { type: 'priestDraw', seat: 2, cardIds: [a.id, b.id] });
    expect(s.players[2].hand).toHaveLength(before + 2);
    expect(s.log.some((e) => e.t === 'ability' && e.ability === 'landlord')).toBe(false);
    expect(countCards(s)).toBe(60);
  });
});
