import type { HandDoc, RoomDoc } from '../../../server/src/types';
import type { Timers } from './timers';

export interface WatchHandle {
  close(): void;
}
interface WatchOpts {
  onChange(snap: { docs: unknown[] }): void;
  onError(e: unknown): void;
}
export interface DbLike {
  collection(name: string): {
    doc(id: string): { get(): Promise<{ data: unknown }>; watch(o: WatchOpts): WatchHandle };
    where(q: Record<string, unknown>): { watch(o: WatchOpts): WatchHandle };
  };
}

export const POLL_MS = 3000;
export const MAX_BACKOFF_MS = 30_000;
export const POLL_AFTER_FAILURES = 3;

const NOT_FOUND = /does not exist|DOCUMENT_NOT_EXIST|-502004/i;

function isNotFound(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String((e as { errMsg?: string } | null)?.errMsg ?? e);
  return NOT_FOUND.test(msg);
}

/**
 * 一个房间的实时数据：rooms/{code} 和我的 hands 文档。
 * 监听出错后按 1s、2s、4s… 最多 30s 退避重连；连续失败 3 次后改为每 3 秒读取一次，直到监听恢复。
 */
export class RoomSession {
  room: RoomDoc | null = null;
  hand: HandDoc | null = null;
  private watchers: WatchHandle[] = [];
  private gen = 0;
  private failures = 0;
  private retryTimer: unknown = null;
  private pollTimer: unknown = null;
  private stopped = false;

  constructor(
    private readonly db: DbLike,
    readonly code: string,
    private readonly openid: string,
    private readonly timers: Timers,
    private readonly onChange: () => void,
  ) {}

  start(): void {
    void this.refresh();
    this.watch();
  }

  stop(): void {
    this.stopped = true;
    this.closeWatchers();
    this.stopPolling();
    if (this.retryTimer !== null) {
      this.timers.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  async refresh(): Promise<void> {
    const [room, hand] = await Promise.all([
      this.getDoc<RoomDoc>('rooms', this.code),
      this.getDoc<HandDoc>('hands', `${this.code}_${this.openid}`),
    ]);
    if (this.stopped) return;
    if (room !== undefined) this.room = room;
    if (hand !== undefined) this.hand = hand;
    this.onChange();
  }

  /** 找不到文档返回 null；网络等其他错误返回 undefined（保留原数据） */
  private async getDoc<T>(coll: string, id: string): Promise<T | null | undefined> {
    try {
      const r = await this.db.collection(coll).doc(id).get();
      return (r.data as T) ?? null;
    } catch (e) {
      return isNotFound(e) ? null : undefined;
    }
  }

  private watch(): void {
    this.closeWatchers();
    const gen = this.gen;
    const onError = () => {
      if (gen === this.gen) this.fail();
    };
    this.watchers.push(
      this.db
        .collection('rooms')
        .doc(this.code)
        .watch({
          onChange: (snap) => {
            if (gen !== this.gen) return;
            this.room = (snap.docs[0] as RoomDoc | undefined) ?? null;
            this.ok();
          },
          onError,
        }),
      this.db
        .collection('hands')
        .where({ _openid: '{openid}', roomId: this.code })
        .watch({
          onChange: (snap) => {
            if (gen !== this.gen) return;
            this.hand = (snap.docs[0] as HandDoc | undefined) ?? null;
            this.ok();
          },
          onError,
        }),
    );
  }

  private closeWatchers(): void {
    this.gen++;
    for (const w of this.watchers) {
      try {
        w.close();
      } catch {
        // 关闭失败无所谓
      }
    }
    this.watchers = [];
  }

  private ok(): void {
    this.failures = 0;
    this.stopPolling();
    this.onChange();
  }

  private fail(): void {
    if (this.stopped) return;
    this.closeWatchers();
    this.failures++;
    if (this.failures >= POLL_AFTER_FAILURES) this.startPolling();
    if (this.retryTimer !== null) return;
    const delay = Math.min(1000 * 2 ** (this.failures - 1), MAX_BACKOFF_MS);
    this.retryTimer = this.timers.setTimeout(() => {
      this.retryTimer = null;
      if (!this.stopped) this.watch();
    }, delay);
  }

  private startPolling(): void {
    if (this.pollTimer !== null) return;
    const loop = () => {
      this.pollTimer = this.timers.setTimeout(async () => {
        await this.refresh();
        if (this.pollTimer !== null && !this.stopped) loop();
      }, POLL_MS);
    };
    loop();
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      this.timers.clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
