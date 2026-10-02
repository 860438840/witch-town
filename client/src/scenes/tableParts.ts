import type { PublicPlayer } from '../../../engine/src/index';
import type { Rect } from '../core/geom';
import type { Ctx } from '../core/node';
import { charLabel } from '../model/characters';
import type { TableModel } from '../model/table';
import { drawBadge, drawCardFace, drawPanel, drawText, drawTryalChip, roundRect } from '../theme/draw';
import { C, goldGlow } from '../theme/palette';

export interface CellOpts {
  /** 当前回合 */
  turn: boolean;
  /** 金色光晕强度 0–1 */
  glow: number;
  /** 出牌时可选为目标 */
  targetable: boolean;
  /** 已被选为第几个目标（0 = 没有） */
  order: number;
  /** 整格透明度（死亡变灰） */
  alpha: number;
  /** 身份卡翻转动画：第 index 张，进度 p（0→1） */
  flip: { index: number; p: number } | null;
  /** 是我的女巫同伴（只有女巫阵营的人会看到） */
  partner: boolean;
}

function tryalRow(ctx: Ctx, p: PublicPlayer, cx: number, y: number, h: number, flip: CellOpts['flip']): void {
  const n = p.tryals.length;
  const cw = Math.round(h * 0.75);
  const gap = 3;
  const x0 = cx - (n * cw + (n - 1) * gap) / 2;
  p.tryals.forEach((t, i) => {
    const r = { x: x0 + i * (cw + gap), y, w: cw, h };
    if (flip && flip.index === i && flip.p < 1) {
      if (flip.p < 0.5) drawTryalChip(ctx, r, null, false, 1 - flip.p * 2);
      else drawTryalChip(ctx, r, t.kind, true, flip.p * 2 - 1);
    } else {
      drawTryalChip(ctx, r, t.kind, t.revealed);
    }
  });
}

function redBar(ctx: Ctx, p: PublicPlayer, x: number, y: number, w: number): void {
  const bar = { x, y, w, h: 4 };
  roundRect(ctx, bar, 2);
  ctx.fillStyle = C.lineDark;
  ctx.fill();
  const ratio = Math.min(1, p.redTotal / Math.max(1, p.threshold));
  if (ratio > 0) {
    roundRect(ctx, { ...bar, w: w * ratio }, 2);
    ctx.fillStyle = C.danger;
    ctx.fill();
  }
}

/** 面前的蓝卡、绿卡：从右往左排 10×14 的迷你卡面，放不下的不画 */
function frontCards(ctx: Ctx, p: PublicPlayer, right: number, cy: number, maxW: number): void {
  const cards = [...p.blue, ...p.green];
  const n = Math.min(cards.length, Math.floor((maxW + 2) / 12));
  for (let i = 0; i < n; i++) drawCardFace(ctx, { x: right - 10 - i * 12, y: cy - 7, w: 10, h: 14 }, cards[i].kind);
}

/** 格子里的名字：角色在前，昵称在后（太长时截掉的是昵称） */
function cellName(p: PublicPlayer): string {
  const label = charLabel(p);
  return label ? `${label}·${p.name}` : p.name;
}

export function drawCell(ctx: Ctx, r: Rect, p: PublicPlayer, o: CellOpts): void {
  ctx.globalAlpha = o.alpha;
  drawPanel(ctx, r, {
    tint: o.targetable ? goldGlow(0.14) : undefined,
    stroke: o.turn || o.targetable || o.order ? C.gold : o.partner ? C.danger : !p.alive ? C.greyLine : undefined,
    glow: o.turn ? o.glow : 0,
    lineWidth: o.turn || o.order ? 2 : 1,
  });
  const cx = r.x + r.w / 2;
  // 同伴标记放在右上角；出牌选目标时那里显示①②
  const tag = o.partner && !o.order;
  if (r.h >= 70) {
    drawBadge(ctx, cx, r.y + 17, 12, p.name, p.seat, p.character);
    drawText(ctx, cellName(p), cx, r.y + 38, { size: 11, align: 'center', maxWidth: r.w - 6 });
    redBar(ctx, p, r.x + 6, r.y + 47, r.w - 12);
    tryalRow(ctx, p, cx, r.y + 55, 11, o.flip);
    if (r.h >= 80) {
      drawText(ctx, `手${p.handCount}`, r.x + 6, r.y + r.h - 9, { size: 10, color: C.textDim });
      frontCards(ctx, p, r.x + r.w - 6, r.y + r.h - 9, r.w - 34);
    }
  } else {
    drawBadge(ctx, r.x + 13, r.y + 13, 9, p.name, p.seat, p.character);
    drawText(ctx, cellName(p), r.x + 26, r.y + 13, { size: 11, maxWidth: r.w - (tag ? 52 : 30) });
    redBar(ctx, p, r.x + 5, r.y + 27, r.w - 10);
    tryalRow(ctx, p, cx, r.y + 34, 10, o.flip);
  }
  if (!p.alive) drawText(ctx, '出局', cx, r.y + r.h / 2, { size: 13, bold: true, color: C.badgeText, align: 'center' });
  if (o.order) drawText(ctx, o.order === 1 ? '①' : '②', r.x + r.w - 9, r.y + 10, { size: 12, bold: true, color: C.gold, align: 'center' });
  else if (tag) drawText(ctx, '同伴', r.x + r.w - 5, r.y + 10, { size: 9, bold: true, color: C.dangerText, align: 'right' });
  ctx.globalAlpha = 1;
}

export function drawMeBar(ctx: Ctx, r: Rect, m: TableModel, o: { targetable: boolean; order: number; glow: number }): void {
  drawPanel(ctx, r, {
    tier: 'strip',
    tint: o.targetable ? goldGlow(0.14) : undefined,
    stroke: o.targetable || o.order || m.isMyTurn ? C.gold : m.me && !m.me.alive ? C.greyLine : undefined,
    glow: m.isMyTurn ? o.glow : 0,
    lineWidth: o.order || m.isMyTurn ? 2 : 1,
  });
  const me = m.me;
  const cy = r.y + r.h / 2;
  if (!me) {
    drawText(ctx, '你在观战', r.x + 12, cy, { size: 13, color: C.textDim });
    return;
  }
  drawBadge(ctx, r.x + 20, cy, Math.min(13, r.h / 2 - 3), me.name, me.seat, me.character);
  const status = me.alive ? `指控 ${me.redTotal}/${me.threshold} · 手牌 ${me.handCount}` : '你已出局';
  const label = charLabel(me);
  drawText(ctx, `你（${label ? `${label}·` : ''}${me.name}）  ${status}`, r.x + 40, cy, { size: 12, maxWidth: r.w - 130 });
  drawText(ctx, '我的身份卡 ›', r.x + r.w - 10, cy, { size: 12, color: C.gold, align: 'right' });
  if (o.order) drawText(ctx, o.order === 1 ? '①' : '②', r.x + r.w - 96, cy, { size: 12, bold: true, color: C.gold, align: 'center' });
}
