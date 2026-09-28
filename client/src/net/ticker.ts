import type { Timers } from './timers';

export const TICK_JITTER_MS = 1500;
export const TICK_RETRY_MS = 3000;

export interface TickerDeps {
  now(): number;
  random(): number;
  timers: Timers;
  tick(): Promise<unknown>;
}

/**
 * 倒计时结束后请求服务器推进。随机等待 0–1.5 秒，避免所有手机同时请求；
 * 同一时间最多一个请求；截止时间没变（说明还没推进成功）就每 3 秒重试。
 */
export class Ticker {
  private deadline: number | null = null;
  private timer: unknown = null;
  private inflight = false;

  constructor(private readonly deps: TickerDeps) {}

  update(deadline: number | null): void {
    if (deadline === this.deadline) return;
    this.deadline = deadline;
    this.clear();
    if (deadline !== null) {
      this.schedule(Math.max(0, deadline - this.deps.now()) + this.deps.random() * TICK_JITTER_MS);
    }
  }

  stop(): void {
    this.deadline = null;
    this.clear();
  }

  private schedule(ms: number): void {
    this.timer = this.deps.timers.setTimeout(() => {
      this.timer = null;
      void this.fire();
    }, ms);
  }

  private async fire(): Promise<void> {
    const d = this.deadline;
    if (d === null) return;
    if (this.inflight) {
      this.schedule(TICK_RETRY_MS);
      return;
    }
    this.inflight = true;
    try {
      await this.deps.tick();
    } catch {
      // tick 的错误一律忽略
    } finally {
      this.inflight = false;
    }
    if (this.deadline === d && this.timer === null) this.schedule(TICK_RETRY_MS);
  }

  private clear(): void {
    if (this.timer !== null) {
      this.deps.timers.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
