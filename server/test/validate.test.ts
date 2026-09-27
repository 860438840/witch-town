import { describe, expect, it } from 'vitest';
import { RuleError } from '../../engine/src/index';
import { parseClientAction } from '../src/validate';

const n = 5;

describe('parseClientAction', () => {
  it('接受每种类型的合法操作，只保留白名单字段', () => {
    expect(parseClientAction({ type: 'draw' }, n)).toEqual({ type: 'draw' });
    expect(parseClientAction({ type: 'endTurn' }, n)).toEqual({ type: 'endTurn' });
    expect(parseClientAction({ type: 'play', cardId: 'accusation-1', targets: [1] }, n)).toEqual({
      type: 'play',
      cardId: 'accusation-1',
      targets: [1],
    });
    expect(
      parseClientAction({ type: 'play', cardId: 'scapegoat-1', targets: [1, 2], option: 'evidence', extra: 'drop me' }, n),
    ).toEqual({ type: 'play', cardId: 'scapegoat-1', targets: [1, 2], option: 'evidence' });
    expect(parseClientAction({ type: 'revealTryal', tryalId: 'abc' }, n)).toEqual({ type: 'revealTryal', tryalId: 'abc' });
    expect(parseClientAction({ type: 'witchVote', target: 3 }, n)).toEqual({ type: 'witchVote', target: 3 });
    expect(parseClientAction({ type: 'protect', target: 3 }, n)).toEqual({ type: 'protect', target: 3 });
    expect(parseClientAction({ type: 'confess', tryalId: null }, n)).toEqual({ type: 'confess', tryalId: null });
    expect(parseClientAction({ type: 'confess', tryalId: 'abc' }, n)).toEqual({ type: 'confess', tryalId: 'abc' });
    expect(parseClientAction({ type: 'conspiracyPick', index: 0 }, n)).toEqual({ type: 'conspiracyPick', index: 0 });
  });

  it('丢弃客户端夹带的 seat 字段', () => {
    expect(parseClientAction({ type: 'witchVote', target: 1, seat: 4 }, n)).toEqual({ type: 'witchVote', target: 1 });
    expect(parseClientAction({ type: 'draw', seat: 4 }, n)).toEqual({ type: 'draw' });
  });

  it('拒绝字符串座位/目标/序号（漏洞利用手法）', () => {
    expect(() => parseClientAction({ type: 'play', cardId: 'scapegoat-1', targets: [0, '0'] }, n)).toThrow(RuleError);
    expect(() => parseClientAction({ type: 'play', cardId: 'scapegoat-1', targets: [0, '0'] }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'protect', target: '4' }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'witchVote', target: '0' }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'play', cardId: 'robbery-1', targets: ['1', 2] }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'conspiracyPick', index: '0' }, n)).toThrow('操作参数无效');
  });

  it('拒绝越界或格式错误的值', () => {
    expect(() => parseClientAction({ type: 'witchVote', target: -1 }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'witchVote', target: n }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'witchVote', target: 1.5 }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'play', cardId: '', targets: [1] }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'play', cardId: 'a'.repeat(65), targets: [1] }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'play', cardId: 'x', targets: [] }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'play', cardId: 'x', targets: [1, 2, 3] }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'conspiracyPick', index: -1 }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'conspiracyPick', index: 1.5 }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'revealTryal', tryalId: '' }, n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'play', cardId: 'alibi-1', targets: [1], option: 'a'.repeat(65) }, n)).toThrow(
      '操作参数无效',
    );
    expect(() => parseClientAction({}, n)).toThrow('操作参数无效');
    expect(() => parseClientAction(null, n)).toThrow('操作参数无效');
    expect(() => parseClientAction('hack', n)).toThrow('操作参数无效');
    expect(() => parseClientAction({ type: 'hack' }, n)).toThrow('操作参数无效');
  });
});
