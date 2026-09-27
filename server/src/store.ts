/** 事务内的数据库操作 */
export interface Tx {
  /** 文档不存在时返回 null；返回的数据不含 _id */
  get<T>(collection: string, id: string): Promise<T | null>;
  /** 整体覆盖写入（不存在则创建） */
  set(collection: string, id: string, data: object): Promise<void>;
}

export interface Store {
  /** fn 抛出异常时，事务内的所有写入都会回滚，并原样抛出该异常 */
  transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R>;
}
