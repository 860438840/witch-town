import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { seededRng } from '../src/rng';
import { countCards } from '../src/state';
import type { Action, GameState } from '../src/types';
import { allPick, fixedGame, giveCard, placeBlue, quietNight, setCharacter, stackDeck } from './helpers';

const act = (s: GameState, a: Action) => apply(s, a, seededRng(7));
const play = (s: GameState, seat: number, cardId: string, targets: number[]) =>
  act(s, { type: 'play', seat, cardId, targets });
const reveal = (s: GameState, seat: number) =>
  act(s, { type: 'revealTryal', seat, tryalId: s.players[seat].tryals.find((t) => !t.revealed)!.id });

// fixedGame：5 人；0 号是唯一女巫，1 号是警长，2–4 号是村民（第一张都是村民卡）；轮到 2 号

describe('地主', () => {
  it('正常抽牌抽到 2 张指控时展示并再抽 1 张', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'landlord');
    stackDeck(s, ['accusation', 'accusation', 'alibi']);
    const before = s.players[2].hand.length;
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.players[2].hand).toHaveLength(before + 3);
    expect(s.log).toContainEqual({ t: 'ability', seat: 2, ability: 'landlord' });
    expect(s.turn).toBe(3);
  });

  it('再抽的那张又是指控也不继续；不是 2 张指控不触发', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'landlord');
    stackDeck(s, ['accusation', 'accusation', 'accusation', 'alibi']);
    const before = s.players[2].hand.length;
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.players[2].hand).toHaveLength(before + 3);

    let t = fixedGame();
    setCharacter(t, 2, 'landlord');
    stackDeck(t, ['accusation', 'evidence', 'accusation']);
    const n = t.players[2].hand.length;
    t = act(t, { type: 'draw', seat: 2 });
    expect(t.players[2].hand).toHaveLength(n + 2);
    expect(t.log.some((e) => e.t === 'ability')).toBe(false);
  });
});

describe('家庭主妇', () => {
  it('别人的身份卡因审判翻开时摸一张', () => {
    let s = fixedGame();
    setCharacter(s, 4, 'housewife');
    const w = giveCard(s, 2, 'witness');
    s = play(s, 2, w.id, [3]);
    stackDeck(s, ['alibi']);
    const before = s.players[4].hand.length;
    s = reveal(s, 3);
    expect(s.players[4].hand).toHaveLength(before + 1);
    expect(s.log).toContainEqual({ t: 'ability', seat: 4, ability: 'housewife' });
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(countCards(s)).toBe(60);
  });

  it('自己的身份卡被翻开不摸', () => {
    let s = fixedGame();
    setCharacter(s, 4, 'housewife');
    const w = giveCard(s, 2, 'witness');
    s = play(s, 2, w.id, [4]);
    const before = s.players[4].hand.length;
    s = reveal(s, 4);
    expect(s.players[4].hand).toHaveLength(before);
  });

  it('黑猫翻牌也算', () => {
    let s = fixedGame();
    setCharacter(s, 4, 'housewife');
    placeBlue(s, 3, 'blackCat');
    stackDeck(s, ['conspiracy', 'alibi']);
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.phase).toEqual({ kind: 'catReveal', holder: 3 });
    const before = s.players[4].hand.length;
    s = reveal(s, 3);
    expect(s.players[4].hand).toHaveLength(before + 1);
    expect(s.phase).toEqual({ kind: 'conspiracyPick' });
  });
});

describe('少女', () => {
  it('她引发的审判开始前先摸 2 张，本回合可以继续出牌', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'maiden');
    const w = giveCard(s, 2, 'witness');
    stackDeck(s, ['accusation', 'alibi']);
    const before = s.players[2].hand.length;
    s = play(s, 2, w.id, [3]);
    expect(s.players[2].hand).toHaveLength(before - 1 + 2);
    expect(s.log).toContainEqual({ t: 'ability', seat: 2, ability: 'maiden' });
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 3, initiator: 2 });
    s = reveal(s, 3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(s.turn).toBe(2);
  });
});

describe('回合外摸到黑卡：立即结算，结算完回到原流程（C4）', () => {
  it('例 1：家庭主妇在审判翻牌后摸到夜晚 → 夜晚 → 审判收尾 → 当前回合结束', () => {
    let s = fixedGame();
    setCharacter(s, 4, 'housewife');
    const w = giveCard(s, 2, 'witness');
    s = play(s, 2, w.id, [3]);
    stackDeck(s, ['night']);
    s = reveal(s, 3);
    expect(s.phase).toEqual({ kind: 'night' });
    expect(s.players[3].red).toHaveLength(1);
    s = quietNight(s);
    expect(s.players[3].red).toEqual([]);
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(s.steps).toEqual([]);
  });

  it('例 1b：家庭主妇在审判翻牌后摸到传染 → 传染 → 审判收尾 → 当前玩家继续出牌', () => {
    let s = fixedGame();
    setCharacter(s, 4, 'housewife');
    const w = giveCard(s, 2, 'witness');
    s = play(s, 2, w.id, [3]);
    stackDeck(s, ['conspiracy']);
    s = reveal(s, 3);
    expect(s.phase).toEqual({ kind: 'conspiracyPick' });
    s = allPick(s);
    expect(s.players[3].red).toEqual([]);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(s.turn).toBe(2);
  });

  it('例 2：家庭主妇在黑猫翻牌后摸到夜晚 → 夜晚 → 继续传染盲抽 → 当前回合结束', () => {
    let s = fixedGame();
    setCharacter(s, 4, 'housewife');
    placeBlue(s, 3, 'blackCat');
    stackDeck(s, ['conspiracy', 'night']);
    const hand2 = s.players[2].hand.length;
    s = act(s, { type: 'draw', seat: 2 });
    s = reveal(s, 3);
    expect(s.phase).toEqual({ kind: 'night' });
    s = quietNight(s);
    expect(s.phase).toEqual({ kind: 'conspiracyPick' });
    s = allPick(s);
    expect(s.players[2].hand).toHaveLength(hand2);
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(s.steps).toEqual([]);
  });

  it('例 3：少女审判前摸到夜晚，被审判者夜里死亡 → 取消审判，少女回合结束', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'maiden');
    const w = giveCard(s, 2, 'witness');
    stackDeck(s, ['alibi', 'night']);
    s = play(s, 2, w.id, [3]);
    expect(s.phase).toEqual({ kind: 'night' });
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 4 });
    for (const p of s.players) if (p.alive && s.phase.kind === 'night') s = act(s, { type: 'confess', seat: p.seat, tryalId: null });
    expect(s.players[3].alive).toBe(false);
    expect(s.log.some((e) => e.t === 'trial')).toBe(false);
    expect(s.turn).toBe(4);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
  });

  it('例 3b：少女审判前摸到夜晚，被审判者活着 → 夜晚后继续审判，审判后少女回合结束', () => {
    let s = fixedGame();
    setCharacter(s, 2, 'maiden');
    const w = giveCard(s, 2, 'witness');
    stackDeck(s, ['alibi', 'night']);
    s = play(s, 2, w.id, [3]);
    s = quietNight(s);
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 3, initiator: 2 });
    s = reveal(s, 3);
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(s.steps).toEqual([]);
  });
  it('回合外摸到传染且有黑猫：黑猫持有者先翻牌，再盲抽，最后回到审判收尾，当前玩家继续出牌', () => {
    let s = fixedGame();
    setCharacter(s, 4, 'housewife');
    placeBlue(s, 3, 'blackCat');
    const w = giveCard(s, 2, 'witness');
    s = play(s, 2, w.id, [1]);
    stackDeck(s, ['conspiracy', 'alibi']);
    s = reveal(s, 1);
    expect(s.phase).toEqual({ kind: 'catReveal', holder: 3 });
    s = reveal(s, 3);
    expect(s.phase).toEqual({ kind: 'conspiracyPick' });
    s = allPick(s);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(s.turn).toBe(2);
    expect(s.players[1].red).toEqual([]);
    expect(s.steps).toEqual([]);
  });
});

describe('游戏结束后不再产生能力日志（F4）', () => {
  it('审判翻牌使游戏结束时，家庭主妇不摸牌也没有日志', () => {
    let s = fixedGame();
    setCharacter(s, 4, 'housewife');
    const w = giveCard(s, 2, 'witness');
    s = play(s, 2, w.id, [0]);
    s = reveal(s, 0);
    expect(s.phase.kind).toBe('ended');
    expect(s.log.some((e) => e.t === 'ability' && e.ability === 'housewife')).toBe(false);
    expect(s.steps.some((st) => st.kind === 'draw')).toBe(false);
  });
});
