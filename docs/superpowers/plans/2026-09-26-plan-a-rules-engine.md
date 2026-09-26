# 计划 A：女巫镇规则引擎核心 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用纯 TypeScript 实现《女巫镇》全部基础规则（不含角色技能），并用单元测试和随机对局模拟验证。

**Architecture:** `engine/` 是一个独立的 npm 包，不依赖任何微信 API。对外核心接口是 `apply(state, action, rng) → newState`：输入当前局面和一个玩家操作，返回新局面（不修改原对象），非法操作抛出 `RuleError`。`projectPublic` / `projectPrivate` 负责生成「所有人可见」和「仅本人可见」的视图，`autoActions` 生成超时默认操作。各规则按职责拆成小文件（发牌、死亡、回合、出牌、审判、夜晚、传染、视图）。

**Tech Stack:** Node 24、TypeScript（strict）、Vitest。

**Spec:** `docs/superpowers/specs/2026-09-26-witch-town-design.md`（本计划覆盖其中「开发顺序」第 1、2 步；计划 B 覆盖云函数与小程序；计划 C 覆盖 15 个角色技能）

## Global Constraints

- 玩家人数 4–12；每人 5 张身份卡；4–5 人 1 女巫，6 人以上 2 女巫，警长 1 张，其余村民。
- 游戏卡共 60 张：指控 35、证据 6、目击 1、黑猫 1、情侣 2、避难 1、信徒 1、嫁祸 2、抢劫 1、纵火 1、诅咒 1、拘留 3、辩护 3、夜晚 1、传染 1。
- 红卡点数：指控 1、证据 3、目击 7；默认审判线 7（累计 ≥ 审判线即审判）。
- 开局去掉黑猫、夜晚、传染，每人发 3 张，再把夜晚和传染一起随机洗进剩余牌堆；黑猫由女巫在第一夜放置。
- 座位列表按顺时针排列：左边邻居 = 下一个座位（`seat + 1`），右边邻居 = 上一个座位。
- 抽牌抽到黑卡：立即结算；传染结算后继续抽，补满 2 张非黑卡；抽到夜晚则回合结束，夜晚后由下一位玩家开始。
- 夜晚结算后把「弃牌堆 + 剩余牌堆（含夜晚卡）」一起重洗。
- 女巫阵营是永久的；持有未翻开警长卡的活人就是警长；警长卡翻开后不再有警长。
- 所有面向玩家的错误信息使用简体中文。
- `apply` 不得修改传入的 state；state 必须可以 JSON 序列化（将来存入云数据库）。
- 本计划中的 `character` 字段一律为 `null`；角色技能在计划 C 中通过 `trialThreshold`、`accusationValue` 等函数扩展，本计划只提供默认实现。

## Review Focus

1. **当前玩家在自己的回合中死亡**（例如他的情侣在审判中死亡）→ 回合应交给下一位活着的玩家，而不是卡住。测试位于 Task 4。
2. **第二张抽到「夜晚」** → 第一张普通牌应保留在手中，然后进入夜晚。测试位于 Task 6。
3. **牌堆抽空** → 应把弃牌堆洗成新牌堆继续抽。测试位于 Task 6。
4. **黑猫持有者在传染时翻出女巫而死亡，而且他正是当前玩家** → 传染应继续完成，然后回合交给下一位。测试位于 Task 6。
5. **两名女巫在超时时仍然意见不一** → 超时操作应让所有女巫统一投给得票最多的目标，夜晚必须能结算。测试位于 Task 8。

---

## 文件结构

```
女巫镇/
├─ .gitignore
└─ engine/
   ├─ package.json
   ├─ tsconfig.json
   ├─ src/
   │  ├─ types.ts        所有类型：卡、身份卡、玩家、阶段、事件、操作、局面
   │  ├─ errors.ts       RuleError
   │  ├─ rng.ts          可注入随机数、洗牌、随机选取
   │  ├─ cards.ts        卡牌组成、点数、身份卡组成
   │  ├─ state.ts        读取局面的小工具（邻居、警长、黑猫持有者、红卡总点数、setPhase…）
   │  ├─ setup.ts        createGame：开局发牌
   │  ├─ death.ts        翻开身份卡、死亡、情侣连带、胜负判定
   │  ├─ turn.ts         回合开始/结束、拘留、抽牌
   │  ├─ trial.ts        审判判定与结算
   │  ├─ play.ts         打出红/蓝/绿卡
   │  ├─ night.ts        第一夜黑猫、夜晚、警长、自首
   │  ├─ conspiracy.ts   传染
   │  ├─ apply.ts        操作分发入口
   │  ├─ view.ts         公开视图 / 私密视图
   │  ├─ auto.ts         超时默认操作
   │  └─ index.ts        对外导出
   └─ test/
      ├─ helpers.ts
      ├─ cards.test.ts
      ├─ setup.test.ts
      ├─ death.test.ts
      ├─ play.test.ts
      ├─ night.test.ts
      ├─ draw.test.ts
      ├─ view.test.ts
      ├─ auto.test.ts
      └─ simulate.test.ts
```

所有命令都在 `engine/` 目录下执行。

---

### Task 1: 项目脚手架、类型、随机数和卡牌组成

**Files:**
- Create: `.gitignore`
- Create: `engine/package.json`, `engine/tsconfig.json`
- Create: `engine/src/types.ts`, `engine/src/errors.ts`, `engine/src/rng.ts`, `engine/src/cards.ts`
- Test: `engine/test/cards.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `types.ts` 中的全部类型（见下方代码，后续所有任务都使用这些名字）
  - `class RuleError extends Error`
  - `interface Rng { next(): number }`、`seededRng(seed: number): Rng`、`mathRng: Rng`、`shuffle<T>(arr: T[], rng: Rng): T[]`、`pick<T>(arr: T[], rng: Rng): T`
  - `DECK_COMPOSITION`、`TOTAL_GAME_CARDS = 60`、`TRYALS_PER_PLAYER = 5`、`RED_POINTS`、`isRed/isBlue/isGreen/isBlack(kind)`、`buildBaseDeck(): Card[]`、`tryalComposition(n: number): TryalKind[]`

- [ ] **Step 1: 创建 `.gitignore`、`package.json`、`tsconfig.json` 并安装依赖**

`.gitignore`（仓库根目录）：

```gitignore
node_modules/
dist/
```

`engine/package.json`：

```json
{
  "name": "witch-town-engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

`engine/tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": ["src", "test"]
}
```

Run: `cd engine && npm install -D typescript vitest`
Expected: 安装成功，生成 `package-lock.json`。

- [ ] **Step 2: 写类型和基础模块**

`engine/src/types.ts`：

```ts
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
}

export interface Player {
  seat: number;
  openid: string;
  name: string;
  character: string | null;
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
  | { type: 'conspiracyPick'; seat: number; index: number };
```

`engine/src/errors.ts`：

```ts
/** 玩家操作不符合规则时抛出，message 直接展示给玩家 */
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleError';
  }
}
```

`engine/src/rng.ts`：

```ts
export interface Rng {
  /** 返回 [0, 1) 的随机数 */
  next(): number;
}

/** mulberry32：相同种子产生相同序列，用于测试 */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export const mathRng: Rng = { next: () => Math.random() };

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.floor(rng.next() * arr.length)];
}
```

- [ ] **Step 3: 写失败的测试**

`engine/test/cards.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { buildBaseDeck, isBlack, isBlue, isGreen, isRed, tryalComposition } from '../src/cards';
import { RuleError } from '../src/errors';
import { seededRng, shuffle } from '../src/rng';

describe('buildBaseDeck', () => {
  it('有 57 张（60 张去掉黑猫、夜晚、传染）', () => {
    expect(buildBaseDeck()).toHaveLength(57);
  });

  it('每张卡 id 唯一', () => {
    const ids = buildBaseDeck().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('红卡数量正确', () => {
    const deck = buildBaseDeck();
    const count = (kind: string) => deck.filter((c) => c.kind === kind).length;
    expect(count('accusation')).toBe(35);
    expect(count('evidence')).toBe(6);
    expect(count('witness')).toBe(1);
    expect(count('blackCat') + count('night') + count('conspiracy')).toBe(0);
  });

  it('颜色判断', () => {
    expect(isRed('witness')).toBe(true);
    expect(isBlue('asylum')).toBe(true);
    expect(isGreen('stocks')).toBe(true);
    expect(isBlack('night')).toBe(true);
    expect(isRed('alibi')).toBe(false);
  });
});

describe('tryalComposition', () => {
  const count = (kinds: string[], k: string) => kinds.filter((x) => x === k).length;

  it('4 人：20 张，1 女巫 1 警长', () => {
    const t = tryalComposition(4);
    expect(t).toHaveLength(20);
    expect(count(t, 'witch')).toBe(1);
    expect(count(t, 'constable')).toBe(1);
  });

  it('6 人：2 女巫', () => {
    expect(count(tryalComposition(6), 'witch')).toBe(2);
  });

  it('12 人：60 张', () => {
    expect(tryalComposition(12)).toHaveLength(60);
  });

  it('人数不在 4–12 时报错', () => {
    expect(() => tryalComposition(3)).toThrow(RuleError);
    expect(() => tryalComposition(13)).toThrow(RuleError);
  });
});

describe('rng', () => {
  it('相同种子产生相同序列', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
  });

  it('shuffle 不丢失元素且不修改原数组', () => {
    const arr = [1, 2, 3, 4, 5];
    const out = shuffle(arr, seededRng(1));
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
  });
});
```

- [ ] **Step 4: 运行测试，确认失败**

Run: `npx vitest run test/cards.test.ts`
Expected: FAIL，提示找不到 `../src/cards`。

- [ ] **Step 5: 实现 `cards.ts`**

`engine/src/cards.ts`：

```ts
import { RuleError } from './errors';
import type { BlackKind, BlueKind, Card, CardKind, GreenKind, RedKind, TryalKind } from './types';

/** 进入牌堆的卡（不含黑猫、夜晚、传染） */
export const DECK_COMPOSITION = {
  accusation: 35,
  evidence: 6,
  witness: 1,
  matchmaker: 2,
  asylum: 1,
  piety: 1,
  scapegoat: 2,
  robbery: 1,
  arson: 1,
  curse: 1,
  stocks: 3,
  alibi: 3,
} as const satisfies Partial<Record<CardKind, number>>;

export const TOTAL_GAME_CARDS = 60;
export const TRYALS_PER_PLAYER = 5;

export const RED_POINTS: Record<RedKind, number> = { accusation: 1, evidence: 3, witness: 7 };

export const isRed = (k: CardKind): k is RedKind =>
  k === 'accusation' || k === 'evidence' || k === 'witness';
export const isBlue = (k: CardKind): k is BlueKind =>
  k === 'blackCat' || k === 'matchmaker' || k === 'asylum' || k === 'piety';
export const isBlack = (k: CardKind): k is BlackKind => k === 'night' || k === 'conspiracy';
export const isGreen = (k: CardKind): k is GreenKind => !isRed(k) && !isBlue(k) && !isBlack(k);

export function buildBaseDeck(): Card[] {
  const deck: Card[] = [];
  for (const [kind, count] of Object.entries(DECK_COMPOSITION) as [CardKind, number][]) {
    for (let i = 1; i <= count; i++) deck.push({ id: `${kind}-${i}`, kind });
  }
  return deck;
}

export function tryalComposition(n: number): TryalKind[] {
  if (!Number.isInteger(n) || n < 4 || n > 12) throw new RuleError('玩家人数必须在 4–12 之间');
  const witches = n <= 5 ? 1 : 2;
  const total = n * TRYALS_PER_PLAYER;
  return [
    ...Array<TryalKind>(witches).fill('witch'),
    'constable',
    ...Array<TryalKind>(total - witches - 1).fill('villager'),
  ];
}
```

- [ ] **Step 6: 运行测试和类型检查，确认通过**

Run: `npx vitest run test/cards.test.ts && npm run typecheck`
Expected: 全部 PASS，类型检查无错误。

- [ ] **Step 7: Commit**

```bash
git add .gitignore engine/package.json engine/package-lock.json engine/tsconfig.json engine/src engine/test
git commit -m "feat(engine): scaffold engine with types, rng and card composition

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 局面工具和开局发牌

**Files:**
- Create: `engine/src/state.ts`, `engine/src/setup.ts`
- Create: `engine/test/helpers.ts`
- Test: `engine/test/setup.test.ts`

**Interfaces:**
- Consumes: Task 1 的类型、`RuleError`、`Rng`、`shuffle`、`buildBaseDeck`、`tryalComposition`、`TRYALS_PER_PLAYER`
- Produces:
  - `state.ts`：`getPlayer(s, seat): Player`、`aliveSeats(s): number[]`、`leftOf(s, seat): number | null`、`rightOf(s, seat): number | null`、`unrevealed(p): Tryal[]`、`constableSeat(s): number | null`、`catHolder(s): number | null`、`witchSeats(s): number[]`、`redTotal(p): number`、`setPhase(s, phase): void`、`toCard(c): Card`、`countCards(s): number`
  - `setup.ts`：`interface NewPlayer { openid: string; name: string }`、`createGame(players: NewPlayer[], rng: Rng): GameState`
  - `test/helpers.ts`：`V`、`newGame(n?, seed?)`、`setTryals(s, seat, kinds)`、`forceDay(s, seat)`、`fixedGame()`、`giveCard(s, seat, kind)`、`placeBlue(s, seat, kind)`、`stackDeck(s, kinds)`

- [ ] **Step 1: 写测试工具 `test/helpers.ts`**

```ts
import { seededRng } from '../src/rng';
import { createGame } from '../src/setup';
import type { Card, CardKind, GameState, TryalKind } from '../src/types';

export const V: TryalKind = 'villager';

export function newGame(n = 5, seed = 1): GameState {
  return createGame(
    Array.from({ length: n }, (_, i) => ({ openid: `u${i}`, name: `P${i}` })),
    seededRng(seed),
  );
}

/** 覆盖某个玩家的身份卡（测试专用，会打破身份卡总数的约束） */
export function setTryals(s: GameState, seat: number, kinds: TryalKind[]): void {
  s.players[seat].tryals = kinds.map((kind, i) => ({ id: `fix-${seat}-${i}`, kind, revealed: false }));
  s.players[seat].witchFaction = kinds.includes('witch');
}

export function forceDay(s: GameState, seat: number): void {
  s.phase = { kind: 'day', mode: 'choose' };
  s.turn = seat;
  s.drawsLeft = 0;
}

/** 5 人局：0 号是唯一女巫（第 1 张），1 号是警长（第 1 张），2–4 号全是村民；轮到 2 号 */
export function fixedGame(): GameState {
  const s = newGame(5);
  setTryals(s, 0, ['witch', V, V, V, V]);
  setTryals(s, 1, ['constable', V, V, V, V]);
  for (const seat of [2, 3, 4]) setTryals(s, seat, [V, V, V, V, V]);
  forceDay(s, 2);
  return s;
}

/** 从牌堆/弃牌堆/暂放区/手牌中拿出一张指定种类的卡（保持总卡数不变） */
function takeFromAnywhere(s: GameState, kind: CardKind): Card {
  const pools = [s.deck, s.discard, s.setAside, ...s.players.map((p) => p.hand)];
  for (const pool of pools) {
    const i = pool.findIndex((c) => c.kind === kind);
    if (i >= 0) return pool.splice(i, 1)[0];
  }
  throw new Error(`找不到 ${kind}`);
}

export function giveCard(s: GameState, seat: number, kind: CardKind): Card {
  const c = takeFromAnywhere(s, kind);
  s.players[seat].hand.push(c);
  return c;
}

export function placeBlue(s: GameState, seat: number, kind: CardKind): Card {
  const c = takeFromAnywhere(s, kind);
  s.players[seat].blue.push(c);
  return c;
}

/** 把指定的卡按顺序放到牌堆顶 */
export function stackDeck(s: GameState, kinds: CardKind[]): void {
  const top = kinds.map((k) => takeFromAnywhere(s, k));
  s.deck.unshift(...top);
}
```

- [ ] **Step 2: 写失败的测试**

`engine/test/setup.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { RuleError } from '../src/errors';
import { seededRng } from '../src/rng';
import { createGame } from '../src/setup';
import { catHolder, constableSeat, countCards, leftOf, rightOf } from '../src/state';
import { newGame } from './helpers';

describe('createGame', () => {
  it('5 人局：每人 5 张身份卡、3 张手牌，黑猫暂放，阶段为黎明', () => {
    const s = newGame(5);
    expect(s.players).toHaveLength(5);
    for (const p of s.players) {
      expect(p.tryals).toHaveLength(5);
      expect(p.hand).toHaveLength(3);
      expect(p.alive).toBe(true);
      expect(p.character).toBeNull();
    }
    expect(s.deck).toHaveLength(57 - 15 + 2);
    expect(s.setAside.map((c) => c.kind)).toEqual(['blackCat']);
    expect(s.phase).toEqual({ kind: 'dawn' });
    expect(countCards(s)).toBe(60);
    expect(catHolder(s)).toBeNull();
  });

  it('手牌中没有黑卡，夜晚和传染都在牌堆里', () => {
    const s = newGame(8, 3);
    const hands = s.players.flatMap((p) => p.hand);
    expect(hands.some((c) => c.kind === 'night' || c.kind === 'conspiracy' || c.kind === 'blackCat')).toBe(false);
    expect(s.deck.filter((c) => c.kind === 'night' || c.kind === 'conspiracy')).toHaveLength(2);
  });

  it('女巫阵营等于开局持有女巫卡的玩家', () => {
    const s = newGame(6, 9);
    for (const p of s.players) {
      expect(p.witchFaction).toBe(p.tryals.some((t) => t.kind === 'witch'));
    }
    expect(s.players.flatMap((p) => p.tryals).filter((t) => t.kind === 'witch')).toHaveLength(2);
    expect(constableSeat(s)).not.toBeNull();
  });

  it('身份卡 id 唯一', () => {
    const ids = newGame(12).players.flatMap((p) => p.tryals.map((t) => t.id));
    expect(new Set(ids).size).toBe(60);
  });

  it('人数不足 4 人时报错', () => {
    const three = [0, 1, 2].map((i) => ({ openid: `u${i}`, name: `P${i}` }));
    expect(() => createGame(three, seededRng(1))).toThrow(RuleError);
  });
});

describe('邻居', () => {
  it('左边是下一个座位，右边是上一个座位，跳过死亡玩家', () => {
    const s = newGame(5);
    s.players[1].alive = false;
    expect(leftOf(s, 0)).toBe(2);
    expect(rightOf(s, 2)).toBe(0);
    expect(rightOf(s, 0)).toBe(4);
    expect(leftOf(s, 4)).toBe(0);
  });
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npx vitest run test/setup.test.ts`
Expected: FAIL，提示找不到 `../src/setup` 和 `../src/state`。

- [ ] **Step 4: 实现 `state.ts` 和 `setup.ts`**

`engine/src/state.ts`：

```ts
import { RuleError } from './errors';
import type { Card, CardKind, GameState, Phase, Player, Tryal } from './types';

export function getPlayer(s: GameState, seat: number): Player {
  const p = s.players[seat];
  if (!p) throw new RuleError(`座位 ${seat} 不存在`);
  return p;
}

export function aliveSeats(s: GameState): number[] {
  return s.players.filter((p) => p.alive).map((p) => p.seat);
}

/** 左边邻居：顺时针方向下一个活着的玩家 */
export function leftOf(s: GameState, seat: number): number | null {
  const n = s.players.length;
  for (let i = 1; i < n; i++) {
    const q = (seat + i) % n;
    if (s.players[q].alive) return q;
  }
  return null;
}

/** 右边邻居：逆时针方向上一个活着的玩家 */
export function rightOf(s: GameState, seat: number): number | null {
  const n = s.players.length;
  for (let i = 1; i < n; i++) {
    const q = (seat - i + n) % n;
    if (s.players[q].alive) return q;
  }
  return null;
}

export function unrevealed(p: Player): Tryal[] {
  return p.tryals.filter((t) => !t.revealed);
}

export function constableSeat(s: GameState): number | null {
  const p = s.players.find((q) => q.alive && q.tryals.some((t) => t.kind === 'constable' && !t.revealed));
  return p ? p.seat : null;
}

export function catHolder(s: GameState): number | null {
  const p = s.players.find((q) => q.alive && q.blue.some((c) => c.kind === 'blackCat'));
  return p ? p.seat : null;
}

export function witchSeats(s: GameState): number[] {
  return s.players.filter((p) => p.alive && p.witchFaction).map((p) => p.seat);
}

export function redTotal(p: Player): number {
  return p.red.reduce((sum, c) => sum + c.points, 0);
}

/** 游戏结束后阶段不再改变 */
export function setPhase(s: GameState, phase: Phase): void {
  if (s.phase.kind === 'ended') return;
  s.phase = phase;
}

export function toCard(c: { id: string; kind: CardKind }): Card {
  return { id: c.id, kind: c.kind };
}

export function countCards(s: GameState): number {
  return (
    s.deck.length +
    s.discard.length +
    s.setAside.length +
    s.players.reduce((n, p) => n + p.hand.length + p.red.length + p.blue.length + p.green.length, 0)
  );
}
```

`engine/src/setup.ts`：

```ts
import { buildBaseDeck, TRYALS_PER_PLAYER, tryalComposition } from './cards';
import { shuffle, type Rng } from './rng';
import type { Card, GameState, Player } from './types';

export interface NewPlayer {
  openid: string;
  name: string;
}

export function createGame(newPlayers: NewPlayer[], rng: Rng): GameState {
  const kinds = shuffle(tryalComposition(newPlayers.length), rng);
  const players: Player[] = newPlayers.map((np, seat) => {
    const tryals = kinds
      .slice(seat * TRYALS_PER_PLAYER, (seat + 1) * TRYALS_PER_PLAYER)
      .map((kind, i) => ({ id: `t${seat * TRYALS_PER_PLAYER + i + 1}`, kind, revealed: false }));
    return {
      seat,
      openid: np.openid,
      name: np.name,
      character: null,
      alive: true,
      witchFaction: tryals.some((t) => t.kind === 'witch'),
      hand: [],
      tryals,
      red: [],
      blue: [],
      green: [],
    };
  });

  let deck = shuffle(buildBaseDeck(), rng);
  for (let round = 0; round < 3; round++) {
    for (const p of players) p.hand.push(deck.shift() as Card);
  }
  deck = shuffle<Card>([...deck, { id: 'night-1', kind: 'night' }, { id: 'conspiracy-1', kind: 'conspiracy' }], rng);

  return {
    players,
    deck,
    discard: [],
    setAside: [{ id: 'blackCat-1', kind: 'blackCat' }],
    turn: 0,
    drawsLeft: 0,
    phase: { kind: 'dawn' },
    dawnVotes: {},
    night: null,
    conspiracyPicks: {},
    log: [{ t: 'gameStart', players: players.length }],
    version: 0,
  };
}
```

- [ ] **Step 5: 运行测试和类型检查，确认通过**

Run: `npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 6: Commit**

```bash
git add engine/src/state.ts engine/src/setup.ts engine/test/helpers.ts engine/test/setup.test.ts
git commit -m "feat(engine): add game setup and state helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 翻开身份卡、死亡、情侣和胜负判定

**Files:**
- Create: `engine/src/death.ts`
- Test: `engine/test/death.test.ts`

**Interfaces:**
- Consumes: `getPlayer`、`toCard`、`unrevealed`、`countCards`（Task 2）
- Produces: `revealTryal(s, seat, tryalId, cause: RevealCause): void`、`killPlayer(s, seat, cause: DeathCause): void`、`checkWin(s): void`

- [ ] **Step 1: 写失败的测试**

`engine/test/death.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { killPlayer, revealTryal } from '../src/death';
import { RuleError } from '../src/errors';
import { countCards } from '../src/state';
import { fixedGame, placeBlue } from './helpers';

describe('revealTryal', () => {
  it('翻开村民卡：玩家存活，记录日志', () => {
    const s = fixedGame();
    revealTryal(s, 2, s.players[2].tryals[0].id, 'trial');
    expect(s.players[2].tryals[0].revealed).toBe(true);
    expect(s.players[2].alive).toBe(true);
    expect(s.log.at(-1)).toEqual({ t: 'reveal', seat: 2, kind: 'villager', cause: 'trial' });
  });

  it('翻开女巫卡：玩家死亡，身份全部公开，手牌进弃牌堆，村民获胜', () => {
    const s = fixedGame();
    const discardBefore = s.discard.length;
    revealTryal(s, 0, s.players[0].tryals[0].id, 'trial');
    const p = s.players[0];
    expect(p.alive).toBe(false);
    expect(p.tryals.every((t) => t.revealed)).toBe(true);
    expect(p.hand).toEqual([]);
    expect(s.discard.length).toBe(discardBefore + 3);
    expect(s.log).toContainEqual({ t: 'death', seat: 0, cause: 'witchRevealed' });
    expect(s.phase).toEqual({ kind: 'ended', winner: 'village' });
  });

  it('5 张全部翻开：玩家死亡', () => {
    const s = fixedGame();
    for (const t of [...s.players[2].tryals]) revealTryal(s, 2, t.id, 'trial');
    expect(s.players[2].alive).toBe(false);
    expect(s.log).toContainEqual({ t: 'death', seat: 2, cause: 'allRevealed' });
  });

  it('不能重复翻开同一张', () => {
    const s = fixedGame();
    const id = s.players[2].tryals[0].id;
    revealTryal(s, 2, id, 'trial');
    expect(() => revealTryal(s, 2, id, 'trial')).toThrow(RuleError);
  });
});

describe('killPlayer', () => {
  it('情侣：一方死亡，另一方同时死亡', () => {
    const s = fixedGame();
    placeBlue(s, 2, 'matchmaker');
    placeBlue(s, 3, 'matchmaker');
    killPlayer(s, 2, 'night');
    expect(s.players[3].alive).toBe(false);
    expect(s.log).toContainEqual({ t: 'death', seat: 3, cause: 'lover' });
  });

  it('只放了一张情侣卡时不连带', () => {
    const s = fixedGame();
    placeBlue(s, 2, 'matchmaker');
    killPlayer(s, 2, 'night');
    expect(s.players.filter((p) => !p.alive)).toHaveLength(1);
  });

  it('活着的玩家全是女巫阵营时女巫获胜', () => {
    const s = fixedGame();
    for (const seat of [1, 2, 3, 4]) killPlayer(s, seat, 'night');
    expect(s.phase).toEqual({ kind: 'ended', winner: 'witch' });
  });

  it('死亡后总卡数不变', () => {
    const s = fixedGame();
    placeBlue(s, 3, 'asylum');
    killPlayer(s, 3, 'night');
    expect(countCards(s)).toBe(60);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run test/death.test.ts`
Expected: FAIL，提示找不到 `../src/death`。

- [ ] **Step 3: 实现 `death.ts`**

```ts
import { RuleError } from './errors';
import { getPlayer, toCard, unrevealed } from './state';
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
  const wasLover = p.blue.some((c) => c.kind === 'matchmaker');
  s.discard.push(...p.hand, ...p.red.map(toCard), ...p.blue, ...p.green);
  p.hand = [];
  p.red = [];
  p.blue = [];
  p.green = [];
  if (wasLover) {
    const partner = s.players.find((q) => q.alive && q.blue.some((c) => c.kind === 'matchmaker'));
    if (partner) killPlayer(s, partner.seat, 'lover');
  }
  checkWin(s);
}

export function checkWin(s: GameState): void {
  if (s.phase.kind === 'ended') return;
  const witchCards = s.players.flatMap((p) => p.tryals).filter((t) => t.kind === 'witch');
  let winner: Winner | null = null;
  if (witchCards.every((t) => t.revealed)) winner = 'village';
  else if (s.players.filter((p) => p.alive).every((p) => p.witchFaction)) winner = 'witch';
  if (winner) {
    s.phase = { kind: 'ended', winner };
    s.log.push({ t: 'gameEnd', winner });
  }
}
```

- [ ] **Step 4: 运行测试和类型检查，确认通过**

Run: `npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add engine/src/death.ts engine/test/death.test.ts
git commit -m "feat(engine): add tryal reveal, death, lovers and win check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 回合、出牌、审判和 `apply` 入口

**Files:**
- Create: `engine/src/turn.ts`, `engine/src/trial.ts`, `engine/src/play.ts`, `engine/src/apply.ts`
- Test: `engine/test/play.test.ts`

**Interfaces:**
- Consumes: Task 1–3 的全部导出
- Produces:
  - `turn.ts`：`startTurn(s, fromSeat): void`（跳过死亡和被拘留的玩家）、`endTurn(s): void`
  - `trial.ts`：`DEFAULT_TRIAL_THRESHOLD = 7`、`trialThreshold(s, target, initiator: number | null): number`、`checkTrial(s, target, initiator): void`、`finishTrial(s, target): void`
  - `play.ts`：`accusationValue(s, kind: RedKind, actor, target): number`、`playCard(s, seat, cardId, targets, option?): void`
  - `apply.ts`：`apply(state: GameState, action: Action, rng: Rng): GameState`（本任务支持 `play`、`endTurn`、审判时的 `revealTryal`；其余操作在 Task 5、6 加入）

- [ ] **Step 1: 写失败的测试**

`engine/test/play.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { RuleError } from '../src/errors';
import { seededRng } from '../src/rng';
import { redTotal } from '../src/state';
import type { Action, GameState } from '../src/types';
import { fixedGame, giveCard, placeBlue } from './helpers';

const act = (s: GameState, a: Action) => apply(s, a, seededRng(7));

describe('红卡与审判', () => {
  it('指控：目标 +1 点，进入出牌模式，手牌减少', () => {
    let s = fixedGame();
    const c = giveCard(s, 2, 'accusation');
    s = act(s, { type: 'play', seat: 2, cardId: c.id, targets: [3] });
    expect(redTotal(s.players[3])).toBe(1);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(s.players[2].hand.some((h) => h.id === c.id)).toBe(false);
    expect(s.version).toBe(1);
  });

  it('apply 不修改传入的 state', () => {
    const s = fixedGame();
    const c = giveCard(s, 2, 'accusation');
    const snapshot = JSON.stringify(s);
    act(s, { type: 'play', seat: 2, cardId: c.id, targets: [3] });
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('非法出牌会报错', () => {
    const s = fixedGame();
    const c = giveCard(s, 2, 'accusation');
    expect(() => act(s, { type: 'play', seat: 2, cardId: c.id, targets: [2] })).toThrow(RuleError);
    expect(() => act(s, { type: 'play', seat: 3, cardId: c.id, targets: [4] })).toThrow(RuleError);
    expect(() => act(s, { type: 'play', seat: 2, cardId: 'nope', targets: [3] })).toThrow(RuleError);
    placeBlue(s, 3, 'piety');
    expect(() => act(s, { type: 'play', seat: 2, cardId: c.id, targets: [3] })).toThrow(/信徒/);
    s.players[4].alive = false;
    expect(() => act(s, { type: 'play', seat: 2, cardId: c.id, targets: [4] })).toThrow(RuleError);
  });

  it('累计 7 点触发审判，被审判者翻牌后清空红卡，回到出牌模式', () => {
    let s = fixedGame();
    const e1 = giveCard(s, 2, 'evidence');
    const e2 = giveCard(s, 2, 'evidence');
    const a1 = giveCard(s, 2, 'accusation');
    const a2 = giveCard(s, 2, 'accusation');
    s = act(s, { type: 'play', seat: 2, cardId: e1.id, targets: [3] });
    s = act(s, { type: 'play', seat: 2, cardId: e2.id, targets: [3] });
    expect(s.phase.kind).toBe('day');
    s = act(s, { type: 'play', seat: 2, cardId: a1.id, targets: [3] });
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 3, initiator: 2 });
    expect(s.log).toContainEqual({ t: 'trial', target: 3, initiator: 2 });
    expect(() => act(s, { type: 'play', seat: 2, cardId: a2.id, targets: [4] })).toThrow(RuleError);
    expect(() => act(s, { type: 'revealTryal', seat: 2, tryalId: s.players[2].tryals[0].id })).toThrow(RuleError);
    s = act(s, { type: 'revealTryal', seat: 3, tryalId: s.players[3].tryals[0].id });
    expect(s.players[3].tryals[0].revealed).toBe(true);
    expect(s.players[3].red).toEqual([]);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
    expect(s.turn).toBe(2);
  });

  it('目击一张即审判；翻出女巫则女巫死亡，村民获胜', () => {
    let s = fixedGame();
    const w = giveCard(s, 2, 'witness');
    s = act(s, { type: 'play', seat: 2, cardId: w.id, targets: [0] });
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 0, initiator: 2 });
    s = act(s, { type: 'revealTryal', seat: 0, tryalId: s.players[0].tryals[0].id });
    expect(s.players[0].alive).toBe(false);
    expect(s.phase).toEqual({ kind: 'ended', winner: 'village' });
  });

  it('当前玩家在自己的回合中死亡（情侣连带），回合交给下一位活着的玩家', () => {
    let s = fixedGame();
    placeBlue(s, 2, 'matchmaker');
    placeBlue(s, 3, 'matchmaker');
    for (const t of s.players[3].tryals.slice(0, 4)) t.revealed = true;
    const w = giveCard(s, 2, 'witness');
    s = act(s, { type: 'play', seat: 2, cardId: w.id, targets: [3] });
    s = act(s, { type: 'revealTryal', seat: 3, tryalId: s.players[3].tryals[4].id });
    expect(s.players[3].alive).toBe(false);
    expect(s.players[2].alive).toBe(false);
    expect(s.turn).toBe(4);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
  });
});

describe('绿卡和蓝卡', () => {
  it('辩护：默认移除最多 3 张指控', () => {
    let s = fixedGame();
    for (let i = 0; i < 4; i++) {
      const a = giveCard(s, 2, 'accusation');
      s = act(s, { type: 'play', seat: 2, cardId: a.id, targets: [3] });
    }
    const alibi = giveCard(s, 2, 'alibi');
    s = act(s, { type: 'play', seat: 2, cardId: alibi.id, targets: [3] });
    expect(redTotal(s.players[3])).toBe(1);
  });

  it('辩护：选择 evidence 时移除 1 张证据', () => {
    let s = fixedGame();
    const e = giveCard(s, 2, 'evidence');
    const a = giveCard(s, 2, 'accusation');
    s = act(s, { type: 'play', seat: 2, cardId: e.id, targets: [3] });
    s = act(s, { type: 'play', seat: 2, cardId: a.id, targets: [3] });
    const alibi = giveCard(s, 2, 'alibi');
    s = act(s, { type: 'play', seat: 2, cardId: alibi.id, targets: [3], option: 'evidence' });
    expect(redTotal(s.players[3])).toBe(1);
  });

  it('拘留：目标跳过下一回合，拘留卡进弃牌堆', () => {
    let s = fixedGame();
    const st = giveCard(s, 2, 'stocks');
    s = act(s, { type: 'play', seat: 2, cardId: st.id, targets: [3] });
    expect(s.players[3].green.map((c) => c.kind)).toEqual(['stocks']);
    s = act(s, { type: 'endTurn', seat: 2 });
    expect(s.turn).toBe(4);
    expect(s.log).toContainEqual({ t: 'skipped', seat: 3 });
    expect(s.players[3].green).toEqual([]);
    expect(s.discard.some((c) => c.id === st.id)).toBe(true);
  });

  it('纵火：丢弃目标所有手牌', () => {
    let s = fixedGame();
    const c = giveCard(s, 2, 'arson');
    s = act(s, { type: 'play', seat: 2, cardId: c.id, targets: [3] });
    expect(s.players[3].hand).toEqual([]);
  });

  it('抢劫：把第一个目标的手牌交给第二个目标', () => {
    let s = fixedGame();
    const c = giveCard(s, 2, 'robbery');
    const before3 = s.players[3].hand.length;
    const before4 = s.players[4].hand.length;
    s = act(s, { type: 'play', seat: 2, cardId: c.id, targets: [3, 4] });
    expect(s.players[3].hand).toEqual([]);
    expect(s.players[4].hand.length).toBe(before3 + before4);
  });

  it('嫁祸：转移红蓝绿卡，接收者达到 7 点时审判', () => {
    let s = fixedGame();
    const e1 = giveCard(s, 2, 'evidence');
    const e2 = giveCard(s, 2, 'evidence');
    const a = giveCard(s, 2, 'accusation');
    s = act(s, { type: 'play', seat: 2, cardId: e1.id, targets: [3] });
    s = act(s, { type: 'play', seat: 2, cardId: e2.id, targets: [3] });
    s = act(s, { type: 'play', seat: 2, cardId: a.id, targets: [4] });
    placeBlue(s, 3, 'asylum');
    const sg = giveCard(s, 2, 'scapegoat');
    s = act(s, { type: 'play', seat: 2, cardId: sg.id, targets: [3, 4] });
    expect(s.players[3].red).toEqual([]);
    expect(s.players[3].blue).toEqual([]);
    expect(s.players[4].blue.map((c) => c.kind)).toEqual(['asylum']);
    expect(s.phase).toEqual({ kind: 'trialReveal', target: 4, initiator: 2 });
  });

  it('诅咒：移除指定的蓝卡；未指定时报错', () => {
    let s = fixedGame();
    const blue = placeBlue(s, 3, 'asylum');
    const c = giveCard(s, 2, 'curse');
    expect(() => act(s, { type: 'play', seat: 2, cardId: c.id, targets: [3] })).toThrow(RuleError);
    s = act(s, { type: 'play', seat: 2, cardId: c.id, targets: [3], option: blue.id });
    expect(s.players[3].blue).toEqual([]);
  });

  it('同一人不能放两张情侣', () => {
    let s = fixedGame();
    const m1 = giveCard(s, 2, 'matchmaker');
    const m2 = giveCard(s, 2, 'matchmaker');
    s = act(s, { type: 'play', seat: 2, cardId: m1.id, targets: [3] });
    expect(() => act(s, { type: 'play', seat: 2, cardId: m2.id, targets: [3] })).toThrow(RuleError);
  });

  it('还没抽牌或出牌时不能结束回合', () => {
    const s = fixedGame();
    expect(() => act(s, { type: 'endTurn', seat: 2 })).toThrow(RuleError);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run test/play.test.ts`
Expected: FAIL，提示找不到 `../src/apply`。

- [ ] **Step 3: 实现 `turn.ts`**

```ts
import { RuleError } from './errors';
import { setPhase } from './state';
import type { GameState } from './types';

/** 从 fromSeat 开始（含）找到下一个可以行动的玩家；被拘留的玩家跳过一次并移除拘留 */
export function startTurn(s: GameState, fromSeat: number): void {
  if (s.phase.kind === 'ended') return;
  const n = s.players.length;
  let seat = ((fromSeat % n) + n) % n;
  for (let i = 0; i < n * 2; i++) {
    const p = s.players[seat];
    if (p.alive) {
      const idx = p.green.findIndex((c) => c.kind === 'stocks');
      if (idx >= 0) {
        s.discard.push(...p.green.splice(idx, 1));
        s.log.push({ t: 'skipped', seat });
      } else {
        s.turn = seat;
        s.drawsLeft = 0;
        setPhase(s, { kind: 'day', mode: 'choose' });
        s.log.push({ t: 'turn', seat });
        return;
      }
    }
    seat = (seat + 1) % n;
  }
  throw new RuleError('没有可以行动的玩家');
}

export function endTurn(s: GameState): void {
  startTurn(s, s.turn + 1);
}
```

- [ ] **Step 4: 实现 `trial.ts`**

```ts
import { getPlayer, redTotal, setPhase, toCard } from './state';
import { endTurn } from './turn';
import type { GameState } from './types';

export const DEFAULT_TRIAL_THRESHOLD = 7;

/** 计划 C 会在这里加入大力士（8）和法官（6） */
export function trialThreshold(_s: GameState, _target: number, _initiator: number | null): number {
  return DEFAULT_TRIAL_THRESHOLD;
}

export function checkTrial(s: GameState, target: number, initiator: number): void {
  const p = getPlayer(s, target);
  if (!p.alive || s.phase.kind === 'ended') return;
  if (redTotal(p) >= trialThreshold(s, target, initiator)) {
    s.log.push({ t: 'trial', target, initiator });
    setPhase(s, { kind: 'trialReveal', target, initiator });
  }
}

/** 被审判者翻牌之后调用：清空其红卡，回到当前玩家的出牌模式 */
export function finishTrial(s: GameState, target: number): void {
  const p = getPlayer(s, target);
  if (p.alive) {
    s.discard.push(...p.red.map(toCard));
    p.red = [];
  }
  if (s.phase.kind === 'ended') return;
  setPhase(s, { kind: 'day', mode: 'playing' });
  if (!s.players[s.turn].alive) endTurn(s);
}
```

- [ ] **Step 5: 实现 `play.ts`**

```ts
import { isBlack, isRed, RED_POINTS } from './cards';
import { RuleError } from './errors';
import { getPlayer, setPhase, toCard } from './state';
import { checkTrial } from './trial';
import type { CardKind, GameState, RedKind } from './types';

const TWO_TARGETS: CardKind[] = ['scapegoat', 'robbery'];

/** 计划 C 会在这里加入部长（证据只算 1 点） */
export function accusationValue(_s: GameState, kind: RedKind, _actor: number, _target: number): number {
  return RED_POINTS[kind];
}

export function playCard(s: GameState, seat: number, cardId: string, targets: number[], option?: string): void {
  if (s.phase.kind !== 'day' || s.phase.mode === 'drawing' || s.turn !== seat) {
    throw new RuleError('现在不能出牌');
  }
  const actor = getPlayer(s, seat);
  const idx = actor.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) throw new RuleError('手牌中没有这张卡');
  const card = actor.hand[idx];
  if (isBlack(card.kind)) throw new RuleError('黑卡不能主动打出');

  const need = TWO_TARGETS.includes(card.kind) ? 2 : 1;
  if (targets.length !== need) throw new RuleError(`这张卡需要选择 ${need} 名目标`);
  const ts = targets.map((t) => getPlayer(s, t));
  if (ts.some((t) => !t.alive)) throw new RuleError('目标必须是活着的玩家');
  if (need === 2 && targets[0] === targets[1]) throw new RuleError('两个目标不能相同');
  const target = ts[0];

  if (isRed(card.kind)) {
    if (target.seat === seat) throw new RuleError('不能对自己打出红卡');
    if (target.blue.some((c) => c.kind === 'piety')) throw new RuleError('信徒：不能对该玩家打出红卡');
  }
  if (card.kind === 'matchmaker' && target.blue.some((c) => c.kind === 'matchmaker')) {
    throw new RuleError('该玩家已经有情侣卡');
  }
  if (card.kind === 'stocks' && target.green.some((c) => c.kind === 'stocks')) {
    throw new RuleError('该玩家已被拘留');
  }
  if (card.kind === 'curse' && !target.blue.some((c) => c.id === option)) {
    throw new RuleError('请选择该玩家面前的一张蓝卡');
  }
  if (card.kind === 'alibi' && option !== undefined && option !== 'accusation' && option !== 'evidence') {
    throw new RuleError('辩护选项无效');
  }

  actor.hand.splice(idx, 1);
  setPhase(s, { kind: 'day', mode: 'playing' });
  s.log.push({ t: 'play', seat, kind: card.kind, targets });

  switch (card.kind) {
    case 'accusation':
    case 'evidence':
    case 'witness':
      target.red.push({ id: card.id, kind: card.kind, points: accusationValue(s, card.kind, seat, target.seat) });
      checkTrial(s, target.seat, seat);
      return;
    case 'matchmaker':
    case 'asylum':
    case 'piety':
    case 'blackCat':
      target.blue.push(card);
      return;
    case 'stocks':
      target.green.push(card);
      return;
    case 'alibi': {
      const mode = option ?? (target.red.some((c) => c.kind === 'accusation') ? 'accusation' : 'evidence');
      const limit = mode === 'accusation' ? 3 : 1;
      let removed = 0;
      target.red = target.red.filter((c) => {
        if (removed < limit && c.kind === mode) {
          removed++;
          s.discard.push(toCard(c));
          return false;
        }
        return true;
      });
      s.discard.push(card);
      return;
    }
    case 'arson':
      s.discard.push(...target.hand, card);
      target.hand = [];
      return;
    case 'robbery': {
      const to = ts[1];
      to.hand.push(...target.hand);
      target.hand = [];
      s.discard.push(card);
      return;
    }
    case 'scapegoat': {
      const to = ts[1];
      to.red.push(...target.red);
      to.blue.push(...target.blue);
      to.green.push(...target.green);
      target.red = [];
      target.blue = [];
      target.green = [];
      s.discard.push(card);
      checkTrial(s, to.seat, seat);
      return;
    }
    case 'curse': {
      const i = target.blue.findIndex((c) => c.id === option);
      s.discard.push(...target.blue.splice(i, 1), card);
      return;
    }
  }
}
```

- [ ] **Step 6: 实现 `apply.ts`**

```ts
import { revealTryal } from './death';
import { RuleError } from './errors';
import { playCard } from './play';
import type { Rng } from './rng';
import { getPlayer } from './state';
import { finishTrial } from './trial';
import { endTurn } from './turn';
import type { Action, GameState } from './types';

export function apply(state: GameState, action: Action, rng: Rng): GameState {
  const s: GameState = JSON.parse(JSON.stringify(state));
  if (s.phase.kind === 'ended') throw new RuleError('游戏已结束');
  if (!getPlayer(s, action.seat).alive) throw new RuleError('死亡的玩家不能行动');

  switch (action.type) {
    case 'play':
      playCard(s, action.seat, action.cardId, action.targets, action.option);
      break;
    case 'endTurn':
      if (s.phase.kind !== 'day' || s.phase.mode !== 'playing' || s.turn !== action.seat) {
        throw new RuleError('现在不能结束回合');
      }
      endTurn(s);
      break;
    case 'revealTryal':
      handleReveal(s, action.seat, action.tryalId, rng);
      break;
    default:
      throw new RuleError('现在不能执行这个操作');
  }

  s.version++;
  return s;
}

function handleReveal(s: GameState, seat: number, tryalId: string, _rng: Rng): void {
  const ph = s.phase;
  if (ph.kind === 'trialReveal' && ph.target === seat) {
    revealTryal(s, seat, tryalId, 'trial');
    finishTrial(s, seat);
    return;
  }
  throw new RuleError('现在不能翻开身份卡');
}
```

- [ ] **Step 7: 运行测试和类型检查，确认通过**

Run: `npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 8: Commit**

```bash
git add engine/src/turn.ts engine/src/trial.ts engine/src/play.ts engine/src/apply.ts engine/test/play.test.ts
git commit -m "feat(engine): add turns, card play, trials and apply entry point

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 第一夜（黑猫）和夜晚

**Files:**
- Create: `engine/src/night.ts`
- Modify: `engine/src/apply.ts`（加入 `witchVote`、`protect`、`confess` 三个分支）
- Test: `engine/test/night.test.ts`

**Interfaces:**
- Consumes: `revealTryal`、`killPlayer`（Task 3）；`startTurn`、`endTurn`（Task 4）；`shuffle`；`state.ts` 工具
- Produces: `startNight(s): void`、`witchVote(s, seat, target, rng): void`、`protect(s, seat, target, rng): void`、`confess(s, seat, tryalId: string | null, rng): void`

- [ ] **Step 1: 写失败的测试**

`engine/test/night.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { RuleError } from '../src/errors';
import { startNight } from '../src/night';
import { seededRng } from '../src/rng';
import type { Action, GameState } from '../src/types';
import { fixedGame, placeBlue, setTryals, V } from './helpers';

const act = (s: GameState, a: Action) => apply(s, a, seededRng(7));

function dawn(): GameState {
  const s = fixedGame();
  s.phase = { kind: 'dawn' };
  return s;
}

function night(): GameState {
  const s = fixedGame();
  startNight(s);
  return s;
}

function everyoneConfessesNothing(s: GameState): GameState {
  for (const p of s.players) if (p.alive) s = act(s, { type: 'confess', seat: p.seat, tryalId: null });
  return s;
}

describe('第一夜', () => {
  it('唯一女巫投票后放置黑猫，由持有者开始回合', () => {
    let s = dawn();
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    expect(s.players[3].blue.map((c) => c.kind)).toEqual(['blackCat']);
    expect(s.setAside).toEqual([]);
    expect(s.log).toContainEqual({ t: 'catPlaced', target: 3 });
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
  });

  it('非女巫不能投票', () => {
    expect(() => act(dawn(), { type: 'witchVote', seat: 2, target: 3 })).toThrow(RuleError);
  });

  it('两名女巫意见一致才放置黑猫', () => {
    let s = dawn();
    setTryals(s, 4, ['witch', V, V, V, V]);
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'witchVote', seat: 4, target: 1 });
    expect(s.phase).toEqual({ kind: 'dawn' });
    s = act(s, { type: 'witchVote', seat: 4, target: 3 });
    expect(s.players[3].blue.map((c) => c.kind)).toEqual(['blackCat']);
  });
});

describe('夜晚', () => {
  it('未受保护的目标死亡；弃牌堆与牌堆重洗；由下一位活着的玩家开始', () => {
    let s = night();
    const before = s.deck.length + s.discard.length;
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 4 });
    s = everyoneConfessesNothing(s);
    expect(s.players[3].alive).toBe(false);
    expect(s.log).toContainEqual({ t: 'nightResult', target: 3, died: true });
    expect(s.discard).toEqual([]);
    expect(s.deck.length).toBe(before + 3);
    expect(s.night).toBeNull();
    expect(s.turn).toBe(4);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
  });

  it('警长保护的目标存活', () => {
    let s = night();
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 3 });
    s = everyoneConfessesNothing(s);
    expect(s.players[3].alive).toBe(true);
    expect(s.log).toContainEqual({ t: 'nightResult', target: 3, died: false });
  });

  it('持有避难的目标存活', () => {
    let s = night();
    placeBlue(s, 3, 'asylum');
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 4 });
    s = everyoneConfessesNothing(s);
    expect(s.players[3].alive).toBe(true);
  });

  it('自首的目标存活，并翻开所选身份卡', () => {
    let s = night();
    const tid = s.players[3].tryals[2].id;
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 4 });
    s = act(s, { type: 'confess', seat: 3, tryalId: tid });
    for (const seat of [0, 1, 2, 4]) s = act(s, { type: 'confess', seat, tryalId: null });
    expect(s.players[3].alive).toBe(true);
    expect(s.players[3].tryals[2].revealed).toBe(true);
    expect(s.log).toContainEqual({ t: 'reveal', seat: 3, kind: 'villager', cause: 'confess' });
  });

  it('所有人都提交前不结算', () => {
    let s = night();
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = act(s, { type: 'protect', seat: 1, target: 4 });
    for (const seat of [0, 1, 2, 3]) s = act(s, { type: 'confess', seat, tryalId: null });
    expect(s.phase).toEqual({ kind: 'night' });
    expect(s.players[3].alive).toBe(true);
  });

  it('警长不能保护自己，非警长不能保护', () => {
    const s = night();
    expect(() => act(s, { type: 'protect', seat: 1, target: 1 })).toThrow(/自己/);
    expect(() => act(s, { type: 'protect', seat: 2, target: 3 })).toThrow(RuleError);
  });

  it('警长卡已翻开时不需要保护也能结算', () => {
    let s = night();
    s.players[1].tryals[0].revealed = true;
    s = act(s, { type: 'witchVote', seat: 0, target: 3 });
    s = everyoneConfessesNothing(s);
    expect(s.players[3].alive).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run test/night.test.ts`
Expected: FAIL，提示找不到 `../src/night`。

- [ ] **Step 3: 实现 `night.ts`**

```ts
import { killPlayer, revealTryal } from './death';
import { RuleError } from './errors';
import { shuffle, type Rng } from './rng';
import { aliveSeats, constableSeat, getPlayer, setPhase, unrevealed, witchSeats } from './state';
import { endTurn, startTurn } from './turn';
import type { GameState } from './types';

/** 所有活着的女巫阵营都投了同一个目标时返回该目标，否则返回 null */
function agreedTarget(s: GameState, votes: Record<number, number>): number | null {
  const witches = witchSeats(s);
  if (witches.length === 0) return null;
  const first = votes[witches[0]];
  if (first === undefined) return null;
  return witches.every((w) => votes[w] === first) ? first : null;
}

export function witchVote(s: GameState, seat: number, target: number, rng: Rng): void {
  if (!getPlayer(s, seat).witchFaction) throw new RuleError('只有女巫阵营可以投票');
  if (!getPlayer(s, target).alive) throw new RuleError('目标必须是活着的玩家');
  if (s.phase.kind === 'dawn') {
    s.dawnVotes[seat] = target;
    tryResolveDawn(s);
    return;
  }
  if (s.phase.kind === 'night' && s.night) {
    s.night.witchVotes[seat] = target;
    tryResolveNight(s, rng);
    return;
  }
  throw new RuleError('现在不能投票');
}

function tryResolveDawn(s: GameState): void {
  const target = agreedTarget(s, s.dawnVotes);
  if (target === null) return;
  const cat = s.setAside.find((c) => c.kind === 'blackCat');
  if (!cat) throw new RuleError('找不到黑猫卡');
  s.setAside = s.setAside.filter((c) => c !== cat);
  getPlayer(s, target).blue.push(cat);
  s.dawnVotes = {};
  s.log.push({ t: 'catPlaced', target });
  startTurn(s, target);
}

export function startNight(s: GameState): void {
  setPhase(s, { kind: 'night' });
  s.night = { witchVotes: {}, protect: null, confessions: {} };
}

export function protect(s: GameState, seat: number, target: number, rng: Rng): void {
  if (s.phase.kind !== 'night' || !s.night) throw new RuleError('现在不能保护');
  if (constableSeat(s) !== seat) throw new RuleError('只有警长可以保护');
  if (target === seat) throw new RuleError('警长不能保护自己');
  if (!getPlayer(s, target).alive) throw new RuleError('目标必须是活着的玩家');
  s.night.protect = target;
  tryResolveNight(s, rng);
}

export function confess(s: GameState, seat: number, tryalId: string | null, rng: Rng): void {
  if (s.phase.kind !== 'night' || !s.night) throw new RuleError('现在不能自首');
  if (tryalId !== null && !unrevealed(getPlayer(s, seat)).some((t) => t.id === tryalId)) {
    throw new RuleError('这张身份卡不能翻开');
  }
  s.night.confessions[seat] = tryalId;
  tryResolveNight(s, rng);
}

function tryResolveNight(s: GameState, rng: Rng): void {
  const night = s.night;
  if (!night) return;
  const target = agreedTarget(s, night.witchVotes);
  if (target === null) return;
  if (constableSeat(s) !== null && night.protect === null) return;
  const alive = aliveSeats(s);
  if (!alive.every((seat) => seat in night.confessions)) return;

  const confessed = new Set<number>();
  for (const seat of alive) {
    const tid = night.confessions[seat];
    if (tid) {
      revealTryal(s, seat, tid, 'confess');
      confessed.add(seat);
    }
  }
  s.night = null;
  if (s.phase.kind === 'ended') return;

  const victim = getPlayer(s, target);
  const died =
    victim.alive &&
    night.protect !== target &&
    !victim.blue.some((c) => c.kind === 'asylum') &&
    !confessed.has(target);
  s.log.push({ t: 'nightResult', target, died });
  if (died) killPlayer(s, target, 'night');
  if (s.phase.kind === 'ended') return;

  s.deck = shuffle([...s.deck, ...s.discard], rng);
  s.discard = [];
  s.log.push({ t: 'reshuffle' });
  endTurn(s);
}
```

- [ ] **Step 4: 在 `apply.ts` 中加入三个分支**

在文件顶部的 import 中加入：

```ts
import { confess, protect, witchVote } from './night';
```

在 `switch (action.type)` 的 `default:` 之前加入：

```ts
    case 'witchVote':
      witchVote(s, action.seat, action.target, rng);
      break;
    case 'protect':
      protect(s, action.seat, action.target, rng);
      break;
    case 'confess':
      confess(s, action.seat, action.tryalId, rng);
      break;
```

- [ ] **Step 5: 运行测试和类型检查，确认通过**

Run: `npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 6: Commit**

```bash
git add engine/src/night.ts engine/src/apply.ts engine/test/night.test.ts
git commit -m "feat(engine): add black cat dawn, night kill, protection and confession

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 抽牌和传染

**Files:**
- Create: `engine/src/conspiracy.ts`
- Modify: `engine/src/turn.ts`（加入 `drawOne`、`startDrawing`、`continueDrawing`、`resumeDrawing`）
- Modify: `engine/src/apply.ts`（加入 `draw`、`conspiracyPick`，以及 `revealTryal` 的黑猫分支）
- Test: `engine/test/draw.test.ts`

**Interfaces:**
- Consumes: `startNight`（Task 5）；`revealTryal`、`checkWin`（Task 3）；`endTurn`（Task 4）
- Produces:
  - `turn.ts`：`drawOne(s, rng): Card | null`、`startDrawing(s, rng): void`、`continueDrawing(s, rng): void`、`resumeDrawing(s, rng): void`
  - `conspiracy.ts`：`startConspiracy(s, card, rng): void`、`catReveal(s, seat, tryalId, rng): void`、`conspiracyPickers(s): number[]`、`conspiracyPick(s, seat, index, rng): void`

- [ ] **Step 1: 写失败的测试**

`engine/test/draw.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { RuleError } from '../src/errors';
import { seededRng } from '../src/rng';
import { constableSeat, countCards } from '../src/state';
import type { Action, GameState } from '../src/types';
import { fixedGame, placeBlue, setTryals, stackDeck, V } from './helpers';

const act = (s: GameState, a: Action) => apply(s, a, seededRng(7));

function everyonePicks(s: GameState, index = 0): GameState {
  for (const p of s.players) {
    if (p.alive && s.phase.kind === 'conspiracyPick') s = act(s, { type: 'conspiracyPick', seat: p.seat, index });
  }
  return s;
}

describe('抽牌', () => {
  it('抽 2 张普通牌后轮到下一位', () => {
    let s = fixedGame();
    stackDeck(s, ['accusation', 'alibi']);
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.players[2].hand.slice(-2).map((c) => c.kind)).toEqual(['accusation', 'alibi']);
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
  });

  it('出过牌之后不能再抽牌；不是自己的回合不能抽牌', () => {
    const s = fixedGame();
    expect(() => act(s, { type: 'draw', seat: 3 })).toThrow(RuleError);
    s.phase = { kind: 'day', mode: 'playing' };
    expect(() => act(s, { type: 'draw', seat: 2 })).toThrow(RuleError);
  });

  it('第二张抽到夜晚：保留第一张，进入夜晚，夜晚卡进弃牌堆', () => {
    let s = fixedGame();
    stackDeck(s, ['accusation', 'night']);
    const handBefore = s.players[2].hand.length;
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.players[2].hand.length).toBe(handBefore + 1);
    expect(s.phase).toEqual({ kind: 'night' });
    expect(s.discard.some((c) => c.kind === 'night')).toBe(true);
    expect(s.log).toContainEqual({ t: 'blackDrawn', seat: 2, kind: 'night' });
  });

  it('牌堆抽空时把弃牌堆洗成新牌堆', () => {
    let s = fixedGame();
    const blacks = s.deck.filter((c) => c.kind === 'night' || c.kind === 'conspiracy');
    s.discard = s.deck.filter((c) => c.kind !== 'night' && c.kind !== 'conspiracy');
    s.setAside.push(...blacks);
    s.deck = [];
    const handBefore = s.players[2].hand.length;
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.players[2].hand.length).toBe(handBefore + 2);
    expect(s.log).toContainEqual({ t: 'reshuffle' });
    expect(countCards(s)).toBe(60);
  });
});

describe('传染', () => {
  it('没有黑猫：所有人从左边拿一张，之后补满 2 张普通牌', () => {
    let s = fixedGame();
    stackDeck(s, ['conspiracy', 'accusation', 'alibi']);
    const handBefore = s.players[2].hand.length;
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.phase).toEqual({ kind: 'conspiracyPick' });
    s = everyonePicks(s, 0);
    expect(s.log).toContainEqual({ t: 'conspiracyDone' });
    expect(s.players[2].hand.length).toBe(handBefore + 2);
    expect(s.turn).toBe(3);
    for (const p of s.players) expect(p.tryals).toHaveLength(5);
  });

  it('拿到女巫卡的人加入女巫阵营，原持有者仍是女巫阵营；拿到警长卡的人成为警长', () => {
    let s = fixedGame();
    stackDeck(s, ['conspiracy', 'accusation', 'alibi']);
    s = act(s, { type: 'draw', seat: 2 });
    s = everyonePicks(s, 0);
    // 4 号的左边是 0 号，0 号第 1 张是女巫；0 号的左边是 1 号，1 号第 1 张是警长
    expect(s.players[4].witchFaction).toBe(true);
    expect(s.players[4].tryals.some((t) => t.kind === 'witch')).toBe(true);
    expect(s.players[0].witchFaction).toBe(true);
    expect(constableSeat(s)).toBe(0);
  });

  it('有黑猫时，持有者先翻开一张身份卡', () => {
    let s = fixedGame();
    placeBlue(s, 3, 'blackCat');
    stackDeck(s, ['conspiracy', 'accusation', 'alibi']);
    s = act(s, { type: 'draw', seat: 2 });
    expect(s.phase).toEqual({ kind: 'catReveal', holder: 3 });
    expect(() => act(s, { type: 'revealTryal', seat: 2, tryalId: s.players[2].tryals[0].id })).toThrow(RuleError);
    s = act(s, { type: 'revealTryal', seat: 3, tryalId: s.players[3].tryals[0].id });
    expect(s.log).toContainEqual({ t: 'reveal', seat: 3, kind: 'villager', cause: 'cat' });
    expect(s.phase).toEqual({ kind: 'conspiracyPick' });
  });

  it('拿牌位置无效时报错；已经拿过的人不能再拿', () => {
    let s = fixedGame();
    stackDeck(s, ['conspiracy', 'accusation', 'alibi']);
    s = act(s, { type: 'draw', seat: 2 });
    expect(() => act(s, { type: 'conspiracyPick', seat: 2, index: 5 })).toThrow(RuleError);
    expect(() => act(s, { type: 'conspiracyPick', seat: 2, index: -1 })).toThrow(RuleError);
  });

  it('黑猫持有者是当前玩家且翻出女巫死亡：传染继续，之后回合交给下一位', () => {
    let s = fixedGame();
    setTryals(s, 2, ['witch', V, V, V, V]);
    placeBlue(s, 2, 'blackCat');
    stackDeck(s, ['conspiracy', 'accusation', 'alibi']);
    s = act(s, { type: 'draw', seat: 2 });
    s = act(s, { type: 'revealTryal', seat: 2, tryalId: s.players[2].tryals[0].id });
    expect(s.players[2].alive).toBe(false);
    expect(s.phase).toEqual({ kind: 'conspiracyPick' });
    s = everyonePicks(s, 0);
    expect(s.turn).toBe(3);
    expect(s.phase).toEqual({ kind: 'day', mode: 'choose' });
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run test/draw.test.ts`
Expected: FAIL（`draw` 操作报「现在不能执行这个操作」，或找不到模块）。

- [ ] **Step 3: 在 `turn.ts` 中加入抽牌函数**

把 `turn.ts` 顶部的 import 改为：

```ts
import { startConspiracy } from './conspiracy';
import { RuleError } from './errors';
import { startNight } from './night';
import { shuffle, type Rng } from './rng';
import { setPhase } from './state';
import type { Card, GameState } from './types';
```

在文件末尾追加：

```ts
/** 从牌堆顶抽一张；牌堆空了就把弃牌堆洗成新牌堆 */
export function drawOne(s: GameState, rng: Rng): Card | null {
  if (s.deck.length === 0) {
    if (s.discard.length === 0) return null;
    s.deck = shuffle(s.discard, rng);
    s.discard = [];
    s.log.push({ t: 'reshuffle' });
  }
  return s.deck.shift() ?? null;
}

export function startDrawing(s: GameState, rng: Rng): void {
  s.drawsLeft = 2;
  setPhase(s, { kind: 'day', mode: 'drawing' });
  continueDrawing(s, rng);
}

/** 抽到 2 张非黑卡为止；抽到夜晚则回合结束，抽到传染则先结算传染 */
export function continueDrawing(s: GameState, rng: Rng): void {
  while (s.drawsLeft > 0) {
    if (s.phase.kind !== 'day' || s.phase.mode !== 'drawing') return;
    const card = drawOne(s, rng);
    if (!card) {
      s.drawsLeft = 0;
      break;
    }
    if (card.kind === 'night') {
      s.log.push({ t: 'blackDrawn', seat: s.turn, kind: 'night' });
      s.discard.push(card);
      s.drawsLeft = 0;
      startNight(s);
      return;
    }
    if (card.kind === 'conspiracy') {
      s.log.push({ t: 'blackDrawn', seat: s.turn, kind: 'conspiracy' });
      startConspiracy(s, card, rng);
      return;
    }
    s.players[s.turn].hand.push(card);
    s.drawsLeft--;
    s.log.push({ t: 'draw', seat: s.turn });
  }
  if (s.phase.kind === 'day' && s.phase.mode === 'drawing') endTurn(s);
}

/** 传染结算完后回到抽牌；当前玩家已经死亡则直接结束回合 */
export function resumeDrawing(s: GameState, rng: Rng): void {
  if (s.phase.kind === 'ended') return;
  setPhase(s, { kind: 'day', mode: 'drawing' });
  if (!s.players[s.turn].alive) {
    s.drawsLeft = 0;
    endTurn(s);
    return;
  }
  continueDrawing(s, rng);
}
```

- [ ] **Step 4: 实现 `conspiracy.ts`**

```ts
import { checkWin, revealTryal } from './death';
import { RuleError } from './errors';
import type { Rng } from './rng';
import { aliveSeats, catHolder, getPlayer, leftOf, setPhase, unrevealed } from './state';
import { resumeDrawing } from './turn';
import type { Card, GameState } from './types';

export function startConspiracy(s: GameState, card: Card, rng: Rng): void {
  s.discard.push(card);
  const holder = catHolder(s);
  if (holder !== null) {
    setPhase(s, { kind: 'catReveal', holder });
    return;
  }
  beginPicks(s, rng);
}

export function catReveal(s: GameState, seat: number, tryalId: string, rng: Rng): void {
  if (s.phase.kind !== 'catReveal' || s.phase.holder !== seat) throw new RuleError('现在不能翻开身份卡');
  revealTryal(s, seat, tryalId, 'cat');
  if (s.phase.kind === 'ended') return;
  beginPicks(s, rng);
}

/** 需要拿牌的玩家：活着，且左边邻居还有未翻开的身份卡 */
export function conspiracyPickers(s: GameState): number[] {
  return aliveSeats(s).filter((seat) => {
    const left = leftOf(s, seat);
    return left !== null && unrevealed(getPlayer(s, left)).length > 0;
  });
}

function beginPicks(s: GameState, rng: Rng): void {
  s.conspiracyPicks = {};
  setPhase(s, { kind: 'conspiracyPick' });
  if (conspiracyPickers(s).length === 0) finishConspiracy(s, rng);
}

export function conspiracyPick(s: GameState, seat: number, index: number, rng: Rng): void {
  if (s.phase.kind !== 'conspiracyPick') throw new RuleError('现在不能拿身份卡');
  if (!conspiracyPickers(s).includes(seat)) throw new RuleError('你不需要拿身份卡');
  if (seat in s.conspiracyPicks) throw new RuleError('你已经拿过了');
  const left = leftOf(s, seat) as number;
  const count = unrevealed(getPlayer(s, left)).length;
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new RuleError('选择的位置无效');
  s.conspiracyPicks[seat] = index;
  if (conspiracyPickers(s).every((p) => p in s.conspiracyPicks)) finishConspiracy(s, rng);
}

/** 所有人同时拿牌：先按拿牌前的局面算出每一步，再一起移动 */
function finishConspiracy(s: GameState, rng: Rng): void {
  const moves = conspiracyPickers(s).map((seat) => {
    const from = leftOf(s, seat) as number;
    const tryal = unrevealed(getPlayer(s, from))[s.conspiracyPicks[seat]];
    return { seat, from, tryalId: tryal.id };
  });
  for (const m of moves) {
    const giver = getPlayer(s, m.from);
    const i = giver.tryals.findIndex((t) => t.id === m.tryalId);
    const [tryal] = giver.tryals.splice(i, 1);
    const receiver = getPlayer(s, m.seat);
    receiver.tryals.push(tryal);
    if (tryal.kind === 'witch') receiver.witchFaction = true;
  }
  s.conspiracyPicks = {};
  s.log.push({ t: 'conspiracyDone' });
  checkWin(s);
  resumeDrawing(s, rng);
}
```

- [ ] **Step 5: 修改 `apply.ts`**

在 import 中加入：

```ts
import { catReveal, conspiracyPick } from './conspiracy';
import { startDrawing } from './turn';
```

（`startDrawing` 与已有的 `endTurn` 合并为一行：`import { endTurn, startDrawing } from './turn';`）

在 `switch (action.type)` 的 `default:` 之前加入：

```ts
    case 'draw':
      if (s.phase.kind !== 'day' || s.phase.mode !== 'choose' || s.turn !== action.seat) {
        throw new RuleError('现在不能抽牌');
      }
      startDrawing(s, rng);
      break;
    case 'conspiracyPick':
      conspiracyPick(s, action.seat, action.index, rng);
      break;
```

把 `handleReveal` 替换为：

```ts
function handleReveal(s: GameState, seat: number, tryalId: string, rng: Rng): void {
  const ph = s.phase;
  if (ph.kind === 'trialReveal' && ph.target === seat) {
    revealTryal(s, seat, tryalId, 'trial');
    finishTrial(s, seat);
    return;
  }
  if (ph.kind === 'catReveal') {
    catReveal(s, seat, tryalId, rng);
    return;
  }
  throw new RuleError('现在不能翻开身份卡');
}
```

- [ ] **Step 6: 运行测试和类型检查，确认通过**

Run: `npx vitest run && npm run typecheck`
Expected: 全部 PASS（包括之前 Task 1–5 的测试）。

- [ ] **Step 7: Commit**

```bash
git add engine/src/turn.ts engine/src/conspiracy.ts engine/src/apply.ts engine/test/draw.test.ts
git commit -m "feat(engine): add drawing, black card handling and conspiracy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 公开视图和私密视图

**Files:**
- Create: `engine/src/view.ts`
- Test: `engine/test/view.test.ts`

**Interfaces:**
- Consumes: `conspiracyPickers`（Task 6）、`trialThreshold`（Task 4）、`state.ts` 工具
- Produces:
  - `interface PublicPlayer`、`interface PublicView`、`projectPublic(s): PublicView`
  - `type PendingChoice`、`interface PrivateView`、`projectPrivate(s, seat): PrivateView`

- [ ] **Step 1: 写失败的测试**

`engine/test/view.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { revealTryal } from '../src/death';
import { startNight } from '../src/night';
import { projectPrivate, projectPublic } from '../src/view';
import { fixedGame, newGame, setTryals, V } from './helpers';

describe('projectPublic', () => {
  it('未翻开的身份卡不显示种类，翻开后显示', () => {
    const s = fixedGame();
    revealTryal(s, 3, s.players[3].tryals[1].id, 'trial');
    const view = projectPublic(s);
    expect(view.players[0].tryals.every((t) => t.kind === null)).toBe(true);
    expect(view.players[3].tryals[1]).toEqual({ revealed: true, kind: 'villager' });
    expect(view.players[3].tryals[0]).toEqual({ revealed: false, kind: null });
  });

  it('不包含任何人的手牌内容、身份卡 id 和牌堆内容', () => {
    const s = newGame(6, 5);
    const json = JSON.stringify(projectPublic(s));
    for (const p of s.players) {
      for (const c of p.hand) expect(json).not.toContain(`"${c.id}"`);
      for (const t of p.tryals) expect(json).not.toContain(`"${t.id}"`);
    }
    for (const c of s.deck) expect(json).not.toContain(`"${c.id}"`);
    expect(json).not.toContain('"witch"');
    expect(json).not.toContain('"constable"');
    expect(projectPublic(s).players[0].handCount).toBe(3);
  });

  it('游戏中不公开阵营，结束后公开所有身份和阵营', () => {
    const s = fixedGame();
    expect(projectPublic(s).players[0].witchFaction).toBeNull();
    revealTryal(s, 0, s.players[0].tryals[0].id, 'trial');
    const view = projectPublic(s);
    expect(view.phase).toEqual({ kind: 'ended', winner: 'village' });
    expect(view.players[0].witchFaction).toBe(true);
    expect(view.players[1].tryals.every((t) => t.kind !== null)).toBe(true);
  });

  it('显示红卡总点数和审判线', () => {
    const s = fixedGame();
    s.players[3].red.push({ id: 'evidence-1', kind: 'evidence', points: 3 });
    const p = projectPublic(s).players[3];
    expect(p.redTotal).toBe(3);
    expect(p.threshold).toBe(7);
  });
});

describe('projectPrivate', () => {
  it('只包含自己的手牌和身份卡', () => {
    const s = fixedGame();
    const view = projectPrivate(s, 2);
    expect(view.hand).toEqual(s.players[2].hand);
    expect(view.tryals).toEqual(s.players[2].tryals);
    const json = JSON.stringify(view);
    for (const c of s.players[3].hand) expect(json).not.toContain(`"${c.id}"`);
  });

  it('女巫能看到同伴，村民看不到', () => {
    const s = fixedGame();
    setTryals(s, 4, ['witch', V, V, V, V]);
    expect(projectPrivate(s, 0).witchPartners).toEqual([4]);
    expect(projectPrivate(s, 2).witchPartners).toEqual([]);
    expect(projectPrivate(s, 1).isConstable).toBe(true);
  });

  it('待办选择：轮到自己时是 turn；黎明时只有女巫有投票', () => {
    const s = fixedGame();
    expect(projectPrivate(s, 2).pending).toEqual({ kind: 'turn', mode: 'choose' });
    expect(projectPrivate(s, 3).pending).toBeNull();
    s.phase = { kind: 'dawn' };
    expect(projectPrivate(s, 0).pending).toEqual({ kind: 'dawnVote', votes: {} });
    expect(projectPrivate(s, 2).pending).toBeNull();
  });

  it('夜晚：每个人都有夜晚面板，只有女巫能看到投票，只有警长能看到保护对象', () => {
    const s = fixedGame();
    startNight(s);
    s.night!.witchVotes[0] = 3;
    s.night!.protect = 4;
    expect(projectPrivate(s, 0).pending).toEqual({
      kind: 'night', witch: true, votes: { 0: 3 }, constable: false, protect: null, confessed: false,
    });
    expect(projectPrivate(s, 1).pending).toEqual({
      kind: 'night', witch: false, votes: null, constable: true, protect: 4, confessed: false,
    });
    expect(projectPrivate(s, 2).pending).toEqual({
      kind: 'night', witch: false, votes: null, constable: false, protect: null, confessed: false,
    });
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run test/view.test.ts`
Expected: FAIL，提示找不到 `../src/view`。

- [ ] **Step 3: 实现 `view.ts`**

```ts
import { conspiracyPickers } from './conspiracy';
import { constableSeat, getPlayer, leftOf, redTotal, unrevealed } from './state';
import { trialThreshold } from './trial';
import type { Card, GameEvent, GameState, Phase, RedKind, Tryal, TryalKind } from './types';

export interface PublicPlayer {
  seat: number;
  name: string;
  character: string | null;
  alive: boolean;
  handCount: number;
  tryals: { revealed: boolean; kind: TryalKind | null }[];
  red: { kind: RedKind; points: number }[];
  redTotal: number;
  threshold: number;
  blue: Card[];
  green: Card[];
  /** 游戏结束前为 null */
  witchFaction: boolean | null;
}

export interface PublicView {
  players: PublicPlayer[];
  deckCount: number;
  discardCount: number;
  turn: number;
  phase: Phase;
  log: GameEvent[];
  version: number;
}

export function projectPublic(s: GameState): PublicView {
  const ended = s.phase.kind === 'ended';
  return {
    players: s.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      character: p.character,
      alive: p.alive,
      handCount: p.hand.length,
      tryals: p.tryals.map((t) => ({ revealed: t.revealed, kind: t.revealed || ended ? t.kind : null })),
      red: p.red.map((c) => ({ kind: c.kind, points: c.points })),
      redTotal: redTotal(p),
      threshold: trialThreshold(s, p.seat, null),
      blue: p.blue,
      green: p.green,
      witchFaction: ended ? p.witchFaction : null,
    })),
    deckCount: s.deck.length,
    discardCount: s.discard.length,
    turn: s.turn,
    phase: s.phase,
    log: s.log,
    version: s.version,
  };
}

export type PendingChoice =
  | { kind: 'turn'; mode: 'choose' | 'playing' }
  | { kind: 'revealTryal'; reason: 'trial' | 'cat' }
  | { kind: 'conspiracyPick'; from: number; count: number }
  | { kind: 'dawnVote'; votes: Record<number, number> }
  | {
      kind: 'night';
      witch: boolean;
      votes: Record<number, number> | null;
      constable: boolean;
      protect: number | null;
      confessed: boolean;
    };

export interface PrivateView {
  seat: number;
  hand: Card[];
  tryals: Tryal[];
  witchFaction: boolean;
  witchPartners: number[];
  isConstable: boolean;
  pending: PendingChoice | null;
}

export function projectPrivate(s: GameState, seat: number): PrivateView {
  const p = getPlayer(s, seat);
  return {
    seat,
    hand: p.hand,
    tryals: p.tryals,
    witchFaction: p.witchFaction,
    witchPartners: p.witchFaction
      ? s.players.filter((q) => q.witchFaction && q.seat !== seat).map((q) => q.seat)
      : [],
    isConstable: constableSeat(s) === seat,
    pending: p.alive ? pendingFor(s, seat) : null,
  };
}

function pendingFor(s: GameState, seat: number): PendingChoice | null {
  const ph = s.phase;
  const p = getPlayer(s, seat);
  switch (ph.kind) {
    case 'day':
      if (s.turn !== seat || ph.mode === 'drawing') return null;
      return { kind: 'turn', mode: ph.mode };
    case 'trialReveal':
      return ph.target === seat ? { kind: 'revealTryal', reason: 'trial' } : null;
    case 'catReveal':
      return ph.holder === seat ? { kind: 'revealTryal', reason: 'cat' } : null;
    case 'conspiracyPick': {
      if (!conspiracyPickers(s).includes(seat) || seat in s.conspiracyPicks) return null;
      const from = leftOf(s, seat) as number;
      return { kind: 'conspiracyPick', from, count: unrevealed(getPlayer(s, from)).length };
    }
    case 'dawn':
      return p.witchFaction ? { kind: 'dawnVote', votes: s.dawnVotes } : null;
    case 'night': {
      const night = s.night;
      if (!night) return null;
      const isConstable = constableSeat(s) === seat;
      return {
        kind: 'night',
        witch: p.witchFaction,
        votes: p.witchFaction ? night.witchVotes : null,
        constable: isConstable,
        protect: isConstable ? night.protect : null,
        confessed: seat in night.confessions,
      };
    }
    default:
      return null;
  }
}
```

- [ ] **Step 4: 运行测试和类型检查，确认通过**

Run: `npx vitest run && npm run typecheck`
Expected: 全部 PASS。

- [ ] **Step 5: Commit**

```bash
git add engine/src/view.ts engine/test/view.test.ts
git commit -m "feat(engine): add public and private view projections

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 超时默认操作、随机对局模拟和对外导出

**Files:**
- Create: `engine/src/auto.ts`, `engine/src/index.ts`
- Test: `engine/test/auto.test.ts`, `engine/test/simulate.test.ts`

**Interfaces:**
- Consumes: 之前所有任务的导出
- Produces:
  - `autoActions(s, rng): Action[]`：返回让当前等待中的阶段向前推进的默认操作。调用方需要**按顺序逐个 apply，遇到 `RuleError` 就跳过这一条**（因为前面的操作可能已经让阶段结算）。
  - `index.ts`：计划 B 使用的全部对外接口

- [ ] **Step 1: 写失败的测试**

`engine/test/auto.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { autoActions } from '../src/auto';
import { RuleError } from '../src/errors';
import { startNight } from '../src/night';
import { seededRng } from '../src/rng';
import type { GameState } from '../src/types';
import { fixedGame, setTryals, V } from './helpers';

function applyAll(s: GameState): GameState {
  const rng = seededRng(3);
  for (const a of autoActions(s, rng)) {
    try {
      s = apply(s, a, rng);
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
    }
  }
  return s;
}

describe('autoActions', () => {
  it('轮到的玩家还没行动时默认抽 2 张；出过牌时默认结束回合', () => {
    const s = fixedGame();
    expect(autoActions(s, seededRng(1))).toEqual([{ type: 'draw', seat: 2 }]);
    s.phase = { kind: 'day', mode: 'playing' };
    expect(autoActions(s, seededRng(1))).toEqual([{ type: 'endTurn', seat: 2 }]);
  });

  it('审判超时：随机翻开被审判者的一张未翻开身份卡', () => {
    let s = fixedGame();
    s.phase = { kind: 'trialReveal', target: 3, initiator: 2 };
    s = applyAll(s);
    expect(s.players[3].tryals.filter((t) => t.revealed)).toHaveLength(1);
    expect(s.phase).toEqual({ kind: 'day', mode: 'playing' });
  });

  it('黎明超时：女巫统一投票，黑猫被放置', () => {
    let s = fixedGame();
    s.phase = { kind: 'dawn' };
    s = applyAll(s);
    expect(s.players.some((p) => p.blue.some((c) => c.kind === 'blackCat'))).toBe(true);
    expect(s.phase.kind).toBe('day');
  });

  it('夜晚超时且两名女巫意见不一：统一投给得票最多的目标，夜晚能结算', () => {
    let s = fixedGame();
    setTryals(s, 4, ['witch', V, V, V, V]);
    startNight(s);
    s.night!.witchVotes = { 0: 3, 4: 2 };
    s = applyAll(s);
    expect(s.night).toBeNull();
    expect(s.log.some((e) => e.t === 'nightResult' && e.target === 3)).toBe(true);
  });

  it('传染超时：所有还没拿牌的人随机拿一张', () => {
    let s = fixedGame();
    s.phase = { kind: 'conspiracyPick' };
    s.drawsLeft = 2;
    s = applyAll(s);
    expect(s.log).toContainEqual({ t: 'conspiracyDone' });
  });
});
```

`engine/test/simulate.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply';
import { autoActions } from '../src/auto';
import { TOTAL_GAME_CARDS, TRYALS_PER_PLAYER } from '../src/cards';
import { RuleError } from '../src/errors';
import { pick, seededRng } from '../src/rng';
import { createGame } from '../src/setup';
import { aliveSeats, countCards, getPlayer } from '../src/state';
import type { Action, GameState } from '../src/types';
import { projectPublic } from '../src/view';

const GAMES = 300;
const MAX_STEPS = 20000;

function tryApply(s: GameState, a: Action, rng: ReturnType<typeof seededRng>): GameState {
  try {
    return apply(s, a, rng);
  } catch (e) {
    if (e instanceof RuleError) return s;
    throw e;
  }
}

function checkInvariants(s: GameState, n: number, seed: number): void {
  if (countCards(s) !== TOTAL_GAME_CARDS) throw new Error(`第 ${seed} 局：卡牌总数变为 ${countCards(s)}`);
  const tryals = s.players.reduce((k, p) => k + p.tryals.length, 0);
  if (tryals !== n * TRYALS_PER_PLAYER) throw new Error(`第 ${seed} 局：身份卡总数变为 ${tryals}`);
  if (s.phase.kind === 'ended') return;
  const view = projectPublic(s);
  for (const p of s.players) {
    p.tryals.forEach((t, i) => {
      if (!t.revealed && view.players[p.seat].tryals[i].kind !== null) {
        throw new Error(`第 ${seed} 局：公开视图泄露了未翻开的身份卡`);
      }
    });
  }
}

function runGame(seed: number): GameState {
  const n = 4 + (seed % 9);
  const rng = seededRng(seed);
  let s = createGame(
    Array.from({ length: n }, (_, i) => ({ openid: `u${i}`, name: `P${i}` })),
    rng,
  );
  for (let step = 0; step < MAX_STEPS; step++) {
    if (s.phase.kind === 'ended') return s;
    const ph = s.phase;
    let acted = false;
    if (ph.kind === 'day' && ph.mode !== 'drawing' && rng.next() < 0.5) {
      const p = s.players[s.turn];
      if (p.hand.length > 0) {
        const card = pick(p.hand, rng);
        const alive = aliveSeats(s);
        const count = card.kind === 'scapegoat' || card.kind === 'robbery' ? 2 : 1;
        const targets = Array.from({ length: count }, () => pick(alive, rng));
        const option = card.kind === 'curse' ? getPlayer(s, targets[0]).blue[0]?.id : undefined;
        const next = tryApply(s, { type: 'play', seat: s.turn, cardId: card.id, targets, option }, rng);
        acted = next !== s;
        s = next;
      }
    }
    if (!acted) {
      for (const a of autoActions(s, rng)) s = tryApply(s, a, rng);
    }
    checkInvariants(s, n, seed);
  }
  throw new Error(`第 ${seed} 局在 ${MAX_STEPS} 步内没有结束`);
}

describe('随机对局模拟', () => {
  it(`${GAMES} 局 4–12 人随机对局全部正常结束且不变量成立`, () => {
    const winners = { village: 0, witch: 0 };
    for (let seed = 1; seed <= GAMES; seed++) {
      const s = runGame(seed);
      if (s.phase.kind !== 'ended') throw new Error('unreachable');
      winners[s.phase.winner]++;
    }
    expect(winners.village + winners.witch).toBe(GAMES);
  }, 120_000);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npx vitest run test/auto.test.ts test/simulate.test.ts`
Expected: FAIL，提示找不到 `../src/auto`。

- [ ] **Step 3: 实现 `auto.ts`**

```ts
import { conspiracyPickers } from './conspiracy';
import { pick, type Rng } from './rng';
import { aliveSeats, constableSeat, getPlayer, leftOf, unrevealed, witchSeats } from './state';
import type { Action, GameState } from './types';

/** 得票最多的目标（票数相同时取先出现的），没有票时返回 null */
function majority(votes: Record<number, number>): number | null {
  const counts = new Map<number, number>();
  for (const v of Object.values(votes)) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = 0;
  for (const [target, count] of counts) {
    if (count > bestCount) {
      best = target;
      bestCount = count;
    }
  }
  return best;
}

/**
 * 超时时的默认操作。调用方按顺序逐个 apply，遇到 RuleError 跳过该条。
 */
export function autoActions(s: GameState, rng: Rng): Action[] {
  const ph = s.phase;
  switch (ph.kind) {
    case 'day':
      if (ph.mode === 'choose') return [{ type: 'draw', seat: s.turn }];
      if (ph.mode === 'playing') return [{ type: 'endTurn', seat: s.turn }];
      return [];
    case 'trialReveal':
      return [{ type: 'revealTryal', seat: ph.target, tryalId: pick(unrevealed(getPlayer(s, ph.target)), rng).id }];
    case 'catReveal':
      return [{ type: 'revealTryal', seat: ph.holder, tryalId: pick(unrevealed(getPlayer(s, ph.holder)), rng).id }];
    case 'conspiracyPick':
      return conspiracyPickers(s)
        .filter((seat) => !(seat in s.conspiracyPicks))
        .map((seat): Action => {
          const count = unrevealed(getPlayer(s, leftOf(s, seat) as number)).length;
          return { type: 'conspiracyPick', seat, index: Math.floor(rng.next() * count) };
        });
    case 'dawn': {
      const target = majority(s.dawnVotes) ?? pick(aliveSeats(s), rng);
      return witchSeats(s).map((seat): Action => ({ type: 'witchVote', seat, target }));
    }
    case 'night': {
      const night = s.night;
      if (!night) return [];
      const alive = aliveSeats(s);
      const actions: Action[] = [];
      const constable = constableSeat(s);
      const others = alive.filter((x) => x !== constable);
      if (constable !== null && night.protect === null && others.length > 0) {
        actions.push({ type: 'protect', seat: constable, target: pick(others, rng) });
      }
      for (const seat of alive) {
        if (!(seat in night.confessions)) actions.push({ type: 'confess', seat, tryalId: null });
      }
      const target = majority(night.witchVotes) ?? pick(alive, rng);
      for (const seat of witchSeats(s)) actions.push({ type: 'witchVote', seat, target });
      return actions;
    }
    default:
      return [];
  }
}
```

- [ ] **Step 4: 实现 `index.ts`**

```ts
export * from './types';
export { RuleError } from './errors';
export { mathRng, pick, seededRng, shuffle, type Rng } from './rng';
export { TOTAL_GAME_CARDS, TRYALS_PER_PLAYER } from './cards';
export { createGame, type NewPlayer } from './setup';
export { apply } from './apply';
export { autoActions } from './auto';
export { countCards } from './state';
export {
  projectPrivate,
  projectPublic,
  type PendingChoice,
  type PrivateView,
  type PublicPlayer,
  type PublicView,
} from './view';
```

- [ ] **Step 5: 运行全部测试和类型检查，确认通过**

Run: `npx vitest run && npm run typecheck`
Expected: 全部 PASS。模拟测试应在 120 秒内完成；如果任何一局失败，错误信息会给出种子编号，用 `runGame(种子)` 单独复现并修复对应规则代码（不要改测试的不变量）。

- [ ] **Step 6: Commit**

```bash
git add engine/src/auto.ts engine/src/index.ts engine/test/auto.test.ts engine/test/simulate.test.ts
git commit -m "feat(engine): add timeout auto actions, random game simulation and public exports

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## 计划 A 完成后

- 规则引擎可以在电脑上完整跑通对局，基础规则和保密性都有测试覆盖。
- 下一步写 **计划 B**（云函数 + 数据库权限 + 小程序页面），它通过 `engine/src/index.ts` 使用引擎。
- **计划 C**（15 个角色）会修改 `trialThreshold`、`accusationValue` 并在抽牌、死亡、翻牌等位置加入钩子。
