import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { autoActions } from '../src/auto';
import { TOTAL_GAME_CARDS, TRYALS_PER_PLAYER, isBlack } from '../src/cards';
import { RuleError } from '../src/errors';
import { pick, seededRng, shuffle } from '../src/rng';
import { createGame } from '../src/setup';
import { aliveSeats, constableSeat, countCards, getPlayer, unrevealed, witchSeats } from '../src/state';
import type { Action, GameState } from '../src/types';
import { projectPrivate, projectPublic } from '../src/view';

const GAMES = 1000;
const MAX_STEPS = 20000;

function tryApply(s: GameState, a: Action, rng: ReturnType<typeof seededRng>): GameState {
  try {
    return apply(s, a, rng);
  } catch (e) {
    if (e instanceof RuleError) return s;
    throw e;
  }
}

/**
 * F2：比 autoActions 更"恶劣"的夜晚机器人——在兜底之前，
 * 有一定概率主动自首翻开真实的身份卡（而不是总是自首 null），
 * 女巫阵营随机投票，警长随机保护，专门制造「自首致死」的连锁场景（F1 的回归场景）。
 */
function nightBotActions(s: GameState, rng: ReturnType<typeof seededRng>): GameState {
  for (const seat of aliveSeats(s)) {
    if (!s.night) return s;
    if (seat in s.night.confessions) continue;
    if (rng.next() >= 0.5) continue;
    const opts = unrevealed(getPlayer(s, seat));
    if (rng.next() < 0.2) {
      s = tryApply(s, { type: 'confess', seat, tryalId: null, silent: true }, rng);
      continue;
    }
    const tid = opts.length > 0 && rng.next() < 0.3 ? pick(opts, rng).id : null;
    s = tryApply(s, { type: 'confess', seat, tryalId: tid }, rng);
  }
  if (!s.night) return s;
  for (const w of witchSeats(s)) {
    if (!s.night) return s;
    if (w in s.night.witchVotes) continue;
    s = tryApply(s, { type: 'witchVote', seat: w, target: pick(aliveSeats(s), rng) }, rng);
  }
  if (!s.night) return s;
  const constable = constableSeat(s);
  if (constable !== null && s.night.protect === null) {
    const others = aliveSeats(s).filter((x) => x !== constable);
    if (others.length > 0) {
      s = tryApply(s, { type: 'protect', seat: constable, target: pick(others, rng) }, rng);
    }
  }
  return s;
}

function checkInvariants(s: GameState, n: number, seed: number): void {
  if (countCards(s) !== TOTAL_GAME_CARDS) throw new Error(`第 ${seed} 局：卡牌总数变为 ${countCards(s)}`);
  const tryals = s.players.reduce((k, p) => k + p.tryals.length, 0);
  if (tryals !== n * TRYALS_PER_PLAYER) throw new Error(`第 ${seed} 局：身份卡总数变为 ${tryals}`);
  if (s.phase.kind === 'day' && s.phase.mode !== 'drawing' && (s.steps.length > 0 || s.endTurnAfter)) {
    throw new Error(`第 ${seed} 局：回到白天时还有没走完的流程`);
  }
  if (s.phase.kind === 'ended') return;
  const view = projectPublic(s);
  for (const p of s.players) {
    p.tryals.forEach((t, i) => {
      if (!t.revealed && view.players[p.seat].tryals[i].kind !== null) {
        throw new Error(`第 ${seed} 局：公开视图泄露了未翻开的身份卡`);
      }
    });
  }
  for (const viewer of s.players) {
    const priv = JSON.stringify(projectPrivate(s, viewer.seat));
    for (const other of s.players) {
      if (other.seat === viewer.seat) continue;
      for (const c of other.hand) {
        if (priv.includes(`"${c.id}"`)) {
          throw new Error(`第 ${seed} 局：${viewer.seat} 号玩家的私有视图泄露了 ${other.seat} 号玩家手牌 ${c.id}`);
        }
      }
      for (const t of other.tryals) {
        if (!t.revealed && priv.includes(`"${t.id}"`)) {
          throw new Error(
            `第 ${seed} 局：${viewer.seat} 号玩家的私有视图泄露了 ${other.seat} 号玩家未翻开的身份卡 ${t.id}`,
          );
        }
      }
    }
  }
}

/** 回合开始时有一定概率尝试牧师拿牌或说书人调整牌堆（没有这个技能时会被拒绝，局面不变） */
function abilityMoves(s: GameState, rng: ReturnType<typeof seededRng>): GameState {
  const ph = s.phase;
  if (ph.kind !== 'day' || ph.mode !== 'choose' || rng.next() >= 0.2) return s;
  const seat = s.turn;
  const pool = s.discard.filter((c) => !isBlack(c.kind));
  if (pool.length > 0) {
    const ids = shuffle(pool, rng)
      .slice(0, 1 + Math.floor(rng.next() * 2))
      .map((c) => c.id);
    const next = tryApply(s, { type: 'priestDraw', seat, cardIds: ids }, rng);
    if (next !== s) return next;
  }
  const started = tryApply(s, { type: 'storyStart', seat }, rng);
  if (started === s) return s;
  return tryApply(started, { type: 'storyReorder', seat, order: shuffle(started.deck, rng).map((c) => c.id) }, rng);
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
    const moved = abilityMoves(s, rng);
    let acted = moved !== s;
    s = moved;
    const ph = s.phase;
    if (!acted && ph.kind === 'day' && ph.mode !== 'drawing' && rng.next() < 0.5) {
      const p = s.players[s.turn];
      if (p.hand.length > 0) {
        const card = pick(p.hand, rng);
        const alive = aliveSeats(s);
        const count = card.kind === 'scapegoat' || card.kind === 'robbery' ? 2 : 1;
        const targets = Array.from({ length: count }, () => pick(alive, rng));
        const option =
          card.kind === 'curse'
            ? getPlayer(s, targets[0]).blue[0]?.id
            : card.kind === 'alibi' && rng.next() < 0.5
              ? 'witness'
              : undefined;
        const next = tryApply(s, { type: 'play', seat: s.turn, cardId: card.id, targets, option }, rng);
        acted = next !== s;
        s = next;
      }
    }
    if (!acted && ph.kind === 'night') {
      s = nightBotActions(s, rng);
    }
    if (!acted) {
      for (const a of autoActions(s, rng)) s = tryApply(s, a, rng);
    }
    checkInvariants(s, n, seed);
  }
  throw new Error(`第 ${seed} 局在 ${MAX_STEPS} 步内没有结束`);
}

describe('随机对局模拟', () => {
  it(`${GAMES} 局 4–12 人随机对局（含更恶劣的自首机器人）全部正常结束、不变量成立且私有视图不泄露`, () => {
    const winners = { village: 0, witch: 0 };
    for (let seed = 1; seed <= GAMES; seed++) {
      const s = runGame(seed);
      if (s.phase.kind !== 'ended') throw new Error('unreachable');
      winners[s.phase.winner]++;
    }
    expect(winners.village + winners.witch).toBe(GAMES);
  }, 240_000);
});
