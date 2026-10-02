import type { CardKind, CharacterId, TryalKind } from '../../../engine/src/index';
import type { Rect } from '../core/geom';
import type { Ctx } from '../core/node';
import { ellipsize } from '../core/text';
import { TRYAL_SHORT } from '../model/cards';
import { blit } from './art/cache';
import { cardBack, cardFace, charCard, portrait, tryalFace } from './art/frames';
import { paintBackdrop, tableMoon, type Backdrop } from './art/scenes';
import { glow } from './art/shapes';
import { alpha, badgeColor, C, font, goldGlow, nightShade, titleFont } from './palette';

export function roundRect(ctx: Ctx, r: Rect, radius: number): void {
  const rr = Math.max(0, Math.min(radius, r.w / 2, r.h / 2));
  ctx.beginPath();
  ctx.moveTo(r.x + rr, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rr);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rr);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rr);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rr);
  ctx.closePath();
}

export interface TextOpts {
  size?: number;
  color?: string;
  bold?: boolean;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  maxWidth?: number;
  /** 标题体：衬线、加粗（只用于标题、按钮、房间号） */
  serif?: boolean;
}

export function drawText(ctx: Ctx, text: string, x: number, y: number, o: TextOpts = {}): void {
  ctx.font = o.serif ? titleFont(o.size ?? 14) : font(o.size ?? 14, o.bold);
  ctx.fillStyle = o.color ?? C.text;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'middle';
  const t = o.maxWidth ? ellipsize(text, o.maxWidth, (s) => ctx.measureText(s).width) : text;
  ctx.fillText(t, x, y);
}

/** 整屏背景：按场景缓存；darkness 0→1 叠加一层夜色，牌桌的月亮在夜里更亮 */
export function drawSky(ctx: Ctx, W: number, H: number, darkness: number, backdrop: Backdrop = 'table'): void {
  blit(ctx, `sky:${backdrop}`, W, H, (c, w, h) => paintBackdrop(c, w, h, backdrop), 0, 0);
  if (darkness <= 0) return;
  ctx.fillStyle = nightShade(0.55 * darkness);
  ctx.fillRect(0, 0, W, H);
  if (backdrop === 'table') {
    const m = tableMoon(W, H);
    glow(ctx, m.x, m.y, m.r * 4, alpha(C.moon, 0.3 * darkness));
  }
}

export type PanelTier = 'big' | 'normal' | 'strip';

export interface PanelOpts {
  /** 档位：big 大面板（弹窗、事件记录），normal 普通（默认），strip 信息条（外观同 normal） */
  tier?: PanelTier;
  /** 整个替换底色（选中框这类只要线条的用 C.transparent） */
  fill?: string | undefined;
  /** 叠在底色上的一层颜色（可选目标、选中的淡金） */
  tint?: string | undefined;
  stroke?: string | undefined;
  radius?: number;
  glow?: number;
  lineWidth?: number;
}

function diamond(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r, y);
  ctx.closePath();
  ctx.fill();
}

export function drawPanel(ctx: Ctx, r: Rect, o: PanelOpts = {}): void {
  const big = o.tier === 'big';
  const radius = o.radius ?? 8;
  roundRect(ctx, r, radius);
  if (o.glow) {
    ctx.shadowColor = goldGlow(o.glow);
    ctx.shadowBlur = 12;
  }
  if (o.fill !== undefined) ctx.fillStyle = o.fill;
  else {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, big ? C.panelBigTop : C.panelTop);
    g.addColorStop(1, big ? C.panelBigBottom : C.panelBottom);
    ctx.fillStyle = g;
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  if (o.tint !== undefined) {
    ctx.fillStyle = o.tint;
    ctx.fill();
  }
  ctx.lineWidth = o.lineWidth ?? (big ? 1.5 : 1);
  ctx.strokeStyle = o.stroke ?? (big ? C.goldLine : C.goldDark);
  ctx.stroke();
  if (!big) return;
  roundRect(ctx, { x: r.x + 4, y: r.y + 4, w: r.w - 8, h: r.h - 8 }, Math.max(2, radius - 3));
  ctx.lineWidth = 1;
  ctx.strokeStyle = alpha(C.gold, 0.28);
  ctx.stroke();
  if (r.w >= 120) diamond(ctx, r.x + r.w / 2, r.y + 0.5, 4, C.gold);
}

export type ButtonStyle = 'primary' | 'secondary' | 'danger' | 'disabled';

export function drawButton(ctx: Ctx, r: Rect, label: string, kind: ButtonStyle): void {
  const radius = 9;
  roundRect(ctx, r, radius);
  if (kind === 'primary') {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, C.buttonTop);
    g.addColorStop(1, C.buttonBottom);
    ctx.fillStyle = g;
  } else ctx.fillStyle = kind === 'danger' ? C.buttonDangerFill : C.buttonFill;
  ctx.fill();
  ctx.lineWidth = kind === 'primary' ? 1.5 : 1.2;
  ctx.strokeStyle = kind === 'disabled' ? C.greyLine : kind === 'danger' ? C.danger : C.gold;
  ctx.stroke();
  if (kind === 'primary' || kind === 'secondary') {
    roundRect(ctx, { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 }, radius - 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = alpha(C.gold, kind === 'primary' ? 0.35 : 0.25);
    ctx.stroke();
  }
  const color = kind === 'disabled' ? C.textMuted : kind === 'danger' ? C.dangerText : C.gold;
  drawText(ctx, label, r.x + r.w / 2, r.y + r.h / 2, { size: 15, serif: true, color, align: 'center', maxWidth: r.w - 8 });
}

/** 圆形头像：有角色时画角色图标（外圈用座位颜色），没有角色时写名字首字 */
export function drawBadge(ctx: Ctx, cx: number, cy: number, radius: number, name: string, seat: number, character: CharacterId | null = null): void {
  if (character) {
    const size = radius * 2;
    blit(ctx, `portrait:${character}:${((seat % 12) + 12) % 12}`, size, size, (c, w) => portrait(c, w, character, badgeColor(seat)), cx - radius, cy - radius);
    return;
  }
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = badgeColor(seat);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = C.badgeRing;
  ctx.stroke();
  drawText(ctx, [...name][0] ?? '?', cx, cy + 1, { size: Math.round(radius * 1.05), bold: true, color: C.badgeText, align: 'center' });
}

export interface CardOpts {
  selected?: boolean;
  dim?: boolean;
}

const cardRadius = (r: Rect): number => Math.max(3, r.w * 0.07);

export function drawCardFace(ctx: Ctx, r: Rect, kind: CardKind, o: CardOpts = {}): void {
  if (o.dim) ctx.globalAlpha = 0.55;
  if (o.selected) {
    roundRect(ctx, r, cardRadius(r));
    ctx.shadowColor = C.glowStrong;
    ctx.shadowBlur = 14;
    ctx.fillStyle = C.goldLine;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  blit(ctx, `card:${kind}`, r.w, r.h, (c, w, h) => cardFace(c, w, h, kind), r.x, r.y);
  if (o.selected) {
    roundRect(ctx, r, cardRadius(r));
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.gold;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function drawCardBack(ctx: Ctx, r: Rect): void {
  blit(ctx, 'back', r.w, r.h, cardBack, r.x, r.y);
}

export function drawCharCard(ctx: Ctx, r: Rect, id: CharacterId): void {
  blit(ctx, `char:${id}`, r.w, r.h, (c, w, h) => charCard(c, w, h, id), r.x, r.y);
}

/** 宽度小于这个值的身份卡（格子里的）放不下图标，只用颜色区分 */
export const SMALL_CHIP = 16;

/** 身份卡：未翻开是卡背，翻开是身份卡面；很小时用颜色方块。scaleX 用于翻转动画（0→1） */
export function drawTryalChip(ctx: Ctx, r: Rect, kind: TryalKind | null, revealed: boolean, scaleX = 1): void {
  const w = r.w * Math.max(0.05, scaleX);
  const x = r.x + (r.w - w) / 2;
  if (r.w >= SMALL_CHIP) {
    if (revealed && kind) blit(ctx, `tryal:${kind}`, r.w, r.h, (c, cw, ch) => tryalFace(c, cw, ch, kind), x, r.y, w, r.h);
    else blit(ctx, 'back', r.w, r.h, cardBack, x, r.y, w, r.h);
    return;
  }
  const fill = !revealed || !kind ? C.tryalHidden : kind === 'witch' ? C.witch : kind === 'constable' ? C.constable : C.villager;
  roundRect(ctx, { x, y: r.y, w, h: r.h }, 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = revealed ? C.chipRevealedLine : C.goldDark;
  ctx.stroke();
  if (!revealed || !kind) {
    // 像缩小的卡背：中间一个金点
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2, r.y + r.h / 2, Math.max(0.8, w * 0.15), 0, Math.PI * 2);
    ctx.fillStyle = C.goldDark;
    ctx.fill();
    return;
  }
  if (scaleX > 0.6) {
    drawText(ctx, TRYAL_SHORT[kind], r.x + r.w / 2, r.y + r.h / 2 + 0.5, { size: Math.max(8, r.h - 4), color: C.badgeText, align: 'center' });
  }
}

export type IconRef = { card: CardKind } | { char: CharacterId };

/** 列表里的小图标：牌画迷你卡面（宽 = 0.72 × 高），角色画圆头像。返回占用的宽度 */
export function drawIconRef(ctx: Ctx, ref: IconRef, x: number, y: number, h: number): number {
  if ('card' in ref) {
    const w = Math.round(h * 0.72);
    drawCardFace(ctx, { x, y, w, h }, ref.card);
    return w;
  }
  drawBadge(ctx, x + h / 2, y + h / 2, h / 2, '', 0, ref.char);
  return h;
}
