import {
  apply,
  autoActions,
  createGame,
  projectPrivate,
  projectPublic,
  RuleError,
  type Action,
  type GameState,
  type Rng,
} from '../../engine/src/index';
import { deadlineKey, phaseDuration } from './deadlines';
import { loadRoom } from './lobby';
import type { Tx } from './store';
import { GAMES, handId, HANDS, MIN_PLAYERS, ROOMS, type GameDoc, type HandDoc, type RoomDoc } from './types';
import { parseClientAction } from './validate';

/** 客户端发来的操作：座位由服务器根据 openid 决定 */
export type ClientAction = { [K in Action['type']]: Omit<Extract<Action, { type: K }>, 'seat'> }[Action['type']];

/** 把新局面写回 games、rooms（公开视图）和每人的 hands（私密视图）。等待阶段没变时沿用原截止时间。 */
async function persist(tx: Tx, room: RoomDoc, state: GameState, prev: GameDoc | null, now: number): Promise<void> {
  const key = deadlineKey(state);
  const deadline = prev && prev.deadlineKey === key ? prev.deadline : now + phaseDuration(state);
  const ended = state.phase.kind === 'ended';
  const gameDoc: GameDoc = { state, deadlineKey: key, deadline };
  const roomDoc: RoomDoc = {
    ...room,
    status: ended ? 'ended' : 'playing',
    view: projectPublic(state),
    deadline: ended ? null : deadline,
    updatedAt: now,
  };
  await tx.set(GAMES, room.code, gameDoc);
  await tx.set(ROOMS, room.code, roomDoc);
  for (const p of state.players) {
    const hand: HandDoc = { _openid: p.openid, roomId: room.code, view: projectPrivate(state, p.seat) };
    await tx.set(HANDS, handId(room.code, p.openid), hand);
  }
}

async function loadGame(tx: Tx, code: string): Promise<GameDoc> {
  const game = await tx.get<GameDoc>(GAMES, code);
  if (!game) throw new RuleError('游戏数据不存在');
  return game;
}

export async function startGame(tx: Tx, code: string, openid: string, now: number, rng: Rng): Promise<{ version: number }> {
  const room = await loadRoom(tx, code);
  if (room.host !== openid) throw new RuleError('只有房主可以开始游戏');
  if (room.status !== 'lobby') throw new RuleError('游戏已经开始');
  if (room.seats.length < MIN_PLAYERS) throw new RuleError(`至少需要 ${MIN_PLAYERS} 名玩家`);
  const state = createGame(
    room.seats.map((s) => ({ openid: s.openid, name: s.name })),
    rng,
  );
  await persist(tx, room, state, null, now);
  return { version: state.version };
}

export async function act(
  tx: Tx,
  code: string,
  openid: string,
  rawAction: unknown,
  expectedVersion: number | undefined,
  now: number,
  rng: Rng,
): Promise<{ version: number }> {
  const room = await loadRoom(tx, code);
  if (room.status !== 'playing') throw new RuleError('游戏没有在进行');
  const game = await loadGame(tx, code);
  if (expectedVersion !== undefined && expectedVersion !== game.state.version) {
    throw new RuleError('状态已变化，请重试');
  }
  const seat = game.state.players.findIndex((p) => p.openid === openid);
  if (seat < 0) throw new RuleError('你不在这局游戏中');
  const action = parseClientAction(rawAction, game.state.players.length);
  const next = apply(game.state, { ...action, seat } as Action, rng);
  await persist(tx, room, next, game, now);
  return { version: next.version };
}

export async function tick(tx: Tx, code: string, now: number, rng: Rng): Promise<{ changed: boolean }> {
  const room = await loadRoom(tx, code);
  if (room.status !== 'playing') return { changed: false };
  const game = await loadGame(tx, code);
  if (now < game.deadline) return { changed: false };
  let state = game.state;
  for (const a of autoActions(state, rng)) {
    try {
      state = apply(state, a, rng);
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
    }
  }
  if (state === game.state) return { changed: false };
  await persist(tx, room, state, game, now);
  return { changed: true };
}
