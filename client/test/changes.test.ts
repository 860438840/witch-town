import { describe, expect, it } from 'vitest';
import { diffTables } from '../src/model/changes';
import { buildTable } from '../src/model/table';
import { TableScene } from '../src/scenes/table';
import { handOf, newState, roomOf, setDay } from './fixtures';
import { fakeCtl, fakeUi } from './sceneKit';

const model = (s: ReturnType<typeof newState>, seat = 0) => buildTable(roomOf(s), handOf(s, seat), `u${seat}`)!;

describe('diffTables', () => {
  it('第一次或换了一局时没有变化', () => {
    const s = newState(5);
    expect(diffTables(null, model(s))).toEqual([]);
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
});
