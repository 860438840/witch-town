import { hasAbility } from './characters';
import { RuleError } from './errors';
import { getPlayer, toCard, unrevealed, witchSeats } from './state';
import type { DeathCause, GameState, RevealCause, Winner } from './types';

export function revealTryal(s: GameState, seat: number, tryalId: string, cause: RevealCause): void {
  const p = getPlayer(s, seat);
  const t = p.tryals.find((x) => x.id === tryalId);
  if (!t || t.revealed) throw new RuleError('这张身份卡不能翻开');
  t.revealed = true;
  s.log.push({ t: 'reveal', seat, kind: t.kind, cause });
  if (t.kind === 'witch') killPlayer(s, seat, 'witchRevealed');
  else if (unrevealed(p).length === 0) killPlayer(s, seat, 'allRevealed');
  checkWin(s);
}

export function killPlayer(s: GameState, seat: number, cause: DeathCause): void {
  const p = getPlayer(s, seat);
  if (!p.alive) return;
  p.alive = false;
  for (const t of p.tryals) {
    if (!t.revealed) {
      t.revealed = true;
      s.log.push({ t: 'reveal', seat, kind: t.kind, cause: 'death' });
    }
  }
  s.log.push({ t: 'death', seat, cause });
  // 情侣的另一方会在同一事件里殉情
  const partner = p.blue.some((c) => c.kind === 'matchmaker')
    ? s.players.find((q) => q.alive && q.blue.some((c) => c.kind === 'matchmaker'))
    : undefined;
  const heir = farmerHeir(s, seat, partner?.seat ?? null);
  if (heir !== null) {
    getPlayer(s, heir).hand.push(...p.hand, ...p.blue);
    s.discard.push(...p.red.map(toCard), ...p.green);
    s.log.push({ t: 'ability', seat: heir, ability: 'farmer', from: seat });
  } else {
    s.discard.push(...p.hand, ...p.red.map(toCard), ...p.blue, ...p.green);
  }
  p.hand = [];
  p.red = [];
  p.blue = [];
  p.green = [];
  if (partner) killPlayer(s, partner.seat, 'lover');
  checkWin(s);
}

/** 继承死者手牌和蓝卡的人：从死者的下一个座位起顺时针第一个拥有农民技能的活人；同一事件里也要死去的情侣不算 */
function farmerHeir(s: GameState, dead: number, alsoDying: number | null): number | null {
  const n = s.players.length;
  for (let i = 1; i < n; i++) {
    const q = s.players[(dead + i) % n];
    if (q.alive && q.seat !== alsoDying && hasAbility(s, q.seat, 'farmer')) return q.seat;
  }
  return null;
}

export function checkWin(s: GameState): void {
  if (s.phase.kind === 'ended') return;
  let winner: Winner | null = null;
  // 女巫阵营的人全部出局才算村民胜利：传染时交出女巫卡的原女巫仍属女巫阵营
  if (witchSeats(s).length === 0) winner = 'village';
  else if (s.players.filter((p) => p.alive).every((p) => p.witchFaction)) winner = 'witch';
  if (winner) {
    s.phase = { kind: 'ended', winner };
    s.log.push({ t: 'gameEnd', winner });
  }
}
