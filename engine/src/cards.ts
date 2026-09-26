import { RuleError } from './errors';
import type { BlackKind, BlueKind, Card, CardKind, GreenKind, RedKind, TryalKind } from './types';

/** 进入牌堆的卡（不含黑猫、夜晚、传染） */
export const DECK_COMPOSITION = {
  accusation: 35,
  evidence: 6,
  witness: 1,
  matchmaker: 2,
  asylum: 1,
  piety: 1,
  scapegoat: 2,
  robbery: 1,
  arson: 1,
  curse: 1,
  stocks: 3,
  alibi: 3,
} as const satisfies Partial<Record<CardKind, number>>;

export const TOTAL_GAME_CARDS = 60;
export const TRYALS_PER_PLAYER = 5;

export const RED_POINTS: Record<RedKind, number> = { accusation: 1, evidence: 3, witness: 7 };

export const isRed = (k: CardKind): k is RedKind =>
  k === 'accusation' || k === 'evidence' || k === 'witness';
export const isBlue = (k: CardKind): k is BlueKind =>
  k === 'blackCat' || k === 'matchmaker' || k === 'asylum' || k === 'piety';
export const isBlack = (k: CardKind): k is BlackKind => k === 'night' || k === 'conspiracy';
export const isGreen = (k: CardKind): k is GreenKind => !isRed(k) && !isBlue(k) && !isBlack(k);

export function buildBaseDeck(): Card[] {
  const deck: Card[] = [];
  for (const [kind, count] of Object.entries(DECK_COMPOSITION) as [CardKind, number][]) {
    for (let i = 1; i <= count; i++) deck.push({ id: `${kind}-${i}`, kind });
  }
  return deck;
}

export function tryalComposition(n: number): TryalKind[] {
  if (!Number.isInteger(n) || n < 4 || n > 12) throw new RuleError('玩家人数必须在 4–12 之间');
  const witches = n <= 5 ? 1 : 2;
  const total = n * TRYALS_PER_PLAYER;
  return [
    ...Array<TryalKind>(witches).fill('witch'),
    'constable',
    ...Array<TryalKind>(total - witches - 1).fill('villager'),
  ];
}
