import { describe, expect, it } from 'vitest';
import type { GameState } from '../../engine/src/index';
import { ResultScene } from '../src/scenes/result';
import { TableScene } from '../src/scenes/table';
import { handOf, infect, newState, roomOf } from './fixtures';
import type { Screen } from '../src/core/app';
import { findNode, type Node } from '../src/core/node';
import { canTap, drawAll, fakeCtl, fakeUi, has, labelOf, SCREEN, tap } from './sceneKit';

function table(s: GameState, seat: number, screen: Screen = SCREEN, busy = false) {
  const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, seat), openid: `u${seat}`, busy });
  return { ctl, t: new TableScene(fakeUi(ctl, screen)) };
}
const SMALL: Screen = { W: 320, H: 568, top: 64, bottom: 568 };
const rectOf = (nodes: Node[], id: string) => findNode(nodes, id)!.rect;
const bottomOf = (nodes: Node[], re: RegExp) =>
  Math.max(...nodes.filter((n) => n.id && re.test(n.id)).map((n) => n.rect.y + n.rect.h));

/** 夜晚面板：自首按钮在屏幕内，且不压住座位格和身份卡 */
function expectNightFits(nodes: Node[], screen: Screen) {
  const no = rectOf(nodes, 'no-confess');
  const yes = rectOf(nodes, 'confirm-confess');
  for (const r of [no, yes]) expect(r.y + r.h).toBeLessThanOrEqual(screen.bottom);
  const gridBottom = bottomOf(nodes, /^(kill|protect|suspect):/);
  const chips = nodes.filter((n) => n.id?.startsWith('confess:'));
  expect(chips.length).toBeGreaterThan(0);
  const chipTop = Math.min(...chips.map((n) => n.rect.y));
  expect(gridBottom).toBeLessThanOrEqual(chipTop);
  expect(bottomOf(nodes, /^confess:/) + 20).toBeLessThanOrEqual(Math.min(no.y, yes.y));
  expect(gridBottom).toBeLessThanOrEqual(Math.min(no.y, yes.y));
}
const witches = (s: GameState) => s.players.filter((p) => p.witchFaction).map((p) => p.seat);
const constable = (s: GameState) => s.players.find((p) => p.tryals.some((t) => t.kind === 'constable' && !t.revealed))!.seat;

describe('选择面板', () => {
  it('审判：选一张身份卡再确认', () => {
    const s = newState(5);
    s.phase = { kind: 'trialReveal', target: 2, initiator: 0 };
    const { ctl, t } = table(s, 2);
    const id = s.players[2].tryals[1].id;
    let nodes = t.build(0);
    expect(canTap(nodes, 'confirm-reveal')).toBe(false);
    tap(nodes, `tryal:${id}`);
    nodes = t.build(0);
    drawAll(nodes);
    tap(nodes, 'confirm-reveal');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'revealTryal', tryalId: id });
  });

  it('选中女巫卡时提示会死亡', () => {
    const s = newState(5);
    const w = witches(s)[0];
    s.phase = { kind: 'trialReveal', target: w, initiator: (w + 1) % 5 };
    const { t } = table(s, w);
    const witchCard = s.players[w].tryals.find((x) => x.kind === 'witch')!;
    tap(t.build(0), `tryal:${witchCard.id}`);
    expect(drawAll(t.build(0)).join('')).toContain('翻开女巫卡会立即死亡');
  });

  it('传染：盲抽左边玩家的一张', () => {
    const s = newState(5);
    s.phase = { kind: 'conspiracyPick' };
    const { ctl, t } = table(s, 0);
    tap(t.build(0), 'pick:3');
    tap(t.build(0), 'confirm-pick');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'conspiracyPick', index: 3 });
  });

  it('黎明：女巫阵营投票放黑猫', () => {
    const s = newState(5);
    const w = witches(s)[0];
    const { ctl, t } = table(s, w);
    tap(t.build(0), 'vote:3');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'witchVote', target: 3 });
  });

  it('夜晚：女巫选击杀目标，警长选保护对象，其他人选怀疑对象（不发请求）', () => {
    const s = newState(6, 2);
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    const w = witches(s)[0];
    const a = table(s, w);
    tap(a.t.build(0), 'kill:1');
    expect(a.ctl.act).toHaveBeenCalledWith({ type: 'witchVote', target: 1 });

    const c = constable(s);
    const b = table(s, c);
    const nodes = b.t.build(0);
    expect(has(nodes, `protect:${c}`)).toBe(false);
    tap(nodes, `protect:${(c + 1) % 6}`);
    expect(b.ctl.act).toHaveBeenCalledWith({ type: 'protect', target: (c + 1) % 6 });

    const plain = s.players.find((p) => !p.witchFaction && p.seat !== c)!.seat;
    const d = table(s, plain);
    tap(d.t.build(0), `suspect:${(plain + 1) % 6}`);
    expect(d.ctl.act).not.toHaveBeenCalled();
    expect(has(d.t.build(0), 'no-confess')).toBe(true);
  });

  it('夜晚：传染后女巫在击杀格子里能认出同伴，包括交出女巫卡的原女巫；村民看不到', () => {
    const s = newState(6, 2); // 1、2 号是女巫，4 号是警长
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    infect(s, 2, 3);
    const nodes = table(s, 3).t.build(0);
    expect(labelOf(nodes, 'kill:1')).toContain('同伴');
    expect(labelOf(nodes, 'kill:2')).toContain('同伴');
    expect(labelOf(nodes, 'kill:0')).not.toContain('同伴');
    expect(labelOf(table(s, 2).t.build(0), 'kill:3')).toContain('同伴');
    expect(drawAll(table(s, 0).t.build(0)).join('')).not.toContain('同伴');
  });

  it('夜晚：自首或不自首', () => {
    const s = newState(5);
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    const plain = s.players.find((p) => !p.witchFaction)!.seat;
    const a = table(s, plain);
    tap(a.t.build(0), 'no-confess');
    expect(a.ctl.act).toHaveBeenCalledWith({ type: 'confess', tryalId: null });
    const b = table(s, plain);
    const id = s.players[plain].tryals[0].id;
    expect(canTap(b.t.build(0), 'confirm-confess')).toBe(false);
    tap(b.t.build(0), `confess:${id}`);
    tap(b.t.build(0), 'confirm-confess');
    expect(b.ctl.act).toHaveBeenCalledWith({ type: 'confess', tryalId: id });
  });

  it('小屏 12 人：同时是女巫和警长，自首按钮仍在屏幕内且不重叠', () => {
    const s = newState(12);
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    const c = constable(s);
    const me = s.players[c];
    me.witchFaction = true;
    const other = me.tryals.find((t) => t.kind !== 'constable');
    if (other) other.kind = 'witch';
    const { ctl, t } = table(s, c, SMALL);
    const nodes = t.build(0);
    drawAll(nodes);
    expect(has(nodes, 'kill:0')).toBe(true);
    expect(has(nodes, `protect:${(c + 1) % 12}`)).toBe(true);
    expectNightFits(nodes, SMALL);
    tap(nodes, 'no-confess');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'confess', tryalId: null });
  });

  it('普通屏幕单一角色：自首按钮在屏幕内且不重叠', () => {
    const s = newState(5);
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    const plain = s.players.find((p) => !p.witchFaction)!.seat;
    expectNightFits(table(s, plain).t.build(0), SCREEN);
  });

  it('请求进行中确认按钮显示「处理中」', () => {
    const s = newState(5);
    s.phase = { kind: 'trialReveal', target: 2, initiator: 0 };
    expect(labelOf(table(s, 2, SCREEN, true).t.build(0), 'confirm-reveal')).toBe('处理中');
    s.phase = { kind: 'conspiracyPick' };
    expect(labelOf(table(s, 0, SCREEN, true).t.build(0), 'confirm-pick')).toBe('处理中');
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    const plain = s.players.find((p) => !p.witchFaction)!.seat;
    const nodes = table(s, plain, SCREEN, true).t.build(0);
    expect(labelOf(nodes, 'no-confess')).toBe('处理中');
    expect(labelOf(nodes, 'confirm-confess')).toBe('处理中');
  });

  it('已经自首后不再显示自首按钮', () => {
    const s = newState(5);
    s.phase = { kind: 'night' };
    const plain = s.players.find((p) => !p.witchFaction)!.seat;
    s.night = { witchVotes: {}, protect: null, confessions: { [plain]: null } };
    const nodes = table(s, plain).t.build(0);
    expect(has(nodes, 'no-confess')).toBe(false);
  });
});

describe('结算页', () => {
  it('显示胜负和每个人的阵营，可以回首页', () => {
    const s = newState(5);
    s.phase = { kind: 'ended', winner: 'witch' };
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0) });
    const nodes = new ResultScene(fakeUi(ctl)).build(0);
    const text = drawAll(nodes).join('');
    expect(text).toContain('女巫胜利');
    expect(text).toContain('女巫阵营');
    expect(text).toContain('P4');
    tap(nodes, 'result-home');
    expect(ctl.backHome).toHaveBeenCalled();
  });
});

describe('选角色', () => {
  function picking(screen: Screen = SCREEN) {
    const s = newState(5);
    s.phase = { kind: 'characterPick' };
    s.characterOffers = {
      0: ['judge', 'maid'],
      1: ['priest', 'child'],
      2: ['farmer', 'beggar'],
      3: ['doctor', 'maiden'],
      4: ['official', 'tailor'],
    };
    return { s, ...table(s, 0, screen) };
  }

  it('两个候选显示技能说明；点一个再确认', () => {
    const { ctl, t } = picking();
    const nodes = t.build(0);
    const text = drawAll(nodes).join('');
    expect(text).toContain('法官');
    expect(text).toContain('女仆');
    expect(canTap(nodes, 'confirm-character')).toBe(false);
    tap(nodes, 'character:maid');
    tap(t.build(0), 'confirm-character');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'pickCharacter', index: 1 });
  });

  it('小屏上确认按钮在屏幕内', () => {
    const { t } = picking(SMALL);
    const r = rectOf(t.build(0), 'confirm-character');
    expect(r.y + r.h).toBeLessThanOrEqual(SMALL.bottom);
  });

  it('自己选完后显示等待其他人', () => {
    const { s } = picking();
    s.players[0].character = 'judge';
    const text = drawAll(table(s, 0).t.build(0)).join('');
    expect(text).toContain('等待其他人选择角色（1/5）');
  });
});

describe('官员', () => {
  it('夜晚多一个「不翻牌自首」按钮；小屏 12 人也放得下', () => {
    const s = newState(12);
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    const me = s.players.find((p) => !p.witchFaction && p.seat !== constable(s))!.seat;
    s.players[me].character = 'official';
    const { ctl, t } = table(s, me, SMALL);
    const nodes = t.build(0);
    const silent = rectOf(nodes, 'silent-confess');
    expect(labelOf(nodes, 'silent-confess')).toContain('剩 1 次');
    expect(bottomOf(nodes, /^(kill|protect|suspect):/)).toBeLessThanOrEqual(silent.y);
    expect(bottomOf(nodes, /^confess:/) + 20).toBeLessThanOrEqual(silent.y);
    expect(silent.y + silent.h).toBeLessThanOrEqual(rectOf(nodes, 'no-confess').y);
    tap(nodes, 'silent-confess');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'confess', tryalId: null, silent: true });
  });

  it('不是官员没有这个按钮', () => {
    const s = newState(5);
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    const plain = s.players.find((p) => !p.witchFaction)!.seat;
    expect(has(table(s, plain).t.build(0), 'silent-confess')).toBe(false);
  });
});
