import type { Scene } from '../core/app';
import { rect } from '../core/geom';
import type { Node } from '../core/node';
import { RULES } from '../model/rules';
import { drawText } from '../theme/draw';
import { C } from '../theme/palette';
import type { Ui } from './ui';
import { button, requestButton, ScrollBox, sheet, skyNode, type Line } from './widgets';

const RULE_LINES: Line[] = RULES.flatMap((s) => [
  { text: s.title, size: 15, serif: true, color: C.gold, gap: 2 },
  ...s.items.map((it, i) => ({ text: it.icon ? it.text : `· ${it.text}`, icon: it.icon, size: 13, gap: i === s.items.length - 1 ? 10 : 2 })),
]);

export class HomeScene implements Scene {
  private rules = false;
  private readonly box = new ScrollBox();

  constructor(private readonly ui: Ui) {}

  build(_now: number): Node[] {
    const { W, H, top } = this.ui.screen;
    const ctl = this.ui.ctl;
    const busy = ctl.busy;
    const nodes: Node[] = [skyNode(this.ui.screen, 0, 'home')];
    const titleY = top + H * 0.14;
    nodes.push({
      rect: rect(0, titleY - 30, W, 100),
      draw: (ctx) => {
        drawText(ctx, '女巫镇', W / 2, titleY, { size: 46, serif: true, color: C.gold, align: 'center' });
        drawText(ctx, 'Salem 1692 · 朋友局', W / 2, titleY + 44, { size: 14, color: C.textDim, align: 'center' });
      },
    });
    const nick = ctl.nickname ?? '（未设置）';
    nodes.push({
      id: 'nickname',
      rect: rect(W - 200, top, 188, 28),
      onTap: () => this.ui.prompt('修改昵称', '1–12 个字', (name) => ctl.setNickname(name)),
      draw: (ctx) => drawText(ctx, `昵称：${nick} ✎`, W - 12, top + 14, { size: 13, color: C.textDim, align: 'right', maxWidth: 188 }),
    });
    const bw = Math.min(280, W - 64);
    const bx = (W - bw) / 2;
    const y = H * 0.5;
    nodes.push(
      requestButton('join', rect(bx, y, bw, 54), '输入房号加入', () => this.ui.prompt('输入房间号', '4 位数字', (code) => void ctl.joinRoom(code)), busy),
      requestButton('create', rect(bx, y + 70, bw, 48), '创建房间', () => void ctl.createRoom(), busy, 'secondary'),
      button('rules', rect(bx, y + 132, bw, 48), '规则速查', () => {
        this.rules = true;
        this.box.reset();
      }, 'secondary'),
    );
    if (this.rules) {
      const { nodes: panel, body } = sheet(this.ui.screen, this.ui.screen.H - top, '规则速查', () => (this.rules = false));
      nodes.push(...panel, this.box.node('rules-list', body, RULE_LINES));
    }
    return nodes;
  }
}
