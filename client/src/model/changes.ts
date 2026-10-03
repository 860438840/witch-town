import type { CardKind } from '../../../engine/src/index';
import type { TableModel } from './table';

export type Change =
  | { kind: 'cardIn'; id: string }
  | { kind: 'play'; index: number; from: number; to: number; card: CardKind }
  | { kind: 'night'; on: boolean }
  | { kind: 'death'; seat: number }
  | { kind: 'reveal'; seat: number; index: number; witch: boolean }
  | { kind: 'turn'; seat: number }
  | { kind: 'panel' }
  | { kind: 'draw'; seat: number; count: number }
  | { kind: 'trial'; seat: number };

export const ANIM_MS = {
  cardIn: 450, cardStagger: 80, othersDraw: 400, play: 600, hit: 250, trial: 600,
  death: 500, reveal: 500, burst: 350, night: 900, turn: 1800, panel: 250, scene: 250,
  resultTitle: 400, resultRowStart: 250, resultRowStagger: 80, resultRow: 300,
} as const;

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
  const fresh = next.view.log.slice(prev.view.log.length);
  fresh.forEach((e, k) => {
    if (e.t === 'play') out.push({ kind: 'play', index: prev.view.log.length + k, from: e.seat, to: e.targets[e.targets.length - 1], card: e.kind });
    if (e.t === 'trial') out.push({ kind: 'trial', seat: e.target });
  });
  const wasNight = prev.view.phase.kind === 'night';
  const isNight = next.view.phase.kind === 'night';
  if (wasNight !== isNight) out.push({ kind: 'night', on: isNight });
  next.view.players.forEach((p, i) => {
    const q = prev.view.players[i];
    if (!q) return;
    if (q.alive && !p.alive) {
      // 翻开这张牌当场出局（翻出女巫、翻开最后一张）：只播被翻的那张；死亡连带翻开的其余身份卡（cause 'death'）不播
      const used = new Set<number>();
      for (const e of fresh) {
        if (e.t !== 'reveal' || e.seat !== i || e.cause === 'death') continue;
        const j = p.tryals.findIndex((t, k) => !used.has(k) && t.revealed && q.tryals[k] && !q.tryals[k].revealed && t.kind === e.kind);
        if (j < 0) continue;
        used.add(j);
        out.push({ kind: 'reveal', seat: i, index: j, witch: e.kind === 'witch' });
      }
      out.push({ kind: 'death', seat: i });
    }
    if (i !== next.mySeat && p.handCount > q.handCount) out.push({ kind: 'draw', seat: i, count: p.handCount - q.handCount });
    if (!p.alive) return;
    p.tryals.forEach((t, j) => {
      if (t.revealed && q.tryals[j] && !q.tryals[j].revealed) out.push({ kind: 'reveal', seat: i, index: j, witch: t.kind === 'witch' });
    });
  });
  const turn = dayTurn(next);
  if (turn !== null && turn !== dayTurn(prev)) out.push({ kind: 'turn', seat: turn });
  if (next.pending && next.pending.kind !== 'turn' && prev.pending?.kind !== next.pending.kind) out.push({ kind: 'panel' });
  return out;
}
