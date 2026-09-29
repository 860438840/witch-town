import {
  createGame,
  projectPrivate,
  projectPublic,
  seededRng,
  type CardKind,
  type GameState,
} from '../../engine/src/index';
import type { HandDoc, RoomDoc } from '../../server/src/types';

export const CODE = '1234';
export const GAME_ID = '1234-1';

export function newState(n = 5, seed = 1): GameState {
  return createGame(
    Array.from({ length: n }, (_, i) => ({ openid: `u${i}`, name: `P${i}` })),
    seededRng(seed),
  );
}

/** 数据库快照每次都是新对象；视图深拷贝一份，避免之后改 state 时连带改到旧快照 */
const snapshot = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function roomOf(s: GameState, gameId = GAME_ID): RoomDoc {
  return {
    code: CODE,
    host: 'u0',
    status: s.phase.kind === 'ended' ? 'ended' : 'playing',
    seats: s.players.map((p) => ({ openid: p.openid, name: p.name, avatar: '' })),
    view: snapshot(projectPublic(s)),
    deadline: 1_800_000_090_000,
    gameId,
    updatedAt: 0,
  };
}

export function handOf(s: GameState, seat: number, gameId = GAME_ID): HandDoc {
  return { _openid: s.players[seat].openid, roomId: CODE, gameId, view: snapshot(projectPrivate(s, seat)) };
}

export function lobbyRoom(n: number): RoomDoc {
  return {
    code: CODE,
    host: 'u0',
    status: 'lobby',
    seats: Array.from({ length: n }, (_, i) => ({ openid: `u${i}`, name: `P${i}`, avatar: '' })),
    view: null,
    deadline: null,
    gameId: null,
    updatedAt: 0,
  };
}

export function setDay(s: GameState, turn: number, mode: 'choose' | 'playing' | 'drawing' = 'choose'): void {
  s.phase = { kind: 'day', mode };
  s.turn = turn;
}

export function giveCard(s: GameState, seat: number, kind: CardKind, id = `${kind}-x${seat}`): string {
  s.players[seat].hand.push({ id, kind });
  return id;
}

/** 模拟传染：把 from 的女巫卡换给 to 的一张村民卡。to 加入女巫阵营，from 仍属女巫阵营 */
export function infect(s: GameState, from: number, to: number): void {
  const w = s.players[from].tryals.findIndex((t) => t.kind === 'witch');
  const v = s.players[to].tryals.findIndex((t) => t.kind === 'villager');
  [s.players[from].tryals[w], s.players[to].tryals[v]] = [s.players[to].tryals[v], s.players[from].tryals[w]];
  s.players[to].witchFaction = true;
}
