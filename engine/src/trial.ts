import { backToPlaying, proceed } from './flow';
import type { Rng } from './rng';
import { getPlayer, isEnded, redTotal, toCard } from './state';
import type { GameState } from './types';

export const DEFAULT_TRIAL_THRESHOLD = 7;

/** Task 3 会在这里加入大力士（8）和法官（6） */
export function trialThreshold(_s: GameState, _target: number, _initiator: number | null): number {
  return DEFAULT_TRIAL_THRESHOLD;
}

/** 红卡累计达到审判线时开始审判（经过流程栈，Task 4 的少女会在审判前插入摸牌） */
export function checkTrial(s: GameState, target: number, initiator: number, rng: Rng): void {
  const p = getPlayer(s, target);
  if (!p.alive || isEnded(s)) return;
  if (redTotal(p) < trialThreshold(s, target, initiator)) return;
  s.steps.push({ kind: 'trial', target, initiator });
  proceed(s, rng);
}

/** 审判收尾：丢弃被审判者面前的红卡，回到当前玩家的出牌模式 */
export function finishTrial(s: GameState, target: number, _initiator: number): void {
  const p = getPlayer(s, target);
  if (p.alive) {
    s.discard.push(...p.red.map(toCard));
    p.red = [];
  }
  backToPlaying(s);
}
