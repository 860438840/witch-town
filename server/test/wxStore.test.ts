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

  it('其他错误码（如 -502005 集合不存在）不当作「文档不存在」，原样抛出（F11）', async () => {
    const err = { errCode: -502005, errMsg: 'collection not exists' };
    const db = {
      async runTransaction(cb: (t: unknown) => Promise<unknown>) {
        const t = {
          collection: () => ({
            doc: () => ({
              async get() {
                throw err;
              },
            }),
          }),
        };
        return cb(t);
      },
    };
    await expect(wxStore(db).transaction((tx) => tx.get('rooms', '1234'))).rejects.toBe(err);
  });

  it('SDK 重试事务回调：第一次业务逻辑抛错、第二次成功后，不会用第一次的旧错误掩盖最终结果（F12）', async () => {
    let cbCalls = 0;
    const finalError = new Error('提交冲突，事务最终失败');
    const fakeT = () => ({
      collection: () => ({
        doc: () => ({
          async get() {
            return { data: { _id: 'x' } };
          },
          async set() {},
        }),
      }),
    });
    const db = {
      async runTransaction(cb: (t: unknown) => Promise<unknown>) {
        // 模拟微信 SDK：第一次回调失败后自己重试，重试成功但提交阶段最终仍然失败
        try {
          await cb(fakeT());
        } catch {
          // SDK 内部吞掉第一次回调的错误，重试
        }
        await cb(fakeT());
        throw finalError;
      },
    };
    const store = wxStore(db);
    await expect(
      store.transaction(async () => {
        cbCalls++;
        if (cbCalls === 1) throw new RuleError('第一次冲突');
        return 'ok';
      }),
    ).rejects.toBe(finalError);
    expect(cbCalls).toBe(2);
  });
});
