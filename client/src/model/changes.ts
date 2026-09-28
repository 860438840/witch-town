import type { CardKind } from '../../../engine/src/index';
import type { TableModel } from './table';

export type Change =
  | { kind: 'cardIn'; id: string }
  | { kind: 'play'; index: number; from: number; to: number; card: CardKind }
  | { kind: 'night'; on: boolean }
  | { kind: 'death'; seat: number }
  | { kind: 'reveal'; seat: number; index: number }
  | { kind: 'turn'; seat: number }
  | { kind: 'panel' };

export const ANIM_MS = { cardIn: 300, play: 450, night: 600, death: 500, reveal: 500, turn: 1800, panel: 250 } as const;

/**
 * 一次服务器写入里 version 最多增加多少：引擎每执行一个操作 version +1；
 * 玩家 act 只执行 1 个，最大的是夜晚超时的 tick——警长保护 1 个 + 每名存活玩家认罪 1 个 + 每名女巫投票 1 个，
 * 12 人局最多 1 + 12 + 12 = 25。超过它说明中间漏看了好几次更新（切到后台回来、重新进房），当作全新画面不播动效。
 */
export const MAX_VERSION_STEP = 1 + 2 * 12;

const dayTurn = (m: TableModel): number | null => (m.view.phase.kind === 'day' ? m.turnSeat : null);

/** 比较前后两份画面数据，找出需要播放动效的变化 */
export function diffTables(prev: TableModel | null, next: TableModel): Change[] {
  if (!prev || prev.code !== next.code || prev.view.log.length > next.view.log.length) return [];
  if (next.view.version - prev.view.version > MAX_VERSION_STEP) return [];
  const out: Change[] = [];
  if (prev.priv) {
    const before = new Set(prev.priv.hand.map((c) => c.id));
    for (const c of next.priv?.hand ?? []) if (!before.has(c.id)) out.push({ kind: 'cardIn', id: c.id });
  }
  next.view.log.slice(prev.view.log.length).forEach((e, k) => {
    if (e.t === 'play') out.push({ kind: 'play', index: prev.view.log.length + k, from: e.seat, to: e.targets[e.targets.length - 1], card: e.kind });
  });
  const wasNight = prev.view.phase.kind === 'night';
  const isNight = next.view.phase.kind === 'night';
  if (wasNight !== isNight) out.push({ kind: 'night', on: isNight });
  next.view.players.forEach((p, i) => {
    const q = prev.view.players[i];
    if (!q) return;
    if (q.alive && !p.alive) out.push({ kind: 'death', seat: i });
    if (!p.alive) return;
    p.tryals.forEach((t, j) => {
      if (t.revealed && q.tryals[j] && !q.tryals[j].revealed) out.push({ kind: 'reveal', seat: i, index: j });
    });
  });
  const turn = dayTurn(next);
  if (turn !== null && turn !== dayTurn(prev)) out.push({ kind: 'turn', seat: turn });
  if (next.pending && next.pending.kind !== 'turn' && prev.pending?.kind !== next.pending.kind) out.push({ kind: 'panel' });
  return out;
}
