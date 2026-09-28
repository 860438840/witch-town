import { contains, type Rect } from './geom';

export type Ctx = CanvasRenderingContext2D;

/** 画面上的一个元素。场景每次重画都重新生成节点树（立即模式），节点本身不保存状态。 */
export interface Node {
  /** 测试和调试用的名字 */
  id?: string;
  rect: Rect;
  draw?: (ctx: Ctx) => void;
  onTap?: () => void;
  /** 在该区域内上下拖动时调用，dy 为本次移动量（手指向上为负） */
  onScroll?: (dy: number) => void;
  children?: Node[];
  /** 绘制时裁剪到 rect（滚动列表用） */
  clip?: boolean;
}

export function drawNodes(ctx: Ctx, nodes: Node[]): void {
  for (const n of nodes) {
    ctx.save();
    if (n.clip) {
      ctx.beginPath();
      ctx.rect(n.rect.x, n.rect.y, n.rect.w, n.rect.h);
      ctx.clip();
    }
    n.draw?.(ctx);
    if (n.children) drawNodes(ctx, n.children);
    ctx.restore();
  }
}

/** 返回位于 (x, y)、带有指定回调的最上层节点（后画的在上层，子节点在父节点之上） */
export function hitTest(nodes: Node[], x: number, y: number, key: 'onTap' | 'onScroll'): Node | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.children) {
      const hit = hitTest(n.children, x, y, key);
      if (hit) return hit;
    }
    if (n[key] && contains(n.rect, x, y)) return n;
  }
  return null;
}

export function findNode(nodes: Node[], id: string): Node | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const hit = findNode(n.children, id);
      if (hit) return hit;
    }
  }
  return null;
}
