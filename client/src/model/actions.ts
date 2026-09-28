import {
  isBlack,
  isRed,
  targetCount,
  type Card,
  type CardKind,
  type PendingChoice,
  type Tryal,
} from '../../../engine/src/index';
import type { TableModel } from './table';

export { targetCount };

/** 发给云函数 act 的操作（不含 seat，座位由服务器根据 openid 确定） */
export type ClientAction =
  | { type: 'draw' }
  | { type: 'play'; cardId: string; targets: number[]; option?: string }
  | { type: 'endTurn' }
  | { type: 'revealTryal'; tryalId: string }
  | { type: 'witchVote'; target: number }
  | { type: 'protect'; target: number }
  | { type: 'confess'; tryalId: string | null }
  | { type: 'conspiracyPick'; index: number };

export type NightPending = Extract<PendingChoice, { kind: 'night' }>;
export type NightStep = 'kill' | 'protect' | 'suspect';
export type OptionNeed = { kind: 'curse'; cards: Card[] } | { kind: 'alibi' } | null;

export const ALIBI_CHOICES = [
  { value: 'accusation', label: '丢弃最多 3 张指控' },
  { value: 'evidence', label: '丢弃 1 张证据' },
] as const;

export function playableCardIds(m: TableModel): string[] {
  if (m.pending?.kind !== 'turn' || !m.priv) return [];
  return m.priv.hand.filter((c) => !isBlack(c.kind)).map((c) => c.id);
}

export function cardKindOf(m: TableModel, id: string): CardKind | null {
  return m.priv?.hand.find((c) => c.id === id)?.kind ?? null;
}

/** 可选的下一个目标（chosen 是已经选好的目标）。与引擎的限制一致，最终以服务器判定为准。 */
export function targetOptions(m: TableModel, kind: CardKind, chosen: number[]): number[] {
  const out: number[] = [];
  for (const p of m.view.players) {
    if (!p.alive || chosen.includes(p.seat)) continue;
    if (chosen.length === 0) {
      if (isRed(kind) && (p.seat === m.mySeat || p.blue.some((c) => c.kind === 'piety'))) continue;
      if (kind === 'matchmaker' && p.blue.some((c) => c.kind === 'matchmaker')) continue;
      if (kind === 'stocks' && p.green.some((c) => c.kind === 'stocks')) continue;
      if (kind === 'curse' && p.blue.length === 0) continue;
    }
    out.push(p.seat);
  }
  return out;
}

/** 选好目标后是否还要选附加选项：诅咒要选哪张蓝卡；辩护在指控和证据都有时要选丢哪种 */
export function optionNeed(m: TableModel, kind: CardKind, target: number): OptionNeed {
  const p = m.view.players[target];
  if (!p) return null;
  if (kind === 'curse') return { kind: 'curse', cards: p.blue };
  if (kind === 'alibi') {
    const acc = p.red.some((c) => c.kind === 'accusation');
    const evi = p.red.some((c) => c.kind === 'evidence');
    return acc && evi ? { kind: 'alibi' } : null;
  }
  return null;
}

export function nightSteps(p: NightPending): NightStep[] {
  const steps: NightStep[] = [];
  if (p.witch) steps.push('kill');
  if (p.constable) steps.push('protect');
  if (steps.length === 0) steps.push('suspect');
  return steps;
}

export function nightTargets(m: TableModel, step: NightStep): number[] {
  return m.view.players.filter((p) => p.alive && (step === 'kill' || p.seat !== m.mySeat)).map((p) => p.seat);
}

export function dawnTargets(m: TableModel): number[] {
  return m.view.players.filter((p) => p.alive).map((p) => p.seat);
}

export function unrevealedTryals(m: TableModel): Tryal[] {
  return m.priv ? m.priv.tryals.filter((t) => !t.revealed) : [];
}
