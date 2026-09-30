import { pickCharacter } from './characters';
import { catReveal, conspiracyPick } from './conspiracy';
import { revealTryal } from './death';
import { RuleError } from './errors';
import { proceed, pushHousewifeDraws } from './flow';
import { confess, protect, witchVote } from './night';
import { playCard } from './play';
import type { Rng } from './rng';
import { getPlayer } from './state';
import { endTurn, startDrawing } from './turn';
import type { Action, GameState } from './types';

export function apply(state: GameState, action: Action, rng: Rng): GameState {
  const s: GameState = JSON.parse(JSON.stringify(state));
  if (s.phase.kind === 'ended') throw new RuleError('游戏已结束');
  if (!getPlayer(s, action.seat).alive) throw new RuleError('死亡的玩家不能行动');

  switch (action.type) {
    case 'play':
      playCard(s, action.seat, action.cardId, action.targets, action.option, rng);
      break;
    case 'endTurn':
      if (s.phase.kind !== 'day' || s.phase.mode !== 'playing' || s.turn !== action.seat) {
        throw new RuleError('现在不能结束回合');
      }
      endTurn(s);
      break;
    case 'revealTryal':
      handleReveal(s, action.seat, action.tryalId, rng);
      break;
    case 'witchVote':
      witchVote(s, action.seat, action.target, rng);
      break;
    case 'protect':
      protect(s, action.seat, action.target, rng);
      break;
    case 'confess':
      confess(s, action.seat, action.tryalId, rng);
      break;
    case 'draw':
      if (s.phase.kind !== 'day' || s.phase.mode !== 'choose' || s.turn !== action.seat) {
        throw new RuleError('现在不能抽牌');
      }
      startDrawing(s, rng);
      break;
    case 'conspiracyPick':
      conspiracyPick(s, action.seat, action.index, rng);
      break;
    case 'pickCharacter':
      pickCharacter(s, action.seat, action.index);
      break;
    default:
      throw new RuleError('现在不能执行这个操作');
  }

  s.version++;
  return s;
}

function handleReveal(s: GameState, seat: number, tryalId: string, rng: Rng): void {
  const ph = s.phase;
  if (ph.kind === 'trialReveal' && ph.target === seat) {
    revealTryal(s, seat, tryalId, 'trial');
    s.steps.push({ kind: 'finishTrial', target: seat, initiator: ph.initiator });
    pushHousewifeDraws(s, seat);
    proceed(s, rng);
    return;
  }
  if (ph.kind === 'catReveal') {
    catReveal(s, seat, tryalId, rng);
    return;
  }
  throw new RuleError('现在不能翻开身份卡');
}
