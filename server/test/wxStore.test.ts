import { describe, expect, it } from 'vitest';
import { RuleError } from '../../engine/src/index';
import { wxStore } from '../src/wxStore';

type Docs = Record<string, Record<string, unknown>>;

function fakeDb(docs: Docs, wrapErrors = false) {
  return {
    async runTransaction(cb: (t: unknown) => Promise<unknown>) {
      const t = {
        collection: (c: string) => ({
          doc: (id: string) => ({
            async get() {
              const d = docs[`${c}/${id}`];
              if (!d) throw { errCode: -502004, errMsg: `document.get:fail document with _id ${id} does not exist` };
              return { data: { _id: id, ...d } };
            },
            async set({ data }: { data: Record<string, unknown> }) {
              docs[`${c}/${id}`] = data;
            },
          }),
        }),
      };
      try {
        return await cb(t);
      } catch (e) {
        if (wrapErrors) throw new Error('transaction aborted');
        throw e;
      }
    },
  };
}

describe('wxStore', () => {
  it('get 去掉 _id；文档不存在时返回 null；set 写入 data', async () => {
    const docs: Docs = { 'rooms/1234': { code: '1234' } };
    const store = wxStore(fakeDb(docs));
    const result = await store.transaction(async (tx) => {
      const a = await tx.get('rooms', '1234');
      const b = await tx.get('rooms', '9999');
      await tx.set('rooms', '5678', { code: '5678' });
      return { a, b };
    });
    expect(result).toEqual({ a: { code: '1234' }, b: null });
    expect(docs['rooms/5678']).toEqual({ code: '5678' });
  });

  it('其他数据库错误原样抛出', async () => {
    const db = fakeDb({});
    db.runTransaction = async () => {
      throw new Error('network');
    };
    await expect(wxStore(db).transaction(async () => 1)).rejects.toThrow('network');
  });

  it('事务内抛出的 RuleError 即使被 SDK 包装，也原样抛给调用方', async () => {
    const err = new RuleError('房间不存在');
    await expect(
      wxStore(fakeDb({}, true)).transaction(async () => {
        throw err;
      }),
    ).rejects.toBe(err);
  });
});
