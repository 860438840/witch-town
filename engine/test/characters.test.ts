import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { autoActions } from '../src/auto';
import { abilityOf, CHARACTERS, limitedLeft, usesLeft } from '../src/characters';
import { RuleError } from '../src/errors';
import { seededRng } from '../src/rng';
import { createGame } from '../src/setup';
import type { Action, GameState } from '../src/types';
import { projectPrivate, projectPublic } from '../src/view';
import { fixedGame, setCharacter } from './helpers';

const players = (n: number) => Array.from({ length: n }, (_, i) => ({ openid: `u${i}`, name: `P${i}` }));
const act = (s: GameState, a: Action) => apply(s, a, seededRng(7));

describe('发角色', () => {
  it('7 人及以上：每人直接获得互不相同的角色，进入第一夜', () => {
    for (const n of [7, 12]) {
      const s = createGame(players(n), seededRng(4));
      const chars = s.players.map((p) => p.character);
      expect(chars.every((c) => c !== null && CHARACTERS.includes(c))).toBe(true);
      expect(new Set(chars).size).toBe(n);
      expect(s.phase).toEqual({ kind: 'dawn' });
      expect(s.log.filter((e) => e.t === 'character')).toHaveLength(n);
    }
  });

  it('不到 7 人：每人 2 个候选，所有候选互不重复，进入选角色阶段', () => {
    const s = createGame(players(6), seededRng(4));
    expect(s.phase).toEqual({ kind: 'characterPick' });
    const all = Object.values(s.characterOffers).flat();
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(12);
    expect(s.players.every((p) => p.character === null)).toBe(true);
  });

  it('选角色：选定后写进日志；全部选完进入第一夜；不能重复选，序号只能是 0 或 1', () => {
    let s = createGame(players(4), seededRng(4));
    const offers = s.characterOffers;
    s = act(s, { type: 'pickCharacter', seat: 0, index: 1 });
    expect(s.players[0].character).toBe(offers[0][1]);
    expect(s.log.at(-1)).toEqual({ t: 'character', seat: 0, character: offers[0][1] });
    expect(() => act(s, { type: 'pickCharacter', seat: 0, index: 0 })).toThrow(RuleError);
    expect(() => act(s, { type: 'pickCharacter', seat: 1, index: 2 })).toThrow(RuleError);
    for (const seat of [1, 2, 3]) s = act(s, { type: 'pickCharacter', seat, index: 0 });
    expect(s.phase).toEqual({ kind: 'dawn' });
    expect(s.characterOffers).toEqual({});
  });

  it('选角色超时：没选的人随机选一个', () => {
    let s = createGame(players(5), seededRng(4));
    s = act(s, { type: 'pickCharacter', seat: 2, index: 0 });
    const rng = seededRng(1);
    for (const a of autoActions(s, rng)) s = apply(s, a, rng);
    expect(s.players.every((p) => p.character !== null)).toBe(true);
    expect(s.phase).toEqual({ kind: 'dawn' });
  });

  it('候选只出现在本人的私密视图里', () => {
    const s = createGame(players(5), seededRng(4));
    const pub = JSON.stringify(projectPublic(s));
    for (const c of Object.values(s.characterOffers).flat()) expect(pub).not.toContain(`"${c}"`);
    for (const p of s.players) {
      const priv = projectPrivate(s, p.seat);
      expect(priv.pending).toEqual({ kind: 'characterPick', offers: s.characterOffers[p.seat] });
      const json = JSON.stringify(priv);
      for (const q of s.players) {
        if (q.seat === p.seat) continue;
        for (const c of s.characterOffers[q.seat]) expect(json).not.toContain(`"${c}"`);
      }
    }
  });
});

describe('裁缝', () => {
  it('技能等于右手边第一个活着的玩家；那人死亡后顺延', () => {
    const s = fixedGame();
    setCharacter(s, 2, 'tailor');
    setCharacter(s, 1, 'judge');
    setCharacter(s, 0, 'maid');
    expect(abilityOf(s, 2)).toBe('judge');
    s.players[1].alive = false;
    expect(abilityOf(s, 2)).toBe('maid');
    const view = projectPublic(s).players[2];
    expect(view.character).toBe('tailor');
    expect(view.ability).toBe('maid');
  });

  it('右手边的人没有角色时，裁缝没有技能', () => {
    const s = fixedGame();
    setCharacter(s, 2, 'tailor');
    expect(abilityOf(s, 2)).toBeNull();
  });
});

describe('限次技能', () => {
  it('剩余次数按本人计算；裁缝复制时单独计次；不限次的技能显示 null', () => {
    const s = fixedGame();
    setCharacter(s, 1, 'priest');
    setCharacter(s, 2, 'tailor');
    s.players[1].uses.priest = 2;
    expect(usesLeft(s, 1, 'priest')).toBe(0);
    expect(limitedLeft(s, 2)).toBe(2);
    const view = projectPublic(s);
    expect(view.players[1].usesLeft).toBe(0);
    expect(view.players[2].usesLeft).toBe(2);
    expect(view.players[3].usesLeft).toBeNull();
  });
});
