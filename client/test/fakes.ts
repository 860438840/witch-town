import type { Ctx } from '../src/core/node';
import type { Timers } from '../src/net/timers';
import type { DbLike } from '../src/net/session';

/**
 * 假的 Canvas 上下文：measureText 按每字 10px 计算，fillText 记录文字。
 * ops 按顺序记录属性赋值（`属性=值`）、方法调用（方法名）和 `fillText:文字`。
 */
export function fakeCtx(): { ctx: Ctx; texts: string[]; ops: string[] } {
  const texts: string[] = [];
  const ops: string[] = [];
  const gradient = { addColorStop() {} };
  const base: Record<string, unknown> = {
    measureText: (s: string) => ({ width: [...s].length * 10 }),
    fillText: (s: string) => {
      texts.push(s);
      ops.push(`fillText:${s}`);
    },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  const ctx = new Proxy(base, {
    get: (t, k) => (k in t ? t[k as string] : () => ops.push(String(k))),
    set: (t, k, v) => {
      t[k as string] = v;
      ops.push(`${String(k)}=${typeof v === 'string' || typeof v === 'number' ? v : '[object]'}`);
      return true;
    },
  });
  return { ctx: ctx as unknown as Ctx, texts, ops };
}

/** 等待已排队的 Promise 回调执行完 */
export const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** 手动推进的计时器 */
export class ManualTimers implements Timers {
  now = 0;
  private queue: { at: number; fn: () => void; id: number }[] = [];
  private seq = 0;

  setTimeout = (fn: () => void, ms: number): unknown => {
    const id = ++this.seq;
    this.queue.push({ at: this.now + ms, fn, id });
    return id;
  };

  clearTimeout = (id: unknown): void => {
    this.queue = this.queue.filter((t) => t.id !== id);
  };

  get pending(): number {
    return this.queue.length;
  }

  async advance(ms: number): Promise<void> {
    const end = this.now + ms;
    for (;;) {
      this.queue.sort((a, b) => a.at - b.at);
      const t = this.queue[0];
      if (!t || t.at > end) break;
      this.queue.shift();
      this.now = t.at;
      t.fn();
      await flush();
    }
    this.now = end;
    await flush();
  }
}

type WatchOpts = { onChange(snap: { docs: unknown[] }): void; onError(e: unknown): void };

/** 假的云数据库：记录监听器，可以手动推送数据或报错 */
export class FakeDb implements DbLike {
  docs = new Map<string, unknown>();
  getCalls = 0;
  failGets = false;
  /** 为 true 时 get 在调用时取好数据，但要等 releaseGets() 才返回 */
  holdGets = false;
  private held: (() => void)[] = [];
  private watchers: { coll: string; opts: WatchOpts; closed: boolean }[] = [];

  collection(coll: string) {
    return {
      doc: (id: string) => ({
        get: async () => {
          this.getCalls++;
          if (this.failGets) throw new Error('network error');
          const d = this.docs.get(`${coll}/${id}`);
          if (this.holdGets) await new Promise<void>((r) => this.held.push(r));
          if (d === undefined) throw new Error(`document.get:fail document with _id ${id} does not exist`);
          return { data: d };
        },
        watch: (opts: WatchOpts) => this.addWatch(coll, opts),
      }),
      where: (_q: Record<string, unknown>) => ({ watch: (opts: WatchOpts) => this.addWatch(coll, opts) }),
    };
  }

  private addWatch(coll: string, opts: WatchOpts) {
    const w = { coll, opts, closed: false };
    this.watchers.push(w);
    return {
      close: () => {
        w.closed = true;
      },
    };
  }

  releaseGets(): void {
    const held = this.held;
    this.held = [];
    for (const r of held) r();
  }

  live(coll: string): number {
    return this.watchers.filter((w) => w.coll === coll && !w.closed).length;
  }

  push(coll: string, doc: unknown): void {
    for (const w of this.watchers.filter((x) => x.coll === coll && !x.closed)) w.opts.onChange({ docs: doc ? [doc] : [] });
  }

  error(coll: string): void {
    for (const w of this.watchers.filter((x) => x.coll === coll && !x.closed)) w.opts.onError(new Error('socket closed'));
  }
}

/** 假的隐藏画布工厂：记录每次创建的像素尺寸和画布本身（释放时 width 会被设成 0） */
export function fakeSurfaces(): {
  factory: (w: number, h: number) => { canvas: CanvasImageSource; ctx: Ctx };
  created: [number, number][];
  canvases: { width: number; height: number }[];
} {
  const created: [number, number][] = [];
  const canvases: { width: number; height: number }[] = [];
  return {
    created,
    canvases,
    factory: (w, h) => {
      created.push([w, h]);
      const canvas = { width: w, height: h };
      canvases.push(canvas);
      return { canvas: canvas as unknown as CanvasImageSource, ctx: fakeCtx().ctx };
    },
  };
}
