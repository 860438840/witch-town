import type { Store, Tx } from './store';

/** 云数据库「文档不存在」报错的特征。Task 5 在真实环境确认后按实际报错调整。 */
export const NOT_FOUND = /does not exist|not exist|DOCUMENT_NOT_EXIST|-502004/i;

function errorText(e: unknown): string {
  const err = e as { errCode?: unknown; errMsg?: unknown; message?: unknown };
  return [err?.errCode, err?.errMsg, err?.message, String(e)].filter((x) => x !== undefined).join(' ');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function wxStore(db: any): Store {
  return {
    async transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
      let thrown: unknown = undefined;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return await db.runTransaction(async (t: any) => {
          const tx: Tx = {
            async get<T>(collection: string, id: string): Promise<T | null> {
              try {
                const res = await t.collection(collection).doc(id).get();
                const { _id, ...rest } = res.data;
                return rest as T;
              } catch (e) {
                if (NOT_FOUND.test(errorText(e))) return null;
                throw e;
              }
            },
            async set(collection: string, id: string, data: object): Promise<void> {
              await t.collection(collection).doc(id).set({ data });
            },
          };
          try {
            return await fn(tx);
          } catch (e) {
            thrown = e;
            throw e;
          }
        });
      } catch (e) {
        // SDK 可能把回调里抛出的错误包装成别的对象，这里恢复成原始错误（例如 RuleError）
        throw thrown ?? e;
      }
    },
  };
}
