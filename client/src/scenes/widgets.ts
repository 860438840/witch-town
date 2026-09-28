import type { Screen } from '../core/app';
import { rect, type Rect } from '../core/geom';
import type { Node } from '../core/node';
import { wrapText } from '../core/text';
import { drawButton, drawPanel, drawSky, drawText, type TextOpts } from '../theme/draw';
import { C, font } from '../theme/palette';

export type WidgetButtonStyle = 'primary' | 'secondary' | 'danger';

/** onTap 为 null 时按钮显示为禁用 */
export function button(id: string, r: Rect, label: string, onTap: (() => void) | null, style: WidgetButtonStyle = 'primary'): Node {
  return {
    id,
    rect: r,
    onTap: onTap ?? undefined,
    draw: (ctx) => drawButton(ctx, r, label, onTap ? style : 'disabled'),
  };
}

export function textNode(r: Rect, text: string, o: TextOpts = {}): Node {
  const align = o.align ?? 'left';
  const x = align === 'center' ? r.x + r.w / 2 : align === 'right' ? r.x + r.w : r.x;
  return { rect: r, draw: (ctx) => drawText(ctx, text, x, r.y + r.h / 2, { maxWidth: r.w, ...o }) };
}

export function skyNode(screen: Screen, darkness: number): Node {
  return { rect: rect(0, 0, screen.W, screen.H), draw: (ctx) => drawSky(ctx, screen.W, screen.H, darkness) };
}

/** 全屏半透明遮罩，拦住下面的点击；onTap 常用于「点空白处关闭」 */
export function overlay(screen: Screen, onTap?: () => void): Node {
  return {
    id: 'overlay',
    rect: rect(0, 0, screen.W, screen.H),
    onTap: onTap ?? (() => {}),
    draw: (ctx) => {
      ctx.fillStyle = C.overlay;
      ctx.fillRect(0, 0, screen.W, screen.H);
    },
  };
}

/** 从底部弹出的面板。slide 为 0→1 的滑出进度。返回节点和内容区 body。 */
export function sheet(
  screen: Screen,
  height: number,
  title: string,
  onClose: (() => void) | null,
  slide = 1,
  subtitle?: string,
): { nodes: Node[]; body: Rect } {
  const h = Math.min(height, screen.H - screen.top);
  const y = screen.H - h * slide;
  const panel = rect(0, y, screen.W, h + 16);
  const nodes: Node[] = [
    overlay(screen, onClose ?? undefined),
    {
      id: 'sheet',
      rect: panel,
      onTap: () => {},
      draw: (ctx) => {
        drawPanel(ctx, panel, { fill: C.panelSolid, stroke: C.goldLine, radius: 16 });
        drawText(ctx, title, 20, y + 26, { size: 17, bold: true, color: C.gold, maxWidth: screen.W - 120 });
        if (subtitle) drawText(ctx, subtitle, 20, y + 50, { size: 12, color: C.textDim, maxWidth: screen.W - 40 });
      },
    },
  ];
  if (onClose) nodes.push(button('sheet-close', rect(screen.W - 76, y + 10, 60, 32), '关闭', onClose, 'secondary'));
  const bodyTop = y + (subtitle ? 66 : 50);
  return { nodes, body: rect(16, bodyTop, screen.W - 32, screen.bottom - bodyTop - 12) };
}

export function clampScroll(offset: number, contentH: number, viewH: number): number {
  const min = Math.min(0, viewH - contentH);
  return Math.max(min, Math.min(0, offset));
}

export interface Line {
  text: string;
  size?: number;
  color?: string;
  bold?: boolean;
  /** 本行之后额外空出的高度 */
  gap?: number;
}

/** 可上下拖动的文字列表。内容高度在绘制时才知道，所以第一次绘制前滚动不会生效。 */
export class ScrollBox {
  offset = 0;
  private contentH = 0;

  reset(): void {
    this.offset = 0;
  }

  node(id: string, r: Rect, lines: Line[]): Node {
    return {
      id,
      rect: r,
      clip: true,
      onScroll: (dy) => {
        this.offset = clampScroll(this.offset + dy, this.contentH, r.h);
      },
      draw: (ctx) => {
        const start = r.y + 4;
        let y = start + this.offset;
        for (const l of lines) {
          const size = l.size ?? 13;
          ctx.font = font(size, l.bold);
          for (const t of wrapText(l.text, r.w - 8, (s) => ctx.measureText(s).width)) {
            drawText(ctx, t, r.x + 4, y + size / 2, { size, color: l.color, bold: l.bold });
            y += size + 6;
          }
          y += l.gap ?? 0;
        }
        this.contentH = y - this.offset - start;
      },
    };
  }
}
