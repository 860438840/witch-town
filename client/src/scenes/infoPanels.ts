import type { PublicPlayer } from '../../../engine/src/index';
import { rect } from '../core/geom';
import type { Node } from '../core/node';
import { wrapText } from '../core/text';
import { CARD_INFO, TRYAL_NAME, type CardColor } from '../model/cards';
import { CHAR_INFO } from '../model/characters';
import { logLines } from '../model/log';
import { nameOf, type TableModel } from '../model/table';
import { drawText, drawTryalChip } from '../theme/draw';
import { C, font } from '../theme/palette';
import type { Ui } from './ui';
import { sheet, type ScrollBox } from './widgets';

function countNames(names: string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].map(([n, k]) => (k > 1 ? `${n}×${k}` : n)).join('、');
}

function characterLines(p: PublicPlayer): string[] {
  if (!p.character) return [];
  const c = CHAR_INFO[p.character];
  const lines = [`角色：${c.name}——${c.desc}`];
  if (p.character === 'tailor') {
    lines.push(p.ability ? `当前技能：${CHAR_INFO[p.ability].name}——${CHAR_INFO[p.ability].desc}` : '当前技能：无（右手边的人没有角色）');
  }
  if (p.usesLeft !== null) lines.push(`技能剩余次数：${p.usesLeft}`);
  return lines;
}

export function detailPanel(ui: Ui, m: TableModel, seat: number, close: () => void): Node[] {
  const p = m.view.players[seat];
  const { nodes, body } = sheet(ui.screen, 420, `${p.name}${seat === m.mySeat ? '（你）' : ''}${p.alive ? '' : '（已出局）'}`, close);
  const revealed = p.tryals.filter((t) => t.revealed && t.kind).map((t) => TRYAL_NAME[t.kind!]);
  const reds = countNames(p.red.map((c) => CARD_INFO[c.kind].name));
  const lines = [
    ...characterLines(p),
    `指控：${p.redTotal} / ${p.threshold}${reds ? `（${reds}）` : ''}`,
    `蓝卡：${p.blue.length ? countNames(p.blue.map((c) => CARD_INFO[c.kind].name)) : '无'}`,
    ...(p.green.length ? [`面前：${countNames(p.green.map((c) => CARD_INFO[c.kind].name))}`] : []),
    `手牌：${p.handCount} 张`,
    `身份卡：${p.tryals.length - revealed.length} 张未翻开${revealed.length ? `；已翻开 ${revealed.join('、')}` : ''}`,
  ];
  nodes.push({
    id: 'detail-body',
    rect: body,
    draw: (ctx) => {
      ctx.font = font(14);
      let y = body.y + 12;
      for (const line of lines) {
        for (const t of wrapText(line, body.w, (s) => ctx.measureText(s).width)) {
          drawText(ctx, t, body.x, y, { size: 14 });
          y += 22;
        }
        y += 6;
      }
    },
  });
  return nodes;
}

export function myTryalsPanel(ui: Ui, m: TableModel, close: () => void): Node[] {
  const { nodes, body } = sheet(ui.screen, 320, '我的身份卡', close, 1, '只有你自己能看到');
  const priv = m.priv;
  if (!priv) return nodes;
  const n = priv.tryals.length;
  const w = Math.min(56, (body.w - 8 * (n - 1)) / Math.max(1, n));
  const h = Math.round(w * 1.35);
  const x0 = body.x + (body.w - (n * w + (n - 1) * 8)) / 2;
  const partners = priv.witchPartners.map((s) => nameOf(m, s)).join('、');
  const lines = [
    priv.witchFaction ? `你属于女巫阵营。同伴：${partners || '没有'}` : '你属于村民阵营。',
    ...(priv.isConstable ? ['你持有警长卡：夜晚可以保护一名其他玩家。'] : []),
  ];
  nodes.push({
    id: 'my-tryals',
    rect: body,
    draw: (ctx) => {
      priv.tryals.forEach((t, i) => {
        const r = rect(x0 + i * (w + 8), body.y + 6, w, h);
        drawTryalChip(ctx, r, t.kind, true);
        drawText(ctx, `${TRYAL_NAME[t.kind]}${t.revealed ? '·已翻开' : ''}`, r.x + w / 2, r.y + h + 12, { size: 11, align: 'center', color: t.revealed ? C.textMuted : C.text });
      });
      lines.forEach((t, i) => drawText(ctx, t, body.x, body.y + h + 44 + i * 24, { size: 13, color: C.gold, maxWidth: body.w }));
    },
  });
  return nodes;
}

export function logPanel(ui: Ui, m: TableModel, box: ScrollBox, close: () => void): Node[] {
  const { nodes, body } = sheet(ui.screen, ui.screen.H * 0.8, '事件记录', close, 1, '最新的在最上面');
  const lines = logLines(m.view)
    .reverse()
    .map((text, i) => ({ text, size: 13, color: i === 0 ? C.text : C.textDim, gap: 2 }));
  nodes.push(box.node('log-list', body, lines));
  return nodes;
}

const COLOR_GROUPS: [string, CardColor][] = [
  ['红卡', 'red'],
  ['蓝卡', 'blue'],
  ['绿卡', 'green'],
  ['黑卡', 'black'],
];

export function discardPanel(ui: Ui, m: TableModel, box: ScrollBox, close: () => void): Node[] {
  const discard = m.view.discard;
  const { nodes, body } = sheet(ui.screen, ui.screen.H * 0.6, `弃牌堆（${discard.length} 张）`, close, 1, '所有人都可以查看');
  const lines = COLOR_GROUPS.flatMap(([title, color]) => {
    const names = discard.filter((c) => CARD_INFO[c.kind].color === color).map((c) => CARD_INFO[c.kind].name);
    return names.length ? [{ text: `${title}：${countNames(names)}`, size: 14, gap: 8 }] : [];
  });
  nodes.push(box.node('discard-list', body, lines.length ? lines : [{ text: '弃牌堆是空的', color: C.textMuted }]));
  return nodes;
}
