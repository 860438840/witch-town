import { checkWin, revealTryal } from './death';
import { RuleError } from './errors';
import { proceed, type StepResult } from './flow';
import type { Rng } from './rng';
import { aliveSeats, catHolder, getPlayer, leftOf, setPhase, unrevealed } from './state';
import type { Card, GameState } from './types';

/** 抽到传染：有黑猫时持有者先翻牌（之后再盲抽），没有黑猫时直接盲抽 */
export function startConspiracy(s: GameState, card: Card): StepResult {
  s.discard.push(card);
  const holder = catHolder(s);
  if (holder !== null) {
    s.steps.push({ kind: 'picks' });
    setPhase(s, { kind: 'catReveal', holder });
    return 'paused';
  }
  return beginPicks(s);
}

export function catReveal(s: GameState, seat: number, tryalId: string, rng: Rng): void {
  if (s.phase.kind !== 'catReveal' || s.phase.holder !== seat) throw new RuleError('现在不能翻开身份卡');
  revealTryal(s, seat, tryalId, 'cat');
  proceed(s, rng);
}

/** 需要拿牌的玩家：活着，且左边邻居还有未翻开的身份卡 */
export function conspiracyPickers(s: GameState): number[] {
  return aliveSeats(s).filter((seat) => {
    const left = leftOf(s, seat);
    return left !== null && unrevealed(getPlayer(s, left)).length > 0;
  });
}

/** 开始盲抽；没有人需要抽时直接完成传染 */
export function beginPicks(s: GameState): StepResult {
  s.conspiracyPicks = {};
  setPhase(s, { kind: 'conspiracyPick' });
  if (conspiracyPickers(s).length > 0) return 'paused';
  finishConspiracy(s);
  return 'done';
}

export function conspiracyPick(s: GameState, seat: number, index: number, rng: Rng): void {
  if (s.phase.kind !== 'conspiracyPick') throw new RuleError('现在不能拿身份卡');
  if (!conspiracyPickers(s).includes(seat)) throw new RuleError('你不需要拿身份卡');
  if (seat in s.conspiracyPicks) throw new RuleError('你已经拿过了');
  const left = leftOf(s, seat) as number;
  const count = unrevealed(getPlayer(s, left)).length;
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new RuleError('选择的位置无效');
  s.conspiracyPicks[seat] = index;
  if (conspiracyPickers(s).every((p) => p in s.conspiracyPicks)) {
    finishConspiracy(s);
    proceed(s, rng);
  }
}

/** 所有人同时拿牌：先按拿牌前的局面算出每一步，再一起移动 */
function finishConspiracy(s: GameState): void {
  const moves = conspiracyPickers(s).map((seat) => {
    const from = leftOf(s, seat) as number;
    const tryal = unrevealed(getPlayer(s, from))[s.conspiracyPicks[seat]];
    return { seat, from, tryalId: tryal.id };
  });
  for (const m of moves) {
    const giver = getPlayer(s, m.from);
    const i = giver.tryals.findIndex((t) => t.id === m.tryalId);
    const [tryal] = giver.tryals.splice(i, 1);
    const receiver = getPlayer(s, m.seat);
    receiver.tryals.push(tryal);
    if (tryal.kind === 'witch') receiver.witchFaction = true;
  }
  s.conspiracyPicks = {};
  s.log.push({ t: 'conspiracyDone' });
  checkWin(s);
}
