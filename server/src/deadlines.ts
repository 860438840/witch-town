import type { GameState } from '../../engine/src/index';
import { isBot } from './types';

export const TURN_MS = 90_000;
export const BOT_TURN_MS = 3_000;
export const CHOICE_MS = 45_000;
export const PICK_MS = 30_000;

/** 同一个等待阶段的 key 相同；key 变化时才重新计时 */
export function deadlineKey(s: GameState): string {
  const ph = s.phase;
  switch (ph.kind) {
    case 'day': {
      // 只按座位号区分不够：如果只剩 2 人存活（或另一人被拘留），同一座位会连续拿到两个回合，
      // 单纯的 day:${turn} 会复用上一回合已经过期的截止时间。加入 log 里 turn 事件的计数区分。
      const turnCount = s.log.filter((e) => e.t === 'turn').length;
      return `day:${s.turn}:${turnCount}`;
    }
    case 'trialReveal':
      return `trial:${ph.target}`;
    case 'catReveal':
      return `cat:${ph.holder}`;
    default:
      return ph.kind;
  }
}

export function phaseDuration(s: GameState): number {
  if (s.phase.kind === 'characterPick') return PICK_MS;
  if (s.phase.kind !== 'day') return CHOICE_MS;
  return isBot(s.players[s.turn].openid) ? BOT_TURN_MS : TURN_MS;
}
