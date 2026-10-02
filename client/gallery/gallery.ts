import { CHARACTERS, type CardKind, type TryalKind } from '../../engine/src/index';
import { CARD_INFO } from '../src/model/cards';
import { cardBack, cardFace, charCard, portrait, tryalFace } from '../src/theme/art/frames';
import { paintBackdrop, type Backdrop } from '../src/theme/art/scenes';
import { badgeColor } from '../src/theme/palette';

/** 图鉴页：用游戏真实的美术代码把所有图画一遍，供手机上检查。不进小游戏包。 */

const dpr = Math.min(3, window.devicePixelRatio || 1);

function canvas(parent: HTMLElement, w: number, h: number, label: string): CanvasRenderingContext2D {
  const fig = document.createElement('figure');
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  const cap = document.createElement('figcaption');
  cap.textContent = label;
  fig.append(c, cap);
  parent.append(fig);
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  ctx.scale(dpr, dpr);
  return ctx;
}

function section(title: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  const div = document.createElement('div');
  div.className = 'row';
  document.body.append(h, div);
  return div;
}

const kinds = Object.keys(CARD_INFO) as CardKind[];
const tryals: TryalKind[] = ['witch', 'constable', 'villager'];

const big = section('卡牌（放大）');
for (const k of kinds) cardFace(canvas(big, 120, 168, CARD_INFO[k].name), 120, 168, k);
cardBack(canvas(big, 120, 168, '卡背'), 120, 168);

const hand = section('手牌实际大小 58×84 / 小屏 44×64');
for (const k of kinds) cardFace(canvas(hand, 58, 84, ''), 58, 84, k);
for (const k of kinds) cardFace(canvas(hand, 44, 64, ''), 44, 64, k);

const tiny = section('说书人行 28×40、格子里面前的牌 10×14');
for (const k of kinds) cardFace(canvas(tiny, 28, 40, ''), 28, 40, k);
for (const k of kinds) cardFace(canvas(tiny, 10, 14, ''), 10, 14, k);

const ids = section('身份卡');
for (const t of tryals) tryalFace(canvas(ids, 52, 68, ''), 52, 68, t);
cardBack(canvas(ids, 52, 68, ''), 52, 68);
for (const t of tryals) tryalFace(canvas(ids, 120, 168, ''), 120, 168, t);

const chars = section('角色卡');
for (const id of CHARACTERS) charCard(canvas(chars, 160, 240, ''), 160, 240, id);

const heads = section('头像 24 / 18');
CHARACTERS.forEach((id, i) => portrait(canvas(heads, 24, 24, ''), 24, id, badgeColor(i)));
CHARACTERS.forEach((id, i) => portrait(canvas(heads, 18, 18, ''), 18, id, badgeColor(i)));

const scenes = section('场景（375×667）');
for (const b of ['home', 'lobby', 'table', 'village', 'witch'] as Backdrop[]) paintBackdrop(canvas(scenes, 188, 334, b), 188, 334, b);

