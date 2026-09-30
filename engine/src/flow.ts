import { beginPicks, startConspiracy } from './conspiracy';
import { startNight } from './night';
import type { Rng } from './rng';
import { getPlayer, isEnded, setPhase } from './state';
import { finishTrial } from './trial';
import { drawOne, endTurn, resumeDrawing } from './turn';
import type { Card, GameState, Step } from './types';

/** 一个流程步骤的结果：paused = 进入了需要玩家操作的阶段 */
export type StepResult = 'done' | 'paused';

/**
 * 依次执行被打断后要继续的流程。遇到需要玩家操作的阶段就停下，
 * 等那个操作完成后再调用本函数；全部走完后，如果这次打断中出现过夜晚，结束当前回合。
 */
export function proceed(s: GameState, rng: Rng): void {
  while (!isEnded(s)) {
    const step = s.steps.pop();
    if (!step) break;
    if (runStep(s, step, rng) === 'paused') return;
  }
  if (isEnded(s)) return;
  if (s.endTurnAfter) {
    s.endTurnAfter = false;
    endTurn(s);
  }
}

function runStep(s: GameState, step: Step, rng: Rng): StepResult {
  switch (step.kind) {
    case 'draw': {
      if (!getPlayer(s, step.seat).alive) return 'done';
      const card = drawOne(s, rng);
      return card ? takeCard(s, step.seat, card, rng) : 'done';
    }
    case 'trial':
      if (!getPlayer(s, step.target).alive) {
        backToPlaying(s);
        return 'done';
      }
      s.log.push({ t: 'trial', target: step.target, initiator: step.initiator });
      setPhase(s, { kind: 'trialReveal', target: step.target, initiator: step.initiator });
      return 'paused';
    case 'finishTrial':
      finishTrial(s, step.target, step.initiator);
      return 'done';
    case 'picks':
      return beginPicks(s);
    case 'drawing':
      return resumeDrawing(s, rng);
  }
}

/** 回合外摸到的一张牌：黑卡立即结算，其余加入手牌 */
export function takeCard(s: GameState, seat: number, card: Card, rng: Rng): StepResult {
  if (card.kind === 'night') {
    s.log.push({ t: 'blackDrawn', seat, kind: 'night' });
    s.discard.push(card);
    startNight(s);
    return 'paused';
  }
  if (card.kind === 'conspiracy') {
    s.log.push({ t: 'blackDrawn', seat, kind: 'conspiracy' });
    return startConspiracy(s, card);
  }
  getPlayer(s, seat).hand.push(card);
  s.log.push({ t: 'draw', seat });
  return 'done';
}

/** 回到当前玩家的出牌模式；当前玩家已死亡时，等流程走完后结束回合 */
export function backToPlaying(s: GameState): void {
  setPhase(s, { kind: 'day', mode: 'playing' });
  if (!s.players[s.turn].alive) s.endTurnAfter = true;
}
