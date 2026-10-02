import type { CardKind, CharacterId, TryalKind } from '../../../../engine/src/index';
import type { Ctx } from '../../core/node';
import { alpha, C, FRAME_GRADIENT, INK, titleFont } from '../palette';
import { circle, crescent, fillEllipse, glow, hatch, polygon, polyline, rr, seeded, star4 } from './shapes';

/** 一个图标：以 (cx, cy) 为中心、边长 s 的方框内作画 */
export type IconFn = (ctx: Ctx, cx: number, cy: number, s: number) => void;

/* ---------------------------------------------------------------- 卡牌 */

const blackCat: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy - s * 0.05, s * 0.45, alpha(C.moon, 0.25));
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.05, s * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = C.moon;
  ctx.fill();
  ctx.clip();
  hatch(ctx, cx - s * 0.3, cy - s * 0.35, s * 0.25, s * 0.6, -0.9, s * 0.03, alpha(INK.sepia, 0.35), s * 0.008);
  ctx.restore();
  fillEllipse(ctx, cx, cy + s * 0.14, s * 0.15, s * 0.19, 0, INK.ink);
  circle(ctx, cx + s * 0.01, cy - s * 0.1, s * 0.095, INK.ink);
  polygon(ctx, [[cx - s * 0.085, cy - s * 0.13], [cx - s * 0.07, cy - s * 0.25], [cx - s * 0.01, cy - s * 0.18]], INK.ink);
  polygon(ctx, [[cx + s * 0.1, cy - s * 0.13], [cx + s * 0.09, cy - s * 0.25], [cx + s * 0.03, cy - s * 0.18]], INK.ink);
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = s * 0.045;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.12, cy + s * 0.3);
  ctx.bezierCurveTo(cx + s * 0.32, cy + s * 0.3, cx + s * 0.3, cy + s * 0.05, cx + s * 0.2, cy - s * 0.02);
  ctx.stroke();
  fillEllipse(ctx, cx - s * 0.03, cy - s * 0.1, s * 0.02, s * 0.011, -0.2, C.gold);
  fillEllipse(ctx, cx + s * 0.05, cy - s * 0.1, s * 0.02, s * 0.011, 0.2, C.gold);
  ctx.fillStyle = INK.ink;
  ctx.fillRect(cx - s * 0.4, cy + s * 0.32, s * 0.8, s * 0.2);
};

const night: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.gold, 0.18));
  crescent(ctx, cx - s * 0.03, cy - s * 0.02, s * 0.26, s * 0.12, -s * 0.07, C.moon);
  const r = seeded(7);
  for (let i = 0; i < 9; i++) star4(ctx, cx + (r() - 0.5) * s * 0.8, cy + (r() - 0.5) * s * 0.8, s * (0.015 + r() * 0.025), alpha(INK.white, 0.85));
  for (let i = 0; i < 3; i++) fillEllipse(ctx, cx + (i - 1) * s * 0.2, cy + s * 0.3 + i * s * 0.03, s * 0.28, s * 0.04, 0, alpha(INK.lilac, 0.18));
};

const accusation: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.42, alpha(C.gold, 0.12));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.7);
  ctx.fillStyle = INK.parchment;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.3);
  ctx.bezierCurveTo(-s * 0.13, s * 0.1, -s * 0.12, -s * 0.2, s * 0.02, -s * 0.36);
  ctx.bezierCurveTo(s * 0.08, -s * 0.15, s * 0.06, s * 0.1, 0, s * 0.3);
  ctx.fill();
  ctx.save();
  ctx.clip();
  hatch(ctx, -s * 0.15, -s * 0.4, s * 0.3, s * 0.7, 0.9, s * 0.028, alpha(INK.sepia, 0.45), s * 0.007);
  ctx.restore();
  polyline(ctx, [[0, s * 0.42], [-s * 0.005, s * 0.1], [s * 0.02, -s * 0.34]], s * 0.012, INK.sepia);
  polygon(ctx, [[-s * 0.015, s * 0.38], [s * 0.015, s * 0.38], [0, s * 0.46]], INK.ink);
  ctx.restore();
  for (const [dx, dy, r] of [[-0.24, 0.3, 0.03], [-0.17, 0.34, 0.018], [-0.29, 0.25, 0.014]]) circle(ctx, cx + dx * s, cy + dy * s, r * s, INK.ink);
};

const evidence: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.gold, 0.15));
  const w = s * 0.42;
  const h = s * 0.56;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.fillStyle = INK.parchment;
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  hatch(ctx, x, y, w, h, 0.8, s * 0.035, alpha(INK.sepia, 0.18), s * 0.006);
  ctx.restore();
  ctx.fillStyle = INK.parchmentDark;
  rr(ctx, x - s * 0.03, y - s * 0.04, w + s * 0.06, s * 0.07, s * 0.035);
  ctx.fill();
  rr(ctx, x - s * 0.03, y + h - s * 0.03, w + s * 0.06, s * 0.07, s * 0.035);
  ctx.fill();
  ctx.strokeStyle = alpha(INK.sepiaDark, 0.7);
  ctx.lineWidth = s * 0.012;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ly = y + s * 0.09 + i * s * 0.065;
    const len = w * (i === 5 ? 0.45 : 0.75);
    ctx.moveTo(x + w * 0.12, ly);
    for (let t = 0; t <= len; t += s * 0.03) ctx.lineTo(x + w * 0.12 + t, ly + Math.sin((t * 40) / s + i) * s * 0.006);
  }
  ctx.stroke();
  circle(ctx, x + w * 0.78, y + h * 0.82, s * 0.07, INK.wax);
  star4(ctx, x + w * 0.78, y + h * 0.82, s * 0.04, alpha(C.cardText, 0.8));
};

const witness: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.5, alpha(C.moon, 0.35));
  ctx.strokeStyle = alpha(C.gold, 0.75);
  ctx.lineWidth = s * 0.014;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const t = (i * Math.PI) / 8;
    const r1 = s * 0.3;
    const r2 = s * (i % 2 ? 0.36 : 0.42);
    ctx.moveTo(cx + Math.cos(t) * r1, cy + Math.sin(t) * r1 * 0.8);
    ctx.lineTo(cx + Math.cos(t) * r2, cy + Math.sin(t) * r2 * 0.8);
  }
  ctx.stroke();
  const eye = (): void => {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, cy);
    ctx.quadraticCurveTo(cx, cy - s * 0.26, cx + s * 0.3, cy);
    ctx.quadraticCurveTo(cx, cy + s * 0.26, cx - s * 0.3, cy);
    ctx.closePath();
  };
  eye();
  ctx.fillStyle = C.moon;
  ctx.fill();
  ctx.save();
  eye();
  ctx.clip();
  hatch(ctx, cx - s * 0.3, cy - s * 0.15, s * 0.6, s * 0.09, 0, s * 0.022, alpha(INK.sepia, 0.4), s * 0.006);
  const g = ctx.createRadialGradient(cx, cy, s * 0.02, cx, cy, s * 0.12);
  g.addColorStop(0, C.gold);
  g.addColorStop(1, INK.wine);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  circle(ctx, cx, cy, s * 0.055, INK.ink);
  circle(ctx, cx + s * 0.035, cy - s * 0.035, s * 0.02, INK.white);
  ctx.restore();
  eye();
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = s * 0.022;
  ctx.stroke();
};

const arson: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy - s * 0.15, s * 0.5, alpha(C.goldLine, 0.35));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.18);
  ctx.fillStyle = INK.wood;
  ctx.beginPath();
  ctx.moveTo(-s * 0.045, -s * 0.02);
  ctx.lineTo(s * 0.045, -s * 0.02);
  ctx.lineTo(s * 0.03, s * 0.42);
  ctx.lineTo(-s * 0.03, s * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  hatch(ctx, -s * 0.05, -s * 0.02, s * 0.1, s * 0.44, 1.4, s * 0.03, alpha(INK.black, 0.4), s * 0.008);
  ctx.restore();
  ctx.fillStyle = C.goldDark;
  ctx.fillRect(-s * 0.06, -s * 0.02, s * 0.12, s * 0.04);
  ctx.fillRect(-s * 0.055, s * 0.06, s * 0.11, s * 0.025);
  const flame = (h: number, w: number, col: string): void => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.02);
    ctx.bezierCurveTo(-w, -s * 0.05, -w * 0.6, -h * 0.6, 0, -h);
    ctx.bezierCurveTo(w * 0.6, -h * 0.6, w, -s * 0.05, 0, -s * 0.02);
    ctx.fill();
  };
  flame(s * 0.42, s * 0.17, C.danger);
  flame(s * 0.34, s * 0.12, C.goldLine);
  flame(s * 0.22, s * 0.07, INK.flameCore);
  ctx.restore();
};

const matchmaker: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.danger, 0.25));
  ctx.lineWidth = s * 0.05;
  ctx.strokeStyle = C.goldDark;
  ctx.beginPath();
  ctx.arc(cx - s * 0.1, cy + s * 0.04, s * 0.17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = C.gold;
  ctx.beginPath();
  ctx.arc(cx + s * 0.1, cy - s * 0.02, s * 0.17, 0, Math.PI * 2);
  ctx.stroke();
  // 左环压在右环上面的那一小段，做出交扣的感觉
  ctx.strokeStyle = C.goldDark;
  ctx.beginPath();
  ctx.arc(cx - s * 0.1, cy + s * 0.04, s * 0.17, -0.6, 0.2);
  ctx.stroke();
  star4(ctx, cx + s * 0.1, cy - s * 0.21, s * 0.06, INK.white);
  circle(ctx, cx + s * 0.1, cy - s * 0.2, s * 0.03, C.danger);
};

const asylum: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.gold, 0.2));
  const arch = (w: number, top: number, bottom: number): void => {
    ctx.beginPath();
    ctx.moveTo(cx - w, bottom);
    ctx.lineTo(cx - w, cy - s * 0.02);
    ctx.quadraticCurveTo(cx - w, top + (cy - top) * 0.25, cx, top);
    ctx.quadraticCurveTo(cx + w, top + (cy - top) * 0.25, cx + w, cy - s * 0.02);
    ctx.lineTo(cx + w, bottom);
    ctx.closePath();
  };
  arch(s * 0.26, cy - s * 0.4, cy + s * 0.3);
  ctx.fillStyle = INK.ink;
  ctx.fill();
  ctx.save();
  ctx.clip();
  hatch(ctx, cx - s * 0.3, cy - s * 0.4, s * 0.6, s * 0.7, 0, s * 0.06, alpha(INK.lilac, 0.18), s * 0.01);
  ctx.restore();
  arch(s * 0.16, cy - s * 0.26, cy + s * 0.3);
  const g = ctx.createLinearGradient(0, cy - s * 0.26, 0, cy + s * 0.3);
  g.addColorStop(0, INK.flameCore);
  g.addColorStop(1, C.goldDark);
  ctx.fillStyle = g;
  ctx.fill();
  polyline(ctx, [[cx, cy - s * 0.26], [cx, cy + s * 0.3]], s * 0.015, INK.sepiaDark);
  circle(ctx, cx - s * 0.04, cy + s * 0.08, s * 0.015, INK.sepiaDark);
  ctx.fillStyle = INK.inkSoft;
  ctx.fillRect(cx - s * 0.34, cy + s * 0.3, s * 0.68, s * 0.06);
  polyline(ctx, [[cx, cy - s * 0.4], [cx, cy - s * 0.48]], s * 0.02, C.gold);
  polyline(ctx, [[cx - s * 0.035, cy - s * 0.45], [cx + s * 0.035, cy - s * 0.45]], s * 0.02, C.gold);
};

const piety: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy - s * 0.1, s * 0.45, alpha(C.moon, 0.3));
  ctx.strokeStyle = alpha(C.gold, 0.8);
  ctx.lineWidth = s * 0.02;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.18, s * 0.26, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  for (const sg of [-1, 1]) {
    const ox = cx + sg * s * 0.012;
    const hand = (): void => {
      ctx.beginPath();
      ctx.moveTo(ox, cy + s * 0.32);
      ctx.quadraticCurveTo(ox + sg * s * 0.2, cy + s * 0.22, ox + sg * s * 0.12, cy - s * 0.08);
      ctx.quadraticCurveTo(ox + sg * s * 0.06, cy - s * 0.3, ox, cy - s * 0.36);
      ctx.closePath();
    };
    hand();
    ctx.fillStyle = INK.parchment;
    ctx.fill();
    ctx.save();
    ctx.clip();
    hatch(ctx, cx - s * 0.25, cy - s * 0.4, s * 0.5, s * 0.75, sg * 0.5, s * 0.08, alpha(INK.sepia, 0.25), s * 0.007);
    ctx.restore();
    hand();
    ctx.strokeStyle = INK.sepiaDark;
    ctx.lineWidth = s * 0.014;
    ctx.stroke();
    // 手指之间的分界
    for (let i = 1; i <= 3; i++) polyline(ctx, [[ox + sg * s * 0.02, cy - s * (0.3 - i * 0.07)], [ox + sg * s * 0.1, cy - s * (0.24 - i * 0.07)]], s * 0.008, alpha(INK.sepiaDark, 0.6));
  }
  ctx.fillStyle = INK.wineDark;
  ctx.fillRect(cx - s * 0.12, cy + s * 0.24, s * 0.24, s * 0.06);
};

const scapegoat: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.danger, 0.22));
  ctx.strokeStyle = INK.sepiaDark;
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = 'round';
  for (const sg of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sg * s * 0.06, cy - s * 0.14);
    ctx.bezierCurveTo(cx + sg * s * 0.15, cy - s * 0.38, cx + sg * s * 0.36, cy - s * 0.32, cx + sg * s * 0.3, cy - s * 0.12);
    ctx.stroke();
  }
  ctx.strokeStyle = alpha(C.cardText, 0.5);
  ctx.lineWidth = s * 0.01;
  for (const sg of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sg * s * 0.08, cy - s * 0.18);
    ctx.bezierCurveTo(cx + sg * s * 0.16, cy - s * 0.34, cx + sg * s * 0.32, cy - s * 0.3, cx + sg * s * 0.29, cy - s * 0.15);
    ctx.stroke();
  }
  for (const sg of [-1, 1]) fillEllipse(ctx, cx + sg * s * 0.17, cy - s * 0.06, s * 0.09, s * 0.035, sg * 0.4, INK.ink);
  polygon(ctx, [[cx - s * 0.11, cy - s * 0.14], [cx + s * 0.11, cy - s * 0.14], [cx + s * 0.06, cy + s * 0.22], [cx, cy + s * 0.27], [cx - s * 0.06, cy + s * 0.22]], INK.ink);
  polygon(ctx, [[cx - s * 0.04, cy + s * 0.24], [cx + s * 0.04, cy + s * 0.24], [cx, cy + s * 0.4]], INK.ink);
  fillEllipse(ctx, cx - s * 0.05, cy - s * 0.04, s * 0.025, s * 0.01, 0, C.gold);
  fillEllipse(ctx, cx + s * 0.05, cy - s * 0.04, s * 0.025, s * 0.01, 0, C.gold);
  polyline(ctx, [[cx - s * 0.02, cy + s * 0.18], [cx + s * 0.02, cy + s * 0.18]], s * 0.01, alpha(C.cardText, 0.6));
};

const robbery: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.gold, 0.2));
  fillEllipse(ctx, cx - s * 0.06, cy + s * 0.1, s * 0.2, s * 0.19, 0, INK.straw);
  ctx.save();
  ellipse_(ctx, cx - s * 0.06, cy + s * 0.1, s * 0.2, s * 0.19);
  ctx.clip();
  hatch(ctx, cx - s * 0.26, cy - s * 0.1, s * 0.4, s * 0.4, 0.7, s * 0.035, alpha(INK.sepiaDark, 0.5), s * 0.008);
  ctx.restore();
  polygon(ctx, [[cx - s * 0.13, cy - s * 0.1], [cx + s * 0.01, cy - s * 0.1], [cx + s * 0.07, cy - s * 0.24], [cx - s * 0.06, cy - s * 0.15], [cx - s * 0.19, cy - s * 0.24]], INK.straw);
  ctx.fillStyle = C.goldDark;
  ctx.fillRect(cx - s * 0.14, cy - s * 0.11, s * 0.16, s * 0.035);
  ctx.fillStyle = INK.sepiaDark;
  ctx.font = titleFont(Math.max(1, Math.round(s * 0.16)));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', cx - s * 0.06, cy + s * 0.11);
  // 从右边伸过来的手
  polyline(ctx, [[cx + s * 0.48, cy + s * 0.12], [cx + s * 0.2, cy + s * 0.04]], s * 0.1, INK.ink);
  for (let i = 0; i < 3; i++) {
    polyline(ctx, [[cx + s * 0.2, cy + s * (0.0 + i * 0.04)], [cx + s * 0.12, cy + s * (-0.02 + i * 0.05)], [cx + s * 0.1, cy + s * (0.03 + i * 0.05)]], s * 0.03, INK.ink);
  }
};

/** 椭圆路径（不填充），给裁剪用 */
function ellipse_(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.restore();
}

const curse: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.danger, 0.25));
  ctx.fillStyle = INK.straw;
  rr(ctx, cx - s * 0.11, cy - s * 0.04, s * 0.22, s * 0.3, s * 0.05);
  ctx.fill();
  ctx.fillRect(cx - s * 0.26, cy, s * 0.52, s * 0.07);
  ctx.fillRect(cx - s * 0.1, cy + s * 0.22, s * 0.07, s * 0.14);
  ctx.fillRect(cx + s * 0.03, cy + s * 0.22, s * 0.07, s * 0.14);
  circle(ctx, cx, cy - s * 0.15, s * 0.12, INK.straw);
  ctx.save();
  rr(ctx, cx - s * 0.26, cy - s * 0.27, s * 0.52, s * 0.63, s * 0.05);
  ctx.clip();
  hatch(ctx, cx - s * 0.3, cy - s * 0.3, s * 0.6, s * 0.7, 1.2, s * 0.035, alpha(INK.sepiaDark, 0.35), s * 0.007);
  ctx.restore();
  // 两只眼睛是缝上去的叉
  for (const ex of [cx - s * 0.045, cx + s * 0.045]) {
    const ey = cy - s * 0.17;
    polyline(ctx, [[ex - s * 0.025, ey - s * 0.025], [ex + s * 0.025, ey + s * 0.025]], s * 0.014, INK.ink);
    polyline(ctx, [[ex + s * 0.025, ey - s * 0.025], [ex - s * 0.025, ey + s * 0.025]], s * 0.014, INK.ink);
  }
  polyline(ctx, [[cx - s * 0.05, cy - s * 0.08], [cx + s * 0.05, cy - s * 0.08]], s * 0.012, INK.ink);
  for (const [x1, y1, x2, y2] of [[0.28, -0.3, 0.02, -0.12], [-0.3, 0.12, -0.04, 0.1], [0.3, 0.2, 0.05, 0.12]]) {
    polyline(ctx, [[cx + x1 * s, cy + y1 * s], [cx + x2 * s, cy + y2 * s]], s * 0.012, INK.steel);
    circle(ctx, cx + x1 * s, cy + y1 * s, s * 0.03, C.danger);
  }
};

const stocks: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.gold, 0.15));
  ctx.fillStyle = INK.wood;
  ctx.fillRect(cx - s * 0.04, cy, s * 0.08, s * 0.42);
  const bx = cx - s * 0.38;
  const by = cy - s * 0.2;
  const bw = s * 0.76;
  const bh = s * 0.24;
  ctx.fillStyle = INK.straw;
  ctx.fillRect(bx, by, bw, bh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.clip();
  hatch(ctx, bx, by, bw, bh, 0.05, s * 0.03, alpha(INK.sepiaDark, 0.5), s * 0.008);
  ctx.restore();
  polyline(ctx, [[bx, by + bh / 2], [bx + bw, by + bh / 2]], s * 0.012, INK.sepiaDark);
  circle(ctx, cx, by + bh / 2, s * 0.075, INK.ink);
  circle(ctx, cx - s * 0.25, by + bh / 2, s * 0.045, INK.ink);
  circle(ctx, cx + s * 0.25, by + bh / 2, s * 0.045, INK.ink);
  ctx.fillStyle = C.goldDark;
  for (const x of [bx + s * 0.02, bx + bw - s * 0.06]) ctx.fillRect(x, by + bh / 2 - s * 0.03, s * 0.04, s * 0.06);
  ctx.strokeStyle = INK.sepiaDark;
  ctx.lineWidth = s * 0.012;
  ctx.strokeRect(bx, by, bw, bh);
};

const alibi: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.moon, 0.2));
  ctx.save();
  ctx.translate(cx + s * 0.08, cy - s * 0.02);
  ctx.rotate(0.15);
  ctx.fillStyle = INK.parchment;
  ctx.fillRect(-s * 0.18, -s * 0.26, s * 0.36, s * 0.48);
  ctx.strokeStyle = alpha(INK.sepiaDark, 0.6);
  ctx.lineWidth = s * 0.012;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    ctx.moveTo(-s * 0.12, -s * 0.18 + i * s * 0.07);
    ctx.lineTo(s * 0.12, -s * 0.18 + i * s * 0.07);
  }
  ctx.stroke();
  circle(ctx, s * 0.08, s * 0.14, s * 0.06, INK.wax);
  ctx.restore();
  // 举起的手：手掌加四根手指和拇指
  ctx.save();
  ctx.translate(cx - s * 0.12, cy + s * 0.08);
  ctx.rotate(-0.15);
  ctx.fillStyle = INK.lilac;
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = s * 0.016;
  const palm = (): void => rr(ctx, -s * 0.11, -s * 0.06, s * 0.22, s * 0.24, s * 0.06);
  palm();
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    rr(ctx, -s * 0.105 + i * s * 0.055, -s * (0.26 - Math.abs(i - 1.5) * 0.03), s * 0.045, s * 0.22, s * 0.022);
    ctx.fill();
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(-s * 0.11, s * 0.04);
  ctx.rotate(-0.8);
  rr(ctx, -s * 0.025, -s * 0.13, s * 0.05, s * 0.14, s * 0.025);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  palm();
  ctx.fill();
  ctx.restore();
};

const conspiracy: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy + s * 0.1, s * 0.45, alpha(INK.poison, 0.35));
  for (let i = 0; i < 3; i++) fillEllipse(ctx, cx + (i - 1) * s * 0.18, cy + s * (0.3 - (i % 2) * 0.05), s * 0.2, s * 0.05, 0, alpha(INK.lilac, 0.2));
  ctx.save();
  ctx.translate(cx - s * 0.06, cy - s * 0.08);
  ctx.rotate(0.6);
  ctx.beginPath();
  ctx.arc(0, s * 0.06, s * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = INK.ink;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = INK.poison;
  ctx.fillRect(-s * 0.2, s * 0.08, s * 0.4, s * 0.2);
  ctx.restore();
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = s * 0.014;
  ctx.stroke();
  ctx.fillStyle = INK.ink;
  ctx.fillRect(-s * 0.04, -s * 0.2, s * 0.08, s * 0.12);
  ctx.fillStyle = INK.sepiaDark;
  ctx.fillRect(-s * 0.05, -s * 0.26, s * 0.1, s * 0.06);
  ctx.restore();
  // 瓶口滴下的一滴
  const dx = cx + s * 0.16;
  const dy = cy + s * 0.04;
  ctx.fillStyle = INK.poisonLight;
  ctx.beginPath();
  ctx.moveTo(dx, dy - s * 0.08);
  ctx.quadraticCurveTo(dx + s * 0.05, dy, dx, dy + s * 0.04);
  ctx.quadraticCurveTo(dx - s * 0.05, dy, dx, dy - s * 0.08);
  ctx.fill();
  circle(ctx, dx + s * 0.05, dy + s * 0.14, s * 0.02, INK.poisonLight);
};

export const CARD_ICONS: Record<CardKind, IconFn> = {
  accusation,
  evidence,
  witness,
  blackCat,
  matchmaker,
  asylum,
  piety,
  scapegoat,
  robbery,
  arson,
  curse,
  stocks,
  alibi,
  night,
  conspiracy,
};

/* ---------------------------------------------------------------- 身份 */

const witch: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.witch, 0.35));
  crescent(ctx, cx + s * 0.2, cy - s * 0.22, s * 0.1, s * 0.05, -s * 0.03, C.moon);
  ctx.fillStyle = INK.ink;
  ctx.strokeStyle = C.goldLine;
  ctx.lineWidth = s * 0.01;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.17, cy + s * 0.14);
  ctx.quadraticCurveTo(cx - s * 0.05, cy - s * 0.1, cx + s * 0.02, cy - s * 0.32);
  ctx.quadraticCurveTo(cx + s * 0.06, cy - s * 0.2, cx + s * 0.2, cy - s * 0.26);
  ctx.quadraticCurveTo(cx + s * 0.07, cy - s * 0.12, cx + s * 0.17, cy + s * 0.14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ellipse_(ctx, cx, cy + s * 0.16, s * 0.36, s * 0.07);
  ctx.fill();
  ctx.stroke();
  polygon(ctx, [[cx - s * 0.165, cy + s * 0.08], [cx + s * 0.165, cy + s * 0.08], [cx + s * 0.17, cy + s * 0.14], [cx - s * 0.17, cy + s * 0.14]], C.witch);
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = s * 0.014;
  ctx.strokeRect(cx - s * 0.035, cy + s * 0.075, s * 0.07, s * 0.07);
};

const constable: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy + s * 0.05, s * 0.45, alpha(C.gold, 0.35));
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.3, s * 0.05, Math.PI, 0);
  ctx.stroke();
  polygon(ctx, [[cx - s * 0.05, cy - s * 0.3], [cx + s * 0.05, cy - s * 0.3], [cx + s * 0.17, cy - s * 0.18], [cx - s * 0.17, cy - s * 0.18]], INK.ink);
  ctx.fillStyle = alpha(C.gold, 0.55);
  ctx.fillRect(cx - s * 0.13, cy - s * 0.18, s * 0.26, s * 0.32);
  glow(ctx, cx, cy - s * 0.02, s * 0.15, alpha(INK.flameCore, 0.9));
  ctx.fillStyle = INK.flameCore;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.1);
  ctx.quadraticCurveTo(cx + s * 0.04, cy, cx, cy + s * 0.04);
  ctx.quadraticCurveTo(cx - s * 0.04, cy, cx, cy - s * 0.1);
  ctx.fill();
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = s * 0.022;
  ctx.strokeRect(cx - s * 0.13, cy - s * 0.18, s * 0.26, s * 0.32);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.045, cy - s * 0.18);
  ctx.lineTo(cx - s * 0.045, cy + s * 0.14);
  ctx.moveTo(cx + s * 0.045, cy - s * 0.18);
  ctx.lineTo(cx + s * 0.045, cy + s * 0.14);
  ctx.stroke();
  ctx.fillStyle = INK.ink;
  ctx.fillRect(cx - s * 0.17, cy + s * 0.14, s * 0.34, s * 0.06);
  star4(ctx, cx, cy + s * 0.32, s * 0.07, C.gold);
};

const villager: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(INK.lilac, 0.2));
  for (let i = 0; i < 3; i++) circle(ctx, cx + s * 0.13 + i * s * 0.03, cy - s * 0.3 - i * s * 0.06, s * (0.03 + i * 0.012), alpha(INK.lilac, 0.25));
  ctx.fillStyle = INK.ink;
  ctx.fillRect(cx + s * 0.1, cy - s * 0.27, s * 0.06, s * 0.14);
  const roof: [number, number][] = [[cx - s * 0.27, cy - s * 0.02], [cx, cy - s * 0.24], [cx + s * 0.27, cy - s * 0.02]];
  polygon(ctx, roof, INK.ink);
  ctx.fillRect(cx - s * 0.21, cy - s * 0.03, s * 0.42, s * 0.3);
  ctx.save();
  ctx.beginPath();
  roof.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  hatch(ctx, cx - s * 0.3, cy - s * 0.25, s * 0.6, s * 0.25, 0, s * 0.035, alpha(INK.lilac, 0.25), s * 0.007);
  ctx.restore();
  glow(ctx, cx - s * 0.1, cy + s * 0.08, s * 0.12, alpha(C.gold, 0.5));
  ctx.fillStyle = C.gold;
  ctx.fillRect(cx - s * 0.14, cy + s * 0.04, s * 0.08, s * 0.08);
  ctx.fillStyle = INK.ink;
  ctx.fillRect(cx - s * 0.102, cy + s * 0.04, s * 0.006, s * 0.08);
  ctx.fillRect(cx - s * 0.14, cy + s * 0.077, s * 0.08, s * 0.006);
  ctx.fillStyle = INK.brown;
  ctx.fillRect(cx + s * 0.05, cy + s * 0.1, s * 0.09, s * 0.17);
  ctx.fillStyle = INK.ink;
  ctx.fillRect(cx - s * 0.4, cy + s * 0.27, s * 0.8, s * 0.2);
};

export const TRYAL_ICONS: Record<TryalKind, IconFn> = { witch, constable, villager };

/* ---------------------------------------------------------------- 角色 */

const judge: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy, s * 0.45, alpha(C.gold, 0.25));
  ctx.fillStyle = INK.ink;
  rr(ctx, cx - s * 0.24, cy + s * 0.2, s * 0.48, s * 0.08, s * 0.02);
  ctx.fill();
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = s * 0.01;
  ctx.stroke();
  ctx.save();
  ctx.translate(cx + s * 0.02, cy - s * 0.02);
  ctx.rotate(-0.6);
  ctx.fillStyle = INK.wood;
  rr(ctx, -s * 0.025, -s * 0.02, s * 0.05, s * 0.38, s * 0.02);
  ctx.fill();
  ctx.fillStyle = INK.ink;
  rr(ctx, -s * 0.16, -s * 0.12, s * 0.32, s * 0.13, s * 0.03);
  ctx.fill();
  ctx.fillStyle = C.goldDark;
  ctx.fillRect(-s * 0.12, -s * 0.12, s * 0.025, s * 0.13);
  ctx.fillRect(s * 0.095, -s * 0.12, s * 0.025, s * 0.13);
  ctx.restore();
};

const doctor: IconFn = (ctx, cx, cy, s) => {
  fillEllipse(ctx, cx - s * 0.04, cy - s * 0.2, s * 0.26, s * 0.05, 0, INK.ink);
  ctx.fillStyle = INK.ink;
  ctx.fillRect(cx - s * 0.16, cy - s * 0.36, s * 0.24, s * 0.17);
  circle(ctx, cx - s * 0.05, cy - s * 0.02, s * 0.16, INK.ink);
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.06, cy - s * 0.1);
  ctx.quadraticCurveTo(cx + s * 0.3, cy - s * 0.02, cx + s * 0.36, cy + s * 0.22);
  ctx.quadraticCurveTo(cx + s * 0.2, cy + s * 0.1, cx + s * 0.03, cy + s * 0.08);
  ctx.fill();
  ctx.fillRect(cx - s * 0.2, cy + s * 0.1, s * 0.3, s * 0.3);
  circle(ctx, cx - s * 0.02, cy - s * 0.05, s * 0.045, C.gold);
  circle(ctx, cx - s * 0.02, cy - s * 0.05, s * 0.02, INK.ink);
  ellipse_(ctx, cx - s * 0.04, cy - s * 0.2, s * 0.26, s * 0.05);
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = s * 0.01;
  ctx.stroke();
};

const beggar: IconFn = (ctx, cx, cy, s) => {
  ctx.fillStyle = INK.ink;
  ctx.beginPath();
  ctx.save();
  ctx.translate(cx, cy + s * 0.08);
  ctx.scale(s * 0.28, s * 0.2);
  ctx.arc(0, 0, 1, 0, Math.PI);
  ctx.restore();
  ctx.fill();
  ellipse_(ctx, cx, cy + s * 0.08, s * 0.28, s * 0.06);
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = s * 0.02;
  ctx.stroke();
  for (const [dx, dy, r] of [[-0.06, -0.08, 0.06], [0.1, -0.2, 0.05], [0.02, -0.32, 0.04]]) fillEllipse(ctx, cx + dx * s, cy + dy * s, r * s, r * s * 0.75, 0.4, C.gold);
  polyline(ctx, [[cx + s * 0.1, cy + s * 0.14], [cx + s * 0.14, cy + s * 0.2], [cx + s * 0.11, cy + s * 0.26]], s * 0.012, alpha(C.gold, 0.5));
};

const landlord: IconFn = (ctx, cx, cy, s) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.75);
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.arc(0, -s * 0.22, s * 0.1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = C.gold;
  ctx.fillRect(-s * 0.025, -s * 0.12, s * 0.05, s * 0.44);
  ctx.fillRect(s * 0.02, s * 0.2, s * 0.1, s * 0.04);
  ctx.fillRect(s * 0.02, s * 0.27, s * 0.07, s * 0.04);
  circle(ctx, 0, -s * 0.22, s * 0.035, INK.ink);
  ctx.restore();
};

const priest: IconFn = (ctx, cx, cy, s) => {
  glow(ctx, cx, cy - s * 0.1, s * 0.3, alpha(INK.flameCore, 0.5));
  ctx.fillStyle = C.gold;
  ctx.fillRect(cx - s * 0.03, cy - s * 0.36, s * 0.06, s * 0.36);
  ctx.fillRect(cx - s * 0.12, cy - s * 0.26, s * 0.24, s * 0.055);
  ctx.fillStyle = INK.ink;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.3, cy + s * 0.06);
  ctx.quadraticCurveTo(cx - s * 0.15, cy, cx, cy + s * 0.07);
  ctx.quadraticCurveTo(cx + s * 0.15, cy, cx + s * 0.3, cy + s * 0.06);
  ctx.lineTo(cx + s * 0.3, cy + s * 0.26);
  ctx.quadraticCurveTo(cx + s * 0.15, cy + s * 0.2, cx, cy + s * 0.27);
  ctx.quadraticCurveTo(cx - s * 0.15, cy + s * 0.2, cx - s * 0.3, cy + s * 0.26);
  ctx.closePath();
  ctx.fill();
  polyline(ctx, [[cx, cy + s * 0.07], [cx, cy + s * 0.27]], s * 0.012, C.goldDark);
  for (let i = 0; i < 3; i++) {
    polyline(ctx, [[cx - s * 0.25, cy + s * (0.1 + i * 0.045)], [cx - s * 0.05, cy + s * (0.12 + i * 0.045)]], s * 0.008, alpha(C.gold, 0.45));
    polyline(ctx, [[cx + s * 0.05, cy + s * (0.12 + i * 0.045)], [cx + s * 0.25, cy + s * (0.1 + i * 0.045)]], s * 0.008, alpha(C.gold, 0.45));
  }
};

const storyteller: IconFn = (ctx, cx, cy, s) => {
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.translate(cx, cy + s * 0.28);
    ctx.rotate((i - 2) * 0.28);
    const w = s * 0.2;
    const h = s * 0.3;
    rr(ctx, -w / 2, -h - s * 0.12, w, h, s * 0.025);
    ctx.fillStyle = i === 2 ? INK.wine : FRAME_GRADIENT.back[0];
    ctx.fill();
    ctx.strokeStyle = C.goldLine;
    ctx.lineWidth = s * 0.01;
    ctx.stroke();
    if (i === 2) star4(ctx, 0, -h / 2 - s * 0.12, s * 0.05, C.gold);
    else crescent(ctx, 0, -h / 2 - s * 0.12, s * 0.04, s * 0.02, -s * 0.01, alpha(C.gold, 0.7));
    ctx.restore();
  }
};

const tailor: IconFn = (ctx, cx, cy, s) => {
  ctx.save();
  ctx.translate(cx, cy);
  for (const sg of [-1, 1]) {
    ctx.save();
    ctx.rotate(sg * 0.35);
    polygon(ctx, [[-s * 0.02, 0], [s * 0.02, 0], [s * 0.005, -s * 0.36]], INK.steel);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    ctx.arc(0, s * 0.17, s * 0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = C.gold;
    ctx.fillRect(-s * 0.015, 0, s * 0.03, s * 0.1);
    ctx.restore();
  }
  circle(ctx, 0, 0, s * 0.025, INK.ink);
  ctx.restore();
  polyline(ctx, [[cx - s * 0.32, cy - s * 0.3], [cx - s * 0.2, cy - s * 0.12], [cx - s * 0.3, cy + s * 0.05], [cx - s * 0.22, cy + s * 0.3]], s * 0.012, C.danger);
};

const housewife: IconFn = (ctx, cx, cy, s) => {
  ctx.strokeStyle = alpha(INK.lilac, 0.45);
  ctx.lineWidth = s * 0.018;
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.02 + i * s * 0.08, cy - s * 0.2);
    ctx.bezierCurveTo(cx - s * 0.08 + i * s * 0.08, cy - s * 0.27, cx + s * 0.04 + i * s * 0.08, cy - s * 0.32, cx - s * 0.02 + i * s * 0.08, cy - s * 0.4);
    ctx.stroke();
  }
  fillEllipse(ctx, cx, cy + s * 0.06, s * 0.22, s * 0.2, 0, INK.ink);
  ctx.fillStyle = INK.ink;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.16, cy);
  ctx.quadraticCurveTo(cx + s * 0.32, cy - s * 0.02, cx + s * 0.36, cy - s * 0.14);
  ctx.lineTo(cx + s * 0.3, cy - s * 0.12);
  ctx.quadraticCurveTo(cx + s * 0.26, cy + s * 0.04, cx + s * 0.16, cy + s * 0.1);
  ctx.fill();
  ctx.strokeStyle = INK.ink;
  ctx.lineWidth = s * 0.035;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.1, s * 0.15, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  fillEllipse(ctx, cx, cy - s * 0.13, s * 0.1, s * 0.025, 0, C.goldDark);
  ctx.fillStyle = C.goldDark;
  ctx.fillRect(cx - s * 0.2, cy + s * 0.1, s * 0.4, s * 0.02);
};

const farmer: IconFn = (ctx, cx, cy, s) => {
  for (const [ang, len] of [[-0.35, 0.55], [0, 0.62], [0.35, 0.55]]) {
    ctx.save();
    ctx.translate(cx, cy + s * 0.32);
    ctx.rotate(ang);
    polyline(ctx, [[0, 0], [0, -s * len]], s * 0.02, C.goldDark);
    for (let k = 0; k < 5; k++) {
      const y = -s * len + s * (0.04 + k * 0.05);
      for (const sg of [-1, 1]) fillEllipse(ctx, sg * s * 0.03, y, s * 0.022, s * 0.045, sg * 0.5, C.gold);
    }
    ctx.restore();
  }
  ctx.fillStyle = C.danger;
  ctx.fillRect(cx - s * 0.07, cy + s * 0.14, s * 0.14, s * 0.04);
};

const child: IconFn = (ctx, cx, cy, s) => {
  ctx.strokeStyle = alpha(C.gold, 0.5);
  ctx.lineWidth = s * 0.012;
  for (const r of [0.3, 0.36]) {
    ctx.beginPath();
    ctx.save();
    ctx.translate(cx, cy + s * 0.26);
    ctx.scale(s * r, s * r * 0.2);
    ctx.arc(0, 0, 1, Math.PI * 0.1, Math.PI * 0.9);
    ctx.restore();
    ctx.stroke();
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.24, cy - s * 0.08);
  ctx.quadraticCurveTo(cx, cy - s * 0.2, cx + s * 0.24, cy - s * 0.08);
  ctx.lineTo(cx, cy + s * 0.3);
  ctx.closePath();
  ctx.fillStyle = INK.wine;
  ctx.fill();
  ctx.clip();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? C.gold : INK.ink;
    ctx.fillRect(cx - s * 0.3, cy - s * 0.04 + i * s * 0.07, s * 0.6, s * 0.03);
  }
  ctx.restore();
  ctx.fillStyle = INK.ink;
  ctx.fillRect(cx - s * 0.02, cy - s * 0.3, s * 0.04, s * 0.16);
  circle(ctx, cx, cy - s * 0.31, s * 0.035, INK.ink);
};

const minister: IconFn = (ctx, cx, cy, s) => {
  ctx.fillStyle = alpha(C.danger, 0.85);
  ctx.fillRect(cx - s * 0.3, cy + s * 0.2, s * 0.26, s * 0.14);
  ctx.strokeStyle = alpha(C.cardText, 0.6);
  ctx.lineWidth = s * 0.01;
  ctx.strokeRect(cx - s * 0.28, cy + s * 0.22, s * 0.22, s * 0.1);
  ctx.save();
  ctx.translate(cx + s * 0.08, cy);
  ctx.rotate(0.2);
  circle(ctx, 0, -s * 0.28, s * 0.08, INK.ink);
  ctx.fillStyle = INK.ink;
  ctx.fillRect(-s * 0.035, -s * 0.24, s * 0.07, s * 0.22);
  rr(ctx, -s * 0.16, -s * 0.04, s * 0.32, s * 0.14, s * 0.02);
  ctx.fill();
  ctx.fillStyle = C.goldDark;
  ctx.fillRect(-s * 0.16, s * 0.08, s * 0.32, s * 0.04);
  ctx.restore();
};

const official: IconFn = (ctx, cx, cy, s) => {
  ctx.fillStyle = INK.ink;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.36, cy + s * 0.02);
  ctx.quadraticCurveTo(cx - s * 0.2, cy - s * 0.28, cx, cy - s * 0.2);
  ctx.quadraticCurveTo(cx + s * 0.2, cy - s * 0.28, cx + s * 0.36, cy + s * 0.02);
  ctx.quadraticCurveTo(cx + s * 0.15, cy - s * 0.02, cx, cy + s * 0.14);
  ctx.quadraticCurveTo(cx - s * 0.15, cy - s * 0.02, cx - s * 0.36, cy + s * 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = s * 0.018;
  ctx.stroke();
  circle(ctx, cx + s * 0.14, cy - s * 0.1, s * 0.05, C.danger);
  star4(ctx, cx + s * 0.14, cy - s * 0.1, s * 0.035, C.gold);
};

const strongman: IconFn = (ctx, cx, cy, s) => {
  ctx.fillStyle = INK.iron;
  ctx.fillRect(cx - s * 0.36, cy - s * 0.02, s * 0.72, s * 0.04);
  ctx.fillStyle = INK.ink;
  for (const sg of [-1, 1]) {
    rr(ctx, cx + sg * s * 0.25 - s * 0.045, cy - s * 0.2, s * 0.09, s * 0.4, s * 0.02);
    ctx.fill();
    rr(ctx, cx + sg * s * 0.16 - s * 0.035, cy - s * 0.14, s * 0.07, s * 0.28, s * 0.02);
    ctx.fill();
  }
  ctx.strokeStyle = C.goldDark;
  ctx.lineWidth = s * 0.01;
  for (const sg of [-1, 1]) {
    rr(ctx, cx + sg * s * 0.25 - s * 0.045, cy - s * 0.2, s * 0.09, s * 0.4, s * 0.02);
    ctx.stroke();
  }
  ctx.fillStyle = C.gold;
  ctx.font = titleFont(Math.max(1, Math.round(s * 0.14)));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('8', cx, cy + s * 0.22);
};

const maid: IconFn = (ctx, cx, cy, s) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.45);
  ctx.fillStyle = INK.wood;
  ctx.fillRect(-s * 0.018, -s * 0.42, s * 0.036, s * 0.5);
  ctx.beginPath();
  ctx.moveTo(-s * 0.06, s * 0.06);
  ctx.lineTo(s * 0.06, s * 0.06);
  ctx.lineTo(s * 0.15, s * 0.38);
  ctx.lineTo(-s * 0.15, s * 0.38);
  ctx.closePath();
  ctx.fillStyle = INK.straw;
  ctx.fill();
  ctx.save();
  ctx.clip();
  hatch(ctx, -s * 0.15, s * 0.06, s * 0.3, s * 0.32, Math.PI / 2, s * 0.025, alpha(INK.sepiaDark, 0.6), s * 0.008);
  ctx.restore();
  ctx.fillStyle = C.danger;
  ctx.fillRect(-s * 0.07, s * 0.06, s * 0.14, s * 0.04);
  ctx.restore();
};

const maiden: IconFn = (ctx, cx, cy, s) => {
  polyline(ctx, [[cx, cy + s * 0.02], [cx - s * 0.02, cy + s * 0.2], [cx + s * 0.01, cy + s * 0.38]], s * 0.025, INK.leaf);
  for (const sg of [-1, 1]) fillEllipse(ctx, cx + sg * s * 0.08, cy + s * 0.22, s * 0.07, s * 0.03, sg * -0.5, INK.leaf);
  for (let i = 0; i < 5; i++) {
    const t = (i * Math.PI * 2) / 5 - Math.PI / 2;
    circle(ctx, cx + Math.cos(t) * s * 0.09, cy - s * 0.1 + Math.sin(t) * s * 0.09, s * 0.09, C.danger);
  }
  circle(ctx, cx, cy - s * 0.1, s * 0.07, INK.wine);
  circle(ctx, cx, cy - s * 0.1, s * 0.03, C.gold);
};

export const CHAR_ICONS: Record<CharacterId, IconFn> = {
  doctor,
  beggar,
  landlord,
  judge,
  priest,
  storyteller,
  tailor,
  housewife,
  farmer,
  child,
  minister,
  official,
  strongman,
  maid,
  maiden,
};
