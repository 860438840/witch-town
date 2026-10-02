import type { Scene } from '../core/app';
import { rect } from '../core/geom';
import type { Node } from '../core/node';
import { drawBadge, drawPanel, drawText, drawTryalChip } from '../theme/draw';
import { C } from '../theme/palette';
import type { Ui } from './ui';
import { button, skyNode } from './widgets';

export class ResultScene implements Scene {
  constructor(private readonly ui: Ui) {}

  build(_now: number): Node[] {
    const { W, top, bottom } = this.ui.screen;
    const ctl = this.ui.ctl;
    const view = ctl.room?.view;
    if (!view || view.phase.kind !== 'ended') return [];
    const village = view.phase.winner === 'village';
    const mySeat = ctl.room!.seats.findIndex((s) => s.openid === ctl.openid);
    const nodes: Node[] = [skyNode(this.ui.screen, 0, village ? 'village' : 'witch')];
    nodes.push({
      rect: rect(0, top, W, 90),
      draw: (ctx) => {
        drawText(ctx, village ? '村民胜利' : '女巫胜利', W / 2, top + 30, { size: 36, serif: true, color: village ? C.gold : C.moon, align: 'center' });
        drawText(ctx, village ? '女巫阵营全部出局' : '活着的人全部属于女巫阵营', W / 2, top + 68, { size: 13, color: C.textDim, align: 'center' });
      },
    });
    const btnY = bottom - 12 - 48;
    const listTop = top + 100;
    const rowH = Math.min(52, (btnY - 10 - listTop) / Math.max(1, view.players.length));
    view.players.forEach((p, i) => {
      const r = rect(12, listTop + i * rowH, W - 24, rowH - 4);
      nodes.push({
        rect: r,
        draw: (ctx) => {
          drawPanel(ctx, r, { stroke: p.witchFaction ? C.danger : undefined });
          drawBadge(ctx, r.x + 18, r.y + r.h / 2, Math.min(13, r.h / 2 - 3), p.name, p.seat, p.character);
          drawText(ctx, `${p.name}${i === mySeat ? '（你）' : ''}`, r.x + 38, r.y + r.h / 2 - 7, { size: 13, maxWidth: r.w * 0.4 });
          drawText(ctx, `${p.witchFaction ? '女巫阵营' : '村民阵营'} · ${p.alive ? '存活' : '出局'}`, r.x + 38, r.y + r.h / 2 + 9, { size: 11, color: p.witchFaction ? C.danger : C.textDim });
          const cw = 12;
          const x0 = r.x + r.w - 10 - p.tryals.length * (cw + 3);
          p.tryals.forEach((t, j) => drawTryalChip(ctx, rect(x0 + j * (cw + 3), r.y + r.h / 2 - 8, cw, 16), t.kind, true));
        },
      });
    });
    nodes.push(button('result-home', rect(12, btnY, W - 24, 48), '回到首页', () => ctl.backHome()));
    return nodes;
  }
}
