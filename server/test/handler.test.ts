import { describe, expect, it, vi } from 'vitest';
import { seededRng } from '../../engine/src/index';
import { handle } from '../src/handler';
import { MemoryStore } from '../src/memoryStore';
import type { Store } from '../src/store';
import { ROOMS, type RoomDoc } from '../src/types';
import { NOW } from './helpers';

const call = (store: Store, openid: string, req: unknown) => handle(store, openid, req, NOW, seededRng(3));

describe('handle', () => {
  it('没有 openid 时拒绝', async () => {
    expect(await call(new MemoryStore(), '', { type: 'createRoom', profile: { name: 'A' } })).toEqual({
      ok: false,
      error: '未登录',
    });
  });

  it('建房并加入', async () => {
    const store = new MemoryStore();
    const created = await call(store, 'u0', { type: 'createRoom', profile: { name: 'A' } });
    expect(created.ok).toBe(true);
    const code = (created as { data: { code: string; openid: string } }).data.code;
    expect((created as { data: { code: string; openid: string } }).data.openid).toBe('u0');
    expect(await call(store, 'u1', { type: 'joinRoom', code, profile: { name: 'B' } })).toEqual({
      ok: true,
      data: { code, openid: 'u1' },
    });
    expect(store.read<RoomDoc>(ROOMS, code)!.seats).toHaveLength(2);
  });

  it('房间号格式不对、未知请求、规则错误都返回中文错误', async () => {
    const store = new MemoryStore();
    expect(await call(store, 'u0', { type: 'joinRoom', code: 'abc', profile: { name: 'A' } })).toEqual({
      ok: false,
      error: '房间号无效',
    });
    expect(await call(store, 'u0', { type: 'hack' })).toEqual({ ok: false, error: '未知请求' });
    expect(await call(store, 'u0', null)).toEqual({ ok: false, error: '未知请求' });
    expect(await call(store, 'u0', { type: 'joinRoom', code: '1234', profile: { name: 'A' } })).toEqual({
      ok: false,
      error: '房间不存在',
    });
  });

  it('非规则类异常返回通用错误并打印日志', async () => {
    const broken: Store = {
      transaction: async () => {
        throw new Error('db down');
      },
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await call(broken, 'u0', { type: 'createRoom', profile: { name: 'A' } })).toEqual({
      ok: false,
      error: '服务器错误，请稍后再试',
    });
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
