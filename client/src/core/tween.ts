export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

interface Item {
  start: number;
  dur: number;
  data: unknown;
}

/** 按 key 管理的补间动画。progress 返回缓动后的 0→1；没有这个动画或已结束时返回 1。 */
export class Animator {
  private items = new Map<string, Item>();

  start(key: string, now: number, dur = 300, data?: unknown): void {
    this.items.set(key, { start: now, dur, data });
  }

  progress(key: string, now: number): number {
    const it = this.items.get(key);
    if (!it) return 1;
    const t = (now - it.start) / it.dur;
    return t >= 1 ? 1 : easeOutCubic(Math.max(0, t));
  }

  data<T>(key: string): T | undefined {
    return this.items.get(key)?.data as T | undefined;
  }

  running(key: string, now: number): boolean {
    const it = this.items.get(key);
    return !!it && now < it.start + it.dur;
  }

  /** 是否还有动画在进行；顺便清理已结束的动画 */
  active(now: number): boolean {
    let any = false;
    for (const [key, it] of this.items) {
      if (now >= it.start + it.dur) this.items.delete(key);
      else any = true;
    }
    return any;
  }

  keys(): string[] {
    return [...this.items.keys()];
  }
}
