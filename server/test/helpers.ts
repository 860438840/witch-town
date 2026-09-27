import { seededRng } from '../../engine/src/index';
import { createRoom, joinRoom } from '../src/lobby';
import { MemoryStore } from '../src/memoryStore';
import type { Tx } from '../src/store';

export const NOW = 1_800_000_000_000;

export const profile = (name: string) => ({ name, avatar: '' });

export function run<R>(store: MemoryStore, fn: (tx: Tx) => Promise<R>): Promise<R> {
  return store.transaction(fn);
}

/** u0 建房，u1…u(n-1) 依次加入 */
export async function lobbyWith(n: number): Promise<{ store: MemoryStore; code: string }> {
  const store = new MemoryStore();
  const { code } = await run(store, (tx) => createRoom(tx, 'u0', profile('P0'), NOW, seededRng(1)));
  for (let i = 1; i < n; i++) {
    await run(store, (tx) => joinRoom(tx, code, `u${i}`, profile(`P${i}`), NOW));
  }
  return { store, code };
}
