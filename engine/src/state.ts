import { RuleError } from './errors';
import type { Card, CardKind, GameState, Phase, Player, Tryal } from './types';

export function getPlayer(s: GameState, seat: number): Player {
  const p = s.players[seat];
  if (!p) throw new RuleError(`座位 ${seat} 不存在`);
  return p;
}

export function aliveSeats(s: GameState): number[] {
  return s.players.filter((p) => p.alive).map((p) => p.seat);
}

/** 左边邻居：顺时针方向下一个活着的玩家 */
export function leftOf(s: GameState, seat: number): number | null {
  const n = s.players.length;
  for (let i = 1; i < n; i++) {
    const q = (seat + i) % n;
    if (s.players[q].alive) return q;
  }
  return null;
}

/** 右边邻居：逆时针方向上一个活着的玩家 */
export function rightOf(s: GameState, seat: number): number | null {
  const n = s.players.length;
  for (let i = 1; i < n; i++) {
    const q = (seat - i + n) % n;
    if (s.players[q].alive) return q;
  }
  return null;
}

export function unrevealed(p: Player): Tryal[] {
  return p.tryals.filter((t) => !t.revealed);
}

export function constableSeat(s: GameState): number | null {
  const p = s.players.find((q) => q.alive && q.tryals.some((t) => t.kind === 'constable' && !t.revealed));
  return p ? p.seat : null;
}

export function catHolder(s: GameState): number | null {
  const p = s.players.find((q) => q.alive && q.blue.some((c) => c.kind === 'blackCat'));
  return p ? p.seat : null;
}

export function witchSeats(s: GameState): number[] {
  return s.players.filter((p) => p.alive && p.witchFaction).map((p) => p.seat);
}

export function redTotal(p: Player): number {
  return p.red.reduce((sum, c) => sum + c.points, 0);
}

/** 游戏结束后阶段不再改变 */
export function setPhase(s: GameState, phase: Phase): void {
  if (s.phase.kind === 'ended') return;
  s.phase = phase;
}

/** 游戏是否已结束。用函数而不是直接比较，避免 TS 在可能结束游戏的调用之后仍沿用旧的类型收窄 */
export function isEnded(s: GameState): boolean {
  return s.phase.kind === 'ended';
}

export function toCard(c: { id: string; kind: CardKind }): Card {
  return { id: c.id, kind: c.kind };
}

export function countCards(s: GameState): number {
  return (
    s.deck.length +
    s.discard.length +
    s.setAside.length +
    s.players.reduce((n, p) => n + p.hand.length + p.red.length + p.blue.length + p.green.length, 0)
  );
}
