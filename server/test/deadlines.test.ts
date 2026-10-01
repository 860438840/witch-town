import { describe, expect, it } from 'vitest';
import { createGame, seededRng, type GameState } from '../../engine/src/index';
import { BOT_TURN_MS, CHOICE_MS, deadlineKey, phaseDuration, PICK_MS, STORY_MS, TURN_MS } from '../src/deadlines';

function game(openids = ['u0', 'u1', 'u2', 'u3', 'u4']) {
  return createGame(openids.map((openid) => ({ openid, name: openid })), seededRng(1));
}

describe('deadlineKey', () => {
  it('白天按回合区分，同一回合内出牌不改变', () => {
    const s = game();
    s.phase = { kind: 'day', mode: 'choose' };
    s.turn = 2;
    expect(deadlineKey(s)).toBe('day:2:0:0');
    s.phase = { kind: 'day', mode: 'playing' };
    expect(deadlineKey(s)).toBe('day:2:0:0');
    s.turn = 3;
    expect(deadlineKey(s)).toBe('day:3:0:0');
  });

  it('说书人调整完牌堆回到回合时 key 变化（重新计时）', () => {
    const s = game();
    s.phase = { kind: 'day', mode: 'choose' };
    s.turn = 2;
    const before = deadlineKey(s);
    s.phase = { kind: 'storytelling', seat: 2 };
    expect(deadlineKey(s)).toBe('storytelling');
    s.log.push({ t: 'ability', seat: 2, ability: 'storyteller' });
    s.phase = { kind: 'day', mode: 'choose' };
    expect(deadlineKey(s)).not.toBe(before);
  });

  it('说书人调整牌堆限时 2 分钟', () => {
    const s = game();
    s.phase = { kind: 'storytelling', seat: 1 };
    expect(phaseDuration(s)).toBe(STORY_MS);
    expect(STORY_MS).toBe(120_000);
  });

  it('同一座位连续两次回合（例如只剩 2 人存活，另一人被拘留）时 key 不同（F4）', () => {
    const s = game();
    s.phase = { kind: 'day', mode: 'choose' };
    s.turn = 2;
    s.log.push({ t: 'turn', seat: 2 });
    const key1 = deadlineKey(s);
    s.log.push({ t: 'turn', seat: 2 });
    const key2 = deadlineKey(s);
    expect(key1).not.toBe(key2);
  });

  it('连续两个夜晚的 key 不同（按已结算的夜晚数）', () => {
    const s = game();
    s.phase = { kind: 'night' };
    const first = deadlineKey(s);
    s.log.push({ t: 'nightResult', target: 2, died: false });
    expect(deadlineKey(s)).not.toBe(first);
  });

  it('其他阶段', () => {
    const s = game();
    expect(deadlineKey(s)).toBe('characterPick');
    s.phase = { kind: 'dawn' };
    expect(deadlineKey(s)).toBe('dawn');
    s.phase = { kind: 'trialReveal', target: 3, initiator: 2 };
    expect(deadlineKey(s)).toBe('trial:3');
    s.phase = { kind: 'catReveal', holder: 1 };
    expect(deadlineKey(s)).toBe('cat:1');
    s.phase = { kind: 'night' };
    expect(deadlineKey(s)).toBe('night:0');
    s.phase = { kind: 'conspiracyPick' };
    expect(deadlineKey(s)).toBe('conspiracyPick');
  });
});

describe('phaseDuration', () => {
  it('真人回合 90 秒，机器人回合 3 秒，其他选择 45 秒', () => {
    const s = game(['u0', 'bot-1', 'u2', 'u3', 'u4']);
    expect(phaseDuration(s)).toBe(PICK_MS);
    s.phase = { kind: 'dawn' };
    expect(phaseDuration(s)).toBe(CHOICE_MS);
    s.phase = { kind: 'day', mode: 'choose' };
    s.turn = 0;
    expect(phaseDuration(s)).toBe(TURN_MS);
    s.turn = 1;
    expect(phaseDuration(s)).toBe(BOT_TURN_MS);
    expect([TURN_MS, BOT_TURN_MS, CHOICE_MS, PICK_MS]).toEqual([90_000, 3_000, 45_000, 30_000]);
  });
});

describe('只等机器人时只等 3 秒', () => {
  // 0 号是真人，其余是机器人
  const mixed = () => game(['u0', 'bot-1', 'bot-2', 'bot-3', 'bot-4']);
  const night = (s: GameState) => {
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {}, silent: [] };
    return s;
  };

  it('黑猫持有者、受审者是机器人：3 秒；是真人：45 秒', () => {
    const s = mixed();
    s.phase = { kind: 'catReveal', holder: 1 };
    expect(phaseDuration(s)).toBe(BOT_TURN_MS);
    s.phase = { kind: 'trialReveal', target: 2, initiator: 0 };
    expect(phaseDuration(s)).toBe(BOT_TURN_MS);
    s.phase = { kind: 'catReveal', holder: 0 };
    expect(phaseDuration(s)).toBe(CHOICE_MS);
  });

  it('传染盲抽：真人还没抽时 45 秒；真人抽完只剩机器人时 key 变化、改为 3 秒', () => {
    const s = mixed();
    s.phase = { kind: 'conspiracyPick' };
    s.conspiracyPicks = {};
    expect(phaseDuration(s)).toBe(CHOICE_MS);
    const before = deadlineKey(s);
    s.conspiracyPicks = { 0: 0 };
    expect(phaseDuration(s)).toBe(BOT_TURN_MS);
    expect(deadlineKey(s)).not.toBe(before);
  });

  it('夜晚：真人还没自首时 45 秒；真人做完（女巫也投了票）只剩机器人时 3 秒', () => {
    const s = night(mixed());
    expect(phaseDuration(s)).toBe(CHOICE_MS);
    s.night!.confessions[0] = null;
    if (s.players[0].witchFaction) s.night!.witchVotes[0] = 2;
    if (s.players[0].tryals.some((t) => t.kind === 'constable')) s.night!.protect = 2;
    expect(phaseDuration(s)).toBe(BOT_TURN_MS);
  });

  it('全是真人的局不受影响', () => {
    const s = game();
    s.phase = { kind: 'catReveal', holder: 1 };
    expect(phaseDuration(s)).toBe(CHOICE_MS);
    expect(deadlineKey(s)).toBe('cat:1');
  });
});
