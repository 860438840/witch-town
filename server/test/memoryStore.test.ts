import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/memoryStore';

describe('MemoryStore', () => {
  it('写入后能读出；数据经过 JSON 序列化（undefined 字段被丢弃）', async () => {
    const store = new MemoryStore();
    await store.transaction((tx) => tx.set('c', 'a', { x: 1, y: undefined }));
    expect(store.read('c', 'a')).toEqual({ x: 1 });
    await store.transaction(async (tx) => {
      expect(await tx.get('c', 'a')).toEqual({ x: 1 });
    });
  });

  it('不存在的文档返回 null', async () => {
    const store = new MemoryStore();
    await store.transaction(async (tx) => {
      expect(await tx.get('c', 'nope')).toBeNull();
    });
  });

  it('事务抛错时回滚所有写入，并原样抛出错误', async () => {
    const store = new MemoryStore();
    store.write('c', 'keep', { v: 1 });
    const err = new Error('boom');
    await expect(
      store.transaction(async (tx) => {
        await tx.set('c', 'keep', { v: 2 });
        await tx.set('c', 'new', { v: 3 });
        throw err;
      }),
    ).rejects.toBe(err);
    expect(store.read('c', 'keep')).toEqual({ v: 1 });
    expect(store.read('c', 'new')).toBeNull();
  });
});
