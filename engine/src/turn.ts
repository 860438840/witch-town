import { RuleError } from './errors';
import { setPhase } from './state';
import type { GameState } from './types';

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
