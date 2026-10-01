import { describe, expect, it, type Mock } from 'vitest';
import type { GameState } from '../../engine/src/index';
import { findNode } from '../src/core/node';
import { ROW_H } from '../src/scenes/storyBoard';
import { TableScene } from '../src/scenes/table';
import { handOf, newState, roomOf } from './fixtures';
import { drawAll, fakeCtl, fakeUi, has, tap } from './sceneKit';

function view(s: GameState, seat: number) {
  const ctl = fakeCtl({ room: roomOf(s), hand: handOf(s, seat), openid: `u${seat}` });
  return { ctl, t: new TableScene(fakeUi(ctl)) };
}

function telling(): GameState {
  const s = newState(5);
  s.players[0].character = 'storyteller';
  s.phase = { kind: 'storytelling', seat: 0 };
  return s;
}

const sentOrder = (ctl: ReturnType<typeof fakeCtl>): string[] => (ctl.act as Mock).mock.calls.at(-1)![0].order;

describe('说书人调整牌堆', () => {
  it('看到整个牌堆；直接确认时发送原顺序', () => {
    const s = telling();
    const { ctl, t } = view(s, 0);
    const nodes = t.build(0);
    expect(has(nodes, 'story-list')).toBe(true);
    expect(has(nodes, `handle:${s.deck[0].id}`)).toBe(true);
    tap(nodes, 'story-confirm');
    expect(ctl.act).toHaveBeenCalledWith({ type: 'storyReorder', order: s.deck.map((c) => c.id) });
  });

  it('按住第 3 张的把手往上拖两行：它变成第 1 张', () => {
    const s = telling();
    const { ctl, t } = view(s, 0);
    const id = s.deck[2].id;
    const h = findNode(t.build(0), `handle:${id}`)!;
    const x = h.rect.x + 5;
    const y0 = h.rect.y + 10;
    const drag = h.onPress!(x, y0);
    drag.move(x, y0 - 2 * ROW_H);
    drag.end();
    tap(t.build(0), 'story-confirm');
    const order = sentOrder(ctl);
    expect(order[0]).toBe(id);
    expect([...order].sort()).toEqual(s.deck.map((c) => c.id).sort());
  });

  it('拖到列表下边缘停住：自动往下滚，牌被带到牌堆底', () => {
    const s = telling();
    const { ctl, t } = view(s, 0);
    const nodes = t.build(0);
    const id = s.deck[0].id;
    const h = findNode(nodes, `handle:${id}`)!;
    const list = findNode(nodes, 'story-list')!.rect;
    const drag = h.onPress!(h.rect.x + 5, h.rect.y + 10);
    drag.move(h.rect.x + 5, list.y + list.h - 5);
    for (let i = 0; i < 400; i++) drag.frame!();
    drag.end();
    tap(t.build(0), 'story-confirm');
    expect(sentOrder(ctl).at(-1)).toBe(id);
  });

  it('拖动时画出跟手的牌，松手后消失', () => {
    const s = telling();
    const { t } = view(s, 0);
    const h = findNode(t.build(0), `handle:${s.deck[1].id}`)!;
    const drag = h.onPress!(h.rect.x + 5, h.rect.y + 10);
    expect(has(t.build(0), 'story-ghost')).toBe(true);
    drag.end();
    expect(has(t.build(0), 'story-ghost')).toBe(false);
  });

  it('还原：回到原来的顺序', () => {
    const s = telling();
    const { ctl, t } = view(s, 0);
    const h = findNode(t.build(0), `handle:${s.deck[2].id}`)!;
    const drag = h.onPress!(h.rect.x + 5, h.rect.y + 10);
    drag.move(h.rect.x + 5, h.rect.y + 10 - 2 * ROW_H);
    drag.end();
    tap(t.build(0), 'story-reset');
    tap(t.build(0), 'story-confirm');
    expect(sentOrder(ctl)).toEqual(s.deck.map((c) => c.id));
  });

  it('其他人看不到面板，顶栏显示谁在调整牌堆', () => {
    const s = telling();
    const nodes = view(s, 1).t.build(0);
    expect(has(nodes, 'story-list')).toBe(false);
    expect(drawAll(nodes).join('')).toContain('P0 正在调整牌堆');
  });
});
