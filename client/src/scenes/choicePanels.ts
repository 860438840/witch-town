import { rect, type Rect } from '../core/geom';
import type { Node } from '../core/node';
import { dawnTargets, nightSteps, nightTargets, unrevealedTryals, type NightPending, type NightStep } from '../model/actions';
import { TRYAL_NAME } from '../model/cards';
import { formatCountdown, nameOf, type TableModel } from '../model/table';
import { drawBadge, drawPanel, drawText, drawTryalChip } from '../theme/draw';
import { C, goldGlow } from '../theme/palette';
import type { Ui } from './ui';
import { button, sheet, textNode } from './widgets';

export interface ChoiceState {
  key: string;
  /** 已选中的身份卡 id 或盲抽序号（等待确认） */
  picked: string | number | null;
  /** 夜晚「怀疑对象」（只在本地记录） */
  suspect: number | null;
}

export function choiceKey(m: TableModel): string {
  return m.pending ? `${m.pending.kind}:${m.view.phase.kind}:${m.view.log.length}` : '';
}

/** 一排玩家按钮（每行 4 个）。返回节点和占用的高度。 */
function seatGrid(
  m: TableModel,
  area: Rect,
  prefix: string,
  seats: number[],
  selected: number | null,
  marks: Record<number, string[]>,
  onPick: ((seat: number) => void) | null,
): { nodes: Node[]; height: number } {
  const cols = 4;
  const gap = 6;
  const w = (area.w - gap * (cols - 1)) / cols;
  const h = 36;
  const nodes = seats.map((seat, i) => {
    const r = rect(area.x + (i % cols) * (w + gap), area.y + Math.floor(i / cols) * (h + gap), w, h);
    const p = m.view.players[seat];
    const mark = marks[seat]?.join('、') ?? '';
    return {
      id: `${prefix}:${seat}`,
      rect: r,
      onTap: onPick ? () => onPick(seat) : undefined,
      draw: (ctx: CanvasRenderingContext2D) => {
        drawPanel(ctx, r, { fill: selected === seat ? goldGlow(0.25) : C.panel, stroke: selected === seat ? C.gold : C.panelLine, lineWidth: selected === seat ? 2 : 1 });
        drawBadge(ctx, r.x + 13, r.y + h / 2, 9, p.name, seat);
        drawText(ctx, nameOf(m, seat), r.x + 26, r.y + (mark ? 12 : h / 2), { size: 12, maxWidth: r.w - 30 });
        if (mark) drawText(ctx, mark, r.x + 26, r.y + 26, { size: 9, color: C.gold, maxWidth: r.w - 30 });
      },
    } satisfies Node;
  });
  return { nodes, height: Math.ceil(seats.length / cols) * (h + gap) };
}

function votesToMarks(m: TableModel, votes: Record<number, number> | null): Record<number, string[]> {
  const marks: Record<number, string[]> = {};
  for (const [voter, target] of Object.entries(votes ?? {})) (marks[target] ??= []).push(nameOf(m, Number(voter)));
  return marks;
}

/** 一排身份卡（faceUp 为 false 时画背面） */
function tryalRow(area: Rect, items: { id: string; kind: 'witch' | 'constable' | 'villager' | null }[], prefix: string, selected: string | number | null, onPick: (key: string, i: number) => void): { nodes: Node[]; height: number } {
  const n = items.length;
  const gap = 8;
  const w = Math.min(52, (area.w - gap * (n - 1)) / Math.max(1, n));
  const h = Math.round(w * 1.3);
  const x0 = area.x + (area.w - (n * w + (n - 1) * gap)) / 2;
  const nodes = items.map((it, i) => {
    const r = rect(x0 + i * (w + gap), area.y, w, h);
    const sel = selected === it.id || selected === i;
    return {
      id: `${prefix}:${it.id}`,
      rect: r,
      onTap: () => onPick(it.id, i),
      draw: (ctx: CanvasRenderingContext2D) => {
        drawTryalChip(ctx, r, it.kind, it.kind !== null);
        if (sel) drawPanel(ctx, rect(r.x - 3, r.y - 3, r.w + 6, r.h + 6), { fill: C.transparent, stroke: C.gold, lineWidth: 2, radius: 4 });
        if (it.kind) drawText(ctx, TRYAL_NAME[it.kind], r.x + w / 2, r.y + h + 11, { size: 11, align: 'center' });
      },
    } satisfies Node;
  });
  return { nodes, height: h + (items.some((x) => x.kind) ? 20 : 4) };
}

export function choicePanel(ui: Ui, m: TableModel, st: ChoiceState, now: number, slide = 1): Node[] {
  const p = m.pending;
  if (!p || p.kind === 'turn') return [];
  const key = choiceKey(m);
  if (st.key !== key) {
    st.key = key;
    st.picked = null;
    st.suspect = null;
  }
  const cd = formatCountdown(m.deadline, now);
  const busy = ui.ctl.busy;
  const act = ui.ctl.act.bind(ui.ctl);

  if (p.kind === 'revealTryal') {
    const title = p.reason === 'trial' ? '你受到审判：翻开一张身份卡' : '传染：你持有黑猫，翻开一张身份卡';
    const { nodes, body } = sheet(ui.screen, 320, title, null, slide, `剩余 ${cd} · 超时将随机翻开`);
    const tryals = unrevealedTryals(m);
    const row = tryalRow(body, tryals.map((t) => ({ id: t.id, kind: t.kind })), 'tryal', st.picked, (id) => (st.picked = id));
    nodes.push(...row.nodes);
    const picked = tryals.find((t) => t.id === st.picked);
    let y = body.y + row.height + 8;
    if (picked?.kind === 'witch') {
      nodes.push(textNode(rect(body.x, y, body.w, 20), '翻开女巫卡会立即死亡', { size: 13, color: C.danger, align: 'center' }));
    }
    y += 28;
    nodes.push(button('confirm-reveal', rect(body.x, y, body.w, 44), '确认翻开', picked && !busy ? () => void act({ type: 'revealTryal', tryalId: picked.id }) : null));
    return nodes;
  }

  if (p.kind === 'conspiracyPick') {
    const from = m.view.players[p.from];
    const { nodes, body } = sheet(ui.screen, 300, `传染：从 ${from.name} 的身份卡里盲抽一张`, null, slide, `剩余 ${cd} · 超时将随机抽取`);
    const items = Array.from({ length: p.count }, (_, i) => ({ id: String(i), kind: null }));
    const row = tryalRow(body, items, 'pick', st.picked, (_id, i) => (st.picked = i));
    nodes.push(...row.nodes);
    const idx = typeof st.picked === 'number' ? st.picked : null;
    nodes.push(button('confirm-pick', rect(body.x, body.y + row.height + 16, body.w, 44), '拿这张', idx !== null && !busy ? () => void act({ type: 'conspiracyPick', index: idx }) : null));
    return nodes;
  }

  if (p.kind === 'dawnVote') {
    const { nodes, body } = sheet(ui.screen, 360, '第一夜：和同伴一起选择黑猫的主人', null, slide, `同伴选择一致后生效 · 剩余 ${cd}`);
    const mine = m.mySeat !== null ? p.votes[m.mySeat] ?? null : null;
    const grid = seatGrid(m, body, 'vote', dawnTargets(m), mine, votesToMarks(m, p.votes), busy ? null : (seat) => void act({ type: 'witchVote', target: seat }));
    nodes.push(...grid.nodes);
    return nodes;
  }

  return nightPanel(ui, m, p, st, cd, slide);
}

const STEP_TITLE: Record<NightStep, string> = {
  kill: '选择击杀目标（同伴须一致）',
  protect: '选择保护一名玩家（不能是自己）',
  suspect: '选择你怀疑的人',
};

function nightPanel(ui: Ui, m: TableModel, p: NightPending, st: ChoiceState, cd: string, slide: number): Node[] {
  const busy = ui.ctl.busy;
  const act = ui.ctl.act.bind(ui.ctl);
  const { nodes, body } = sheet(ui.screen, ui.screen.H - ui.screen.top, '夜晚', null, slide, `剩余 ${cd} · 超时将自动处理`);
  let y = body.y;
  for (const step of nightSteps(p)) {
    nodes.push(textNode(rect(body.x, y, body.w, 20), STEP_TITLE[step], { size: 13, color: C.gold }));
    y += 24;
    const seats = nightTargets(m, step);
    const area = rect(body.x, y, body.w, 0);
    const grid =
      step === 'kill'
        ? seatGrid(m, area, 'kill', seats, m.mySeat !== null ? (p.votes?.[m.mySeat] ?? null) : null, votesToMarks(m, p.votes), busy ? null : (seat) => void act({ type: 'witchVote', target: seat }))
        : step === 'protect'
          ? seatGrid(m, area, 'protect', seats, p.protect, {}, busy ? null : (seat) => void act({ type: 'protect', target: seat }))
          : seatGrid(m, area, 'suspect', seats, st.suspect, {}, (seat) => (st.suspect = seat));
    nodes.push(...grid.nodes);
    y += grid.height + 8;
  }
  if (p.confessed) {
    nodes.push(textNode(rect(body.x, y, body.w, 24), '自首：已决定。等待其他玩家…', { size: 13, color: C.textDim }));
    return nodes;
  }
  nodes.push(textNode(rect(body.x, y, body.w, 20), '是否自首？自首要翻开一张身份卡，当晚不会被杀', { size: 13, color: C.gold }));
  y += 26;
  const tryals = unrevealedTryals(m);
  const row = tryalRow(rect(body.x, y, body.w, 0), tryals.map((t) => ({ id: t.id, kind: t.kind })), 'confess', st.picked, (id) => (st.picked = id));
  nodes.push(...row.nodes);
  y += row.height + 6;
  const half = (body.w - 10) / 2;
  const picked = typeof st.picked === 'string' ? st.picked : null;
  nodes.push(
    button('no-confess', rect(body.x, y, half, 42), '不自首', busy ? null : () => void act({ type: 'confess', tryalId: null }), 'secondary'),
    button('confirm-confess', rect(body.x + half + 10, y, half, 42), '自首', picked && !busy ? () => void act({ type: 'confess', tryalId: picked }) : null, 'danger'),
  );
  return nodes;
}
