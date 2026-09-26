import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { autoActions } from '../src/auto';
import { TOTAL_GAME_CARDS, TRYALS_PER_PLAYER } from '../src/cards';
import { RuleError } from '../src/errors';
import { pick, seededRng } from '../src/rng';
import { createGame } from '../src/setup';
import { aliveSeats, countCards, getPlayer } from '../src/state';
import type { Action, GameState } from '../src/types';
import { projectPublic } from '../src/view';

const GAMES = 300;
const MAX_STEPS = 20000;

function tryApply(s: GameState, a: Action, rng: ReturnType<typeof seededRng>): GameState {
  try {
    return apply(s, a, rng);
  } catch (e) {
    if (e instanceof RuleError) return s;
    throw e;
  }
}

function checkInvariants(s: GameState, n: number, seed: number): void {
  if (countCards(s) !== TOTAL_GAME_CARDS) throw new Error(`第 ${seed} 局：卡牌总数变为 ${countCards(s)}`);
  const tryals = s.players.reduce((k, p) => k + p.tryals.length, 0);
  if (tryals !== n * TRYALS_PER_PLAYER) throw new Error(`第 ${seed} 局：身份卡总数变为 ${tryals}`);
  if (s.phase.kind === 'ended') return;
  const view = projectPublic(s);
  for (const p of s.players) {
    p.tryals.forEach((t, i) => {
      if (!t.revealed && view.players[p.seat].tryals[i].kind !== null) {
        throw new Error(`第 ${seed} 局：公开视图泄露了未翻开的身份卡`);
      }
    });
  }
}

function runGame(seed: number): GameState {
  const n = 4 + (seed % 9);
  const rng = seededRng(seed);
  let s = createGame(
    Array.from({ length: n }, (_, i) => ({ openid: `u${i}`, name: `P${i}` })),
    rng,
  );
  for (let step = 0; step < MAX_STEPS; step++) {
    if (s.phase.kind === 'ended') return s;
    const ph = s.phase;
    let acted = false;
    if (ph.kind === 'day' && ph.mode !== 'drawing' && rng.next() < 0.5) {
      const p = s.players[s.turn];
      if (p.hand.length > 0) {
        const card = pick(p.hand, rng);
        const alive = aliveSeats(s);
        const count = card.kind === 'scapegoat' || card.kind === 'robbery' ? 2 : 1;
        const targets = Array.from({ length: count }, () => pick(alive, rng));
        const option = card.kind === 'curse' ? getPlayer(s, targets[0]).blue[0]?.id : undefined;
        const next = tryApply(s, { type: 'play', seat: s.turn, cardId: card.id, targets, option }, rng);
        acted = next !== s;
        s = next;
      }
    }
    if (!acted) {
      for (const a of autoActions(s, rng)) s = tryApply(s, a, rng);
    }
    checkInvariants(s, n, seed);
  }
  throw new Error(`第 ${seed} 局在 ${MAX_STEPS} 步内没有结束`);
}

describe('随机对局模拟', () => {
  it(`${GAMES} 局 4–12 人随机对局全部正常结束且不变量成立`, () => {
    const winners = { village: 0, witch: 0 };
    for (let seed = 1; seed <= GAMES; seed++) {
      const s = runGame(seed);
      if (s.phase.kind !== 'ended') throw new Error('unreachable');
      winners[s.phase.winner]++;
    }
    expect(winners.village + winners.witch).toBe(GAMES);
  }, 120_000);
});
