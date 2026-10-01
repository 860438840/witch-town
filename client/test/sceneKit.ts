import { vi } from 'vitest';
import type { Screen } from '../src/core/app';
import { drawNodes, findNode, type Node } from '../src/core/node';
import { Animator } from '../src/core/tween';
import type { Controller } from '../src/controller';
import type { Ui } from '../src/scenes/ui';
import { fakeCtx } from './fakes';

export const SCREEN: Screen = { W: 375, H: 667, top: 60, bottom: 667 };

export function fakeCtl(over: Record<string, unknown> = {}): Controller {
  return {
    code: '1234',
    openid: 'u0',
    busy: false,
    room: null,
    hand: null,
    nickname: '小明',
    setNickname: vi.fn(() => true),
    createRoom: vi.fn(async () => {}),
    joinRoom: vi.fn(async () => {}),
    leaveRoom: vi.fn(async () => {}),
    addBot: vi.fn(async () => {}),
    moveSeat: vi.fn(async () => {}),
    startGame: vi.fn(async () => {}),
    act: vi.fn(async () => {}),
    backHome: vi.fn(),
    onShow: vi.fn(),
    ...over,
  } as unknown as Controller;
}

export function fakeUi(ctl: Controller, screen: Screen = SCREEN) {
  const ui = {
    screen,
    animator: new Animator(),
    ctl,
    render: vi.fn(),
    prompt: vi.fn((_t: string, _p: string, _cb: (text: string) => void, _c?: boolean) => {}),
    confirm: vi.fn((_t: string, _c: string, cb: () => void) => cb()),
    copy: vi.fn(),
    share: vi.fn(),
  };
  return ui satisfies Ui;
}

export function tap(nodes: Node[], id: string): void {
  const n = findNode(nodes, id);
  if (!n?.onTap) throw new Error(`没有可点击的节点：${id}`);
  n.onTap();
}

export const has = (nodes: Node[], id: string): boolean => findNode(nodes, id) !== null;
export const canTap = (nodes: Node[], id: string): boolean => !!findNode(nodes, id)?.onTap;

/** 某个节点画出的文字（按钮就是它的文字） */
export function labelOf(nodes: Node[], id: string): string {
  const n = findNode(nodes, id);
  if (!n) throw new Error(`没有节点：${id}`);
  return drawAll([n]).join('');
}

/** 把节点画到假画布上，返回画出的所有文字（同时检查绘制不报错） */
export function drawAll(nodes: Node[]): string[] {
  const { ctx, texts } = fakeCtx();
  drawNodes(ctx, nodes);
  return texts;
}
