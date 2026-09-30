import { hasAbility } from './characters';
import { backToPlaying, proceed } from './flow';
import type { Rng } from './rng';
import { getPlayer, isEnded, redTotal, toCard } from './state';
import type { GameState } from './types';

export const DEFAULT_TRIAL_THRESHOLD = 7;

export const JUDGE_THRESHOLD = 6;
export const STRONGMAN_THRESHOLD = 8;

/** 审判线：法官发起时 6；目标是大力士时 8（法官优先）；其余 7。initiator 为 null 时是公开显示用的值 */
export function trialThreshold(s: GameState, target: number, initiator: number | null): number {
  if (initiator !== null && hasAbility(s, initiator, 'judge')) return JUDGE_THRESHOLD;
  if (hasAbility(s, target, 'strongman')) return STRONGMAN_THRESHOLD;
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

/** 审判收尾：丢弃被审判者面前的红卡；发起者是小孩时丢弃他自己面前的指控和证据；回到出牌模式 */
export function finishTrial(s: GameState, target: number, initiator: number): void {
  const p = getPlayer(s, target);
  if (p.alive) {
    s.discard.push(...p.red.map(toCard));
    p.red = [];
  }
  const init = getPlayer(s, initiator);
  if (init.alive && hasAbility(s, initiator, 'child')) {
    const drop = init.red.filter((c) => c.kind !== 'witness');
    if (drop.length > 0) {
      s.discard.push(...drop.map(toCard));
      init.red = init.red.filter((c) => c.kind === 'witness');
      s.log.push({ t: 'ability', seat: initiator, ability: 'child' });
    }
  }
  backToPlaying(s);
}
