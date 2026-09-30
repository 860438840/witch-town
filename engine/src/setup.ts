import { buildBaseDeck, TRYALS_PER_PLAYER, tryalComposition } from './cards';
import { dealCharacters } from './characters';
import { RuleError } from './errors';
import { shuffle, type Rng } from './rng';
import type { Card, GameState, Player } from './types';

export interface NewPlayer {
  openid: string;
  name: string;
}

export function createGame(newPlayers: NewPlayer[], rng: Rng): GameState {
  if (newPlayers.length < 4) {
    throw new RuleError(`人数不足 4 人`);
  }

  const kinds = shuffle(tryalComposition(newPlayers.length), rng);
  const total = newPlayers.length * TRYALS_PER_PLAYER;
  // 身份卡 id 用打乱后的编号，避免通过 id 推断出原始座位（阴谋卡会把身份卡换到别的玩家手上）
  const idNumbers = shuffle(
    Array.from({ length: total }, (_, i) => i + 1),
    rng,
  );
  const players: Player[] = newPlayers.map((np, seat) => {
    const tryals = kinds
      .slice(seat * TRYALS_PER_PLAYER, (seat + 1) * TRYALS_PER_PLAYER)
      .map((kind, i) => ({ id: `t${idNumbers[seat * TRYALS_PER_PLAYER + i]}`, kind, revealed: false }));
    return {
      seat,
      openid: np.openid,
      name: np.name,
      character: null,
      uses: {},
      alive: true,
      witchFaction: tryals.some((t) => t.kind === 'witch'),
      hand: [],
      tryals,
      red: [],
      blue: [],
      green: [],
    };
  });

  let deck = shuffle(buildBaseDeck(), rng);
  for (let round = 0; round < 3; round++) {
    for (const p of players) p.hand.push(deck.shift() as Card);
  }
  deck = shuffle<Card>([...deck, { id: 'night-1', kind: 'night' }, { id: 'conspiracy-1', kind: 'conspiracy' }], rng);

  const state: GameState = {
    players,
    deck,
    discard: [],
    setAside: [{ id: 'blackCat-1', kind: 'blackCat' }],
    turn: 0,
    drawsLeft: 0,
    phase: { kind: 'dawn' },
    dawnVotes: {},
    night: null,
    conspiracyPicks: {},
    characterOffers: {},
    log: [{ t: 'gameStart', players: players.length }],
    version: 0,
  };
  // 角色最后才发：之前的随机数顺序不变，同一种子下身份卡和牌堆与没有角色时相同
  dealCharacters(state, rng);
  return state;
}
