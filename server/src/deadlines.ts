import type { GameState } from '../../engine/src/index';
import { isBot } from './types';

export const TURN_MS = 90_000;
export const BOT_TURN_MS = 3_000;
export const CHOICE_MS = 45_000;

/** 同一个等待阶段的 key 相同；key 变化时才重新计时 */
export function deadlineKey(s: GameState): string {
  const ph = s.phase;
  switch (ph.kind) {
    case 'day':
      return `day:${s.turn}`;
    case 'trialReveal':
      return `trial:${ph.target}`;
    case 'catReveal':
      return `cat:${ph.holder}`;
    default:
      return ph.kind;
  }
}

export function phaseDuration(s: GameState): number {
  if (s.phase.kind !== 'day') return CHOICE_MS;
  return isBot(s.players[s.turn].openid) ? BOT_TURN_MS : TURN_MS;
}
