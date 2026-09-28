export type ApiResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string; network?: true };

export interface CloudLike {
  callFunction(o: { name: string; data: unknown }): Promise<{ result?: unknown }>;
}

export const NETWORK_ERROR = '网络不稳定，请稍后再试';

export class Api {
  constructor(private readonly cloud: CloudLike) {}

  async call<T = unknown>(data: Record<string, unknown>): Promise<ApiResult<T>> {
    try {
      const r = await this.cloud.callFunction({ name: 'game', data });
      const res = r.result as { ok?: unknown } | undefined;
      if (!res || typeof res !== 'object' || typeof res.ok !== 'boolean') {
        return { ok: false, error: '服务器没有响应', network: true };
      }
      return res as ApiResult<T>;
    } catch {
      return { ok: false, error: NETWORK_ERROR, network: true };
    }
  }
}
