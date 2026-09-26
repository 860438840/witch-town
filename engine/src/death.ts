import { RuleError } from './errors';
import { getPlayer, toCard, unrevealed } from './state';
import type { DeathCause, GameState, RevealCause, Winner } from './types';

export function revealTryal(s: GameState, seat: number, tryalId: string, cause: RevealCause): void {
  const p = getPlayer(s, seat);
  const t = p.tryals.find((x) => x.id === tryalId);
  if (!t || t.revealed) throw new RuleError('这张身份卡不能翻开');
  t.revealed = true;
  s.log.push({ t: 'reveal', seat, kind: t.kind, cause });
  if (t.kind === 'witch') killPlayer(s, seat, 'witchRevealed');
  else if (unrevealed(p).length === 0) killPlayer(s, seat, 'allRevealed');
  checkWin(s);
}

export function killPlayer(s: GameState, seat: number, cause: DeathCause): void {
  const p = getPlayer(s, seat);
  if (!p.alive) return;
  p.alive = false;
  for (const t of p.tryals) {
    if (!t.revealed) {
      t.revealed = true;
      s.log.push({ t: 'reveal', seat, kind: t.kind, cause: 'death' });
    }
  }
  s.log.push({ t: 'death', seat, cause });
  const wasLover = p.blue.some((c) => c.kind === 'matchmaker');
  s.discard.push(...p.hand, ...p.red.map(toCard), ...p.blue, ...p.green);
  p.hand = [];
  p.red = [];
  p.blue = [];
  p.green = [];
  if (wasLover) {
    const partner = s.players.find((q) => q.alive && q.blue.some((c) => c.kind === 'matchmaker'));
    if (partner) killPlayer(s, partner.seat, 'lover');
  }
  checkWin(s);
}

export function checkWin(s: GameState): void {
  if (s.phase.kind === 'ended') return;
  const witchCards = s.players.flatMap((p) => p.tryals).filter((t) => t.kind === 'witch');
  let winner: Winner | null = null;
  if (witchCards.every((t) => t.revealed)) winner = 'village';
  else if (s.players.filter((p) => p.alive).every((p) => p.witchFaction)) winner = 'witch';
  if (winner) {
    s.phase = { kind: 'ended', winner };
    s.log.push({ t: 'gameEnd', winner });
  }
}
