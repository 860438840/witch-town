import { startConspiracy } from './conspiracy';
import { RuleError } from './errors';
import { startNight } from './night';
import { shuffle, type Rng } from './rng';
import { setPhase } from './state';
import type { Card, GameState } from './types';

/** 从 fromSeat 开始（含）找到下一个可以行动的玩家；被拘留的玩家跳过一次并移除拘留 */
export function startTurn(s: GameState, fromSeat: number): void {
  if (s.phase.kind === 'ended') return;
  const n = s.players.length;
  let seat = ((fromSeat % n) + n) % n;
  for (let i = 0; i < n * 2; i++) {
    const p = s.players[seat];
    if (p.alive) {
      const idx = p.green.findIndex((c) => c.kind === 'stocks');
      if (idx >= 0) {
        s.discard.push(...p.green.splice(idx, 1));
        s.log.push({ t: 'skipped', seat });
      } else {
        s.turn = seat;
        s.drawsLeft = 0;
        setPhase(s, { kind: 'day', mode: 'choose' });
        s.log.push({ t: 'turn', seat });
        return;
      }
    }
    seat = (seat + 1) % n;
  }
  throw new RuleError('没有可以行动的玩家');
}

export function endTurn(s: GameState): void {
  startTurn(s, s.turn + 1);
}

/** 从牌堆顶抽一张；牌堆空了就把弃牌堆洗成新牌堆 */
export function drawOne(s: GameState, rng: Rng): Card | null {
  if (s.deck.length === 0) {
    if (s.discard.length === 0) return null;
    s.deck = shuffle(s.discard, rng);
    s.discard = [];
    s.log.push({ t: 'reshuffle' });
  }
  return s.deck.shift() ?? null;
}

export function startDrawing(s: GameState, rng: Rng): void {
  s.drawsLeft = 2;
  setPhase(s, { kind: 'day', mode: 'drawing' });
  continueDrawing(s, rng);
}

/** 抽到 2 张非黑卡为止；抽到夜晚则回合结束，抽到传染则先结算传染 */
export function continueDrawing(s: GameState, rng: Rng): void {
  while (s.drawsLeft > 0) {
    if (s.phase.kind !== 'day' || s.phase.mode !== 'drawing') return;
    const card = drawOne(s, rng);
    if (!card) {
      s.drawsLeft = 0;
      break;
    }
    if (card.kind === 'night') {
      s.log.push({ t: 'blackDrawn', seat: s.turn, kind: 'night' });
      s.discard.push(card);
      s.drawsLeft = 0;
      startNight(s);
      return;
    }
    if (card.kind === 'conspiracy') {
      s.log.push({ t: 'blackDrawn', seat: s.turn, kind: 'conspiracy' });
      startConspiracy(s, card, rng);
      return;
    }
    s.players[s.turn].hand.push(card);
    s.drawsLeft--;
    s.log.push({ t: 'draw', seat: s.turn });
  }
  if (s.phase.kind === 'day' && s.phase.mode === 'drawing') endTurn(s);
}

/** 传染结算完后回到抽牌；当前玩家已经死亡则直接结束回合 */
export function resumeDrawing(s: GameState, rng: Rng): void {
  if (s.phase.kind === 'ended') return;
  setPhase(s, { kind: 'day', mode: 'drawing' });
  if (!s.players[s.turn].alive) {
    s.drawsLeft = 0;
    endTurn(s);
    return;
  }
  continueDrawing(s, rng);
}
