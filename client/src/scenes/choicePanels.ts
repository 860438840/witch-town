import type { PendingChoice } from '../../../engine/src/index';
import { rect, type Rect } from '../core/geom';
import type { Node } from '../core/node';
import { wrapText } from '../core/text';
import { dawnTargets, nightSteps, nightTargets, unrevealedTryals, type NightPending, type NightStep } from '../model/actions';
import { TRYAL_NAME } from '../model/cards';
import { CHAR_INFO } from '../model/characters';
import { formatCountdown, isPartner, nameOf, type TableModel } from '../model/table';
import { drawBadge, drawPanel, drawText, drawTryalChip } from '../theme/draw';
import { C, font, goldGlow } from '../theme/palette';
import type { Ui } from './ui';
import { button, requestButton, sheet, textNode } from './widgets';

export interface ChoiceState {
  key: string;
  /** 已选中的身份卡 id 或盲抽序号（等待确认） */
  picked: string | number | null;
  /** 夜晚「怀疑对象」（只在本地记录） */
  suspect: number | null;
}

export function choiceKey(m: TableModel): string {
  if (!m.pending) return '';
  // 选角色时别人选择也会写日志，不能因此清掉自己已点选的候选
  if (m.pending.kind === 'characterPick') return `characterPick:${m.view.phase.kind}`;
  return `${m.pending.kind}:${m.view.phase.kind}:${m.view.log.length}`;
}

interface SeatSize {
  h: number;
  gap: number;
}
const SEAT_NORMAL: SeatSize = { h: 36, gap: 6 };
const SEAT_COMPACT: SeatSize = { h: 28, gap: 4 };
const SEAT_COLS = 4;

const seatGridHeight = (count: number, size: SeatSize): number => Math.ceil(count / SEAT_COLS) * (size.h + size.gap);

/** 一排玩家按钮（每行 4 个）。返回节点和占用的高度。 */
function seatGrid(
  m: TableModel,
  area: Rect,
  prefix: string,
  seats: number[],
  selected: number | null,
  marks: Record<number, string[]>,
  onPick: ((seat: number) => void) | null,
  size: SeatSize = SEAT_NORMAL,
): { nodes: Node[]; height: number } {
  const cols = SEAT_COLS;
  const { h, gap } = size;
  const w = (area.w - gap * (cols - 1)) / cols;
  const nodes = seats.map((seat, i) => {
    const r = rect(area.x + (i % cols) * (w + gap), area.y + Math.floor(i / cols) * (h + gap), w, h);
    const p = m.view.players[seat];
    const partner = isPartner(m, seat);
    const mark = [...(partner ? ['同伴'] : []), ...(marks[seat] ?? [])].join('、');
    return {
      id: `${prefix}:${seat}`,
      rect: r,
      onTap: onPick ? () => onPick(seat) : undefined,
      draw: (ctx: CanvasRenderingContext2D) => {
        drawPanel(ctx, r, { fill: selected === seat ? goldGlow(0.25) : C.panel, stroke: selected === seat ? C.gold : partner ? C.danger : C.panelLine, lineWidth: selected === seat ? 2 : 1 });
        drawBadge(ctx, r.x + 13, r.y + h / 2, 9, p.name, seat, p.character);
        drawText(ctx, nameOf(m, seat), r.x + 26, r.y + (mark ? h / 3 : h / 2), { size: 12, maxWidth: r.w - 30 });
        if (mark) drawText(ctx, mark, r.x + 26, r.y + h * 0.72, { size: 9, color: partner ? C.danger : C.gold, maxWidth: r.w - 30 });
      },
    } satisfies Node;
  });
  return { nodes, height: seatGridHeight(seats.length, size) };
}

function votesToMarks(m: TableModel, votes: Record<number, number> | null): Record<number, string[]> {
  const marks: Record<number, string[]> = {};
  for (const [voter, target] of Object.entries(votes ?? {})) (marks[target] ??= []).push(nameOf(m, Number(voter)));
  return marks;
}

const CHIP_GAP = 8;
const chipWidth = (areaW: number, n: number, maxW: number): number => Math.min(maxW, (areaW - CHIP_GAP * (n - 1)) / Math.max(1, n));
const tryalRowHeight = (areaW: number, n: number, labels: boolean, maxW: number): number =>
  Math.round(chipWidth(areaW, n, maxW) * 1.3) + (labels ? 20 : 4);

/** 一排身份卡（kind 为 null 时画背面） */
function tryalRow(
  area: Rect,
  items: { id: string; kind: 'witch' | 'constable' | 'villager' | null }[],
  prefix: string,
  selected: string | number | null,
  onPick: (key: string, i: number) => void,
  maxW = 52,
): { nodes: Node[]; height: number } {
  const n = items.length;
  const gap = CHIP_GAP;
  const w = chipWidth(area.w, n, maxW);
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
  return { nodes, height: tryalRowHeight(area.w, n, items.some((x) => x.kind), maxW) };
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

  if (p.kind === 'storytelling') return [];
  if (p.kind === 'characterPick') return characterPanel(ui, m, p, st, cd, slide);
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
    nodes.push(requestButton('confirm-reveal', rect(body.x, y, body.w, 44), '确认翻开', picked ? () => void act({ type: 'revealTryal', tryalId: picked.id }) : null, busy));
    return nodes;
  }

  if (p.kind === 'conspiracyPick') {
    const from = m.view.players[p.from];
    const { nodes, body } = sheet(ui.screen, 300, `传染：从 ${from.name} 的身份卡里盲抽一张`, null, slide, `剩余 ${cd} · 超时将随机抽取`);
    const items = Array.from({ length: p.count }, (_, i) => ({ id: String(i), kind: null }));
    const row = tryalRow(body, items, 'pick', st.picked, (_id, i) => (st.picked = i));
    nodes.push(...row.nodes);
    const idx = typeof st.picked === 'number' ? st.picked : null;
    nodes.push(requestButton('confirm-pick', rect(body.x, body.y + row.height + 16, body.w, 44), '拿这张', idx !== null ? () => void act({ type: 'conspiracyPick', index: idx }) : null, busy));
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

/** 夜晚面板的排版档位：内容放不下时依次缩小座位按钮和自首身份卡 */
const NIGHT_LEVELS: { seat: SeatSize; chip: number }[] = [
  { seat: SEAT_NORMAL, chip: 52 },
  { seat: SEAT_COMPACT, chip: 52 },
  { seat: SEAT_COMPACT, chip: 40 },
  { seat: SEAT_COMPACT, chip: 30 },
];
const NIGHT_BUTTON_H = 42;

function nightPanel(ui: Ui, m: TableModel, p: NightPending, st: ChoiceState, cd: string, slide: number): Node[] {
  const busy = ui.ctl.busy;
  const act = ui.ctl.act.bind(ui.ctl);
  const sheetH = ui.screen.H - ui.screen.top;
  const { nodes, body } = sheet(ui.screen, sheetH, '夜晚', null, slide, `剩余 ${cd} · 超时将自动处理`);
  // 面板滑入时整体平移：按停稳后的高度排版
  const bodyH = body.h + sheetH * (1 - slide);
  const steps = nightSteps(p).map((step) => ({ step, seats: nightTargets(m, step) }));
  const tryals = p.confessed ? [] : unrevealedTryals(m);
  // 官员还有次数时，两个自首按钮上方多一个「不翻牌自首」
  const silentLeft = !p.confessed && m.me?.ability === 'official' ? (m.me.usesLeft ?? 0) : 0;
  const btnY = body.y + bodyH - NIGHT_BUTTON_H;
  const silentY = btnY - NIGHT_BUTTON_H - 8;
  const avail = p.confessed ? bodyH - 24 : (silentLeft > 0 ? silentY : btnY) - body.y;
  const need = (lv: (typeof NIGHT_LEVELS)[number]): number =>
    steps.reduce((sum, x) => sum + 24 + seatGridHeight(x.seats.length, lv.seat) + 8, 0) +
    (p.confessed ? 0 : 26 + tryalRowHeight(body.w, tryals.length, tryals.length > 0, lv.chip) + 6);
  const lv = NIGHT_LEVELS.find((l) => need(l) <= avail) ?? NIGHT_LEVELS[NIGHT_LEVELS.length - 1];

  let y = body.y;
  for (const { step, seats } of steps) {
    nodes.push(textNode(rect(body.x, y, body.w, 20), STEP_TITLE[step], { size: 13, color: C.gold }));
    y += 24;
    const area = rect(body.x, y, body.w, 0);
    const grid =
      step === 'kill'
        ? seatGrid(m, area, 'kill', seats, m.mySeat !== null ? (p.votes?.[m.mySeat] ?? null) : null, votesToMarks(m, p.votes), busy ? null : (seat) => void act({ type: 'witchVote', target: seat }), lv.seat)
        : step === 'protect'
          ? seatGrid(m, area, 'protect', seats, p.protect, {}, busy ? null : (seat) => void act({ type: 'protect', target: seat }), lv.seat)
          : seatGrid(m, area, 'suspect', seats, st.suspect, {}, (seat) => (st.suspect = seat), lv.seat);
    nodes.push(...grid.nodes);
    y += grid.height + 8;
  }
  if (p.confessed) {
    nodes.push(textNode(rect(body.x, y, body.w, 24), '自首：已决定。等待其他玩家…', { size: 13, color: C.textDim }));
    return nodes;
  }
  nodes.push(textNode(rect(body.x, y, body.w, 20), '是否自首？自首要翻开一张身份卡，当晚不会被杀', { size: 13, color: C.gold }));
  y += 26;
  const row = tryalRow(rect(body.x, y, body.w, 0), tryals.map((t) => ({ id: t.id, kind: t.kind })), 'confess', st.picked, (id) => (st.picked = id), lv.chip);
  nodes.push(...row.nodes);
  const half = (body.w - 10) / 2;
  const picked = typeof st.picked === 'string' ? st.picked : null;
  nodes.push(
    requestButton('no-confess', rect(body.x, btnY, half, NIGHT_BUTTON_H), '不自首', () => void act({ type: 'confess', tryalId: null }), busy, 'secondary'),
    requestButton('confirm-confess', rect(body.x + half + 10, btnY, half, NIGHT_BUTTON_H), '自首', picked ? () => void act({ type: 'confess', tryalId: picked }) : null, busy, 'danger'),
  );
  if (silentLeft > 0) {
    nodes.push(
      requestButton(
        'silent-confess',
        rect(body.x, silentY, body.w, NIGHT_BUTTON_H),
        `不翻牌自首（剩 ${silentLeft} 次）`,
        () => void act({ type: 'confess', tryalId: null, silent: true }),
        busy,
        'secondary',
      ),
    );
  }
  return nodes;
}

function characterPanel(
  ui: Ui,
  _m: TableModel,
  p: Extract<PendingChoice, { kind: 'characterPick' }>,
  st: ChoiceState,
  cd: string,
  slide: number,
): Node[] {
  const { nodes, body } = sheet(ui.screen, 400, '选择你的角色', null, slide, `角色对所有人公开 · 剩余 ${cd} · 超时随机选择`);
  const gap = 10;
  const w = (body.w - gap) / 2;
  const h = Math.min(200, body.h - 60);
  p.offers.forEach((c, i) => {
    const r = rect(body.x + i * (w + gap), body.y, w, h);
    nodes.push({
      id: `character:${c}`,
      rect: r,
      onTap: () => (st.picked = i),
      draw: (ctx) => {
        const sel = st.picked === i;
        drawPanel(ctx, r, { fill: sel ? goldGlow(0.2) : C.panel, stroke: sel ? C.gold : C.panelLine, lineWidth: sel ? 2 : 1 });
        drawText(ctx, CHAR_INFO[c].name, r.x + r.w / 2, r.y + 28, { size: 20, bold: true, color: C.gold, align: 'center' });
        ctx.font = font(13);
        wrapText(CHAR_INFO[c].desc, r.w - 20, (s) => ctx.measureText(s).width).forEach((line, k) =>
          drawText(ctx, line, r.x + 10, r.y + 62 + k * 20, { size: 13 }),
        );
      },
    });
  });
  const idx = typeof st.picked === 'number' ? st.picked : null;
  nodes.push(
    requestButton(
      'confirm-character',
      rect(body.x, body.y + h + 16, body.w, 44),
      '选这个角色',
      idx !== null ? () => void ui.ctl.act({ type: 'pickCharacter', index: idx }) : null,
      ui.ctl.busy,
    ),
  );
  return nodes;
}

