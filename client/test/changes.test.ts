import { afterEach, describe, expect, it } from 'vitest';
import { ANIM_MS, diffTables, MAX_VERSION_STEP } from '../src/model/changes';
import { buildTable, type TableModel } from '../src/model/table';
import { RootScene } from '../src/scenes/root';
import { TableScene } from '../src/scenes/table';
import { handOf, newState, roomOf, setDay } from './fixtures';
import { fakeCtl, fakeUi } from './sceneKit';
import { MAX_PLAYERS } from '../../server/src/types';
import { setSurfaceFactory } from '../src/theme/art/cache';
import { drawNodes, findNode } from '../src/core/node';
import { fakeCtx, fakeSurfaces } from './fakes';
import { revealTryal } from '../../engine/src/death';

const model = (s: ReturnType<typeof newState>, seat = 0) => buildTable(roomOf(s), handOf(s, seat), `u${seat}`)!;

/** 一个手里有未翻开女巫卡的别人座位，和那张卡 */
const witchSeatOf = (s: ReturnType<typeof newState>) => {
  const seat = s.players.findIndex((p, i) => i !== 0 && p.tryals.some((t) => t.kind === 'witch' && !t.revealed));
  const index = s.players[seat].tryals.findIndex((t) => t.kind === 'witch' && !t.revealed);
  return { seat, index, id: s.players[seat].tryals[index].id };
};

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
    expect(changes).toContainEqual({ kind: 'reveal', seat: 2, index: 0, witch: s.players[2].tryals[0].kind === 'witch' });
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

  it('别人抽牌按张数记；我自己的新牌只算 cardIn', () => {
    const s = newState(5);
    setDay(s, 1);
    const before = model(s);
    s.players[2].hand.push({ id: 'x1', kind: 'evidence' }, { id: 'x2', kind: 'evidence' });
    s.players[0].hand.push({ id: 'mine', kind: 'evidence' });
    s.version += 1;
    const changes = diffTables(before, model(s));
    expect(changes).toContainEqual({ kind: 'draw', seat: 2, count: 2 });
    expect(changes).toContainEqual({ kind: 'cardIn', id: 'mine' });
    expect(changes.filter((c) => c.kind === 'draw')).toHaveLength(1);
  });

  it('手牌变少不算抽牌', () => {
    const s = newState(5);
    setDay(s, 1);
    const before = model(s);
    s.players[2].hand.pop();
    s.version += 1;
    expect(diffTables(before, model(s)).some((c) => c.kind === 'draw')).toBe(false);
  });

  it('受审：新的受审事件', () => {
    const s = newState(5);
    setDay(s, 1);
    const before = model(s);
    s.log.push({ t: 'trial', target: 3, initiator: 1 });
    s.version += 1;
    expect(diffTables(before, model(s))).toContainEqual({ kind: 'trial', seat: 3 });
  });

  it('翻牌时带上是不是女巫', () => {
    const s = newState(5);
    setDay(s, 1);
    const seatW = s.players.findIndex((p) => p.tryals.some((t) => t.kind === 'witch'));
    const iw = s.players[seatW].tryals.findIndex((t) => t.kind === 'witch');
    const seatV = s.players.findIndex((p, i) => i !== seatW && p.tryals.some((t) => t.kind !== 'witch'));
    const iv = s.players[seatV].tryals.findIndex((t) => t.kind !== 'witch');
    const before = model(s);
    s.players[seatW].tryals[iw].revealed = true;
    s.players[seatV].tryals[iv].revealed = true;
    s.version += 1;
    const changes = diffTables(before, model(s));
    expect(changes).toContainEqual({ kind: 'reveal', seat: seatW, index: iw, witch: true });
    expect(changes).toContainEqual({ kind: 'reveal', seat: seatV, index: iv, witch: false });
  });

  it('翻出女巫当场出局：仍然有这张牌的翻牌，死亡连带翻开的其余身份卡不算', () => {
    const s = newState(5);
    setDay(s, 1);
    const w = witchSeatOf(s);
    const before = model(s);
    revealTryal(s, w.seat, w.id, 'trial');
    s.version += 1;
    const changes = diffTables(before, model(s));
    expect(changes).toContainEqual({ kind: 'reveal', seat: w.seat, index: w.index, witch: true });
    expect(changes).toContainEqual({ kind: 'death', seat: w.seat });
    expect(changes.filter((c) => c.kind === 'reveal')).toHaveLength(1);
  });

  it('翻开最后一张（村民）出局：只有这一张的翻牌', () => {
    const s = newState(5);
    setDay(s, 1);
    const seat = s.players.findIndex((p, i) => i !== 0 && p.tryals.every((t) => t.kind !== 'witch'));
    const p = s.players[seat];
    p.tryals.slice(0, -1).forEach((t) => (t.revealed = true));
    const last = p.tryals.length - 1;
    const before = model(s);
    revealTryal(s, seat, p.tryals[last].id, 'trial');
    s.version += 1;
    const changes = diffTables(before, model(s));
    expect(changes).toContainEqual({ kind: 'reveal', seat, index: last, witch: false });
    expect(changes).toContainEqual({ kind: 'death', seat });
    expect(changes.filter((c) => c.kind === 'reveal')).toHaveLength(1);
  });
});

describe('游戏桌动效', () => {
  class Probe extends TableScene {
    at(m: TableModel, now: number) {
      return this.anim(m, now);
    }
  }
  /** 先画一帧，改数据后在 t0 再画一帧（启动动效），返回探针和最新的画面数据 */
  const start = (s: ReturnType<typeof newState>, change: () => void, t0 = 1000) => {
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0) }) as unknown as { room: unknown; hand: unknown };
    const ui = fakeUi(ctl as never);
    const t = new Probe(ui);
    t.build(0);
    change();
    s.version += 1;
    ctl.room = roomOf(s);
    ctl.hand = handOf(s, 0);
    t.build(t0);
    return { t, ui, m: model(s) };
  };
  afterEach(() => setSurfaceFactory(null));

  it('出牌：中途有一张飞行的牌，结束后没有；到达后目标格子闪光', () => {
    const s = newState(5);
    setDay(s, 1);
    const { t, m } = start(s, () => s.log.push({ t: 'play', seat: 1, kind: 'accusation', targets: [3] }));
    expect(t.at(m, 1000 + ANIM_MS.play / 2).overlay).toHaveLength(1);
    expect(t.at(m, 1000 + ANIM_MS.play / 2).cell(3).flash ?? null).toBeNull();
    expect(t.at(m, 1000 + ANIM_MS.play + ANIM_MS.hit / 2).cell(3).flash).toEqual(expect.any(String));
    expect(t.at(m, 1000 + ANIM_MS.play + ANIM_MS.hit).overlay).toHaveLength(0);
  });

  it('别人抽两张：两张小卡背先后飞出', () => {
    const s = newState(5);
    setDay(s, 2);
    const { t, m } = start(s, () => s.players[2].hand.push({ id: 'x1', kind: 'evidence' }, { id: 'x2', kind: 'evidence' }));
    expect(t.at(m, 1000 + 10).overlay).toHaveLength(1);
    expect(t.at(m, 1000 + ANIM_MS.cardStagger + 10).overlay).toHaveLength(2);
    expect(t.at(m, 1000 + ANIM_MS.cardStagger + ANIM_MS.othersDraw).overlay).toHaveLength(0);
  });

  it('我一次抽两张：第二张晚一点才开始', () => {
    const s = newState(5);
    setDay(s, 0);
    const { t, m } = start(s, () => s.players[0].hand.push({ id: 'n1', kind: 'evidence' }, { id: 'n2', kind: 'evidence' }));
    const a = t.at(m, 1000 + 10);
    expect(a.cardIn('n1')).not.toBeNull();
    expect(a.cardIn('n2')).toBeNull();
    expect(t.at(m, 1000 + ANIM_MS.cardStagger + 10).cardIn('n2')).not.toBeNull();
    expect(t.at(m, 1000 + ANIM_MS.cardStagger + ANIM_MS.cardIn).cardIn('n2')).toBe(1);
  });

  it('受审：中途晃动并闪红光，结束后恢复', () => {
    const s = newState(5);
    setDay(s, 1);
    const { t, m } = start(s, () => s.log.push({ t: 'trial', target: 2, initiator: 1 }));
    const mid = t.at(m, 1000 + ANIM_MS.trial / 4).cell(2);
    expect(Math.abs(mid.shake ?? 0)).toBeGreaterThan(0.5);
    expect(mid.flash).toEqual(expect.any(String));
    const end = t.at(m, 1000 + ANIM_MS.trial).cell(2);
    expect(end.shake ?? 0).toBe(0);
    expect(end.flash ?? null).toBeNull();
  });

  it('翻出女巫：翻完后冒红光；翻出村民不冒', () => {
    const s = newState(5);
    setDay(s, 1);
    const seatW = s.players.findIndex((p) => p.tryals.some((x) => x.kind === 'witch'));
    const iw = s.players[seatW].tryals.findIndex((x) => x.kind === 'witch');
    const seatV = s.players.findIndex((p, i) => i !== seatW && p.tryals.some((x) => x.kind !== 'witch'));
    const iv = s.players[seatV].tryals.findIndex((x) => x.kind !== 'witch');
    const { t, m } = start(s, () => {
      s.players[seatW].tryals[iw].revealed = true;
      s.players[seatV].tryals[iv].revealed = true;
    });
    const at = 1000 + ANIM_MS.reveal + ANIM_MS.burst / 2;
    expect(t.at(m, at).cell(seatW).flash).toEqual(expect.any(String));
    expect(t.at(m, at).cell(seatV).flash ?? null).toBeNull();
    expect(t.at(m, 1000 + ANIM_MS.reveal / 2).cell(seatW).flash ?? null).toBeNull();
  });

  it('翻出女巫当场出局：先翻牌、再冒红光，之后才盖出局印章', () => {
    const s = newState(5);
    setDay(s, 1);
    const w = witchSeatOf(s);
    const { t, m } = start(s, () => revealTryal(s, w.seat, w.id, 'trial'));
    const flipping = t.at(m, 1000 + ANIM_MS.reveal / 2).cell(w.seat);
    expect(flipping.flip).toEqual({ index: w.index, p: expect.any(Number) });
    expect(flipping.alpha).toBe(1);
    expect(flipping.stamp).toBe(0);
    const bursting = t.at(m, 1000 + ANIM_MS.reveal + ANIM_MS.burst / 2).cell(w.seat);
    expect(bursting.flash).toEqual(expect.any(String));
    expect(bursting.stamp).toBe(0);
    expect(t.at(m, 1000 + ANIM_MS.reveal + ANIM_MS.burst + ANIM_MS.death).cell(w.seat).stamp).toBe(1);
  });

  it('控告引发受审：等牌飞到才晃动', () => {
    const s = newState(5);
    setDay(s, 1);
    const { t, m } = start(s, () => {
      s.log.push({ t: 'play', seat: 1, kind: 'accusation', targets: [2] });
      s.log.push({ t: 'trial', target: 2, initiator: 1 });
    });
    // 不等的话 trial/4 正是晃得最明显的时刻；此时牌还在飞
    expect(ANIM_MS.trial / 4).toBeLessThan(ANIM_MS.play);
    for (const dt of [ANIM_MS.trial / 4, ANIM_MS.play / 2]) {
      const flying = t.at(m, 1000 + dt).cell(2);
      expect(flying.shake ?? 0).toBe(0);
      expect(flying.flash ?? null).toBeNull();
    }
    expect(Math.abs(t.at(m, 1000 + ANIM_MS.play + ANIM_MS.trial / 4).cell(2).shake ?? 0)).toBeGreaterThan(0.5);
  });

  it('出局：印章盖到一半，结束后盖好', () => {
    const s = newState(5);
    setDay(s, 1);
    const { t, m } = start(s, () => (s.players[3].alive = false));
    const half = t.at(m, 1000 + ANIM_MS.death / 2).cell(3).stamp!;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(1);
    expect(t.at(m, 1000 + ANIM_MS.death).cell(3).stamp).toBe(1);
  });

  it('入夜的天色渐变用 ANIM_MS.night', () => {
    const s = newState(5);
    setDay(s, 1);
    const { ui } = start(s, () => {
      s.phase = { kind: 'night' };
      s.night = { witchVotes: {}, protect: null, confessions: {} };
    });
    expect(ui.animator.running('sky', 1000 + ANIM_MS.night - 1)).toBe(true);
    expect(ui.animator.running('sky', 1000 + ANIM_MS.night)).toBe(false);
  });

  it('飞行动效连续画 30 帧，插画缓存里的图数量不变', () => {
    const surfaces = fakeSurfaces();
    setSurfaceFactory(surfaces.factory);
    const s = newState(5);
    setDay(s, 0);
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0) }) as unknown as { room: unknown; hand: unknown };
    const ui = fakeUi(ctl as never);
    const t = new TableScene(ui);
    const { ctx } = fakeCtx();
    drawNodes(ctx, t.build(0));
    s.log.push({ t: 'play', seat: 1, kind: 'accusation', targets: [3] });
    s.players[2].hand.push({ id: 'x1', kind: 'evidence' });
    // 新牌用手里已有的牌种：卡面已在缓存里，飞行中不应再新建任何图
    s.players[0].hand.push({ id: 'n1', kind: s.players[0].hand[0].kind });
    s.version += 1;
    ctl.room = roomOf(s);
    ctl.hand = handOf(s, 0);
    drawNodes(ctx, t.build(1000));
    const after1 = surfaces.created.length;
    for (let i = 1; i <= 30; i++) drawNodes(ctx, t.build(1000 + i * 20));
    expect(surfaces.created.length).toBe(after1);
  });

  it('按住正在飞入的手牌：按下效果按原坐标画，不受飞行的平移缩放影响', () => {
    const s = newState(5);
    setDay(s, 0);
    const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, 0) }) as unknown as { room: unknown; hand: unknown };
    const ui = fakeUi(ctl as never);
    const t = new TableScene(ui);
    t.build(0);
    s.players[0].hand.push({ id: 'n1', kind: 'evidence' });
    s.version += 1;
    ctl.room = roomOf(s);
    ctl.hand = handOf(s, 0);
    t.build(1000);
    const card = findNode(t.build(1000 + ANIM_MS.cardIn / 2), 'card:n1')!;
    const { ctx, calls } = fakeCtx();
    let atShade = -1;
    drawNodes(ctx, [card], card, () => (atShade = calls.length));
    // 按调用记录重放平移、缩放和 save/restore，得到画按下效果时的变换
    type M = { tx: number; ty: number; sx: number; sy: number };
    let cur: M = { tx: 0, ty: 0, sx: 1, sy: 1 };
    const stack: M[] = [];
    for (const [name, args] of calls.slice(0, atShade)) {
      const [a, b] = args as number[];
      if (name === 'save') stack.push({ ...cur });
      if (name === 'restore') cur = stack.pop()!;
      if (name === 'translate') cur = { ...cur, tx: cur.tx + a * cur.sx, ty: cur.ty + b * cur.sy };
      if (name === 'scale') cur = { ...cur, sx: cur.sx * a, sy: cur.sy * b };
    }
    expect(atShade).toBeGreaterThan(0);
    expect(cur).toEqual({ tx: 0, ty: 1, sx: 1, sy: 1 });
  });

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
