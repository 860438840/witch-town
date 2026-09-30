import { isBlack, isRed, RED_POINTS } from './cards';
import { RuleError } from './errors';
import type { Rng } from './rng';
import { getPlayer, setPhase, toCard } from './state';
import { checkTrial } from './trial';
import type { Card, CardKind, GameState, RedKind } from './types';

/** 计划 C 会在这里加入部长（证据只算 1 点） */
export function accusationValue(_s: GameState, kind: RedKind, _actor: number, _target: number): number {
  return RED_POINTS[kind];
}

/** 这张卡需要选择几名目标：嫁祸和抢劫需要 2 个（一个来源一个去向），其余都是 1 个 */
export function targetCount(kind: CardKind): number {
  return kind === 'scapegoat' || kind === 'robbery' ? 2 : 1;
}

export function playCard(s: GameState, seat: number, cardId: string, targets: number[], option: string | undefined, rng: Rng): void {
  if (s.phase.kind !== 'day' || s.phase.mode === 'drawing' || s.turn !== seat) {
    throw new RuleError('现在不能出牌');
  }
  const actor = getPlayer(s, seat);
  const idx = actor.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) throw new RuleError('手牌中没有这张卡');
  const card = actor.hand[idx];
  if (isBlack(card.kind)) throw new RuleError('黑卡不能主动打出');

  const need = targetCount(card.kind);
  if (targets.length !== need) throw new RuleError(`这张卡需要选择 ${need} 名目标`);
  const ts = targets.map((t) => getPlayer(s, t));
  if (ts.some((t) => !t.alive)) throw new RuleError('目标必须是活着的玩家');
  if (need === 2 && targets[0] === targets[1]) throw new RuleError('两个目标不能相同');
  const target = ts[0];

  if (isRed(card.kind)) {
    if (target.seat === seat) throw new RuleError('不能对自己打出红卡');
    if (target.blue.some((c) => c.kind === 'piety')) throw new RuleError('信徒：不能对该玩家打出红卡');
  }
  if (card.kind === 'matchmaker' && target.blue.some((c) => c.kind === 'matchmaker')) {
    throw new RuleError('该玩家已经有情侣卡');
  }
  if (card.kind === 'stocks' && target.green.some((c) => c.kind === 'stocks')) {
    throw new RuleError('该玩家已被拘留');
  }
  if (card.kind === 'curse' && !target.blue.some((c) => c.id === option)) {
    throw new RuleError('请选择该玩家面前的一张蓝卡');
  }
  if (card.kind === 'alibi' && option !== undefined && option !== 'accusation' && option !== 'evidence') {
    throw new RuleError('辩护选项无效');
  }

  actor.hand.splice(idx, 1);
  setPhase(s, { kind: 'day', mode: 'playing' });
  s.log.push({ t: 'play', seat, kind: card.kind, targets });

  switch (card.kind) {
    case 'accusation':
    case 'evidence':
    case 'witness':
      target.red.push({ id: card.id, kind: card.kind, points: accusationValue(s, card.kind, seat, target.seat) });
      checkTrial(s, target.seat, seat, rng);
      return;
    case 'matchmaker':
    case 'asylum':
    case 'piety':
    case 'blackCat':
      target.blue.push(card);
      return;
    case 'stocks':
      target.green.push(card);
      return;
    case 'alibi': {
      const mode = option ?? (target.red.some((c) => c.kind === 'accusation') ? 'accusation' : 'evidence');
      const limit = mode === 'accusation' ? 3 : 1;
      let removed = 0;
      target.red = target.red.filter((c) => {
        if (removed < limit && c.kind === mode) {
          removed++;
          s.discard.push(toCard(c));
          return false;
        }
        return true;
      });
      s.discard.push(card);
      return;
    }
    case 'arson':
      s.discard.push(...target.hand, card);
      target.hand = [];
      return;
    case 'robbery': {
      const to = ts[1];
      to.hand.push(...target.hand);
      target.hand = [];
      s.discard.push(card);
      return;
    }
    case 'scapegoat': {
      const to = ts[1];
      // 接收者已有情侣或拘留时，转来的同类卡进弃牌堆，避免叠加
      const alreadyHas = (cards: Card[], kind: CardKind) => cards.some((c) => c.kind === kind);
      const hasMatchmaker = alreadyHas(to.blue, 'matchmaker');
      const hasStocks = alreadyHas(to.green, 'stocks');
      to.red.push(...target.red);
      for (const c of target.blue) {
        if (c.kind === 'matchmaker' && hasMatchmaker) s.discard.push(c);
        else to.blue.push(c);
      }
      for (const c of target.green) {
        if (c.kind === 'stocks' && hasStocks) s.discard.push(c);
        else to.green.push(c);
      }
      target.red = [];
      target.blue = [];
      target.green = [];
      s.discard.push(card);
      checkTrial(s, to.seat, seat, rng);
      return;
    }
    case 'curse': {
      const i = target.blue.findIndex((c) => c.id === option);
      s.discard.push(...target.blue.splice(i, 1), card);
      return;
    }
  }
}
