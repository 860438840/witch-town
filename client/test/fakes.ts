import type { Ctx } from '../src/core/node';

/** 假的 Canvas 上下文：所有方法都是空函数，measureText 按每字 10px 计算，fillText 记录文字 */
export function fakeCtx(): { ctx: Ctx; texts: string[] } {
  const texts: string[] = [];
  const gradient = { addColorStop() {} };
  const base: Record<string, unknown> = {
    measureText: (s: string) => ({ width: [...s].length * 10 }),
    fillText: (s: string) => {
      texts.push(s);
    },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  const ctx = new Proxy(base, {
    get: (t, k) => (k in t ? t[k as string] : () => {}),
    set: (t, k, v) => {
      t[k as string] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as Ctx, texts };
}
