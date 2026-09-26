import { RuleError, type Rng } from '../../engine/src/index';
import type { Tx } from './store';
import { BOT_PREFIX, MAX_PLAYERS, ROOMS, type Profile, type RoomDoc } from './types';

/** 超过这么久没有更新的房间，其房间号可以被新房间复用 */
export const STALE_MS = 6 * 3600_000;

export function checkProfile(p: unknown): Profile {
  const raw = (p ?? {}) as { name?: unknown; avatar?: unknown };
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if ([...name].length < 1 || [...name].length > 12) throw new RuleError('昵称需要 1–12 个字');
  return { name, avatar: typeof raw.avatar === 'string' ? raw.avatar : '' };
}

export async function loadRoom(tx: Tx, code: string): Promise<RoomDoc> {
  const room = await tx.get<RoomDoc>(ROOMS, code);
  if (!room) throw new RuleError('房间不存在');
  return room;
}

function requireHost(room: RoomDoc, openid: string): void {
  if (room.host !== openid) throw new RuleError('只有房主可以这样做');
}

function requireLobby(room: RoomDoc): void {
  if (room.status !== 'lobby') throw new RuleError('游戏已经开始');
}

export async function createRoom(tx: Tx, openid: string, profile: unknown, now: number, rng: Rng): Promise<{ code: string }> {
  const me = checkProfile(profile);
  for (let attempt = 0; attempt < 30; attempt++) {
    const code = String(1000 + Math.floor(rng.next() * 9000));
    const existing = await tx.get<RoomDoc>(ROOMS, code);
    if (existing && existing.status !== 'ended' && now - existing.updatedAt <= STALE_MS) continue;
    const room: RoomDoc = {
      code,
      host: openid,
      status: 'lobby',
      seats: [{ openid, ...me }],
      view: null,
      deadline: null,
      updatedAt: now,
    };
    await tx.set(ROOMS, code, room);
    return { code };
  }
  throw new RuleError('暂时没有空闲的房间号，请稍后再试');
}

export async function joinRoom(tx: Tx, code: string, openid: string, profile: unknown, now: number): Promise<{ code: string }> {
  const me = checkProfile(profile);
  const room = await loadRoom(tx, code);
  const seat = room.seats.find((s) => s.openid === openid);
  if (seat) {
    seat.name = me.name;
    seat.avatar = me.avatar;
  } else {
    if (room.status !== 'lobby') throw new RuleError('游戏已经开始，不能加入');
    if (room.seats.length >= MAX_PLAYERS) throw new RuleError('房间已满');
    room.seats.push({ openid, ...me });
  }
  room.updatedAt = now;
  await tx.set(ROOMS, code, room);
  return { code };
}

export async function leaveRoom(tx: Tx, code: string, openid: string, now: number): Promise<Record<string, never>> {
  const room = await loadRoom(tx, code);
  requireLobby(room);
  room.seats = room.seats.filter((s) => s.openid !== openid);
  if (room.seats.length === 0) room.status = 'ended';
  else if (room.host === openid) room.host = room.seats[0].openid;
  room.updatedAt = now;
  await tx.set(ROOMS, code, room);
  return {};
}

export async function reorderSeats(tx: Tx, code: string, openid: string, order: string[], now: number): Promise<Record<string, never>> {
  const room = await loadRoom(tx, code);
  requireHost(room, openid);
  requireLobby(room);
  const current = room.seats.map((s) => s.openid);
  const valid =
    Array.isArray(order) &&
    order.length === current.length &&
    new Set(order).size === order.length &&
    order.every((o) => current.includes(o));
  if (!valid) throw new RuleError('座位顺序无效');
  room.seats = order.map((o) => room.seats.find((s) => s.openid === o)!);
  room.updatedAt = now;
  await tx.set(ROOMS, code, room);
  return {};
}

export async function addBots(tx: Tx, code: string, openid: string, count: number, now: number): Promise<Record<string, never>> {
  const room = await loadRoom(tx, code);
  requireHost(room, openid);
  requireLobby(room);
  let n = room.seats.filter((s) => s.openid.startsWith(BOT_PREFIX)).length;
  for (let i = 0; i < count && room.seats.length < MAX_PLAYERS; i++) {
    n++;
    room.seats.push({ openid: `${BOT_PREFIX}${n}`, name: `机器人${n}`, avatar: '' });
  }
  room.updatedAt = now;
  await tx.set(ROOMS, code, room);
  return {};
}
