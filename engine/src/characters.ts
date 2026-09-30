import { RuleError } from './errors';
import { shuffle, type Rng } from './rng';
import { getPlayer, rightOf, setPhase } from './state';
import type { CharacterId, GameState, LimitedAbility } from './types';

export const CHARACTERS: CharacterId[] = [
  'doctor',
  'beggar',
  'landlord',
  'judge',
  'priest',
  'storyteller',
  'tailor',
  'housewife',
  'farmer',
  'child',
  'minister',
  'official',
  'strongman',
  'maid',
  'maiden',
];

export const USE_LIMITS: Record<LimitedAbility, number> = { priest: 2, storyteller: 1, official: 1 };

/** 少于这个人数时每人从 2 个候选里选角色；达到时直接随机发 */
export const PICK_BELOW = 7;

/** 某座位此刻生效的技能：本人的角色；裁缝则是右手边第一个活着的玩家的角色 */
export function abilityOf(s: GameState, seat: number): CharacterId | null {
  const p = s.players[seat];
  if (!p) return null;
  if (p.character !== 'tailor') return p.character;
  const r = rightOf(s, seat);
  if (r === null) return null;
  const c = s.players[r].character;
  return c === 'tailor' ? null : c;
}

export function hasAbility(s: GameState, seat: number, id: CharacterId): boolean {
  return abilityOf(s, seat) === id;
}

export function isLimited(c: CharacterId | null): c is LimitedAbility {
  return c === 'priest' || c === 'storyteller' || c === 'official';
}

export function usesLeft(s: GameState, seat: number, a: LimitedAbility): number {
  return USE_LIMITS[a] - (getPlayer(s, seat).uses[a] ?? 0);
}

export function useAbility(s: GameState, seat: number, a: LimitedAbility): void {
  const p = getPlayer(s, seat);
  p.uses[a] = (p.uses[a] ?? 0) + 1;
}

/** 拥有这个限次技能，并且还有次数 */
export function canUse(s: GameState, seat: number, a: LimitedAbility): boolean {
  return hasAbility(s, seat, a) && usesLeft(s, seat, a) > 0;
}

/** 此刻生效的技能如果限次，还剩几次；不限次时为 null */
export function limitedLeft(s: GameState, seat: number): number | null {
  const a = abilityOf(s, seat);
  return isLimited(a) ? usesLeft(s, seat, a) : null;
}

/** 开局发角色：7 人及以上直接随机发；少于 7 人给每人 2 个候选，进入选角色阶段 */
export function dealCharacters(s: GameState, rng: Rng): void {
  const ids = shuffle(CHARACTERS, rng);
  if (s.players.length >= PICK_BELOW) {
    s.players.forEach((p, i) => {
      p.character = ids[i];
      s.log.push({ t: 'character', seat: p.seat, character: ids[i] });
    });
    return;
  }
  s.players.forEach((p, i) => {
    s.characterOffers[p.seat] = [ids[2 * i], ids[2 * i + 1]];
  });
  s.phase = { kind: 'characterPick' };
}

export function pickCharacter(s: GameState, seat: number, index: number): void {
  if (s.phase.kind !== 'characterPick') throw new RuleError('现在不能选角色');
  const p = getPlayer(s, seat);
  const offers = s.characterOffers[seat];
  if (!offers || p.character !== null) throw new RuleError('你已经选过角色了');
  if (index !== 0 && index !== 1) throw new RuleError('选择无效');
  p.character = offers[index];
  s.log.push({ t: 'character', seat, character: offers[index] });
  if (s.players.every((q) => q.character !== null)) {
    s.characterOffers = {};
    setPhase(s, { kind: 'dawn' });
  }
}
