import { describe, expect, it } from 'vitest';
import { revealTryal } from '../src/death';
import { startNight } from '../src/night';
import { projectPrivate, projectPublic } from '../src/view';
import { fixedGame, newGame, setTryals, V } from './helpers';

describe('projectPublic', () => {
  it('弃牌堆内容公开（牧师技能和查看弃牌堆用）', () => {
    const s = fixedGame();
    const c = s.players[2].hand.pop()!;
    s.discard.push(c);
    expect(projectPublic(s).discard).toEqual([c]);
  });

  it('未翻开的身份卡不显示种类，翻开后显示', () => {
    const s = fixedGame();
    revealTryal(s, 3, s.players[3].tryals[1].id, 'trial');
    const view = projectPublic(s);
    expect(view.players[0].tryals.every((t) => t.kind === null)).toBe(true);
    expect(view.players[3].tryals[1]).toEqual({ revealed: true, kind: 'villager' });
    expect(view.players[3].tryals[0]).toEqual({ revealed: false, kind: null });
  });

  it('不包含任何人的手牌内容、身份卡 id 和牌堆内容', () => {
    const s = newGame(6, 5);
    const json = JSON.stringify(projectPublic(s));
    for (const p of s.players) {
      for (const c of p.hand) expect(json).not.toContain(`"${c.id}"`);
      for (const t of p.tryals) expect(json).not.toContain(`"${t.id}"`);
    }
    for (const c of s.deck) expect(json).not.toContain(`"${c.id}"`);
    expect(json).not.toContain('"witch"');
    expect(json).not.toContain('"constable"');
    expect(projectPublic(s).players[0].handCount).toBe(3);
  });

  it('游戏中不公开阵营，结束后公开所有身份和阵营', () => {
    const s = fixedGame();
    expect(projectPublic(s).players[0].witchFaction).toBeNull();
    revealTryal(s, 0, s.players[0].tryals[0].id, 'trial');
    const view = projectPublic(s);
    expect(view.phase).toEqual({ kind: 'ended', winner: 'village' });
    expect(view.players[0].witchFaction).toBe(true);
    expect(view.players[1].tryals.every((t) => t.kind !== null)).toBe(true);
  });

  it('显示红卡总点数和审判线', () => {
    const s = fixedGame();
    s.players[3].red.push({ id: 'evidence-1', kind: 'evidence', points: 3 });
    const p = projectPublic(s).players[3];
    expect(p.redTotal).toBe(3);
    expect(p.threshold).toBe(7);
  });
});

describe('projectPrivate', () => {
  it('只包含自己的手牌和身份卡', () => {
    const s = fixedGame();
    const view = projectPrivate(s, 2);
    expect(view.hand).toEqual(s.players[2].hand);
    expect(view.tryals).toEqual(s.players[2].tryals);
    const json = JSON.stringify(view);
    for (const c of s.players[3].hand) expect(json).not.toContain(`"${c.id}"`);
  });

  it('女巫能看到同伴，村民看不到', () => {
    const s = fixedGame();
    setTryals(s, 4, ['witch', V, V, V, V]);
    expect(projectPrivate(s, 0).witchPartners).toEqual([4]);
    expect(projectPrivate(s, 2).witchPartners).toEqual([]);
    expect(projectPrivate(s, 1).isConstable).toBe(true);
  });

  it('待办选择：轮到自己时是 turn；黎明时只有女巫有投票', () => {
    const s = fixedGame();
    expect(projectPrivate(s, 2).pending).toEqual({ kind: 'turn', mode: 'choose' });
    expect(projectPrivate(s, 3).pending).toBeNull();
    s.phase = { kind: 'dawn' };
    expect(projectPrivate(s, 0).pending).toEqual({ kind: 'dawnVote', votes: {} });
    expect(projectPrivate(s, 2).pending).toBeNull();
  });

  it('夜晚：每个人都有夜晚面板，只有女巫能看到投票，只有警长能看到保护对象', () => {
    const s = fixedGame();
    startNight(s);
    s.night!.witchVotes[0] = 3;
    s.night!.protect = 4;
    expect(projectPrivate(s, 0).pending).toEqual({
      kind: 'night', witch: true, votes: { 0: 3 }, constable: false, protect: null, confessed: false,
    });
    expect(projectPrivate(s, 1).pending).toEqual({
      kind: 'night', witch: false, votes: null, constable: true, protect: 4, confessed: false,
    });
    expect(projectPrivate(s, 2).pending).toEqual({
      kind: 'night', witch: false, votes: null, constable: false, protect: null, confessed: false,
    });
  });
});
