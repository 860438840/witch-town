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

export function roomOf(s: GameState, gameId = GAME_ID): RoomDoc {
  return {
    code: CODE,
    host: 'u0',
    status: s.phase.kind === 'ended' ? 'ended' : 'playing',
    seats: s.players.map((p) => ({ openid: p.openid, name: p.name, avatar: '' })),
    view: projectPublic(s),
    deadline: 1_800_000_090_000,
    gameId,
    updatedAt: 0,
  };
}

export function handOf(s: GameState, seat: number, gameId = GAME_ID): HandDoc {
  return { _openid: s.players[seat].openid, roomId: CODE, gameId, view: projectPrivate(s, seat) };
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
