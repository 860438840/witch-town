import type { CardKind, TryalKind } from '../../../engine/src/index';
import type { Rect } from '../core/geom';
import type { Ctx } from '../core/node';
import { ellipsize, wrapText } from '../core/text';
import { CARD_INFO, TRYAL_SHORT } from '../model/cards';
import { blit } from './art/cache';
import { paintBackdrop, tableMoon, type Backdrop } from './art/scenes';
import { glow } from './art/shapes';
import { alpha, badgeColor, C, CARD_GRADIENT, font, goldGlow, nightShade } from './palette';

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
}

export function drawText(ctx: Ctx, text: string, x: number, y: number, o: TextOpts = {}): void {
  ctx.font = font(o.size ?? 14, o.bold);
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

export interface PanelOpts {
  fill?: string;
  stroke?: string;
  radius?: number;
  glow?: number;
  lineWidth?: number;
}

export function drawPanel(ctx: Ctx, r: Rect, o: PanelOpts = {}): void {
  roundRect(ctx, r, o.radius ?? 8);
  if (o.glow) {
    ctx.shadowColor = goldGlow(o.glow);
    ctx.shadowBlur = 12;
  }
  ctx.fillStyle = o.fill ?? C.panel;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = o.lineWidth ?? 1;
  ctx.strokeStyle = o.stroke ?? C.panelLine;
  ctx.stroke();
}

export type ButtonStyle = 'primary' | 'secondary' | 'danger' | 'disabled';

export function drawButton(ctx: Ctx, r: Rect, label: string, style: ButtonStyle): void {
  if (style === 'primary') {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, C.gold);
    g.addColorStop(1, C.goldDark);
    roundRect(ctx, r, 10);
    ctx.fillStyle = g;
    ctx.fill();
  } else {
    drawPanel(ctx, r, {
      radius: 10,
      fill: style === 'danger' ? C.buttonDangerFill : C.buttonFill,
      stroke: style === 'disabled' ? C.panelLine : style === 'danger' ? C.danger : C.gold,
    });
  }
  const color = style === 'primary' ? C.skyMid : style === 'disabled' ? C.textMuted : style === 'danger' ? C.danger : C.gold;
  drawText(ctx, label, r.x + r.w / 2, r.y + r.h / 2, { size: 15, bold: true, color, align: 'center', maxWidth: r.w - 8 });
}

/** 圆形头像徽章：名字首字 + 座位专属颜色 */
export function drawBadge(ctx: Ctx, cx: number, cy: number, radius: number, name: string, seat: number): void {
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

export function drawCardFace(ctx: Ctx, r: Rect, kind: CardKind, o: CardOpts = {}): void {
  const info = CARD_INFO[kind];
  const [a, b] = CARD_GRADIENT[info.color];
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  if (o.dim) ctx.globalAlpha = 0.55;
  roundRect(ctx, r, 7);
  if (o.selected) {
    ctx.shadowColor = C.glowStrong;
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = o.selected ? 2 : 1;
  ctx.strokeStyle = C.goldLine;
  ctx.stroke();
  drawText(ctx, info.name, r.x + r.w / 2, r.y + 16, { size: 14, bold: true, color: C.cardText, align: 'center' });
  ctx.font = font(9);
  const lines = wrapText(info.desc, r.w - 8, (s) => ctx.measureText(s).width).slice(0, 4);
  lines.forEach((line, i) => drawText(ctx, line, r.x + r.w / 2, r.y + 34 + i * 12, { size: 9, color: C.cardText, align: 'center' }));
  ctx.globalAlpha = 1;
}

/** 身份卡小方块：未翻开是暗色金边；翻开显示种类单字。scaleX 用于翻转动画（0→1） */
export function drawTryalChip(ctx: Ctx, r: Rect, kind: TryalKind | null, revealed: boolean, scaleX = 1): void {
  const w = r.w * Math.max(0.05, scaleX);
  const x = r.x + (r.w - w) / 2;
  const fill = !revealed || !kind ? C.tryalHidden : kind === 'witch' ? C.witch : kind === 'constable' ? C.constable : C.villager;
  roundRect(ctx, { x, y: r.y, w, h: r.h }, 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = revealed ? C.chipRevealedLine : C.goldDark;
  ctx.stroke();
  if (revealed && kind && scaleX > 0.6) {
    drawText(ctx, TRYAL_SHORT[kind], r.x + r.w / 2, r.y + r.h / 2 + 0.5, { size: Math.max(8, r.h - 4), color: C.badgeText, align: 'center' });
  }
}
