import { checkWin, revealTryal } from './death';
import { RuleError } from './errors';
import type { Rng } from './rng';
import { aliveSeats, catHolder, getPlayer, isEnded, leftOf, setPhase, unrevealed } from './state';
import { resumeDrawing } from './turn';
import type { Card, GameState } from './types';

export function startConspiracy(s: GameState, card: Card, rng: Rng): void {
  s.discard.push(card);
  const holder = catHolder(s);
  if (holder !== null) {
    setPhase(s, { kind: 'catReveal', holder });
    return;
  }
  beginPicks(s, rng);
}

export function catReveal(s: GameState, seat: number, tryalId: string, rng: Rng): void {
  if (s.phase.kind !== 'catReveal' || s.phase.holder !== seat) throw new RuleError('现在不能翻开身份卡');
  revealTryal(s, seat, tryalId, 'cat');
  if (isEnded(s)) return;
  beginPicks(s, rng);
}

/** 需要拿牌的玩家：活着，且左边邻居还有未翻开的身份卡 */
export function conspiracyPickers(s: GameState): number[] {
  return aliveSeats(s).filter((seat) => {
    const left = leftOf(s, seat);
    return left !== null && unrevealed(getPlayer(s, left)).length > 0;
  });
}

function beginPicks(s: GameState, rng: Rng): void {
  s.conspiracyPicks = {};
  setPhase(s, { kind: 'conspiracyPick' });
  if (conspiracyPickers(s).length === 0) finishConspiracy(s, rng);
}

export function conspiracyPick(s: GameState, seat: number, index: number, rng: Rng): void {
  if (s.phase.kind !== 'conspiracyPick') throw new RuleError('现在不能拿身份卡');
  if (!conspiracyPickers(s).includes(seat)) throw new RuleError('你不需要拿身份卡');
  if (seat in s.conspiracyPicks) throw new RuleError('你已经拿过了');
  const left = leftOf(s, seat) as number;
  const count = unrevealed(getPlayer(s, left)).length;
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new RuleError('选择的位置无效');
  s.conspiracyPicks[seat] = index;
  if (conspiracyPickers(s).every((p) => p in s.conspiracyPicks)) finishConspiracy(s, rng);
}

/** 所有人同时拿牌：先按拿牌前的局面算出每一步，再一起移动 */
function finishConspiracy(s: GameState, rng: Rng): void {
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
  resumeDrawing(s, rng);
}
