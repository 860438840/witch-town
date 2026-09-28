import { describe, expect, it } from 'vitest';
import type { Screen } from '../src/core/app';
import { TableScene } from '../src/scenes/table';
import { tableLayout } from '../src/scenes/tableLayout';
import { giveCard, handOf, newState, roomOf, setDay } from './fixtures';
import { canTap, drawAll, fakeCtl, fakeUi, has, labelOf, tap } from './sceneKit';
import type { GameState } from '../../engine/src/index';

function scene(s: GameState, seat = 0, over: Record<string, unknown> = {}) {
  const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, seat), openid: `u${seat}`, ...over });
  const ui = fakeUi(ctl);
  return { ctl, ui, scene: new TableScene(ui) };
}

describe('布局', () => {
  const screens: Screen[] = [
    { W: 320, H: 568, top: 64, bottom: 568 },
    { W: 375, H: 667, top: 60, bottom: 667 },
    { W: 414, H: 896, top: 92, bottom: 862 },
  ];
  for (const sc of screens) {
    for (const others of [3, 11]) {
      it(`${sc.W}×${sc.H}，${others + 1} 人时各区域不重叠`, () => {
        const L = tableLayout(sc, others);
        expect(L.grid).toHaveLength(others);
        expect(L.cellH).toBeGreaterThanOrEqual(48);
        for (const c of L.grid) {
          expect(c.y).toBeGreaterThanOrEqual(L.top.y + L.top.h);
          expect(c.y + c.h).toBeLessThanOrEqual(L.log.y + 0.01);
          expect(c.x + c.w).toBeLessThanOrEqual(sc.W - 12 + 0.01);
        }
        expect(L.log.y + L.log.h).toBeLessThanOrEqual(L.me.y);
        expect(L.me.y + L.me.h).toBeLessThanOrEqual(L.info.y);
        expect(L.info.y + L.info.h).toBeLessThanOrEqual(L.hand.y);
        expect(L.hand.y + L.hand.h).toBeLessThanOrEqual(L.buttons.y);
        expect(L.buttons.y + L.buttons.h).toBeLessThanOrEqual(sc.bottom);
      });
    }
  }
});

describe('游戏桌', () => {
  it('轮到我时可以抽 2 张', () => {
    const s = newState(5);
    setDay(s, 0);
    const { ctl, scene: t } = scene(s);
    const nodes = t.build(0);
    drawAll(nodes);
    tap(nodes, 'draw');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'draw' });
  });

  it('不是我的回合时没有操作按钮', () => {
    const s = newState(5);
    setDay(s, 1);
    const nodes = scene(s).scene.build(0);
    expect(has(nodes, 'draw')).toBe(false);
    expect(drawAll(nodes).join('')).toContain('等待 P1 行动');
  });

  it('请求进行中按钮不可点，显示「处理中」', () => {
    const s = newState(5);
    setDay(s, 0);
    giveCard(s, 0, 'accusation', 'acc-1');
    const { scene: t } = scene(s, 0, { busy: true });
    const nodes = t.build(0);
    expect(canTap(nodes, 'draw')).toBe(false);
    expect(labelOf(nodes, 'draw')).toBe('处理中');
    tap(nodes, 'card:acc-1');
    tap(t.build(0), 'seat:2');
    const ready = t.build(0);
    expect(canTap(ready, 'confirm-play')).toBe(false);
    expect(labelOf(ready, 'confirm-play')).toBe('处理中');
    expect(labelOf(ready, 'cancel')).toBe('取消');
    setDay(s, 0, 'playing');
    expect(labelOf(scene(s, 0, { busy: true }).scene.build(0), 'end-turn')).toBe('处理中');
  });

  it('出指控：选牌 → 选目标 → 确认', () => {
    const s = newState(5);
    setDay(s, 0);
    giveCard(s, 0, 'accusation', 'acc-1');
    const { ctl, scene: t } = scene(s);
    tap(t.build(0), 'card:acc-1');
    let nodes = t.build(0);
    expect(canTap(nodes, 'confirm-play')).toBe(false);
    tap(nodes, 'seat:2');
    nodes = t.build(0);
    tap(nodes, 'confirm-play');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'play', cardId: 'acc-1', targets: [2] });
  });

  it('红卡不能选信徒持有者；再点一次已选目标可以取消', () => {
    const s = newState(5);
    setDay(s, 0);
    s.players[3].blue.push({ id: 'piety-1', kind: 'piety' });
    giveCard(s, 0, 'accusation', 'acc-1');
    const { scene: t } = scene(s);
    tap(t.build(0), 'card:acc-1');
    tap(t.build(0), 'seat:3');
    expect(canTap(t.build(0), 'confirm-play')).toBe(false);
    tap(t.build(0), 'seat:2');
    expect(canTap(t.build(0), 'confirm-play')).toBe(true);
    tap(t.build(0), 'seat:2');
    expect(canTap(t.build(0), 'confirm-play')).toBe(false);
  });

  it('抢劫要选两个目标', () => {
    const s = newState(5);
    setDay(s, 0);
    giveCard(s, 0, 'robbery', 'rob-1');
    const { ctl, scene: t } = scene(s);
    tap(t.build(0), 'card:rob-1');
    tap(t.build(0), 'seat:1');
    expect(canTap(t.build(0), 'confirm-play')).toBe(false);
    tap(t.build(0), 'seat:3');
    tap(t.build(0), 'confirm-play');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'play', cardId: 'rob-1', targets: [1, 3] });
  });

  it('诅咒：目标有两张蓝卡时要选一张；只有一张时自动选', () => {
    const s = newState(5);
    setDay(s, 0);
    s.players[1].blue.push({ id: 'asylum-1', kind: 'asylum' }, { id: 'piety-1', kind: 'piety' });
    s.players[2].blue.push({ id: 'matchmaker-1', kind: 'matchmaker' });
    giveCard(s, 0, 'curse', 'curse-1');
    const a = scene(s);
    tap(a.scene.build(0), 'card:curse-1');
    tap(a.scene.build(0), 'seat:1');
    tap(a.scene.build(0), 'option:piety-1');
    tap(a.scene.build(0), 'confirm-play');
    expect(a.ctl.act).toHaveBeenCalledWith({ type: 'play', cardId: 'curse-1', targets: [1], option: 'piety-1' });
    const b = scene(s);
    tap(b.scene.build(0), 'card:curse-1');
    tap(b.scene.build(0), 'seat:2');
    tap(b.scene.build(0), 'confirm-play');
    expect(b.ctl.act).toHaveBeenCalledWith({ type: 'play', cardId: 'curse-1', targets: [2], option: 'matchmaker-1' });
  });

  it('蓝卡可以打给自己（点我的信息栏）', () => {
    const s = newState(5);
    setDay(s, 0);
    giveCard(s, 0, 'asylum', 'asy-1');
    const { ctl, scene: t } = scene(s);
    tap(t.build(0), 'card:asy-1');
    tap(t.build(0), 'me');
    tap(t.build(0), 'confirm-play');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'play', cardId: 'asy-1', targets: [0] });
  });

  it('出过牌之后可以结束回合', () => {
    const s = newState(5);
    setDay(s, 0, 'playing');
    const { ctl, scene: t } = scene(s);
    tap(t.build(0), 'end-turn');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'endTurn' });
  });

  it('没选牌时点玩家格子打开详情，点我的信息栏打开我的身份卡', () => {
    const s = newState(5);
    setDay(s, 1);
    const { scene: t } = scene(s);
    tap(t.build(0), 'seat:2');
    let nodes = t.build(0);
    expect(drawAll(nodes).join('')).toContain('P2');
    tap(nodes, 'sheet-close');
    expect(has(t.build(0), 'my-tryals')).toBe(false);
    tap(t.build(0), 'me');
    nodes = t.build(0);
    expect(has(nodes, 'my-tryals')).toBe(true);
    expect(drawAll(nodes).join('')).toContain('阵营');
  });

  it('点日志打开完整记录', () => {
    const s = newState(5);
    const { scene: t } = scene(s);
    tap(t.build(0), 'log');
    expect(has(t.build(0), 'log-list')).toBe(true);
  });

  it('顶栏有「离开」按钮：确认后离开牌局', () => {
    const s = newState(5);
    setDay(s, 1);
    const { ctl, ui, scene: t } = scene(s);
    const nodes = t.build(0);
    expect(drawAll(nodes).join('')).toContain('离开');
    tap(nodes, 'leave-game');
    expect(ui.confirm).toHaveBeenCalledWith('离开牌局？', '可以用房号 1234 回来', expect.any(Function));
    expect(ctl.leaveRoom).toHaveBeenCalled();
  });

  it('选择面板打开时不显示「离开」按钮', () => {
    const s = newState(5);
    s.phase = { kind: 'trialReveal', target: 2, initiator: 0 };
    const nodes = scene(s, 2).scene.build(0);
    expect(has(nodes, 'confirm-reveal')).toBe(true);
    expect(has(nodes, 'leave-game')).toBe(false);
  });

  it('我已出局时显示提示', () => {
    const s = newState(5);
    setDay(s, 1);
    s.players[0].alive = false;
    expect(drawAll(scene(s).scene.build(0)).join('')).toContain('你已出局');
  });
});
