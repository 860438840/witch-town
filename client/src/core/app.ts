import { drawNodes, hitTest, type Ctx, type Node } from './node';
import { Animator } from './tween';

export interface Screen {
  W: number;
  H: number;
  /** 内容区顶部（右上角胶囊按钮下沿之下） */
  top: number;
  /** 内容区底部（安全区下沿） */
  bottom: number;
}

export interface Scene {
  build(now: number): Node[];
}

interface Touch {
  x0: number;
  y0: number;
  lastY: number;
  moved: boolean;
  scroll: Node | null;
}

export class App {
  readonly animator = new Animator();
  private scene: Scene | null = null;
  private nodes: Node[] = [];
  private scheduled = false;
  private touch: Touch | null = null;

  constructor(
    private readonly ctx: Ctx,
    readonly screen: Screen,
    private readonly raf: (cb: () => void) => void,
    readonly clock: () => number,
  ) {}

  setScene(scene: Scene): void {
    this.scene = scene;
    this.render();
  }

  /** 请求在下一帧重画；同一帧内多次调用只画一次 */
  render(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    this.raf(() => {
      this.scheduled = false;
      this.draw();
    });
  }

  draw(): void {
    if (!this.scene) return;
    const now = this.clock();
    this.nodes = this.scene.build(now);
    this.ctx.clearRect(0, 0, this.screen.W, this.screen.H);
    drawNodes(this.ctx, this.nodes);
    if (this.animator.active(now)) this.render();
  }

  get current(): Node[] {
    return this.nodes;
  }

  touchStart(x: number, y: number): void {
    this.touch = { x0: x, y0: y, lastY: y, moved: false, scroll: hitTest(this.nodes, x, y, 'onScroll') };
  }

  touchMove(x: number, y: number): void {
    const t = this.touch;
    if (!t) return;
    if (!t.moved && Math.abs(x - t.x0) + Math.abs(y - t.y0) > 8) t.moved = true;
    if (t.moved && t.scroll) {
      t.scroll.onScroll!(y - t.lastY);
      this.render();
    }
    t.lastY = y;
  }

  touchEnd(x: number, y: number): void {
    const t = this.touch;
    this.touch = null;
    if (!t || t.moved) return;
    const n = hitTest(this.nodes, x, y, 'onTap');
    if (n) {
      n.onTap!();
      this.render();
    }
  }
}
