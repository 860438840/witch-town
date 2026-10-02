import { USE_LIMITS, type CardKind, type CharacterId, type TryalKind } from '../../../../engine/src/index';
import type { Ctx } from '../../core/node';
import { wrapText } from '../../core/text';
import { CARD_INFO, TRYAL_NAME } from '../../model/cards';
import { CHAR_INFO } from '../../model/characters';
import { alpha, C, CARD_GRADIENT, FRAME_GRADIENT, font, INK, titleFont } from '../palette';
import { CARD_ICONS, CHAR_ICONS, TRYAL_ICONS, type IconFn } from './icons';
import { circle, crescent, glow, hatch, rr, star4 } from './shapes';

/** 卡牌模板都在 (0,0)–(w,h) 里作画，由缓存层负责贴到屏幕上 */

/** 宽度小于这个值的卡面只画图标，不写牌名 */
const TINY_W = 40;
/** 宽度小于这个值的卡面用紧凑排版 */
const SMALL_W = 80;

const RED_POINTS: Partial<Record<CardKind, number>> = { accusation: 1, evidence: 3, witness: 7 };
/** 红卡内框亮度：点数越高越亮 */
const RED_GLOW: Partial<Record<CardKind, number>> = { accusation: 0, evidence: 0.5, witness: 1 };

function vertical(ctx: Ctx, h: number, [top, bottom]: readonly [string, string]): CanvasGradient {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  return g;
}

/** 通用卡框：底色、金边、图框（里面画图标）、牌名 */
function framed(ctx: Ctx, w: number, h: number, colors: readonly [string, string], title: string, art: IconFn, frameGlow = 0): void {
  const r = Math.max(3, w * 0.07);
  rr(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.fillStyle = vertical(ctx, h, colors);
  ctx.fill();
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = Math.max(1, w * 0.012);
  ctx.stroke();
  const tiny = w < TINY_W;
  const small = w < SMALL_W;
  const pad = tiny ? Math.max(2, w * 0.08) : w * (small ? 0.07 : 0.065);
  const aw = w - pad * 2;
  const ah = tiny ? h - pad * 2 : h * (small ? 0.7 : 0.66);
  ctx.save();
  rr(ctx, pad, pad, aw, ah, r * 0.6);
  ctx.clip();
  ctx.fillStyle = alpha(INK.black, 0.35);
  ctx.fillRect(pad, pad, aw, ah);
  if (!small) hatch(ctx, pad, pad, aw, ah, -0.7, w * 0.03, alpha(INK.white, 0.04), 1);
  art(ctx, pad + aw / 2, pad + ah / 2, Math.min(aw, ah * 1.05));
  ctx.restore();
  rr(ctx, pad, pad, aw, ah, r * 0.6);
  ctx.strokeStyle = alpha(C.goldLine, 0.55 + 0.45 * frameGlow);
  ctx.lineWidth = Math.max(0.75, w * (0.008 + 0.012 * frameGlow));
  ctx.stroke();
  if (tiny) return;
  if (!small) {
    ctx.fillStyle = C.goldLine;
    for (const [px, py] of [[0.07, 0.035], [0.93, 0.035], [0.07, 0.965], [0.93, 0.965]]) {
      ctx.save();
      ctx.translate(w * px, h * py);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-w * 0.015, -w * 0.015, w * 0.03, w * 0.03);
      ctx.restore();
    }
  }
  const fs = Math.max(9, Math.round(w * (small ? 0.19 : 0.115)));
  ctx.fillStyle = C.cardText;
  ctx.font = titleFont(fs);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, w / 2, pad + ah + (h - pad - ah) / 2);
}

/** 红卡左上角的点数圆标 */
function pointsBadge(ctx: Ctx, w: number, n: number): void {
  const R = Math.max(5, w * 0.11);
  const p = w * 0.14;
  circle(ctx, p, p, R, INK.wineDark);
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = Math.max(1, R * 0.14);
  ctx.stroke();
  ctx.fillStyle = C.cardText;
  ctx.font = titleFont(Math.round(R * 1.25));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), p, p + R * 0.05);
}

export function cardFace(ctx: Ctx, w: number, h: number, kind: CardKind): void {
  const info = CARD_INFO[kind];
  framed(ctx, w, h, CARD_GRADIENT[info.color], info.name, CARD_ICONS[kind], RED_GLOW[kind] ?? 0);
  const pts = RED_POINTS[kind];
  if (pts !== undefined && w >= 30) pointsBadge(ctx, w, pts);
}

export function cardBack(ctx: Ctx, w: number, h: number): void {
  const r = Math.max(2, w * 0.07);
  rr(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.fillStyle = vertical(ctx, h, FRAME_GRADIENT.back);
  ctx.fill();
  ctx.save();
  ctx.clip();
  hatch(ctx, 0, 0, w, h, Math.PI / 4, Math.max(3, w * 0.09), alpha(C.gold, 0.12), 1);
  hatch(ctx, 0, 0, w, h, -Math.PI / 4, Math.max(3, w * 0.09), alpha(C.gold, 0.12), 1);
  ctx.restore();
  rr(ctx, 0.5, 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = Math.max(1, w * 0.012);
  ctx.stroke();
  if (w >= 24) {
    rr(ctx, w * 0.06, w * 0.06, w * 0.88, h - w * 0.12, r * 0.6);
    ctx.strokeStyle = alpha(C.goldLine, 0.6);
    ctx.stroke();
  }
  const cx = w / 2;
  const cy = h / 2;
  const R = w * 0.3;
  circle(ctx, cx, cy, R * 1.1, FRAME_GRADIENT.back[1]);
  ctx.strokeStyle = C.goldLine;
  ctx.lineWidth = Math.max(1, w * 0.012);
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  if (w >= 24) {
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.78, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const t = (i * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(t) * R, cy + Math.sin(t) * R);
      ctx.lineTo(cx + Math.cos(t) * R * 1.25, cy + Math.sin(t) * R * 1.25);
      ctx.stroke();
    }
  }
  crescent(ctx, cx - R * 0.1, cy, R * 0.55, R * 0.25, -R * 0.12, C.gold);
  star4(ctx, cx + R * 0.32, cy - R * 0.25, R * 0.12, C.gold);
}

export function tryalFace(ctx: Ctx, w: number, h: number, kind: TryalKind): void {
  framed(ctx, w, h, FRAME_GRADIENT[kind], TRYAL_NAME[kind], TRYAL_ICONS[kind]);
}

/** 圆形头像：size×size 的方框里画一个圆，ring 是外圈颜色 */
export function portrait(ctx: Ctx, size: number, id: CharacterId, ring: string): void {
  const R = size / 2 - Math.max(1, size * 0.04);
  const c = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(c, c - R * 0.4, R * 0.1, c, c, R);
  g.addColorStop(0, INK.portraitTop);
  g.addColorStop(1, INK.portraitBottom);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  CHAR_ICONS[id](ctx, c, c + R * 0.05, R * 1.75);
  ctx.restore();
  ctx.strokeStyle = ring;
  ctx.lineWidth = Math.max(1.2, size * 0.05);
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.stroke();
}

/** 角色卡：圆头像、名字绶带、技能说明、限次标记。按 160×240 设计，等比缩放 */
export function charCard(ctx: Ctx, w: number, h: number, id: CharacterId): void {
  const info = CHAR_INFO[id];
  const k = w / 160;
  rr(ctx, 1, 1, w - 2, h - 2, 10 * k);
  ctx.fillStyle = vertical(ctx, h, FRAME_GRADIENT.character);
  ctx.fill();
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  rr(ctx, 6 * k, 6 * k, w - 12 * k, h - 12 * k, 7 * k);
  ctx.strokeStyle = alpha(C.goldLine, 0.45);
  ctx.lineWidth = 1;
  ctx.stroke();
  const R = w * 0.3;
  const cx = w / 2;
  const cy = h * 0.27;
  glow(ctx, cx, cy, R * 1.6, alpha(C.gold, 0.18));
  ctx.save();
  ctx.translate(cx - R - 2, cy - R - 2);
  portrait(ctx, R * 2 + 4, id, C.goldLine);
  ctx.restore();
  // 名字绶带
  const by = h * 0.52;
  const bw = w * 0.78;
  const bh = 24 * k;
  ctx.fillStyle = INK.wineDark;
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2 - 8 * k, by);
  ctx.lineTo(cx - bw / 2 + 4 * k, by + bh / 2);
  ctx.lineTo(cx - bw / 2 - 8 * k, by + bh);
  ctx.lineTo(cx + bw / 2 + 8 * k, by + bh);
  ctx.lineTo(cx + bw / 2 - 4 * k, by + bh / 2);
  ctx.lineTo(cx + bw / 2 + 8 * k, by);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = INK.wine;
  ctx.fillRect(cx - bw / 2 + 4 * k, by - 2 * k, bw - 8 * k, bh + 4 * k);
  ctx.strokeStyle = C.goldLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - bw / 2 + 4 * k, by - 2 * k, bw - 8 * k, bh + 4 * k);
  ctx.fillStyle = C.cardText;
  ctx.font = titleFont(Math.round(15 * k));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(info.name, cx, by + bh / 2 + k);
  // 技能说明
  const size = Math.max(10, Math.round(11 * k));
  ctx.font = font(size);
  ctx.fillStyle = INK.lilacText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines = wrapText(info.desc, w - 28 * k, (s) => ctx.measureText(s).width);
  const lh = size + 5 * k;
  const maxLines = Math.max(1, Math.floor((h - (by + bh + 12 * k) - 8 * k) / lh));
  lines.slice(0, maxLines).forEach((line, i) => ctx.fillText(line, 14 * k, by + bh + 12 * k + i * lh));
  const limit = (USE_LIMITS as Partial<Record<CharacterId, number>>)[id];
  if (limit) {
    const t = `限 ${limit} 次`;
    ctx.font = font(Math.max(9, Math.round(10 * k)), true);
    const tw = ctx.measureText(t).width + 12 * k;
    const th = 18 * k;
    rr(ctx, w - tw - 10 * k, 10 * k, tw, th, th / 2);
    ctx.fillStyle = alpha(C.danger, 0.85);
    ctx.fill();
    ctx.strokeStyle = C.gold;
    ctx.stroke();
    ctx.fillStyle = INK.white;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, w - tw / 2 - 10 * k, 10 * k + th / 2);
  }
}

/** 不带卡框的小图标（格子里「面前的牌」、规则页、弃牌列表） */
export function miniIcon(ctx: Ctx, size: number, kind: CardKind): void {
  CARD_ICONS[kind](ctx, size / 2, size / 2, size);
}

export function miniCharIcon(ctx: Ctx, size: number, id: CharacterId): void {
  CHAR_ICONS[id](ctx, size / 2, size / 2, size);
}
