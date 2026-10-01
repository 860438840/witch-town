import type { Card } from '../../../engine/src/index';
import { rect, type Rect } from '../core/geom';
import type { Ctx, Drag, Node } from '../core/node';
import { CARD_INFO } from '../model/cards';
import { formatCountdown, type TableModel } from '../model/table';
import { drawPanel, drawText, roundRect } from '../theme/draw';
import { C, CARD_GRADIENT } from '../theme/palette';
import type { Ui } from './ui';
import { button, clampScroll, requestButton, sheet } from './widgets';

/** 每行的高度（含 6px 行距） */
export const ROW_H = 52;
const HANDLE_W = 48;
/** 手指离列表上下边缘这么近时自动滚动 */
const EDGE = 70;
/** 自动滚动每帧最多滚动的像素 */
const MAX_SPEED = 14;

interface DragState {
  id: string;
  /** 手指当前的 y */
  y: number;
  /** 手指到被拖那一行顶部的距离 */
  grab: number;
}

/** 说书人调整牌堆的面板。顺序、滚动位置和拖动状态保存在这里，跨帧保留。 */
export class StoryBoard {
  private key = '';
  private order: string[] = [];
  private scroll = 0;
  private drag: DragState | null = null;
  private list: Rect | null = null;

  build(ui: Ui, m: TableModel, deck: Card[], now: number): Node[] {
    // 服务器发来的牌堆变了（新的一次调整）才重置本地顺序
    const key = deck.map((c) => c.id).join(',');
    if (key !== this.key) {
      this.key = key;
      this.order = deck.map((c) => c.id);
      this.scroll = 0;
      this.drag = null;
    }
    const byId = new Map(deck.map((c) => [c.id, c] as const));
    const S = ui.screen;
    const { nodes, body } = sheet(
      S,
      S.H - S.top,
      '说书人：调整牌堆',
      null,
      1,
      `上面是牌堆顶 · 按住右侧 ≡ 拖动 · 剩余 ${formatCountdown(m.deadline, now)}`,
    );
    const btnH = 44;
    const list = rect(body.x, body.y, body.w, body.h - btnH - 12);
    this.list = list;
    const contentH = this.order.length * ROW_H;
    this.scroll = clampScroll(this.scroll, contentH, list.h);

    nodes.push({
      id: 'story-list',
      rect: list,
      clip: true,
      onScroll: (dy) => {
        if (!this.drag) this.scroll = clampScroll(this.scroll + dy, contentH, list.h);
      },
      draw: (ctx) => {
        this.order.forEach((id, i) => {
          const y = list.y + this.scroll + i * ROW_H;
          if (y + ROW_H < list.y || y > list.y + list.h) return;
          const r = rect(list.x, y, list.w, ROW_H - 6);
          if (this.drag?.id === id) drawPanel(ctx, r, { fill: C.transparent, stroke: C.goldDark });
          else drawRow(ctx, r, byId.get(id) as Card, i, false);
        });
      },
    });

    // 只给看得见的行放拖动把手，把手的点击区域裁到列表范围内
    this.order.forEach((id, i) => {
      const y = list.y + this.scroll + i * ROW_H;
      const top = Math.max(y, list.y);
      const bottom = Math.min(y + ROW_H - 6, list.y + list.h);
      if (bottom <= top) return;
      nodes.push({
        id: `handle:${id}`,
        rect: rect(list.x + list.w - HANDLE_W, top, HANDLE_W, bottom - top),
        onPress: (_x, py) => this.press(id, py),
      });
    });

    const d = this.drag;
    if (d) {
      const gy = Math.max(list.y - 20, Math.min(list.y + list.h - ROW_H + 26, d.y - d.grab));
      const r = rect(list.x, gy, list.w, ROW_H - 6);
      const card = byId.get(d.id) as Card;
      const index = this.order.indexOf(d.id);
      nodes.push({ id: 'story-ghost', rect: r, draw: (ctx) => drawRow(ctx, r, card, index, true) });
    }

    const half = (body.w - 10) / 2;
    const by = list.y + list.h + 12;
    nodes.push(
      button('story-reset', rect(body.x, by, half, btnH), '还原', () => {
        this.order = deck.map((c) => c.id);
      }, 'secondary'),
      requestButton(
        'story-confirm',
        rect(body.x + half + 10, by, half, btnH),
        '确认顺序',
        () => void ui.ctl.act({ type: 'storyReorder', order: [...this.order] }),
        ui.ctl.busy,
      ),
    );
    return nodes;
  }

  private press(id: string, y: number): Drag {
    const list = this.list as Rect;
    const i = this.order.indexOf(id);
    this.drag = { id, y, grab: y - (list.y + this.scroll + i * ROW_H) };
    return {
      move: (_x, ny) => {
        if (!this.drag) return;
        this.drag.y = ny;
        this.follow();
      },
      frame: () => this.autoScroll(),
      end: () => {
        this.drag = null;
      },
    };
  }

  /** 手指靠近列表上下边缘时滚动，越靠边越快 */
  private autoScroll(): void {
    const d = this.drag;
    const list = this.list;
    if (!d || !list) return;
    const contentH = this.order.length * ROW_H;
    if (d.y < list.y + EDGE) this.scroll += Math.ceil(((list.y + EDGE - d.y) / EDGE) * MAX_SPEED);
    else if (d.y > list.y + list.h - EDGE) this.scroll -= Math.ceil(((d.y - (list.y + list.h - EDGE)) / EDGE) * MAX_SPEED);
    else return;
    this.scroll = clampScroll(this.scroll, contentH, list.h);
    this.follow();
  }

  /** 把被拖的牌移到手指所在的位置 */
  private follow(): void {
    const d = this.drag as DragState;
    const list = this.list as Rect;
    const top = d.y - d.grab;
    const target = Math.max(0, Math.min(this.order.length - 1, Math.round((top - list.y - this.scroll) / ROW_H)));
    const cur = this.order.indexOf(d.id);
    if (target !== cur) {
      this.order.splice(cur, 1);
      this.order.splice(target, 0, d.id);
    }
  }
}

/** 一行：序号、卡牌小色块、名字和说明、拖动把手 */
function drawRow(ctx: Ctx, r: Rect, card: Card, index: number, lifted: boolean): void {
  const info = CARD_INFO[card.kind];
  drawPanel(ctx, r, { fill: lifted ? C.panelSolid : C.panel, stroke: lifted ? C.gold : C.panelLine, lineWidth: lifted ? 2 : 1 });
  drawText(ctx, String(index + 1), r.x + 26, r.y + r.h / 2, { size: 12, color: C.textMuted, align: 'right' });
  const chip = rect(r.x + 34, r.y + 5, 28, r.h - 10);
  const [top, bottom] = CARD_GRADIENT[info.color];
  const g = ctx.createLinearGradient(0, chip.y, 0, chip.y + chip.h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  roundRect(ctx, chip, 4);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = C.goldLine;
  ctx.stroke();
  drawText(ctx, info.name.slice(0, 1), chip.x + chip.w / 2, chip.y + chip.h / 2, { size: 13, bold: true, color: C.cardText, align: 'center' });
  const black = info.color === 'black';
  drawText(ctx, info.name, r.x + 72, r.y + r.h / 2 - 8, { size: 15, bold: black, color: black ? C.gold : C.text });
  drawText(ctx, info.desc, r.x + 72, r.y + r.h / 2 + 10, { size: 11, color: C.textMuted, maxWidth: r.w - 72 - HANDLE_W - 8 });
  drawText(ctx, '≡', r.x + r.w - HANDLE_W / 2, r.y + r.h / 2, { size: 20, color: C.textDim, align: 'center' });
}
