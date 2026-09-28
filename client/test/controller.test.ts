import { describe, expect, it, vi } from 'vitest';
import { Controller, type SessionLike } from '../src/controller';
import type { ApiResult } from '../src/net/api';
import type { KeyStore } from '../src/net/storage';
import { flush } from './fakes';
import { lobbyRoom, newState, roomOf } from './fixtures';

function memStore(): KeyStore {
  let nick: string | null = '小明';
  let room: string | null = null;
  return {
    nickname: () => nick,
    setNickname: (n) => void (nick = n),
    lastRoom: () => room,
    setLastRoom: (c) => void (room = c),
    clearLastRoom: () => void (room = null),
  };
}

function setup(reply: (req: Record<string, unknown>) => ApiResult | Promise<ApiResult>) {
  const store = memStore();
  const toast = vi.fn();
  const render = vi.fn();
  const sessions: (SessionLike & { onChange: () => void })[] = [];
  const ticker = { update: vi.fn(), stop: vi.fn() };
  const api = { call: vi.fn(async (req: Record<string, unknown>) => reply(req)) };
  const ctl = new Controller({
    api: api as never,
    store,
    openSession: (_code, _openid, onChange) => {
      const s = { room: null, hand: null, start: vi.fn(), stop: vi.fn(), refresh: vi.fn(async () => {}), onChange };
      sessions.push(s);
      return s;
    },
    makeTicker: () => ticker,
    toast,
    render,
  });
  return { ctl, api, store, toast, render, sessions, ticker };
}

const entered = (req: Record<string, unknown>): ApiResult => ({ ok: true, data: { code: '1234', openid: 'u0' } });

describe('Controller', () => {
  it('建房成功后进入房间：记住房号、开始监听', async () => {
    const { ctl, api, store, sessions } = setup(entered);
    await ctl.createRoom();
    expect(api.call).toHaveBeenCalledWith({ type: 'createRoom', profile: { name: '小明', avatar: '' } });
    expect(ctl.code).toBe('1234');
    expect(ctl.openid).toBe('u0');
    expect(store.lastRoom()).toBe('1234');
    expect(sessions[0].start).toHaveBeenCalled();
  });

  it('房号不是 4 位数字时不发请求', async () => {
    const { ctl, api, toast } = setup(entered);
    await ctl.joinRoom('12a');
    expect(api.call).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('请输入 4 位房间号');
  });

  it('请求进行中再点不会发出第二个请求', async () => {
    let release: (r: ApiResult) => void = () => {};
    const { ctl, api } = setup((req) => (req.type === 'act' ? new Promise((r) => (release = r)) : entered(req)));
    await ctl.createRoom();
    const first = ctl.act({ type: 'draw' });
    expect(ctl.busy).toBe(true);
    await ctl.act({ type: 'draw' });
    expect(api.call).toHaveBeenCalledTimes(2);
    release({ ok: true, data: {} });
    await first;
    expect(ctl.busy).toBe(false);
  });

  it('出牌带上当前版本号', async () => {
    const { ctl, api, sessions } = setup(entered);
    await ctl.createRoom();
    const s = newState(5);
    s.version = 7;
    sessions[0].room = roomOf(s);
    await ctl.act({ type: 'endTurn' });
    expect(api.call).toHaveBeenLastCalledWith({ type: 'act', code: '1234', action: { type: 'endTurn' }, version: 7 });
  });

  it('「状态已变化」时静默刷新，其他错误弹提示', async () => {
    let error = '状态已变化，请重试';
    const { ctl, toast, sessions } = setup((req) => (req.type === 'act' ? { ok: false, error } : entered(req)));
    await ctl.createRoom();
    await ctl.act({ type: 'draw' });
    expect(toast).not.toHaveBeenCalled();
    expect(sessions[0].refresh).toHaveBeenCalled();
    error = '现在不能抽牌';
    await ctl.act({ type: 'draw' });
    expect(toast).toHaveBeenCalledWith('现在不能抽牌');
  });

  it('房间不存在时回到首页', async () => {
    const { ctl, store, sessions, ticker } = setup((req) => (req.type === 'act' ? { ok: false, error: '房间不存在' } : entered(req)));
    await ctl.createRoom();
    await ctl.act({ type: 'draw' });
    expect(ctl.code).toBeNull();
    expect(sessions[0].stop).toHaveBeenCalled();
    expect(ticker.stop).toHaveBeenCalled();
    expect(store.lastRoom()).toBeNull();
  });

  it('在首页加入失败（房间不存在）时忘掉上次的房间；网络错误时保留', async () => {
    const gone = setup(() => ({ ok: false, error: '房间不存在' }));
    gone.store.setLastRoom('1234');
    await gone.ctl.joinRoom('1234');
    expect(gone.toast).toHaveBeenCalledWith('房间不存在');
    expect(gone.ctl.code).toBeNull();
    expect(gone.store.lastRoom()).toBeNull();

    const offline = setup(() => ({ ok: false, error: '网络不稳定，正在重试', network: true }));
    offline.store.setLastRoom('1234');
    await offline.ctl.joinRoom('1234');
    expect(offline.store.lastRoom()).toBe('1234');
  });

  it('调换座位发送新的顺序', async () => {
    const { ctl, api, sessions } = setup(entered);
    await ctl.createRoom();
    sessions[0].room = lobbyRoom(3);
    await ctl.moveSeat(2, -1);
    expect(api.call).toHaveBeenLastCalledWith({ type: 'reorderSeats', code: '1234', order: ['u0', 'u2', 'u1'] });
    await ctl.moveSeat(0, -1);
    expect(api.call).toHaveBeenCalledTimes(2);
  });

  it('游戏进行中把截止时间交给 ticker；大厅里为 null', async () => {
    const { ctl, sessions, ticker } = setup(entered);
    await ctl.createRoom();
    sessions[0].room = lobbyRoom(2);
    sessions[0].onChange();
    expect(ticker.update).toHaveBeenLastCalledWith(null);
    sessions[0].room = roomOf(newState(5));
    sessions[0].onChange();
    expect(ticker.update).toHaveBeenLastCalledWith(1_800_000_090_000);
  });

  it('座位里没有我时提示并回首页', async () => {
    const { ctl, toast, sessions } = setup((req) => ({ ok: true, data: { code: '1234', openid: 'someone-else' } }));
    await ctl.createRoom();
    sessions[0].room = lobbyRoom(2);
    sessions[0].onChange();
    expect(toast).toHaveBeenCalledWith('你已不在这个房间里');
    expect(ctl.code).toBeNull();
  });

  it('昵称需要 1–12 个字', () => {
    const { ctl, toast } = setup(entered);
    expect(ctl.setNickname('   ')).toBe(false);
    expect(ctl.setNickname('一二三四五六七八九十一二三')).toBe(false);
    expect(toast).toHaveBeenCalledWith('昵称需要 1–12 个字');
    expect(ctl.setNickname(' 阿花 ')).toBe(true);
    expect(ctl.nickname).toBe('阿花');
  });

  it('onShow 时重新读取数据', async () => {
    const { ctl, sessions } = setup(entered);
    await ctl.createRoom();
    ctl.onShow();
    await flush();
    expect(sessions[0].refresh).toHaveBeenCalled();
  });

  it('房间信息还没到时离开会发请求，成功后回首页', async () => {
    const { ctl, api, store, sessions, ticker } = setup((req) => (req.type === 'leaveRoom' ? { ok: true, data: {} } : entered(req)));
    await ctl.createRoom();
    // sessions[0].room 还是 null（房间信息尚未到达）
    await ctl.leaveRoom();
    expect(api.call).toHaveBeenLastCalledWith({ type: 'leaveRoom', code: '1234' });
    expect(ctl.code).toBeNull();
    expect(sessions[0].stop).toHaveBeenCalled();
    expect(ticker.stop).toHaveBeenCalled();
    expect(store.lastRoom()).toBeNull();
  });

  it('离开大厅的请求失败（网络错误）时留在房间里', async () => {
    const { ctl, api, toast, store, sessions } = setup((req) =>
      req.type === 'leaveRoom' ? { ok: false, error: '网络不稳定，正在重试' } : entered(req),
    );
    await ctl.createRoom();
    sessions[0].room = lobbyRoom(2);
    await ctl.leaveRoom();
    expect(api.call).toHaveBeenLastCalledWith({ type: 'leaveRoom', code: '1234' });
    expect(toast).toHaveBeenCalledWith('网络不稳定，正在重试');
    expect(ctl.code).toBe('1234');
    expect(sessions[0].stop).not.toHaveBeenCalled();
    expect(store.lastRoom()).toBe('1234');
  });

  it('游戏进行中离开房间不发请求，直接回首页', async () => {
    const { ctl, api, sessions, ticker } = setup(entered);
    await ctl.createRoom();
    sessions[0].room = roomOf(newState(5));
    const before = api.call.mock.calls.length;
    await ctl.leaveRoom();
    expect(api.call).toHaveBeenCalledTimes(before);
    expect(ctl.code).toBeNull();
    expect(sessions[0].stop).toHaveBeenCalled();
    expect(ticker.stop).toHaveBeenCalled();
  });

  it('addBot 发送 addBots 请求', async () => {
    const { ctl, api } = setup(entered);
    await ctl.createRoom();
    await ctl.addBot();
    expect(api.call).toHaveBeenLastCalledWith({ type: 'addBots', code: '1234', count: 1 });
  });

  it('startGame 发送 startGame 请求', async () => {
    const { ctl, api } = setup(entered);
    await ctl.createRoom();
    await ctl.startGame();
    expect(api.call).toHaveBeenLastCalledWith({ type: 'startGame', code: '1234' });
  });
});
