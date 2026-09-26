import { getPlayer, redTotal, setPhase, toCard } from './state';
import { endTurn } from './turn';
import type { GameState } from './types';

export const DEFAULT_TRIAL_THRESHOLD = 7;

/** 计划 C 会在这里加入大力士（8）和法官（6） */
export function trialThreshold(_s: GameState, _target: number, _initiator: number | null): number {
  return DEFAULT_TRIAL_THRESHOLD;
}

export function checkTrial(s: GameState, target: number, initiator: number): void {
  const p = getPlayer(s, target);
  if (!p.alive || s.phase.kind === 'ended') return;
  if (redTotal(p) >= trialThreshold(s, target, initiator)) {
    s.log.push({ t: 'trial', target, initiator });
    setPhase(s, { kind: 'trialReveal', target, initiator });
  }
}

/** 被审判者翻牌之后调用：清空其红卡，回到当前玩家的出牌模式 */
export function finishTrial(s: GameState, target: number): void {
  const p = getPlayer(s, target);
  if (p.alive) {
    s.discard.push(...p.red.map(toCard));
    p.red = [];
  }
  if (s.phase.kind === 'ended') return;
  setPhase(s, { kind: 'day', mode: 'playing' });
  if (!s.players[s.turn].alive) endTurn(s);
}
