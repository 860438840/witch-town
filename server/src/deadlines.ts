import { autoActions, seededRng, type GameState } from '../../engine/src/index';
import { isBot } from './types';

export const TURN_MS = 90_000;
export const BOT_TURN_MS = 3_000;
export const CHOICE_MS = 45_000;
export const PICK_MS = 30_000;
export const STORY_MS = 120_000;

/** 还需要操作的座位：超时默认操作涉及的座位，去掉黎明、夜晚已经投过票的女巫 */
function waitingSeats(s: GameState): number[] {
  const votes = s.phase.kind === 'night' ? (s.night?.witchVotes ?? {}) : s.phase.kind === 'dawn' ? s.dawnVotes : {};
  const seats = autoActions(s, seededRng(0))
    .filter((a) => !(a.type === 'witchVote' && a.seat in votes))
    .map((a) => a.seat);
  return [...new Set(seats)];
}

/** 白天以外的阶段里，还需要操作的人全是机器人 */
function botsOnly(s: GameState): boolean {
  if (s.phase.kind === 'day') return false;
  const seats = waitingSeats(s);
  return seats.length > 0 && seats.every((seat) => isBot(s.players[seat].openid));
}

/** 同一个等待阶段的 key 相同；key 变化时才重新计时。只剩机器人要操作时 key 变化，改为 3 秒 */
export function deadlineKey(s: GameState): string {
  const key = phaseKey(s);
  return botsOnly(s) ? `${key}:bots` : key;
}

function phaseKey(s: GameState): string {
  const ph = s.phase;
  switch (ph.kind) {
    case 'day': {
      // 只按座位号区分不够：如果只剩 2 人存活（或另一人被拘留），同一座位会连续拿到两个回合，
      // 单纯的 day:${turn} 会复用上一回合已经过期的截止时间。加入 log 里 turn 事件的计数区分。
      const turnCount = s.log.filter((e) => e.t === 'turn').length;
      // 说书人调整完牌堆回到回合时重新计时
      const arranged = s.log.filter((e) => e.t === 'ability' && e.ability === 'storyteller').length;
      return `day:${s.turn}:${turnCount}:${arranged}`;
    }
    case 'night':
      // 流程栈里一次 apply 可能连续进入两个夜晚，按已结算的夜晚数区分，避免复用上一夜已过期的截止时间
      return `night:${s.log.filter((e) => e.t === 'nightResult').length}`;
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
  if (s.phase.kind === 'storytelling') return STORY_MS;
  if (s.phase.kind !== 'day') return botsOnly(s) ? BOT_TURN_MS : CHOICE_MS;
  return isBot(s.players[s.turn].openid) ? BOT_TURN_MS : TURN_MS;
}
