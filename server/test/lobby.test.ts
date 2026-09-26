import { describe, expect, it } from 'vitest';
import { RuleError, seededRng } from '../../engine/src/index';
import { addBots, createRoom, joinRoom, leaveRoom, reorderSeats, STALE_MS } from '../src/lobby';
import { MemoryStore } from '../src/memoryStore';
import { ROOMS, type RoomDoc } from '../src/types';
import { lobbyWith, NOW, profile, run } from './helpers';

const room = (store: MemoryStore, code: string) => store.read<RoomDoc>(ROOMS, code) as RoomDoc;

describe('createRoom', () => {
  it('生成 4 位房间号，创建者是房主和 1 号座位', async () => {
    const store = new MemoryStore();
    const { code } = await run(store, (tx) => createRoom(tx, 'u0', profile('小明'), NOW, seededRng(1)));
    expect(code).toMatch(/^\d{4}$/);
    const r = room(store, code);
    expect(r.host).toBe('u0');
    expect(r.status).toBe('lobby');
    expect(r.seats).toEqual([{ openid: 'u0', name: '小明', avatar: '' }]);
    expect(r.view).toBeNull();
    expect(r.deadline).toBeNull();
  });

  it('房间号被正在使用的房间占用时换一个', async () => {
    const store = new MemoryStore();
    const a = await run(store, (tx) => createRoom(tx, 'u0', profile('A'), NOW, seededRng(1)));
    const b = await run(store, (tx) => createRoom(tx, 'u1', profile('B'), NOW, seededRng(1)));
    expect(b.code).not.toBe(a.code);
    expect(room(store, a.code).host).toBe('u0');
  });

  it('超过 6 小时未更新的房间号可以复用', async () => {
    const store = new MemoryStore();
    const a = await run(store, (tx) => createRoom(tx, 'u0', profile('A'), NOW, seededRng(1)));
    const later = NOW + STALE_MS + 1;
    const b = await run(store, (tx) => createRoom(tx, 'u1', profile('B'), later, seededRng(1)));
    expect(b.code).toBe(a.code);
    expect(room(store, b.code).host).toBe('u1');
  });

  it('昵称必须是 1–12 个字', async () => {
    const store = new MemoryStore();
    await expect(run(store, (tx) => createRoom(tx, 'u0', profile('  '), NOW, seededRng(1)))).rejects.toThrow(RuleError);
    await expect(
      run(store, (tx) => createRoom(tx, 'u0', profile('一二三四五六七八九十一二三'), NOW, seededRng(1))),
    ).rejects.toThrow(/1–12/);
  });
});

describe('joinRoom', () => {
  it('加入后按顺序排座位；同一个人重复加入只更新昵称', async () => {
    const { store, code } = await lobbyWith(3);
    await run(store, (tx) => joinRoom(tx, code, 'u1', profile('新名字'), NOW));
    const r = room(store, code);
    expect(r.seats.map((s) => s.openid)).toEqual(['u0', 'u1', 'u2']);
    expect(r.seats[1].name).toBe('新名字');
  });

  it('房间不存在、房间已满时报错', async () => {
    const { store, code } = await lobbyWith(12);
    await expect(run(store, (tx) => joinRoom(tx, '9999', 'x', profile('X'), NOW))).rejects.toThrow('房间不存在');
    await expect(run(store, (tx) => joinRoom(tx, code, 'u12', profile('X'), NOW))).rejects.toThrow('房间已满');
  });

  it('游戏开始后新玩家不能加入，但已在房间里的玩家可以重新进入（掉线重连）', async () => {
    const { store, code } = await lobbyWith(4);
    store.write(ROOMS, code, { ...room(store, code), status: 'playing' });
    await expect(run(store, (tx) => joinRoom(tx, code, 'new', profile('X'), NOW))).rejects.toThrow('游戏已经开始');
    await expect(run(store, (tx) => joinRoom(tx, code, 'u2', profile('P2'), NOW))).resolves.toEqual({ code });
  });
});

describe('leaveRoom', () => {
  it('房主离开后下一位成为房主；最后一人离开后房间结束', async () => {
    const { store, code } = await lobbyWith(2);
    await run(store, (tx) => leaveRoom(tx, code, 'u0', NOW));
    expect(room(store, code).host).toBe('u1');
    await run(store, (tx) => leaveRoom(tx, code, 'u1', NOW));
    expect(room(store, code).status).toBe('ended');
  });

  it('游戏开始后不能离开', async () => {
    const { store, code } = await lobbyWith(4);
    store.write(ROOMS, code, { ...room(store, code), status: 'playing' });
    await expect(run(store, (tx) => leaveRoom(tx, code, 'u1', NOW))).rejects.toThrow(RuleError);
  });
});

describe('reorderSeats', () => {
  it('房主可以调整座位顺序', async () => {
    const { store, code } = await lobbyWith(3);
    await run(store, (tx) => reorderSeats(tx, code, 'u0', ['u2', 'u0', 'u1'], NOW));
    expect(room(store, code).seats.map((s) => s.openid)).toEqual(['u2', 'u0', 'u1']);
  });

  it('非房主不能调整；顺序必须恰好包含所有人', async () => {
    const { store, code } = await lobbyWith(3);
    await expect(run(store, (tx) => reorderSeats(tx, code, 'u1', ['u2', 'u0', 'u1'], NOW))).rejects.toThrow('房主');
    await expect(run(store, (tx) => reorderSeats(tx, code, 'u0', ['u2', 'u0'], NOW))).rejects.toThrow(RuleError);
    await expect(run(store, (tx) => reorderSeats(tx, code, 'u0', ['u2', 'u0', 'u0'], NOW))).rejects.toThrow(RuleError);
  });
});

describe('addBots', () => {
  it('房主加机器人，最多加到 12 人', async () => {
    const { store, code } = await lobbyWith(2);
    await run(store, (tx) => addBots(tx, code, 'u0', 2, NOW));
    const r = room(store, code);
    expect(r.seats.map((s) => s.openid)).toEqual(['u0', 'u1', 'bot-1', 'bot-2']);
    expect(r.seats[2].name).toBe('机器人1');
    await run(store, (tx) => addBots(tx, code, 'u0', 20, NOW));
    expect(room(store, code).seats).toHaveLength(12);
  });

  it('非房主不能加机器人', async () => {
    const { store, code } = await lobbyWith(2);
    await expect(run(store, (tx) => addBots(tx, code, 'u1', 1, NOW))).rejects.toThrow('房主');
  });
});
