import { describe, expect, it } from 'vitest';
import { RuleError, seededRng, targetCount, type GameState } from '../../engine/src/index';
import { BOT_TURN_MS, CHOICE_MS, PICK_MS, STORY_MS, TURN_MS } from '../src/deadlines';
import { act, startGame, tick } from '../src/game';
import { addBots } from '../src/lobby';
import { MemoryStore } from '../src/memoryStore';
import { GAMES, handId, HANDS, ROOMS, type GameDoc, type HandDoc, type RoomDoc } from '../src/types';
import { lobbyWith, mutateGame, NOW, run, skipCharacters } from './helpers';

const rng = () => seededRng(5);
const room = (store: MemoryStore, code: string) => store.read<RoomDoc>(ROOMS, code) as RoomDoc;
const game = (store: MemoryStore, code: string) => store.read<GameDoc>(GAMES, code) as GameDoc;

async function started(n = 5) {
  const { store, code } = await lobbyWith(n);
  await run(store, (tx) => startGame(tx, code, 'u0', NOW, rng()));
  await skipCharacters(store, code);
  return { store, code };
}

function witchOpenid(s: GameState): string {
  return s.players.find((p) => p.witchFaction)!.openid;
}

describe('startGame', () => {
  it('不到 7 人时先选角色：限时 30 秒，每人的手牌文档里有自己的 2 个候选', async () => {
    const { store, code } = await lobbyWith(5);
    await run(store, (tx) => startGame(tx, code, 'u0', NOW, rng()));
    const r = room(store, code);
    expect(r.view!.phase).toEqual({ kind: 'characterPick' });
    expect(r.deadline).toBe(NOW + PICK_MS);
    const offers = game(store, code).state.characterOffers;
    const hand = store.read<HandDoc>(HANDS, handId(code, 'u0'))!;
    expect(hand.view.pending).toEqual({ kind: 'characterPick', offers: offers[0] });
  });

  it('只有房主能开始，且至少 4 人', async () => {
    const small = await lobbyWith(3);
    await expect(run(small.store, (tx) => startGame(tx, small.code, 'u0', NOW, rng()))).rejects.toThrow('至少需要 4 名玩家');
    const ok = await lobbyWith(4);
    await expect(run(ok.store, (tx) => startGame(tx, ok.code, 'u1', NOW, rng()))).rejects.toThrow('房主');
  });

  it('开局后写入 games、rooms 公开视图和每个人的 hands；黎明截止时间为 45 秒', async () => {
    const { store, code } = await started(5);
    const r = room(store, code);
    expect(r.status).toBe('playing');
    expect(r.view!.players).toHaveLength(5);
    expect(r.view!.phase).toEqual({ kind: 'dawn' });
    expect(r.deadline).toBe(NOW + CHOICE_MS);
    const g = game(store, code);
    expect(g.state.players.map((p) => p.openid)).toEqual(['u0', 'u1', 'u2', 'u3', 'u4']);
    expect(g.deadline).toBe(NOW + CHOICE_MS);
    for (const p of g.state.players) {
      const hand = store.read<HandDoc>(HANDS, handId(code, p.openid))!;
      expect(hand._openid).toBe(p.openid);
      expect(hand.roomId).toBe(code);
      expect(hand.view.seat).toBe(p.seat);
      const json = JSON.stringify(hand.view);
      for (const q of g.state.players) {
        if (q.seat === p.seat) continue;
        for (const c of q.hand) expect(json).not.toContain(`"${c.id}"`);
      }
    }
  });

  it('不能重复开始', async () => {
    const { store, code } = await started(4);
    await expect(run(store, (tx) => startGame(tx, code, 'u0', NOW, rng()))).rejects.toThrow('游戏已经开始');
  });

  it('开局后房间和每份手牌都带有相同的 gameId，防止房间号复用后读到旧手牌（F7）', async () => {
    const { store, code } = await started(5);
    const r = room(store, code);
    expect(r.gameId).toBe(`${code}-${NOW}`);
    for (const p of game(store, code).state.players) {
      const hand = store.read<HandDoc>(HANDS, handId(code, p.openid))!;
      expect(hand.gameId).toBe(r.gameId);
    }
  });

  it('机器人不写入 hands 文档，真人正常写入（F9）', async () => {
    const { store, code } = await lobbyWith(1);
    await run(store, (tx) => addBots(tx, code, 'u0', 4, NOW));
    await run(store, (tx) => startGame(tx, code, 'u0', NOW, rng()));
    expect(store.read(HANDS, handId(code, 'u0'))).not.toBeNull();
    for (let i = 1; i <= 4; i++) {
      expect(store.read(HANDS, handId(code, `bot-${i}`))).toBeNull();
    }
  });
});

describe('act', () => {
  it('女巫在黎明投票放黑猫后进入白天，版本号 +1', async () => {
    const { store, code } = await started(5);
    const witch = witchOpenid(game(store, code).state);
    const res = await run(store, (tx) => act(tx, code, witch, { type: 'witchVote', target: 2 }, 0, NOW + 1000, rng()));
    expect(res).toEqual({ version: 1 });
    expect(room(store, code).view!.phase.kind).toBe('day');
    expect(room(store, code).view!.version).toBe(1);
  });

  it('客户端伪造的 seat 被忽略，按请求者本人的座位执行', async () => {
    const { store, code } = await started(5);
    const s = game(store, code).state;
    const witch = s.players.find((p) => p.witchFaction)!;
    const villager = s.players.find((p) => !p.witchFaction)!;
    await expect(
      run(store, (tx) =>
        act(tx, code, villager.openid, { type: 'witchVote', target: 2, seat: witch.seat } as never, undefined, NOW, rng()),
      ),
    ).rejects.toThrow('只有女巫阵营可以投票');
  });

  it('不在游戏中的人不能操作', async () => {
    const { store, code } = await started(4);
    await expect(run(store, (tx) => act(tx, code, 'stranger', { type: 'draw' }, undefined, NOW, rng()))).rejects.toThrow(
      '你不在这局游戏中',
    );
  });

  it('版本号过期时拒绝，且数据库不变', async () => {
    const { store, code } = await started(5);
    const witch = witchOpenid(game(store, code).state);
    await expect(
      run(store, (tx) => act(tx, code, witch, { type: 'witchVote', target: 2 }, 7, NOW, rng())),
    ).rejects.toThrow('状态已变化，请重试');
    expect(game(store, code).state.version).toBe(0);
  });

  it('规则不允许的操作报错，且数据库不变', async () => {
    const { store, code } = await started(5);
    await expect(run(store, (tx) => act(tx, code, 'u1', { type: 'draw' }, undefined, NOW, rng()))).rejects.toThrow(RuleError);
    expect(room(store, code).view!.version).toBe(0);
  });

  it('同一回合内出牌不重置截止时间；换人后重新计时', async () => {
    const { store, code } = await started(5);
    const witch = witchOpenid(game(store, code).state);
    const t1 = NOW + 1000;
    await run(store, (tx) => act(tx, code, witch, { type: 'witchVote', target: 2 }, undefined, t1, rng()));
    expect(room(store, code).deadline).toBe(t1 + TURN_MS);
    const s = game(store, code).state;
    const me = s.players[s.turn];
    const card = me.hand.find((c) => c.kind !== 'curse' && c.kind !== 'witness')!;
    const others = s.players.filter((p) => p.seat !== me.seat).map((p) => p.seat);
    const targets = others.slice(0, targetCount(card.kind));
    const t2 = t1 + 5000;
    await run(store, (tx) => act(tx, code, me.openid, { type: 'play', cardId: card.id, targets }, undefined, t2, rng()));
    expect(room(store, code).view!.phase.kind).toBe('day');
    expect(room(store, code).deadline).toBe(t1 + TURN_MS);
  });
});

describe('act 拒绝伪造的操作参数（F1）', () => {
  const exploits: Array<[string, unknown]> = [
    ['嫁祸用字符串复制座位', { type: 'play', cardId: 'scapegoat-1', targets: [0, '0'] }],
    ['警长保护目标是字符串', { type: 'protect', target: '4' }],
    ['女巫投票目标是字符串', { type: 'witchVote', target: '0' }],
    ['抢劫用字符串座位', { type: 'play', cardId: 'robbery-1', targets: ['1', 2] }],
    ['传染选号是字符串', { type: 'conspiracyPick', index: '0' }],
  ];

  it.each(exploits)('%s 被拒绝，且数据库不变', async (_label, action) => {
    const { store, code } = await started(5);
    await expect(run(store, (tx) => act(tx, code, 'u0', action as never, undefined, NOW, rng()))).rejects.toThrow(
      '操作参数无效',
    );
    expect(game(store, code).state.version).toBe(0);
    expect(room(store, code).view!.version).toBe(0);
  });
});

describe('tick', () => {
  it('截止时间之前调用什么都不做', async () => {
    const { store, code } = await started(5);
    await expect(run(store, (tx) => tick(tx, code, NOW + CHOICE_MS - 1, rng()))).resolves.toEqual({ changed: false });
    expect(game(store, code).state.version).toBe(0);
  });

  it('超时后执行默认操作：黎明自动放黑猫', async () => {
    const { store, code } = await started(5);
    const t = NOW + CHOICE_MS;
    await expect(run(store, (tx) => tick(tx, code, t, rng()))).resolves.toEqual({ changed: true });
    expect(room(store, code).view!.phase.kind).toBe('day');
    expect(room(store, code).deadline).toBeGreaterThan(t);
  });

  it('轮到机器人时只等 3 秒', async () => {
    const { store, code } = await lobbyWith(1);
    await run(store, (tx) => addBots(tx, code, 'u0', 4, NOW));
    await run(store, (tx) => startGame(tx, code, 'u0', NOW, rng()));
    await run(store, (tx) => tick(tx, code, NOW + PICK_MS, rng()));
    const t = NOW + PICK_MS + CHOICE_MS;
    await run(store, (tx) => tick(tx, code, t, rng()));
    const s = game(store, code).state;
    const expected = s.players[s.turn].openid.startsWith('bot-') ? BOT_TURN_MS : TURN_MS;
    expect(room(store, code).deadline).toBe(t + expected);
  });

  it('1 个真人 + 4 个机器人全靠超时也能打完一局，结束后房间状态为 ended', async () => {
    const { store, code } = await lobbyWith(1);
    await run(store, (tx) => addBots(tx, code, 'u0', 4, NOW));
    await run(store, (tx) => startGame(tx, code, 'u0', NOW, rng()));
    let t = NOW;
    for (let i = 0; i < 5000 && room(store, code).status === 'playing'; i++) {
      t += TURN_MS;
      await run(store, (tx) => tick(tx, code, t, seededRng(i)));
    }
    const r = room(store, code);
    expect(r.status).toBe('ended');
    expect(r.deadline).toBeNull();
    expect(r.view!.phase.kind).toBe('ended');
  });
});

describe('隐私（F13）', () => {
  it('rooms 的公开视图里没有任何手牌 id，也没有未翻开身份卡的种类', async () => {
    const { store, code } = await started(5);
    let t = NOW;
    for (let i = 0; i < 10; i++) {
      t += TURN_MS;
      await run(store, (tx) => tick(tx, code, t, seededRng(i)));
      if (room(store, code).status !== 'playing') break;
    }
    const r = room(store, code);
    const g = game(store, code);
    const json = JSON.stringify(r);
    for (const p of g.state.players) {
      for (const c of p.hand) expect(json).not.toContain(`"${c.id}"`);
    }
    if (r.status !== 'ended') {
      for (let i = 0; i < g.state.players.length; i++) {
        for (let j = 0; j < g.state.players[i].tryals.length; j++) {
          if (!g.state.players[i].tryals[j].revealed) {
            expect(r.view!.players[i].tryals[j].kind).toBeNull();
          }
        }
      }
    }
  });
});

describe('说书人', () => {
  it('调整牌堆限时 2 分钟；牌堆顺序只写进说书人自己的手牌文档；回到回合后重新计 90 秒', async () => {
    const { store, code } = await started(5);
    const witch = witchOpenid(game(store, code).state);
    await run(store, (tx) => act(tx, code, witch, { type: 'witchVote', target: 2 }, undefined, NOW, rng()));
    await mutateGame(store, code, (s) => {
      s.players[s.turn].character = 'storyteller';
    });
    const s0 = game(store, code).state;
    const teller = s0.players[s0.turn];
    const t1 = NOW + 1000;
    await run(store, (tx) => act(tx, code, teller.openid, { type: 'storyStart' }, undefined, t1, rng()));
    expect(room(store, code).view!.phase).toEqual({ kind: 'storytelling', seat: teller.seat });
    expect(room(store, code).deadline).toBe(t1 + STORY_MS);

    const deckIds = game(store, code).state.deck.map((c) => c.id);
    const mine = JSON.stringify(store.read<HandDoc>(HANDS, handId(code, teller.openid)));
    for (const id of deckIds) expect(mine).toContain(`"${id}"`);
    const pub = JSON.stringify(room(store, code));
    for (const id of deckIds) expect(pub).not.toContain(`"${id}"`);
    for (const p of game(store, code).state.players) {
      if (p.seat === teller.seat) continue;
      const other = JSON.stringify(store.read<HandDoc>(HANDS, handId(code, p.openid)));
      for (const id of deckIds) expect(other).not.toContain(`"${id}"`);
    }

    const t2 = t1 + 100_000;
    const order = [...deckIds].reverse();
    await run(store, (tx) => act(tx, code, teller.openid, { type: 'storyReorder', order }, undefined, t2, rng()));
    expect(room(store, code).view!.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(room(store, code).deadline).toBe(t2 + TURN_MS);
    expect(game(store, code).state.deck.map((c) => c.id)).toEqual(order);
  });
});

describe('机器人选角色（F5）', () => {
  it('开局时机器人立刻选好角色，真人选完后进入黎明', async () => {
    const { store, code } = await lobbyWith(1);
    await run(store, (tx) => addBots(tx, code, 'u0', 4, NOW));
    await run(store, (tx) => startGame(tx, code, 'u0', NOW, rng()));
    const s = game(store, code).state;
    expect(s.phase.kind).toBe('characterPick');
    for (const p of s.players) expect(p.character !== null).toBe(p.openid.startsWith('bot-'));
    const me = s.players.findIndex((p) => p.openid === 'u0');
    await run(store, (tx) => act(tx, code, 'u0', { type: 'pickCharacter', index: 0 }, undefined, NOW + 1, rng()));
    expect(game(store, code).state.phase.kind).toBe('dawn');
    expect(game(store, code).state.players[me].character).not.toBeNull();
  });
});
