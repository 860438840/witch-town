import { conspiracyPickers } from './conspiracy';
import { constableSeat, getPlayer, leftOf, redTotal, unrevealed } from './state';
import { trialThreshold } from './trial';
import type { Card, GameEvent, GameState, Phase, RedKind, Tryal, TryalKind } from './types';

export interface PublicPlayer {
  seat: number;
  name: string;
  character: string | null;
  alive: boolean;
  handCount: number;
  tryals: { revealed: boolean; kind: TryalKind | null }[];
  red: { kind: RedKind; points: number }[];
  redTotal: number;
  threshold: number;
  blue: Card[];
  green: Card[];
  /** 游戏结束前为 null */
  witchFaction: boolean | null;
}

export interface PublicView {
  players: PublicPlayer[];
  deckCount: number;
  discardCount: number;
  turn: number;
  phase: Phase;
  log: GameEvent[];
  version: number;
}

export function projectPublic(s: GameState): PublicView {
  const ended = s.phase.kind === 'ended';
  return {
    players: s.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      character: p.character,
      alive: p.alive,
      handCount: p.hand.length,
      tryals: p.tryals.map((t) => ({ revealed: t.revealed, kind: t.revealed || ended ? t.kind : null })),
      red: p.red.map((c) => ({ kind: c.kind, points: c.points })),
      redTotal: redTotal(p),
      threshold: trialThreshold(s, p.seat, null),
      blue: p.blue,
      green: p.green,
      witchFaction: ended ? p.witchFaction : null,
    })),
    deckCount: s.deck.length,
    discardCount: s.discard.length,
    turn: s.turn,
    phase: s.phase,
    log: s.log,
    version: s.version,
  };
}

export type PendingChoice =
  | { kind: 'turn'; mode: 'choose' | 'playing' }
  | { kind: 'revealTryal'; reason: 'trial' | 'cat' }
  | { kind: 'conspiracyPick'; from: number; count: number }
  | { kind: 'dawnVote'; votes: Record<number, number> }
  | {
      kind: 'night';
      witch: boolean;
      votes: Record<number, number> | null;
      constable: boolean;
      protect: number | null;
      confessed: boolean;
    };

export interface PrivateView {
  seat: number;
  hand: Card[];
  tryals: Tryal[];
  witchFaction: boolean;
  witchPartners: number[];
  isConstable: boolean;
  pending: PendingChoice | null;
}

export function projectPrivate(s: GameState, seat: number): PrivateView {
  const p = getPlayer(s, seat);
  return {
    seat,
    hand: p.hand,
    tryals: p.tryals,
    witchFaction: p.witchFaction,
    witchPartners: p.witchFaction
      ? s.players.filter((q) => q.witchFaction && q.seat !== seat).map((q) => q.seat)
      : [],
    isConstable: constableSeat(s) === seat,
    pending: p.alive ? pendingFor(s, seat) : null,
  };
}

function pendingFor(s: GameState, seat: number): PendingChoice | null {
  const ph = s.phase;
  const p = getPlayer(s, seat);
  switch (ph.kind) {
    case 'day':
      if (s.turn !== seat || ph.mode === 'drawing') return null;
      return { kind: 'turn', mode: ph.mode };
    case 'trialReveal':
      return ph.target === seat ? { kind: 'revealTryal', reason: 'trial' } : null;
    case 'catReveal':
      return ph.holder === seat ? { kind: 'revealTryal', reason: 'cat' } : null;
    case 'conspiracyPick': {
      if (!conspiracyPickers(s).includes(seat) || seat in s.conspiracyPicks) return null;
      const from = leftOf(s, seat) as number;
      return { kind: 'conspiracyPick', from, count: unrevealed(getPlayer(s, from)).length };
    }
    case 'dawn':
      return p.witchFaction ? { kind: 'dawnVote', votes: s.dawnVotes } : null;
    case 'night': {
      const night = s.night;
      if (!night) return null;
      const isConstable = constableSeat(s) === seat;
      return {
        kind: 'night',
        witch: p.witchFaction,
        votes: p.witchFaction ? night.witchVotes : null,
        constable: isConstable,
        protect: isConstable ? night.protect : null,
        confessed: seat in night.confessions,
      };
    }
    default:
      return null;
  }
}
