import { projectPrivate, projectPublic, seededRng, type GameState } from '../../engine/src/index';
import { CHOICE_MS } from '../src/deadlines';
import { createRoom, joinRoom } from '../src/lobby';
import { MemoryStore } from '../src/memoryStore';
import type { Tx } from '../src/store';
import { GAMES, handId, HANDS, isBot, ROOMS, type GameDoc, type HandDoc, type RoomDoc } from '../src/types';

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

/** 直接改写局面，并同步 rooms 视图和每人的 hands（测试专用）。deadline 不传时保持原截止时间。 */
export async function mutateGame(
  store: MemoryStore,
  code: string,
  fn: (s: GameState) => void,
  deadline?: { key: string; at: number },
): Promise<void> {
  await run(store, async (tx) => {
    const g = (await tx.get<GameDoc>(GAMES, code)) as GameDoc;
    fn(g.state);
    if (deadline) {
      g.deadlineKey = deadline.key;
      g.deadline = deadline.at;
    }
    await tx.set(GAMES, code, g);
    const room = (await tx.get<RoomDoc>(ROOMS, code)) as RoomDoc;
    await tx.set(ROOMS, code, { ...room, view: projectPublic(g.state), deadline: g.deadline });
    for (const p of g.state.players) {
      if (isBot(p.openid)) continue;
      const hand = (await tx.get<HandDoc>(HANDS, handId(code, p.openid))) as HandDoc;
      await tx.set(HANDS, handId(code, p.openid), { ...hand, view: projectPrivate(g.state, p.seat) });
    }
  });
}

/** 跳过选角色：去掉角色、直接进入第一夜，截止时间设为 NOW + 45 秒（大多数测试不关心角色） */
export function skipCharacters(store: MemoryStore, code: string): Promise<void> {
  return mutateGame(
    store,
    code,
    (s) => {
      for (const p of s.players) p.character = null;
      s.characterOffers = {};
      s.log = s.log.filter((e) => e.t !== 'character');
      s.phase = { kind: 'dawn' };
    },
    { key: 'dawn', at: NOW + CHOICE_MS },
  );
}
