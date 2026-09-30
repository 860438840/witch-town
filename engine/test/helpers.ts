import { seededRng } from '../src/rng';
import { createGame } from '../src/setup';
import type { Card, CardKind, CharacterId, GameState, TryalKind } from '../src/types';

export const V: TryalKind = 'villager';

/** 去掉随机角色，直接从第一夜开始（大多数规则测试不希望角色干扰） */
export function withoutCharacters(s: GameState): GameState {
  for (const p of s.players) p.character = null;
  s.characterOffers = {};
  s.log = s.log.filter((e) => e.t !== 'character');
  if (s.phase.kind === 'characterPick') s.phase = { kind: 'dawn' };
  return s;
}

export function newGame(n = 5, seed = 1): GameState {
  return withoutCharacters(
    createGame(
      Array.from({ length: n }, (_, i) => ({ openid: `u${i}`, name: `P${i}` })),
      seededRng(seed),
    ),
  );
}

export function setCharacter(s: GameState, seat: number, c: CharacterId): void {
  s.players[seat].character = c;
}

/** 覆盖某个玩家的身份卡（测试专用，会打破身份卡总数的约束） */
export function setTryals(s: GameState, seat: number, kinds: TryalKind[]): void {
  s.players[seat].tryals = kinds.map((kind, i) => ({ id: `fix-${seat}-${i}`, kind, revealed: false }));
  s.players[seat].witchFaction = kinds.includes('witch');
}

export function forceDay(s: GameState, seat: number): void {
  s.phase = { kind: 'day', mode: 'choose' };
  s.turn = seat;
  s.drawsLeft = 0;
}

/** 5 人局：0 号是唯一女巫（第 1 张），1 号是警长（第 1 张），2–4 号全是村民；轮到 2 号 */
export function fixedGame(): GameState {
  const s = newGame(5);
  setTryals(s, 0, ['witch', V, V, V, V]);
  setTryals(s, 1, ['constable', V, V, V, V]);
  for (const seat of [2, 3, 4]) setTryals(s, seat, [V, V, V, V, V]);
  forceDay(s, 2);
  return s;
}

/** 从牌堆/弃牌堆/暂放区/手牌中拿出一张指定种类的卡（保持总卡数不变） */
function takeFromAnywhere(s: GameState, kind: CardKind): Card {
  const pools = [s.deck, s.discard, s.setAside, ...s.players.map((p) => p.hand)];
  for (const pool of pools) {
    const i = pool.findIndex((c) => c.kind === kind);
    if (i >= 0) return pool.splice(i, 1)[0];
  }
  throw new Error(`找不到 ${kind}`);
}

export function giveCard(s: GameState, seat: number, kind: CardKind): Card {
  const c = takeFromAnywhere(s, kind);
  s.players[seat].hand.push(c);
  return c;
}

export function placeBlue(s: GameState, seat: number, kind: CardKind): Card {
  const c = takeFromAnywhere(s, kind);
  s.players[seat].blue.push(c);
  return c;
}

/** 把指定的卡按顺序放到牌堆顶 */
export function stackDeck(s: GameState, kinds: CardKind[]): void {
  const top = kinds.map((k) => takeFromAnywhere(s, k));
  s.deck.unshift(...top);
}
