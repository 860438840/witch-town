import type { GameState } from '../../engine/src/index';
import type { Screen } from '../src/core/app';
import { drawNodes, findNode, type Node } from '../src/core/node';
import { Animator } from '../src/core/tween';
import type { Controller } from '../src/controller';
import { TableScene } from '../src/scenes/table';
import type { Ui } from '../src/scenes/ui';
import { setSurfaceFactory } from '../src/theme/art/cache';
import { giveCard, handOf, lobbyRoom, newState, roomOf, setDay } from '../test/fixtures';

/** 把真实的界面场景（用假的控制器和假数据）画在网页上，检查插画接进各界面后的排版 */

export const dpr = Math.min(3, window.devicePixelRatio || 1);
export const SIZES: Screen[] = [
  { W: 375, H: 667, top: 60, bottom: 667 },
  { W: 320, H: 568, top: 64, bottom: 568 },
];

// 和小游戏里一样走「画一次、再贴图」的缓存路径
setSurfaceFactory((w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { canvas: c, ctx: c.getContext('2d') as CanvasRenderingContext2D };
}, dpr);

export function ctlFor(over: Record<string, unknown>): Controller {
  return {
    code: '1234',
    openid: 'u0',
    busy: false,
    room: null,
    hand: null,
    nickname: '小明',
    setNickname: () => true,
    act: async () => {},
    ...over,
  } as unknown as Controller;
}

export function uiFor(ctl: Controller, screen: Screen): Ui {
  return {
    screen,
    animator: new Animator(),
    ctl,
    render: () => {},
    prompt: () => {},
    confirm: () => {},
    copy: () => {},
    share: () => {},
  };
}

export function shot(title: string, size: Screen, build: (ui: Ui) => Node[], ctl: Controller): void {
  const ui = uiFor(ctl, size);
  const fig = document.createElement('figure');
  const c = document.createElement('canvas');
  c.width = Math.round(size.W * dpr);
  c.height = Math.round(size.H * dpr);
  c.style.width = `${size.W}px`;
  c.style.height = `${size.H}px`;
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(dpr, dpr);
  drawNodes(ctx, build(ui));
  const cap = document.createElement('figcaption');
  cap.textContent = `${title} ${size.W}×${size.H}`;
  fig.append(c, cap);
  document.getElementById('screens')?.append(fig);
}

export function table(s: GameState, seat = 0, over: Record<string, unknown> = {}): { ctl: Controller; scene: (ui: Ui) => TableScene } {
  const ctl = ctlFor({ room: roomOf(s), hand: handOf(s, seat), openid: `u${seat}`, ...over });
  return { ctl, scene: (ui) => new TableScene(ui) };
}

/** 6 人局：每人有角色，几个人面前有蓝卡，我有各种手牌 */
export function busy(): GameState {
  const s = newState(6);
  setDay(s, 0);
  const chars = ['judge', 'priest', 'tailor', 'farmer', 'maid', 'strongman'] as const;
  s.players.forEach((p, i) => (p.character = chars[i]));
  for (const k of ['night', 'conspiracy', 'matchmaker', 'alibi'] as const) giveCard(s, 0, k === 'night' || k === 'conspiracy' ? 'accusation' : k);
  giveCard(s, 0, 'witness');
  giveCard(s, 0, 'blackCat');
  s.players[2].blue.push({ id: 'b1', kind: 'blackCat' }, { id: 'b2', kind: 'asylum' });
  s.players[3].green.push({ id: 'g1', kind: 'stocks' });
  s.players[1].red.push({ id: 'r1', kind: 'evidence', points: 3 });
  s.discard.push(...s.players[4].hand.splice(0, 3), ...s.players[5].hand.splice(0, 2));
  return s;
}

