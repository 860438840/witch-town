import { hasAbility } from './characters';
import { conspiracyPickers } from './conspiracy';
import { pick, type Rng } from './rng';
import { aliveSeats, constableSeat, getPlayer, leftOf, unrevealed, witchSeats } from './state';
import type { Action, GameState } from './types';

/** 得票最多的目标（票数相同时取先出现的），没有票时返回 null */
function majority(votes: Record<number, number>): number | null {
  const counts = new Map<number, number>();
  for (const v of Object.values(votes)) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = 0;
  for (const [target, count] of counts) {
    if (count > bestCount) {
      best = target;
      bestCount = count;
    }
  }
  return best;
}

/**
 * 超时时的默认操作。调用方按顺序逐个 apply，遇到 RuleError 跳过该条。
 */
export function autoActions(s: GameState, rng: Rng): Action[] {
  const ph = s.phase;
  switch (ph.kind) {
    case 'characterPick':
      return s.players
        .filter((p) => p.character === null && s.characterOffers[p.seat])
        .map((p): Action => ({ type: 'pickCharacter', seat: p.seat, index: rng.next() < 0.5 ? 0 : 1 }));
    case 'storytelling':
      return [{ type: 'storyReorder', seat: ph.seat, order: s.deck.map((c) => c.id) }];
    case 'day':
      if (ph.mode === 'choose') return [{ type: 'draw', seat: s.turn }];
      if (ph.mode === 'playing') return [{ type: 'endTurn', seat: s.turn }];
      return [];
    case 'trialReveal':
      return [{ type: 'revealTryal', seat: ph.target, tryalId: pick(unrevealed(getPlayer(s, ph.target)), rng).id }];
    case 'catReveal':
      return [{ type: 'revealTryal', seat: ph.holder, tryalId: pick(unrevealed(getPlayer(s, ph.holder)), rng).id }];
    case 'conspiracyPick':
      return conspiracyPickers(s)
        .filter((seat) => !(seat in s.conspiracyPicks))
        .map((seat): Action => {
          const count = unrevealed(getPlayer(s, leftOf(s, seat) as number)).length;
          return { type: 'conspiracyPick', seat, index: Math.floor(rng.next() * count) };
        });
    case 'dawn': {
      const allowed = aliveSeats(s).filter((seat) => !hasAbility(s, seat, 'maid'));
      const target = majority(s.dawnVotes) ?? pick(allowed, rng);
      return witchSeats(s).map((seat): Action => ({ type: 'witchVote', seat, target }));
    }
    case 'night': {
      const night = s.night;
      if (!night) return [];
      const alive = aliveSeats(s);
      const actions: Action[] = [];
      const constable = constableSeat(s);
      const others = alive.filter((x) => x !== constable);
      if (constable !== null && night.protect === null && others.length > 0) {
        actions.push({ type: 'protect', seat: constable, target: pick(others, rng) });
      }
      for (const seat of alive) {
        if (!(seat in night.confessions)) actions.push({ type: 'confess', seat, tryalId: null });
      }
      const target = majority(night.witchVotes) ?? pick(alive, rng);
      for (const seat of witchSeats(s)) actions.push({ type: 'witchVote', seat, target });
      return actions;
    }
    default:
      return [];
  }
}
