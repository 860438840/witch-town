import { describe, expect, it } from 'vitest';
import { createGame, seededRng } from '../../engine/src/index';
import { BOT_TURN_MS, CHOICE_MS, deadlineKey, phaseDuration, TURN_MS } from '../src/deadlines';

function game(openids = ['u0', 'u1', 'u2', 'u3', 'u4']) {
  return createGame(openids.map((openid) => ({ openid, name: openid })), seededRng(1));
}

describe('deadlineKey', () => {
  it('白天按回合区分，同一回合内出牌不改变', () => {
    const s = game();
    s.phase = { kind: 'day', mode: 'choose' };
    s.turn = 2;
    expect(deadlineKey(s)).toBe('day:2:0');
    s.phase = { kind: 'day', mode: 'playing' };
    expect(deadlineKey(s)).toBe('day:2:0');
    s.turn = 3;
    expect(deadlineKey(s)).toBe('day:3:0');
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

  it('其他阶段', () => {
    const s = game();
    expect(deadlineKey(s)).toBe('dawn');
    s.phase = { kind: 'trialReveal', target: 3, initiator: 2 };
    expect(deadlineKey(s)).toBe('trial:3');
    s.phase = { kind: 'catReveal', holder: 1 };
    expect(deadlineKey(s)).toBe('cat:1');
    s.phase = { kind: 'night' };
    expect(deadlineKey(s)).toBe('night');
    s.phase = { kind: 'conspiracyPick' };
    expect(deadlineKey(s)).toBe('conspiracyPick');
  });
});

describe('phaseDuration', () => {
  it('真人回合 90 秒，机器人回合 3 秒，其他选择 45 秒', () => {
    const s = game(['u0', 'bot-1', 'u2', 'u3', 'u4']);
    expect(phaseDuration(s)).toBe(CHOICE_MS);
    s.phase = { kind: 'day', mode: 'choose' };
    s.turn = 0;
    expect(phaseDuration(s)).toBe(TURN_MS);
    s.turn = 1;
    expect(phaseDuration(s)).toBe(BOT_TURN_MS);
    expect([TURN_MS, BOT_TURN_MS, CHOICE_MS]).toEqual([90_000, 3_000, 45_000]);
  });
});
