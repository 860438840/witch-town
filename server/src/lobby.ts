import { RuleError, type Rng } from '../../engine/src/index';
import type { Tx } from './store';
import { BOT_PREFIX, isBot, MAX_PLAYERS, ROOMS, type Profile, type RoomDoc } from './types';

/** 超过这么久没有更新的活跃房间，其房间号可以被新房间复用 */
export const STALE_MS = 6 * 3600_000;

/** 已结束的房间，至少要过这么久才能把房间号让给新房间（避免刚结束就抢号导致的困惑） */
export const ENDED_GRACE_MS = 30 * 60_000;

/** 昵称里的控制字符和零宽字符（U+200B–U+200D 零宽空格/连字符、U+FEFF 字节顺序标记），去掉后再检查长度 */
const STRIP_FROM_NAME = /[\u0000-\u001F\u007F-\u009F​-‍﻿]/g;

function checkAvatar(v: unknown): string {
  if (typeof v !== 'string') return '';
  if (v === '') return '';
  if (v.length > 512) return '';
  if (!v.startsWith('https://')) return '';
  return v;
}

export function checkProfile(p: unknown): Profile {
  const raw = (p ?? {}) as { name?: unknown; avatar?: unknown };
  const name = typeof raw.name === 'string' ? raw.name.replace(STRIP_FROM_NAME, '').trim() : '';
  if ([...name].length < 1 || [...name].length > 12) throw new RuleError('昵称需要 1–12 个字');
  return { name, avatar: checkAvatar(raw.avatar) };
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

export async function createRoom(
  tx: Tx,
  openid: string,
  profile: unknown,
  now: number,
  rng: Rng,
): Promise<{ code: string; openid: string }> {
  const me = checkProfile(profile);
  for (let attempt = 0; attempt < 30; attempt++) {
    const code = String(1000 + Math.floor(rng.next() * 9000));
    const existing = await tx.get<RoomDoc>(ROOMS, code);
    if (existing) {
      const active = existing.status !== 'ended' && now - existing.updatedAt <= STALE_MS;
      const recentlyEnded = existing.status === 'ended' && now - existing.updatedAt <= ENDED_GRACE_MS;
      if (active || recentlyEnded) continue;
    }
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
    return { code, openid };
  }
  throw new RuleError('暂时没有空闲的房间号，请稍后再试');
}

export async function joinRoom(
  tx: Tx,
  code: string,
  openid: string,
  profile: unknown,
  now: number,
): Promise<{ code: string; openid: string }> {
  const room = await loadRoom(tx, code);
  const seat = room.seats.find((s) => s.openid === openid);
  if (seat) {
    // 掉线重连：游戏已经开始后，重新加入不应该改名字/头像，也不应该重置房间的 updatedAt
    if (room.status !== 'lobby') return { code, openid };
    const me = checkProfile(profile);
    seat.name = me.name;
    seat.avatar = me.avatar;
  } else {
    if (room.status === 'ended') throw new RuleError('房间已结束');
    if (room.status !== 'lobby') throw new RuleError('游戏已经开始，不能加入');
    if (room.seats.length >= MAX_PLAYERS) throw new RuleError('房间已满');
    const me = checkProfile(profile);
    room.seats.push({ openid, ...me });
  }
  room.updatedAt = now;
  await tx.set(ROOMS, code, room);
  return { code, openid };
}

export async function leaveRoom(tx: Tx, code: string, openid: string, now: number): Promise<Record<string, never>> {
  const room = await loadRoom(tx, code);
  if (room.status === 'ended') throw new RuleError('房间已结束');
  requireLobby(room);
  if (!room.seats.some((s) => s.openid === openid)) throw new RuleError('你不在这个房间里');
  room.seats = room.seats.filter((s) => s.openid !== openid);
  const humans = room.seats.filter((s) => !isBot(s.openid));
  if (humans.length === 0) {
    room.status = 'ended';
  } else if (room.host === openid) {
    room.host = humans[0].openid;
  }
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
