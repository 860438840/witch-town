import { RuleError, TOTAL_GAME_CARDS } from '../../engine/src/index';
import type { ClientAction } from './game';

/** 校验失败统一报这个错，不区分具体原因，避免向客户端泄露校验细节 */
function fail(): never {
  throw new RuleError('操作参数无效');
}

function isSeat(v: unknown, playerCount: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < playerCount;
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function isBoundedString(v: unknown, maxLen: number, minLen = 1): v is string {
  return typeof v === 'string' && v.length >= minLen && v.length <= maxLen;
}

function targets(v: unknown, playerCount: number): number[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > 2) fail();
  for (const t of v) if (!isSeat(t, playerCount)) fail();
  return v as number[];
}

function idList(v: unknown, min: number, max: number): string[] {
  if (!Array.isArray(v) || v.length < min || v.length > max) fail();
  for (const id of v) if (!isBoundedString(id, 64)) fail();
  return v as string[];
}

/**
 * 把客户端发来的原始 action 转成干净的、只含白名单字段的对象；座位由服务器根据 openid
 * 决定，这里连带丢弃客户端夹带的任何 seat 字段。校验失败统一抛 RuleError('操作参数无效')。
 */
export function parseClientAction(raw: unknown, playerCount: number): ClientAction {
  const r = (raw ?? {}) as Record<string, unknown>;
  switch (r.type) {
    case 'draw':
      return { type: 'draw' };
    case 'endTurn':
      return { type: 'endTurn' };
    case 'play': {
      if (!isBoundedString(r.cardId, 64)) fail();
      const ts = targets(r.targets, playerCount);
      const action: ClientAction = { type: 'play', cardId: r.cardId, targets: ts };
      if (r.option !== undefined) {
        if (!isBoundedString(r.option, 64, 0)) fail();
        action.option = r.option;
      }
      return action;
    }
    case 'revealTryal': {
      if (!isBoundedString(r.tryalId, 64)) fail();
      return { type: 'revealTryal', tryalId: r.tryalId };
    }
    case 'witchVote': {
      if (!isSeat(r.target, playerCount)) fail();
      return { type: 'witchVote', target: r.target };
    }
    case 'protect': {
      if (!isSeat(r.target, playerCount)) fail();
      return { type: 'protect', target: r.target };
    }
    case 'confess': {
      if (r.silent === true) {
        if (r.tryalId !== null) fail();
        return { type: 'confess', tryalId: null, silent: true };
      }
      if (r.silent !== undefined && r.silent !== false) fail();
      if (r.tryalId === null) return { type: 'confess', tryalId: null };
      if (!isBoundedString(r.tryalId, 64)) fail();
      return { type: 'confess', tryalId: r.tryalId };
    }
    case 'conspiracyPick': {
      if (!isNonNegInt(r.index)) fail();
      return { type: 'conspiracyPick', index: r.index };
    }
    case 'pickCharacter': {
      const index = r.index === 0 ? 0 : r.index === 1 ? 1 : fail();
      return { type: 'pickCharacter', index };
    }
    case 'priestDraw':
      return { type: 'priestDraw', cardIds: idList(r.cardIds, 1, 2) };
    case 'storyStart':
      return { type: 'storyStart' };
    case 'storyReorder':
      return { type: 'storyReorder', order: idList(r.order, 0, TOTAL_GAME_CARDS) };
    default:
      fail();
  }
}
