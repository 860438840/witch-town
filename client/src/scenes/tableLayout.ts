import type { Screen } from '../core/app';
import { rect, type Rect } from '../core/geom';

export interface TableLayout {
  top: Rect;
  grid: Rect[];
  cellH: number;
  log: Rect;
  me: Rect;
  info: Rect;
  hand: Rect;
  buttons: Rect;
}

const PAD = 12;
const COLS = 4;
const GAP = 6;

/** 从下往上排固定区域，剩下的高度给玩家网格。屏幕矮时缩小手牌和日志。 */
export function tableLayout(screen: Screen, others: number): TableLayout {
  const W = screen.W;
  const small = screen.bottom - screen.top < 560;
  const top = rect(PAD, screen.top, W - 2 * PAD, 32);
  const btnH = small ? 40 : 44;
  const buttons = rect(PAD, screen.bottom - 10 - btnH, W - 2 * PAD, btnH);
  const handH = small ? 76 : 96;
  const hand = rect(PAD, buttons.y - 6 - handH, W - 2 * PAD, handH);
  const info = rect(PAD, hand.y - 20, W - 2 * PAD, 18);
  const meH = small ? 34 : 40;
  const me = rect(PAD, info.y - 4 - meH, W - 2 * PAD, meH);
  const logH = small ? 40 : 58;
  const log = rect(PAD, me.y - 6 - logH, W - 2 * PAD, logH);
  const gridTop = top.y + top.h + 6;
  const rows = Math.max(1, Math.ceil(others / COLS));
  const avail = log.y - 6 - gridTop;
  const cellH = Math.max(48, Math.min(88, (avail - GAP * (rows - 1)) / rows));
  const cellW = (W - 2 * PAD - GAP * (COLS - 1)) / COLS;
  const grid = Array.from({ length: others }, (_, i) =>
    rect(PAD + (i % COLS) * (cellW + GAP), gridTop + Math.floor(i / COLS) * (cellH + GAP), cellW, cellH),
  );
  return { top, grid, cellH, log, me, info, hand, buttons };
}
