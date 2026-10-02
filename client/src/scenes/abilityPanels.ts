import { isBlack } from '../../../engine/src/index';
import { rect } from '../core/geom';
import type { Node } from '../core/node';
import type { TableModel } from '../model/table';
import { drawCardFace, drawPanel, drawText } from '../theme/draw';
import { C, goldGlow } from '../theme/palette';
import type { Ui } from './ui';
import { requestButton, sheet } from './widgets';

/** 牧师：按卡种列出弃牌堆里的非黑卡，点一下拿一张（最多 2 张），再点已满的卡种取消 */
export function priestPanel(ui: Ui, m: TableModel, picked: string[], close: () => void): Node[] {
  const { nodes, body } = sheet(ui.screen, 420, '牧师：从弃牌堆拿牌', close, 1, '选 1–2 张非黑卡，拿完回合结束');
  const pool = m.view.discard.filter((c) => !isBlack(c.kind));
  const kinds = [...new Set(pool.map((c) => c.kind))];
  const cols = 5;
  const gap = 8;
  const w = (body.w - gap * (cols - 1)) / cols;
  const h = 78;
  kinds.forEach((kind, i) => {
    const r = rect(body.x + (i % cols) * (w + gap), body.y + Math.floor(i / cols) * (h + gap), w, h);
    const ids = pool.filter((c) => c.kind === kind).map((c) => c.id);
    const mine = picked.filter((id) => ids.includes(id)).length;
    nodes.push({
      id: `priest:${kind}`,
      rect: r,
      onTap: () => {
        const free = ids.find((id) => !picked.includes(id));
        if (free && picked.length < 2) {
          picked.push(free);
          return;
        }
        for (const id of ids) {
          const k = picked.indexOf(id);
          if (k >= 0) picked.splice(k, 1);
        }
      },
      draw: (ctx) => {
        drawPanel(ctx, r, { tint: mine ? goldGlow(0.2) : undefined, stroke: mine ? C.gold : undefined, glow: mine ? 0.6 : 0, lineWidth: mine ? 2 : 1 });
        drawCardFace(ctx, rect(r.x + (r.w - 40) / 2, r.y + 4, 40, 56), kind);
        drawText(ctx, mine ? `已选 ${mine} / ${ids.length}` : `${ids.length} 张`, r.x + r.w / 2, r.y + 69, {
          size: 11,
          align: 'center',
          color: mine ? C.gold : C.textDim,
        });
      },
    });
  });
  const y = body.y + Math.ceil(kinds.length / cols) * (h + gap) + 8;
  nodes.push(
    requestButton(
      'confirm-priest',
      rect(body.x, y, body.w, 44),
      picked.length ? `拿这 ${picked.length} 张` : '选择要拿的牌',
      picked.length ? () => void ui.ctl.act({ type: 'priestDraw', cardIds: [...picked] }) : null,
      ui.ctl.busy,
    ),
  );
  return nodes;
}
