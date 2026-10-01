import { describe, expect, it } from 'vitest';
import { ANIM_MS, diffTables, MAX_VERSION_STEP } from '../src/model/changes';
import { buildTable, type TableModel } from '../src/model/table';
import { RootScene } from '../src/scenes/root';
import { TableScene } from '../src/scenes/table';
import { handOf, newState, roomOf, setDay } from './fixtures';
import { fakeCtl, fakeUi } from './sceneKit';
import { MAX_PLAYERS } from '../../server/src/types';

const model = (s: ReturnType<typeof newState>, seat = 0) => buildTable(roomOf(s), handOf(s, seat), `u${seat}`)!;

describe('diffTables', () => {
  it('MAX_VERSION_STEP 跟着最大人数走（夜晚 tick：保护 1 + 每人认罪 + 每人投票）', () => {
    expect(MAX_VERSION_STEP).toBe(1 + 2 * MAX_PLAYERS);
  });

  it('第一次或换了一局时没有变化', () => {
    const s = newState(5);
    expect(diffTables(null, model(s))).toEqual([]);
  });

  it('换了房间号、日志变短（新的一局）时没有变化', () => {
    const s = newState(5);
    setDay(s, 1);
    const before = model(s);
    s.players[0].hand.push({ id: 'new-1', kind: 'accusation' });
    s.log.push({ t: 'play', seat: 1, kind: 'accusation', targets: [2] });
    const after = model(s);
    expect(diffTables(before, after)).not.toEqual([]);
    expect(diffTables({ ...before, code: '9999' }, after)).toEqual([]);
    expect(diffTables(after, before)).toEqual([]);
  });

  it('version 一下跳太多（漏看了多次更新）时当作全新画面', () => {
    const s = newState(5);
    setDay(s, 1);
    const before = model(s);
    s.players[0].hand.push({ id: 'new-1', kind: 'accusation' });
    s.version = before.view.version + MAX_VERSION_STEP;
    expect(diffTables(before, model(s))).toContainEqual({ kind: 'cardIn', id: 'new-1' });
    s.version += 1;
    expect(diffTables(before, model(s))).toEqual([]);
  });

  it('天亮时天色变亮', () => {
    const s = newState(5);
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    const night = model(s);
    setDay(s, 1);
    expect(diffTables(night, model(s))).toContainEqual({ kind: 'night', on: false });
  });

  it('新手牌、出牌、入夜、死亡、翻牌、换回合、弹出面板', () => {
    const s = newState(5);
    setDay(s, 1);
    const before = model(s);
    s.players[0].hand.push({ id: 'new-1', kind: 'accusation' });
    s.log.push({ t: 'play', seat: 1, kind: 'accusation', targets: [2] });
    s.players[3].alive = false;
    s.players[2].tryals[0].revealed = true;
    s.phase = { kind: 'trialReveal', target: 0, initiator: 1 };
    const after = model(s);
    const changes = diffTables(before, after);
    expect(changes).toContainEqual({ kind: 'cardIn', id: 'new-1' });
    expect(changes).toContainEqual({ kind: 'play', index: before.view.log.length, from: 1, to: 2, card: 'accusation' });
    expect(changes).toContainEqual({ kind: 'death', seat: 3 });
    expect(changes).toContainEqual({ kind: 'reveal', seat: 2, index: 0 });
    expect(changes).toContainEqual({ kind: 'panel' });

    const dayBefore = model(s);
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    expect(diffTables(dayBefore, model(s))).toContainEqual({ kind: 'night', on: true });

    setDay(s, 2);
    const t1 = model(s);
    setDay(s, 3);
    expect(diffTables(t1, model(s))).toContainEqual({ kind: 'turn', seat: 3 });
  });
});

describe('游戏桌动效', () => {
  it('收到新牌时启动滑入动画；入夜时启动天色动画', () => {
    const s = newState(5);
    setDay(s, 0);
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0) }) as unknown as { room: unknown; hand: unknown };
    const ui = fakeUi(ctl as never);
    const t = new TableScene(ui);
    t.build(0);
    s.players[0].hand.push({ id: 'new-1', kind: 'evidence' });
    s.phase = { kind: 'night' };
    s.night = { witchVotes: {}, protect: null, confessions: {} };
    ctl.room = roomOf(s);
    ctl.hand = handOf(s, 0);
    t.build(10);
    expect(ui.animator.running('in:new-1', 20)).toBe(true);
    expect(ui.animator.running('sky', 20)).toBe(true);
  });

  it('数据没变时重画不会重新开始动画', () => {
    const s = newState(5);
    setDay(s, 0);
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0) }) as unknown as { room: unknown; hand: unknown };
    const ui = fakeUi(ctl as never);
    const t = new TableScene(ui);
    t.build(0);
    s.players[0].hand.push({ id: 'new-1', kind: 'evidence' });
    ctl.room = roomOf(s);
    ctl.hand = handOf(s, 0);
    t.build(10);
    t.build(200);
    expect(ui.animator.progress('in:new-1', 10 + ANIM_MS.cardIn)).toBe(1);
  });

  it('轮到某人时按匀速时间闪 3 下，最后停在常亮 0.6', () => {
    class Probe extends TableScene {
      glowAt(m: TableModel, now: number): number {
        return this.anim(m, now).glow;
      }
    }
    const s = newState(5);
    setDay(s, 1);
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0) }) as unknown as { room: unknown; hand: unknown };
    const ui = fakeUi(ctl as never);
    const t = new Probe(ui);
    t.build(0);
    setDay(s, 2);
    ctl.room = roomOf(s);
    ctl.hand = handOf(s, 0);
    t.build(1000);
    expect(ui.animator.running('turn', 1001)).toBe(true);
    const m = model(s);
    expect(t.glowAt(m, 1000)).toBeCloseTo(0.6);
    expect(t.glowAt(m, 1000 + ANIM_MS.turn / 6)).toBeCloseTo(1); // 第一下最亮处在 1/6 时刻
    expect(t.glowAt(m, 1000 + ANIM_MS.turn / 2)).toBeCloseTo(1); // 第二下在正中间
    expect(t.glowAt(m, 1000 + ANIM_MS.turn - 1)).toBeCloseTo(0.6, 2);
    expect(t.glowAt(m, 1000 + ANIM_MS.turn)).toBe(0.6);
  });
});

describe('回到首页再进同一局', () => {
  it('换一张新的游戏桌，不重放离开期间的变化', () => {
    const s = newState(5);
    setDay(s, 0);
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0) }) as unknown as { code: string | null; room: unknown; hand: unknown };
    const ui = fakeUi(ctl as never);
    const root = new RootScene(ui);
    root.build(0);
    ctl.code = null;
    ctl.room = null;
    ctl.hand = null;
    root.build(10);
    s.players[0].hand.push({ id: 'new-1', kind: 'evidence' });
    ctl.code = '1234';
    ctl.room = roomOf(s);
    ctl.hand = handOf(s, 0);
    root.build(20);
    expect(ui.animator.running('in:new-1', 30)).toBe(false);
  });
});
