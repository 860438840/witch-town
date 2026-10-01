import { describe, expect, it } from 'vitest';
import { proceed } from '../src/flow';
import { seededRng } from '../src/rng';
import { allPick, fixedGame, quietNight, stackDeck } from './helpers';

// fixedGame：5 人；0 号是唯一女巫，1 号是警长，2–4 号是村民；轮到 2 号

describe('流程栈', () => {
  it('审判收尾后，如果这次打断里出现过夜晚，结束当前回合', () => {
    const s = fixedGame();
    s.players[3].red = [{ id: 'r1', kind: 'accusation', points: 1 }];
    s.steps.push({ kind: 'finishTrial', target: 3, initiator: 2 });
    s.endTurnAfter = true;
    proceed(s, seededRng(1));
    expect(s.players[3].red).toEqual([]);
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(s.endTurnAfter).toBe(false);
  });

  it('审判开始前被审判者已经死亡：取消审判，回到出牌模式', () => {
    const s = fixedGame();
    s.players[3].alive = false;
    s.steps.push({ kind: 'trial', target: 3, initiator: 2 });
    proceed(s, seededRng(1));
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(s.log.some((e) => e.t === 'trial')).toBe(false);
  });

  it('遇到需要玩家操作的阶段就停下，剩下的步骤保留', () => {
    const s = fixedGame();
    s.steps.push({ kind: 'finishTrial', target: 3, initiator: 2 }, { kind: 'trial', target: 4, initiator: 2 });
    proceed(s, seededRng(1));
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 4, initiator: 2 });
    expect(s.steps).toEqual([{ kind: 'finishTrial', target: 3, initiator: 2 }]);
  });

  it('回合外摸到普通牌：加入手牌，接着走下一步', () => {
    const s = fixedGame();
    stackDeck(s, ['alibi']);
    const before = s.players[4].hand.length;
    s.steps.push({ kind: 'finishTrial', target: 3, initiator: 2 }, { kind: 'draw', seat: 4 });
    proceed(s, seededRng(1));
    expect(s.players[4].hand).toHaveLength(before + 1);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(s.steps).toEqual([]);
  });

  it('回合外摸到夜晚：先走完剩下的流程，再进入夜晚；夜晚后结束当前回合', () => {
    let s = fixedGame();
    s.players[3].red = [{ id: 'r1', kind: 'accusation', points: 1 }];
    stackDeck(s, ['night']);
    s.steps.push({ kind: 'finishTrial', target: 3, initiator: 2 }, { kind: 'draw', seat: 4 });
    proceed(s, seededRng(1));
    expect(s.phase).toEqual({ kind: 'night' });
    // 审判收尾已经先做完：被审判者的红卡在夜晚开始前就进了弃牌堆
    expect(s.players[3].red).toEqual([]);
    expect(s.discard.map((c) => c.id)).toContain('r1');
    expect(s.steps).toEqual([]);
    s = quietNight(s);
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
    expect(s.steps).toEqual([]);
  });

  it('回合外摸到传染（没有黑猫）：立即盲抽，之后回到原流程，回合不结束', () => {
    let s = fixedGame();
    stackDeck(s, ['conspiracy']);
    s.steps.push({ kind: 'finishTrial', target: 3, initiator: 2 }, { kind: 'draw', seat: 4 });
    proceed(s, seededRng(1));
    expect(s.phase).toEqual({ kind: 'conspiracyPick' });
    s = allPick(s);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(s.turn).toBe(2);
    expect(s.steps).toEqual([]);
  });
});
