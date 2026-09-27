import { RuleError, type Rng } from '../../engine/src/index';
import { act, startGame, tick } from './game';
import { addBots, createRoom, joinRoom, leaveRoom, reorderSeats } from './lobby';
import type { Store } from './store';

export type Request =
  | { type: 'createRoom'; profile: unknown }
  | { type: 'joinRoom'; code: string; profile: unknown }
  | { type: 'leaveRoom'; code: string }
  | { type: 'reorderSeats'; code: string; order: string[] }
  | { type: 'addBots'; code: string; count: number }
  | { type: 'startGame'; code: string }
  | { type: 'act'; code: string; action: unknown; version?: number }
  | { type: 'tick'; code: string };

export type Response = { ok: true; data: unknown } | { ok: false; error: string };

function checkCode(code: unknown): string {
  if (typeof code !== 'string' || !/^\d{4}$/.test(code)) throw new RuleError('房间号无效');
  return code;
}

export async function handle(store: Store, openid: string, input: unknown, now: number, rng: Rng): Promise<Response> {
  if (!openid) return { ok: false, error: '未登录' };
  const req = (input ?? {}) as Request;
  try {
    const data = await store.transaction(async (tx) => {
      switch (req.type) {
        case 'createRoom':
          return createRoom(tx, openid, req.profile, now, rng);
        case 'joinRoom':
          return joinRoom(tx, checkCode(req.code), openid, req.profile, now);
        case 'leaveRoom':
          return leaveRoom(tx, checkCode(req.code), openid, now);
        case 'reorderSeats':
          return reorderSeats(tx, checkCode(req.code), openid, req.order, now);
        case 'addBots':
          return addBots(tx, checkCode(req.code), openid, Number(req.count) || 0, now);
        case 'startGame':
          return startGame(tx, checkCode(req.code), openid, now, rng);
        case 'act':
          return act(tx, checkCode(req.code), openid, req.action, req.version, now, rng);
        case 'tick':
          return tick(tx, checkCode(req.code), now, rng);
        default:
          throw new RuleError('未知请求');
      }
    });
    return { ok: true, data };
  } catch (e) {
    if (e instanceof RuleError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: '服务器错误，请稍后再试' };
  }
}
