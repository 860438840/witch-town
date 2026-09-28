import { describe, expect, it, vi } from 'vitest';
import { Api, NETWORK_ERROR } from '../src/net/api';
import { rejoinable, RoomSession } from '../src/net/session';
import { LocalStore } from '../src/net/storage';
import { Ticker } from '../src/net/ticker';
import { FakeDb, flush, ManualTimers } from './fakes';
import { lobbyRoom } from './fixtures';

describe('Api', () => {
  it('原样返回云函数结果', async () => {
    const api = new Api({ callFunction: async () => ({ result: { ok: true, data: { code: '1234' } } }) });
    expect(await api.call({ type: 'createRoom' })).toEqual({ ok: true, data: { code: '1234' } });
  });
  it('调用失败返回网络错误', async () => {
    const api = new Api({ callFunction: async () => { throw new Error('timeout'); } });
    expect(await api.call({ type: 'tick' })).toEqual({ ok: false, error: NETWORK_ERROR, network: true });
  });
  it('结果格式不对时返回错误', async () => {
    const api = new Api({ callFunction: async () => ({ result: undefined }) });
    expect(await api.call({ type: 'tick' })).toMatchObject({ ok: false, network: true });
  });
});

describe('LocalStore', () => {
  function memory() {
    const m = new Map<string, unknown>();
    return {
      getStorageSync: (k: string) => m.get(k) ?? '',
      setStorageSync: (k: string, v: unknown) => void m.set(k, v),
      removeStorageSync: (k: string) => void m.delete(k),
    };
  }
  it('保存昵称和上一次的房间', () => {
    const s = new LocalStore(memory());
    expect(s.nickname()).toBeNull();
    s.setNickname('小明');
    s.setLastRoom('1234');
    expect(s.nickname()).toBe('小明');
    expect(s.lastRoom()).toBe('1234');
    s.clearLastRoom();
    expect(s.lastRoom()).toBeNull();
  });
  it('存储出错时当作没有', () => {
    const s = new LocalStore({
      getStorageSync: () => { throw new Error('x'); },
      setStorageSync: () => { throw new Error('x'); },
      removeStorageSync: () => { throw new Error('x'); },
    });
    expect(s.nickname()).toBeNull();
    expect(() => s.setNickname('a')).not.toThrow();
  });
});

describe('RoomSession', () => {
  function setup() {
    const db = new FakeDb();
    const timers = new ManualTimers();
    const onChange = vi.fn();
    db.docs.set('rooms/1234', lobbyRoom(2));
    const session = new RoomSession(db, '1234', 'u0', timers, onChange);
    return { db, timers, onChange, session };
  }

  it('开始时先读一次数据再监听；没有手牌文档时 hand 为 null', async () => {
    const { db, onChange, session } = setup();
    session.start();
    await flush();
    expect(session.room?.code).toBe('1234');
    expect(session.hand).toBeNull();
    expect(onChange).toHaveBeenCalled();
    expect(db.live('rooms')).toBe(1);
    expect(db.live('hands')).toBe(1);
  });

  it('收到推送后更新数据', async () => {
    const { db, session } = setup();
    session.start();
    await flush();
    db.push('rooms', { ...lobbyRoom(3) });
    expect(session.room?.seats).toHaveLength(3);
  });

  it('监听出错后退避重连，连续 3 次失败改为轮询，恢复后停止轮询', async () => {
    const { db, timers, session } = setup();
    session.start();
    await flush();
    db.error('rooms');
    expect(db.live('rooms')).toBe(0);
    expect(db.live('hands')).toBe(0);
    await timers.advance(1000);
    expect(db.live('rooms')).toBe(1);
    db.error('hands');
    await timers.advance(2000);
    db.error('rooms');
    const before = db.getCalls;
    await timers.advance(3000);
    expect(db.getCalls).toBeGreaterThan(before);
    await timers.advance(1000);
    expect(db.live('rooms')).toBe(1);
    db.push('rooms', lobbyRoom(4));
    const afterRecover = db.getCalls;
    await timers.advance(10_000);
    expect(db.getCalls).toBe(afterRecover);
  });

  it('读取时网络出错保留原来的数据', async () => {
    const { db, session } = setup();
    session.start();
    await flush();
    db.failGets = true;
    await session.refresh();
    expect(session.room?.code).toBe('1234');
  });

  describe('读取返回前收到了更新的推送', () => {
    const handDoc = (n: number) => ({ _openid: 'u0', roomId: '1234', gameId: `1234-${n}`, view: null });

    it('rooms：不用读取到的旧数据覆盖推送；hands 照常更新', async () => {
      const { db, session } = setup();
      session.start();
      await flush();
      db.docs.set('hands/1234_u0', handDoc(1));
      db.holdGets = true;
      const p = session.refresh();
      await flush();
      db.push('rooms', lobbyRoom(3));
      db.releaseGets();
      await p;
      expect(session.room?.seats).toHaveLength(3);
      expect(session.hand?.gameId).toBe('1234-1');
    });

    it('hands：不用读取到的旧数据覆盖推送；rooms 照常更新', async () => {
      const { db, session } = setup();
      session.start();
      await flush();
      db.docs.set('rooms/1234', lobbyRoom(4));
      db.docs.set('hands/1234_u0', handDoc(1));
      db.holdGets = true;
      const p = session.refresh();
      await flush();
      db.push('hands', handDoc(2));
      db.releaseGets();
      await p;
      expect(session.hand?.gameId).toBe('1234-2');
      expect(session.room?.seats).toHaveLength(4);
    });
  });

  it('stop 关闭监听并清掉计时器', async () => {
    const { db, timers, session } = setup();
    session.start();
    await flush();
    db.error('rooms');
    session.stop();
    expect(db.live('rooms')).toBe(0);
    expect(timers.pending).toBe(0);
  });
});

describe('rejoinable', () => {
  it('房间还在且没结束时才提示回去；读取出网络错误时也提示（让加入请求来判断）', async () => {
    const db = new FakeDb();
    expect(await rejoinable(db, '1234')).toBe(false);
    db.docs.set('rooms/1234', lobbyRoom(2));
    expect(await rejoinable(db, '1234')).toBe(true);
    db.docs.set('rooms/1234', { ...lobbyRoom(2), status: 'ended' });
    expect(await rejoinable(db, '1234')).toBe(false);
    db.failGets = true;
    expect(await rejoinable(db, '1234')).toBe(true);
  });
});

describe('Ticker', () => {
  function setup() {
    const timers = new ManualTimers();
    const tick = vi.fn(async () => ({ ok: true }));
    const ticker = new Ticker({ now: () => timers.now, random: () => 0.5, timers, tick });
    return { timers, tick, ticker };
  }

  it('截止时间过后再随机等待一会儿才推进', async () => {
    const { timers, tick, ticker } = setup();
    ticker.update(10_000);
    await timers.advance(10_000 + 749);
    expect(tick).not.toHaveBeenCalled();
    await timers.advance(1);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('截止时间没变时 3 秒后重试；变成 null 时停止', async () => {
    const { timers, tick, ticker } = setup();
    ticker.update(0);
    await timers.advance(750);
    expect(tick).toHaveBeenCalledTimes(1);
    await timers.advance(3000);
    expect(tick).toHaveBeenCalledTimes(2);
    ticker.update(null);
    await timers.advance(10_000);
    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('同一个截止时间重复 update 不会重复安排；tick 出错被忽略', async () => {
    const { timers, tick, ticker } = setup();
    tick.mockRejectedValueOnce(new Error('network'));
    ticker.update(1000);
    ticker.update(1000);
    expect(timers.pending).toBe(1);
    await timers.advance(1750);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('同一时间最多一个 tick 请求', async () => {
    const timers = new ManualTimers();
    let release: () => void = () => {};
    const tick = vi.fn(() => new Promise<void>((r) => (release = r)));
    const ticker = new Ticker({ now: () => timers.now, random: () => 0, timers, tick });
    ticker.update(0);
    await timers.advance(0);
    ticker.update(100);
    await timers.advance(100);
    expect(tick).toHaveBeenCalledTimes(1);
    release();
    await flush();
    await timers.advance(3000);
    expect(tick).toHaveBeenCalledTimes(2);
  });
});
