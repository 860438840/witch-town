import { isBlack } from './cards';
import { canUse, useAbility } from './characters';
import { RuleError } from './errors';
import { getPlayer, setPhase } from './state';
import { endTurn } from './turn';
import type { Card, GameState } from './types';

/** 回合开始、还没抽牌也没出牌 */
function atTurnStart(s: GameState, seat: number): boolean {
  return s.phase.kind === 'day' && s.phase.mode === 'choose' && s.turn === seat;
}

/** 牧师：从弃牌堆拿 1–2 张非黑卡代替抽牌，拿完回合结束 */
export function priestDraw(s: GameState, seat: number, cardIds: string[]): void {
  if (!atTurnStart(s, seat)) throw new RuleError('现在不能使用牧师技能');
  if (!canUse(s, seat, 'priest')) throw new RuleError('你不能使用牧师技能');
  if (cardIds.length < 1 || cardIds.length > 2 || new Set(cardIds).size !== cardIds.length) {
    throw new RuleError('请选择 1–2 张不同的牌');
  }
  const cards = cardIds.map((id) => s.discard.find((c) => c.id === id));
  if (cards.some((c) => !c || isBlack(c.kind))) throw new RuleError('只能拿弃牌堆里的非黑卡');
  s.discard = s.discard.filter((c) => !cardIds.includes(c.id));
  getPlayer(s, seat).hand.push(...(cards as Card[]));
  useAbility(s, seat, 'priest');
  s.log.push({ t: 'ability', seat, ability: 'priest', count: cardIds.length });
  endTurn(s);
}

/** 说书人：进入「调整牌堆」阶段（次数在开始时就用掉） */
export function storyStart(s: GameState, seat: number): void {
  if (!atTurnStart(s, seat)) throw new RuleError('现在不能调整牌堆');
  if (!canUse(s, seat, 'storyteller')) throw new RuleError('你不能调整牌堆');
  useAbility(s, seat, 'storyteller');
  setPhase(s, { kind: 'storytelling', seat });
}

/** 说书人：提交新的牌堆顺序（必须正好是当前牌堆的重新排列），回到他的回合 */
export function storyReorder(s: GameState, seat: number, order: string[]): void {
  if (s.phase.kind !== 'storytelling' || s.phase.seat !== seat) throw new RuleError('现在不能调整牌堆');
  const byId = new Map(s.deck.map((c) => [c.id, c] as const));
  if (order.length !== s.deck.length || new Set(order).size !== order.length || order.some((id) => !byId.has(id))) {
    throw new RuleError('新顺序必须包含牌堆里的每一张牌');
  }
  s.deck = order.map((id) => byId.get(id) as Card);
  s.log.push({ t: 'ability', seat, ability: 'storyteller' });
  setPhase(s, { kind: 'day', mode: 'choose' });
}
