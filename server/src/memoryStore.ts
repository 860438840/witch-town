import type { Store, Tx } from './store';

/** 测试用内存数据库。数据以 JSON 字符串保存，保证写入的内容可以序列化；事务失败时回滚。 */
export class MemoryStore implements Store {
  private docs = new Map<string, string>();

  private key(collection: string, id: string): string {
    return `${collection}/${id}`;
  }

  read<T>(collection: string, id: string): T | null {
    const raw = this.docs.get(this.key(collection, id));
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  write(collection: string, id: string, data: object): void {
    this.docs.set(this.key(collection, id), JSON.stringify(data));
  }

  async transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
    const snapshot = new Map(this.docs);
    const tx: Tx = {
      get: async <T>(collection: string, id: string) => this.read<T>(collection, id),
      set: async (collection: string, id: string, data: object) => this.write(collection, id, data),
    };
    try {
      return await fn(tx);
    } catch (e) {
      this.docs = snapshot;
      throw e;
    }
  }
}
