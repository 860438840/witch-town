export type TryalKind = 'witch' | 'constable' | 'villager';
export interface Tryal {
  id: string;
  kind: TryalKind;
  revealed: boolean;
}

export type RedKind = 'accusation' | 'evidence' | 'witness';
export type BlueKind = 'blackCat' | 'matchmaker' | 'asylum' | 'piety';
export type GreenKind = 'scapegoat' | 'robbery' | 'arson' | 'curse' | 'stocks' | 'alibi';
export type BlackKind = 'night' | 'conspiracy';
export type CardKind = RedKind | BlueKind | GreenKind | BlackKind;

export interface Card {
  id: string;
  kind: CardKind;
}
/** 放在玩家面前的红卡，points 在打出时确定 */
export interface RedCard {
  id: string;
  kind: RedKind;
  points: number;
  /** 这张牌原来是什么卡（医生当作目击打出的辩护为 'alibi'）；没有这个字段时就是 kind 本身 */
  source?: CardKind;
}

export type CharacterId =
  | 'doctor'
  | 'beggar'
  | 'landlord'
  | 'judge'
  | 'priest'
  | 'storyteller'
  | 'tailor'
  | 'housewife'
  | 'farmer'
  | 'child'
  | 'minister'
  | 'official'
  | 'strongman'
  | 'maid'
  | 'maiden';

/** 整局限次的技能 */
export type LimitedAbility = 'priest' | 'storyteller' | 'official';

export interface Player {
  seat: number;
  openid: string;
  name: string;
  character: CharacterId | null;
  /** 限次技能已经用了几次（记在使用者本人身上，所以裁缝复制时单独计次） */
  uses: Partial<Record<LimitedAbility, number>>;
  alive: boolean;
  witchFaction: boolean;
  hand: Card[];
  tryals: Tryal[];
  red: RedCard[];
  blue: Card[];
  /** 面前的绿卡，目前只有「拘留」会留在面前 */
  green: Card[];
}

export type Winner = 'village' | 'witch';

export type Phase =
  | { kind: 'characterPick' }
  | { kind: 'dawn' }
  | { kind: 'day'; mode: 'choose' | 'playing' | 'drawing' }
  | { kind: 'trialReveal'; target: number; initiator: number }
  | { kind: 'catReveal'; holder: number }
  | { kind: 'conspiracyPick' }
  | { kind: 'night' }
  | { kind: 'ended'; winner: Winner };

export interface NightState {
  witchVotes: Record<number, number>;
  protect: number | null;
  /** 值为要翻开的身份卡 id；null 表示不自首；没有 key 表示还没提交 */
  confessions: Record<number, string | null>;
}

export type RevealCause = 'trial' | 'cat' | 'confess' | 'death';
export type DeathCause = 'night' | 'witchRevealed' | 'allRevealed' | 'lover';

export type GameEvent =
  | { t: 'gameStart'; players: number }
  | { t: 'catPlaced'; target: number }
  | { t: 'turn'; seat: number }
  | { t: 'skipped'; seat: number }
  | { t: 'draw'; seat: number }
  | { t: 'blackDrawn'; seat: number; kind: BlackKind }
  | { t: 'play'; seat: number; kind: CardKind; targets: number[] }
  | { t: 'trial'; target: number; initiator: number }
  | { t: 'reveal'; seat: number; kind: TryalKind; cause: RevealCause }
  | { t: 'death'; seat: number; cause: DeathCause }
  | { t: 'conspiracyDone' }
  | { t: 'nightResult'; target: number; died: boolean }
  | { t: 'reshuffle' }
  | { t: 'character'; seat: number; character: CharacterId }
  /** 技能生效。kind：被挡下的卡（乞丐、女仆）；from：死者（农民）；count：拿了几张（牧师） */
  | { t: 'ability'; seat: number; ability: CharacterId; kind?: CardKind; from?: number; count?: number }
  | { t: 'gameEnd'; winner: Winner };

export interface GameState {
  players: Player[];
  deck: Card[];
  discard: Card[];
  /** 暂时不在牌堆里的卡：开局时的黑猫 */
  setAside: Card[];
  turn: number;
  drawsLeft: number;
  phase: Phase;
  dawnVotes: Record<number, number>;
  night: NightState | null;
  conspiracyPicks: Record<number, number>;
  /** 选角色阶段每人的 2 个候选；选完后清空 */
  characterOffers: Record<number, CharacterId[]>;
  log: GameEvent[];
  version: number;
}

export type Action =
  | { type: 'draw'; seat: number }
  | { type: 'play'; seat: number; cardId: string; targets: number[]; option?: string }
  | { type: 'endTurn'; seat: number }
  | { type: 'revealTryal'; seat: number; tryalId: string }
  | { type: 'witchVote'; seat: number; target: number }
  | { type: 'protect'; seat: number; target: number }
  | { type: 'confess'; seat: number; tryalId: string | null }
  | { type: 'conspiracyPick'; seat: number; index: number }
  | { type: 'pickCharacter'; seat: number; index: number };
