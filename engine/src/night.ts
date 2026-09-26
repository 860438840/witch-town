import { killPlayer, revealTryal } from './death';
import { RuleError } from './errors';
import { shuffle, type Rng } from './rng';
import { aliveSeats, constableSeat, getPlayer, isEnded, setPhase, unrevealed, witchSeats } from './state';
import { endTurn, startTurn } from './turn';
import type { GameState } from './types';

/** 所有活着的女巫阵营都投了同一个目标时返回该目标，否则返回 null */
function agreedTarget(s: GameState, votes: Record<number, number>): number | null {
  const witches = witchSeats(s);
  if (witches.length === 0) return null;
  const first = votes[witches[0]];
  if (first === undefined) return null;
  return witches.every((w) => votes[w] === first) ? first : null;
}

export function witchVote(s: GameState, seat: number, target: number, rng: Rng): void {
  if (!getPlayer(s, seat).witchFaction) throw new RuleError('只有女巫阵营可以投票');
  if (!getPlayer(s, target).alive) throw new RuleError('目标必须是活着的玩家');
  if (s.phase.kind === 'dawn') {
    s.dawnVotes[seat] = target;
    tryResolveDawn(s);
    return;
  }
  if (s.phase.kind === 'night' && s.night) {
    s.night.witchVotes[seat] = target;
    tryResolveNight(s, rng);
    return;
  }
  throw new RuleError('现在不能投票');
}

function tryResolveDawn(s: GameState): void {
  const target = agreedTarget(s, s.dawnVotes);
  if (target === null) return;
  const cat = s.setAside.find((c) => c.kind === 'blackCat');
  if (!cat) throw new RuleError('找不到黑猫卡');
  s.setAside = s.setAside.filter((c) => c !== cat);
  getPlayer(s, target).blue.push(cat);
  s.dawnVotes = {};
  s.log.push({ t: 'catPlaced', target });
  startTurn(s, target);
}

export function startNight(s: GameState): void {
  setPhase(s, { kind: 'night' });
  s.night = { witchVotes: {}, protect: null, confessions: {} };
}

export function protect(s: GameState, seat: number, target: number, rng: Rng): void {
  if (s.phase.kind !== 'night' || !s.night) throw new RuleError('现在不能保护');
  if (constableSeat(s) !== seat) throw new RuleError('只有警长可以保护');
  if (target === seat) throw new RuleError('警长不能保护自己');
  if (!getPlayer(s, target).alive) throw new RuleError('目标必须是活着的玩家');
  s.night.protect = target;
  tryResolveNight(s, rng);
}

export function confess(s: GameState, seat: number, tryalId: string | null, rng: Rng): void {
  if (s.phase.kind !== 'night' || !s.night) throw new RuleError('现在不能自首');
  if (tryalId !== null && !unrevealed(getPlayer(s, seat)).some((t) => t.id === tryalId)) {
    throw new RuleError('这张身份卡不能翻开');
  }
  s.night.confessions[seat] = tryalId;
  tryResolveNight(s, rng);
}

function tryResolveNight(s: GameState, rng: Rng): void {
  const night = s.night;
  if (!night) return;
  const target = agreedTarget(s, night.witchVotes);
  if (target === null) return;
  if (constableSeat(s) !== null && night.protect === null) return;
  const alive = aliveSeats(s);
  if (!alive.every((seat) => seat in night.confessions)) return;

  const confessed = new Set<number>();
  for (const seat of alive) {
    const tid = night.confessions[seat];
    if (tid && getPlayer(s, seat).alive && !isEnded(s)) {
      revealTryal(s, seat, tid, 'confess');
      confessed.add(seat);
    }
  }
  s.night = null;
  if (isEnded(s)) return;

  const victim = getPlayer(s, target);
  const died =
    victim.alive &&
    night.protect !== target &&
    !victim.blue.some((c) => c.kind === 'asylum') &&
    !confessed.has(target);
  s.log.push({ t: 'nightResult', target, died });
  if (died) killPlayer(s, target, 'night');
  if (isEnded(s)) return;

  s.deck = shuffle([...s.deck, ...s.discard], rng);
  s.discard = [];
  s.log.push({ t: 'reshuffle' });
  endTurn(s);
}
